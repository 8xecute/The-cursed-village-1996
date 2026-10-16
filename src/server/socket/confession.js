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
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];

          // เพิ่มเช็คว่าอยู่ใน PRE_DAWN เท่านั้น
          if (room.currentPhase !== 'PRE_DAWN' || !player || !player.alive) {
              if (player) game.io.to(player.id).emit('game message', 'ตอนนี้ยังข้ามการสารภาพบาปไม่ได้.', 'red');
              return;
          }

              // Enforce confession order
              if (room.confessionOrder && room.confessionOrder.length > 0) {
                  const currentConfessor = room.confessionOrder[room.currentConfessionIndex];
                  if (player.uniqueId !== currentConfessor) {
                      game.io.to(player.id).emit('game message', 'ยังไม่ถึงลำดับของคุณในการสารภาพบาป.', 'red');
                      return;
                  }
              }

              if (room.confessionActions?.includes(player.uniqueId) ||
                  (room.nightConfessors && room.nightConfessors.includes(player.uniqueId))) {
                  game.io.to(player.id).emit('game message', 'คุณได้ทำการกระทำไปแล้วในคืนนี้.', 'red');
                  return;
              }

              // Clear confession timer for this player
              game.clearConfessionTimer(roomName);
              game.markConfessionAction(room, player.uniqueId);
              
              // Mark as confessed (skipped) to prevent further attempts
              if (!room.nightConfessors) {
                  room.nightConfessors = [];
              }
              // ถ้าเป็น witchTarget ห้าม push เข้า nightConfessors
              const witchTarget = room.playersWhoActedAtNight['witchKill'];
              if (player.uniqueId !== witchTarget) {
                  room.nightConfessors.push(player.uniqueId);
              }
              game.sendGameMessage(room.name, `<b>${player.name}</b> เลือกที่จะข้ามการสารภาพบาป.`, 'orange', true);

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
                  // สารภาพครบแล้ว resolveNightActions และเปลี่ยนเป็น DAY
                  game.resolveNightActions(roomName);
                  if (room.gameOver) return;
                  // ประกาศการตายและเปลี่ยนเฟสเป็น DAY
                  game.sendGameMessage(room.name, 'เช้าแล้ว! ถึงเวลาเวลาตามล่าบอป...', 'blue', true);
                  if (room.killedPlayer) {
                      game.sendGameMessage(room.name, `${room.killedPlayer.name} ถูกสังหารในตอนกลางคืน!`, 'red', true);
                      game.handlePlayerDeath(room, room.killedPlayer, {
                          byPlayerName: room.lastNightKillerName || null,
                          cause: 'night_kill',
                      });
                      room.killedPlayer = null;
                  }
                  if (room.killedPlayerMatchmaker) {
                      game.sendGameMessage(room.name, `${room.killedPlayerMatchmaker.name} ตายพร้อมกับผู้เล่นที่ถูกกำจัด เนื่องจาก Matchmaker!`, 'red', true);
                      game.handlePlayerDeath(room, room.killedPlayerMatchmaker, {
                          cause: 'matchmaker_link',
                      });
                      room.killedPlayerMatchmaker = null;
                  }
                  // reset state for new day
                  room.dayNumber++;
                  room.blackCatHolderAlreadyActedThisDay = false;
                  room.playersWhoActedAtNight = {};
                  room.nightConfessors = [];
                  room.nightCardDrawer = null;
                  room.confessionOrder = [];
                  room.currentConfessionIndex = 0;
                  game.prepareDeckForNewDay(room);
                  room.currentPhase = 'DAY';
                  game.emitRoomState(room.name);
                  game.setNextTurn(room);
          }
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
                  (targetPlayer.revealedTryalCards ||= []).push({ name: selectedCard.name });
                  targetPlayer.revealedTryalCardIndexes.add(selectedCard.name);
                  
                  // เปลี่ยนข้อความให้ถูกต้องและระบุชื่อการ์ดที่ถูกเปิด
                                      game.sendGameMessage(room.name, `ผู้เล่น<b>${targetPlayer.name}</b> ถูกบังคับเปิดการ์ดชีวิตเพราะข้อกล่าวหา 7 แต้ม! การ์ดที่ถูกเปิดคือ: ${game.getCardNameWithColor(selectedCard.name)}` , 'orange', true);
                  
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
                      return;
                  } else if (selectedCard.name === 'Constable') {
                      targetPlayer.isConstable = true;
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
              }
          }
      });
};
