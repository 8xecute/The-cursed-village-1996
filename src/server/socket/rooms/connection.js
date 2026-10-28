module.exports = function registerRoomConnection(socket, game) {
  socket.on('leave room', () => {
          if (socket.pendingReturnRoom) {
              const pending = game.rooms[socket.pendingReturnRoom]?.players[socket.uniqueId];
              if (pending?.returnSocketId === socket.id) pending.returnSocketId = null;
              socket.pendingReturnRoom = null;
              game.io.to(socket.id).emit('room left');
              return;
          }
          const roomName = socket.currentRoom;
          if (roomName && game.rooms[roomName]) {
              const room = game.rooms[roomName];
              const playerUniqueId = socket.uniqueId;

              if (room.spectators && room.spectators[playerUniqueId]) {
                  const specName = room.spectators[playerUniqueId].name;
                  delete room.spectators[playerUniqueId];
                  socket.leave(roomName);
                  socket.currentRoom = null;
                  game.io.to(socket.id).emit('room left');
                  game.sendGameMessage(roomName, `👁️ ${specName} เลิกเป็นผู้ชมแล้ว.`, 'gray');
                  game.emitRoomState(roomName);
                  return;
              }

              const leavingPlayer = room.players[playerUniqueId];
              if (leavingPlayer && leavingPlayer.id !== socket.id) return;
              if (room.gameStarted && !room.gameOver && leavingPlayer && !leavingPlayer.isBot) {
                  socket.leave(roomName);
                  socket.currentRoom = null;
                  game.io.to(socket.id).emit('room left');
                  game.startReplacementBot(room, leavingPlayer);
                  return;
              }
              const playerName = room.players[playerUniqueId]?.name || 'Unknown Player';

              clearTimeout(room.players[playerUniqueId]?.disconnectTimeout);
              delete room.players[playerUniqueId];
              socket.leave(roomName);
              socket.currentRoom = null;
              game.io.to(socket.id).emit('room left');
              game.sendGameMessage(roomName, `${playerName} ออกจากห้องแล้ว.`, 'orange');

              // Use helper function to handle disconnection logic
              game.handlePlayerDisconnection(room, playerUniqueId, playerName, false);
              if (Object.keys(room.players).length === 0) {
                  game.deleteRoom(roomName, { broadcast: false });
              }
              game.broadcastActiveRooms();
          } else {
              socket.currentRoom = null;
              game.io.to(socket.id).emit('room left');
          }
      });

  socket.on('disconnect', () => {
          console.log('User disconnected:', socket.id);
          const roomName = socket.currentRoom;
          if (roomName && game.rooms[roomName]) {
              const room = game.rooms[roomName];
              const playerUniqueId = socket.uniqueId;

              if (room.spectators && room.spectators[playerUniqueId]) {
                  if (room.spectators[playerUniqueId].id === socket.id) {
                      delete room.spectators[playerUniqueId];
                      game.emitRoomState(roomName);
                  }
                  return;
              }

              const player = room.players[playerUniqueId];
              if (player) {
                  // If player has already reconnected on another socket, ignore this stale disconnect!
                  if (player.id !== socket.id) {
                      console.log(`Ignoring disconnect from stale socket ${socket.id} for player ${player.name} (active socket: ${player.id})`);
                      return;
                  }

                  const playerName = player.name;
                  
                  // Don't immediately remove the player - allow for reconnection
                  player.connected = false;
                  player.lastDisconnectTime = Date.now();
                  if (player.isReplacementBot) {
                      player.reconnectDeadline = null;
                      game.emitRoomState(room.name);
                      return; // Internal bot reconnects itself; never delete its seat.
                  }
                  player.reconnectDeadline = Date.now() + game.RECONNECT_TIMEOUT;

                  if (player.disconnectTimeout) {
                      clearTimeout(player.disconnectTimeout);
                      player.disconnectTimeout = null;
                  }
                  
                  game.sendGameMessage(room.name, `${playerName} ขาดการเชื่อมต่อ. (ระบบจะรอเชื่อมต่อใหม่ 2 นาที)`, 'orange');
                  game.emitRoomState(room.name);
                  
                  // Set a timeout to remove the player if they don't reconnect
                  player.disconnectTimeout = setTimeout(() => {
                      if (game.rooms[roomName] !== room) return;
                      if (room.players[playerUniqueId] && !room.players[playerUniqueId].connected) {
                          if (room.gameStarted && !room.gameOver) {
                              game.startReplacementBot(room, room.players[playerUniqueId]);
                              return;
                          }
                          // Player hasn't reconnected, remove them
                          const pName = room.players[playerUniqueId].name;
                          delete room.players[playerUniqueId];
                          game.sendGameMessage(room.name, `${pName} ออกจากเกมแล้วเนื่องจากขาดการเชื่อมต่อนานเกิน 2 นาที.`, 'red');
                          game.handlePlayerDisconnection(room, playerUniqueId, pName, true);
                          if (Object.keys(room.players).length === 0) {
                              game.deleteRoom(roomName, { broadcast: false });
                          }
                          game.broadcastActiveRooms();
                      }
                  }, game.RECONNECT_TIMEOUT); // 2 minutes timeout for reconnection
              }
          }
      });
};
