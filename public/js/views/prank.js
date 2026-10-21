import { client } from '../core/client.js';

export function initialize() {
    const bar = document.createElement('div'); bar.id = 'prank-controls'; bar.hidden = true;
    const admin = document.createElement('section'); admin.id = 'host-prank-settings'; admin.hidden = true;
    const label = document.createElement('strong'); label.textContent = '🔫 ลูกซองเทพทรู · 1 นัด';
    const targetLabel = document.createElement('label'); targetLabel.textContent = 'เลือกผู้เล่น'; targetLabel.htmlFor = 'host-prank-target';
    const select = document.createElement('select'); select.id = 'host-prank-target';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    const grant = document.createElement('button'); grant.textContent = 'มอบปืน';
    const revoke = document.createElement('button'); revoke.textContent = 'ถอนปืน';
    grant.type = revoke.type = 'button';
    let adminPlayers = [], adminBusy = false;
    function updateAdminButtons() {
        const target = adminPlayers.find(player => player.id === select.value);
        select.disabled = adminBusy || !adminPlayers.length;
        grant.disabled = admin.hidden || adminBusy || !target || target.armed;
        revoke.disabled = admin.hidden || adminBusy || !target?.armed;
        status.textContent = adminBusy ? 'รอการยิงจบก่อนจัดการปืน' : target ? `${target.name} · ${target.armed ? 'มีปืนอยู่แล้ว' : 'ยังไม่มีปืน'}` : 'ไม่มีผู้เล่นที่มอบปืนได้';
    }
    select.onchange = updateAdminButtons;
    grant.onclick = () => { if (!grant.disabled) client.state.socket.emit('prank gun grant', select.value, true); };
    revoke.onclick = () => { if (!revoke.disabled) client.state.socket.emit('prank gun grant', select.value, false); };
    const buttons = document.createElement('div'); buttons.className = 'host-prank-buttons'; buttons.append(grant, revoke);
    admin.append(label, targetLabel, select, status, buttons);
    document.getElementById('game-preferences-content').appendChild(admin);
    const gun = document.createElement('button'); gun.textContent = '🔫 ใช้ลูกซอง (1 นัด)';
    bar.append(gun); document.body.appendChild(bar);
    const cue = document.createElement('div'); cue.id = 'prank-shot-cue'; cue.hidden = true; cue.setAttribute('role', 'status'); document.body.appendChild(cue);
    let selecting = false, selected = null, cueTimer;
    const originalInteraction = client.actions.getTable3DInteraction;
    const originalPlayer = client.actions.handleTable3DPlayer;
    function clearSelection() { selecting = false; selected = null; gun.textContent = '🔫 ใช้ลูกซอง (1 นัด)'; }
    function shoot(id) {
        client.state.socket.emit('prank gun shoot', id);
        clearSelection(); client.actions.syncTable3D();
    }
    client.actions.getTable3DInteraction = () => selecting ? {
        kind: 'player', eligible: Object.values(client.state.currentRoomState?.players || {}).filter(p => p.alive && p.uniqueId !== client.state.myUniqueId).map(p => p.uniqueId),
        selected: selected ? [selected] : [], blocked: {}, outcomes: {}
    } : originalInteraction();
    client.actions.handleTable3DPlayer = id => {
        if (!selecting) return originalPlayer(id);
        if (!client.actions.getTable3DInteraction().eligible.includes(id)) return;
        if (selected === id) shoot(id);
        else { selected = id; client.actions.syncTable3D(); }
    };
    gun.onclick = () => {
        if (selecting) { clearSelection(); client.actions.syncTable3D(); return; }
        if (originalInteraction() || client.state.currentRoomState?.currentPhase !== 'DAY') {
            client.actions.addGameMessage('ใช้ปืนได้ช่วงกลางวัน เมื่อไม่มีแอ็กชันการ์ดค้างอยู่', 'orange'); return;
        }
        if (document.body.classList.contains('game-view-3d')) {
            selecting = true; gun.textContent = 'ยกเลิกยิง · แตะเป้าหมาย 2 ครั้ง'; client.actions.syncTable3D();
        } else {
            const targets = Object.values(client.state.currentRoomState.players).filter(p => p.alive && p.uniqueId !== client.state.myUniqueId);
            client.actions.showSelectPlayerPopup('🔫 เลือกเป้าหมายยิง · ใช้ได้ 1 นัด', targets, shoot);
        }
    };
    client.state.socket.on('room state update', state => {
        const available = state.gameStarted && !state.gameOver && !state.isSpectator;
        const isHost = state.hostUniqueId === client.state.myUniqueId && state.players?.[client.state.myUniqueId]?.isHost;
        admin.hidden = !available || !isHost || !Array.isArray(state.prankGunAdmin);
        adminPlayers = admin.hidden ? [] : state.prankGunAdmin;
        adminBusy = !!state.prankShotActive;
        gun.hidden = !available || !state.prankGun;
        gun.disabled = !state.players?.[client.state.myUniqueId]?.alive || state.prankShotActive || state.currentPhase !== 'DAY';
        bar.hidden = gun.hidden;
        if (gun.hidden || gun.disabled) clearSelection();
        const current = select.value;
        const signature = JSON.stringify(adminPlayers);
        if (select.dataset.signature !== signature) {
            select.dataset.signature = signature;
            select.replaceChildren(...adminPlayers.map(p => { const option = document.createElement('option'); option.value = p.id; option.textContent = `${p.name}${p.armed ? ' · มีปืน' : ''}`; return option; }));
            if ([...select.options].some(o => o.value === current)) select.value = current;
        }
        updateAdminButtons();
    });
    client.state.socket.on('prank gun shot', event => {
        clearSelection(); clearTimeout(cueTimer);
        cue.textContent = `🔫 ${event.actorName} → ${event.targetName} 💥`; cue.hidden = false;
        cue.style.setProperty('--shot-duration', `${event.duration}ms`);
        if (document.body.classList.contains('game-view-3d')) client.state.table3D?.animateShot?.(event);
        cueTimer = setTimeout(() => { cue.hidden = true; }, event.duration + 500);
    });
    client.state.socket.on('room left', () => { clearSelection(); bar.hidden = true; admin.hidden = true; adminPlayers = []; select.replaceChildren(); delete select.dataset.signature; updateAdminButtons(); cue.hidden = true; clearTimeout(cueTimer); });
}
