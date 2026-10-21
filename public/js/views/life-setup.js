import { client } from '../core/client.js';

let panel, firstChoice = null, setupId = null, lastAnimated = null;
let previousRender = '', renderFrame = 0;
function scheduleRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(() => { renderFrame = 0; render(); });
}
function editable() {
    const state = client.state.currentRoomState;
    return state?.currentPhase === 'SETUP' && state.lifeSetup?.stage === 'arrange' &&
        state.players?.[client.state.myUniqueId]?.alive && !state.isSpectator &&
        !state.lifeSetup.confirmed.includes(client.state.myUniqueId);
}
client.actions.swapSetupLife = (from, to) => {
    if (!editable()) return;
    const setup = client.state.currentRoomState.lifeSetup;
    client.state.socket.emit('swap tryal cards', from, to, setup.id);
    firstChoice = null;
};
client.actions.getSetupInteraction = () => {
    if (!editable()) return null;
    return { kind: 'life', owner: client.state.myUniqueId,
        eligible: Array.from({ length: client.state.currentRoomState.players[client.state.myUniqueId].tryalCardCount }, (_, i) => i),
        selected: firstChoice === null ? [] : [firstChoice] };
};
client.actions.chooseSetupLife = (owner, index) => {
    if (!editable() || owner !== client.state.myUniqueId) return;
    if (!Number.isInteger(index) || index < 0 || index >= client.state.currentRoomState.players[owner].tryalCardCount) return;
    if (firstChoice === null) firstChoice = index;
    else if (firstChoice === index) firstChoice = null;
    else client.actions.swapSetupLife(firstChoice, index);
    scheduleRender();
    document.dispatchEvent(new Event('table3d selection'));
};
function render() {
    const state = client.state.currentRoomState, setup = state?.lifeSetup;
    if (state?.currentPhase !== 'SETUP' || !setup) { panel?.remove(); panel = null; firstChoice = null; setupId = null; previousRender = ''; return; }
    if (setupId !== setup.id) { setupId = setup.id; firstChoice = null; }
    if (!panel) { panel = document.createElement('section'); panel.id = 'life-setup-panel'; panel.setAttribute('aria-label', 'เตรียมการ์ดชีวิต'); }
    const mode3d = document.body.classList.contains('game-view-3d');
    const mount = document.getElementById(mode3d ? 'table3d-section' : 'game-section');
    if (!mount) return;
    const signature = JSON.stringify([setup, firstChoice, mode3d, state.isSpectator, client.state.myUniqueId,
        client.state.socket.connected, setup.order.map(id => { const p = state.players[id];
            return p ? [id, p.name, p.tryalCardCount, id === client.state.myUniqueId ? p.tryalCards : null, p.alive, p.hasBeenWitch, p.isConstable] : null; })]);
    if (panel.isConnected && panel.parentElement === mount && signature === previousRender) return;
    previousRender = signature;
    if (panel.parentElement !== mount) mount.prepend(panel);
    panel.replaceChildren(); panel.dataset.stage = setup.stage;
    const title = document.createElement('h3');
    title.textContent = setup.stage === 'shuffle' ? 'กำลังสับการ์ดชีวิต…' : setup.stage === 'deal' ? 'แจกการ์ดชีวิตวนรอบวง · ' + setup.dealt + '/' + setup.total : 'ดูฝั่งของคุณและจัดตำแหน่งชีวิต';
    panel.append(title);
    if (setup.stage !== 'arrange') {
        const deck = document.createElement('div'); deck.className = 'setup-deck'; deck.textContent = '1996'; panel.append(deck);
    }
    const seats = document.createElement('div'); seats.className = 'setup-seats';
    setup.order.forEach(id => {
        const player = state.players[id]; if (!player) return;
        const seat = document.createElement('div'); seat.className = 'setup-seat';
        if (setup.stage === 'deal' && setup.lastDeal?.playerId === id) seat.classList.add('is-dealt');
        const name = document.createElement('span'); name.textContent = player.name + (setup.confirmed.includes(id) ? ' ✓' : '');
        const cards = document.createElement('span'); cards.className = 'setup-card-count'; cards.textContent = '▰ '.repeat(player.tryalCardCount);
        seat.dataset.setupSeat = id;
        seat.append(name, cards); seats.append(seat);
    }); panel.append(seats);
    if (!mode3d && setup.stage === 'deal' && setup.lastDeal && lastAnimated !== setup.id + ':' + setup.lastDeal.sequence && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        lastAnimated = setup.id + ':' + setup.lastDeal.sequence;
        const destination = [...seats.children].find(seat => seat.dataset.setupSeat === setup.lastDeal.playerId);
        const deck = panel.querySelector('.setup-deck');
        if (destination && deck) {
            const origin = deck.getBoundingClientRect(), target = destination.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
            const fly = document.createElement('div'); fly.className = 'setup-flying-card'; panel.append(fly);
            fly.style.left = (origin.left - bounds.left) + 'px'; fly.style.top = (origin.top - bounds.top) + 'px';
            const animation = fly.animate([{ transform: 'translate(0,0) rotate(-8deg)' }, { transform: 'translate(' + (target.left-origin.left) + 'px,' + (target.top-origin.top) + 'px) rotate(0deg)' }], { duration: 320, easing: 'ease-out' });
            animation.onfinish = () => fly.remove();
        }
    }
    if (setup.stage !== 'arrange') return;
    const me = state.players[client.state.myUniqueId];
    if (!me || state.isSpectator) { const note = document.createElement('p'); note.textContent = 'รอผู้เล่นทุกคนจัดชีวิตและยืนยัน'; panel.append(note); return; }
    const role = document.createElement('p'); role.className = 'setup-role';
    role.textContent = me.hasBeenWitch ? 'คุณอยู่ทีมปอบ · หลังทุกคนยืนยัน ให้ร่วมกันเลือกผู้รับเครื่องเซ่น ตอนกลางคืนเลือกเป้าหมายสังหาร และปกปิดตัวตน' : 'คุณอยู่ทีมชาวบ้าน · ร่วมกันค้นหาและเปิดเผยการ์ดปอบให้ครบ ระวังการติดเชื้อระหว่างเกม';
    if (me.isConstable) role.textContent += ' · คุณถือหมอผี: ตอนกลางคืนเลือกปกป้องผู้เล่นอื่นได้ 1 คน';
    panel.append(role);
    const hint = document.createElement('p'); hint.textContent = editable() ? firstChoice === null ? 'แตะชีวิตสองใบเพื่อสลับตำแหน่ง หรือลากสลับก่อนยืนยัน' : 'เลือกอีกใบเพื่อสลับ · แตะใบเดิมเพื่อยกเลิก' : 'ยืนยันแล้ว · ตำแหน่งชีวิตถูกล็อก'; panel.append(hint);
    const row = document.createElement('div'); row.className = 'setup-own-lives';
    (me.tryalCards || []).forEach((card, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.disabled = !editable();
        button.dataset.lifeRole = card.name || '';
        button.setAttribute('aria-pressed', String(firstChoice === index)); button.setAttribute('aria-label', 'ชีวิตใบที่ ' + (index + 1));
        if (card.name) button.append(client.actions.createCardImage(card.name));
        button.draggable = editable();
        button.onclick = () => client.actions.chooseSetupLife(client.state.myUniqueId, index);
        button.ondragstart = event => event.dataTransfer.setData('text/plain', String(index));
        button.ondragover = event => event.preventDefault();
        button.ondrop = event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) client.actions.swapSetupLife(from, index); };
        row.append(button);
    }); panel.append(row);
    const confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'action-btn setup-confirm';
    confirm.disabled = !editable() || !client.state.socket.connected;
    confirm.textContent = editable() ? 'ยืนยันตำแหน่งชีวิต · พร้อมเริ่มเกม' : 'รอคนอื่นยืนยัน ' + setup.confirmed.length + '/' + setup.order.length;
    confirm.onclick = () => { if (editable()) client.state.socket.emit('confirm life setup', setup.id); };
    panel.append(confirm);
}
export function initialize() {
    client.state.socket.on('room state update', scheduleRender);
    client.state.socket.on('room left', () => { panel?.remove(); panel = null; firstChoice = null; previousRender = ''; });
    client.state.socket.on('disconnect', scheduleRender);
    client.state.socket.on('connect', scheduleRender);
    // Unrelated body classes (turn notice, fullscreen, phase cue) must not rebuild the setup UI.
    let was3D = document.body.classList.contains('game-view-3d');
    const observer = new MutationObserver(() => {
        const is3D = document.body.classList.contains('game-view-3d');
        if (is3D !== was3D) { was3D = is3D; scheduleRender(); }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
