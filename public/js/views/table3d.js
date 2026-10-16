import { client } from '../core/client.js';

client.actions.updateTable3DFocus = function updateTable3DFocus() {
    const player = client.state.currentRoomState?.players?.[client.state.table3DFocusedPlayer || client.state.myUniqueId];
    if (!player) return;
    const name = document.getElementById('table3d-player-name');
    const status = document.getElementById('table3d-player-status');
    const nextName = `${player.name}${player.uniqueId === client.state.myUniqueId ? ' (คุณ)' : ''}`;
    if (name.textContent !== nextName) name.textContent = nextName;
    const team = player.hasBeenWitch ? ' · ทีมปอบ' : '';
    const nextStatus = `${player.alive ? 'ยังมีชีวิต' : 'เสียชีวิตแล้ว'} · ชีวิต ${player.tryalCardCount} · การ์ด ${player.handSize} · ข้อกล่าวหา ${player.accusationPoints || 0}${team}`;
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
};

client.actions.syncTable3D = async function syncTable3D() {
    const section = document.getElementById('table3d-section');
    const visible = !document.hidden && document.body.classList.contains('game-view-3d') && !!client.state.currentRoomState?.gameStarted;
    if (section.hidden !== !visible) section.hidden = !visible;
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
                    client.actions.hidePlayerStatus?.();
                    if (!client.actions.canUseTable3DHand()) return;
                    const cards = document.querySelectorAll('#player-hand > .card');
                    const card = client.state.myCurrentHand?.[index];
                    if (client.state.selectedCard === index && card &&
                        ![...client.state.CARDS_NEED_TARGET, ...client.state.CARDS_NEED_TWO_TARGETS].includes(card.name)) {
                        const play = document.getElementById('play-card-button');
                        if (play && !play.disabled) play.click();
                    } else cards[index]?.click();
                },
                onDraw: () => { if (client.actions.canUseTable3DHand()) { const draw = document.getElementById('draw-card-button'); if (draw && !draw.disabled) draw.click(); } },
                onInspect: data => {
                    const state = client.state.currentRoomState;
                    const name = Number.isInteger(data.cardIndex) ? client.state.myCurrentHand?.[data.cardIndex]?.name
                        : Number.isInteger(data.effectIndex) ? state?.players?.[data.playerId]?.inPlayCards?.[data.effectIndex]?.name
                        : Number.isInteger(data.lifeIndex) ? state?.players?.[data.playerId]?.tryalCards?.[data.lifeIndex]?.name : null;
                    if (name) client.actions.inspectGameCard?.(name);
                },
                onPlayer: id => client.actions.handleTable3DPlayer(id),
                onLife: (id, index) => client.actions.handleTable3DLife(id, index),
                onEffect: (id, index) => client.actions.handleTable3DEffect(id, index),
                onError: message => {
                    client.actions.setGameViewMode('2d');
                    section.hidden = true;
                    document.body.classList.add('table3d-unavailable');
                    loading.textContent = message;
                    loading.hidden = false;
                    client.state.table3D?.setActive(false);
                },
            });
        }
        if (!loading.hidden) loading.hidden = true;
        client.state.table3D.setActive(true);
        client.state.table3D.update({ state: client.state.currentRoomState, me: client.state.myUniqueId, hand: client.state.myCurrentHand || [], selected: client.state.selectedCard,
            imageFor: name => name ? client.actions.createCardImage(name).src : null,
            interaction: client.actions.getTable3DInteraction(),
            canDraw: client.actions.canUseTable3DHand() && !document.getElementById('draw-card-button')?.disabled,
            handLowered: !!client.state.table3DHandLowered,
            artwork: client.state.cardArtwork,
            drawConfirming: document.getElementById('draw-card-button')?.classList.contains('confirming') });
        client.actions.updateTable3DFocus();
    } catch (error) {
        client.actions.setGameViewMode('2d');
        section.hidden = true;
        client.state.table3D?.setActive(false);
        document.body.classList.add('table3d-unavailable');
        loading.textContent = 'อุปกรณ์นี้ยังแสดงโต๊ะ 3D ไม่ได้ ใช้กระดานด้านล่างหรือสลับเป็น 2D ได้';
        loading.hidden = false;
        console.warn('3D table unavailable:', error);
    }
};

