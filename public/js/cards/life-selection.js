import { registerLifeInteraction } from '../core/interaction.js';
import { client } from '../core/client.js';

client.actions.showAccusedTryalSelection = function showAccusedTryalSelection(accusedUniqueId, tryalCount) {
    // Remove any existing popups to prevent overlapping
    const existing = document.getElementById('accused-tryal-select-popup');
    if (existing) existing.remove();
    const existingOverlay = document.getElementById('accused-tryal-select-overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingPopup = document.getElementById('accused-tryal-select-popup');
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.id = 'accused-tryal-select-overlay';
    overlay.className = 'tryal-modal-overlay';

    const container = document.createElement('div');
    container.id = 'accused-tryal-select-popup';
    container.dataset.lifeOwner = accusedUniqueId;
    container.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = '⚖️ เลือกการ์ดชีวิตของผู้ถูกกล่าวหาเพื่อเปิดเผย';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'เลือกการ์ดชีวิต 1 ใบเพื่อทำการเปิดโปงความจริงต่อหน้าชาวบ้าน';
    subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
    container.appendChild(subtitle);

    const lifeCommands = new Map();
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.className = 'tryal-card-btn';
        cardBtn.dataset.lifeIndex = i;
        cardBtn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i+1}</span>`;
        cardBtn.onclick = () => {
            client.state.socket.emit('select tryal card for confession', accusedUniqueId, i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (container && container.parentNode) container.parentNode.removeChild(container);
        };
        lifeCommands.set(i, cardBtn.onclick);
        cardsDiv.appendChild(cardBtn);
    }
    container.appendChild(cardsDiv);
    client.actions.addTryalPopupCollapseControl(container, overlay, title);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    registerLifeInteraction(container, accusedUniqueId, lifeCommands);
};

client.actions.closeForcedRevealNotice = function closeForcedRevealNotice() {
    if (client.state.forcedRevealNoticeCountdown) {
        clearInterval(client.state.forcedRevealNoticeCountdown);
        client.state.forcedRevealNoticeCountdown = null;
    }
    if (client.state.forcedRevealNoticeTimeout) {
        clearTimeout(client.state.forcedRevealNoticeTimeout);
        client.state.forcedRevealNoticeTimeout = null;
    }
    document.getElementById('forced-reveal-notice-overlay')?.remove();
    document.getElementById('forced-reveal-notice-popup')?.remove();
};

client.actions.showBlackCatTryalSelection = function showBlackCatTryalSelection(blackCatHolder, tryalCount, fromConspiracyDraw = false) {
    // Remove any existing popups to prevent overlapping
    const old = document.getElementById('blackcat-tryal-select-popup');
    if (old) old.remove();
    const existing = document.getElementById('select-blackcat-tryal-popup');
    if (existing) existing.remove();
    const oldOverlay = document.getElementById('blackcat-tryal-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'blackcat-tryal-overlay';
    overlay.className = 'tryal-modal-overlay';

    const container = document.createElement('div');
    container.id = 'blackcat-tryal-select-popup';
    container.dataset.lifeOwner = blackCatHolder;
    container.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = fromConspiracyDraw
        ? '🕯️ การ์ดพิธีเซ่นไหว้: ต้องเปิดการ์ดชีวิตของผู้ถือเครื่องเซ่น'
        : '🐱 เลือกการ์ดชีวิตของผู้ถือการ์ดเครื่องเซ่นเพื่อเปิดเผย';
    container.appendChild(title);

    const lifeCommands = new Map();
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.className = 'tryal-card-btn';
        cardBtn.dataset.lifeIndex = i;
        cardBtn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i+1}</span>`;
        cardBtn.onclick = () => {
            client.state.socket.emit('select blackcat tryal', blackCatHolder, i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (container && container.parentNode) container.parentNode.removeChild(container);
        };
        lifeCommands.set(i, cardBtn.onclick);
        cardsDiv.appendChild(cardBtn);
    }
    container.appendChild(cardsDiv);
    client.actions.addTryalPopupCollapseControl(container, overlay, title);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    registerLifeInteraction(container, blackCatHolder, lifeCommands);
};

client.actions.updateTryalCardDisplay = function updateTryalCardDisplay() {
    const tryalCardsList = document.getElementById('my-tryal-cards-list');
    if (tryalCardsList) {
        tryalCardsList.innerHTML = '';
        client.state.myTryalCards.forEach((card, idx) => {
            // Card UI
            const cardDiv = document.createElement('div');
            let tryalClass = '';
            if (card.name === 'Witch') tryalClass = 'witch';
            else if (card.name === 'Constable') tryalClass = 'constable';
            else tryalClass = 'notawitch';
            cardDiv.className = `card tryal-card-in-hand tryal-card ${tryalClass}`;
            cardDiv.dataset.index = idx;
            cardDiv.setAttribute('title', client.actions.displayCardDescription(card.name)); // <-- Add tooltip for tryal cards
            
            // แสดงรูปการ์ดแทนข้อความ
            const cardImage = client.actions.createCardImage(card.name);
            cardImage.style.width = '100%';
            cardImage.style.height = '100%';
            cardImage.style.objectFit = 'cover';
            cardImage.style.borderRadius = '6px';
            cardDiv.appendChild(cardImage);
            
            // Drag & drop events
            cardDiv.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', idx);
                cardDiv.classList.add('dragging');
            });
            cardDiv.addEventListener('dragend', (e) => {
                cardDiv.classList.remove('dragging');
            });
            cardDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                cardDiv.classList.add('drag-over');
            });
            cardDiv.addEventListener('dragleave', (e) => {
                cardDiv.classList.remove('drag-over');
            });
            cardDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                cardDiv.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIdx = idx;
                if (fromIdx !== toIdx) {
                    // Swap cards
                    const temp = client.state.myTryalCards[fromIdx];
                    client.state.myTryalCards[fromIdx] = client.state.myTryalCards[toIdx];
                    client.state.myTryalCards[toIdx] = temp;
                    // Emit swap to server
                    client.state.socket.emit('swap tryal cards', fromIdx, toIdx);
                    client.actions.updateTryalCardDisplay();
                }
            });
            tryalCardsList.appendChild(cardDiv);
        });
    }
    // Use hasBeenWitch for team display and update witch chat
    const myPlayer = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
    if (myPlayer) {
        // ทีมปอบ: ถ้าเคยมีไพ่ Witch (hasBeenWitch)
        if (myPlayer.hasBeenWitch) {
            client.dom.myRoleDisplay.textContent = 'ทีมปอบ';
            client.dom.myRoleDisplay.classList.add('team-witch');
            client.dom.myRoleDisplay.classList.remove('team-town');
        } else {
            client.dom.myRoleDisplay.textContent = 'ทีมชาวบ้าน';
            client.dom.myRoleDisplay.classList.add('team-town');
            client.dom.myRoleDisplay.classList.remove('team-witch');
        }
        client.actions.updateWitchChatVisibility(myPlayer.hasBeenWitch);
    }
    // Update tryal card count in heading
    const tryalCardCountSpan = document.getElementById('tryal-card-count');
    if (tryalCardCountSpan) {
        tryalCardCountSpan.textContent = client.state.myTryalCards.length;
    }
};

