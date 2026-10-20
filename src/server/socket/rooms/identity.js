const { usageLog } = require('../../usage-log');
module.exports = function registerRoomIdentity(socket, game) {
  socket.on('register uniqueId', (uniqueId, playerName) => {
          const existingRoom = Object.values(game.rooms).find(room => room && room.players && room.players[uniqueId]);
          const existingPlayer = existingRoom?.players?.[uniqueId];
          const botToken = socket.handshake.auth?.botToken;
          if ((botToken && botToken !== existingPlayer?.botToken) ||
              (existingPlayer?.isBot && !existingPlayer.isReplacementBot && botToken !== existingPlayer.botToken)) {
              socket.disconnect(true);
              return;
          }
          if (existingPlayer?.isReplacementBot && botToken !== existingPlayer.botToken) {
              socket.uniqueId = uniqueId;
              socket.pendingReturnRoom = existingRoom.name;
              existingPlayer.returnSocketId = socket.id;
              game.io.to(socket.id).emit('game message', 'กำลังรอบอททำแอ็กชันปัจจุบันให้เสร็จ แล้วคืนการควบคุมให้คุณ', 'orange');
              game.restoreReplacementPlayers(existingRoom);
              return;
          }
          socket.uniqueId = uniqueId;
          usageLog('player_registered', { connectionId: socket.id, playerId: uniqueId });
          console.log(`Socket ${socket.id} registered with uniqueId: ${uniqueId}`);
          if (playerName && playerName !== '') {
              console.log(`Player connected: ${playerName}`);
          }

          // Look for existing room where this uniqueId belongs
          if (existingRoom) {
              const player = existingRoom.players[uniqueId];
              if (player) {
                  game.handlePlayerReconnection(socket, existingRoom, player);
                  game.broadcastActiveRooms();
                  return;
              }
          }

          // Look for existing spectator room where this uniqueId belongs
          const existingSpecRoom = Object.values(game.rooms).find(room =>
              room && room.spectators && room.spectators[uniqueId]
          );
          if (existingSpecRoom) {
              const spec = existingSpecRoom.spectators[uniqueId];
              if (spec) {
                  if (playerName && playerName.trim()) {
                      spec.name = playerName.trim();
                  }
                  game.handleSpectatorReconnection(socket, existingSpecRoom, spec);
                  game.broadcastActiveRooms();
                  return;
              }
          }

          // If not reconnected to existing room, prompt name input on client
          game.io.to(socket.id).emit('request player name');
      });

  socket.on('set player name', (playerName) => {
          if (!socket.uniqueId) {
              console.error('Unique ID not registered before setting name.');
              return;
          }
          if (typeof playerName !== 'string' || !playerName.trim()) return;
          const name = playerName.trim();
          for (const roomName in game.rooms) {
              const room = game.rooms[roomName];
              const player = room.players[socket.uniqueId];
              if (!player) continue;
              if (player.id !== socket.id) return;
              if (room.gameStarted) {
                  game.io.to(socket.id).emit('game message', 'เปลี่ยนชื่อได้ในล็อบบี้ก่อนเริ่มเกมเท่านั้น', 'red');
                  return;
              }
              const previousName = player.name;
              player.name = name;
              socket.data.usageName = name;
              usageLog('player_name_changed', { connectionId: socket.id, playerId: socket.uniqueId, roomName, previousName, playerName: name });
              game.emitRoomState(roomName);
              game.broadcastActiveRooms();
              return;
          }

          // If player already has a name set (e.g., from localStorage on new connection)
          // update it on the server side or ensure consistency.
          // This scenario handles a fresh connection where client sends stored name.
          socket.data.usageName = name;
          usageLog('player_name_set', { connectionId: socket.id, playerId: socket.uniqueId, playerName: name });
          // No direct player object exists here yet until they join a room
      });


};
