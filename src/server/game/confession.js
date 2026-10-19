// confession: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function confessTryalCard(roomName, playerUniqueId, cardIndex) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      const player = room.players[playerUniqueId];
      if (!room.gameStarted || room.currentPhase !== 'PRE_DAWN') {
          if (player) game.io.to(player.id).emit('game message', 'การสารภาพบาปใช้ได้เฉพาะในช่วงก่อนเช้าเท่านั้น.', 'red');
          return;
      }

      if (room.confessionOrder?.length &&
          room.confessionOrder[room.currentConfessionIndex] !== playerUniqueId) {
          if (player) game.io.to(player.id).emit('game message', 'ยังไม่ถึงลำดับของคุณในการสารภาพบาป.', 'red');
          return;
      }

      if (!player || !player.alive) {
          if (player) game.io.to(player.id).emit('game message', 'คุณไม่สามารถสารภาพบาปได้.', 'red');
          return;
      }

      if (player.tryalCards.length === 0) {
          game.io.to(player.id).emit('game message', 'คุณไม่มี Tryal Card ให้สารภาพบาป.', 'red');
          return;
      }

      if (room.confessionActions?.includes(playerUniqueId) ||
          (room.nightConfessors && room.nightConfessors.includes(playerUniqueId))) {
          game.io.to(player.id).emit('game message', 'คุณสารภาพบาปไปแล้วในคืนนี้.', 'red');
          return;
      }

      // Validate card index
      if (cardIndex < 0 || cardIndex >= player.tryalCards.length) {
          game.io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
          return;
      }

      const revealedCard = player.tryalCards.splice(cardIndex, 1)[0];
      game.onTryalRevealed(room, revealedCard); // Remove selected card
      (player.revealedTryalCards ||= []).push({ name: revealedCard.name });
      player.revealedTryalCardIndexes.add(revealedCard.name);
      
      // Clear confession timer for this player
      game.clearConfessionTimer(roomName);
      game.markConfessionAction(room, playerUniqueId);
      
      // Initialize nightConfessors if it doesn't exist
      if (!room.nightConfessors) {
          room.nightConfessors = [];
      }
      room.nightConfessors.push(playerUniqueId); // Mark as confessed for the night

      game.sendGameMessage(room.name, `<b>${player.name}</b> สารภาพบาปและเปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
      game.emitRoomState(room.name);
      game.io.to(player.id).emit('update tryal cards initial', player.tryalCards); // Update client's view
      game.io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes)); // Update client's revealed roles

      let diedFromWitch = false;
      if (revealedCard.name === 'Witch') {
          player.isWitch = true;
          player.hasBeenWitch = true;
          game.sendGameMessage(room.name, `<b>${player.name}</b> คือปอบ!`, 'red', true);
          if (player.tryalCards.some(card => card.name === 'Witch') || revealedCard.name === 'Witch') {
              game.sendGameMessage(room.name, `<b>${player.name}</b> ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'red', true);
              game.handlePlayerDeath(room, player, { cause: 'revealed_witch' });
      game.emitRoomState(room.name);
              game.checkWinCondition(room);
              diedFromWitch = true;
              // ไม่ return ทันที ให้ดำเนิน flow ต่อ
          }
      }

      if (!diedFromWitch) {
          game.eliminatePlayerWithoutLifeCards(room, player);
      }

      if (!diedFromWitch) {
      game.emitRoomState(room.name);
      game.checkWinCondition(room);
      }
      if (room.gameOver) return;

      // Advance to next confessor if any
      if (room.confessionOrder && room.currentConfessionIndex < room.confessionOrder.length - 1) {
          room.currentConfessionIndex++;
          game.emitRoomState(room.name);
          // Start confession timer for the next confessor
          const nextConfessor = room.confessionOrder[room.currentConfessionIndex];
          const nextPlayer = room.players[nextConfessor];
          if (nextPlayer && nextPlayer.alive && nextPlayer.tryalCards.length > 0 && room.confessionTimerDuration > 0) {
              game.sendGameMessage(room.name, `<b>${nextPlayer.name}</b> มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'blue', true);
              game.startConfessionTimer(roomName, nextConfessor);
          }
      } else {
          // สารภาพครบแล้ว เปลี่ยนเป็น DAY
          game.resolveNightActions(roomName);
          if (room.gameOver) return;
          // reset state for new day
          room.dayNumber++;
          room.blackCatHolderAlreadyActedThisDay = false;
          room.playersWhoActedAtNight = {};
          room.nightConfessors = [];
          room.resumeTurnFrom = room.nightCardDrawer || room.currentTurnPlayerUniqueId;
          room.nightCardDrawer = null;
          room.confessionOrder = [];
          room.currentConfessionIndex = 0;
          game.prepareDeckForNewDay(room);
          room.currentPhase = 'DAY';
          game.emitRoomState(room.name);
          game.setNextTurn(room, room.resumeTurnFrom, true);
      }
  }

  function confessDuringNight(roomName, playerUniqueId, cardIndex) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      const player = room.players[playerUniqueId];
      // เพิ่มเช็คว่าอยู่ใน PRE_DAWN เท่านั้น
      if (!room.gameStarted || room.currentPhase !== 'PRE_DAWN') {
          if (player) game.io.to(player.id).emit('game message', 'ตอนนี้ยังสารภาพบาปไม่ได้.', 'red');
          return;
      }

      // Enforce confession order
      if (room.confessionOrder && room.confessionOrder.length > 0) {
          const currentConfessor = room.confessionOrder[room.currentConfessionIndex];
          if (playerUniqueId !== currentConfessor) {
              if (player) game.io.to(player.id).emit('game message', 'ยังไม่ถึงลำดับของคุณในการสารภาพบาป.', 'red');
              return;
          }
      }

      if (!player || !player.alive) {
          if (player) game.io.to(player.id).emit('game message', 'คุณไม่สามารถสารภาพบาปได้.', 'red');
          return;
      }

      if (player.tryalCards.length === 0) {
          game.io.to(player.id).emit('game message', 'คุณไม่มี Tryal Card ให้สารภาพบาป.', 'red');
          return;
      }

      if (room.confessionActions?.includes(playerUniqueId) ||
          (room.nightConfessors && room.nightConfessors.includes(playerUniqueId))) {
          game.io.to(player.id).emit('game message', 'คุณสารภาพบาปไปแล้วในคืนนี้.', 'red');
          return;
      }

      // Validate card index
      if (cardIndex < 0 || cardIndex >= player.tryalCards.length) {
          game.io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
          return;
      }

      const revealedCard = player.tryalCards.splice(cardIndex, 1)[0];
      game.onTryalRevealed(room, revealedCard); // Remove selected card
      (player.revealedTryalCards ||= []).push({ name: revealedCard.name });
      player.revealedTryalCardIndexes.add(revealedCard.name);
      
      // Clear confession timer for this player
      game.clearConfessionTimer(roomName);
      game.markConfessionAction(room, playerUniqueId);
      
      // Initialize nightConfessors if it doesn't exist
      if (!room.nightConfessors) {
          room.nightConfessors = [];
      }
      room.nightConfessors.push(playerUniqueId); // Mark as confessed for the night

      game.sendGameMessage(room.name, `<b>${player.name}</b> สารภาพบาปและเปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
      game.emitRoomState(room.name);
      game.io.to(player.id).emit('update tryal cards initial', player.tryalCards); // Update client's view
      game.io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes)); // Update client's revealed roles

      let diedFromWitch = false;
      if (revealedCard.name === 'Witch') {
          player.isWitch = true;
          player.hasBeenWitch = true;
          game.sendGameMessage(room.name, `<b>${player.name}</b> คือปอบ!`, 'red', true);
          if (player.tryalCards.some(card => card.name === 'Witch') || revealedCard.name === 'Witch') {
              game.sendGameMessage(room.name, `<b>${player.name}</b> ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'red', true);
              game.handlePlayerDeath(room, player, { cause: 'revealed_witch' });
      game.emitRoomState(room.name);
              game.checkWinCondition(room);
              diedFromWitch = true;
              // ไม่ return ทันที ให้ดำเนิน flow ต่อ
          }
      }

      if (!diedFromWitch) {
          game.eliminatePlayerWithoutLifeCards(room, player);
      }

      if (!diedFromWitch) {
      game.emitRoomState(room.name);
      game.checkWinCondition(room);
      }
      if (room.gameOver) return;

      // Advance to next confessor if any
      if (room.confessionOrder && room.currentConfessionIndex < room.confessionOrder.length - 1) {
          room.currentConfessionIndex++;
          game.emitRoomState(room.name);
          // Start confession timer for the next confessor
          const nextConfessor = room.confessionOrder[room.currentConfessionIndex];
          const nextPlayer = room.players[nextConfessor];
          if (nextPlayer && nextPlayer.alive && nextPlayer.tryalCards.length > 0 && room.confessionTimerDuration > 0) {
              game.sendGameMessage(room.name, `<b>${nextPlayer.name}</b> มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'blue', true);
              game.startConfessionTimer(roomName, nextConfessor);
          }
      } else {
          // สารภาพครบแล้ว เปลี่ยนเป็น DAY
          game.resolveNightActions(roomName);
          if (room.gameOver) return;
          // reset state for new day
          game.prepareDeckForNewDay(room);
          room.dayNumber++;
          room.blackCatHolderAlreadyActedThisDay = false;
          room.playersWhoActedAtNight = {};
          room.nightConfessors = [];
          room.resumeTurnFrom = room.nightCardDrawer || room.currentTurnPlayerUniqueId;
          room.nightCardDrawer = null;
          room.confessionOrder = [];
          room.currentConfessionIndex = 0;
          room.currentPhase = 'DAY';
          game.emitRoomState(room.name);
          game.setNextTurn(room, room.resumeTurnFrom, true);
      }
  }

  function clearConfessionTimer(roomName) {
      const room = game.rooms[roomName];
      if (!room) return;
      
      if (room.confessionTimer) {
          clearTimeout(room.confessionTimer);
          room.confessionTimer = null;
      }
  }

  function markConfessionAction(room, playerUniqueId) {
      if (!room.confessionActions) room.confessionActions = [];
      if (!room.confessionActions.includes(playerUniqueId)) {
          room.confessionActions.push(playerUniqueId);
      }
  }

  function startConfessionTimer(roomName, playerUniqueId) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver || room.currentPhase !== 'PRE_DAWN') return;

      game.clearConfessionTimer(roomName);

      if (!room.confessionTimerDuration || room.confessionTimerDuration <= 0) return;
      const duration = room.confessionTimerDuration * 1000;
      room.confessionTimer = setTimeout(() => {
          if (!room || room.gameOver || room.currentPhase !== 'PRE_DAWN') return;
          const currentConfessor = room.confessionOrder && room.confessionOrder[room.currentConfessionIndex];
          if (currentConfessor === playerUniqueId) {
              if (room.confessionActions?.includes(playerUniqueId)) return;
              const player = room.players[playerUniqueId];
              const playerName = player ? player.name : 'ผู้เล่น';
              game.sendGameMessage(room.name, `<b>${playerName}</b> หมดเวลาการสารภาพ (ข้ามให้อัตโนมัติ).`, 'orange', true);
              game.markConfessionAction(room, playerUniqueId);
              
              if (!room.nightConfessors) room.nightConfessors = [];
              const witchTarget = room.playersWhoActedAtNight['witchKill'];
              if (playerUniqueId !== witchTarget) {
                  room.nightConfessors.push(playerUniqueId);
              }

              if (room.confessionOrder && room.currentConfessionIndex < room.confessionOrder.length - 1) {
                  room.currentConfessionIndex++;
                  game.emitRoomState(room.name);
                  const nextConfessor = room.confessionOrder[room.currentConfessionIndex];
                  const nextPlayer = room.players[nextConfessor];
                  if (nextPlayer && nextPlayer.alive && nextPlayer.tryalCards.length > 0 && room.confessionTimerDuration > 0) {
                      game.sendGameMessage(room.name, `<b>${nextPlayer.name}</b> มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'blue', true);
                      game.startConfessionTimer(roomName, nextConfessor);
                  }
              } else {
                  game.resolveNightActions(roomName);
                  if (room.gameOver) return;
                  game.sendGameMessage(room.name, 'เช้าแล้ว! ถึงเวลาตามล่าปอบ...', 'blue', true);
                  if (room.killedPlayer) {
                      game.sendGameMessage(room.name, `${room.killedPlayer.name} ถูกสังหารในตอนกลางคืน!`, 'red', true);
                      game.handlePlayerDeath(room, room.killedPlayer, {
                          byPlayerName: room.lastNightKillerName || null,
                          cause: 'night_kill',
                      });
                      room.killedPlayer = null;
                  }
                  game.changePhase(roomName, 'DAY');
              }
          }
      }, duration);
  }

  function revealTryalCard(roomName, playerUniqueId, cardIndex) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
          game.io.to(room.players[playerUniqueId].id).emit('game message', 'การเปิดเผยการ์ดชีวิตใช้ได้เฉพาะในช่วงกลางวันเท่านั้น.', 'red');
          return;
      }

      const player = room.players[playerUniqueId];
      if (!player || !player.alive) {
          game.io.to(player.id).emit('game message', 'คุณไม่สามารถเปิดเผยการ์ดชีวิตได้.', 'red');
          return;
      }

      if (player.tryalCards.length === 0) {
          game.io.to(player.id).emit('game message', 'คุณไม่มี Tryal Card ให้เปิดเผย.', 'red');
          return;
      }

      // Validate card index
      if (cardIndex < 0 || cardIndex >= player.tryalCards.length) {
          game.io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
          return;
      }

      const revealedCard = player.tryalCards.splice(cardIndex, 1)[0];
      game.onTryalRevealed(room, revealedCard); // Remove selected card
      (player.revealedTryalCards ||= []).push({ name: revealedCard.name });
      player.revealedTryalCardIndexes.add(revealedCard.name);

      game.sendGameMessage(room.name, `<b>${player.name}</b> เปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
      game.io.to(player.id).emit('update tryal cards initial', player.tryalCards); // Update client's view
      game.io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes)); // Update client's revealed roles

      if (revealedCard.name === 'Witch') {
          player.isWitch = true; // Confirm Witch status
          player.hasBeenWitch = true; // Mark that this player has been a witch
          game.sendGameMessage(room.name, `<b>${player.name}</b> คือปอบ!`, 'red', true);
          // ตายทันทีเมื่อเปิด Witch ใบแรก
              game.sendGameMessage(room.name, `<b>${player.name}</b> ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'red', true);
              game.handlePlayerDeath(room, player, { cause: 'revealed_witch' });
          // --- Clear forced reveal state หลังผู้เล่นตาย ---
          room.playerForcedToRevealTryal = null;
          room.playerForcedToRevealSelector = null;
              game.emitRoomState(room.name);
              game.checkWinCondition(room);
              game.finishEmptyHandTurn(room);
              return;
      } else if (revealedCard.name === 'Constable') {
          player.isConstable = false; // Revealed Constable no longer has a power
          game.sendGameMessage(room.name, `<b>${player.name}</b> คือหมอผี!`, 'green', true);
      }

      // Clear the forced reveal state so the game can continue
      room.playerForcedToRevealTryal = null;
      room.playerForcedToRevealSelector = null;

      game.eliminatePlayerWithoutLifeCards(room, player);

      game.emitRoomState(room.name); // Update all players
      game.checkWinCondition(room); // Check win condition after revealing Tryal Card
      game.finishEmptyHandTurn(room);
  }

  return { confessTryalCard, confessDuringNight, clearConfessionTimer, markConfessionAction, startConfessionTimer, revealTryalCard };
};
