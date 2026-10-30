// phases: game services. Dependencies are injected through game.
const { usageLog } = require('../usage-log');
const { assignCharacterIds } = require('./character-roster');
module.exports = function createServices(game) {
  function startPhaseTimer(roomName, duration) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      clearInterval(room.phaseInterval);
      room.phaseTimer = duration / 1000;
      if (duration === 0) {
          room.phaseTimer = 0; // Ensure it's zero for manual advance
          game.emitRoomState(roomName);
          return;
      }
      room.phaseInterval = setInterval(() => {
          room.phaseTimer--;
          game.emitRoomState(roomName);
          if (room.phaseTimer <= 0) {
              clearInterval(room.phaseInterval);
              if (!room.gameOver) { // Prevent phase change if game already ended
                  game.changePhase(roomName);
              }
          }
      }, 1000);
  }

  function changePhase(roomName, forcedNextPhase = null) {
      const room = game.rooms[roomName];
      if (room?.currentPhase === 'SETUP') return;
      if (!room || room.gameOver) return;
      clearInterval(room.phaseInterval); // Stop current timer
      clearTimeout(room.nightActionTimeout); // Clear night action timeout if any
      let nextPhase = '';
      let nextDuration = 0;
      let transitionMessage = '';
      const currentPhase = forcedNextPhase || room.currentPhase;

      switch (currentPhase) {
          case 'LOBBY':
              // Should transition to DAY when game starts, not through changePhase
              return;
          case 'DAY':
              // Day ends, transition directly to Night (no voting)
              game.sendGameMessage(room.name, 'คืนกำลังจะมาถึง...', 'blue', true);
                  nextPhase = 'NIGHT';
              // Removed data clearing - keep accusations, confessors, and turn state
              break;
              case 'NIGHT':
                  if (room.dayNumber === 0) {
                      // First day - skip PRE_DAWN and go directly to DAY
                      game.sendGameMessage(room.name, 'เช้าแล้ว! วันใหม่เริ่มต้นขึ้น.', 'blue', true);
                      nextPhase = 'DAY';
                      room.dayNumber++;
                      room.blackCatHolderAlreadyActedThisDay = false;
                      room.playersWhoActedAtNight = {};
                      room.nightConfessors = [];
                  } else {
                      // เข้าสู่ NIGHT จริง ๆ
                      game.sendGameMessage(room.name, 'กลางคืนเริ่มต้นขึ้น! ปอบและหมอผีเตรียมตัว...', 'blue', true);
                      nextPhase = 'NIGHT';
                      // ไม่ต้อง set confessionOrder ที่นี่
                  }
                  break;
          case 'PRE_DAWN': {
              const protections = game.getConfessionProtections(room);
              const message = protections.length
                  ? 'ไม่ต้องสารภาพคืนนี้: ' + protections.map(p => `${p.name} (${p.reasons.join(' และ ')})`).join(' · ') + ' · ผู้เล่นที่เหลือเลือกสารภาพหรือข้ามได้'
                  : 'คืนนี้ไม่มีผู้เล่นได้รับการยกเว้นสารภาพ · ทุกคนเลือกสารภาพหรือข้ามได้';
              game.sendGameMessage(room.name, message, 'blue', true);
              game.io.to(room.name).emit('confession protection announcement', { message, players: protections });
              room.confessionOrder = game.getAlivePlayers(room).map(player => player.uniqueId);
              room.confessionActions = game.getAlivePlayers(room)
                  .filter(player => game.isNightProtected(room, player)).map(player => player.uniqueId);
              room.confessionResolving = false;
              room.confessionChoices = {};
              room.nightConfessors = [];
              room.currentConfessionIndex = 0;
              game.clearConfessionTimer(roomName);
              nextPhase = 'PRE_DAWN';
              break;
          }
          case 'GAME_OVER':
              return; // Game is over, no more phase changes
          default:
              console.warn(`Unknown phase: ${currentPhase}`);
              return;
      }

      // A Curse selection is only valid during the turn in which it was played.
      // Cancel it if a phase transition interrupts that turn.
      if (nextPhase !== 'DAY' && room.awaitingCurseSelection) {
          const selector = room.players[room.awaitingCurseSelection.selector];
          if (selector) {
              game.io.to(selector.id).emit('game message', 'หมดช่วงเลือกการ์ดจากคำสาปแล้ว การเลือกถูกยกเลิก.', 'orange');
          }
          delete room.awaitingCurseSelection;
      }

      if (nextPhase === 'NIGHT') {
          room.witchNightId = game.uuidv4();
          room.witchNightMarks = {};
      }
      room.currentPhase = nextPhase;
      nextDuration = nextPhase === 'PRE_DAWN' ? 0 : room.phaseConfig[nextPhase] || game.DEFAULT_PHASE_DURATIONS[nextPhase];
      game.startPhaseTimer(roomName, nextDuration);
      game.emitRoomState(roomName);

      if (nextPhase === 'PRE_DAWN') {
          game.finishConfessionIfReady(roomName);
          return;
      }

      // If transitioning to NIGHT, prompt witch and constable actions
      if (nextPhase === 'NIGHT') {
          // ก่อนเข้า NIGHT: รีเซ็ตและอัปเดต isWitch/isConstable ตาม Tryal Cards ที่อยู่ในมือ
          Object.values(room.players).forEach(player => {
              player.isWitch = player.tryalCards.some(card => card.name === 'Witch');
              player.isConstable = player.tryalCards.some(card => card.name === 'Constable');
          });
          game.emitRoomState(roomName);
          // --- เพิ่มเช็ค win condition ทันทีเมื่อเข้า NIGHT ---
          game.checkWinCondition(room);
          if (room.gameOver) return; // ถ้าจบเกมแล้ว ไม่ต้องดำเนินต่อ
          const constables = game.getAlivePlayers(room).filter(p => p.isConstable);
          const witches = game.getAlivePlayers(room).filter(p => p.hasBeenWitch || p.isWitch);
          
          // PATCH: ปิด log Night phase - Checking roles
          // console.log('Night phase - Checking roles:');
          // console.log('Constables:', constables.map(p => ({ name: p.name, isConstable: p.isConstable })));
          // console.log('Witches:', witches.map(p => ({ name: p.name, isWitch: p.isWitch })));
          
              if (witches.length > 0) {
              // ปอบเลือกเป้าหมาย
                  game.sendGameMessage(room.name, 'ปอบ, เตรียมตัวเลือกเป้าหมายที่จะสังหาร.', 'red', true);
                  witches.forEach(witch => {
                  game.io.to(witch.id).emit('prompt witch kill');
              });
              // ไม่ prompt constable ที่นี่ ให้รอปอบเลือกเสร็จ
          } else if (constables.length > 0) {
              // ไม่มีปอบ ให้ prompt constable ทันที
                          game.sendGameMessage(room.name, 'หมอผี, เตรียมตัวใช้ปัดเป่าเพื่อปกป้องผู้เล่น.', 'blue', true);
              constables.forEach(constable => {
                  game.io.to(constable.id).emit('prompt constable action');
              });
                      } else {
              // ไม่มีปอบ ไม่มีหมอผี ข้ามไป PRE_DAWN
              game.changePhase(roomName, 'PRE_DAWN');
          }
      } else if (nextPhase === 'DAY') {
          game.prepareDeckForNewDay(room);
          game.setNextTurn(room); // Start the turn cycle for the day phase
      }


  }

  function startGame(roomName) {
      const room = game.rooms[roomName];
      if (!room || room.gameStarted) return;

      const startingHandCount = room.customStartingHandCount ?? 3;
      const maxStarting = require('./starting-hand').maxStartingHand(game.getAlivePlayers(room).length);
      if (!Number.isInteger(startingHandCount) || startingHandCount < 1 || startingHandCount > maxStarting) {
          const host = room.players[room.hostUniqueId];
          if (host) game.io.to(host.id).emit('game message', `จำนวนไพ่เริ่มต้นต้องเป็น 1–${maxStarting} ใบ กรุณาตั้งใหม่ก่อนเริ่มเกม`, 'orange');
          return;
      }

      const alivePlayers = game.getAlivePlayers(room);
      if (alivePlayers.length < game.MIN_PLAYERS_TO_START) {
          const host = room.players[room.hostUniqueId];
          if (host?.id) game.io.to(host.id).emit('game message', `ต้องการผู้เล่นอย่างน้อย ${game.MIN_PLAYERS_TO_START} คนเพื่อเริ่มเกม`, 'red', true);
          return;
      }

      if (room.customWitchCardCount != null && (!Number.isInteger(room.customWitchCardCount) ||
          room.customWitchCardCount < 1 || room.customWitchCardCount > Math.min(4, alivePlayers.length - 1))) {
          const host = Object.values(room.players).find(player => player.isHost);
          if (host) game.io.to(host.id).emit('game message', 'จำนวนปอบที่กำหนดเอง ต้องไม่เกิน 4 ใบ และน้อยกว่าจำนวนผู้เล่น กรุณาตั้งใหม่ก่อนเริ่มเกม', 'orange');
          return;
      }
      if (room.customLifeCardCount != null && (!Number.isInteger(room.customLifeCardCount) || room.customLifeCardCount < 1 || room.customLifeCardCount > 5)) {
          const host = room.players[room.hostUniqueId];
          if (host) game.io.to(host.id).emit('game message', 'จำนวนการ์ดชีวิตต้องเป็น 1–5 ใบ หรืออัตโนมัติ', 'orange');
          return;
      }
      room.gameStarted = true;
      clearTimeout(room.prankGunTimer);
      room.prankGunTimer = null;
      room.prankGunExpiresAt = null;
      assignCharacterIds(alivePlayers, game.shuffleArray, true);
      room.firstTurnStarted = false;
      room.turnSerial = 0;
      room.pendingDraw = null;
      room.removedGameCards = [];
      room.twoPlayerRulesAnnounced = false;
      room.usageRoundId = game.uuidv4();
      usageLog('game_started', { roomName, roundId: room.usageRoundId, playerCount: alivePlayers.length,
          humanCount: alivePlayers.filter(player => !player.isBot).length, hostId: room.hostUniqueId });
      room.dayNumber = 0; // Start at Day 0, will increment to Day 1
      room.currentPhase = 'SETUP'; // Deal lives and wait for each player's confirmation.
      room.blackCatHolder = null; // Will be assigned the first Black Cat drawn
      room.gameMessageHistory = []; // Reset game message history for new game
      room.infectionLog = [];
      room.deathLog = [];
      room.firstVictim = null;
      room.gameSummary = null;
      room.gameStartTime = Date.now();
      game.broadcastActiveRooms();

      // --- Dynamically create TRYAL_CARDS deck based on player count ---
      const playerCount = alivePlayers.length;
      const TRYAL_CARDS = [];
      const tryalCardsPerPlayer = room.customLifeCardCount ?? (playerCount <= 7 ? 5 : playerCount <= 9 ? 4 : 3);
      let witchCount = playerCount <= 5 ? 1 : 2;

      if (room.customWitchCardCount != null) witchCount = room.customWitchCardCount;
      room.initialWitchCardCount = witchCount;
      // Add Witch cards
      for (let i = 0; i < witchCount; i++) {
          TRYAL_CARDS.push({ name: 'Witch', type: 'Role' });
      }
      // Add Constable card
      TRYAL_CARDS.push({ name: 'Constable', type: 'Role' });
      // One Constable, the configured Witches, and enough townsfolk for every seat.
      const requiredTryalCards = playerCount * tryalCardsPerPlayer;
      const notAWitchCount = requiredTryalCards - TRYAL_CARDS.length;
      for (let i = 0; i < notAWitchCount; i++) {
          TRYAL_CARDS.push({ name: 'Not A Witch', type: 'Role' });
      }

      const shuffledTryalCards = game.shuffleArray([...TRYAL_CARDS]);
      alivePlayers.forEach(player => {
          player.tryalCards = [];
          player.revealedTryalCards = [];
          player.revealedTryalCardIndexes = new Set(); // Reset revealed roles for new game
          player.isWitch = false; // Reset role
          player.isConstable = false; // Reset role
          player.hasBeenWitch = false; // Reset has been witch status for new game
          player.knownWitchTeammates = new Set();
          player.isSilenced = false; // Reset status
          room.prankShot = null;
          player.prankGun = false;
          player.ghostScareAvailableAt = 0;
          player.ghostScareUntil = 0;
          player.inPlayCards = []; // Clear permanent cards from previous game
          player.hand = []; // Clear hand from previous game
          player.hasPlayedCardsThisTurn = false; // Initialize turn action flag
          player.isReady = false;

      });

      // --- New Card Dealing Logic ---

      // 1. Separate special cards from the main deck
      const allGameCards = game.getGameCardsForPlayerCount(playerCount);
      const conspiracyCards = allGameCards.filter(c => c.name === 'Conspiracy');
      const nightCards = allGameCards.filter(c => c.name === 'Night');
      const blackCatCard = allGameCards.find(c => c.name === 'Black Cat');

      // Create the initial deck for dealing, without the special cards (and filter out ALL Night cards)
      let initialDealingDeck = allGameCards.filter(c => c.name !== 'Conspiracy' && c.name !== 'Night' && c.name !== 'Black Cat');

      // 2. Shuffle the initial deck and deal the configured count equally.
      initialDealingDeck = game.shuffleArray(initialDealingDeck);
      alivePlayers.forEach(player => {
          for (let i = 0; i < startingHandCount; i++) {
              if (initialDealingDeck.length > 0) {
                  player.hand.push(initialDealingDeck.pop());
              }
          }
          game.io.to(player.id).emit('update hand', player.hand);

      });

      // 3. Prepare the final game deck (no Night, no Conspiracy, no Black Cat)
      room.gameDeck = initialDealingDeck;

      // 4. Add Conspiracy cards back and shuffle
      room.gameDeck.push(...conspiracyCards);
      room.gameDeck = game.shuffleArray(room.gameDeck);

      // 5. Place only ONE Night card at the bottom of the deck (to be drawn last)
      if (nightCards.length > 0) {
          room.gameDeck.push(nightCards[0]); // Only add the first Night card
      }

      room.pendingBlackCatCard = blackCatCard;
      room.isAssigningBlackCat = false;
      game.beginLifeSetup(room, shuffledTryalCards, tryalCardsPerPlayer);
  }

  return { startPhaseTimer, changePhase, startGame };
};
