// turns: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function setNextTurn(room, fromPlayerUniqueId = null, forceFromPlayer = false) {
      const alivePlayers = game.getAlivePlayers(room);
      if (alivePlayers.length === 0) {
          game.sendGameMessage(room.name, "No players left.", 'grey', true);
          game.checkWinCondition(room); // Should already be handled but a fallback
          return;
      }

      let nextPlayerUniqueId = null;

      // Check for Black Cat holder starting first if it's the start of a DAY phase
      if (!forceFromPlayer && room.currentPhase === 'DAY' && room.dayNumber > 0 && room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
          // If Black Cat holder exists and is alive, they start the day
          if (!room.blackCatHolderAlreadyActedThisDay) { // Ensure they only start once per day
              nextPlayerUniqueId = room.blackCatHolder;
              room.blackCatHolderAlreadyActedThisDay = true;
          }
      }

      // If no Black Cat holder or they already acted, proceed normally
      if (!nextPlayerUniqueId) {
          const baseTurnUniqueId = forceFromPlayer && fromPlayerUniqueId
              ? fromPlayerUniqueId
              : room.currentTurnPlayerUniqueId;
          const currentTurnIndex = alivePlayers.findIndex(p => p.uniqueId === baseTurnUniqueId);
          let nextTurnIndex = (currentTurnIndex + 1) % alivePlayers.length;
          if (forceFromPlayer && currentTurnIndex === -1) {
              const order = Object.values(room.players);
              const base = order.findIndex(player => player.uniqueId === baseTurnUniqueId);
              if (base !== -1) {
                  const nextAlive = [...order.slice(base + 1), ...order.slice(0, base)].find(player => player.alive);
                  if (nextAlive) nextTurnIndex = alivePlayers.findIndex(player => player.uniqueId === nextAlive.uniqueId);
              }
          }
          let nextPlayer = alivePlayers[nextTurnIndex];

          // Skip eliminated or silenced players for regular turns
          let attempts = 0;
          const maxAttempts = alivePlayers.length * 2; // Prevent infinite loops
          while ((!nextPlayer.alive || nextPlayer.isSilenced) && attempts < maxAttempts) {
              // ถ้าโดน Stocks ให้ลบทีละใบ
              if (nextPlayer.isSilenced) {
                  const stocksIndex = nextPlayer.inPlayCards.findIndex(card => card.name === 'Stocks');
                  if (stocksIndex !== -1) {
                      // Remove one Stocks card
                      const removed = nextPlayer.inPlayCards.splice(stocksIndex, 1)[0];
                      room.discardPile.push(removed);
                      game.io.to(nextPlayer.id).emit('update in play cards', nextPlayer.inPlayCards);
                  }
                  // Check if still has Stocks
                  if (!nextPlayer.inPlayCards.some(card => card.name === 'Stocks')) {
                      nextPlayer.isSilenced = false;
                  }
              }
              nextTurnIndex = (nextTurnIndex + 1) % alivePlayers.length;
              nextPlayer = alivePlayers[nextTurnIndex];
              attempts++;
          }

          if (attempts >= maxAttempts) {
              game.changePhase(room.name); // No one can play, advance phase
              return;
          }
          nextPlayerUniqueId = nextPlayer.uniqueId;
      }

      room.currentTurnPlayerUniqueId = nextPlayerUniqueId;
      const nextPlayer = room.players[nextPlayerUniqueId];
      
      // ตรวจสอบว่าการ์ดในมือหมดหรือไม่ในช่วงกลางวัน
      if (room.currentPhase === 'DAY' && nextPlayer.hand.length === 0) {
          // จั่วการ์ดให้อัตโนมัติ 2 ใบ
          game.sendGameMessage(room.name, `<b>${nextPlayer.name}</b> ไม่มีการ์ดในมือ ระบบจั่วการ์ดให้อัตโนมัติ`, 'blue', true);
          
          let drewAnyCard = false;
          for (let i = 0; i < 2; i++) {
              if (room.gameDeck.length > 0) {
                  const card = room.gameDeck.shift();
                  if (card.type === 'Event') {
                      // Handle Event cards
                      switch (card.name) {
                          case 'Conspiracy':
                              room.conspiracyDrawer = nextPlayerUniqueId;
                              if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                                  const bcHolder = room.players[room.blackCatHolder];
                                  if (bcHolder.tryalCards.length > 0) {
                                      room.awaitingConspiracySelection = {
                                          selector: nextPlayerUniqueId,
                                          target: room.blackCatHolder,
                                          tryalCount: bcHolder.tryalCards.length
                                      };
                                      game.sendGameMessage(room.name, `จั่วได้การ์ด ${game.getCardNameWithColor('Conspiracy')}`, 'orange', true);
                                      game.io.to(nextPlayer.id).emit('prompt select blackcat tryal', {
                                          blackCatHolder: room.blackCatHolder,
                                          tryalCount: bcHolder.tryalCards.length,
                                          blackCatHolderName: bcHolder.name
                                      });
                                      room.discardPile.push(card);
                                      // Don't proceed to next turn until selection is complete
                                      return;
                                  }
                              }
                              game.promptTryalCardSelectionToLeft(room.name);
                              room.discardPile.push(card);
                              // Don't proceed to next turn until selection is complete
                              return;
                          case 'Night':
                              room.nightCardDrawer = nextPlayerUniqueId;
                              game.sendGameMessage(room.name, `<b>${nextPlayer.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Night')}`, 'orange', true);
                              room.discardPile.push(card);
                              game.changePhase(room.name, 'NIGHT');
                              return;
                      }
                  } else {
                      nextPlayer.hand.push(card);
                      drewAnyCard = true;
                  }
              } else {
                  // Reshuffle discard pile
                  const nightCards = room.discardPile.filter(card => card.name === 'Night');
                  const otherCards = room.discardPile.filter(card => card.name !== 'Night');
                  room.gameDeck = game.shuffleArray([...otherCards]);
                  room.discardPile = [];
                  if (nightCards.length > 0) {
                      room.gameDeck = room.gameDeck.concat(nightCards);
                  }
                  if (room.gameDeck.length > 0) {
                      const card = room.gameDeck.shift();
                      if (card.type === 'Event') {
                          // Handle Event cards (same as above)
                          switch (card.name) {
                              case 'Conspiracy':
                              room.conspiracyDrawer = nextPlayerUniqueId;
                                  if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                                      const bcHolder = room.players[room.blackCatHolder];
                                      if (bcHolder.tryalCards.length > 0) {
                                          room.awaitingConspiracySelection = {
                                              selector: nextPlayerUniqueId,
                                              target: room.blackCatHolder,
                                              tryalCount: bcHolder.tryalCards.length
                                          };
                                          game.sendGameMessage(room.name, `จั่วได้การ์ด ${game.getCardNameWithColor('Conspiracy')}`, 'orange', true);
                                          game.io.to(nextPlayer.id).emit('prompt select blackcat tryal', {
                                              blackCatHolder: room.blackCatHolder,
                                              tryalCount: bcHolder.tryalCards.length,
                                              blackCatHolderName: bcHolder.name
                                          });
                                          room.discardPile.push(card);
                                          // Don't proceed to next turn until selection is complete
                                          return;
                                      }
                                  }
                                  game.promptTryalCardSelectionToLeft(room.name);
                                  room.discardPile.push(card);
                                  // Don't proceed to next turn until selection is complete
                                  return;
                              case 'Night':
                                  room.nightCardDrawer = nextPlayerUniqueId;
                                  game.sendGameMessage(room.name, `<b>${nextPlayer.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Night')}`, 'orange', true);
                                  room.discardPile.push(card);
                                  game.changePhase(room.name, 'NIGHT');
                                  return;
                          }
                      } else {
                          nextPlayer.hand.push(card);
                          drewAnyCard = true;
                      }
                  } else {
                      break;
                  }
              }
          }
          
          game.io.to(nextPlayer.id).emit('update hand', nextPlayer.hand);
          game.emitRoomState(room.name);
          game.sendDeckInfo(room.name);
          // หลังจั่วอัตโนมัติแล้วจบเทิร์นทันที
          game.setNextTurn(room);
          return;
      }
      
      // ส่ง your turn event ไปยังผู้เล่นถัดไป (ไม่ว่าจะจั่วอัตโนมัติหรือไม่)
      game.io.to(nextPlayer.id).emit('your turn');
      game.io.to(nextPlayer.id).emit('enable draw button'); // Re-enable draw button for new player
      
      // Reset the hasPlayedCardsThisTurn flag for the new player
      nextPlayer.hasPlayedCardsThisTurn = false;
      
      game.emitRoomState(room.name);

  }

  function hasPendingCardAction(room) {
      return !!(room.playerForcedToRevealTryal || room.awaitingCurseSelection ||
          room.awaitingAlibiSelection || room.awaitingConspiracySelection ||
          room.awaitingLeftTryalSelections || room.isAssigningBlackCat);
  }

  function canAutoEndTurn(room, player) {
      return !room.gameOver && room.currentPhase === 'DAY' && player?.alive &&
          room.currentTurnPlayerUniqueId === player.uniqueId && player.hasPlayedCardsThisTurn &&
          player.hand.length === 0 && !hasPendingCardAction(room);
  }

  function finishEmptyHandTurn(room) {
      const player = room.players[room.currentTurnPlayerUniqueId];
      if (!canAutoEndTurn(room, player)) return;
      game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดในมือหมดแล้ว จบเทิร์นอัตโนมัติ`, 'orange', true);
      game.setNextTurn(room);
  }

  function endTurn(roomName, playerUniqueId) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
          const player = room?.players[playerUniqueId];
          if (player) game.io.to(player.id).emit('game message', 'ตอนนี้ยังจบเทิร์นไม่ได้.', 'red');
          return;
      }
      const player = room.players[playerUniqueId];
      if (!player || !player.alive || player.uniqueId !== room.currentTurnPlayerUniqueId) {
          if (player) {
              game.io.to(player.id).emit('game message', 'ไม่ใช่ตาของคุณหรือคุณไม่สามารถจบเทิร์นได้.', 'red');
          }
          return;
      }

      if (room.playerForcedToRevealTryal) {
          game.io.to(player.id).emit('game message', `รอให้ ${room.players[room.playerForcedToRevealTryal].name} เปิดเผยการ์ดชีวิตก่อน`, 'orange');
          return;
      }

      if (hasPendingCardAction(room)) {
          game.io.to(player.id).emit('game message', 'กรุณาทำแอ็กชันการ์ดให้เสร็จก่อนจบเทิร์น', 'orange');
          return;
      }

      if (!player.hasPlayedCardsThisTurn) {
          game.io.to(player.id).emit('game message', 'คุณต้องเลือกจั่วการ์ด 2 ใบ หรือเล่นการ์ดก่อนจบเทิร์น.', 'red');
          return;
      }

      game.setNextTurn(room); // Now advance to next player's turn
  }

  return { setNextTurn, endTurn, hasPendingCardAction, canAutoEndTurn, finishEmptyHandTurn };
};
