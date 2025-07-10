const {
  PLAYER_LIMIT,
  MIN_PLAYERS_TO_START,
  generateRoomCode,
  shuffleArray,
  getAlivePlayers,
  createPlayer,
  createRoom,
  initializeGame,
  checkWinCondition,
  canPlayCard,
  playCard,
  drawCards,
  endTurn
} = require('../src/gameLogic');

describe('Game Logic Tests', () => {
  describe('Constants', () => {
    test('should have correct player limits', () => {
      expect(PLAYER_LIMIT).toBe(12);
      expect(MIN_PLAYERS_TO_START).toBe(4);
    });
  });

  describe('Utility Functions', () => {
    test('generateRoomCode should return 4 character uppercase string', () => {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
    });

    test('shuffleArray should return array with same elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    test('getAlivePlayers should filter alive and connected players', () => {
      const room = {
        players: {
          '1': { alive: true, connected: true },
          '2': { alive: false, connected: true },
          '3': { alive: true, connected: false },
          '4': { alive: true, connected: true }
        }
      };
      const alivePlayers = getAlivePlayers(room);
      expect(alivePlayers).toHaveLength(2);
      expect(alivePlayers.map(p => p.alive)).toEqual([true, true]);
    });
  });

  describe('Player Creation', () => {
    test('createPlayer should create player with correct properties', () => {
      const player = createPlayer('test-id', 'Test Player', 'socket-123', true);
      
      expect(player.uniqueId).toBe('test-id');
      expect(player.name).toBe('Test Player');
      expect(player.id).toBe('socket-123');
      expect(player.isHost).toBe(true);
      expect(player.alive).toBe(true);
      expect(player.connected).toBe(true);
      expect(player.hand).toEqual([]);
      expect(player.tryalCards).toEqual([]);
      expect(player.inPlayCards).toEqual([]);
    });
  });

  describe('Room Creation', () => {
    test('createRoom should create room with correct initial state', () => {
      const room = createRoom('Test Room');
      
      expect(room.name).toBe('Test Room');
      expect(room.players).toEqual({});
      expect(room.gameStarted).toBe(false);
      expect(room.currentPhase).toBe('LOBBY');
      expect(room.dayNumber).toBe(0);
      expect(room.gameOver).toBe(false);
      expect(room.winner).toBe(null);
    });
  });

  describe('Game Initialization', () => {
    test('initializeGame should set up game state correctly', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1'),
        '2': createPlayer('2', 'Player 2', 'socket-2'),
        '3': createPlayer('3', 'Player 3', 'socket-3'),
        '4': createPlayer('4', 'Player 4', 'socket-4')
      };

      initializeGame(room);

      expect(room.gameStarted).toBe(true);
      expect(room.currentPhase).toBe('DAY');
      expect(room.dayNumber).toBe(1);
      expect(Array.isArray(room.gameDeck)).toBe(true);
      expect(room.gameDeck.length).toBeGreaterThan(0);
      expect(room.discardPile).toEqual([]);
      expect(room.currentTurnPlayerUniqueId).toBeTruthy();

      // Check that each player has tryal cards
      Object.values(room.players).forEach(player => {
        expect(player.tryalCards.length).toBeGreaterThan(0);
        expect(player.alive).toBe(true);
        expect(player.hand).toEqual([]);
        expect(player.inPlayCards).toEqual([]);
      });
    });
  });

  describe('Win Condition Checks', () => {
    test('should detect witches win when they outnumber constables', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Witch 1', 'socket-1'), isWitch: true, alive: true, connected: true },
        '2': { ...createPlayer('2', 'Witch 2', 'socket-2'), isWitch: true, alive: true, connected: true },
        '3': { ...createPlayer('3', 'Constable 1', 'socket-3'), isConstable: true, alive: true, connected: true }
      };

      const winner = checkWinCondition(room);
      expect(winner).toBe('witches');
      expect(room.gameOver).toBe(true);
      expect(room.winner).toBe('witches');
    });

    test('should detect constables win when all witches eliminated', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Witch 1', 'socket-1'), isWitch: true, alive: false, connected: true },
        '2': { ...createPlayer('2', 'Constable 1', 'socket-2'), isConstable: true, alive: true, connected: true },
        '3': { ...createPlayer('3', 'Constable 2', 'socket-3'), isConstable: true, alive: true, connected: true }
      };

      const winner = checkWinCondition(room);
      expect(winner).toBe('constables');
      expect(room.gameOver).toBe(true);
      expect(room.winner).toBe('constables');
    });

    test('should return null when no win condition met', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Witch 1', 'socket-1'), isWitch: true, alive: true, connected: true },
        '2': { ...createPlayer('2', 'Constable 1', 'socket-2'), isConstable: true, alive: true, connected: true }
      };

      const winner = checkWinCondition(room);
      expect(winner).toBe(null);
      expect(room.gameOver).toBe(false);
    });
  });

  describe('Card Playing', () => {
    test('canPlayCard should return false for dead player', () => {
      const player = { ...createPlayer('1', 'Player 1', 'socket-1'), alive: false };
      const card = { name: 'Accusation', type: 'Accusation', color: 'Red', value: 1 };
      const room = { players: { '1': player } };

      expect(canPlayCard(card, player, room)).toBe(false);
    });

    test('canPlayCard should return false for silenced player', () => {
      const player = { ...createPlayer('1', 'Player 1', 'socket-1'), isSilenced: true };
      const card = { name: 'Accusation', type: 'Accusation', color: 'Red', value: 1 };
      const room = { players: { '1': player } };

      expect(canPlayCard(card, player, room)).toBe(false);
    });

    test('canPlayCard should return true for valid card and player', () => {
      const player = createPlayer('1', 'Player 1', 'socket-1');
      const card = { name: 'Accusation', type: 'Accusation', color: 'Red', value: 1 };
      const room = { 
        players: { 
          '1': player,
          '2': { ...createPlayer('2', 'Player 2', 'socket-2'), alive: true, connected: true }
        }
      };

      expect(canPlayCard(card, player, room)).toBe(true);
    });
  });

  describe('Drawing Cards', () => {
    test('drawCards should add cards to player hand', () => {
      const room = createRoom('Test Room');
      room.gameDeck = [
        { name: 'Card 1', type: 'Action' },
        { name: 'Card 2', type: 'Action' },
        { name: 'Card 3', type: 'Action' }
      ];
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1')
      };

      const result = drawCards(room, '1', 2);
      
      expect(result.success).toBe(true);
      expect(room.players['1'].hand).toHaveLength(2);
      expect(room.gameDeck).toHaveLength(1);
    });

    test('drawCards should handle empty deck', () => {
      const room = createRoom('Test Room');
      room.gameDeck = [];
      room.players = {
        '1': createPlayer('1', 'Player 1', 'socket-1')
      };

      const result = drawCards(room, '1', 2);
      
      expect(result.success).toBe(true);
      expect(result.cards).toHaveLength(0);
      expect(room.players['1'].hand).toHaveLength(0);
    });

    test('drawCards should fail for dead player', () => {
      const room = createRoom('Test Room');
      room.gameDeck = [{ name: 'Card 1', type: 'Action' }];
      room.players = {
        '1': { ...createPlayer('1', 'Player 1', 'socket-1'), alive: false }
      };

      const result = drawCards(room, '1', 2);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Player not found or not alive');
    });
  });

  describe('Turn Management', () => {
    test('endTurn should advance to next player', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Player 1', 'socket-1'), alive: true, connected: true },
        '2': { ...createPlayer('2', 'Player 2', 'socket-2'), alive: true, connected: true },
        '3': { ...createPlayer('3', 'Player 3', 'socket-3'), alive: true, connected: true }
      };
      room.currentTurnPlayerUniqueId = '1';

      const result = endTurn(room, '1');
      
      expect(result.success).toBe(true);
      expect(room.currentTurnPlayerUniqueId).toBe('2');
    });

    test('endTurn should wrap around to first player', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Player 1', 'socket-1'), alive: true, connected: true },
        '2': { ...createPlayer('2', 'Player 2', 'socket-2'), alive: true, connected: true },
        '3': { ...createPlayer('3', 'Player 3', 'socket-3'), alive: true, connected: true }
      };
      room.currentTurnPlayerUniqueId = '3';

      const result = endTurn(room, '3');
      
      expect(result.success).toBe(true);
      expect(room.currentTurnPlayerUniqueId).toBe('1');
    });

    test('endTurn should fail when no players alive', () => {
      const room = createRoom('Test Room');
      room.players = {
        '1': { ...createPlayer('1', 'Player 1', 'socket-1'), alive: false, connected: true },
        '2': { ...createPlayer('2', 'Player 2', 'socket-2'), alive: false, connected: true }
      };

      const result = endTurn(room, '1');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('No players alive');
    });
  });
}); 