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
    button.title = 'สลับตำแหน่งไพ่ในมือ โดยไม่ใช้การ์ด';
    const note = document.createElement('span'); note.id = 'table3d-reorder-hint'; note.setAttribute('role','status');
    let views = row.querySelector('.table3d-view-row');
    let actions = row.querySelector('.table3d-card-row');
    if (!views) { views = document.createElement('div'); views.className = 'table3d-control-row table3d-view-row'; row.appendChild(views); }
    if (!actions) { actions = document.createElement('div'); actions.className = 'table3d-control-row table3d-card-row'; row.appendChild(actions); }
    for (const id of ['table3d-seat-left','table3d-reset','table3d-seat-right']) {
        const control = document.getElementById(id); if (control) views.appendChild(control);
    }
    const handToggle = document.getElementById('table3d-hand-toggle');
    if (handToggle) actions.prepend(handToggle);
    const endTurn = document.querySelector('#table3d-section .table3d-end-turn');
    const tools = document.getElementById('table3d-hand-tools') || actions;
    tools.prepend(button);
    const cardSizes = document.getElementById('table3d-card-sizes');
    if (cardSizes) tools.appendChild(cardSizes);
    if (endTurn) actions.appendChild(endTurn);
    row.appendChild(note);
    const menus = [...row.querySelectorAll('.table3d-tool-menu')];
    menus.forEach(menu => {
        menu.addEventListener('toggle', () => {
            if (menu.open) menus.forEach(other => { if (other !== menu) other.open = false; });
        });
        menu.addEventListener('keydown', event => {
            if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); event.stopPropagation(); }
        });
    });
    document.addEventListener('click', event => menus.forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }));
    views.addEventListener('click', event => { if (event.target.closest('button')) document.getElementById('table3d-camera-menu').open = false; });
    let pending = false, previousHand = JSON.stringify(client.state.myCurrentHand || []);
    function refresh() {
        if (!allowed()) { client.state.table3DReorderMode = false; client.state.table3DReorderIndex = null; pending = false; }
        const active = !!client.state.table3DReorderMode;
        button.disabled = !allowed(); button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? 'จัดไพ่เสร็จ' : 'จัดไพ่';
        const summary = document.querySelector('#table3d-hand-menu > summary');
        if (summary) summary.textContent = active ? 'จัดไพ่อยู่' : 'จัดการไพ่';
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
        const menu = document.getElementById('table3d-hand-menu');
        if (menu) menu.open = false;
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
