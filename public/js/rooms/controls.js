import { client } from '../core/client.js';

client.actions.copyRoomShareLink = function copyRoomShareLink() {
    const roomName = client.state.currentRoomName || (client.dom.joinRoomNameInput ? client.dom.joinRoomNameInput.value.trim() : '') || client.state.roomFromUrl;
    if (!roomName) {
        client.actions.addGameMessage('ยังไม่ได้อยู่ในห้อง ไม่สามารถคัดลอกลิงก์ได้', 'red', true);
        return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`;

    const onCopied = () => {
        if (client.dom.shareLinkToast) {
            client.dom.shareLinkToast.style.display = 'block';
            setTimeout(() => {
                client.dom.shareLinkToast.style.display = 'none';
            }, 3000);
        }
        client.actions.addGameMessage(`คัดลอกลิงก์ห้อง "${roomName}" แล้ว: ${shareUrl}`, 'green', true);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(onCopied).catch(() => {
            client.actions.fallbackCopy(shareUrl, onCopied);
        });
    } else {
        client.actions.fallbackCopy(shareUrl, onCopied);
    }
};

client.actions.fallbackCopy = function fallbackCopy(text, onSuccess) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (onSuccess) onSuccess();
    } catch (e) {
        prompt('คัดลอกลิงก์ด้านล่างเพื่อชวนเพื่อนเข้าห้อง:', text);
    }
    document.body.removeChild(textArea);
};

client.actions.handleForceNextPhase = function handleForceNextPhase() {
    if (client.state.currentRoomName) {
        client.state.socket.emit('force next phase', client.state.currentRoomName);
    }
    };

export function initialize() {
  if (client.dom.shareRoomLinkBtn) {
      client.dom.shareRoomLinkBtn.addEventListener('click', client.actions.copyRoomShareLink);
  }

  if (client.dom.copyRoomLinkHeaderBtn) {
      client.dom.copyRoomLinkHeaderBtn.addEventListener('click', client.actions.copyRoomShareLink);
  }

  client.dom.createRoomButton.addEventListener('click', () => {
      const roomName = client.dom.newRoomNameInput.value.trim();
      if (roomName && client.state.myPlayerName) {
          client.state.socket.emit('create room', roomName, client.state.myPlayerName);
      } else {
          client.actions.addGameMessage('โปรดป้อนชื่อห้องและชื่อผู้เล่นของคุณ.', 'red');
      }
  });


  client.dom.leaveRoomButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากห้อง?')) {
      client.state.socket.emit('leave room');
    }
  });

  client.dom.startGameButton.addEventListener('click', () => {
      if (client.state.currentRoomName) {
          client.state.socket.emit('start game', client.state.currentRoomName);
      }
  });

  client.dom.forceNextPhaseButton.addEventListener('click', client.actions.handleForceNextPhase);

  client.dom.forceNextPhaseGameButton.addEventListener('click', client.actions.handleForceNextPhase);
}