export function initialize() {
  client.state.accusedTryalSelection = null;

  client.state.forcedRevealJustHappened = false;

  client.state.socket.on('prompt select accused tryal', ({ accusedUniqueId, tryalCount }) => {
      client.state.accusedTryalSelection = { accusedUniqueId, tryalCount };
      client.actions.showAccusedTryalSelection(accusedUniqueId, tryalCount);
      // Disable draw card button until next turn
      client.dom.drawCardButton.disabled = true;
      client.state.forcedRevealJustHappened = true;
  });

  client.state.forcedRevealNoticeCountdown = null;

  client.state.forcedRevealNoticeTimeout = null;

  client.state.socket.on('forced reveal notice', ({ byPlayerName, reason, points }) => {
      client.actions.closeForcedRevealNotice();

      const overlay = document.createElement('div');
      overlay.id = 'forced-reveal-notice-overlay';
      overlay.className = 'tryal-modal-overlay';

      const popup = document.createElement('div');
      popup.id = 'forced-reveal-notice-popup';
      popup.className = 'tryal-selection-popup';

      const detail = reason === 'witness_card'
          ? 'คุณถูกใช้การ์ดพยาน และกำลังจะถูกเปิดการ์ดชีวิต!'
          : `คุณมีข้อกล่าวหาสะสมครบ ${points || 0} แต้ม และกำลังจะถูกเปิดการ์ดชีวิต!`;

      popup.innerHTML = `
          <div style="font-family:'Creepster','Noto Serif Thai',serif;font-size:1.4em;font-weight:bold;margin-bottom:12px;color:#ff8a80;text-shadow:0 0 12px rgba(255,82,82,0.5);">⚠️ คุณกำลังถูกบังคับเปิดการ์ดชีวิต!</div>
          <div style="margin-bottom:10px;color:#ffccbc;">ผู้ที่ทำให้เกิดเหตุการณ์: <b style="color:#fff;">${byPlayerName || 'ไม่ทราบชื่อ'}</b></div>
          <div style="margin-bottom:16px;color:#cfd8dc;font-size:1em;">${detail}</div>
      `;

      const okBtn = document.createElement('button');
      okBtn.className = 'tryal-popup-action-btn action-btn';
      okBtn.textContent = 'รับทราบ';
      okBtn.onclick = client.actions.closeForcedRevealNotice;
      popup.appendChild(okBtn);

      const countdownLabel = document.createElement('div');
      countdownLabel.className = 'forced-reveal-countdown';
      countdownLabel.textContent = 'ปิดอัตโนมัติใน 5 วินาที';
      popup.appendChild(countdownLabel);
      overlay.appendChild(popup);
      document.body.appendChild(overlay);

      let secondsRemaining = 5;
      client.state.forcedRevealNoticeCountdown = setInterval(() => {
          secondsRemaining -= 1;
          if (secondsRemaining > 0) {
              countdownLabel.textContent = `ปิดอัตโนมัติใน ${secondsRemaining} วินาที`;
          }
      }, 1000);
      client.state.forcedRevealNoticeTimeout = setTimeout(client.actions.closeForcedRevealNotice, 5000);
  });

  client.state.blackCatTryalSelection = null;

  client.state.socket.on('prompt select curse target', (data) => {
      client.actions.showCurseTargetSelection(data.targetUniqueId, data.blueCards);
  });

  client.dom.cardTargetSelect.addEventListener('change', () => {
      client.actions.updateDrawCardButton();
  });

  client.dom.setNameButton.addEventListener('click', () => {
      if (client.state.currentRoomName && client.state.currentRoomState?.gameStarted) {
          client.actions.addGameMessage('เปลี่ยนชื่อได้ในล็อบบี้ก่อนเริ่มเกมเท่านั้น', 'orange');
          return;
      }
      const name = client.dom.nameInput.value.trim();
      if (name) {
          if (client.state.currentRoomName) {
              client.state.socket.emit('set player name', name);
              return;
          }
          client.state.myPlayerName = name;
          client.dom.playerNameDisplay.textContent = client.state.myPlayerName;
          client.dom.nameInputContainer.style.display = 'flex';
          client.state.socket.emit('set player name', client.state.myPlayerName);
          client.state.socket.emit('request rooms list');

      }
  });
}
