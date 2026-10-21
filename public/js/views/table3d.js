import { client } from '../core/client.js';

client.actions.updateTable3DFocus = function updateTable3DFocus() {
    const player = client.state.currentRoomState?.players?.[client.state.myUniqueId];
    if (!player) return;
    const name = document.getElementById('table3d-player-name');
    const status = document.getElementById('table3d-player-status');
    const nextName = `${player.name}${player.uniqueId === client.state.myUniqueId ? ' (คุณ)' : ''}`;
    if (name.textContent !== nextName) name.textContent = nextName;
    name.parentElement.classList.toggle('is-current-turn', player.alive && !client.state.currentRoomState.gameOver &&
        client.state.currentRoomState.currentPhase === 'DAY' && client.state.currentRoomState.currentTurnPlayerUniqueId === player.uniqueId);
    const team = player.hasBeenWitch ? ' · ทีมปอบ' : '';
    const nextStatus = `${player.alive ? 'ยังมีชีวิต' : 'เสียชีวิตแล้ว'} · ชีวิต ${player.tryalCardCount} · การ์ด ${player.handSize} · ข้อกล่าวหา ${player.accusationPoints || 0}${team}`;
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
    let connections = document.getElementById('table3d-connection-status');
    if (!connections) {
        connections = document.createElement('small');
        connections.id = 'table3d-connection-status';
        connections.style.display = 'block';
        status.parentElement.appendChild(connections);
    }
    const waiting = Object.values(client.state.currentRoomState?.players || {}).filter(other => other.reconnectDeadline && !other.isReplacementBot);
    connections.textContent = waiting.map(other => `${other.name}: รอเชื่อมต่อ ${Math.max(0, Math.ceil((other.reconnectDeadline - Date.now()) / 1000))} วินาที`).join(' · ');
    connections.hidden = waiting.length === 0;
    let role = document.getElementById('table3d-role-badge');
    if (!role) {
        role = document.createElement('strong'); role.id = 'table3d-role-badge';
        status.parentElement.appendChild(role);
    }
    const showRole = !!player.hasBeenWitch && !client.state.currentRoomState?.isSpectator && !client.state.isSpectatorMode;
    role.hidden = !showRole;
    if (showRole && role.textContent !== 'คุณเป็นปอบ · ทีมปอบ') role.textContent = 'คุณเป็นปอบ · ทีมปอบ';
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
                quality: client.state.graphicsQuality || 'medium',
                cameraMode: client.state.table3DCameraMode || 'rotate',
                onCard: index => {
                    client.actions.hidePlayerStatus?.();
                    if (client.state.table3DReorderMode) { client.actions.reorderTable3DCard?.(index); return; }
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
                onSeatFocus: name => {
                    const label = document.getElementById('table3d-seat-label');
                    if (label && label.textContent !== name) label.textContent = name;
                },
                onInspect: data => {
                    const state = client.state.currentRoomState;
                    const name = Number.isInteger(data.cardIndex) ? client.state.myCurrentHand?.[data.cardIndex]?.name
                        : Number.isInteger(data.effectIndex) ? state?.players?.[data.playerId]?.inPlayCards?.[data.effectIndex]?.name
                        : Number.isInteger(data.revealedIndex) ? state?.players?.[data.playerId]?.revealedTryalCards?.[data.revealedIndex]?.name
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
        client.state.table3D.update({ state: client.state.currentRoomState, me: client.state.myUniqueId, hand: client.state.myCurrentHand || [], selected: client.state.selectedCard, selectedCards: client.actions.selectedRedBatch?.() || [],
            imageFor: name => name ? client.actions.createCardImage(name).src : null,
            interaction: client.actions.getTable3DInteraction(),
            canDraw: client.actions.canUseTable3DHand() && !document.getElementById('draw-card-button')?.disabled,
            handLowered: !!client.state.table3DHandLowered,
            artwork: client.state.cardArtwork,
            reorderIndex: client.state.table3DReorderIndex ?? null,
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
    client.actions.releaseTable3DKeyboard?.();
    document.body.classList.remove('table3d-fullscreen');
    const button = document.getElementById('table3d-fullscreen');
    if (button) { button.textContent = 'เต็มจอ'; button.setAttribute('aria-pressed', 'false'); }
    if (client.state.table3DNativeFullscreen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
    client.state.table3DNativeFullscreen = false;
};

export function initialize() {
  const keyboardStatus = document.createElement('span');
  keyboardStatus.id = 'table3d-keyboard-status';
  keyboardStatus.textContent = 'Space ขึ้น · Q ลง';
  document.querySelector('#table3d-section .table3d-hand-controls')?.appendChild(keyboardStatus);
  let keyboardRequest = 0;
  client.actions.releaseTable3DKeyboard = () => {
      keyboardRequest++;
      client.state.table3D?.setKeyboardLocked(false);
      navigator.keyboard?.unlock?.();
      keyboardStatus.textContent = 'Space ขึ้น · Q ลง';
  };
  async function lockTableKeyboard() {
      if (!document.fullscreenElement || !navigator.keyboard?.lock) return;
      const request = ++keyboardRequest;
      try {
          await navigator.keyboard.lock(['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','ControlLeft','ControlRight']);
          if (request !== keyboardRequest || !document.fullscreenElement || !document.hasFocus() || !document.body.classList.contains('table3d-fullscreen')) {
              navigator.keyboard.unlock(); return;
          }
          client.state.table3D?.setKeyboardLocked(true);
          keyboardStatus.textContent = 'Space ขึ้น · Ctrl / Q ลง';
      } catch (_) { client.actions.releaseTable3DKeyboard(); }
  }
  client.state.socket = io();

  client.dom.gameViewToggle = document.getElementById('game-view-toggle');

  client.dom.gameViewDescription = document.getElementById('game-view-description');

  client.state.table3D = null;

  client.state.table3DBundle = null;

  client.state.table3DFocusedPlayer = null;
  client.state.table3DHandLowered = false;
  let gameWasStarted = false, setupId = null, previousPhase = null;
  client.state.socket.on('room state update', state => {
      const freshSetup = state.lifeSetup?.id && state.lifeSetup.id !== setupId;
      if (state.gameStarted && (!gameWasStarted || freshSetup || (previousPhase === 'SETUP' && state.currentPhase !== 'SETUP'))) {
          client.state.table3DHandLowered = false;
          const toggle = document.getElementById('table3d-hand-toggle');
          if (toggle) { toggle.textContent = 'วางไพ่'; toggle.setAttribute('aria-pressed', 'false'); }
          client.state.table3D?.resetCamera();
      }
      previousPhase = state.currentPhase;
      gameWasStarted = !!state.gameStarted;
      setupId = state.lifeSetup?.id || null;
  });
  client.state.socket.on('room left', () => { gameWasStarted = false; setupId = null; previousPhase = null; client.state.table3DHandLowered = false; });
  client.state.graphicsQuality = 'medium';
  try {
      const saved=localStorage.getItem('villageGraphicsQuality');
      if(['low','medium','high'].includes(saved)) client.state.graphicsQuality=saved;
  } catch (_) {}
  const qualitySelect=document.getElementById('graphics-quality');
  if(qualitySelect) {
      qualitySelect.value=client.state.graphicsQuality;
      qualitySelect.addEventListener('change',()=>{
          client.state.graphicsQuality=qualitySelect.value;
          try {localStorage.setItem('villageGraphicsQuality',qualitySelect.value);} catch (_) {}
          client.state.table3D?.setQuality(qualitySelect.value);
      });
  }
  client.state.table3DCameraMode='rotate';
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
      event.currentTarget.textContent = client.state.table3DHandLowered ? 'ยกไพ่' : 'วางไพ่';
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
      if (document.body.classList.contains('table3d-fullscreen')) await lockTableKeyboard();
  });
  document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) client.actions.releaseTable3DKeyboard();
      if (!document.fullscreenElement && client.state.table3DNativeFullscreen) client.actions.closeTable3DFullscreen();
  });
  document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('table3d-fullscreen')) client.actions.closeTable3DFullscreen();
  });
  client.state.socket.on('room left', () => client.actions.closeTable3DFullscreen());
  window.addEventListener('blur', () => client.actions.releaseTable3DKeyboard());

  document.getElementById('table3d-seat-left')?.addEventListener('click', () => client.state.table3D?.stepSeat(-1));
  document.getElementById('table3d-seat-right')?.addEventListener('click', () => client.state.table3D?.stepSeat(1));

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
