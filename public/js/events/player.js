import { client } from '../core/client.js';



export function initialize() {
  client.state.socket.on('your turn', () => {
      client.state.isMyTurn = true;
      client.state.hasPlayedCardsThisTurn = false;
      client.state.hasDrawnCardThisTurn = false;
      client.actions.updateTurnUI();
      if (window.innerWidth <= 768) client.actions.switchMobileGameTab('hand');
      // Reset forced reveal flag
      client.state.forcedRevealJustHappened = false;
      client.dom.drawCardButton.disabled = false;
  });

  client.state.socket.on('disable draw button', () => {
      client.state.drawButtonDisabled = true;
      client.actions.updateDrawCardButton();
  });

  client.state.socket.on('enable draw button', () => {
      client.state.drawButtonDisabled = false;
      client.actions.updateDrawCardButton();
  });

  client.state.socket.on('update hand', (hand) => {
      client.state.myCurrentHand = hand;
      client.actions.updateHandDisplay(client.state.myCurrentHand);
      if (client.state.isMyTurn && !client.state.hasDrawnCardThisTurn && hand.length > client.state.myCurrentHand.length) {
          client.state.hasDrawnCardThisTurn = true;
          client.actions.updateTurnUI();
      }
  });

  client.state.prevTryalCards = [];


  client.state.socket.on('update tryal cards initial', (tryalCards, fromName) => {
      const prevHadWitch = client.state.prevTryalCards.some(card => card.name === 'Witch');
      const newHasWitch = tryalCards.some(card => card.name === 'Witch');
      const myPlayer = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
      const isAssigningBlackCat = client.state.currentRoomState && client.state.currentRoomState.isAssigningBlackCat;
      if (!prevHadWitch && newHasWitch && myPlayer && myPlayer.hasBeenWitch && !isAssigningBlackCat) {
          client.actions.showWitchPopup(fromName || '...');
      }
      client.state.prevTryalCards = tryalCards.slice();
      client.state.myTryalCards = tryalCards;
      client.actions.updateTryalCardDisplay();
      if (myPlayer) client.actions.updateWitchChatVisibility(myPlayer.hasBeenWitch);

      // If reconnected during PRE_DAWN confession turn, restore popup if not already showing
      if (
          client.state.currentRoomState &&
          client.state.currentRoomState.currentPhase === 'PRE_DAWN' &&
          myPlayer && myPlayer.alive &&
          (!client.state.currentRoomState.confessionActions || !client.state.currentRoomState.confessionActions.includes(client.state.myUniqueId)) &&
          (!client.state.currentRoomState.nightConfessors || !client.state.currentRoomState.nightConfessors.includes(client.state.myUniqueId)) &&
          client.state.currentRoomState.confessionOrder &&
          client.state.currentRoomState.confessionOrder[client.state.currentRoomState.currentConfessionIndex] === client.state.myUniqueId &&
          client.state.myTryalCards && client.state.myTryalCards.length > 0 &&
          !document.getElementById('confess-popup')
      ) {
          const isProtectedByConstable = client.state.currentRoomState.playersWhoActedAtNight && 
              client.state.currentRoomState.playersWhoActedAtNight['constableSave'] === client.state.myUniqueId;
          const hasAsylum = myPlayer.inPlayCards && 
              myPlayer.inPlayCards.some(card => card.name === 'Asylum');
          if (!isProtectedByConstable && !hasAsylum) {
              client.actions.showConfessPopup(client.state.myTryalCards);
              client.state.confessPopupShownForThisPreDawn = true;
          }
      }
  });

  client.state.socket.on('show witch popup', (data) => {
      client.actions.showWitchPopup(data.senderName || '...');
  });

  client.state.socket.on('update revealed tryal indexes', (revealedIndexes) => {
      client.state.myRevealedTryalCardIndexes = revealedIndexes;
      client.actions.updateTryalCardDisplay();
  });

  client.state.socket.on('update in play cards', (inPlayCards) => {
      console.log('In-play cards updated:', inPlayCards);
      if (client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId]) {
          client.state.currentRoomState.players[client.state.myUniqueId].inPlayCards = inPlayCards;
          client.actions.updatePlayersGrid(client.state.currentRoomState, client.state.myUniqueId, client.state.nightActionState.actionType);
          client.actions.updatePlayersBoardGrid(client.state.currentRoomState, client.state.myUniqueId);
      }
  });

  client.state.socket.on('prompt witch kill', () => {
      client.state.nightActionState.hasSubmitted = false;
      client.actions.createNightActionPopup('witch');
  });

  client.state.socket.on('prompt constable action', () => {
      client.state.nightActionState.hasSubmitted = false;
      client.state.nightActionState.selectedTargetId = null;
      client.actions.createNightActionPopup('constable');
  });

  client.state.socket.on('deck info update', (deckInfo) => {
      console.log('[DEBUG] deck info update:', deckInfo);
      client.dom.deckCountDisplay.textContent = deckInfo.deckCount;
      client.dom.discardPileCountDisplay.textContent = deckInfo.discardPileCount;
  });

  client.state.socket.on('witch chat message', (senderName, message, timestamp) => {
      client.actions.addWitchChatMessage(senderName, message, timestamp);
  });

  client.state.socket.on('witch chat history', (messages) => {
      // ลบข้อความเก่าก่อน append ใหม่
      client.dom.witchChatMessages.innerHTML = '';
      document.getElementById('modal-witch-chat-messages')?.replaceChildren();
      messages.forEach(msg => {
          client.actions.addWitchChatMessage(msg.senderName, msg.message, msg.timestamp);
      });
  });
}
