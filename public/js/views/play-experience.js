import { client } from '../core/client.js';

const nameOf = card => typeof card === 'string' ? card : card.name;
client.actions.cardOutcomePreview = function(card, target) {
    const points = { Accusation: 1, Evidence: 3, Witness: 7 }[card?.name];
    if (points) {
        if (target?.inPlayCards?.some(c => nameOf(c) === 'Piety')) return 'พลังศรัทธา · ป้องกันการ์ดแดง';
        const total = (target?.accusationPoints || 0) + points;
        return `${points} ข้อกล่าวหา → ${total}/7${total >= 7 ? ' · ต้องเลือกเปิดการ์ดชีวิต 1 ใบ' : ''}`;
    }
    return ({ Stocks: 'ข้ามเทิร์นถัดไป 1 ครั้ง', Arson: `ทิ้งการ์ดในมือทั้งหมด ${target?.handSize || 0} ใบ`,
        Piety: 'ป้องกันการ์ดกล่าวหาสีแดง', Asylum: 'ป้องกันการสังหารกลางคืน',
        Matchmaker: 'ผูกชะตากับผู้ถือผูกวิญญาณอีกคน', Curse: 'เลือกทำลายการ์ดสีน้ำเงิน 1 ใบ',
        Alibi: 'เลือกนำการ์ดข้อกล่าวหาออกได้สูงสุด 3 ใบ', Robbery: 'ย้ายการ์ดในมือทั้งหมดไปยังผู้รับ',
        Scapegoat: 'ย้ายการ์ดสถานะไปยังผู้รับ' })[card?.name] || client.actions.displayCardDescription(card?.name);
};

