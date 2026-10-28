module.exports = function registerHandlers(socket, game) {
  socket.on('send witch chat message', (roomName, message) => {
          if (roomName !== socket.currentRoom || typeof message !== 'string') return;
          message = message.trim().slice(0, 100);
          if (!message) return;
          const room = game.rooms[roomName];
          if (!room) return;
          const player = room.players[socket.uniqueId];
          if (!player || player.id !== socket.id || !player.hasBeenWitch || !player.alive) return; // เฉพาะปอบที่ยังมีชีวิตเท่านั้น
          if (room.currentPhase !== 'NIGHT') return; // ใช้งานได้เฉพาะกลางคืน
          const timestamp = Date.now();
          const entry = { senderName: player.name, message, timestamp };
          if (!room.witchChatHistory) room.witchChatHistory = [];
          room.witchChatHistory.push(entry);
          if (room.witchChatHistory.length > 100) room.witchChatHistory.shift();
          // ส่งให้เฉพาะปอบในห้อง
          Object.values(room.players).forEach(p => {
              if (p.hasBeenWitch && p.id) {
                  game.io.to(p.id).emit('witch chat message', player.name, message, timestamp);
              }
          });
      });

  socket.on('request witch chat history', (roomName) => {
          const room = game.rooms[roomName];
          if (!room) return;
          const player = room.players[socket.uniqueId];
          if (!player || !player.hasBeenWitch) return;
          if (room.currentPhase !== 'NIGHT') {
              game.io.to(socket.id).emit('witch chat history', []);
              return;
          }
          game.io.to(socket.id).emit('witch chat history', room.witchChatHistory || []);
      });

  socket.on('request game message history', (roomName) => {
          const room = game.rooms[roomName];
          if (!room) return;
          game.io.to(socket.id).emit('game message history', room.gameMessageHistory || []);
      });
};
