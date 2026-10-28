const { usageLog } = require('../../usage-log');
module.exports = function registerRoomMembership(socket, game) {
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
          usageLog('room_created', { connectionId: socket.id, playerId: socket.uniqueId, playerName: newPlayer.name, roomName });
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


};
