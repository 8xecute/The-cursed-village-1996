module.exports = function registerHandlers(socket, game) {
  socket.on('confess tryal card', (cardIndex) => {
          const roomName = socket.currentRoom;
          if (roomName) {
              game.confessTryalCard(roomName, socket.uniqueId, cardIndex);
          }
      });

  socket.on('confess during night', (cardIndex) => {
          const roomName = socket.currentRoom;
          if (roomName) {
              game.confessDuringNight(roomName, socket.uniqueId, cardIndex);
          }
      });

  socket.on('reveal tryal card', (cardIndex) => {
          const roomName = socket.currentRoom;
          if (roomName) {
              game.revealTryalCard(roomName, socket.uniqueId, cardIndex);
          }
      });

  socket.on('skip confession', () => {
      if (socket.currentRoom) game.submitConfessionChoice(socket.currentRoom, socket.uniqueId, null);
  });

  socket.on('set confession timer', (roomName, confessionTime) => {
          const room = game.rooms[roomName];
          if (room && room.hostUniqueId === socket.uniqueId) {
              room.confessionTimerDuration = 0;
              game.clearConfessionTimer(room.name);
              game.io.to(socket.id).emit('game message', 'ช่วงสารภาพบาปไม่มีการจำกัดเวลา เลือกสารภาพหรือข้ามได้เอง.', 'blue');
              game.emitRoomState(roomName); // Update clients with new confession timer
          } else {
              game.io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์ตั้งเวลา confession.', 'red');
          }
      });

  socket.on('select tryal card for confession', (targetPlayerUniqueId, cardIndex) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];

          if (player && player.alive && room.playerForcedToRevealTryal === targetPlayerUniqueId &&
              room.playerForcedToRevealSelector === socket.uniqueId) {
              
              const targetPlayer = room.players[targetPlayerUniqueId];
              if (targetPlayer && targetPlayer.alive && Number.isInteger(cardIndex) && cardIndex >= 0 && targetPlayer.tryalCards.length > cardIndex) {
                  const selectedCard = targetPlayer.tryalCards.splice(cardIndex, 1)[0];
      game.onTryalRevealed(room, selectedCard);
                  (targetPlayer.revealedTryalCards ||= []).push({ name: selectedCard.name });
                  targetPlayer.revealedTryalCardIndexes.add(selectedCard.name);
                  
                  // เปลี่ยนข้อความให้ถูกต้องและระบุชื่อการ์ดที่ถูกเปิด
                  game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> เปิดการ์ดชีวิตจากข้อกล่าวหาครบ 7 แต้ม: ${game.getCardNameWithColor(selectedCard.name)}`, 'orange', true);
                  
                  if (selectedCard.name === 'Witch') {
                      targetPlayer.isWitch = true;
                      game.sendGameMessage(room.name, `${targetPlayer.name} คือปอบ!`, 'red', true);
                      // ตายทันทีเมื่อเปิด Witch
                      game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'red', true);
                      game.handlePlayerDeath(room, targetPlayer, { cause: 'revealed_witch' });
                      // --- Clear forced reveal state หลังผู้เล่นตาย ---
                      room.playerForcedToRevealTryal = null;
                      room.playerForcedToRevealSelector = null;
                      game.emitRoomState(room.name);
                      game.checkWinCondition(room);
                      game.finishEmptyHandTurn(room);
                      return;
                  } else if (selectedCard.name === 'Constable') {
                      targetPlayer.isConstable = false;
                      game.sendGameMessage(room.name, `${targetPlayer.name} คือหมอผี!`, 'green', true);
                  }
                  
                  // Reset accusation points and discard RED cards
                  room.accusedPlayers[targetPlayerUniqueId] = 0;
                  const redCardsToDiscard = targetPlayer.inPlayCards.filter(card => card.color === 'Red');
                  targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(card => card.color !== 'Red');
                  room.discardPile.push(...redCardsToDiscard);
                  

                  
                  room.playerForcedToRevealTryal = null;
                  room.playerForcedToRevealSelector = null;
                  game.eliminatePlayerWithoutLifeCards(room, targetPlayer);
                  if (targetPlayer.alive) room.confessors.push(targetPlayerUniqueId);
                  
                  game.io.to(targetPlayer.id).emit('update tryal cards initial', targetPlayer.tryalCards);
                  game.io.to(targetPlayer.id).emit('update revealed tryal indexes', Array.from(targetPlayer.revealedTryalCardIndexes));
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  
                  game.emitRoomState(room.name);
                  game.checkWinCondition(room);
                  game.finishEmptyHandTurn(room);
              }
          }
      });
};
