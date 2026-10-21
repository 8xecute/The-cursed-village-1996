import { client } from '../core/client.js';

const nameOf = card => typeof card === 'string' ? card : card.name;
client.actions.cardOutcomePreview = function(card, target) {
    const points = card?.batchPoints || { Accusation: 1, Evidence: 3, Witness: 7 }[card?.name];
    if (points) {
        if (target?.inPlayCards?.some(c => nameOf(c) === 'Piety')) return 'พลังศรัทธา · ป้องกันการ์ดแดง';
        const total = (target?.accusationPoints || 0) + points;
        return `${points} ข้อกล่าวหา → ${total}/7${total >= 7 ? ' · ต้องเลือกเปิดการ์ดชีวิต 1 ใบ' : ''}`;
    }
    return ({ Stocks: 'ข้ามเทิร์นถัดไป 1 ครั้ง', Arson: `ทิ้งการ์ดในมือทั้งหมด ${target?.handSize || 0} ใบ`,
        Piety: 'ป้องกันการ์ดกล่าวหาสีแดง', Asylum: 'ป้องกันการสังหารกลางคืน',
        Matchmaker: 'ผูกชะตากับผู้ถือผูกวิญญาณอีกคน', Curse: 'เลือกทำลายการ์ดสีน้ำเงิน 1 ใบ',
        Alibi: 'ลบการ์ดแดงชนิดเดียว รวมไม่เกิน 3 แต้ม', Robbery: 'ย้ายการ์ดในมือทั้งหมดไปยังผู้รับ',
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
    const feedbackQueue = [];
    function nextFeedback() {
        clearTimeout(feedbackTimer);
        const text = feedbackQueue.shift();
        if (!text) { feedback.hidden = true; return; }
        feedback.textContent = text; feedback.hidden = false;
        feedback.classList.remove('result-enter'); void feedback.offsetWidth; feedback.classList.add('result-enter');
        feedbackTimer = setTimeout(nextFeedback, 4800);
    }
    function showFeedback(text) {
        // Several red cards can resolve together; keep each result readable.
        feedbackQueue.push(text);
        if (feedbackQueue.length > 6) feedbackQueue.shift();
        if (feedback.hidden) nextFeedback();
    }
    // Sound is synthesized locally; no downloads, and no autoplay before a gesture.
    const audioControls = document.createElement('div'); audioControls.id = 'game-sound-settings';
    audioControls.innerHTML = '<strong>เสียงเกม</strong><label>เอฟเฟกต์ <input type="range" min="0" max="100" step="5"></label>';
    document.getElementById('game-preferences-content').appendChild(audioControls);
    const preferences = document.getElementById('game-preferences');
    document.addEventListener('click', event => { if (preferences.open && !preferences.contains(event.target)) preferences.open = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') preferences.open = false; });
    const volume = audioControls.querySelector('input[type=range]');
    let saved = .35;
    try { const value = localStorage.getItem('villageSfxVolume'); if (value !== null && Number.isFinite(Number(value))) saved = Math.max(0,Math.min(1,Number(value))); } catch (_) {}
    volume.value = saved * 100;
    let audio;
    const shotSounds = new Set();
    function sound(kind, delay = 0) {
        if (!audio || audio.state !== 'running' || !saved || document.hidden) return;
        if (kind === 'ghost') {
            const when = audio.currentTime, mix = audio.createGain(); mix.connect(audio.destination);
            mix.gain.setValueAtTime(.001, when); mix.gain.exponentialRampToValueAtTime(saved * .22, when + .035);
            mix.gain.exponentialRampToValueAtTime(.001, when + .72);
            const voice = audio.createOscillator(), filter = audio.createBiquadFilter();
            voice.type = 'sawtooth'; voice.frequency.setValueAtTime(210, when); voice.frequency.exponentialRampToValueAtTime(54, when + .6);
            filter.type = 'lowpass'; filter.frequency.setValueAtTime(1800, when); filter.frequency.exponentialRampToValueAtTime(180, when + .65);
            voice.connect(filter); filter.connect(mix);
            const noise = audio.createBufferSource(), rasp = audio.createBiquadFilter();
            const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .75), audio.sampleRate), samples = buffer.getChannelData(0);
            for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * .3;
            noise.buffer = buffer; rasp.type = 'bandpass'; rasp.frequency.value = 1000; rasp.Q.value = .7;
            noise.connect(rasp); rasp.connect(mix);
            voice.start(); noise.start(); voice.stop(when + .75);
            let ended = false;
            const cleanup = () => { if (ended) return; ended = true; [voice, filter, noise, rasp, mix].forEach(node => node.disconnect()); };
            voice.onended = cleanup;
            return () => { try { voice.stop(); noise.stop(); } catch (_) {} cleanup(); };
        }
        if (kind === 'death') {
            // A brief voiced groan with vocal formants and a breathy release.
            const when = audio.currentTime + Math.max(0, delay), duration = .9;
            const voice = audio.createOscillator(), envelope = audio.createGain();
            voice.type = 'sawtooth'; voice.frequency.setValueAtTime(154, when);
            voice.frequency.exponentialRampToValueAtTime(63, when + .72);
            envelope.gain.setValueAtTime(.001, when);
            envelope.gain.exponentialRampToValueAtTime(saved * .22, when + .06);
            envelope.gain.exponentialRampToValueAtTime(.001, when + .85); envelope.connect(audio.destination);
            const nodes = [voice, envelope];
            for (const [frequency, level] of [[620,.7],[1180,.3],[2450,.12]]) {
                const formant = audio.createBiquadFilter(), gain = audio.createGain();
                formant.type = 'bandpass'; formant.Q.value = 5; formant.frequency.setValueAtTime(frequency,when);
                formant.frequency.exponentialRampToValueAtTime(frequency * .72,when + .75);
                gain.gain.value = level; voice.connect(formant); formant.connect(gain); gain.connect(envelope); nodes.push(formant,gain);
            }
            const breath = audio.createBufferSource(), air = audio.createBiquadFilter(), airGain = audio.createGain();
            const buffer = audio.createBuffer(1,Math.ceil(audio.sampleRate * duration),audio.sampleRate);
            const samples = buffer.getChannelData(0); for(let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*.1;
            breath.buffer=buffer; air.type='lowpass'; air.frequency.value=1600; airGain.gain.value=.25;
            breath.connect(air); air.connect(airGain); airGain.connect(envelope); nodes.push(breath,air,airGain);
            let ended=false;
            const cleanup=()=>{if(ended)return;ended=true;nodes.forEach(node=>node.disconnect());shotSounds.delete(stop);};
            const stop=()=>{try{voice.stop();breath.stop();}catch(_){}cleanup();};
            shotSounds.add(stop); voice.onended=cleanup; voice.start(when); voice.stop(when+duration); breath.start(when);
            return;
        }
        if (kind === 'gun') {
            const when = audio.currentTime + Math.max(0, delay);
            const mix = audio.createGain(); mix.gain.value = saved * .42; mix.connect(audio.destination);
            const nodes = [], sources = [];
            // Shotgun blast: a broad report, heavier low end and wooden-room reflections.
            const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .65), audio.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * .11));
            for (const [offset, level] of [[0, 1], [.09, .28], [.19, .13]]) {
                const noise = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
                noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = offset ? 1300 : 4200; gain.gain.value = level;
                noise.connect(filter); filter.connect(gain); gain.connect(mix); noise.start(when + offset);
                sources.push(noise); nodes.push(noise, filter, gain);
            }
            const bass = audio.createOscillator(), envelope = audio.createGain(); bass.type = 'sine';
            bass.frequency.setValueAtTime(96, when); bass.frequency.exponentialRampToValueAtTime(29, when + .27);
            envelope.gain.setValueAtTime(.85, when); envelope.gain.exponentialRampToValueAtTime(.001, when + .35);
            bass.connect(envelope); envelope.connect(mix); bass.start(when); bass.stop(when + .9);
            sources.push(bass); nodes.push(bass, envelope, mix);
            const cleanup = () => { nodes.forEach(node => node.disconnect()); shotSounds.delete(stop); };
            const stop = () => { sources.forEach(source => { try { source.stop(); } catch (_) {} }); cleanup(); };
            shotSounds.add(stop); bass.onended = cleanup;
            return;
        }
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = kind === 'turn' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(kind === 'turn' ? 620 : kind === 'flip' ? 330 : 160, audio.currentTime);
        osc.frequency.exponentialRampToValueAtTime(kind === 'turn' ? 830 : 85, audio.currentTime+.12);
        gain.gain.setValueAtTime(saved*.12,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);
        osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime+.2);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    let stopGhostSound;
    client.actions.stopGhostScareSound = () => { stopGhostSound?.(); stopGhostSound = null; };
    client.actions.playGhostScareSound = () => { client.actions.stopGhostScareSound(); stopGhostSound = sound('ghost'); };
    document.addEventListener('pointerdown', () => {
        if (!audio) {
            const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return;
            audio = new Audio();

        }
        if (audio.state === 'suspended') audio.resume().catch(() => {});
    });
    volume.oninput = () => { saved = Number(volume.value)/100; try { localStorage.setItem('villageSfxVolume',String(saved)); } catch (_) {} };
    let previousPhase, previousTurn;
    const previousAlive = new Map();
    client.state.socket.on('room state update', state => {
        const deaths = Object.values(state.players || {}).filter(player => previousAlive.get(player.uniqueId) === true && !player.alive);
        deaths.slice(0, 2).forEach((_, i) => sound('death', i * .18));
        previousAlive.clear(); Object.values(state.players || {}).forEach(player => previousAlive.set(player.uniqueId, !!player.alive));
        renderStatus();
        if (previousPhase && state.currentPhase !== previousPhase) sound('flip');
        if (previousTurn && state.currentTurnPlayerUniqueId !== previousTurn && state.currentTurnPlayerUniqueId === client.state.myUniqueId) sound('turn');
        previousPhase = state.currentPhase; previousTurn = state.currentTurnPlayerUniqueId;
    });
    client.state.socket.on('card action feedback', event => {
        const route = event.targetName ? `${event.actorName} → ${event.targetName}${event.secondTargetName ? ' → '+event.secondTargetName : ''}` : event.actorName;
        if (!event.batchIndex) {
            const title = event.batchCount > 1 ? `การ์ดแดง ${event.batchCount} ใบ (+${event.batchPoints} แต้ม)` : client.actions.displayCardName(event.cardName);
            showFeedback(`${route} · ${title} · ${event.result}`); sound('place');
        }
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
    client.state.socket.on('table card movement', event => {
        if (document.body.classList.contains('game-view-3d')) client.state.table3D?.animateMovement?.(event);
        if (event.kind === 'conspiracy') { showFeedback('พิธีเซ่นไหว้ · ทุกคนส่งการ์ดชีวิตพร้อมกัน'); sound('flip'); }
    });
    client.state.socket.on('table phase cue', ({cardName}) => {
        showFeedback(cardName === 'Night' ? 'ยามวิกาล · เตรียมเข้าสู่กลางคืน' : 'พิธีเซ่นไหว้ · เตรียมเปิดการ์ดเครื่องเซ่นและส่งการ์ดชีวิต');
        document.body.classList.remove('table-phase-cue-night','table-phase-cue-conspiracy');
        const cueClass = cardName === 'Night' ? 'table-phase-cue-night' : 'table-phase-cue-conspiracy';
        document.body.classList.add(cueClass);
        setTimeout(() => document.body.classList.remove(cueClass),2400);
        sound('flip');
    });
    client.state.socket.on('update hand', () => sound('flip'));
    client.state.socket.on('prank gun shot', event => {
        sound('place');
        sound('gun', (event.raiseDuration || 900) / 1000);
    });
    client.state.socket.on('card play rejected', ({message}) => { showFeedback(message); sound('flip'); });
    client.state.socket.on('game restarted', () => { previousAlive.clear(); feedback.hidden=true; feedback.textContent=''; feedbackQueue.length=0; clearTimeout(feedbackTimer); });
    client.state.socket.on('room left', () => { previousAlive.clear(); shotSounds.forEach(stop => stop()); focused=null; status.hidden=true; closeInspect(); feedback.hidden=true; feedback.textContent=''; feedbackQueue.length=0; clearTimeout(feedbackTimer); previousPhase=previousTurn=null; });
    window.addEventListener('pagehide', () => { audio?.suspend().catch(() => {}); });
}
