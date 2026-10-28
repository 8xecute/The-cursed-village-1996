// Render the real bundled scene with sample players; no game server is needed.
// node scripts/preview-table3d.cjs OUTPUT_DIRECTORY
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
    const output = path.resolve(process.argv[2]); fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
        await page.route('http://preview.test/**', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<meta charset="utf-8"><style>body{margin:0;background:#18130f}#table{width:100vw;height:100vh}</style><div id="table"></div>' });
            const file = path.resolve(root, 'public', '.' + pathname);
            if (!file.startsWith(root + path.sep)) return route.abort();
            const contentType = pathname.endsWith('.glb') ? 'model/gltf-binary' : pathname.endsWith('.png') ? 'image/png' : 'text/javascript';
            return route.fulfill({ contentType, body: fs.readFileSync(file) });
        });
        await page.goto('http://preview.test/');
        await page.addScriptTag({ url: '/table3d.bundle.js' });
        await page.evaluate(() => {
            const life = ['Witch', 'Constable', 'Not A Witch', 'Not A Witch', 'Not A Witch'].map(name => ({ name }));
            const players = Object.fromEntries(Array.from({ length: 4 }, (_, i) => ['p' + i, {
                uniqueId: 'p' + i, name: ['คุณ', 'ผู้เล่นที่ตาย', 'ผู้เล่น 2', 'ผู้เล่น 3'][i], alive: i !== 1,
                handSize: 3, tryalCardCount: i === 1 ? 0 : 5,
                tryalCards: i === 0 ? life : life.map(() => ({ name: null })),
                revealedTryalCards: i === 1 ? life : [], inPlayCards: []
            }]));
            const hand = ['Accusation', 'Evidence', 'Stocks', 'Accusation', 'Alibi', 'Scapegoat', 'Matchmaker'].map(name => ({ name, color: ['Accusation', 'Evidence'].includes(name) ? 'Red' : name === 'Matchmaker' ? 'Blue' : 'Green' }));
            const files = { Witch: 'witch', Constable: 'constable', 'Not A Witch': 'notawitch', Accusation: 'accusation', Evidence: 'evidence', Stocks: 'stocks', Alibi: 'alibi', Scapegoat: 'scapegoat', Matchmaker: 'matchmaker' };
            const engine = window.VillageTable3D.create({ container: document.getElementById('table'), quality: 'high' });
            engine.setActive(true);
            engine.update({ state: { currentPhase: 'DAY', gameStarted: true, players, deckCount: 32, discardPileCount: 5 }, me: 'p0', hand, imageFor: name => '/cards/' + files[name] + '.png' });
            window.previewEngine = engine;
        });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(output, 'table3d-default-current.png') });
        await page.evaluate(() => window.previewEngine.stepSeat(-1));
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(output, 'table3d-other-seat-current.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => window.previewEngine.resetCamera());
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(output, 'table3d-mobile-current.png') });
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
