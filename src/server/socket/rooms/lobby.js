module.exports = function registerRoomLobby(socket, game) {
  socket.on('toggle ready', (roomName) => {
          const room = game.rooms[roomName || socket.currentRoom];
          if (!room || room.gameStarted) return;
          const player = room.players[socket.uniqueId];
          if (!player) return;
          player.isReady = !player.isReady;
          game.emitRoomState(room.name);
      });

  socket.on('set life card count', count => {
      const room = game.rooms[socket.currentRoom];
      const host = room?.players?.[socket.uniqueId];
      if (!room || room.gameStarted || !host?.isHost || host.id !== socket.id || room.hostUniqueId !== socket.uniqueId) return;
      if (count !== null && (!Number.isInteger(count) || count < 1 || count > 5)) {
          socket.emit('game message', 'เลือกการ์ดชีวิตคนละ 1–5 ใบ หรืออัตโนมัติ', 'orange');
          return;
      }
      room.customLifeCardCount = count;
      game.emitRoomState(room.name);
  });

  socket.on('set witch card count', count => {
      const room = game.rooms[socket.currentRoom];
      const host = room?.players?.[socket.uniqueId];
      if (!room || room.gameStarted || !host?.isHost || host.id !== socket.id) return;
      const max = Math.min(4, Math.max(1, game.getAlivePlayers(room).length - 1));
      if (count !== null && (!Number.isInteger(count) || count < 1 || count > max)) {
          socket.emit('game message', `เลือกการ์ดปอบตั้งแต่ 1 ถึง ${max} ใบ หรืออัตโนมัติ`, 'orange'); return;
      }
      room.customWitchCardCount = count;
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
      game.cancelLifeSetup(room);
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
          room.pendingDraw = null;
          room.blackCatHolder = null;
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
          });

          game.io.to(room.name).emit('game restarted');
          game.emitRoomState(room.name);
          game.sendGameMessage(room.name, '<b>หัวห้องได้รีเซ็ตเกมเพื่อเริ่มรอบใหม่!</b> กลับสู่ห้องล็อบบี้', 'green', true);
          game.broadcastActiveRooms();
      });


};
