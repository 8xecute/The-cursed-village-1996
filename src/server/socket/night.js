module.exports = function registerHandlers(socket, game) {
  socket.on('constable action', (targetUniqueId) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];

          if (room.currentPhase === 'NIGHT' && player && player.isConstable && player.alive) {
              if (game.hasNightActionChosen(room, 'constableSave')) {
                  game.io.to(socket.id).emit('game message', 'คุณได้ใช้ปัดเป่าไปแล้วในคืนนี้.', 'red');
                  return;
              }
              // ถ้า targetUniqueId เป็น null หรือ undefined ให้ถือว่า skip
              if (!targetUniqueId) {
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ไม่ได้เลือกปกป้องใครในคืนนี้.`, 'orange');
                  room.playersWhoActedAtNight['constableSave'] = null;
                  // ถ้าปอบเลือกเป้าหมายแล้ว ให้ไป PRE_DAWN ทันที
                  if (game.hasNightActionChosen(room, 'witchKill')) {
                      game.changePhase(roomName, 'PRE_DAWN');
                  }
                  return;
              }
              if (targetUniqueId && room.players[targetUniqueId]) {
                  if (targetUniqueId === socket.uniqueId) {
                      game.io.to(socket.id).emit('game message', 'คุณไม่สามารถปกป้องตนเองได้.', 'red');
                      return;
                  }
                  room.playersWhoActedAtNight['constableSave'] = targetUniqueId;
                  game.io.to(socket.id).emit('game message', `คุณได้ใช้ปัดเป่าเพื่อปกป้อง ${room.players[targetUniqueId].name}.`, 'green');
                  // ถ้าปอบเลือกเป้าหมายแล้ว ให้ไป PRE_DAWN ทันที
                  if (game.hasNightActionChosen(room, 'witchKill')) {
                      game.changePhase(roomName, 'PRE_DAWN');
                  }
              } else {
                  game.io.to(socket.id).emit('game message', 'เป้าหมายไม่ถูกต้องหรือไม่สามารถปกป้องได้.', 'red');
              }
          } else {
              game.io.to(socket.id).emit('game message', 'ตอนนี้คุณไม่สามารถใช้ปัดเป่าได้.', 'red');
          }
      });

  socket.on('witch mark target', (targetUniqueId, nightId) => {
          const room = game.rooms[socket.currentRoom];
          const player = room?.players[socket.uniqueId];
          if (!room || room.gameOver || room.currentPhase !== 'NIGHT' || !player?.alive ||
              !(player.hasBeenWitch || player.isWitch) || game.hasNightActionChosen(room, 'witchKill')) return;
          if (!nightId || nightId !== room.witchNightId) return;
          const target = room.players[targetUniqueId];
          if (targetUniqueId !== null && !target?.alive) {
              game.io.to(socket.id).emit('game message', 'ไม่สามารถมาร์คเป้าหมายนี้ได้.', 'red');
              return;
          }
          if (!room.witchNightMarks) room.witchNightMarks = {};
          room.witchNightMarks[player.uniqueId] = targetUniqueId;
          game.emitRoomState(room.name);
      });

  socket.on('witch kill target', (targetUniqueId, confirmation) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];

          if (room.currentPhase === 'NIGHT' && player && (player.hasBeenWitch || player.isWitch) && player.alive) {
              if (game.hasNightActionChosen(room, 'witchKill')) {
                  game.io.to(socket.id).emit('game message', 'คุณได้เลือกเป้าหมายการสังหารไปแล้ว.', 'red');
                  return;
              }
              if (!confirmation || confirmation.confirmed !== true || confirmation.nightId !== room.witchNightId ||
                  !Object.prototype.hasOwnProperty.call(room.witchNightMarks || {}, player.uniqueId) ||
                  room.witchNightMarks[player.uniqueId] !== targetUniqueId) {
                  game.io.to(socket.id).emit('game message', 'กรุณามาร์คเป้าหมายและยืนยันการสังหารอีกครั้ง.', 'orange');
                  return;
              }
              // ถ้า targetUniqueId เป็น null หรือ undefined ให้ถือว่า skip
              if (!targetUniqueId) {
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ไม่ได้เลือกสังหารใครในคืนนี้.`, 'orange');
                  room.playersWhoActedAtNight['witchKill'] = null;
                  game.emitRoomState(room.name);
                  // ถ้ามีหมอผีที่ยังไม่ได้เลือก ให้รอ
                  const constables = game.getAlivePlayers(room).filter(p => p.isConstable);
                  if (constables.length > 0 && !game.hasNightActionChosen(room, 'constableSave')) {
                      game.sendGameMessage(room.name, 'หมอผี, เตรียมตัวใช้ปัดเป่าเพื่อปกป้องผู้เล่น.', 'blue', true);
                      constables.forEach(constable => {
                          game.io.to(constable.id).emit('prompt constable action');
                      });
                  } else {
                      game.changePhase(roomName, 'PRE_DAWN');
                  }
                  return;
              }
              if (targetUniqueId && room.players[targetUniqueId]?.alive) {
                  room.playersWhoActedAtNight['witchKill'] = targetUniqueId;
                  room.lastNightKillerName = player.name;
                  game.emitRoomState(room.name);
                  game.io.to(socket.id).emit('game message', `คุณได้เลือก ${room.players[targetUniqueId].name} เป็นเป้าหมายการสังหาร.`, 'green');
                  // แจ้งเตือนทีมปอบทุกคนว่าใครเลือกฆ่าใคร (เฉพาะปอบเห็น)
                  const witches = Object.values(room.players).filter(p => p.hasBeenWitch && p.id);
                  const witchMessage = `คืนนี้ทีมปอบ: <b>${player.name}</b> เลือกจะฆ่า: ${room.players[targetUniqueId].name}`;
                  witches.forEach(witchPlayer => {
                      game.io.to(witchPlayer.id).emit('game message', witchMessage, 'red', true);
                  });
                  // เพิ่มข้อความใน witch chat
                  const timestamp = Date.now();
                  const witchChatEntry = { senderName: 'SYSTEM', message: witchMessage, timestamp };
                  if (!room.witchChatHistory) room.witchChatHistory = [];
                  room.witchChatHistory.push(witchChatEntry);
                  if (room.witchChatHistory.length > 100) room.witchChatHistory.shift();
                  // ส่งข้อความไปยัง witch chat ของปอบทุกคน
                  witches.forEach(witchPlayer => {
                      game.io.to(witchPlayer.id).emit('witch chat message', 'SYSTEM', witchMessage, timestamp);
                  });
                  // ถ้ามีหมอผีที่ยังไม่ได้เลือก ให้รอ
                  const constables = game.getAlivePlayers(room).filter(p => p.isConstable);
                  if (constables.length > 0 && !game.hasNightActionChosen(room, 'constableSave')) {
                      game.sendGameMessage(room.name, 'หมอผี, เตรียมตัวใช้ปัดเป่าเพื่อปกป้องผู้เล่น.', 'blue', true);
                      constables.forEach(constable => {
                          game.io.to(constable.id).emit('prompt constable action');
                      });
                  } else {
                      game.changePhase(roomName, 'PRE_DAWN');
                  }
              } else {
                  game.io.to(socket.id).emit('game message', 'เป้าหมายไม่ถูกต้องหรือไม่สามารถสังหารได้.', 'red');
              }
          } else {
              game.io.to(socket.id).emit('game message', 'ตอนนี้คุณไม่สามารถสังหารได้.', 'red');
          }
      });

  socket.on('assign black cat', (targetUniqueId) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];

          // Validation
          if (!room.isAssigningBlackCat || !player || !player.alive || !player.isWitch) {
              game.io.to(socket.id).emit('game message', 'คุณไม่สามารถทำการกระทำนี้ได้ในตอนนี้.', 'red');
              return;
          }

          const targetPlayer = room.players[targetUniqueId];
          if (!targetPlayer) { // Witch can now assign to anyone, including themselves.
              game.io.to(socket.id).emit('game message', 'ไม่พบผู้เล่นเป้าหมาย.', 'red');
              return;
          }

          // Assign Black Cat card
          if (room.pendingBlackCatCard) {
              targetPlayer.inPlayCards.push(room.pendingBlackCatCard);
              room.blackCatHolder = targetPlayer.uniqueId;
              game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ได้รับ <b>การ์ดเครื่องเซ่น</b>!`, 'gold', true);
              game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
              room.pendingBlackCatCard = null;
          }
          // เพิ่มข้อความแจ้งใน witch chat ว่าใครเลือกวางการ์ดแมวดำที่ใคร
          const witches = Object.values(room.players).filter(p => p.hasBeenWitch && p.id);
          const blackCatMessage = `ทีมปอบ: <b>${player.name}</b> เลือกวางการ์ดแมวดำให้: ${targetPlayer.name}`;
          const timestamp = Date.now();
          const witchChatEntry = { senderName: 'SYSTEM', message: blackCatMessage, timestamp };
          if (!room.witchChatHistory) room.witchChatHistory = [];
          room.witchChatHistory.push(witchChatEntry);
          if (room.witchChatHistory.length > 100) room.witchChatHistory.shift();
          // ส่งข้อความไปยัง witch chat ของปอบทุกคน
          witches.forEach(witchPlayer => {
              game.io.to(witchPlayer.id).emit('witch chat message', 'SYSTEM', blackCatMessage, timestamp);
          });
          room.isAssigningBlackCat = false;
          game.emitRoomState(roomName);
          // --- Start the game immediately after Black Cat assignment ---
          room.gameStarted = true;
          room.currentPhase = 'DAY';
          room.dayNumber = 1;
          game.emitRoomState(roomName);
          game.setNextTurn(room);
      });
};
