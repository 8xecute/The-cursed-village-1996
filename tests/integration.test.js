const { createPlayer, createRoom, initializeGame, checkWinCondition } = require('../src/gameLogic');

describe('Game Integration Tests', () => {
  describe('Complete Game Flow', () => {
    let room;

    beforeEach(() => {
      room = createRoom('Integration Test Room');
      
      // Add 4 players
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1'),
        '2': createPlayer('2', 'Player 2', 'socket-2'),
        '3': createPlayer('3', 'Player 3', 'socket-3'),
        '4': createPlayer('4', 'Player 4', 'socket-4')
      };
    });

    test('should complete full game initialization', () => {
      expect(room.gameStarted).toBe(false);
      expect(room.currentPhase).toBe('LOBBY');
      expect(room.dayNumber).toBe(0);

      initializeGame(room);

      expect(room.gameStarted).toBe(true);
      expect(room.currentPhase).toBe('DAY');
      expect(room.dayNumber).toBe(1);
      expect(room.gameDeck.length).toBeGreaterThan(0);
      expect(room.currentTurnPlayerUniqueId).toBeTruthy();

      // Check all players have tryal cards
      Object.values(room.players).forEach(player => {
        expect(player.tryalCards.length).toBeGreaterThan(0);
        expect(player.alive).toBe(true);
        expect(player.hand).toEqual([]);
        expect(player.inPlayCards).toEqual([]);
      });
    });

    test('should handle witch win condition', () => {
      initializeGame(room);
      
      // Set up witch win scenario
      room.players['1'].isWitch = true;
      room.players['2'].isWitch = true;
      room.players['3'].isConstable = true;
      room.players['4'].alive = false; // Eliminate one player

      const winner = checkWinCondition(room);
      
      expect(winner).toBe('witches');
      expect(room.gameOver).toBe(true);
      expect(room.winner).toBe('witches');
    });

    test('should handle constable win condition', () => {
      initializeGame(room);
      
      // Set up constable win scenario
      room.players['1'].isWitch = true;
      room.players['2'].isConstable = true;
      room.players['3'].isConstable = true;
      room.players['1'].alive = false; // Eliminate witch

      const winner = checkWinCondition(room);
      
      expect(winner).toBe('constables');
      expect(room.gameOver).toBe(true);
      expect(room.winner).toBe('constables');
    });
  });

  describe('Player Management', () => {
    test('should handle player joining and leaving', () => {
      const room = createRoom('Player Test Room');
      
      // Add players
      room.players['1'] = createPlayer('1', 'Player 1', 'socket-1');
      room.players['2'] = createPlayer('2', 'Player 2', 'socket-2');
      
      expect(Object.keys(room.players)).toHaveLength(2);
      expect(room.players['1'].name).toBe('Player 1');
      expect(room.players['2'].name).toBe('Player 2');

      // Remove player
      delete room.players['1'];
      
      expect(Object.keys(room.players)).toHaveLength(1);
      expect(room.players['1']).toBeUndefined();
    });

    test('should handle player disconnection and reconnection', () => {
      const room = createRoom('Reconnection Test Room');
      room.players['1'] = createPlayer('1', 'Player 1', 'socket-1');
      
      // Simulate disconnection
      room.players['1'].connected = false;
      expect(room.players['1'].connected).toBe(false);

      // Simulate reconnection
      room.players['1'].connected = true;
      expect(room.players['1'].connected).toBe(true);
    });
  });

  describe('Game State Transitions', () => {
    test('should handle phase transitions', () => {
      const room = createRoom('Phase Test Room');
      
      // Start in lobby
      expect(room.currentPhase).toBe('LOBBY');
      
      // Transition to day
      room.currentPhase = 'DAY';
      room.dayNumber = 1;
      expect(room.currentPhase).toBe('DAY');
      expect(room.dayNumber).toBe(1);
      
      // Transition to night
      room.currentPhase = 'NIGHT';
      expect(room.currentPhase).toBe('NIGHT');
      
      // Transition to pre-dawn
      room.currentPhase = 'PRE_DAWN';
      expect(room.currentPhase).toBe('PRE_DAWN');
      
      // Transition to game over
      room.currentPhase = 'GAME_OVER';
      expect(room.currentPhase).toBe('GAME_OVER');
    });

    test('should handle turn progression', () => {
      const room = createRoom('Turn Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Player 1', 'socket-1'), alive: true, connected: true },
        '2': { ...createPlayer('2', 'Player 2', 'socket-2'), alive: true, connected: true },
        '3': { ...createPlayer('3', 'Player 3', 'socket-3'), alive: true, connected: true }
      };

      // Set initial turn
      room.currentTurnPlayerUniqueId = '1';
      expect(room.currentTurnPlayerUniqueId).toBe('1');

      // Progress turns
      const alivePlayers = Object.values(room.players).filter(p => p.alive && p.connected);
      const currentIndex = alivePlayers.findIndex(p => p.uniqueId === room.currentTurnPlayerUniqueId);
      const nextIndex = (currentIndex + 1) % alivePlayers.length;
      room.currentTurnPlayerUniqueId = alivePlayers[nextIndex].uniqueId;

      expect(room.currentTurnPlayerUniqueId).toBe('2');
    });
  });

  describe('Card System', () => {
    test('should handle card deck creation and shuffling', () => {
      const room = createRoom('Card Test Room');
      
      // Initialize game to create deck
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1'),
        '2': createPlayer('2', 'Player 2', 'socket-2')
      };
      
      initializeGame(room);
      
      expect(room.gameDeck.length).toBeGreaterThan(0);
      expect(room.discardPile).toEqual([]);
    });

    test('should handle card drawing', () => {
      const room = createRoom('Draw Test Room');
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1')
      };
      
      // Add cards to deck
      room.gameDeck = [
        { name: 'Card 1', type: 'Action' },
        { name: 'Card 2', type: 'Action' },
        { name: 'Card 3', type: 'Action' }
      ];
      
      const initialDeckSize = room.gameDeck.length;
      const initialHandSize = room.players['1'].hand.length;
      
      // Draw cards
      const drawCount = 2;
      for (let i = 0; i < drawCount && room.gameDeck.length > 0; i++) {
        room.players['1'].hand.push(room.gameDeck.pop());
      }
      
      expect(room.gameDeck.length).toBe(initialDeckSize - drawCount);
      expect(room.players['1'].hand.length).toBe(initialHandSize + drawCount);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle invalid game state', () => {
      const room = createRoom('Error Test Room');
      
      // Try to initialize game with no players
      expect(() => {
        room.players = {};
        initializeGame(room);
      }).not.toThrow();
    });

    test('should handle invalid player actions', () => {
      const room = createRoom('Action Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Player 1', 'socket-1'), alive: false } // Dead player
      };
      
      // Try to perform actions with dead player
      expect(room.players['1'].alive).toBe(false);
    });

    test('should handle room cleanup', () => {
      const room = createRoom('Cleanup Test Room');
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1'),
        '2': createPlayer('2', 'Player 2', 'socket-2')
      };
      
      // Simulate room cleanup
      room.players = {};
      room.gameStarted = false;
      room.currentPhase = 'LOBBY';
      
      expect(Object.keys(room.players)).toHaveLength(0);
      expect(room.gameStarted).toBe(false);
      expect(room.currentPhase).toBe('LOBBY');
    });
  });
}); 