module.exports = function registerHandlers(socket, game) {
  socket.on('register uniqueId', (uniqueId, playerName) => {
          const existingRoom = Object.values(game.rooms).find(room => room && room.players && room.players[uniqueId]);
          const existingPlayer = existingRoom?.players?.[uniqueId];
          if (existingPlayer?.isBot && socket.handshake.auth?.botToken !== existingPlayer.botToken) {
              socket.disconnect(true);
              return;
          }
          socket.uniqueId = uniqueId;
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
          // Check if this uniqueId already exists with a different name in an active room
          for (const roomName in game.rooms) {
              if (game.rooms[roomName].players[socket.uniqueId] && game.rooms[roomName].players[socket.uniqueId].name !== playerName) {
                  game.io.to(socket.id).emit('game message', 'ไม่สามารถเปลี่ยนชื่อขณะอยู่ในห้องได้.', 'red');
                  return;
              }
          }

          // If player already has a name set (e.g., from localStorage on new connection)
          // update it on the server side or ensure consistency.
          // This scenario handles a fresh connection where client sends stored name.
          console.log(`Player ${socket.uniqueId} set name to: ${playerName}`);
          // No direct player object exists here yet until they join a room
      });

  socket.on('request rooms list', () => {
          game.io.to(socket.id).emit('active rooms list', game.getPublicRoomsList());
      });

  socket.on('create room', (roomName, playerName) => {
          if (game.rooms[roomName]) {
              game.io.to(socket.id).emit('game message', 'ชื่อห้องนี้ถูกใช้แล้ว. โปรดเลือกชื่ออื่น.', 'red');
              return;
          }
          if (!playerName || playerName.trim() === '') {
              game.io.to(socket.id).emit('game message', 'โปรดป้อนชื่อผู้เล่นของคุณก่อนสร้างห้อง.', 'red');
              return;
          }

          game.rooms[roomName] = {
              name: roomName,
              players: {},
              hostUniqueId: socket.uniqueId,
              gameStarted: false,
              currentPhase: 'LOBBY',
              phaseTimer: 0,
              dayNumber: 0,
              currentTurnPlayerUniqueId: null,
              gameDeck: [],
              discardPile: [],
              accusedPlayers: {}, // { uniqueId: accusationCount }
              confessors: [], // List of uniqueIds who confessed this day
              confessionActions: [], // Players who confessed or skipped this PRE_DAWN
              nightConfessors: [], // List of uniqueIds who confessed during night
              playerForcedToRevealTryal: null, // Player who must reveal Tryal Card
              nightCardDrawer: null, // Who drew the Night card (for confession order)
              confessionOrder: [], // Order of players who should confess during night
              currentConfessionIndex: 0, // Current player in confession order
              confessionTimer: null, // Timer for individual confession
              confessionTimerDuration: game.DEFAULT_PHASE_DURATIONS.CONFESSION, // Duration for confession timer
              phaseInterval: null, // Timer for current phase
              blackCatHolder: null,
              blackCatHolderAlreadyActedThisDay: false, // To ensure black cat holder only starts once per day
              playersWhoActedAtNight: {}, // { witchKill: uniqueId, constableSave: uniqueId }
              gameOver: false,
              winner: null,
              isAssigningBlackCat: false, // New flag for this specific state
              phaseConfig: { ...game.DEFAULT_PHASE_DURATIONS }, // Default durations for this room
              witchChatHistory: [], // Chat history for witch team
              gameMessageHistory: [], // Game message history for reconnection
              infectionLog: [],
              deathLog: [],
          };

          const newPlayer = {
              id: socket.id,
              uniqueId: socket.uniqueId,
              name: playerName,
              isHost: true,
              isReady: true,
              hand: [],
              tryalCards: [],
              inPlayCards: [], // Permanent cards in front of player
              alive: true,
              isSilenced: false, // For Stocks card
              isWitch: false, // Initial role status
              isConstable: false, // Initial role status
              hasBeenWitch: false, // Track if player has ever been a witch
              revealedTryalCardIndexes: new Set(), // Client-side tracking for revealed roles
              connected: true, // Mark as connected
          };
          game.rooms[roomName].players[socket.uniqueId] = newPlayer;
          socket.join(roomName);
          socket.currentRoom = roomName; // Store current room on socket
          game.io.to(socket.id).emit('room joined', roomName);
          game.sendGameMessage(roomName, `${playerName} สร้างห้อง ${roomName} แล้ว.`, 'green');
          game.sendGameMessage(roomName, 'คุณคือผู้ดูแลห้อง.', 'blue', true);
          game.emitRoomState(roomName);
          game.broadcastActiveRooms();
      });

  socket.on('join room', (roomName, playerName) => {
          const room = game.rooms[roomName];
          if (!room) {
              game.io.to(socket.id).emit('game message', 'ไม่พบห้องนี้.', 'red');
              return;
          }

          // Reconnecting with existing uniqueId
          if (room.players[socket.uniqueId]) {
              const player = room.players[socket.uniqueId];
              game.handlePlayerReconnection(socket, room, player);
              game.broadcastActiveRooms();
              return;
          }

          // Reconnecting as spectator
          if (room.spectators && room.spectators[socket.uniqueId]) {
              const spec = room.spectators[socket.uniqueId];
              if (playerName && playerName.trim()) {
                  spec.name = playerName.trim();
              }
              game.handleSpectatorReconnection(socket, room, spec);
              return;
          }

          if (!playerName || playerName.trim() === '') {
              game.io.to(socket.id).emit('game message', 'โปรดป้อนชื่อผู้เล่นของคุณก่อนเข้าร่วมห้อง.', 'red');
              return;
          }

          if (room.gameStarted) {
              // Join as spectator / observer
              if (!room.spectators) room.spectators = {};
              const spec = {
                  id: socket.id,
                  uniqueId: socket.uniqueId,
                  name: playerName.trim(),
                  isSpectator: true,
                  connected: true,
              };
              room.spectators[socket.uniqueId] = spec;
              socket.join(roomName);
              socket.currentRoom = roomName;
              game.io.to(socket.id).emit('room joined', roomName);
              game.io.to(socket.id).emit('joined as spectator', { roomName: room.name, name: spec.name });
              game.sendGameMessage(roomName, `👁️ <b>${spec.name}</b> เข้ามาเป็นผู้ชมการเล่น`, 'gray', true);
              game.emitRoomState(roomName);
              game.broadcastActiveRooms();
              return;
          }

          if (Object.keys(room.players).length >= game.PLAYER_LIMIT) {
              game.io.to(socket.id).emit('game message', 'ห้องเต็มแล้ว.', 'red');
              return;
          }

          // New player joining
          const newPlayer = {
              id: socket.id,
              uniqueId: socket.uniqueId,
              name: playerName.trim(),
              isHost: false,
              isReady: false,
              accusationsGiven: 0,
              accusationsReceived: 0,
              hand: [],
              tryalCards: [],
              inPlayCards: [],
              alive: true,
              isSilenced: false,
              isWitch: false,
              isConstable: false,
              hasBeenWitch: false,
              revealedTryalCardIndexes: new Set(),
              connected: true,
          };
          room.players[socket.uniqueId] = newPlayer;
          socket.join(roomName);
          socket.currentRoom = roomName;
          game.io.to(socket.id).emit('room joined', roomName);
          game.sendGameMessage(roomName, `${newPlayer.name} เข้าร่วมห้อง ${roomName} แล้ว.`, 'green');
          game.emitRoomState(roomName);
          game.broadcastActiveRooms();
      });

  socket.on('join existing room', (roomName) => {
          const room = game.rooms[roomName];
          if (room && room.players[socket.uniqueId]) {
              const player = room.players[socket.uniqueId];
              game.handlePlayerReconnection(socket, room, player);
              game.broadcastActiveRooms();
          } else if (room && room.spectators && room.spectators[socket.uniqueId]) {
              const spec = room.spectators[socket.uniqueId];
              game.handleSpectatorReconnection(socket, room, spec);
          } else {
              // Registration may already have restored a different valid room.
              const activeRoom = game.rooms[socket.currentRoom];
              if (activeRoom?.players?.[socket.uniqueId]?.id === socket.id ||
                  activeRoom?.spectators?.[socket.uniqueId]?.id === socket.id) {
                  game.emitRoomState(activeRoom.name);
                  return;
              }
              game.io.to(socket.id).emit('room not found or not in room');
              socket.currentRoom = null;
              game.io.to(socket.id).emit('room left');
          }
      });

  socket.on('toggle ready', (roomName) => {
          const room = game.rooms[roomName || socket.currentRoom];
          if (!room || room.gameStarted) return;
          const player = room.players[socket.uniqueId];
          if (!player) return;
          player.isReady = !player.isReady;
          game.emitRoomState(room.name);
      });

  socket.on('add bot', roomName => {
          const room = game.rooms[roomName || socket.currentRoom];
          if (!room || room.hostUniqueId !== socket.uniqueId) {
              game.io.to(socket.id).emit('game message', 'เฉพาะหัวห้องเท่านั้นที่เพิ่มบอทได้.', 'red');
              return;
          }
          if (room.gameStarted) {
              game.io.to(socket.id).emit('game message', 'เพิ่มบอทได้เฉพาะตอนอยู่ในล็อบบี้.', 'red');
              return;
          }
          if (Object.keys(room.players).length >= game.PLAYER_LIMIT) {
              game.io.to(socket.id).emit('game message', 'ห้องเต็มแล้ว ไม่สามารถเพิ่มบอทได้.', 'red');
              return;
          }

          let botNumber = 1;
          const existingNames = new Set(Object.values(room.players).map(player => player.name));
          while (existingNames.has(`บอท ${botNumber}`)) botNumber++;
          const uniqueId = `bot-${game.uuidv4()}`;
          const botToken = game.uuidv4();
          const botName = `บอท ${botNumber}`;
          room.players[uniqueId] = {
              id: `offline-${uniqueId}`,
              uniqueId,
              name: botName,
              isHost: false,
              isBot: true,
              botToken,
              isReady: true,
              hand: [],
              tryalCards: [],
              inPlayCards: [],
              alive: true,
              isSilenced: false,
              isWitch: false,
              isConstable: false,
              hasBeenWitch: false,
              revealedTryalCardIndexes: new Set(),
              connected: false,
          };

          const address = game.server.address();
          const internalPort = address && typeof address === 'object' ? address.port : Number(game.PORT);
          const botSocket = game.createBotClient({
              url: `http://127.0.0.1:${internalPort}`,
              uniqueId,
              token: botToken,
              name: botName,
          });
          game.botClients.set(uniqueId, { socket: botSocket, roomName: room.name });
          botSocket.on('connect_error', error => {
              console.warn(`Bot ${botName} connection failed:`, error.message);
          });

          game.sendGameMessage(room.name, `🤖 ${botName} เข้าร่วมห้องและพร้อมเล่นแล้ว`, 'green', true);
          game.emitRoomState(room.name);
          game.broadcastActiveRooms();
      });

  socket.on('remove bot', (roomName, botUniqueId) => {
          const room = game.rooms[roomName || socket.currentRoom];
          if (!room || room.hostUniqueId !== socket.uniqueId) {
              game.io.to(socket.id).emit('game message', 'เฉพาะหัวห้องเท่านั้นที่นำบอทออกได้.', 'red');
              return;
          }
          if (room.gameStarted) {
              game.io.to(socket.id).emit('game message', 'นำบอทออกได้เฉพาะตอนอยู่ในล็อบบี้.', 'red');
              return;
          }
          const bot = room.players[botUniqueId];
          if (!bot?.isBot) {
              game.io.to(socket.id).emit('game message', 'ไม่พบบอทในห้องนี้.', 'red');
              return;
          }

          if (bot.disconnectTimeout) clearTimeout(bot.disconnectTimeout);
          delete room.players[botUniqueId];
          const connection = game.botClients.get(botUniqueId);
          game.botClients.delete(botUniqueId);
          connection?.socket.disconnect();
          game.sendGameMessage(room.name, `🤖 ${bot.name} ถูกนำออกจากห้องแล้ว`, 'orange', true);
          game.emitRoomState(room.name);
          game.broadcastActiveRooms();
      });

  socket.on('restart game', (roomName) => {
          const room = game.rooms[roomName || socket.currentRoom];
          if (!room || room.hostUniqueId !== socket.uniqueId) {
              game.io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์เริ่มเกมรอบใหม่.', 'red');
              return;
          }

          room.gameStarted = false;
          room.gameOver = false;
          room.gameSummary = null;
          room.gameDeck = [];
          room.discardPile = [];
          room.confessionOrder = [];
          room.currentConfessionIndex = 0;
          room.firstVictim = null;
          room.accusedPlayers = {};
          room.playersWhoActedAtNight = {};
          room.nightConfessors = [];
          room.nightCardDrawer = null;
          room.conspiracyDrawer = null;
          room.blackCatHolder = null;
          room.currentTurnIndex = 0;
          room.dayNumber = 0;
          room.currentPhase = 'LOBBY';
          delete room.awaitingCurseSelection;
          delete room.awaitingConspiracySelection;
          delete room.playerForcedToRevealTryal;
          delete room.playerForcedToRevealSelector;

          Object.values(room.players).forEach(p => {
              p.hand = [];
              p.tryalCards = [];
          p.revealedTryalCards = [];
              p.inPlayCards = [];
              p.alive = true;
              p.isSilenced = false;
              p.isWitch = false;
              p.isConstable = false;
              p.hasBeenWitch = false;
              p.knownWitchTeammates = new Set();
              p.revealedTryalCardIndexes = new Set();
              p.isReady = !!p.isBot;
              p.accusationsGiven = 0;
              p.accusationsReceived = 0;
          });

          game.io.to(room.name).emit('game restarted');
          game.emitRoomState(room.name);
          game.sendGameMessage(room.name, '<b>หัวห้องได้รีเซ็ตเกมเพื่อเริ่มรอบใหม่!</b> กลับสู่ห้องล็อบบี้', 'green', true);
          game.broadcastActiveRooms();
      });

  socket.on('leave room', () => {
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
