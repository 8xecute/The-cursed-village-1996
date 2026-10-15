import { client } from '../core/client.js';

client.actions.afterPlayCard = function afterPlayCard() {
    client.state.hasPlayedCardsThisTurn = true;
    client.actions.updateTurnUI();
};


export function initialize() {
  client.state.hasDrawnCardThisTurn = false;

  client.state.socket.on('update hand', (hand) => {
      // ... existing code ...
      if (client.state.isMyTurn && !client.state.hasDrawnCardThisTurn && hand.length > client.state.myCurrentHand.length) {
          client.state.hasDrawnCardThisTurn = true;
          client.actions.updateTurnUI();
      }
      client.state.myCurrentHand = hand;
      client.actions.updateHandDisplay(client.state.myCurrentHand);
  });

  client.state.socket.on('card played successfully', () => {
      client.state.hasPlayedCardsThisTurn = true;
      client.actions.updateTurnUI();
  });

  client.state.socket.on('prompt select blackcat tryal', ({ blackCatHolder, tryalCount, blackCatHolderName, fromConspiracyDraw = false }) => {
      // Remove existing popup if any
      const existing = document.getElementById('select-blackcat-tryal-popup');
      if (existing) existing.remove();
      const oldPopup = document.getElementById('blackcat-tryal-select-popup');
      if (oldPopup) oldPopup.remove();
      const existingOverlay = document.getElementById('select-blackcat-overlay');
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = 'select-blackcat-overlay';
      overlay.className = 'tryal-modal-overlay';

      const popup = document.createElement('div');
      popup.id = 'select-blackcat-tryal-popup';
      popup.className = 'tryal-selection-popup';

      const title = document.createElement('h3');
      title.textContent = fromConspiracyDraw
          ? '🕯️ การ์ดพิธีเซ่นไหว้: ต้องเปิดการ์ดชีวิตของผู้ถือเครื่องเซ่น'
          : '🐱 เลือกการ์ดชีวิตของผู้ถือเครื่องเซ่นเพื่อเปิดเผย';
      popup.appendChild(title);

      const holderName = blackCatHolderName || (client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[blackCatHolder] && client.state.currentRoomState.players[blackCatHolder].name) || 'ไม่ทราบชื่อ';
      const subtitle = document.createElement('p');
      subtitle.innerHTML = `ผู้ถือการ์ดเครื่องเซ่นในปัจจุบัน: <b style="color:#ffb74d;">${holderName}</b>`;
      subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
      popup.appendChild(subtitle);

      const cardsDiv = document.createElement('div');
      cardsDiv.className = 'cards-container';

      for (let i = 0; i < tryalCount; i++) {
          const cardBtn = document.createElement('button');
          cardBtn.className = 'tryal-card-btn';
          cardBtn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i + 1}</span>`;
          cardBtn.onclick = () => {
              client.state.socket.emit('select blackcat tryal', blackCatHolder, i);
              if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
              if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
          };
          cardsDiv.appendChild(cardBtn);
      }

      popup.appendChild(cardsDiv);
      client.actions.addTryalPopupCollapseControl(popup, overlay, title);
      overlay.appendChild(popup);
      document.body.appendChild(overlay);
  });

  client.state.socket.on('prompt select curse target', ({ targetUniqueId, blueCards }) => {
      // ... popup code ...
      // เมื่อเลือกการ์ดแล้ว
      // ...
      // หลังจากเลือกแล้วให้ disable drawCardButton
      client.dom.drawCardButton.disabled = true;
  });

  client.state.socket.on('card used on you', (senderName, cardName, cardDesc) => {
      console.log('[DEBUG] card used on you', senderName, cardName, cardDesc);
      // Remove existing popup if any
      const old = document.getElementById('card-used-on-you-popup');
      if (old) old.remove();
      
      const popup = document.createElement('div');
      popup.id = 'card-used-on-you-popup';
      popup.style.position = 'fixed';
      popup.style.top = '50%';
      popup.style.left = '50%';
      popup.style.transform = 'translate(-50%, -50%)';
      popup.style.background = '#232323';
      popup.style.color = '#fff';
      popup.style.padding = '28px 24px 18px 24px';
      popup.style.borderRadius = '16px';
      popup.style.boxShadow = '0 0 32px #000a';
      popup.style.zIndex = '99999';
      popup.style.textAlign = 'center';
      popup.style.minWidth = '260px';
      popup.style.maxWidth = '90vw';
      popup.style.fontSize = '1.08em';

      // ปุ่มปิด
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '10px';
      closeBtn.style.right = '14px';
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#fff';
      closeBtn.style.fontSize = '1.3em';
      closeBtn.style.border = 'none';
      closeBtn.style.cursor = 'pointer';
      closeBtn.onclick = () => { if (document.body.contains(popup)) popup.remove(); };
      popup.appendChild(closeBtn);

      // ข้อความ
      const msg = document.createElement('div');
      msg.innerHTML = `<b style='color:#ff9800;'>${senderName}</b> <span style='color:#fff;'>ใช้การ์ดใส่คุณ</span>`;
      msg.style.marginBottom = '10px';
      msg.style.fontWeight = 'bold';
      popup.appendChild(msg);

      // รูปการ์ด
      const cardImg = client.actions.createCardImage(cardName);
      cardImg.style.width = '90px';
      cardImg.style.height = '130px';
      cardImg.style.margin = '0 0 10px 0';
      cardImg.style.display = 'block';
      cardImg.style.marginLeft = 'auto';
      cardImg.style.marginRight = 'auto';
      // --- เพิ่มขอบสีตามประเภทการ์ด ---
      const cardColorMap = {
          'Accusation': 'Red', 'Evidence': 'Red', 'Witness': 'Red',
          'Alibi': 'Green', 'Stocks': 'Green', 'Arson': 'Green', 'Curse': 'Green', 'Scapegoat': 'Green', 'Robbery': 'Green',
          'Black Cat': 'Blue', 'Asylum': 'Blue', 'Piety': 'Blue', 'Matchmaker': 'Blue',
          'Conspiracy': 'Gold',
      };
      const borderColorMap = {
          'Red': '#e53935',
          'Green': '#43a047',
          'Blue': '#1976d2',
          'Gold': '#ffb300',
          'Black': '#333',
      };
      const colorKey = cardColorMap[cardName] || 'Black';
      cardImg.style.border = `3px solid ${borderColorMap[colorKey] || '#333'}`;
      cardImg.style.borderRadius = '8px';
      // ---
      popup.appendChild(cardImg);

      // ชื่อการ์ด
      const cardTitle = document.createElement('div');
      cardTitle.textContent = client.actions.displayCardName(cardName);
      cardTitle.style.color = '#ff9800';
      cardTitle.style.fontWeight = 'bold';
      cardTitle.style.fontSize = '1.1em';
      cardTitle.style.marginBottom = '6px';
      popup.appendChild(cardTitle);

      // คำอธิบายการ์ด
      const desc = document.createElement('div');
      desc.textContent = cardDesc || client.actions.displayCardDescription(cardName);
      desc.style.color = '#fff';
      desc.style.fontSize = '0.98em';
      desc.style.marginBottom = '2px';
      popup.appendChild(desc);

      document.body.appendChild(popup);
      // ปิดอัตโนมัติหลัง 5 วินาที
      const timer = setTimeout(() => { if (document.body.contains(popup)) popup.remove(); }, 5000);
      // ถ้ากดปิดเอง ให้ clearTimeout
      closeBtn.addEventListener('click', () => clearTimeout(timer));
  });
}
