module.exports = function registerCurseHandlers(socket, game) {
  socket.on('cancel curse selection', () => {
      const room = game.rooms[socket.currentRoom];
      const player = room?.players[socket.uniqueId];
      if (!room || room.gameOver || room.currentPhase !== 'DAY' || !player?.alive ||
          player.id !== socket.id || room.currentTurnPlayerUniqueId !== socket.uniqueId ||
          room.awaitingCurseSelection?.selector !== socket.uniqueId) return;
      delete room.awaitingCurseSelection;
      game.sendGameMessage(room.name, `${player.name} ข้ามการเลือกทำลายการ์ดด้วยคำสาป`, 'orange');
      game.finishEmptyHandTurn(room);
      game.emitRoomState(room.name);
  });

  socket.on('select curse target', (targetPlayerUniqueId, cardIndex) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];

          if (player && player.alive && room.currentPhase === 'DAY' &&
              room.currentTurnPlayerUniqueId === player.uniqueId && room.awaitingCurseSelection &&
              room.awaitingCurseSelection.selector === socket.uniqueId &&
              room.awaitingCurseSelection.target === targetPlayerUniqueId) {
              
              const targetPlayer = room.players[targetPlayerUniqueId];
              if (!targetPlayer || !targetPlayer.alive) return;
              const blueCards = targetPlayer.inPlayCards.filter(c => c.color === 'Blue');

              if (blueCards.length === 0) {
                  delete room.awaitingCurseSelection;
                  game.io.to(player.id).emit('game message', 'เป้าหมายไม่มีการ์ดสีน้ำเงินให้เลือกแล้ว.', 'orange');
                  game.finishEmptyHandTurn(room);
                  game.emitRoomState(room.name);
                  return;
              }

              if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= blueCards.length) {
                  game.io.to(player.id).emit('game message', 'หมายเลขการ์ดที่เลือกไม่ถูกต้อง.', 'red');
                  return;
              }

              if (targetPlayer && blueCards.length > cardIndex) {
                  const cardToDiscard = blueCards[cardIndex];
                  // --- แก้ไขตรงนี้ ---
                  // Remove the card from inPlayCards
                  targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(c => c !== cardToDiscard);
                  if (cardToDiscard.name === 'Black Cat') {
                      room.discardPile.push(cardToDiscard);
                      game.updateBlackCatHolder(room); // reset holder
                      game.sendGameMessage(room.name, 'การ์ดเครื่องเซ่นถูกทิ้งลงกองทิ้ง', 'grey', true);
                      game.emitRoomState(room.name);
                  } else if (cardToDiscard.name === 'Asylum') {
                      game.sendGameMessage(room.name, 'การ์ดที่หลบภัยถูกลบและสถานะป้องกันถูกยกเลิก!', 'grey', true);
                  room.discardPile.push(cardToDiscard);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  } else if (cardToDiscard.name === 'Piety') {
                      game.sendGameMessage(room.name, 'การ์ดพลังศรัทธาถูกลบและไม่สามารถกันการ์ดแดงได้อีก!', 'grey', true);
                      room.discardPile.push(cardToDiscard);
                      game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  } else if (cardToDiscard.name === 'Matchmaker') {
                      game.sendGameMessage(room.name, 'การ์ดผูกวิญญาณถูกลบออก!', 'grey', true);
                      room.discardPile.push(cardToDiscard);
                      game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  } else if (cardToDiscard.name === 'Conspiracy') {
                      game.sendGameMessage(room.name, 'การ์ดพิธีเซ่นไหว้ถูกลบและไปยังกองทิ้ง!', 'grey', true);
                      room.discardPile.push(cardToDiscard);
                      game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  } else {
                      room.discardPile.push(cardToDiscard);
                      game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  }
                  // --- เพิ่ม game message ---
                                          game.sendGameMessage(room.name, `<b>${player.name}</b> เลือกให้<b>${targetPlayer.name}</b> ทิ้งการ์ด ${game.getCardNameWithColor(cardToDiscard.name)} เนื่องจากโดนคำสาป.`, 'red');
                  // Clean up
                  delete room.awaitingCurseSelection;
                  if (!game.finishEmptyHandTurn(room)) {
                      game.emitRoomState(room.name);
                  }
                  // (ลบบรรทัด setNextTurn(room); เพื่อให้ผู้เล่นเล่นต่อได้เอง)
              }
          }
      });

};