client.actions.setGameViewMode = function setGameViewMode(mode) {
    const use3D = mode === '3d';
    if (!use3D) {
        client.actions.closeTable3DFullscreen?.();
        client.actions.restoreTable3DDialogs?.();
        client.state.table3D?.setActive(false);
    }
    if (use3D && document.body.classList.contains('table3d-unavailable')) {
        client.state.table3D?.dispose();
        client.state.table3D = null;
        document.body.classList.remove('table3d-unavailable');
    }
    document.body.classList.toggle('game-view-3d', use3D);
    client.dom.gameViewToggle?.setAttribute('aria-checked', String(use3D));
    if (client.dom.gameViewDescription) client.dom.gameViewDescription.textContent = use3D ? 'มุมมองกระดาน 3D' : 'มุมมอง 2D';
};

client.actions.closeTable3DFullscreen = function closeTable3DFullscreen() {
    document.body.classList.remove('table3d-fullscreen');
    const button = document.getElementById('table3d-fullscreen');
    if (button) { button.textContent = 'เต็มจอ'; button.setAttribute('aria-pressed', 'false'); }
    if (client.state.table3DNativeFullscreen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    client.state.table3DNativeFullscreen = false;
};

export function initialize() {
  client.state.socket = io();

  client.dom.gameViewToggle = document.getElementById('game-view-toggle');

  client.dom.gameViewDescription = document.getElementById('game-view-description');

  client.state.table3D = null;

  client.state.table3DBundle = null;

  client.state.table3DFocusedPlayer = null;
  client.state.table3DHandLowered = false;

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

  document.getElementById('table3d-hand-toggle')?.addEventListener('click', event => {
      client.state.table3DHandLowered = !client.state.table3DHandLowered;
      event.currentTarget.textContent = client.state.table3DHandLowered ? 'ยกไพ่ทุกคน' : 'วางไพ่ทุกคน';
      event.currentTarget.setAttribute('aria-pressed', String(client.state.table3DHandLowered));
      client.actions.syncTable3D();
  });
  document.getElementById('table3d-fullscreen')?.addEventListener('click', async event => {
      if (document.body.classList.contains('table3d-fullscreen')) {
          client.actions.closeTable3DFullscreen(); return;
      }
      document.body.classList.add('table3d-fullscreen');
      event.currentTarget.textContent = 'ออกเต็มจอ';
      event.currentTarget.setAttribute('aria-pressed', 'true');
      // Fullscreen the document so action dialogs appended to body stay accessible.
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          try {
              client.state.table3DNativeFullscreen = true;
              await document.documentElement.requestFullscreen();
              if (!document.body.classList.contains('table3d-fullscreen') && document.fullscreenElement) {
                  await document.exitFullscreen();
                  client.state.table3DNativeFullscreen = false;
              }
          } catch (_) { client.state.table3DNativeFullscreen = false; /* Keep the viewport fallback. */ }
      }
  });
  document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && client.state.table3DNativeFullscreen) client.actions.closeTable3DFullscreen();
  });
  document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('table3d-fullscreen')) client.actions.closeTable3DFullscreen();
  });
  client.state.socket.on('room left', () => client.actions.closeTable3DFullscreen());

  document.getElementById('table3d-reset')?.addEventListener('click', () => client.state.table3D?.resetCamera());

  document.getElementById('table3d-overview')?.addEventListener('click', () => client.state.table3D?.setCameraView('overview'));
  document.getElementById('table3d-top-view')?.addEventListener('click', () => client.state.table3D?.setCameraView('top'));

  document.getElementById('table3d-zoom-in')?.addEventListener('click', () => client.state.table3D?.zoom('in'));

  document.getElementById('table3d-zoom-out')?.addEventListener('click', () => client.state.table3D?.zoom('out'));

  document.addEventListener('visibilitychange', () => {
      if (document.hidden) client.state.table3D?.setActive(false);
      else client.actions.syncTable3D();
  });

  window.addEventListener('pagehide', () => client.state.table3D?.setActive(false));

  window.addEventListener('pageshow', () => { if (client.state.currentRoomState) client.actions.syncTable3D(); });
}