export function initialize() {
    client.state.compactCardFeedback = true;
    const overlay = document.createElement('div');
    overlay.id = 'card-inspect-overlay'; overlay.hidden = true;
    overlay.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="inspect-title"><button type="button" class="inspect-close" aria-label="ปิด">✕</button><div class="inspect-image"></div><h3 id="inspect-title"></h3><p class="inspect-description"></p><small>ดูรายละเอียดเท่านั้น · ปิดหน้าต่างเพื่อกลับไปเล่น</small></section>';
    document.body.appendChild(overlay);
    let previousFocus;
    function closeInspect() { overlay.hidden = true; previousFocus?.focus?.(); }
    overlay.querySelector('button').onclick = closeInspect;
    overlay.onclick = e => { if (e.target === overlay) closeInspect(); };
    overlay.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.stopPropagation(); closeInspect(); }
        if (e.key === 'Tab') { e.preventDefault(); overlay.querySelector('button').focus(); }
    });
    client.actions.inspectGameCard = name => {
        if (!name) return;
        previousFocus = document.activeElement;
        overlay.querySelector('.inspect-image').replaceChildren(client.actions.createCardImage(name));
        overlay.querySelector('h3').textContent = client.actions.displayCardName(name);
        overlay.querySelector('.inspect-description').textContent = client.actions.displayCardDescription(name);
        overlay.hidden = false; overlay.querySelector('button').focus();
    };
    function cardAt(element) {
        const card = element?.closest?.('#player-hand > .card');
        if (card) return client.state.myCurrentHand?.[Number(card.dataset.index)]?.name;
        return element?.closest?.('img[data-card-name]')?.dataset.cardName;
    }
    document.addEventListener('contextmenu', e => {
        const name = cardAt(e.target);
        if (name) { e.preventDefault(); client.actions.inspectGameCard(name); }
    });
    document.addEventListener('keydown', e => {
        if (e.key.toLowerCase() === 'i' && cardAt(e.target)) { e.preventDefault(); client.actions.inspectGameCard(cardAt(e.target)); }
    });
    let hold, origin, suppressClick = false;
    document.addEventListener('pointerdown', e => {
        clearTimeout(hold); suppressClick = false;
        const name = cardAt(e.target);
        if (!name || e.button !== 0) return;
        origin = { x: e.clientX, y: e.clientY };
        hold = setTimeout(() => { suppressClick = true; client.actions.inspectGameCard(name); }, 550);
    });
    document.addEventListener('pointermove', e => { if (origin && Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>8) clearTimeout(hold); });
    for (const event of ['pointerup','pointercancel','dragstart']) document.addEventListener(event, () => clearTimeout(hold));
    document.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);

    const status = document.createElement('aside'); status.id = 'player-status-peek'; status.hidden = true;
    status.innerHTML = '<button type="button" aria-label="ปิดสถานะ">✕</button><strong></strong><p></p><ul></ul>';
    document.body.appendChild(status);
    let focused = null;
    status.querySelector('button').onclick = () => { focused = null; status.hidden = true; };
    function renderStatus() {
        const player = client.state.currentRoomState?.players?.[focused];
        if (!player) { status.hidden = true; return; }
        status.querySelector('strong').textContent = player.name;
        status.querySelector('p').textContent = `${player.alive ? 'ยังมีชีวิต' : 'เสียชีวิตแล้ว'} · ข้อกล่าวหา ${player.accusationPoints || 0}/7 · ชีวิต ${player.tryalCardCount} ใบ · ไพ่ในมือ ${player.handSize} ใบ`;
        const list = status.querySelector('ul'); list.replaceChildren();
        const effects = player.inPlayCards || [];
        for (const effect of effects) {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = client.actions.displayCardName(nameOf(effect));
            button.onclick = () => client.actions.inspectGameCard(nameOf(effect));
            item.appendChild(button); list.appendChild(item);
        }
        if (!effects.length) { const item = document.createElement('li'); item.textContent = 'ไม่มีการ์ดสถานะ'; list.appendChild(item); }
        status.hidden = false;
    }
    client.actions.hidePlayerStatus = () => { focused = null; status.hidden = true; };
    client.actions.showPlayerStatus = id => { focused = id; renderStatus(); };
    document.addEventListener('click', e => {
        const card = e.target.closest?.('.player-board-card[data-player-id]');
        if (card) client.actions.showPlayerStatus(card.dataset.playerId);
    });

    const feedback = document.createElement('div'); feedback.id = 'play-result-toast'; feedback.hidden = true; feedback.setAttribute('role', 'status');
    document.body.appendChild(feedback); let feedbackTimer;
    function showFeedback(text) {
        feedback.textContent = text; feedback.hidden = false;
        feedback.classList.remove('result-enter'); void feedback.offsetWidth; feedback.classList.add('result-enter');
        clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => { feedback.hidden = true; }, 3600);
    }
    // Sound is synthesized locally; no downloads, and no autoplay before a gesture.
    const audioControls = document.createElement('div'); audioControls.id = 'game-sound-settings';
    audioControls.innerHTML = '<strong>เสียงเกม</strong><label>เอฟเฟกต์ <input type="range" min="0" max="100" step="5"></label><label><input type="checkbox"> เสียงบรรยากาศกลางคืน</label>';
    document.getElementById('game-preferences-content').appendChild(audioControls);
    const preferences = document.getElementById('game-preferences');
    document.addEventListener('click', event => { if (preferences.open && !preferences.contains(event.target)) preferences.open = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') preferences.open = false; });
    const volume = audioControls.querySelector('input[type=range]'); const ambience = audioControls.querySelector('input[type=checkbox]');
    let saved = .35;
    try { const value = localStorage.getItem('villageSfxVolume'); if (value !== null && Number.isFinite(Number(value))) saved = Math.max(0,Math.min(1,Number(value))); ambience.checked = localStorage.getItem('villageAmbience') === 'true'; } catch (_) {}
    volume.value = saved * 100;
    let audio, wind, windGain;
    function sound(kind) {
        if (!audio || audio.state !== 'running' || !saved || document.hidden) return;
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = kind === 'turn' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(kind === 'turn' ? 620 : kind === 'flip' ? 330 : 160, audio.currentTime);
        osc.frequency.exponentialRampToValueAtTime(kind === 'turn' ? 830 : 85, audio.currentTime+.12);
        gain.gain.setValueAtTime(saved*.12,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);
        osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime+.2);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    function updateWind() {
        if (!audio) return;
        const night = client.state.currentRoomState?.currentPhase === 'NIGHT';
        const active = ambience.checked && night && !document.hidden && !client.state.currentRoomState?.gameOver;
        windGain?.gain.setTargetAtTime(active ? saved*.035 : 0, audio.currentTime, .5);
    }
    document.addEventListener('pointerdown', () => {
        if (!audio) {
            const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
            audio = new Audio();
            const buffer = audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate), data = buffer.getChannelData(0);
            let low = 0; for(let i=0;i<data.length;i++) { low = .98*low+.02*(Math.random()*2-1); data[i]=low*3; }
            wind = audio.createBufferSource(); wind.buffer = buffer; wind.loop = true;
            windGain = audio.createGain(); windGain.gain.value = 0; wind.connect(windGain); windGain.connect(audio.destination); wind.start();
        }
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        updateWind();
    });
    volume.oninput = () => { saved = Number(volume.value)/100; try { localStorage.setItem('villageSfxVolume',String(saved)); } catch (_) {} updateWind(); };
    ambience.onchange = () => { try { localStorage.setItem('villageAmbience',String(ambience.checked)); } catch (_) {} updateWind(); };
    document.addEventListener('visibilitychange', updateWind);
    let previousPhase, previousTurn;
    client.state.socket.on('room state update', state => {
        renderStatus(); updateWind();
        if (previousPhase && state.currentPhase !== previousPhase) sound('flip');
        if (previousTurn && state.currentTurnPlayerUniqueId !== previousTurn && state.currentTurnPlayerUniqueId === client.state.myUniqueId) sound('turn');
        previousPhase = state.currentPhase; previousTurn = state.currentTurnPlayerUniqueId;
    });
    client.state.socket.on('card action feedback', event => {
        const route = event.targetName ? `${event.actorName} → ${event.targetName}${event.secondTargetName ? ' → '+event.secondTargetName : ''}` : event.actorName;
        showFeedback(`${route} · ${client.actions.displayCardName(event.cardName)} · ${event.result}`); sound('place');
        if (document.body.classList.contains('game-view-3d')) client.state.table3D?.animateCard?.(event);
        else if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const actor = document.querySelector(`.player-board-card[data-player-id="${CSS.escape(event.actorId || '')}"]`);
            const recipient = document.querySelector(`.player-board-card[data-player-id="${CSS.escape(event.targetId || '')}"]`);
            if (actor?.getClientRects().length && recipient?.getClientRects().length) {
                const from = actor.getBoundingClientRect(), to = recipient.getBoundingClientRect();
                const image = client.actions.createCardImage(event.cardName);
                image.classList.add('flying-play-card'); document.body.appendChild(image);
                const animation = image.animate([
                    { transform: `translate(${from.x+from.width/2}px,${from.y+from.height/2}px) rotate(-10deg)`, opacity: .9 },
                    { transform: `translate(${to.x+to.width/2}px,${to.y+to.height/2}px) rotate(8deg)`, opacity: 0 }
                ], { duration:650, easing:'ease-in-out' });
                animation.onfinish = animation.oncancel = () => image.remove();
            }
        }
        const target = document.querySelector(`.player-board-card[data-player-id="${CSS.escape(event.targetId || '')}"]`);
        if (target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) target.animate([{outline:'2px solid #c2ab87'},{outline:'2px solid transparent'}],{duration:1000});
    });
    client.state.socket.on('update hand', () => sound('flip'));
    client.state.socket.on('card play rejected', ({message}) => { showFeedback(message); sound('flip'); });
    client.state.socket.on('room left', () => { focused=null; status.hidden=true; closeInspect(); feedback.hidden=true; clearTimeout(feedbackTimer); previousPhase=previousTurn=null; if (audio && windGain) windGain.gain.setTargetAtTime(0,audio.currentTime,.2); });
    window.addEventListener('pagehide', () => { audio?.suspend().catch(() => {}); });
}
