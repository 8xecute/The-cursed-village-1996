import { client } from '../core/client.js';

function allowed() {
    const state = client.state.currentRoomState, me = state?.players?.[client.state.myUniqueId];
    const interaction = client.actions.getTable3DInteraction?.();
    return !!client.state.socket.connected && !!me?.alive && !state.isSpectator && !state.gameOver &&
        state.currentPhase === 'DAY' && !state.playerForcedToRevealTryal && !state.awaitingLeftTryalSelections &&
        (!interaction || interaction.preview) && (client.state.myCurrentHand?.length || 0) > 1;
}
export function initialize() {
    const row = document.querySelector('#table3d-section .table3d-hand-controls');
    const button = document.createElement('button'); button.type = 'button'; button.id = 'table3d-reorder-hand';
    const note = document.createElement('span'); note.id = 'table3d-reorder-hint'; note.setAttribute('role','status');
    let views = row.querySelector('.table3d-view-row');
    let actions = row.querySelector('.table3d-card-row');
    if (!views) { views = document.createElement('div'); views.className = 'table3d-control-row table3d-view-row'; row.appendChild(views); }
    if (!actions) { actions = document.createElement('div'); actions.className = 'table3d-control-row table3d-card-row'; row.appendChild(actions); }
    for (const id of ['table3d-seat-left','table3d-reset','table3d-card-sizes','table3d-seat-right']) {
        const control = document.getElementById(id); if (control) views.appendChild(control);
    }
    const handToggle = document.getElementById('table3d-hand-toggle');
    if (handToggle) actions.prepend(handToggle);
    const endTurn = document.querySelector('#table3d-section .table3d-end-turn');
    actions.appendChild(button);
    if (endTurn) actions.appendChild(endTurn);
    row.appendChild(note);
    let pending = false, previousHand = JSON.stringify(client.state.myCurrentHand || []);
    function refresh() {
        if (!allowed()) { client.state.table3DReorderMode = false; client.state.table3DReorderIndex = null; pending = false; }
        const active = !!client.state.table3DReorderMode;
        button.disabled = !allowed(); button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? 'จัดไพ่เสร็จ' : 'จัดไพ่';
        note.hidden = !active;
        note.textContent = pending ? 'กำลังสลับ…' : client.state.table3DReorderIndex == null ? 'แตะไพ่ใบแรก แล้วแตะอีกใบเพื่อสลับ' : 'เลือกอีกใบเพื่อสลับ · แตะใบเดิมเพื่อยกเลิก';
        client.actions.syncTable3D?.();
    }
    button.onclick = () => {
        if (!allowed()) return;
        client.state.table3DReorderMode = !client.state.table3DReorderMode;
        client.state.table3DReorderIndex = null;
        if (client.state.table3DReorderMode) client.actions.clearCardSelection();
        refresh();
    };
    client.actions.reorderTable3DCard = index => {
        if (!allowed() || pending || !client.state.table3DReorderMode || !Number.isInteger(index) || !client.state.myCurrentHand[index]) return;
        const from = client.state.table3DReorderIndex;
        if (from == null) client.state.table3DReorderIndex = index;
        else if (from === index) client.state.table3DReorderIndex = null;
        else {
            client.state.table3DReorderIndex = null;
            pending = true;
            client.state.socket.emit('swap hand cards', from, index);
        }
        refresh();
    };
    client.state.socket.on('room state update', refresh);
    client.state.socket.on('update hand', hand => {
        const signature = JSON.stringify(hand);
        if (signature !== previousHand || pending) {
            pending = false;
            client.state.table3DReorderIndex = null;
            previousHand = signature;
        }
        refresh();
    });
    client.state.socket.on('disconnect', refresh);
    client.state.socket.on('room left', () => { client.state.table3DReorderMode = false; client.state.table3DReorderIndex = null; pending = false; refresh(); });
    refresh();
}
