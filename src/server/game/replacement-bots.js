// Transfers a disconnected player's seat to a bot and restores it at a safe boundary.
module.exports = function createReplacementBotServices(game) {
  function startReplacementBot(room, player) {
      if (!room.gameStarted || room.gameOver || !player || player.isBot) return;
      clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = null;
      player.reconnectDeadline = null;
      player.isReplacementBot = true;
      player.isBot = true;
      player.connected = false;
      player.botToken = game.uuidv4();
      player.id = `replacement-${player.uniqueId}`;
      const address = game.server.address();
      const port = address && typeof address === 'object' ? address.port : Number(game.PORT);
      const bot = game.createBotClient({ url: `http://127.0.0.1:${port}`, uniqueId: player.uniqueId,
          token: player.botToken, name: player.name });
      game.botClients.set(player.uniqueId, { socket: bot, roomName: room.name });
      if (player.isHost) {
          const host = Object.values(room.players).find(other => other.uniqueId !== player.uniqueId && !other.isBot && other.connected);
          if (host) {
              player.isHost = false;
              host.isHost = true;
              room.hostUniqueId = host.uniqueId;
              game.sendGameMessage(room.name, `${host.name} รับหน้าที่หัวห้อง`, 'blue');
          }
      }
      game.sendGameMessage(room.name, `${player.name}: บอทรับช่วงแทน โดยคงไพ่ บทบาท และที่นั่งเดิม`, 'orange', true);
      game.emitRoomState(room.name);
      game.broadcastActiveRooms();
  }

  function replacementActionPending(room, player) {
      const id = player.uniqueId;
      if (!room.gameStarted || room.gameOver || !player.alive) return false;
      if (room.pendingDraw?.playerId === id || room.awaitingCurseSelection?.selector === id ||
          room.awaitingAlibiSelection?.selector === id || room.awaitingConspiracySelection?.selector === id ||
          room.playerForcedToRevealSelector === id) return true;
      if (room.awaitingLeftTryalSelections && room.conspiracyTryalSelections?.[id] === undefined) return true;
      if (room.isAssigningBlackCat && (player.hasBeenWitch || player.isWitch)) return true;
      if (room.currentPhase === 'DAY' && room.currentTurnPlayerUniqueId === id && player.hasPlayedCardsThisTurn) return true;
      if (room.currentPhase === 'PRE_DAWN' && !room.confessionActions?.includes(id)) return true;
      if (room.currentPhase === 'NIGHT') {
          if ((player.hasBeenWitch || player.isWitch) && !game.hasNightActionChosen(room, 'witchKill') &&
              !Object.prototype.hasOwnProperty.call(room.witchNightMarks || {}, id)) return true;
          if (player.isConstable && !game.hasNightActionChosen(room, 'constableSave')) return true;
      }
      return false;
  }

  function restoreReplacementPlayers(room) {
      if (game.rooms[room.name] !== room) return;
      for (const player of Object.values(room.players)) {
          if (!player.isReplacementBot || !player.returnSocketId) continue;
          const socket = game.io.sockets.sockets.get(player.returnSocketId);
          if (!socket?.connected) { player.returnSocketId = null; continue; }
          if (replacementActionPending(room, player)) continue;
          const connection = game.botClients.get(player.uniqueId);
          game.botClients.delete(player.uniqueId);
          player.isBot = false;
          player.isReplacementBot = false;
          player.returnSocketId = null;
          player.botToken = null;
          // Revoke the bot before disconnecting so queued packets cannot act.
          player.id = socket.id;
          connection?.socket.disconnect();
          socket.pendingReturnRoom = null;
          if (room.players[room.hostUniqueId]?.isBot) {
              room.players[room.hostUniqueId].isHost = false;
              room.hostUniqueId = player.uniqueId;
              player.isHost = true;
          }
          game.handlePlayerReconnection(socket, room, player);
          game.sendGameMessage(room.name, `${player.name} กลับมาควบคุมที่นั่งแทนบอทแล้ว`, 'green', true);
          game.broadcastActiveRooms();
      }
  }


  return { startReplacementBot, restoreReplacementPlayers };
};
