// Restores socket membership, private state, and pending prompts for a returning viewer.
module.exports = function createReconnectionServices(game) {
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
      player.reconnectDeadline = null;
      socket.uniqueId = player.uniqueId;
      socket.currentRoom = room.name;
      socket.join(room.name);
      game.io.to(socket.id).emit('room joined', room.name);

      // Send private player data before emitting room state
      game.io.to(socket.id).emit('update hand', player.hand || []);
      game.io.to(socket.id).emit('update tryal cards initial', room.currentPhase === 'SETUP' && room.lifeSetup?.stage !== 'arrange' ? (player.tryalCards || []).map(() => ({ name: null, type: null })) : player.tryalCards || []);
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

      if (room.awaitingAlibiSelection?.selector === player.uniqueId) {
          const target = room.players[room.awaitingAlibiSelection.target];
          const redCards = (target?.inPlayCards || []).map((card, index) => ({ ...card, index }))
              .filter(card => card.color === 'Red' && ['Accusation', 'Evidence'].includes(card.name));
          game.io.to(socket.id).emit('prompt select alibi removal', { targetUniqueId: target?.uniqueId, redCards });
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


  return { handleSpectatorReconnection, handlePlayerReconnection };
};
