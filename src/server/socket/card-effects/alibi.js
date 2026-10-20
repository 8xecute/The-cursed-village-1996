module.exports = function registerAlibiHandlers(socket, game) {
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
              game.io.to(room.players[target].id).emit('card used on you', player.name, 'Alibi', game.CARD_DESCRIPTION_THAI?.['Alibi'] || 'ลบข้อกล่าวหารวมสูงสุด 3 แต้ม');
          }
          // การ์ด Alibi ถูกลบออกจากมือแล้วใน playCard function
          // ไม่ต้องลบอีกครั้ง
          game.io.to(player.id).emit('update hand', player.hand);
          delete room.awaitingAlibiSelection;
          player.hasPlayedCardsThisTurn = true;
          game.io.to(player.id).emit('disable draw button');
          if (!game.finishEmptyHandTurn(room)) {
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
              description: 'ลบข้อกล่าวหารวมสูงสุด 3 แต้ม: ข้อกล่าวหา (+1) สูงสุด 3 ใบ หรือหลักฐาน (+3) 1 ใบ'
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

};
