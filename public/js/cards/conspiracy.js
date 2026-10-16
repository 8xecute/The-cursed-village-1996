import { client } from '../core/client.js';



export function initialize() {
  client.state.socket.on('prompt select left tryal', ({ leftPlayerUniqueId, leftPlayerName, leftPlayerTryalCount }) => {
      const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
      if (me && !me.alive) {
          return;
      }
      // Remove any existing popups to prevent overlapping
      const existing = document.getElementById('select-left-tryal-popup');
      if (existing) existing.remove();
      
      const existingOverlay = document.getElementById('select-left-tryal-overlay');
      if (existingOverlay) existingOverlay.remove();
      
      // สร้าง background overlay
      const overlay = document.createElement('div');
      overlay.id = 'select-left-tryal-overlay';
      overlay.className = 'tryal-modal-overlay';

      const popup = document.createElement('div');
      popup.id = 'select-left-tryal-popup';
      popup.dataset.lifeOwner = leftPlayerUniqueId;
      popup.className = 'tryal-selection-popup';

      const title = document.createElement('h3');
      title.textContent = '🔮 พิธีเซ่นไหว้: สุ่มหยิบการ์ดชีวิต';
      popup.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.innerHTML = `หยิบการ์ดชีวิตจากผู้เล่นทางซ้ายมือ: <b style="color:#ffb74d;">${leftPlayerName}</b>`;
      subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
      popup.appendChild(subtitle);

      if (leftPlayerTryalCount === 0) {
          const msg = document.createElement('div');
          msg.textContent = 'ผู้เล่นซ้ายมือไม่มีการ์ดชีวิตให้หยิบ';
          msg.style.color = '#cfd8dc';
          popup.appendChild(msg);
          overlay.appendChild(popup);
          document.body.appendChild(overlay);
          setTimeout(() => {
              if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
              if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
          }, 2000);
          return;
      }

      const cardsDiv = document.createElement('div');
      cardsDiv.className = 'cards-container';

      for (let i = 0; i < leftPlayerTryalCount; i++) {
          const btn = document.createElement('button');
          btn.className = 'tryal-card-btn';
          btn.dataset.lifeIndex = i;
          btn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i + 1}</span>`;
          btn.onclick = () => {
              client.state.socket.emit('select left tryal', i);
              if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
              if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
              setTimeout(() => { client.actions.updateTryalCardDisplay(); }, 300);
          };
          cardsDiv.appendChild(btn);
      }
      popup.appendChild(cardsDiv);

      client.actions.addTryalPopupCollapseControl(popup, overlay, title);
      overlay.appendChild(popup);
      document.body.appendChild(overlay);
  });
}
