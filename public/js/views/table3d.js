import { client } from '../core/client.js';

client.actions.updateTable3DFocus = function updateTable3DFocus() {
    const player = client.state.currentRoomState?.players?.[client.state.table3DFocusedPlayer || client.state.myUniqueId];
    if (!player) return;
    const name = document.getElementById('table3d-player-name');
    const status = document.getElementById('table3d-player-status');
    name.textContent = `${player.name}${player.uniqueId === client.state.myUniqueId ? ' (คุณ)' : ''}`;
    const team = player.hasBeenWitch ? ' · ทีมปอบ' : '';
    status.textContent = `${player.alive ? 'ยังมีชีวิต' : 'เสียชีวิตแล้ว'} · ชีวิต ${player.tryalCardCount} · การ์ด ${player.handSize} · ข้อกล่าวหา ${player.accusationPoints || 0}${team}`;
};

client.actions.syncTable3D = async function syncTable3D() {
    const section = document.getElementById('table3d-section');
    const visible = !document.hidden && document.body.classList.contains('game-view-3d') && !!client.state.currentRoomState?.gameStarted;
    section.hidden = !visible;
    if (!visible) { client.state.table3D?.setActive(false); return; }
    if (document.body.classList.contains('table3d-unavailable')) return;
    const loading = document.getElementById('table3d-loading');
    try {
        if (!client.state.table3DBundle) {
            client.state.table3DBundle = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'table3d.bundle.js';
                script.onload = () => window.VillageTable3D ? resolve() : reject(new Error('โหลดฉาก 3D ไม่สำเร็จ'));
                script.onerror = () => { script.remove(); reject(new Error('โหลดฉาก 3D ไม่สำเร็จ กรุณาลองใหม่')); };
                document.head.appendChild(script);
            }).catch(error => { client.state.table3DBundle = null; throw error; });
        }
        await client.state.table3DBundle;
        if (!document.body.classList.contains('game-view-3d') || !client.state.currentRoomState?.gameStarted) return;
        if (!client.state.table3D) {
            client.state.table3D = window.VillageTable3D.create({
                container: document.getElementById('table3d-canvas'),
                onCard: index => {
                    if (!client.actions.canUseTable3DHand()) return;
                    const cards = document.querySelectorAll('#player-hand > .card');
                    cards[index]?.click();
                },
                onDraw: () => { if (client.actions.canUseTable3DHand()) document.getElementById('draw-card-button')?.click(); },
                onPlayer: id => client.actions.handleTable3DPlayer(id),
                onLife: (id, index) => client.actions.handleTable3DLife(id, index),
                onEffect: (id, index) => client.actions.handleTable3DEffect(id, index),
                onError: message => {
                    document.body.classList.add('table3d-unavailable');
                    loading.textContent = message;
                    loading.hidden = false;
                    client.state.table3D?.setActive(false);
                },
            });
        }
        loading.hidden = true;
        client.state.table3D.setActive(true);
        client.state.table3D.update({ state: client.state.currentRoomState, me: client.state.myUniqueId, hand: client.state.myCurrentHand || [], selected: client.state.selectedCard,
            imageFor: name => name ? client.actions.createCardImage(name).src : null,
            interaction: client.actions.getTable3DInteraction() });
        client.actions.updateTable3DFocus();
    } catch (error) {
        document.body.classList.add('table3d-unavailable');
        loading.textContent = 'อุปกรณ์นี้ยังแสดงโต๊ะ 3D ไม่ได้ ใช้กระดานด้านล่างหรือสลับเป็น 2D ได้';
        loading.hidden = false;
        console.warn('3D table unavailable:', error);
    }
};

client.actions.setGameViewMode = function setGameViewMode(mode) {
    const use3D = mode === '3d';
    if (use3D && document.body.classList.contains('table3d-unavailable')) {
        client.state.table3D?.dispose();
        client.state.table3D = null;
        document.body.classList.remove('table3d-unavailable');
    }
    document.body.classList.toggle('game-view-3d', use3D);
    client.dom.gameViewToggle?.setAttribute('aria-checked', String(use3D));
    if (client.dom.gameViewDescription) client.dom.gameViewDescription.textContent = use3D ? 'มุมมองกระดาน 3D' : 'มุมมอง 2D';
};

export function initialize() {
  client.state.socket = io();

  client.dom.gameViewToggle = document.getElementById('game-view-toggle');

  client.dom.gameViewDescription = document.getElementById('game-view-description');

  client.state.table3D = null;

  client.state.table3DBundle = null;

  client.state.table3DFocusedPlayer = null;

  client.state.savedGameViewMode = '2d';

  try {
      client.state.savedGameViewMode = localStorage.getItem('villageGameView') || '2d';
  } catch (_) { /* Use the default when storage is unavailable. */ }

  client.actions.setGameViewMode(client.state.savedGameViewMode);

  client.dom.gameViewToggle?.addEventListener('click', () => {
      const mode = document.body.classList.contains('game-view-3d') ? '2d' : '3d';
      client.actions.setGameViewMode(mode);
      client.actions.syncTable3D();
      try { localStorage.setItem('villageGameView', mode); } catch (_) { /* The toggle still works without storage. */ }
  });

  document.getElementById('table3d-reset')?.addEventListener('click', () => client.state.table3D?.resetCamera());

  document.getElementById('table3d-zoom-in')?.addEventListener('click', () => client.state.table3D?.zoom('in'));

  document.getElementById('table3d-zoom-out')?.addEventListener('click', () => client.state.table3D?.zoom('out'));

  document.addEventListener('visibilitychange', () => {
      if (document.hidden) client.state.table3D?.setActive(false);
      else client.actions.syncTable3D();
  });

  window.addEventListener('pagehide', () => client.state.table3D?.setActive(false));

  window.addEventListener('pageshow', () => { if (client.state.currentRoomState) client.actions.syncTable3D(); });
}
