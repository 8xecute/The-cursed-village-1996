// state: game services. Dependencies are injected through game.
const { assignCharacterIds } = require('./character-roster');
module.exports = function createServices(game) {
  function sendGameMessage(roomName, message, color = 'black', bold = false) {
      const room = game.rooms[roomName];
      if (room) {
          // Store message in history (keep last 100 messages)
          if (!room.gameMessageHistory) {
              room.gameMessageHistory = [];
          }
          room.gameMessageHistory.push({
              message: message,
              color: color,
              bold: bold,
              timestamp: Date.now()
          });
          if (room.gameMessageHistory.length > 100) {
              room.gameMessageHistory.shift();
          }
      }
      game.io.to(roomName).emit('game message', message, color, bold);
  }

  function emitRoomState(roomName) {
      const room = game.rooms[roomName];
      if (room && !room.replacementRestoreQueued) {
          room.replacementRestoreQueued = true;
          queueMicrotask(() => { room.replacementRestoreQueued = false; game.restoreReplacementPlayers(room); });
      }
      if (!room) return;
      if (room.gameStarted) assignCharacterIds(Object.values(room.players), game.shuffleArray);

      // Team members know one another immediately, including daytime infections.
      game.rememberWitchTeammates(room);

      const dealingLives = room.currentPhase === 'SETUP' && room.lifeSetup?.stage !== 'arrange';
      const buildPlayersStateFor = (viewer) => {
        const playersState = {};
        for (const uniqueId in room.players) {
          const player = room.players[uniqueId];
          const isSelf = !viewer?.isSpectator && viewer?.uniqueId === uniqueId;
          const viewerKnowsWitchTeam = !!(room.gameOver || (isSelf && !viewer?.isSpectator) ||
              (!viewer?.isSpectator && viewer?.hasBeenWitch));
          const revealedIndexes = new Set(player.revealedTryalCardIndexes || []);
          playersState[uniqueId] = {
              id: player.id, // socket id
              name: player.name,
              uniqueId: player.uniqueId,
              characterId: player.characterId ?? null,
              isHost: player.isHost,
              isBot: !!player.isBot,
              isReplacementBot: !!player.isReplacementBot,
              connected: !!player.connected,
              reconnectDeadline: player.reconnectDeadline || null,
              handSize: player.hand.length,
              revealedTryalCards: (player.revealedTryalCards || []).map(card => ({ name: card.name, slot: card.slot })),
              tryalCardCount: player.tryalCards.length, // Send total count of Tryal Cards
              tryalCards: player.tryalCards.map((card, index) => (
                  room.gameOver || !player.alive || (isSelf && !viewer?.isSpectator && !dealingLives) || revealedIndexes.has(index)
                      ? { name: card.name, type: card.type }
                      : { name: null, type: null }
              )),
              inPlayCards: player.inPlayCards.map(c => ({
                  name: c.name,
                  color: c.color,
                  value: c.value || 0,
              })),
              alive: player.alive,
              isSilenced: player.isSilenced,
              isWitch: room.gameOver || (isSelf && !viewer?.isSpectator) ? player.isWitch : false,
              isConstable: room.gameOver || (isSelf && !viewer?.isSpectator) ? player.isConstable : false,
              hasBeenWitch: viewerKnowsWitchTeam ? player.hasBeenWitch : false,
              // Explicitly send blackCatHolder and gavelHolder for the player list display
              accusationPoints: room.accusedPlayers[uniqueId] || 0,
              isBlackCatHolder: room.blackCatHolder === player.uniqueId,
              mustRevealTryal: room.playerForcedToRevealTryal === uniqueId,
              revealedTryalCardIndexes: Array.from(player.revealedTryalCardIndexes), // Send revealed roles as array
              isReady: !!player.isReady,
              hasPlayedCardsThisTurn: !!player.hasPlayedCardsThisTurn,
          };
        }
        return playersState;
      };

      const publicState = {
          prankGunHolderId: room.prankGunExpiresAt > Date.now() ? Object.values(room.players).find(player => player.alive && player.prankGun)?.uniqueId || null : null,
          prankGunAvailable: !room.prankGunExpiresAt,
          prankGunExpiresAt: room.prankGunExpiresAt || null,
          prankShotActive: !!room.prankShot,
          prankShot: room.prankShot || null,
          name: room.name,
          playerCount: Object.keys(room.players).length,
          maxPlayers: game.PLAYER_LIMIT,
          customWitchCardCount: room.customWitchCardCount ?? null,
          customLifeCardCount: room.customLifeCardCount ?? null,
          gameStarted: room.gameStarted,
          currentPhase: room.currentPhase,
          lifeSetup: room.lifeSetup ? { id: room.lifeSetup.id, stage: room.lifeSetup.stage,
              order: room.lifeSetup.order, count: room.lifeSetup.count, dealt: room.lifeSetup.dealt,
              total: room.lifeSetup.total, confirmed: [...room.lifeSetup.confirmed], lastDeal: room.lifeSetup.lastDeal } : null,
          phaseTimer: room.phaseTimer,
          dayNumber: room.dayNumber,
          currentTurnPlayerUniqueId: room.currentTurnPlayerUniqueId,
          currentTurnPlayerName: room.currentTurnPlayerUniqueId ? room.players[room.currentTurnPlayerUniqueId]?.name : null,
          phaseConfig: room.phaseConfig,
          confessors: room.confessors, // Players who have confessed this day
          confessionActions: room.confessionActions || [],
          playerForcedToRevealTryal: room.playerForcedToRevealTryal,
          isAssigningBlackCat: room.isAssigningBlackCat, // Flag for witch action
          gameOver: room.gameOver,
          winner: room.winner,
          gameSummary: room.gameSummary || null,
          // Add deck and discard pile information
          deckCount: room.gameDeck ? room.gameDeck.length : 0,
          discardPileCount: room.discardPile ? room.discardPile.length : 0,
          // เพิ่มสำหรับ PRE_DAWN confession popup
          confessionOrder: room.confessionOrder,
          currentConfessionIndex: room.currentConfessionIndex,
          awaitingLeftTryalSelections: !!room.awaitingLeftTryalSelections,
          leftTryalSelectedCount: room.conspiracyTryalSelections
              ? Object.keys(room.conspiracyTryalSelections).length
              : 0,
          leftTryalTotalCount: room.awaitingLeftTryalSelections
              ? game.getAlivePlayers(room).length
              : 0,
          infectionLog: room.gameOver ? (room.infectionLog || []) : [],
          deathLog: room.gameOver ? (room.deathLog || []) : [],
      };

      // --- ส่ง hand และ tryalCards ให้แต่ละผู้เล่น (เฉพาะตัวเอง) ---
      for (const uniqueId in room.players) {
          const player = room.players[uniqueId];
          if (player && player.id) {
              game.io.to(player.id).emit('room state update', {
                  ...publicState,
                  players: buildPlayersStateFor(player),
                  prankGun: player.alive && !!player.prankGun && room.prankGunExpiresAt > Date.now(),
                  confessionExempt: room.currentPhase === 'PRE_DAWN' && player.alive && game.isNightProtected(room, player),
                  ghostScareEligible: !!room.gameStarted && !room.gameOver && player.alive === false && !player.isBot && !player.isSpectator,
                  ghostScareAvailableAt: player.ghostScareAvailableAt || 0,
                  ghostScareAvailable: !!room.gameStarted && !room.gameOver && player.alive === false && !player.isBot && !player.isSpectator && !(player.ghostScareAvailableAt > Date.now()),
                  witchNightState: room.currentPhase === 'NIGHT' && player.alive && (player.hasBeenWitch || player.isWitch)
                      ? { nightId: room.witchNightId, marks: { ...(room.witchNightMarks || {}) }, committed: game.hasNightActionChosen(room, 'witchKill'),
                          members: game.getAlivePlayers(room).filter(p => p.hasBeenWitch || p.isWitch).map(p => ({ uniqueId: p.uniqueId, name: p.name, isBot: !!p.isBot })) }
                      : null,
              });
              game.io.to(player.id).emit('update hand', player.hand);
              game.io.to(player.id).emit('update tryal cards initial', dealingLives ? player.tryalCards.map(() => ({ name: null, type: null })) : player.tryalCards);
          }
      }

      // --- ส่งข้อมูลแบบ Sanitized ให้ผู้ชม (Spectators) ไม่เปิดเผยบทบาทลับใดๆ ---
      if (room.spectators) {
          for (const specUniqueId in room.spectators) {
              const spec = room.spectators[specUniqueId];
              if (spec && spec.id) {
                  game.io.to(spec.id).emit('room state update', {
                      ...publicState,
                      players: buildPlayersStateFor(spec),
                      isSpectator: true,
                  });
                  game.io.to(spec.id).emit('update hand', []);
                  game.io.to(spec.id).emit('update tryal cards initial', []);
              }
          }
      }
  }

  function getAlivePlayers(room) {
      return Object.values(room.players || {}).filter(p => p && p.alive);
  }

  function rememberWitchTeammates(room) {
      const teammates = Object.values(room.players || {}).filter(player => player.hasBeenWitch);
      teammates.forEach(viewer => {
          if (!(viewer.knownWitchTeammates instanceof Set)) viewer.knownWitchTeammates = new Set();
          teammates.forEach(teammate => viewer.knownWitchTeammates.add(teammate.uniqueId));
      });
  }

  function hasNightActionChosen(room, key) {
      return Object.prototype.hasOwnProperty.call(room.playersWhoActedAtNight || {}, key);
  }

  return { sendGameMessage, emitRoomState, getAlivePlayers, rememberWitchTeammates, hasNightActionChosen };
};
