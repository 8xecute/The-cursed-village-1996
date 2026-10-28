import { client } from '../core/client.js';

client.actions.addWitchChatMessage = function addWitchChatMessage(senderName, message, timestamp) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'witch-chat-message';
    msgDiv.classList.toggle('is-system', senderName === 'SYSTEM');
    const sender = document.createElement('strong'); sender.className = 'sender'; sender.textContent = senderName === 'SYSTEM' ? 'ระบบ' : senderName;
    const body = document.createElement('div'); body.className = 'message'; body.textContent = senderName === 'SYSTEM' ? String(message).replace(/<\/?b>/g, '') : message;
    const time = document.createElement('small'); time.className = 'timestamp'; time.textContent = client.actions.formatTime(timestamp);
    msgDiv.append(sender, body, time);
    if (client.dom.witchChatMessages) {
        client.dom.witchChatMessages.appendChild(msgDiv);
        client.dom.witchChatMessages.scrollTop = client.dom.witchChatMessages.scrollHeight;
    }
    const modalChatMessages = document.getElementById('modal-witch-chat-messages');
    if (modalChatMessages) {
        const modalMsg = msgDiv.cloneNode(true);
        modalChatMessages.appendChild(modalMsg);
        modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
    }
    if (client.state.currentMobileGameTab !== 'chat' && client.dom.tabChatBadge) {
        client.dom.tabChatBadge.style.display = 'inline-block';
    }
};

client.actions.formatTime = function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

client.actions.sendWitchChatMessage = function sendWitchChatMessage() {
    const message = client.dom.witchChatInput.value.trim();
    if (message && client.state.currentRoomName) {
        if (!client.state.currentRoomState || client.state.currentRoomState.currentPhase !== 'NIGHT') {
            client.actions.addGameMessage('แชทปอบใช้งานได้เฉพาะช่วงกลางคืนเท่านั้น', 'orange');
            return;
        }
        client.state.socket.emit('send witch chat message', client.state.currentRoomName, message);
        client.dom.witchChatInput.value = '';
    }
};

client.actions.updateWitchChatVisibility = function updateWitchChatVisibility(isWitch) {
    const myPlayer = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
    const isNight = client.state.currentRoomState && client.state.currentRoomState.currentPhase === 'NIGHT';
    if (isWitch && client.state.currentRoomName && isNight) {
        client.dom.witchChatSection.style.display = 'block';
        const historyKey = `${client.state.currentRoomName}:${client.state.currentRoomState.dayNumber}`;
        if (client.state.witchChatHistoryKey !== historyKey) {
            client.state.witchChatHistoryKey = historyKey;
            client.state.socket.emit('request witch chat history', client.state.currentRoomName);
        }
        // ปรับปุ่มส่งข้อความและ input: ปล่อยให้ใช้งานได้เฉพาะถ้ายังมีชีวิต
        if (myPlayer && myPlayer.alive) {
        client.dom.witchChatInput.disabled = false;
        client.dom.witchChatSendButton.disabled = false;
        client.dom.witchChatInput.placeholder = '';
        } else {
            client.dom.witchChatInput.disabled = true;
            client.dom.witchChatSendButton.disabled = true;
            client.dom.witchChatInput.placeholder = 'คุณตายแล้ว ไม่สามารถส่งข้อความได้';
        }
    } else {
        client.dom.witchChatSection.style.display = 'none';
    }
};

client.actions.updateWitchChatTeamList = function updateWitchChatTeamList() {
  const witchTeamDiv = document.getElementById('witch-team-list');
  if (!witchTeamDiv) return;
  if (!client.state.currentRoomState || !client.state.currentRoomState.players) {
    witchTeamDiv.innerHTML = '';
    return;
  }
  const witches = Object.values(client.state.currentRoomState.players).filter(p => p.hasBeenWitch);
  witchTeamDiv.innerHTML = '<b>ทีมปอบ:</b> ' + witches.map(p => p.isWitch ? `<span style="color:#ff1744;font-weight:bold;">${p.name}</span>` : `<span style="color:#ffd700;">${p.name}</span>`).join(', ');
};

export function initialize() {
  client.state.socket.on('connect', () => { client.state.witchChatHistoryKey = null; });
  client.state.socket.on('room left', () => {
      client.state.witchChatHistoryKey = null;
      client.dom.witchChatMessages.replaceChildren();
      client.dom.witchChatInput.value = '';
  });
  client.dom.witchChatSendButton.addEventListener('click', client.actions.sendWitchChatMessage);

  client.dom.witchChatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          client.actions.sendWitchChatMessage();
      }
  });
}
