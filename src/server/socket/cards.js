module.exports = function registerHandlers(socket, game) {
  socket.on('draw cards', () => {
          const roomName = socket.currentRoom;
          if (roomName) {
              game.drawCards(roomName, socket.uniqueId);
          }
      });

  socket.on('play card', (cardIndex, targetUniqueId, secondTargetUniqueId) => {
          const roomName = socket.currentRoom;
          if (roomName) {
              game.playCard(roomName, socket.uniqueId, cardIndex, targetUniqueId, secondTargetUniqueId);
          }
      });

  socket.on('play red cards', (indexes, targetId) => {
      if(socket.currentRoom) game.playRedCards(socket.currentRoom, socket.uniqueId, indexes, targetId);
  });

  socket.on('end turn', () => {
          const roomName = socket.currentRoom;
          if (roomName) {
              game.endTurn(roomName, socket.uniqueId);
          }
      });

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
                  if (game.canAutoEndTurn(room, player)) {
                      game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดในมือหมดแล้ว จบเทิร์นอัตโนมัติ`, 'orange', true);
                      game.setNextTurn(room);
                  } else {
                      game.emitRoomState(room.name);
                  }
                  // (ลบบรรทัด setNextTurn(room); เพื่อให้ผู้เล่นเล่นต่อได้เอง)
              }
          }
      });

  socket.on('select alibi removal', (data) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];
          if (!player || !player.alive || !room.awaitingAlibiSelection) return;
          const { selector, target, cardIndex } = room.awaitingAlibiSelection;
          if (selector !== socket.uniqueId) return;
          const targetPlayer = room.players[target];
          if (!targetPlayer) return;
          const selectedIndexes = data.selectedIndexes;
          // ตรวจสอบว่าเลือกชนิดเดียวและแต้มรวมไม่เกิน 3
          const redCards = targetPlayer.inPlayCards
              .map((c, idx) => ({ ...c, index: idx }))
              .filter(c => c.color === 'Red' && (c.name === 'Accusation' || c.name === 'Evidence'));
          if (!selectedIndexes || selectedIndexes.length === 0) return;
          const selectedCards = redCards.filter(c => selectedIndexes.includes(c.index));
          if (selectedCards.length === 0) return;
          const typeSet = new Set(selectedCards.map(c => c.name));
          if (typeSet.size !== 1) return; // ต้องชนิดเดียว
          const totalPoints = selectedCards.reduce((sum, c) => sum + (c.value || 1), 0);
          if (typeSet.has('Accusation') && selectedCards.length > 3) return;
          if (typeSet.has('Evidence') && selectedCards.length > 1) return;
          if (totalPoints > 3) return;
          // ลบการ์ดที่เลือก
          selectedCards.forEach(card => {
              room.discardPile.push(card);
              targetPlayer.inPlayCards[card.index] = null;
          });
          targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(c => c);
          room.accusedPlayers[target] = Math.max(0, (room.accusedPlayers[target] || 0) - totalPoints);
          game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้ ${game.getCardNameWithColor('Alibi')} ลบ${typeSet.has('Accusation') ? 'ข้อกล่าวหา' : 'หลักฐาน'} ${selectedCards.length} ใบของ <b>${targetPlayer.name}</b>`, 'green', true);
          // แจ้งเป้าหมายว่าถูกใช้การ์ด
          if (room.players[target] && room.players[target].alive) {
              game.io.to(room.players[target].id).emit('card used on you', player.name, 'Alibi', game.CARD_DESCRIPTION_THAI?.['Alibi'] || 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ');
          }
          // การ์ด Alibi ถูกลบออกจากมือแล้วใน playCard function
          // ไม่ต้องลบอีกครั้ง
          game.io.to(player.id).emit('update hand', player.hand);
          delete room.awaitingAlibiSelection;
          player.hasPlayedCardsThisTurn = true;
          game.io.to(player.id).emit('disable draw button');
          if (game.canAutoEndTurn(room, player)) {
              game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดในมือหมดแล้ว จบเทิร์นอัตโนมัติ`, 'orange', true);
              game.setNextTurn(room);
          } else {
              game.emitRoomState(room.name);
          }
      });

  socket.on('cancel alibi selection', () => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          const player = room.players[socket.uniqueId];
          if (!player || !player.alive || !room.awaitingAlibiSelection) return;
          const { selector, card: originalCard } = room.awaitingAlibiSelection;
          if (selector !== socket.uniqueId) return;
          
          // คืนการ์ด Alibi กลับไปในมือ (เพราะถูกลบออกไปแล้วใน playCard function)
          // สร้างการ์ด Alibi ในรูปแบบที่ถูกต้อง
          const alibiCard = { 
              name: 'Alibi', 
              color: 'Green', 
              value: 1,
              description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ'
          };
          const returnedCard = originalCard || alibiCard;
          const discardedIndex = room.discardPile.lastIndexOf(returnedCard);
          if (discardedIndex >= 0) room.discardPile.splice(discardedIndex, 1);
          player.hand.push(returnedCard);
          player.handSize = player.hand.length; // อัปเดต handSize
          game.io.to(player.id).emit('update hand', player.hand);
          
          // ลบ state การรอเลือก
          delete room.awaitingAlibiSelection;
          
          // อัปเดตสถานะเกม
          game.emitRoomState(room.name);
          
          // แจ้งผู้เล่น
          game.io.to(player.id).emit('game message', 'ยกเลิกการใช้การ์ด Alibi', 'orange');
      });

  socket.on('swap hand cards', (fromIdx, toIdx) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          
          const room = game.rooms[roomName];
          if (!room || room.gameOver || !room.players[socket.uniqueId]?.alive) return;
          
          const player = room.players[socket.uniqueId];
          if (fromIdx >= 0 && fromIdx < player.hand.length && 
              toIdx >= 0 && toIdx < player.hand.length) {
              
              // สลับการ์ดในมือ
              const temp = player.hand[fromIdx];
              player.hand[fromIdx] = player.hand[toIdx];
              player.hand[toIdx] = temp;
              
              // อัปเดต handSize
              player.handSize = player.hand.length;
              
              // ส่งข้อมูลอัปเดตไปยังผู้เล่น
              game.emitRoomState(room.name);
          }
      });
};
