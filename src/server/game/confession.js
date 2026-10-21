// All living players decide concurrently; reveal only after every decision is committed.
module.exports = function createServices(game) {
  function clearConfessionTimer(roomName) {
      const room = game.rooms[roomName];
      if (room?.confessionTimer) clearTimeout(room.confessionTimer);
      if (room) room.confessionTimer = null;
  }
  function markConfessionAction(room, id) {
      if (!room.confessionActions) room.confessionActions = [];
      if (!room.confessionActions.includes(id)) room.confessionActions.push(id);
  }
  function startConfessionTimer() {} // Decisions have no timeout.
  function submitConfessionChoice(roomName, id, index) {
      const room = game.rooms[roomName];
      const player = room?.players[id];
      if (!room || room.gameOver || !room.gameStarted || room.currentPhase !== 'PRE_DAWN' ||
          !player?.alive || room.confessionResolving || room.confessionActions?.includes(id)) return;
      if (index !== null && (!Number.isInteger(index) || index < 0 || index >= player.tryalCards.length)) return;
      (room.confessionChoices ||= {})[id] = index;
      markConfessionAction(room, id);
      game.emitRoomState(roomName);
      finishConfessionIfReady(roomName);
  }
  function finishConfessionIfReady(roomName) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver || room.currentPhase !== 'PRE_DAWN' || room.confessionResolving) return;
      const alive = game.getAlivePlayers(room);
      if (!alive.every(player => room.confessionActions?.includes(player.uniqueId))) return;
      room.confessionResolving = true;
      clearConfessionTimer(roomName);
      room.nightConfessors = [];
      // Resolve in stable seating order, regardless of network arrival order.
      for (const player of alive) {
          const index = room.confessionChoices?.[player.uniqueId];
          if (index === null || index === undefined) {
              game.sendGameMessage(room.name, `${player.name} ข้ามการสารภาพบาป`, 'orange', true);
              continue;
          }
          if (!player.alive) continue;
          const card = game.openLifeCard(room, player, index);
          if (!card) continue;
          room.nightConfessors.push(player.uniqueId);
          game.sendGameMessage(room.name, `${player.name} สารภาพบาป: ${game.getCardNameWithColor(card.name)}`, 'gold', true);
          game.syncLifeCards(player);
          game.resolveLifeCard(room, player, card);
          if (room.gameOver) return;
      }
      game.resolveNightActions(roomName);
      if (room.gameOver) return;
      room.dayNumber++;
      room.blackCatHolderAlreadyActedThisDay = false;
      room.playersWhoActedAtNight = {};
      room.nightConfessors = [];
      room.resumeTurnFrom = room.nightCardDrawer || room.currentTurnPlayerUniqueId;
      room.nightCardDrawer = null;
      room.confessionOrder = [];
      room.confessionChoices = {};
      room.confessionActions = [];
      room.confessionResolving = false;
      game.prepareDeckForNewDay(room);
      room.currentPhase = 'DAY';
      game.emitRoomState(roomName);
      game.continuePendingDraw(room, room.resumeTurnFrom);
  }
  function confessTryalCard(roomName, id, index) { submitConfessionChoice(roomName, id, index); }
  function confessDuringNight(roomName, id, index) { submitConfessionChoice(roomName, id, index); }
  function revealTryalCard(roomName, playerUniqueId, cardIndex) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      if (!room.gameStarted || room.currentPhase !== 'DAY') {
          if (room.players[playerUniqueId]) game.io.to(room.players[playerUniqueId].id).emit('game message', 'การเปิดเผยการ์ดชีวิตใช้ได้เฉพาะในช่วงกลางวันเท่านั้น.', 'red');
          return;
      }

      const player = room.players[playerUniqueId];
      if (!player || !player.alive) {
          if (player) game.io.to(player.id).emit('game message', 'คุณไม่สามารถเปิดเผยการ์ดชีวิตได้.', 'red');
          return;
      }

      if (player.tryalCards.length === 0) {
          game.io.to(player.id).emit('game message', 'คุณไม่มีการ์ดชีวิต ให้เปิดเผย.', 'red');
          return;
      }

      // Validate card index
      if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= player.tryalCards.length) {
          game.io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
          return;
      }

      const revealedCard = game.openLifeCard(room, player, cardIndex);
      if (!revealedCard) return;

      game.sendGameMessage(room.name, `<b>${player.name}</b> เปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
      game.syncLifeCards(player);

      if (revealedCard.name === 'Witch') {
          game.sendGameMessage(room.name, `<b>${player.name}</b> คือปอบ!`, 'red', true);
          // ตายทันทีเมื่อเปิด Witch ใบแรก
              game.sendGameMessage(room.name, `<b>${player.name}</b> ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'red', true);
              game.resolveLifeCard(room, player, revealedCard);
          // --- Clear forced reveal state หลังผู้เล่นตาย ---
          room.playerForcedToRevealTryal = null;
          room.playerForcedToRevealSelector = null;
              game.emitRoomState(room.name);
              game.checkWinCondition(room);
              game.finishEmptyHandTurn(room);
              return;
      } else if (revealedCard.name === 'Constable') {
          game.sendGameMessage(room.name, `<b>${player.name}</b> คือหมอผี!`, 'green', true);
      }

      // Clear the forced reveal state so the game can continue
      room.playerForcedToRevealTryal = null;
      room.playerForcedToRevealSelector = null;

      game.resolveLifeCard(room, player, revealedCard);

      game.emitRoomState(room.name); // Update all players
      game.checkWinCondition(room); // Check win condition after revealing Tryal Card
      game.finishEmptyHandTurn(room);
  }

  return { confessTryalCard, confessDuringNight, submitConfessionChoice, finishConfessionIfReady, clearConfessionTimer, markConfessionAction, startConfessionTimer, revealTryalCard };
};
