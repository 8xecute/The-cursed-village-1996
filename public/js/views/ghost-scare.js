import { client } from '../core/client.js';

export function initialize() {
    const controls = document.createElement('aside'); controls.id = 'ghost-scare-controls'; controls.hidden = true;
    const open = document.createElement('button'); open.type = 'button'; open.textContent = '👻 หลอกเพื่อน · 1 ครั้ง'; open.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div'); panel.id = 'ghost-scare-panel'; panel.hidden = true;
    open.setAttribute('aria-controls', panel.id);
    const title = document.createElement('strong'); title.textContent = 'เลือกคนที่ยังมีชีวิต';
    const hint = document.createElement('p'); hint.textContent = 'ใช้ได้ 1 ครั้งต่อเกม · คนที่เลือกจะเห็นผีแวบขึ้นมา';
    const targets = document.createElement('select'); targets.setAttribute('aria-label', 'ผู้เล่นที่จะหลอก');
    const send = document.createElement('button'); send.type = 'button'; send.textContent = '👻 หลอกคนนี้';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'ปิด';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    panel.append(title, hint, targets, send, cancel, status); controls.append(open, panel);
    const overlay = document.createElement('div'); overlay.id = 'ghost-scare-overlay'; overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true');
    const face = document.createElement('div'); face.className = 'ghost-scare-face';
    const image = document.createElement('img'); image.src = 'cards/witch.png'; image.alt = ''; image.draggable = false; face.appendChild(image);
    const caption = document.createElement('div'); caption.className = 'ghost-scare-caption';
    overlay.append(face, caption);
    let timer, pending = false, generation = 0, state;
    function mount() {
        const root = document.fullscreenElement || document.body;
        if (controls.parentElement !== root) root.appendChild(controls);
        if (overlay.parentElement !== root) root.appendChild(overlay);
    }
    function close() { panel.hidden = true; open.setAttribute('aria-expanded', 'false'); }
    function stop() { clearTimeout(timer); overlay.hidden = true; client.actions.stopGhostScareSound?.(); }
    function render() {
        controls.hidden = !state?.ghostScareAvailable || !!state.isSpectator || !!client.state.isSpectatorMode;
        open.disabled = pending;
        if (controls.hidden) close();
        const players = Object.values(state?.players || {}).filter(p => p.alive && p.connected !== false && !p.isBot && !p.isReplacementBot && !p.reconnectDeadline);
        const signature = JSON.stringify(players.map(p => [p.uniqueId, p.name]));
        if (targets.dataset.signature !== signature) {
            const previous = targets.value;
            targets.replaceChildren(...players.map(player => { const option = document.createElement('option'); option.value = player.uniqueId; option.textContent = player.name; return option; }));
            if (players.some(p => p.uniqueId === previous)) targets.value = previous;
            targets.dataset.signature = signature;
        }
        send.disabled = pending || !players.length;
        if (!players.length && !pending) status.textContent = 'ยังไม่มีผู้เล่นออนไลน์ที่หลอกได้';
    }
    open.onclick = () => { panel.hidden = !panel.hidden; open.setAttribute('aria-expanded', String(!panel.hidden)); status.textContent = ''; render(); };
    cancel.onclick = close;
    send.onclick = () => {
        if (pending || !targets.value || !state?.ghostScareAvailable) return;
        pending = true; const request = generation; status.textContent = 'กำลังส่งผี…'; render();
        client.state.socket.timeout(5000).emit('ghost scare', targets.value, (error, result) => {
            if (request !== generation) return;
            pending = false;
            if (error) status.textContent = 'ยังไม่ได้รับคำตอบ กรุณารอเชื่อมต่อแล้วลองใหม่';
            else if (!result?.ok) status.textContent = result?.message || 'ยังหลอกไม่ได้';
            else {
                state = { ...state, ghostScareAvailable: false }; close();
                client.actions.addGameMessage('👻 ส่งผีไปหลอกเพื่อนแล้ว · คุณใช้สิทธิ์ครบในเกมนี้แล้ว', 'purple');
            }
            render();
        });
    };
    client.state.socket.on('room state update', next => { state = next; mount(); render(); if (!next.gameStarted || next.gameOver || next.isSpectator || !next.players?.[client.state.myUniqueId]?.alive) stop(); });
    client.state.socket.on('ghost scare received', event => {
        const current = client.state.currentRoomState;
        if (!current?.gameStarted || current.gameOver || !current.players?.[client.state.myUniqueId]?.alive || document.hidden) return;
        stop(); mount(); caption.textContent = `${event.actorName} กลับมาหลอก!`;
        // Reinsert so a later scare restarts its single zoom/fade animation.
        overlay.remove(); (document.fullscreenElement || document.body).appendChild(overlay); overlay.hidden = false;
        client.actions.playGhostScareSound?.();
        timer = setTimeout(stop, Math.max(500, Math.min(1800, Number(event.duration) || 1400)));
    });
    client.state.socket.on('room left', () => { generation++; pending = false; state = null; close(); stop(); render(); });
    client.state.socket.on('disconnect', () => { generation++; pending = false; close(); stop(); controls.hidden = true; });
    document.addEventListener('fullscreenchange', mount);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('pagehide', stop);
    mount();
}
