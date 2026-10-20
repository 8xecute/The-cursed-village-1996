// turns: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function setNextTurn(room, fromPlayerUniqueId = null, forceFromPlayer = false) {
      // Every caller, including draw continuation and phase startup, passes this gate.
      if (!canAdvanceTurn(room)) return false;
      game.applyTwoPlayerRules(room);
      const alivePlayers = game.getAlivePlayers(room);
      if (alivePlayers.length === 0) {
          game.sendGameMessage(room.name, "No players left.", 'grey', true);
          game.checkWinCondition(room); // Should already be handled but a fallback
          return;
      }

      let nextPlayerUniqueId = null;

      // Check for Black Cat holder starting first if it's the start of a DAY phase
      if (!forceFromPlayer && !room.firstTurnStarted && room.currentPhase === 'DAY' && room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
          // If Black Cat holder exists and is alive, they start the day
          if (!room.blackCatHolderAlreadyActedThisDay) { // Ensure they only start once per day
              nextPlayerUniqueId = room.blackCatHolder;
              room.blackCatHolderAlreadyActedThisDay = true;
              room.firstTurnStarted = true;
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
      room.firstTurnStarted = true;
      const nextPlayer = room.players[nextPlayerUniqueId];
      
      // ตรวจสอบว่าการ์ดในมือหมดหรือไม่ในช่วงกลางวัน
      if (room.currentPhase === 'DAY' && nextPlayer.hand.length === 0) {
          nextPlayer.hasPlayedCardsThisTurn = false;
          game.drawCards(room.name, nextPlayerUniqueId, 2);
          return;
      }
      
      // ส่ง your turn event ไปยังผู้เล่นถัดไป (ไม่ว่าจะจั่วอัตโนมัติหรือไม่)
      game.io.to(nextPlayer.id).emit('your turn');
      game.io.to(nextPlayer.id).emit('enable draw button'); // Re-enable draw button for new player
      
      // Reset the hasPlayedCardsThisTurn flag for the new player
      nextPlayer.hasPlayedCardsThisTurn = false;
      
      game.emitRoomState(room.name);

  }

  function pendingActionReason(room) {
      if (!room) return null;
      if (room.playerForcedToRevealTryal) return 'รอเลือกเปิดการ์ดชีวิตให้เสร็จก่อน';
      if (room.awaitingCurseSelection) return 'รอเลือกผลคำสาปให้เสร็จก่อน';
      if (room.awaitingAlibiSelection) return 'รอเลือกข้อแก้ต่างหรือยกเลิกให้เสร็จก่อน';
      if (room.awaitingConspiracySelection || room.awaitingLeftTryalSelections) return 'รอพิธีเซ่นไหว้ให้เสร็จก่อน';
      if (room.isAssigningBlackCat) return 'รอมอบเครื่องเซ่นให้เสร็จก่อน';
      if (room.pendingDraw) return 'รอจั่วการ์ดให้ครบก่อน';
      if (room.prankShot) return 'รอผลการยิงปืนให้เสร็จก่อน';
      return null;
  }

  function hasPendingCardAction(room) {
      return pendingActionReason(room) !== null;
  }

  function canAdvanceTurn(room) {
      return !!room?.gameStarted && !room.gameOver && room.currentPhase === 'DAY' &&
          !hasPendingCardAction(room);
  }

  function canAutoEndTurn(room, player) {
      return canAdvanceTurn(room) && player?.alive &&
          room.currentTurnPlayerUniqueId === player.uniqueId && player.hasPlayedCardsThisTurn &&
          player.hand.length === 0;
  }

  function finishEmptyHandTurn(room) {
      if (!canAdvanceTurn(room)) return false;
      const player = room.players[room.currentTurnPlayerUniqueId];
      // A completed reveal can kill the actor through Matchmaker. Resume from
      // that seat only after the reveal/pending action has been cleaned up.
      if (player && !player.alive) {
          game.setNextTurn(room, player.uniqueId, true);
          return true;
      }
      if (!canAutoEndTurn(room, player)) return false;
      game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดในมือหมดแล้ว จบเทิร์นอัตโนมัติ`, 'orange', true);
      game.setNextTurn(room);
      return true;
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

      const pendingReason = pendingActionReason(room);
      if (pendingReason) {
          game.io.to(player.id).emit('game message', pendingReason, 'orange');
          return;
      }

      if (!player.hasPlayedCardsThisTurn) {
          game.io.to(player.id).emit('game message', 'คุณต้องเลือกจั่วการ์ด 2 ใบ หรือเล่นการ์ดก่อนจบเทิร์น.', 'red');
          return;
      }

      game.setNextTurn(room); // Now advance to next player's turn
  }

  return { setNextTurn, endTurn, pendingActionReason, canAdvanceTurn, hasPendingCardAction, canAutoEndTurn, finishEmptyHandTurn };
};
