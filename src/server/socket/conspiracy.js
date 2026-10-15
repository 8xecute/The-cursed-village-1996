module.exports = function registerHandlers(socket, game) {
  socket.on('select blackcat tryal', (targetUniqueIdOrCardIndex, maybeCardIndex) => {
          // Only allow if awaitingConspiracySelection and this socket is the selector
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver || !room.awaitingConspiracySelection) return;
          if (room.awaitingConspiracySelection.selector !== socket.uniqueId) return;
          const targetUniqueId = maybeCardIndex === undefined
              ? room.awaitingConspiracySelection.target
              : targetUniqueIdOrCardIndex;
          const cardIndex = maybeCardIndex === undefined
              ? targetUniqueIdOrCardIndex
              : maybeCardIndex;
          if (room.awaitingConspiracySelection.target !== targetUniqueId) return;
          const player = room.players[socket.uniqueId];
          const bcHolder = room.players[targetUniqueId];
          if (!player || !player.alive) return;
          // --- เช็คว่าผู้เล่นยังมี Black Cat จริง ---
          if (!bcHolder || !bcHolder.alive || !bcHolder.inPlayCards.some(card => card.name === 'Black Cat')) {
              game.sendGameMessage(room.name, 'เครื่องเซ่นถูกย้ายหรือถูกลบออกไปแล้ว จึงไม่ต้องเปิดการ์ดชีวิต', 'grey');
              delete room.awaitingConspiracySelection;
              game.emitRoomState(room.name);
              game.promptTryalCardSelectionToLeft(roomName);
              return;
          }
          if (!bcHolder || bcHolder.tryalCards.length <= cardIndex) return;
          // Reveal the selected Tryal Card
          const revealedCard = bcHolder.tryalCards.splice(cardIndex, 1)[0];
          bcHolder.revealedTryalCardIndexes.add(revealedCard.name);
          game.sendGameMessage(room.name, `<b>${player.name}</b> ต้องเปิดการ์ดชีวิต ${bcHolder.name}`, 'orange', true);
          // เพิ่มข้อความแจ้งว่าถูกเปิดการ์ดชีวิตอะไร
          game.sendGameMessage(room.name, `<b>${bcHolder.name}</b> ถูกเปิดการ์ดชีวิต: ${game.getCardNameWithColor(revealedCard.name)}`, 'gold', true);
          game.io.to(bcHolder.id).emit('update tryal cards initial', bcHolder.tryalCards);
          if (revealedCard.name === 'Witch') {
              bcHolder.isWitch = true;
              game.sendGameMessage(room.name, `${bcHolder.name} คือปอบ!`, 'red', true);
              // ตายทันทีเมื่อเปิด Witch
              game.sendGameMessage(room.name, `<b>${bcHolder.name}</b> ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'red', true);
              game.handlePlayerDeath(room, bcHolder, { cause: 'revealed_witch' });
              game.emitRoomState(room.name);
              game.checkWinCondition(room);
              delete room.awaitingConspiracySelection;
              if (room.gameOver) return;
              // ดำเนิน flow เลือกการ์ดชีวิตซ้ายมือผู้เล่นต่อ
              game.promptTryalCardSelectionToLeft(roomName);
              // setNextTurn(room); // <--- ลบออก ไม่ต้องข้ามเทิร์นซ้ำ
              return;
          }

          game.eliminatePlayerWithoutLifeCards(room, bcHolder);
          if (room.gameOver) {
              delete room.awaitingConspiracySelection;
              return;
          }
          
          // Check win condition after revealing Tryal Card
          game.checkWinCondition(room);
          
          // Clean up
          delete room.awaitingConspiracySelection;
          
          // Continue Conspiracy effect
          game.promptTryalCardSelectionToLeft(roomName);
          
          // รีเซ็ต blackCatHolderAlreadyActedThisDay เพื่อให้เริ่มเทิร์นปกติ
          room.blackCatHolderAlreadyActedThisDay = false;
      });

  socket.on('select left tryal', (index) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          const room = game.rooms[roomName];
          if (!room || room.gameOver) return;
          // Only allow if Conspiracy is active
          if (!room.conspiracyTryalSelections) return;
          const alivePlayers = game.getAlivePlayers(room);
          const currentPlayer = room.players[socket.uniqueId];
          if (!currentPlayer || !currentPlayer.alive) return;
          // Find left player
          const playerOrder = alivePlayers.map(p => p.uniqueId);
          const idx = playerOrder.indexOf(currentPlayer.uniqueId);
          if (idx === -1) return;
          const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
          const leftPlayer = room.players[playerOrder[leftIdx]];
          if (!leftPlayer || leftPlayer.tryalCards.length === 0) {
              // No card to take
              room.conspiracyTryalSelections[currentPlayer.uniqueId] = null;
              game.emitRoomState(roomName);
              return;
          }
          // Prevent double selection
          if (room.conspiracyTryalSelections[currentPlayer.uniqueId] !== undefined) return;
          // Validate index
          if (index < 0 || index >= leftPlayer.tryalCards.length) return;
          // --- แค่บันทึก index ที่เลือกไว้ ยังไม่ย้ายไพ่จริง ---
          room.conspiracyTryalSelections[currentPlayer.uniqueId] = index;
          game.emitRoomState(roomName);
          // If all alive players have made their selection, ดำเนินการย้ายไพ่จริง
          const allDone = alivePlayers.every(p => room.conspiracyTryalSelections[p.uniqueId] !== undefined);
          if (allDone) {
              // 1. เก็บ mapping: uniqueId → index ที่ถูกขวามือดึงออกไป
              const removedIndexes = {};
              alivePlayers.forEach((player, idx) => {
                  const rightIdx = (idx + 1) % alivePlayers.length;
                  const rightPlayer = alivePlayers[rightIdx];
                  const selIndex = room.conspiracyTryalSelections[rightPlayer.uniqueId];
                  removedIndexes[player.uniqueId] = selIndex;
              });
              // 2. เตรียมเก็บไพ่ที่ต้องย้าย
              const takenCards = {};
              alivePlayers.forEach((player, idx) => {
                  const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                  const leftPlayer = alivePlayers[leftIdx];
                  const selIndex = room.conspiracyTryalSelections[player.uniqueId];
                  if (selIndex !== null && selIndex !== undefined && leftPlayer.tryalCards.length > selIndex) {
                      takenCards[player.uniqueId] = leftPlayer.tryalCards[selIndex];
                  }
              });
              // 3. ลบไพ่ที่ถูกเลือกออกจากซ้ายมือ (จากหลังไปหน้าเพื่อไม่ให้ index เพี้ยน)
              alivePlayers.forEach((player, idx) => {
                  const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                  const leftPlayer = alivePlayers[leftIdx];
                  const selIndex = room.conspiracyTryalSelections[player.uniqueId];
                  if (selIndex !== null && selIndex !== undefined && leftPlayer.tryalCards.length > selIndex) {
                      leftPlayer.tryalCards.splice(selIndex, 1);
                  }
              });
              // 4. ใส่ไพ่ที่ได้มาในตำแหน่งที่ถูกขวามือดึงออกไป
              alivePlayers.forEach((player, idx) => {
                  const card = takenCards[player.uniqueId];
                  const insertIndex = removedIndexes[player.uniqueId];
                  const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                  const leftPlayer = alivePlayers[leftIdx];
                  if (card) {
                      if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= player.tryalCards.length) {
                          player.tryalCards.splice(insertIndex, 0, card);
                      } else {
                          player.tryalCards.push(card);
                      }
                      // เพิ่ม game message
                      game.sendGameMessage(room.name, `<b>${player.name}</b> เลือกการ์ดชีวิตใบที่ ${room.conspiracyTryalSelections[player.uniqueId]+1} จาก ${leftPlayer.name}`, 'gold', true);
                      // --- อัพเดทสถานะถ้าได้ Witch หรือ Constable ---
                      if (card.name === 'Witch') {
                          player.isWitch = true;
                          player.hasBeenWitch = true;
                          if (!(player.knownWitchTeammates instanceof Set)) player.knownWitchTeammates = new Set();
                          player.knownWitchTeammates.add(leftPlayer.uniqueId);
                          if (!room.infectionLog) room.infectionLog = [];
                          room.infectionLog.push({
                              from: leftPlayer.name,
                              to: player.name,
                              card: 'Witch',
                              day: room.dayNumber,
                              timestamp: Date.now(),
                          });
                          game.io.to(player.id).emit('update tryal cards initial', player.tryalCards, leftPlayer.name);
                          // แสดง popup ปอบทุกครั้งที่ได้รับการ์ดปอบจาก Conspiracy
                          game.io.to(player.id).emit('show witch popup', { senderName: leftPlayer.name });
                      } else {
                          if (card.name === 'Constable') {
                              player.isConstable = true;
                          }
                          game.io.to(player.id).emit('update tryal cards initial', player.tryalCards);
                      }
                  }
              });
              alivePlayers.forEach(player => game.eliminatePlayerWithoutLifeCards(room, player));
              delete room.conspiracyTryalSelections;
              room.awaitingLeftTryalSelections = false;
              game.checkWinCondition(room);
              if (room.gameOver) return;
              // --- setNextTurn ต่อจากคนจั่ว ---
              if (room.conspiracyDrawer) {
                  game.setNextTurn(room, room.conspiracyDrawer, true);
                  room.conspiracyDrawer = null;
              } else {
                  game.setNextTurn(room);
              }
              game.emitRoomState(roomName);
              // ... (logic เดิม)
              return;
          }
      });
};
