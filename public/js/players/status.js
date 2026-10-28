import { cardArtworkUrl } from '../views/artwork.js';
import { client } from '../core/client.js';

client.actions.showDeathNoticeModal = function showDeathNoticeModal() {
    const existing = document.getElementById('death-notice-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'death-notice-overlay';
    overlay.className = 'death-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'death-modal-content';
    modal.innerHTML = `
        <div class="death-modal-icon">🪦</div>
        <h2 class="death-modal-title">คุณเสียชีวิตแล้ว!</h2>
        <div class="death-modal-badge">☠️ เข้าสู่สถานะวิญญาณเร่ร่อน</div>
        <p class="death-modal-desc">
            ชีวิตของคุณในหมู่บ้านต้องคำสาปได้ดับสูญแล้ว...<br>
            คุณไม่สามารถจั่วการ์ด เล่นการ์ด หรือกล่าวหาใครได้อีกต่อไป<br>
            แต่ยังคงสามารถเฝ้าดูชะตากรรมของหมู่บ้านต่อได้ในฐานะวิญญาณ
        </p>
        <button type="button" class="death-modal-close-btn" id="death-modal-close-btn">
            👁️ รับทราบ (เฝ้าดูต่อในฐานะวิญญาณ)
        </button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#death-modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            overlay.remove();
        };
    }
};

client.actions.updateSpectatorUI = function updateSpectatorUI(isSpec) {
    let specBanner = document.getElementById('spectator-status-banner');
    if (isSpec) {
        if (!specBanner) {
            specBanner = document.createElement('div');
            specBanner.id = 'spectator-status-banner';
            specBanner.className = 'spectator-status-banner';
            specBanner.innerHTML = '<span>👁️ <strong>โหมดผู้ชม </strong> — คุณกำลังเฝ้าดูการเล่น ไม่สามารถกระทำแอ็กชัน และไม่เห็นบทบาทลับ</span>';
            const gamePage = document.getElementById('game-page');
            if (gamePage) gamePage.insertBefore(specBanner, gamePage.firstChild);
        } else {
            specBanner.style.display = 'flex';
        }
        // Disable hand action controls for spectators
        if (typeof client.dom.drawCardButton !== 'undefined' && client.dom.drawCardButton) client.dom.drawCardButton.disabled = true;
        if (typeof client.dom.playCardButton !== 'undefined' && client.dom.playCardButton) client.dom.playCardButton.disabled = true;
        if (typeof client.dom.endTurnButton !== 'undefined' && client.dom.endTurnButton) client.dom.endTurnButton.disabled = true;
        if (typeof client.dom.confessButton !== 'undefined' && client.dom.confessButton) client.dom.confessButton.disabled = true;
        const gameActions = client.dom.gameActionsDiv;
        if (gameActions) gameActions.style.display = 'none';
        const confessSection = document.getElementById('confess-section');
        if (confessSection) confessSection.style.display = 'none';
        const witchChatSection = document.getElementById('witch-chat-section');
        if (witchChatSection) witchChatSection.style.display = 'none';
    } else if (specBanner) {
        specBanner.style.display = 'none';
    }
};

client.actions.showWitchPopup = function showWitchPopup(senderName) {
    if (client.state.witchPopupAcknowledged) return;
    const existing = document.getElementById('witch-popup');
    if (existing && existing.dataset.activeWitchPopup === 'true') return;
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'witch-popup';
    overlay.dataset.activeWitchPopup = 'true';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(20,10,20,0.92)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.boxSizing = 'border-box';
    overlay.style.padding = '24px';
    overlay.style.overflowY = 'auto';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'คุณเป็นทีมปอบ');

    const cardImg = document.createElement('img');
    cardImg.dataset.cardArtwork = 'witch.png';
    cardImg.src = cardArtworkUrl('witch.png');
    cardImg.alt = 'ปอบ';
    cardImg.style.width = '160px';
    cardImg.style.height = '220px';
    cardImg.style.marginBottom = '18px';
    cardImg.style.boxShadow = '0 0 32px #ff1744cc';
    overlay.appendChild(cardImg);

    const title = document.createElement('div');
    title.textContent = 'คุณเป็นปอบ!';
    title.style.color = '#ff1744';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '2em';
    title.style.marginBottom = '12px';
    overlay.appendChild(title);

    // เพิ่มชื่อผู้ส่งถ้ามี
    if (senderName && senderName !== '...') {
        const fromDiv = document.createElement('div');
        fromDiv.textContent = `คุณได้รับการ์ดปอบจาก ${senderName}`;
        fromDiv.style.color = '#ffd180';
        fromDiv.style.fontWeight = 'bold';
        fromDiv.style.fontSize = '1.15em';
        fromDiv.style.marginBottom = '10px';
        overlay.appendChild(fromDiv);
    }

    const desc = document.createElement('div');
    desc.innerHTML = 'คุณจะกลายเป็นทีมปอบ จะต้องช่วยเหลือปอบในการกำจัดชาวบ้าน หรือปกป้องการ์ดปอบเพื่อแพร่เชื้อ';
    desc.style.color = '#ffe0b2';
    desc.style.fontSize = '1.1em';
    desc.style.marginBottom = '28px';
    desc.style.textAlign = 'center';
    overlay.appendChild(desc);

    const btn = document.createElement('button');
    btn.textContent = 'เข้าใจแล้ว';
    btn.style.fontSize = '1.25em';
    btn.style.background = 'linear-gradient(90deg, #ff9800 60%, #ff5722 100%)';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.padding = '14px 38px';
    btn.style.fontWeight = 'bold';
    btn.style.boxShadow = '0 2px 16px #ff572288';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
        client.state.witchPopupAcknowledged = true;
        overlay.remove();
    };
    overlay.appendChild(btn);

    document.body.appendChild(overlay);
};

client.actions.resetWitchPopup = function resetWitchPopup() {
    client.state.witchPopupAcknowledged = false;
    try { localStorage.removeItem('witchPopupAcknowledged'); } catch (_) {}
    document.getElementById('witch-popup')?.remove();
};

export function initialize() {
  client.state.socket.on('room state update', state => {
      if (!state.gameStarted) {
          if (client.state.witchPopupAcknowledged) client.actions.resetWitchPopup();
          return;
      }
      const me = state.players?.[client.state.myUniqueId];
      if (!state.gameOver && me?.alive && me.hasBeenWitch && !state.isSpectator && !client.state.isSpectatorMode) {
          client.actions.showWitchPopup();
      }
  });
  client.state.socket.on('room joined', client.actions.resetWitchPopup);
  client.state.socket.on('game restarted', client.actions.resetWitchPopup);
  client.state.socket.on('room left', client.actions.resetWitchPopup);
  client.state.socket.on('joined as spectator', ({ roomName, name }) => {
      client.state.isSpectatorMode = true;
      client.state.myPlayerName = name;
      client.dom.playerNameDisplay.textContent = name;
      client.dom.nameInput.value = name;
      client.actions.addGameMessage(`👁️ คุณเข้าร่วมในฐานะผู้ชมของห้อง ${roomName}`, 'gray', true);
      client.actions.updateSpectatorUI(true);
  });

  document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('enter-village-btn');
    var modal = document.getElementById('music-overlay');
    if (btn && modal) {
      btn.onclick = function() {
        modal.classList.add('hidden');
      };
    }
  });
}
