// Browser regression check for setup/guide observer feedback. No production service is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const { chromium } = require(option('--playwright') || 'playwright');
const beforeFix = process.argv.includes('--before-fix');
const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<title>Setup check</title><div id="game-section"></div><div id="table3d-section"></div><div id="waiting-status-banner"><span id="action-guide-title"></span><span id="action-guide-detail"></span><button id="action-guide-button"></button></div><aside id="turn-notice"></aside>'); return; }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !file.endsWith('.js') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    let source = fs.readFileSync(file, 'utf8');
    // Reconstruct the two observer behaviors that existed before the fix.
    if (beforeFix && pathname.endsWith('/life-setup.js')) {
        const start = source.indexOf('    const signature = JSON.stringify(');
        const end = source.indexOf('    if (panel.parentElement !== mount)', start);
        source = source.slice(0, start) + source.slice(end);
        const observerStart = source.indexOf('    let was3D =');
        const observerEnd = source.indexOf('    observer.observe', observerStart);
        source = source.slice(0, observerStart) + '    const observer = new MutationObserver(render);\n' + source.slice(observerEnd);
    }
    if (beforeFix && pathname.endsWith('/action-guide.js')) {
        source = source.replaceAll("if (document.body.classList.contains('turn-attention')) document.body.classList.remove('turn-attention');", "document.body.classList.remove('turn-attention');");
        source = source.replace('requestAnimationFrame(update);', 'queueMicrotask(update);');
    }
    res.setHeader('Content-Type', 'text/javascript'); res.end(source);
});
(async () => {
    let browser;
    try {

        browser = await chromium.launch({ headless: true, executablePath: option('--browser'), timeout: 15000 });
        const page = await browser.newPage();
        await page.addInitScript(() => {
            const NativeObserver = MutationObserver;
            const all = []; window.observerCallbacks = 0; window.observerRunaway = false;
            window.MutationObserver = class extends NativeObserver {
                constructor(callback) {
                    super((records, observer) => {
                        if (++window.observerCallbacks > 150) {
                            window.observerRunaway = true; all.forEach(item => item.disconnect()); return;
                        }
                        callback(records, observer);
                    }); all.push(this);
                }
            };
        });
        // Fulfill every request directly from memory; no loopback or external network access.
        await page.route('http://setup.test/**', async route => {
            const headers = {}; let status = 200;
            const response = { setHeader(name, value) { headers[name] = value; }, writeHead(code) { status = code; },
                end(body = '') { return route.fulfill({ status, headers, body }); } };
            server.emit('request', { url: new URL(route.request().url()).pathname }, response);
        });
        await page.goto('http://setup.test/');
        await page.evaluate(async () => {
            const { client } = await import('/public/js/core/client.js');
            const callbacks = new Map();
            client.state.socket = { connected: true, on(event, fn) { const list = callbacks.get(event) || []; list.push(fn); callbacks.set(event, list); }, emit() {} };
            client.state.myUniqueId = 'one';
            client.state.currentRoomState = { gameStarted: true, currentPhase: 'SETUP', players: {
                one: { uniqueId: 'one', name: 'One', alive: true, tryalCardCount: 0, tryalCards: [] },
                two: { uniqueId: 'two', name: 'Two', alive: true, tryalCardCount: 0, tryalCards: [] }
            }, lifeSetup: { id: 'round', stage: 'shuffle', order: ['one','two'], count: 2, dealt: 0, total: 4, confirmed: [], lastDeal: null } };
            client.actions.createCardImage = () => document.createElement('img');
            client.actions.switchMobileGameTab = () => {};
            document.body.className = 'in-game';
            window.client = client;
            window.notify = event => (callbacks.get(event) || []).forEach(fn => fn(client.state.currentRoomState));
            (await import('/public/js/views/action-guide.js')).initialize();
            (await import('/public/js/views/life-setup.js')).initialize();
            window.notify('room state update');
        });
        await page.waitForTimeout(350);
        const runaway = await page.evaluate(() => ({ stopped: window.observerRunaway, callbacks: window.observerCallbacks }));
        if (beforeFix) {
            assert.equal(runaway.stopped, true, 'Old observer feedback should reproduce: ' + JSON.stringify(runaway));
            console.log('REPRODUCED: pre-fix observers exceeded 150 callbacks without new game state.'); return;
        }
        assert.equal(runaway.stopped, false, 'Observers must settle');
        const stable = await page.evaluate(() => {
            const original = document.querySelector('#life-setup-panel h3');
            for (let i = 0; i < 40; i++) { document.body.classList.remove('unrelated-class'); window.notify('room state update'); }
            return new Promise(resolve => setTimeout(() => resolve(original === document.querySelector('#life-setup-panel h3')), 100));
        });
        assert.equal(stable, true, 'Identical state/body class updates must preserve the setup DOM');
        await page.evaluate(() => {
            const state = window.client.state.currentRoomState;
            state.lifeSetup.stage = 'arrange'; state.lifeSetup.dealt = 4;
            for (const player of Object.values(state.players)) { player.tryalCardCount = 2; player.tryalCards = [{ name: 'Not A Witch' }, { name: 'Constable' }]; }
            window.notify('room state update');
        });
        await page.waitForTimeout(100);
        await page.locator('.setup-own-lives button').first().click();
        await page.waitForTimeout(70);
        await page.evaluate(() => window.notify('room state update'));
        await page.waitForTimeout(70);
        assert.equal(await page.locator('.setup-own-lives button[aria-pressed=true]').count(), 1, 'Unchanged state must retain the selected life');
        await page.evaluate(() => document.body.classList.add('game-view-3d'));
        await page.waitForTimeout(100);
        assert.equal(await page.locator('#table3d-section > #life-setup-panel').count(), 1, 'View switch must move the setup panel');
        assert.equal(await page.evaluate(() => window.observerRunaway), false);
        console.log('PASS: observers settle; repeated state preserves DOM; life selection persists; 2D/3D switch works.');
    } finally { await browser?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
