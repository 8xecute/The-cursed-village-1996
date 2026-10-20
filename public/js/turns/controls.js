import { client } from '../core/client.js';

client.actions.resetDrawCardButton = function resetDrawCardButton() {
    if (client.state.drawCardPendingTimeout) {
        clearTimeout(client.state.drawCardPendingTimeout);
        client.state.drawCardPendingTimeout = null;
    }
    client.state.drawCardConfirming = false;
    if (client.dom.drawCardButton) {
        client.dom.drawCardButton.classList.remove('confirming');
        client.dom.drawCardButton.innerHTML = '🃏 จั่วการ์ด';
    }
};

client.actions.resetEndTurnButton = function resetEndTurnButton() {
    if (client.state.endTurnPendingTimeout) {
        clearTimeout(client.state.endTurnPendingTimeout);
        client.state.endTurnPendingTimeout = null;
    }
    client.state.endTurnConfirming = false;
    if (client.dom.endTurnButton) {
        client.dom.endTurnButton.classList.remove('confirming');
        client.dom.endTurnButton.innerHTML = '🛑 จบเทิร์น';
    }
};

client.actions.updateTurnUI = function updateTurnUI() {
    const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
    client.dom.drawCardButton.disabled = !client.state.isMyTurn || client.state.drawButtonDisabled;
    client.dom.playCardButton.disabled = !client.state.isMyTurn || !me?.alive || client.state.selectedCard === null;
    client.dom.endTurnButton.disabled = !client.state.isMyTurn || !me || !me.alive || !me.hasPlayedCardsThisTurn;
    if (client.dom.gameActionsDiv) {
        client.dom.gameActionsDiv.style.display = me?.alive && !client.state.currentRoomState?.gameOver ? '' : 'none';
    }
    if (!client.state.isMyTurn) {
        client.actions.clearCardSelection();
        client.actions.resetEndTurnButton();
        client.actions.resetDrawCardButton();
        client.state.drawButtonDisabled = false; // Reset when turn changes
    }
    // เพิ่ม/ลบ class my-turn-active
    if (client.state.isMyTurn) {
        document.querySelector('.main-game-content')?.classList.add('my-turn-active');
        document.querySelector('.hand-action-buttons')?.classList.add('my-turn-active');
    } else {
        document.querySelector('.main-game-content')?.classList.remove('my-turn-active');
        document.querySelector('.hand-action-buttons')?.classList.remove('my-turn-active');
    }
    client.actions.updateDrawCardButton();
};

client.actions.updateDrawCardButton = function updateDrawCardButton() {
    const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
    if (me && me.hasPlayedCardsThisTurn) {
        client.dom.drawCardButton.disabled = true;
        return;
    }
    // Disable draw card button if a card is selected and needs a target
    if (client.state.selectedCard !== null && client.state.myCurrentHand[client.state.selectedCard] && client.state.CARDS_NEED_TARGET.includes(client.state.myCurrentHand[client.state.selectedCard].name) && client.dom.cardTargetSelect && client.dom.cardTargetSelect.value) {
        client.dom.drawCardButton.disabled = true;
    } else if (client.state.isMyTurn && !client.state.drawButtonDisabled) {
        // Don't disable draw button for Night card since it's played after turn ends
        client.dom.drawCardButton.disabled = false;
    } else {
        client.dom.drawCardButton.disabled = true;
    }
};

