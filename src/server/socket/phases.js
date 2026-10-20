module.exports = function registerHandlers(socket, game) {
  socket.on('confirm life setup', setupId => {
      if (socket.currentRoom) game.confirmLifeSetup(socket.currentRoom, socket.uniqueId, setupId);
  });
  socket.on('swap tryal cards', (from, to, setupId) => {
      if (socket.currentRoom) game.swapSetupLives(socket.currentRoom, socket.uniqueId, from, to, setupId);
  });
  socket.on('start game', (roomName) => {
          const room = game.rooms[roomName];
          if (room && room.hostUniqueId === socket.uniqueId) {
              game.startGame(roomName);
          } else {
              game.io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์เริ่มเกม.', 'red');
          }
      });

  socket.on('set phase times', (roomName, dayTime, nightTime) => {
          const room = game.rooms[roomName];
          if (room && room.hostUniqueId === socket.uniqueId) {
              room.phaseConfig.DAY = dayTime * 1000;
              room.phaseConfig.NIGHT = nightTime * 1000; // This is event duration, not full phase
              game.io.to(socket.id).emit('game message', 'ตั้งเวลาเฟสแล้ว.', 'blue');
              game.emitRoomState(roomName); // Update clients with new phase times
          } else {
              game.io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์ตั้งเวลา.', 'red');
          }
      });

  socket.on('force next phase', (roomName) => {
          const room = game.rooms[roomName];
          if (room && room.hostUniqueId === socket.uniqueId) {
              game.changePhase(roomName);
              game.io.to(socket.id).emit('game message', 'บังคับไปยังเฟสถัดไป.', 'blue');
          } else {
              game.io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์บังคับเฟส.', 'red');
          }
      });
};
