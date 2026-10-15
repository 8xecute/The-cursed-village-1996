import { client } from './client.js';



export function initialize() {
  client.dom.nameInputContainer = document.getElementById('name-input-container');

  client.dom.nameInput = document.getElementById('name-input');

  client.dom.setNameButton = document.getElementById('set-name-button');

  client.dom.playerNameDisplay = document.getElementById('player-name-display');

  client.dom.playerUniqueIdDisplay = document.getElementById('player-unique-id-display');

  client.dom.currentRoomDisplay = document.getElementById('current-room-display');

  client.dom.roomManagementSection = document.getElementById('room-management-section');

  client.dom.newRoomNameInput = document.getElementById('new-room-name-input');

  client.dom.createRoomButton = document.getElementById('create-room-button');

  client.dom.joinRoomNameInput = document.getElementById('join-room-name-input');

  client.dom.joinRoomButton = document.getElementById('join-room-button');

  client.dom.activeRoomsList = document.getElementById('active-rooms-list');

  client.dom.leaveRoomButton = document.getElementById('leave-room-button');

  client.dom.roomLobbySection = document.getElementById('room-lobby-section');

  client.dom.lobbyRoomName = document.getElementById('lobby-room-name');

  client.dom.lobbyPlayerCount = document.getElementById('lobby-player-count');

  client.dom.lobbyMaxPlayers = document.getElementById('lobby-max-players');

  client.dom.playerListDiv = document.getElementById('player-list');

  client.dom.startGameButton = document.getElementById('start-game-button');

  client.dom.readyToggleBtn = document.getElementById('ready-toggle-btn');

  if (client.dom.readyToggleBtn) {
      client.dom.readyToggleBtn.addEventListener('click', () => {
          if (client.state.currentRoomName) {
              client.state.socket.emit('toggle ready', client.state.currentRoomName);
          }
      });
  }

  client.dom.hostControlsLobby = document.getElementById('host-controls-lobby');

  client.dom.addBotButton = document.getElementById('add-bot-button');

  if (client.dom.addBotButton) {
      client.dom.addBotButton.addEventListener('click', () => {
          if (client.state.currentRoomName) client.state.socket.emit('add bot', client.state.currentRoomName);
      });
  }

  client.dom.forceNextPhaseButton = document.getElementById('force-next-phase-button');

  client.dom.shareRoomLinkBtn = document.getElementById('share-room-link-btn');

  client.dom.copyRoomLinkHeaderBtn = document.getElementById('copy-room-link-header-btn');

  client.dom.shareLinkToast = document.getElementById('share-link-toast');

  client.dom.invitedRoomBanner = document.getElementById('invited-room-banner');

  client.dom.invitedRoomName = document.getElementById('invited-room-name');

  client.dom.gameSection = document.getElementById('game-section');

  client.dom.currentPhaseDisplay = document.getElementById('current-phase-display');

  client.dom.dayNumberDisplay = document.getElementById('day-number-display');

  client.dom.currentTurnPlayerDisplay = document.getElementById('current-turn-player-display');

  client.dom.deckCountDisplay = document.getElementById('deck-count-display');

  client.dom.discardPileCountDisplay = document.getElementById('discard-pile-count-display');

  client.dom.waitingStatusBanner = document.getElementById('waiting-status-banner');

  client.dom.handCardCount = document.getElementById('hand-card-count');

  client.dom.playerHandDiv = document.getElementById('player-hand');

  new MutationObserver(() => client.actions.syncTable3D()).observe(client.dom.playerHandDiv, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class'],
  });

  client.dom.tryalCardsDisplay = document.getElementById('tryal-cards-display');

  client.dom.mySecretTryalCardsCount = document.getElementById('my-secret-tryal-cards-count');

  client.dom.myRoleDisplay = document.getElementById('my-role-display');

  client.dom.gameActionsDiv = document.querySelector('.hand-action-buttons');

  client.dom.drawCardButton = document.getElementById('draw-card-button');

  client.dom.playCardButton = document.getElementById('play-card-button');

  client.dom.endTurnButton = document.getElementById('end-turn-button');

  client.dom.cardTargetSelect = document.getElementById('card-target-select');

  client.dom.cardSecondTargetSelect = document.getElementById('card-second-target-select');

  client.dom.hostControlsGame = document.getElementById('host-controls-game');

  client.dom.forceNextPhaseGameButton = document.getElementById('force-next-phase-game-button');

  client.dom.turnControlsDiv = document.getElementById('turn-controls');

  client.dom.confessSection = document.getElementById('confess-section');

  client.dom.confessButton = document.getElementById('confess-button');

  client.dom.gameMessagesDiv = document.getElementById('game-messages');

  client.dom.cardDescriptionPopup = document.getElementById('card-description-popup');

  client.dom.witchChatSection = document.getElementById('witch-chat-section');

  client.dom.witchChatMessages = document.getElementById('witch-chat-messages');

  client.dom.witchChatInput = document.getElementById('witch-chat-input');

  client.dom.witchChatSendButton = document.getElementById('witch-chat-send');

  client.dom.witchActionSection = document.getElementById('witch-action-section');

  client.dom.assignBlackCatAction = document.getElementById('assign-black-cat-action');

  client.dom.blackCatTargetSelect = document.getElementById('black-cat-target-select');

  client.dom.confirmBlackCatButton = document.getElementById('confirm-black-cat-button');
}