export function initialize() {
  client.state.drawCardPendingTimeout = null;

  client.state.drawCardConfirming = false;

  client.dom.drawCardButton.addEventListener('click', () => {
      const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
      if (me && !me.alive) {
          client.actions.addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
          client.actions.resetDrawCardButton();
          return;
      }
      if (!client.state.isMyTurn) {
          client.actions.addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
          client.actions.resetDrawCardButton();
          return;
      }
      if (me && me.hasPlayedCardsThisTurn) {
          client.actions.addGameMessage('คุณได้เล่นการ์ดไปแล้วในเทิร์นนี้ คุณต้องจบเทิร์น.', 'red');
          client.actions.resetDrawCardButton();
          return;
      }

      // First tap: prompt confirmation with countdown reset
      if (!client.state.drawCardConfirming) {
          client.state.drawCardConfirming = true;
          client.dom.drawCardButton.classList.add('confirming');
          client.dom.drawCardButton.innerHTML = '⚠️ แตะยืนยันจั่ว?';
          if (client.state.drawCardPendingTimeout) clearTimeout(client.state.drawCardPendingTimeout);
          client.state.drawCardPendingTimeout = setTimeout(() => {
              client.actions.resetDrawCardButton();
          }, 3500);
          return;
      }

      // Second tap: confirmed draw cards
      client.actions.resetDrawCardButton();
      client.state.socket.emit('draw cards');
  });

  client.dom.playCardButton.addEventListener('click', () => {
      if (document.querySelector('.select-player-modal')) return;
      const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
      if (me && !me.alive) {
          client.actions.addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
          return;
      }
      if (!client.state.isMyTurn) {
          client.actions.addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
          return;
      }
      if (client.state.selectedCard === null) {
          client.actions.addGameMessage('กรุณาเลือกการ์ดก่อน.', 'red');
          return;
      }
      const card = client.state.myCurrentHand[client.state.selectedCard];
      if (!card) { client.actions.clearCardSelection(); return; }
      const redBatch=client.actions.selectedRedBatch();
      if(card.color==='Red' && redBatch.length) {
          const indexes=[...redBatch],points=client.actions.selectedRedPoints();
          const players=Object.values(client.state.currentRoomState.players).filter(player=>player.alive&&player.uniqueId!==client.state.myUniqueId);
          client.actions.showSelectPlayerPopup(`การ์ดแดง ${indexes.length} ใบ · ${points} แต้ม`,players,targetId=>{
              client.state.socket.emit('play red cards',indexes,targetId);
              client.actions.clearCardSelection();client.dom.drawCardButton.disabled=true;
          },{...card,value:points,batchPoints:points});
          return;
      }
      let targetUniqueId = null;
      let secondTargetUniqueId = null;
      if (client.state.CARDS_NEED_TWO_TARGETS.includes(card.name)) {
          // --- Popup เลือกเป้าหมายแรก ---
          const playerList = Object.values(client.state.currentRoomState.players).filter(p => p.alive && p.uniqueId !== client.state.myUniqueId);
          client.actions.showSelectPlayerPopup('1/2 · เลือกต้นทาง', playerList, (firstId) => {
              // --- Popup เลือกเป้าหมายที่สอง ---
              const secondList = playerList.filter(p => p.uniqueId !== firstId);
              const sourceName = client.state.currentRoomState.players[firstId]?.name || 'ต้นทาง';
              client.actions.showSelectPlayerPopup(`2/2 · รับการ์ดจาก ${sourceName}`, secondList, (secondId) => {
                  client.state.socket.emit('play card', client.state.selectedCard, firstId, secondId);
                  client.actions.clearCardSelection();
                  // --- Disable draw after playing card ---
                  client.dom.drawCardButton.disabled = true;
              }, card);
          }, card);
          return;
      }
      if (client.state.CARDS_NEED_TARGET.includes(card.name)) {
          // --- Popup เลือกเป้าหมาย ---
          const playerList = Object.values(client.state.currentRoomState.players).filter(p => p.alive && p.uniqueId !== client.state.myUniqueId);
          client.actions.showSelectPlayerPopup('เลือกเป้าหมาย', playerList, (targetId) => {
              client.state.socket.emit('play card', client.state.selectedCard, targetId, null);
              client.actions.clearCardSelection();
              client.dom.drawCardButton.disabled = true;
          }, card);
          return;
      }
      if (card.name === 'Curse') {
          // Disable draw after playing Curse
          client.dom.drawCardButton.disabled = true;
      }
      client.state.socket.emit('play card', client.state.selectedCard, null, null);
      client.actions.clearCardSelection();
      // --- Disable draw after playing card (ทั่วไป) ---
      client.dom.drawCardButton.disabled = true;
  });

  client.state.endTurnPendingTimeout = null;

  client.state.endTurnConfirming = false;

  client.dom.endTurnButton.addEventListener('click', () => {
      const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
      if (me && !me.alive) {
          client.actions.addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
          client.actions.resetEndTurnButton();
          return;
      }
      if (!client.state.isMyTurn) {
          client.actions.addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
          client.actions.resetEndTurnButton();
          return;
      }
      if (!me || !me.hasPlayedCardsThisTurn) {
          client.actions.addGameMessage('คุณต้องเลือกจั่วการ์ด 2 ใบ หรือเล่นการ์ดก่อนจบเทิร์น', 'red');
          client.actions.resetEndTurnButton();
          return;
      }
      
      // First tap: prompt confirmation with countdown reset
      if (!client.state.endTurnConfirming) {
          client.state.endTurnConfirming = true;
          client.dom.endTurnButton.classList.add('confirming');
          client.dom.endTurnButton.innerHTML = '⚠️ แตะยืนยัน?';
          if (client.state.endTurnPendingTimeout) clearTimeout(client.state.endTurnPendingTimeout);
          client.state.endTurnPendingTimeout = setTimeout(() => {
              client.actions.resetEndTurnButton();
          }, 3500);
          return;
      }

      // Second tap: confirmed end turn
      client.actions.resetEndTurnButton();
      client.state.socket.emit('end turn');
      client.actions.clearCardSelection();
  });

  client.dom.confessButton.addEventListener('click', () => {
      if (client.state.currentRoomName) {
          if (client.state.currentRoomState && client.state.currentRoomState.currentPhase === 'PRE_DAWN') {
              // For PRE_DAWN confession, prompt for card selection
              const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${client.state.myTryalCards.length}):`);
              const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
              if (!isNaN(index) && index >= 0 && index < client.state.myTryalCards.length) {
                  client.state.socket.emit('confess during night', index);
              } else {
                  client.actions.addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
              }
          } else if (client.state.currentRoomState && client.state.currentRoomState.currentPhase === 'DAY' && client.state.currentRoomState.playerForcedToRevealTryal === client.state.myUniqueId) {
              // For DAY forced reveal, prompt for card selection
              const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${client.state.myTryalCards.length}):`);
              const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
              if (!isNaN(index) && index >= 0 && index < client.state.myTryalCards.length) {
                  client.state.socket.emit('reveal tryal card', index);
          } else {
                  client.actions.addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
          }
      } else {
              // Legacy confession (should not be used anymore)
              const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${client.state.myTryalCards.length}):`);
              const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
              if (!isNaN(index) && index >= 0 && index < client.state.myTryalCards.length) {
                  client.state.socket.emit('confess tryal card', index);
              } else {
                  client.actions.addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
              }
          }
      }
  });

  client.dom.skipConfessButton = document.getElementById('skip-confess-button');

  client.dom.skipConfessButton.addEventListener('click', () => {
      const me = client.state.currentRoomState && client.state.currentRoomState.players && client.state.currentRoomState.players[client.state.myUniqueId];
      if (me && !me.alive) {
          client.actions.addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
          return;
      }
      if (client.state.currentRoomName) {
          client.state.socket.emit('skip confession');
      }
  });

  client.dom.confirmBlackCatButton.addEventListener('click', () => {
      const targetUniqueId = client.dom.blackCatTargetSelect.value;
      if (targetUniqueId) {
          client.state.socket.emit('assign black cat', targetUniqueId);
          // Hide the UI after selection
          client.dom.witchActionSection.style.display = 'none';
          client.dom.assignBlackCatAction.style.display = 'none';
      } else {
          client.actions.addGameMessage('โปรดเลือกผู้เล่นที่จะรับการ์ดเครื่องเซ่น.', 'red');
      }
  });

  client.dom.confirmNightActionButton = document.getElementById('confirm-night-action-button');

  client.dom.confirmNightActionButton.addEventListener('click', () => {
      if (!client.state.nightActionState.isSelecting || !client.state.nightActionState.selectedTargetId) {
          client.actions.addGameMessage('โปรดเลือกเป้าหมายก่อน.', 'red');
          return;
      }

      if (client.state.nightActionState.actionType === 'constable') {
          client.state.socket.emit('constable action', client.state.nightActionState.selectedTargetId);
          client.actions.addGameMessage('คุณได้เลือกที่จะปกป้องเป้าหมายแล้ว', 'green');
      } else if (client.state.nightActionState.actionType === 'witch') {
          client.actions.submitNightAction('witch');
          return;
      }

      // Hide UI and reset state after confirming
      client.actions.disableNightTargetSelection();
  });
}
