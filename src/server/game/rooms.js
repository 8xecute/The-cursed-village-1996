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

  function handleSpectatorReconnection(socket, room, spec) {
      spec.id = socket.id;
      spec.connected = true;
      socket.uniqueId = spec.uniqueId;
      socket.currentRoom = room.name;
      socket.join(room.name);
      game.io.to(socket.id).emit('room joined', room.name);
      game.io.to(socket.id).emit('joined as spectator', { roomName: room.name, name: spec.name });
      game.emitRoomState(room.name);
  }

  function handlePlayerReconnection(socket, room, player) {
      if (player.disconnectTimeout) {
          clearTimeout(player.disconnectTimeout);
          player.disconnectTimeout = null;
      }
      player.id = socket.id;
      player.connected = true;
      socket.uniqueId = player.uniqueId;
      socket.currentRoom = room.name;
      socket.join(room.name);
      game.io.to(socket.id).emit('room joined', room.name);

      // Send private player data before emitting room state
      game.io.to(socket.id).emit('update hand', player.hand || []);
      game.io.to(socket.id).emit('update tryal cards initial', player.tryalCards || []);
      if (player.revealedTryalCardIndexes) {
          game.io.to(socket.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes));
      }
      if (player.inPlayCards) {
          game.io.to(socket.id).emit('update in play cards', player.inPlayCards);
      }

      game.emitRoomState(room.name);
      game.sendGameMessage(room.name, `<b>${player.name}</b> ได้เชื่อมต่อกลับเข้ามาในเกม.`, 'blue');

      if (!room.gameStarted) {
          return;
      }

      // Restore active state prompts if game is in progress
      // 0. Black Cat Initial Assignment (Before Day 1 / Night 1)
      if (room.isAssigningBlackCat && player.isWitch) {
          const potentialTargets = game.getAlivePlayers(room);
          game.io.to(socket.id).emit('popup assign black cat', potentialTargets.map(p => ({ uniqueId: p.uniqueId, name: p.name })));
      }

      // 1. NIGHT Phase
      if (room.currentPhase === 'NIGHT' && player.alive) {
          const witches = game.getAlivePlayers(room).filter(p => p.isWitch || p.hasBeenWitch);
          const constables = game.getAlivePlayers(room).filter(p => p.isConstable);
          const witchHasActed = game.hasNightActionChosen(room, 'witchKill');

          if (player.hasBeenWitch && !witchHasActed) {
              game.io.to(socket.id).emit('prompt witch kill');
          } else if (player.isConstable && (witchHasActed || witches.length === 0) && !game.hasNightActionChosen(room, 'constableSave')) {
              game.io.to(socket.id).emit('prompt constable action');
          }
      }

      // 2. PRE_DAWN Phase
      if (room.currentPhase === 'PRE_DAWN' && player.alive) {
          game.sendDeckInfo(room.name);
      }

      // 3. Forced Tryal Reveal (7 Accusation points or Witness)
      if (room.playerForcedToRevealTryal) {
          const targetUniqueId = room.playerForcedToRevealTryal;
          const selectorUniqueId = room.playerForcedToRevealSelector;
          const targetPlayer = room.players[targetUniqueId];
          const selectorPlayer = room.players[selectorUniqueId];

          if (player.uniqueId === selectorUniqueId && targetPlayer) {
              game.io.to(socket.id).emit('prompt select accused tryal', {
                  accusedUniqueId: targetUniqueId,
                  tryalCount: targetPlayer.tryalCards.length
              });
          } else if (player.uniqueId === targetUniqueId && selectorPlayer) {
              game.io.to(socket.id).emit('forced reveal notice', {
                  byPlayerName: selectorPlayer.name,
                  reason: 'accusation_threshold',
                  points: room.accusedPlayers[targetUniqueId] || 0
              });
          }
      }

      // 4. Curse target selection
      if (room.awaitingCurseSelection && room.awaitingCurseSelection.selector === player.uniqueId) {
          const targetP = room.players[room.awaitingCurseSelection.target];
          if (targetP) {
              const blueCards = targetP.inPlayCards.filter(c => c.color === 'Blue');
              game.io.to(socket.id).emit('prompt select curse target', {
                  targetUniqueId: room.awaitingCurseSelection.target,
                  blueCards: blueCards.map(c => ({ name: c.name }))
              });
          }
      }

      // 5. Conspiracy Black Cat selection
      if (room.awaitingConspiracySelection && room.awaitingConspiracySelection.selector === player.uniqueId) {
          const bcHolder = room.players[room.blackCatHolder];
          if (bcHolder) {
              game.io.to(socket.id).emit('prompt select blackcat tryal', {
                  blackCatHolder: room.blackCatHolder,
                  tryalCount: bcHolder.tryalCards.length,
                  blackCatHolderName: bcHolder.name,
                  fromConspiracyDraw: true
              });
          }
      }

      // 6. Conspiracy Left Tryal selection
      if (room.awaitingLeftTryalSelections && player.alive) {
          if (room.conspiracyTryalSelections && room.conspiracyTryalSelections[player.uniqueId] === undefined) {
              const alivePlayers = game.getAlivePlayers(room);
              const idx = alivePlayers.findIndex(p => p.uniqueId === player.uniqueId);
              if (idx !== -1) {
                  const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                  const leftPlayer = alivePlayers[leftIdx];
                  if (leftPlayer) {
                      game.io.to(socket.id).emit('prompt select left tryal', {
                          leftPlayerUniqueId: leftPlayer.uniqueId,
                          leftPlayerName: leftPlayer.name,
                          leftPlayerTryalCount: leftPlayer.tryalCards.length
                      });
                  }
              }
          }
      }

      // 7. Game Over summary
      if (room.gameOver && room.gameSummary) {
          game.io.to(socket.id).emit('game over summary', room.gameSummary);
      }
  }

  return { deleteRoom, generateRoomCode, getPublicRoomsList, broadcastActiveRooms, handlePlayerDisconnection, handleSpectatorReconnection, handlePlayerReconnection };
};
