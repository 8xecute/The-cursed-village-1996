// rooms: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function deleteRoom(roomName, { notify = true, broadcast = true } = {}) {
      const room = game.rooms[roomName];
      delete game.roomLastActive[roomName];
      if (!room) return false;

      // Remove the room first so disconnect callbacks cannot act on stale state.
      delete game.rooms[roomName];
      room.gameOver = true;
      clearInterval(room.phaseInterval);
      clearTimeout(room.confessionTimer);
      clearTimeout(room.nightActionTimeout);
      room.phaseInterval = room.confessionTimer = room.nightActionTimeout = null;
      for (const player of Object.values(room.players || {})) {
          clearTimeout(player.disconnectTimeout);
          player.disconnectTimeout = null;
          const returning = game.io.sockets.sockets.get(player.returnSocketId);
          if (returning) {
              returning.pendingReturnRoom = null;
              if (notify) returning.emit('room left');
          }
      }
      const members = [...(game.io.sockets.adapter.rooms.get(roomName) || [])];
      for (const socketId of members) {
          const member = game.io.sockets.sockets.get(socketId);
          if (member?.currentRoom === roomName) {
              member.currentRoom = null;
              if (notify) member.emit('room left');
          }
      }
      game.io.in(roomName).socketsLeave(roomName);
      for (const [uniqueId, connection] of game.botClients) {
          if (connection.roomName !== roomName) continue;
          game.botClients.delete(uniqueId);
          connection.socket.disconnect();
      }
      if (broadcast) game.broadcastActiveRooms();
      return true;
  }

  function generateRoomCode() {
      return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  function getPublicRoomsList() {
      return Object.values(game.rooms)
          .filter(room => room && Object.keys(room.players || {}).length > 0)
          .map(room => ({
              name: room.name,
              playerCount: Object.keys(room.players || {}).length,
              maxPlayers: game.PLAYER_LIMIT,
              gameStarted: !!room.gameStarted,
              gameOver: !!room.gameOver,
              hostName: room.players?.[room.hostUniqueId]?.name || 'Unknown'
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
  }

  function broadcastActiveRooms() {
      game.io.emit('active rooms list', game.getPublicRoomsList());
  }

  function handlePlayerDisconnection(room, playerUniqueId, playerName, isDisconnect) {
      // Check if this was the host
      if (room.hostUniqueId === playerUniqueId) {
          // Bots cannot own a room; transfer to a human or remove orphaned bots.
          const remainingPlayers = Object.values(room.players).filter(p => p.uniqueId !== playerUniqueId && !p.isBot);
          if (remainingPlayers.length > 0) {
              const newHost = remainingPlayers[0];
              room.hostUniqueId = newHost.uniqueId;
              newHost.isHost = true;
              game.sendGameMessage(room.name, `${newHost.name} กลายเป็นผู้ดูแลห้องใหม่.`, 'blue', true);
          } else {
              Object.values(room.players).filter(p => p.isBot).forEach(bot => {
                  clearTimeout(bot.disconnectTimeout);
                  delete room.players[bot.uniqueId];
                  const connection = game.botClients.get(bot.uniqueId);
                  game.botClients.delete(bot.uniqueId);
                  connection?.socket.disconnect();
              });
              room.hostUniqueId = null;
              // No human owner remains to manage the room.
              if (Object.keys(room.players).length === 0) {
                  game.finishGame(room, 'None (All players left)', 'ผู้เล่นทั้งหมดออกจากเกมแล้ว. เกมจบลง.', 'grey');
              }
          }
      }

      // Check if game should continue
      if (room.gameStarted && !room.gameOver) {
          const alivePlayers = game.getAlivePlayers(room);
          
          // If less than 2 alive players, evaluate win condition or end game
          if (alivePlayers.length < 2) {
              game.checkWinCondition(room);
              if (!room.gameOver) {
                  game.finishGame(room, 'None (Not enough players)', 'ผู้เล่นเหลือน้อยเกินไป เกมจบลง.', 'red');
              }
          } else {
              // Check win conditions
              game.checkWinCondition(room);
          }
      }

      // Update room state for remaining players
      game.emitRoomState(room.name);
  }

  return { deleteRoom, generateRoomCode, getPublicRoomsList, broadcastActiveRooms, handlePlayerDisconnection };
};
