// Optimized client script for Render deployment
// Performance optimizations: caching, debouncing, memory management

// Cache DOM elements for better performance
const DOM_CACHE = {
  nameInputContainer: document.getElementById('name-input-container'),
  nameInput: document.getElementById('name-input'),
  setNameButton: document.getElementById('set-name-button'),
  playerNameDisplay: document.getElementById('player-name-display'),
  playerUniqueIdDisplay: document.getElementById('player-unique-id-display'),
  currentRoomDisplay: document.getElementById('current-room-display'),
  roomManagementSection: document.getElementById('room-management-section'),
  newRoomNameInput: document.getElementById('new-room-name-input'),
  createRoomButton: document.getElementById('create-room-button'),
  joinRoomNameInput: document.getElementById('join-room-name-input'),
  joinRoomButton: document.getElementById('join-room-button'),
  leaveRoomButton: document.getElementById('leave-room-button'),
  roomLobbySection: document.getElementById('room-lobby-section'),
  lobbyRoomName: document.getElementById('lobby-room-name'),
  lobbyPlayerCount: document.getElementById('lobby-player-count'),
  lobbyMaxPlayers: document.getElementById('lobby-max-players'),
  playerListDiv: document.getElementById('player-list'),
  startGameButton: document.getElementById('start-game-button'),
  hostControlsLobby: document.getElementById('host-controls-lobby'),
  forceNextPhaseButton: document.getElementById('force-next-phase-button'),
  gameSection: document.getElementById('game-section'),
  currentPhaseDisplay: document.getElementById('current-phase-display'),
  dayNumberDisplay: document.getElementById('day-number-display'),
  currentTurnPlayerDisplay: document.getElementById('current-turn-player-display'),
  deckCountDisplay: document.getElementById('deck-count-display'),
  discardPileCountDisplay: document.getElementById('discard-pile-count-display'),
  handCardCount: document.getElementById('hand-card-count'),
  playerHandDiv: document.getElementById('player-hand'),
  tryalCardsDisplay: document.getElementById('tryal-cards-display'),
  myRevealedTryalCards: document.getElementById('my-revealed-tryal-cards'),
  mySecretTryalCardsCount: document.getElementById('my-secret-tryal-cards-count'),
  myRoleDisplay: document.getElementById('my-role-display'),
  gameActionsDiv: document.getElementById('game-actions'),
  drawCardButton: document.getElementById('draw-card-button'),
  playCardButton: document.getElementById('play-card-button'),
  endTurnButton: document.getElementById('end-turn-button'),
  cardTargetSelect: document.getElementById('card-target-select'),
  cardSecondTargetSelect: document.getElementById('card-second-target-select'),
  hostControlsGame: document.getElementById('host-controls-game'),
  forceNextPhaseGameButton: document.getElementById('force-next-phase-game-button'),
  turnControlsDiv: document.getElementById('turn-controls'),
  confessSection: document.getElementById('confess-section'),
  confessButton: document.getElementById('confess-button'),
  gameMessagesDiv: document.getElementById('game-messages'),
  cardDescriptionPopup: document.getElementById('card-description-popup'),
  witchChatSection: document.getElementById('witch-chat-section'),
  witchChatMessages: document.getElementById('witch-chat-messages'),
  witchChatInput: document.getElementById('witch-chat-input'),
  witchChatSendButton: document.getElementById('witch-chat-send'),
  witchActionSection: document.getElementById('witch-action-section'),
  assignBlackCatAction: document.getElementById('assign-black-cat-action'),
  blackCatTargetSelect: document.getElementById('black-cat-target-select'),
  confirmBlackCatButton: document.getElementById('confirm-black-cat-button')
};

// Performance optimizations
const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 300,
  CACHE_DURATION: 60000, // 1 minute
  MAX_MESSAGES: 100,
  MAX_CARD_CACHE: 50
};

// Memory-efficient short UUID generator
function uuidv4() {
  return Math.random().toString(36).substring(2, 10);
}

// Debounce function for performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Cache for card images
const cardImageCache = new Map();

