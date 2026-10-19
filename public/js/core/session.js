import { client } from './client.js';



export function initialize() {
  client.state.myUniqueId = localStorage.getItem('uniqueId');

  client.state.myPlayerName = null;
  try { localStorage.removeItem('playerName'); } catch (_) { /* Storage may be disabled. */ }
  client.dom.nameInput.value = '';
  client.dom.newRoomNameInput.value = '';

  client.state.currentRoomName = (function() { try { return sessionStorage.getItem('currentRoomName'); } catch(e) { return null; } })();

  client.state.myCurrentHand = [];

  client.state.myTryalCards = [];

  client.state.myRevealedTryalCardIndexes = [];

  client.state.selectedCard = null;

  client.state.currentRoomState = null;

  client.state.confessPopupShownForThisPreDawn = false;

  client.state.lastConfessPhase = null;

  client.state.lastConfessDay = null;

  client.state.isMyTurn = false;

  client.state.hasPlayedCardsThisTurn = false;

  client.state.drawButtonDisabled = false;

  client.state.deathNotified = false;

  client.state.CARDS_NEED_TARGET = ['Accusation', 'Evidence', 'Witness', 'Curse', 'Alibi', 'Stocks', 'Arson', 'Asylum', 'Piety', 'Matchmaker', 'Black Cat'];

  client.state.CARDS_NEED_TWO_TARGETS = ['Scapegoat', 'Robbery'];

  client.state.nightActionState = {
      isSelecting: false,
      actionType: null, // 'constable' or 'witch'
      selectedTargetId: null,
      hasSubmitted: false // เพิ่ม flag นี้
  };

  if (!client.state.myUniqueId) {
      client.state.myUniqueId = client.actions.uuidv4();
      localStorage.setItem('uniqueId', client.state.myUniqueId);
  }

  client.dom.playerUniqueIdDisplay.textContent = client.state.myUniqueId;

  client.dom.musicVolumeSlider.value = Math.round(client.state.currentVolume * 100);

  client.actions.setMusicVolume(client.state.currentVolume);

  client.state.urlParams = new URLSearchParams(window.location.search);

  client.state.roomFromUrl = client.state.urlParams.get('room') ? client.state.urlParams.get('room').trim() : null;

  if (client.state.roomFromUrl) {
      if (client.dom.joinRoomNameInput) {
          client.dom.joinRoomNameInput.value = client.state.roomFromUrl;
      }
      if (client.dom.invitedRoomBanner && client.dom.invitedRoomName) {
          client.dom.invitedRoomName.textContent = client.state.roomFromUrl;
          client.dom.invitedRoomBanner.style.display = 'block';
      }
  }

  if (client.state.myPlayerName) {
      client.dom.playerNameDisplay.textContent = client.state.myPlayerName;
      client.dom.nameInput.value = client.state.myPlayerName;
      client.dom.nameInputContainer.style.display = 'none'; // Hide name input if already set
      client.state.socket.emit('set player name', client.state.myPlayerName); // Send name to server on load
  } else {
      client.dom.nameInputContainer.style.display = 'flex';
      client.dom.nameInput.placeholder = 'กรอกชื่อของคุณ';
  }
}
