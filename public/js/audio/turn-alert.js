import { client } from '../core/client.js';

// Separate from music and table effects: hiding the page must not mute this cue.
// A browser/OS can still suspend a background page; no silent loop is used.
export function initializeTurnAlert(parent) {
    let enabled = true;
    try { enabled = localStorage.getItem('villageTurnSoundEnabled') !== 'false'; } catch (_) {}
    const row = document.createElement('div'); row.className = 'turn-sound-setting';
    const label = document.createElement('label');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox';checkbox.checked = enabled;
    label.append(checkbox, 'เสียงเตือนเมื่อถึงตาหรือต้องทำแอ็กชัน');
    const preview = document.createElement('button');preview.type = 'button';preview.textContent = 'ลองเสียง';preview.disabled = !enabled;
    const hint = document.createElement('small');
    hint.textContent = 'เตือนเมื่อสลับแท็บด้วย · มือถืออาจไม่ได้ยินหากระบบพักเบราว์เซอร์';
    row.append(label, preview, hint);parent.append(row);

    let context, latest, wasMyTurn = false, wanted = false, resuming = false, revision = 0, stopChime;
    const isMyTurn = state => !!state?.gameStarted && !state.gameOver && !state.isSpectator &&
        !client.state.isSpectatorMode && !!state.players?.[client.state.myUniqueId]?.alive &&
        state.currentPhase === 'DAY' && state.currentTurnPlayerUniqueId === client.state.myUniqueId;

    let pendingPrompt = null;
    const needsAction = () => isMyTurn(latest) || !!(pendingPrompt && latest?.gameStarted && !latest.gameOver &&
        latest.currentPhase === pendingPrompt.phase && latest.players?.[client.state.myUniqueId]?.alive);
    const promptEvents = {
        'prompt select accused tryal':['select tryal card for confession'],
        'prompt select blackcat tryal':['select blackcat tryal'],
        'prompt select left tryal':['select left tryal'],
        'prompt select curse target':['select curse target','cancel curse selection'],
        'prompt select alibi removal':['select alibi removal','cancel alibi selection'],
        'popup assign black cat':['assign black cat'],
        'prompt witch kill':['witch mark target','witch kill target'],
        'prompt constable action':['constable action']
    };
    for (const [event, replies] of Object.entries(promptEvents)) client.state.socket.on(event, data => {
        const key = event + JSON.stringify(data || null);
        if (pendingPrompt?.key === key || latest?.isSpectator || !latest?.players?.[client.state.myUniqueId]?.alive) return;
        pendingPrompt = {key, replies, phase:latest.currentPhase};
        wanted = true;revision++;flush();
    });
    client.state.socket.onAnyOutgoing?.(event => {
        if (pendingPrompt?.replies.includes(event)) { pendingPrompt=null;wanted=false;revision++; }
    });
    function playChime() {
        stopChime?.();
        const nodes = [], sources = [], start = context.currentTime + .01;
        let cleaned = false;
        function cleanup() {
            if (cleaned) return;cleaned = true;
            nodes.forEach(node => node.disconnect());stopChime = null;
        }
        // Two clear, rising bell notes, distinct from cards and ambient music.
        for (const [offset, frequency] of [[0, 659.25], [.22, 880]]) {
            const gain = context.createGain(), oscillator = context.createOscillator();
            oscillator.type = 'sine';oscillator.frequency.value = frequency;
            gain.gain.setValueAtTime(.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(.22, start + offset + .012);
            gain.gain.exponentialRampToValueAtTime(.0001, start + offset + .62);
            oscillator.connect(gain);gain.connect(context.destination);
            oscillator.start(start + offset);oscillator.stop(start + offset + .65);
            nodes.push(oscillator, gain);sources.push(oscillator);
        }
        sources.at(-1).onended = cleanup;
        stopChime = () => { sources.forEach(source => { try { source.stop(); } catch (_) {} });cleanup(); };
    }
    async function flush() {
        if (!enabled || !context || !wanted || resuming || !needsAction()) return;
        const request = revision;resuming = true;
        try {
            if (context.state !== 'running') await context.resume();
            if (context.state === 'running' && enabled && wanted && request === revision && needsAction()) {
                wanted = false;playChime();
            }
        } catch (_) { /* Retain a current-turn cue for the next real interaction. */ }
        finally {
            resuming = false;
            if (wanted && request !== revision) flush();
        }
    }
    function unlock() {
        if (!enabled) return;
        if (!context) {
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) return;
            try {
                context = new Audio();
                // Prime once during the gesture, without continuous background audio.
                const source = context.createBufferSource();
                source.buffer = context.createBuffer(1, 1, context.sampleRate);
                source.connect(context.destination);source.onended = () => source.disconnect();source.start();
            } catch (_) { return; }
        }
        if (context.state !== 'running') context.resume().then(flush).catch(() => {});
        else flush();
    }
    function reset() {
        pendingPrompt = null;latest = null;wasMyTurn = false;wanted = false;revision++;stopChime?.();
    }
    document.addEventListener('pointerdown', unlock, { capture:true, passive:true });
    document.addEventListener('keydown', event => { if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) unlock(); });
    checkbox.onchange = () => {
        enabled = checkbox.checked;preview.disabled = !enabled;
        try { localStorage.setItem('villageTurnSoundEnabled', String(enabled)); } catch (_) {}
        if (enabled) unlock();
        else { wanted = false;revision++;stopChime?.();context?.suspend().catch(() => {}); }
    };
    preview.onclick = async () => {
        if (!enabled) return;
        wanted = false;revision++;unlock();
        try { await context?.resume();if (enabled && context?.state === 'running') playChime(); } catch (_) {}
    };
    client.state.socket.on('room state update', state => {
        latest = state;
        if (pendingPrompt && (pendingPrompt.phase !== state.currentPhase || state.gameOver)) pendingPrompt=null;
        const me = state.players?.[client.state.myUniqueId];
        const confession = state.currentPhase === 'PRE_DAWN' && me?.alive && !state.isSpectator && !state.confessionExempt &&
            state.confessionOrder?.includes(client.state.myUniqueId) && !state.confessionActions?.includes(client.state.myUniqueId);
        const setup = state.currentPhase === 'SETUP' && me?.alive && state.lifeSetup?.stage === 'arrange' &&
            !state.lifeSetup.confirmed.includes(client.state.myUniqueId);
        const myTurn = isMyTurn(state) || confession || setup;
        if (confession) pendingPrompt ||= {key:'confession',phase:state.currentPhase,replies:['confess tryal card','confess during night','skip confession']};
        if (setup) pendingPrompt ||= {key:'setup',phase:state.currentPhase,replies:['confirm life setup']};
        if (myTurn && !wasMyTurn && enabled) { wanted = true;revision++;flush(); }
        else if (!myTurn && !pendingPrompt) { wanted = false;revision++;stopChime?.(); }
        wasMyTurn = myTurn;
    });
    for (const event of ['room left', 'game restarted', 'disconnect']) client.state.socket.on(event, reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
}