// Optimized card image creation with caching
function createCardImage(cardName) {
  if (cardImageCache.has(cardName)) {
    return cardImageCache.get(cardName).cloneNode(true);
  }
  
  const img = document.createElement('img');
  img.src = `cards/${cardName.toLowerCase().replace(/\s+/g, '')}.png`;
  img.alt = cardName;
  img.className = 'card-image';
  img.loading = 'lazy'; // Lazy loading for better performance
  
  // Cache the image
  cardImageCache.set(cardName, img);
  
  // Limit cache size
  if (cardImageCache.size > PERFORMANCE_CONFIG.MAX_CARD_CACHE) {
    const firstKey = cardImageCache.keys().next().value;
    cardImageCache.delete(firstKey);
  }
  
  return img.cloneNode(true);
}

// Optimized message handling with throttling
const messageQueue = [];
let messageProcessing = false;

function processMessageQueue() {
  if (messageProcessing || messageQueue.length === 0) return;
  
  messageProcessing = true;
  
  while (messageQueue.length > 0) {
    const { message, color, bold } = messageQueue.shift();
    addGameMessage(message, color, bold);
  }
  
  messageProcessing = false;
}

// Throttled message processing
const throttledMessageProcessing = debounce(processMessageQueue, 100);

function queueGameMessage(message, color = 'black', bold = false) {
  messageQueue.push({ message, color, bold });
  throttledMessageProcessing();
}

// Memory-efficient game state management
class GameStateManager {
  constructor() {
    this.state = {
      myUniqueId: localStorage.getItem('uniqueId') || uuidv4(),
      myPlayerName: localStorage.getItem('playerName') || '',
      currentRoomName: null,
      myCurrentHand: [],
      myTryalCards: [],
      myRevealedTryalCardIndexes: [],
      selectedCard: null,
      currentRoomState: null,
      isMyTurn: false,
      hasPlayedCardsThisTurn: false,
      drawButtonDisabled: false,
      nightActionState: {
        isSelecting: false,
        actionType: null,
        selectedTargetId: null,
        hasSubmitted: false
      }
    };
    
    // Save uniqueId to localStorage
    if (!localStorage.getItem('uniqueId')) {
      localStorage.setItem('uniqueId', this.state.myUniqueId);
    }
  }
  
  updateState(newState) {
    this.state = { ...this.state, ...newState };
  }
  
  getState() {
    return this.state;
  }
  
  // Clean up old data to prevent memory leaks
  cleanup() {
    if (this.state.currentRoomState && this.state.currentRoomState.gameMessageHistory) {
      if (this.state.currentRoomState.gameMessageHistory.length > PERFORMANCE_CONFIG.MAX_MESSAGES) {
        this.state.currentRoomState.gameMessageHistory = 
          this.state.currentRoomState.gameMessageHistory.slice(-PERFORMANCE_CONFIG.MAX_MESSAGES);
      }
    }
  }
}

// Initialize game state manager
const gameState = new GameStateManager();

// Optimized Socket.IO connection with reconnection logic
const socket = io({
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  timeout: 20000,
  forceNew: false
});

// Connection management
socket.on('connect', () => {
  console.log('Connected to server!');
  const state = gameState.getState();
  
  socket.emit('register uniqueId', state.myUniqueId, state.myPlayerName || '');
  
  if (state.currentRoomName) {
    socket.emit('join existing room', state.currentRoomName);
  } else {
    socket.emit('request rooms list');
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('reconnect', () => {
  console.log('Reconnected to server');
  const state = gameState.getState();
  socket.emit('register uniqueId', state.myUniqueId, state.myPlayerName || '');
});

// Optimized event handlers with debouncing
const debouncedEmitRoomState = debounce((roomName) => {
  socket.emit('request room state', roomName);
}, PERFORMANCE_CONFIG.DEBOUNCE_DELAY);

// Memory cleanup interval
setInterval(() => {
  gameState.cleanup();
  // Clear old messages from DOM
  if (DOM_CACHE.gameMessagesDiv && DOM_CACHE.gameMessagesDiv.children.length > PERFORMANCE_CONFIG.MAX_MESSAGES) {
    const children = Array.from(DOM_CACHE.gameMessagesDiv.children);
    children.slice(0, children.length - PERFORMANCE_CONFIG.MAX_MESSAGES).forEach(child => child.remove());
  }
}, PERFORMANCE_CONFIG.CACHE_DURATION);

// Export for use in main script
window.GameStateManager = GameStateManager;
window.gameState = gameState;
window.DOM_CACHE = DOM_CACHE;
window.createCardImage = createCardImage;
window.queueGameMessage = queueGameMessage;
window.debounce = debounce; 