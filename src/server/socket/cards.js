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

  require('./card-effects/curse')(socket, game);
  require('./card-effects/alibi')(socket, game);

  socket.on('swap hand cards', (fromIdx, toIdx) => {
          const roomName = socket.currentRoom;
          if (!roomName) return;
          
          const room = game.rooms[roomName];
          if (!room || room.gameOver || !room.players[socket.uniqueId]?.alive) return;
          
          const player = room.players[socket.uniqueId];
          if (Number.isInteger(fromIdx) && Number.isInteger(toIdx) && fromIdx >= 0 && fromIdx < player.hand.length &&
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
