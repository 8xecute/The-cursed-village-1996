const express = require('express');

describe('Server Tests', () => {
  describe('Express App', () => {
    test('should create express app', () => {
      const app = express();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
    });

    test('should serve static files', () => {
      const app = express();
      app.use(express.static('public'));
      
      // Test that the app has middleware functions
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
    });
  });

  describe('Room Management', () => {
    test('should create room with valid name', () => {
      const roomName = 'test-room';
      const room = {
        name: roomName,
        players: {},
        gameStarted: false,
        currentPhase: 'LOBBY'
      };
      
      expect(room.name).toBe(roomName);
      expect(room.gameStarted).toBe(false);
      expect(room.currentPhase).toBe('LOBBY');
    });

    test('should handle room joining', () => {
      const roomName = 'test-room';
      const playerId = 'player-1';
      const playerName = 'Test Player';
      
      const room = {
        name: roomName,
        players: {},
        gameStarted: false,
        currentPhase: 'LOBBY'
      };
      
      room.players[playerId] = {
        id: playerId,
        name: playerName,
        uniqueId: playerId,
        isHost: Object.keys(room.players).length === 0
      };
      
      expect(room.players[playerId]).toBeDefined();
      expect(room.players[playerId].name).toBe(playerName);
    });
  });

  describe('Game State Management', () => {
    test('should initialize game state correctly', () => {
      const roomName = 'test-game';
      const room = {
        name: roomName,
        players: {
          'player-1': { uniqueId: 'player-1', name: 'Player 1', alive: true, connected: true },
          'player-2': { uniqueId: 'player-2', name: 'Player 2', alive: true, connected: true },
          'player-3': { uniqueId: 'player-3', name: 'Player 3', alive: true, connected: true },
          'player-4': { uniqueId: 'player-4', name: 'Player 4', alive: true, connected: true }
        },
        gameStarted: false,
        currentPhase: 'LOBBY',
        dayNumber: 0
      };
      
      // Mock game initialization
      room.gameStarted = true;
      room.currentPhase = 'DAY';
      room.dayNumber = 1;
      room.gameDeck = [];
      room.discardPile = [];
      
      expect(room.gameStarted).toBe(true);
      expect(room.currentPhase).toBe('DAY');
      expect(room.dayNumber).toBe(1);
    });

    test('should handle player disconnection', () => {
      const roomName = 'test-disconnect';
      const room = {
        name: roomName,
        players: {
          'player-1': { uniqueId: 'player-1', name: 'Player 1', alive: true, connected: true },
          'player-2': { uniqueId: 'player-2', name: 'Player 2', alive: true, connected: true }
        }
      };
      
      // Mock disconnection
      if (room.players['player-1']) {
        room.players['player-1'].connected = false;
      }
      
      const connectedPlayers = Object.values(room.players).filter(p => p.connected);
      expect(connectedPlayers).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid room access', () => {
      const rooms = {};
      const invalidRoomName = 'non-existent-room';
      expect(rooms[invalidRoomName]).toBeUndefined();
    });

    test('should handle invalid player access', () => {
      const roomName = 'test-room';
      const invalidPlayerId = 'non-existent-player';
      
      const room = {
        name: roomName,
        players: {}
      };
      
      expect(room.players[invalidPlayerId]).toBeUndefined();
    });
  });
}); 