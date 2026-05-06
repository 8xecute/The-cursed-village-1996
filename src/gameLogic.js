// Game Logic Module
const { v4: uuidv4 } = require('uuid');

// Game Constants
const PLAYER_LIMIT = 12;
const MIN_PLAYERS_TO_START = 4;

const DEFAULT_PHASE_DURATIONS = {
  LOBBY: 0,
  DAY: 0,
  NIGHT: 0,
  PRE_DAWN: 0,
  GAME_OVER: 0
};

// Card Templates
const CARD_TEMPLATES = {
  conspiracy: {
    name: 'Conspiracy',
    type: 'Event',
    color: 'Black',
    description: 'ผู้เล่นที่เปิดได้การ์ดนี้ ให้เลือกเปิดการ์ดชีวิต 1 ใบ ของผู้เล่นที่มีการ์ดเครื่องเซ่นอยู่ข้างหน้า. จากนั้นจะเกิดเหตุการณ์ ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นที่อยู่ทางซ้ายมือ 1 ใบ.'
  },
  night: {
    name: 'Night',
    type: 'Event',
    color: 'Black',
    description: 'เมื่อจั่วได้การ์ดนี้ จะเกิดเหตุการณ์: ผู้ดำเนินเกมจะให้ผู้เล่นทุกคนหลับตา จากนั้นปอบทำการสังหารผู้เล่นหนึ่งคน และหมอผีต้องทำการวางโทเคนค้อนเพื่อปกป้องผู้เล่น 1 คน.'
  }
};

// Game Cards Configuration
function getGameCardsForPlayerCount(playerCount) {
  if (playerCount <= 5) {
    return [
      ...Array(18).fill({ name: 'Accusation', type: 'Accusation', color: 'Red', value: 1, description: 'กล่าวหาผู้เล่นคนอื่น (1 ข้อกล่าวหา).' }),
      ...Array(4).fill({ name: 'Evidence', type: 'Accusation', color: 'Red', value: 3, description: 'กล่าวหาผู้เล่นคนอื่น (3 ข้อกล่าวหา).' }),
      ...Array(2).fill({ name: 'Witness', type: 'Accusation', color: 'Red', value: 7, description: 'กล่าวหาผู้เล่นคนอื่น (7 ข้อกล่าวหา).' }),
      ...Array(2).fill({ name: 'Scapegoat', type: 'Action', color: 'Green', description: 'ย้ายการ์ดสีน้ำเงิน, เขียว และแดง ของจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(1).fill({ name: 'Curse', type: 'Action', color: 'Green', description: 'ลบการ์ดสีน้ำเงินที่ผู้เล่นเป้าหมายโดน 1 ใบลงไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Alibi', type: 'Action', color: 'Green', description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Robbery', type: 'Action', color: 'Green', description: 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(1).fill({ name: 'Stocks', type: 'Permanent', color: 'Green', description: 'ข้ามตาของผู้เล่นที่โดนการ์ดนี้ สามารถ stack การ์ดนี้เพื่อข้ามตาหลายรอบได้. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Arson', type: 'Action', color: 'Green', description: 'ทิ้งการ์ดในมือทั้งหมดของผู้เล่นเป้าหมายไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Black Cat', type: 'Permanent', color: 'Blue', description: 'หากการ์ดนี้อยู่กับผู้เล่นคนไหน จะต้องเริ่มเล่นเป็นคนแรก. หากมีผู้เล่นคนไหนเปิดได้การ์ดเจตนาร้าย, ผู้เล่นที่มีการ์ดเครื่องเซ่นจะต้องเปิดการ์ดชีวิต 1 ใบ.' }),
      ...Array(1).fill({ name: 'Asylum', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่จะป้องกันการถูกฆ่าในรอบกลางคืน. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Piety', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่ไม่สามารถถูกโจมตีด้วยการ์ดสีแดงได้. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Matchmaker', type: 'Permanent', color: 'Blue', description: 'เลือกวางการ์ดหน้าผู้เล่นเป้าหมาย (ผู้เล่น 2 คนที่มีการ์ดนี้อยู่ตรงหน้า หากผู้เล่นคนใดคนหนึ่งตาย อีกคนต้องตายตาม). (เลือกเป้าหมาย)' }),
      ...Array(1).fill(CARD_TEMPLATES.conspiracy),
      ...Array(1).fill(CARD_TEMPLATES.night)
    ];
  } else {
    return [
      // Accusation Cards (Red)
      ...Array(26).fill({ name: 'Accusation', type: 'Accusation', color: 'Red', value: 1, description: 'กล่าวหาผู้เล่นคนอื่น (1 ข้อกล่าวหา).' }),
      ...Array(8).fill({ name: 'Evidence', type: 'Accusation', color: 'Red', value: 3, description: 'กล่าวหาผู้เล่นคนอื่น (3 ข้อกล่าวหา).' }),
      ...Array(3).fill({ name: 'Witness', type: 'Accusation', color: 'Red', value: 7, description: 'กล่าวหาผู้เล่นคนอื่น (7 ข้อกล่าวหา).' }),
      // Action Cards (Green)
      ...Array(2).fill({ name: 'Scapegoat', type: 'Action', color: 'Green', description: 'ย้ายการ์ดสีน้ำเงิน, เขียว และแดง ของจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(2).fill({ name: 'Curse', type: 'Action', color: 'Green', description: 'ลบการ์ดสีน้ำเงินที่ผู้เล่นเป้าหมายโดน 1 ใบลงไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      ...Array(3).fill({ name: 'Alibi', type: 'Action', color: 'Green', description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Robbery', type: 'Action', color: 'Green', description: 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
      ...Array(2).fill({ name: 'Stocks', type: 'Permanent', color: 'Green', description: 'ข้ามตาของผู้เล่นที่โดนการ์ดนี้ สามารถ stack การ์ดนี้เพื่อข้ามตาหลายรอบได้. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Arson', type: 'Action', color: 'Green', description: 'ทิ้งการ์ดในมือทั้งหมดของผู้เล่นเป้าหมายไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
      // Permanent Cards (Blue)
      ...Array(1).fill({ name: 'Black Cat', type: 'Permanent', color: 'Blue', description: 'หากการ์ดนี้อยู่กับผู้เล่นคนไหน จะต้องเริ่มเล่นเป็นคนแรก. หากมีผู้เล่นคนไหนเปิดได้การ์ดเจตนาร้าย, ผู้เล่นที่มีการ์ดเครื่องเซ่นจะต้องเปิดการ์ดชีวิต 1 ใบ.' }),
      ...Array(1).fill({ name: 'Asylum', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่จะป้องกันการถูกฆ่าในรอบกลางคืน. (เลือกเป้าหมาย)' }),
      ...Array(1).fill({ name: 'Piety', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่ไม่สามารถถูกโจมตีด้วยการ์ดสีแดงได้. (เลือกเป้าหมาย)' }),
      ...Array(2).fill({ name: 'Matchmaker', type: 'Permanent', color: 'Blue', description: 'เลือกวางการ์ดหน้าผู้เล่นเป้าหมาย (ผู้เล่น 2 คนที่มีการ์ดนี้อยู่ตรงหน้า หากผู้เล่นคนใดคนหนึ่งตาย อีกคนต้องตายตาม). (เลือกเป้าหมาย)' }),
      // Event Cards (Black)
      ...Array(1).fill(CARD_TEMPLATES.conspiracy),
      ...Array(1).fill(CARD_TEMPLATES.night)
    ];
  }
}

const GAME_CARDS = [
  // Accusation Cards (Red)
  ...Array(26).fill({ name: 'Accusation', type: 'Accusation', color: 'Red', value: 1, description: 'กล่าวหาผู้เล่นคนอื่น (1 ข้อกล่าวหา).' }),
  ...Array(8).fill({ name: 'Evidence', type: 'Accusation', color: 'Red', value: 3, description: 'กล่าวหาผู้เล่นคนอื่น (3 ข้อกล่าวหา).' }),
  ...Array(3).fill({ name: 'Witness', type: 'Accusation', color: 'Red', value: 7, description: 'กล่าวหาผู้เล่นคนอื่น (7 ข้อกล่าวหา).' }),
  // Action Cards (Green)
  ...Array(2).fill({ name: 'Scapegoat', type: 'Action', color: 'Green', description: 'ย้ายการ์ดสีน้ำเงิน, เขียว และแดง ของจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
  ...Array(2).fill({ name: 'Curse', type: 'Action', color: 'Green', description: 'ลบการ์ดสีน้ำเงินที่ผู้เล่นเป้าหมายโดน 1 ใบลงไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
  ...Array(3).fill({ name: 'Alibi', type: 'Action', color: 'Green', description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ. (เลือกเป้าหมาย)' }),
  ...Array(2).fill({ name: 'Robbery', type: 'Action', color: 'Green', description: 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง. (เลือกเป้าหมาย 2 คน)' }),
  ...Array(2).fill({ name: 'Stocks', type: 'Permanent', color: 'Green', description: 'ข้ามตาของผู้เล่นที่โดนการ์ดนี้ สามารถ stack การ์ดนี้เพื่อข้ามตาหลายรอบได้. (เลือกเป้าหมาย)' }),
  ...Array(2).fill({ name: 'Arson', type: 'Action', color: 'Green', description: 'ทิ้งการ์ดในมือทั้งหมดของผู้เล่นเป้าหมายไปที่กองทิ้ง. (เลือกเป้าหมาย)' }),
  // Permanent Cards (Blue)
  ...Array(1).fill({ name: 'Black Cat', type: 'Permanent', color: 'Blue', description: 'หากการ์ดนี้อยู่กับผู้เล่นคนไหน จะต้องเริ่มเล่นเป็นคนแรก. หากมีผู้เล่นคนไหนเปิดได้การ์ดเจตนาร้าย, ผู้เล่นที่มีการ์ดเครื่องเซ่นจะต้องเปิดการ์ดชีวิต 1 ใบ.' }),
  ...Array(1).fill({ name: 'Asylum', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่จะป้องกันการถูกฆ่าในรอบกลางคืน. (เลือกเป้าหมาย)' }),
  ...Array(1).fill({ name: 'Piety', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่ไม่สามารถถูกโจมตีด้วยการ์ดสีแดงได้. (เลือกเป้าหมาย)' }),
  ...Array(2).fill({ name: 'Matchmaker', type: 'Permanent', color: 'Blue', description: 'เลือกวางการ์ดหน้าผู้เล่นเป้าหมาย (ผู้เล่น 2 คนที่มีการ์ดนี้อยู่ตรงหน้า หากผู้เล่นคนใดคนหนึ่งตาย อีกคนต้องตายตาม). (เลือกเป้าหมาย)' }),
  // Event Cards (Black)
  ...Array(1).fill(CARD_TEMPLATES.conspiracy),
  ...Array(1).fill(CARD_TEMPLATES.night)
];

// Tryal Cards
const TRYAL_CARDS_BASE = [
  { name: 'Witch', type: 'Role' },
  { name: 'Constable', type: 'Role' },
  { name: 'Not A Witch', type: 'Role' }
];

// Cards that require targets
const CARDS_NEED_TARGET = ['Accusation', 'Evidence', 'Witness', 'Curse', 'Alibi', 'Robbery', 'Stocks', 'Arson', 'Scapegoat', 'Asylum', 'Piety', 'Matchmaker'];
const CARDS_NEED_TWO_TARGETS = ['Scapegoat', 'Robbery'];

// Utility Functions
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getAlivePlayers(room) {
  return Object.values(room.players).filter(p => p.alive && p.connected);
}

function createPlayer(uniqueId, name, socketId, isHost = false) {
  return {
    id: socketId,
    uniqueId,
    name,
    isHost,
    hand: [],
    tryalCards: [],
    inPlayCards: [],
    alive: true,
    connected: true,
    isSilenced: false,
    isWitch: false,
    isConstable: false,
    hasBeenWitch: false,
    revealedTryalCardIndexes: new Set()
  };
}

function createRoom(roomName) {
  return {
    name: roomName,
    players: {},
    gameStarted: false,
    currentPhase: 'LOBBY',
    dayNumber: 0,
    currentTurnPlayerUniqueId: null,
    phaseTimer: null,
    phaseConfig: DEFAULT_PHASE_DURATIONS,
    gameDeck: [],
    discardPile: [],
    accusedPlayers: {},
    blackCatHolder: null,
    blackCatHolderAlreadyActedThisDay: false,
    playerForcedToRevealTryal: null,
    isAssigningBlackCat: false,
    gameOver: false,
    winner: null,
    confessors: [],
    confessionOrder: [],
    currentConfessionIndex: 0,
    gameMessageHistory: []
  };
}

function initializeGame(room) {
  // Create game deck
  const playerCount = Object.keys(room.players).length;
  room.gameDeck = shuffleArray([...getGameCardsForPlayerCount(playerCount)]);
  room.discardPile = [];
  
  // Initialize players
  const tryalCardsPerPlayer = Math.floor(60 / playerCount);
  
  Object.values(room.players).forEach(player => {
    player.hand = [];
    player.tryalCards = [];
    player.inPlayCards = [];
    player.alive = true;
    player.isSilenced = false;
    player.isWitch = false;
    player.isConstable = false;
    player.hasBeenWitch = false;
    player.revealedTryalCardIndexes = new Set();
    
    // Assign tryal cards
    for (let i = 0; i < tryalCardsPerPlayer; i++) {
      const randomIndex = Math.floor(Math.random() * TRYAL_CARDS_BASE.length);
      player.tryalCards.push({ ...TRYAL_CARDS_BASE[randomIndex] });
    }
  });
  
  // Set first turn
  const alivePlayers = getAlivePlayers(room);
  if (alivePlayers.length > 0) {
    room.currentTurnPlayerUniqueId = alivePlayers[0].uniqueId;
  }
  
  room.gameStarted = true;
  room.currentPhase = 'DAY';
  room.dayNumber = 1;
}

function checkWinCondition(room, phase = null) {
  const alivePlayers = getAlivePlayers(room);

  // เงื่อนไข 1: มีผู้เล่นที่ยังมี Tryal Card ปอบซ่อนอยู่ และผู้เล่นชาวบ้าน (ที่ไม่เคยเป็นปอบ) ตายหมด
  const hasUnrevealedWitch = alivePlayers.some(player =>
    player.tryalCards.some((card, idx) =>
      card.name === 'Witch' && !(player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.has(idx))
    )
  );
  const allVillagersDead = alivePlayers.every(player => player.isWitch || player.hasBeenWitch);
  if (hasUnrevealedWitch && allVillagersDead) {
    room.gameOver = true;
    room.winner = 'witches';
    return 'witches';
  }

  // เงื่อนไข 2: ทุกคนที่รอดอยู่เป็นปอบหรือเคยเป็นปอบ และยังมี Tryal Card ปอบที่ยังไม่ถูกเปิด (เช็คทันทีเมื่อเริ่มกลางคืน)
  // phase === 'NIGHT' หรือ phase === 'night' จะเช็คข้อนี้
  const allAliveAreWitchOrHasBeenWitch = alivePlayers.every(player => player.isWitch || player.hasBeenWitch);
  const anyUnrevealedWitch = alivePlayers.some(player =>
    player.tryalCards.some((card, idx) =>
      card.name === 'Witch' && !(player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.has(idx))
    )
  );
  if ((phase && phase.toLowerCase() === 'night') && allAliveAreWitchOrHasBeenWitch && anyUnrevealedWitch) {
    room.gameOver = true;
    room.winner = 'witches';
    return 'witches';
  }

  // เงื่อนไขกรณีเหลือผู้เล่นคนเดียว
  if (alivePlayers.length === 1) {
    const player = alivePlayers[0];
    const unrevealedWitch = player.tryalCards.some((card, idx) => card.name === 'Witch' && !(player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.has(idx)));
    if (unrevealedWitch) {
      room.gameOver = true;
      room.winner = 'witches';
      return 'witches';
    } else {
      // ถ้าไม่มี Tryal Card ปอบเหลือเลย ให้ชาวบ้านชนะทันที
      room.gameOver = true;
      room.winner = 'constables';
      return 'constables';
    }
  }

  // Witches win if they outnumber constables (สำรองไว้กรณี logic เก่า)
  const witches = alivePlayers.filter(p => p.isWitch);
  const constables = alivePlayers.filter(p => p.isConstable); // constable = หมอผี
  if (witches.length > constables.length && witches.length > 0) {
    room.gameOver = true;
    room.winner = 'witches';
    return 'witches';
  }
  // หมอผีชนะถ้าปอบถูกกำจัดหมด
  if (witches.length === 0 && constables.length > 0) {
    room.gameOver = true;
    room.winner = 'constables';
    return 'constables';
  }
  // No winner yet
  return null;
}

function canPlayCard(card, player, room) {
  if (!player.alive || player.isSilenced) return false;
  
  if (CARDS_NEED_TARGET.includes(card.name)) {
    const alivePlayers = getAlivePlayers(room);
    return alivePlayers.length > 1; // Need at least one other player to target
  }
  
  return true;
}

function playCard(room, playerUniqueId, cardIndex, targetUniqueId = null, secondTargetUniqueId = null) {
  const player = room.players[playerUniqueId];
  if (!player || !player.alive) return { success: false, message: 'Player not found or not alive' };
  
  const card = player.hand[cardIndex];
  if (!card) return { success: false, message: 'Card not found' };
  
  if (!canPlayCard(card, player, room)) {
    return { success: false, message: 'Cannot play this card' };
  }
  
  // Remove card from hand
  player.hand.splice(cardIndex, 1);
  
  // Handle card effects
  const result = handleCardEffect(room, player, card, targetUniqueId, secondTargetUniqueId);
  
  // Add card to discard pile
  room.discardPile.push(card);
  
  return result;
}

function handleCardEffect(room, player, card, targetUniqueId, secondTargetUniqueId) {
  switch (card.name) {
    case 'Accusation':
    case 'Evidence':
    case 'Witness':
      return handleAccusationCard(room, player, card, targetUniqueId);
    case 'Curse':
      return handleCurseCard(room, player, targetUniqueId);
    case 'Alibi':
      return handleAlibiCard(room, player, targetUniqueId);
    case 'Robbery':
      return handleRobberyCard(room, player, targetUniqueId, secondTargetUniqueId);
    case 'Scapegoat':
      return handleScapegoatCard(room, player, targetUniqueId, secondTargetUniqueId);
    case 'Stocks':
      return handleStocksCard(room, player, targetUniqueId);
    case 'Arson':
      return handleArsonCard(room, player, targetUniqueId);
    case 'Asylum':
    case 'Piety':
    case 'Matchmaker':
    case 'Black Cat':
      return handlePermanentCard(room, player, card, targetUniqueId);
    default:
      return { success: true, message: 'Card played successfully' };
  }
}

function handleAccusationCard(room, player, card, targetUniqueId) {
  const target = room.players[targetUniqueId];
  if (!target || !target.alive) {
    return { success: false, message: 'Invalid target' };
  }
  
  const accusationValue = card.value || 1;
  room.accusedPlayers[targetUniqueId] = (room.accusedPlayers[targetUniqueId] || 0) + accusationValue;
  
  return { success: true, message: `${player.name} accused ${target.name} with ${accusationValue} points` };
}

function handleCurseCard(room, player, targetUniqueId) {
  const target = room.players[targetUniqueId];
  if (!target || !target.alive) {
    return { success: false, message: 'Invalid target' };
  }
  
  const blueCards = target.inPlayCards.filter(card => card.color === 'Blue');
  if (blueCards.length === 0) {
    return { success: false, message: 'Target has no blue cards to curse' };
  }
  
  // Remove first blue card
  const cardToRemove = blueCards[0];
  const cardIndex = target.inPlayCards.findIndex(card => card.name === cardToRemove.name);
  if (cardIndex !== -1) {
    const removedCard = target.inPlayCards.splice(cardIndex, 1)[0];
    room.discardPile.push(removedCard);
  }
  
  return { success: true, message: `${player.name} cursed ${target.name}` };
}

function handleAlibiCard(room, player, targetUniqueId) {
  const target = room.players[targetUniqueId];
  if (!target || !target.alive) {
    return { success: false, message: 'Invalid target' };
  }
  
  const accusationPoints = room.accusedPlayers[targetUniqueId] || 0;
  const pointsToRemove = Math.min(3, accusationPoints);
  
  if (pointsToRemove > 0) {
    room.accusedPlayers[targetUniqueId] -= pointsToRemove;
    if (room.accusedPlayers[targetUniqueId] <= 0) {
      delete room.accusedPlayers[targetUniqueId];
    }
  }
  
  return { success: true, message: `${player.name} provided alibi for ${target.name}, removing ${pointsToRemove} accusation points` };
}

function handleRobberyCard(room, player, sourceUniqueId, targetUniqueId) {
  const source = room.players[sourceUniqueId];
  const target = room.players[targetUniqueId];
  
  if (!source || !target || !source.alive || !target.alive) {
    return { success: false, message: 'Invalid targets' };
  }
  
  // Transfer all cards from source to target
  const stolenCards = [...source.hand];
  source.hand = [];
  target.hand.push(...stolenCards);
  
  return { success: true, message: `${player.name} robbed ${source.name} and gave cards to ${target.name}` };
}

function handleScapegoatCard(room, player, sourceUniqueId, targetUniqueId) {
  const source = room.players[sourceUniqueId];
  const target = room.players[targetUniqueId];
  
  if (!source || !target || !source.alive || !target.alive) {
    return { success: false, message: 'Invalid targets' };
  }
  
  // Transfer colored cards from source to target
  const coloredCards = source.inPlayCards.filter(card => 
    ['Red', 'Green', 'Blue'].includes(card.color)
  );
  
  coloredCards.forEach(card => {
    const cardIndex = source.inPlayCards.findIndex(c => c.name === card.name);
    if (cardIndex !== -1) {
      const transferredCard = source.inPlayCards.splice(cardIndex, 1)[0];
      target.inPlayCards.push(transferredCard);
    }
  });
  
  return { success: true, message: `${player.name} moved colored cards from ${source.name} to ${target.name}` };
}

function handleStocksCard(room, player, targetUniqueId) {
  const target = room.players[targetUniqueId];
  if (!target || !target.alive) {
    return { success: false, message: 'Invalid target' };
  }
  
  target.isSilenced = true;
  
  return { success: true, message: `${player.name} silenced ${target.name}` };
}

function handleArsonCard(room, player, targetUniqueId) {
  const target = room.players[targetUniqueId];
  if (!target || !target.alive) {
    return { success: false, message: 'Invalid target' };
  }
  
  const burnedCards = [...target.hand];
  target.hand = [];
  room.discardPile.push(...burnedCards);
  
  return { success: true, message: `${player.name} burned ${target.name}'s hand` };
}

function handlePermanentCard(room, player, card, targetUniqueId) {
  if (card.name === 'Black Cat') {
    room.blackCatHolder = player.uniqueId;
    return { success: true, message: `${player.name} received the Black Cat` };
  }
  
  if (targetUniqueId) {
    const target = room.players[targetUniqueId];
    if (!target || !target.alive) {
      return { success: false, message: 'Invalid target' };
    }
    
    target.inPlayCards.push(card);
    return { success: true, message: `${player.name} placed ${card.name} on ${target.name}` };
  }
  
  return { success: false, message: 'Permanent card requires a target' };
}

function drawCards(room, playerUniqueId, count = 2) {
  const player = room.players[playerUniqueId];
  if (!player || !player.alive) return { success: false, message: 'Player not found or not alive' };
  
  const drawnCards = [];
  for (let i = 0; i < count && room.gameDeck.length > 0; i++) {
    drawnCards.push(room.gameDeck.pop());
  }
  
  player.hand.push(...drawnCards);
  
  return { success: true, message: `Drew ${drawnCards.length} cards`, cards: drawnCards };
}

function endTurn(room, playerUniqueId) {
  const alivePlayers = getAlivePlayers(room);
  if (alivePlayers.length === 0) return { success: false, message: 'No players alive' };
  
  const currentIndex = alivePlayers.findIndex(p => p.uniqueId === playerUniqueId);
  const nextIndex = (currentIndex + 1) % alivePlayers.length;
  room.currentTurnPlayerUniqueId = alivePlayers[nextIndex].uniqueId;
  
  return { success: true, message: 'Turn ended' };
}

module.exports = {
  getGameCardsForPlayerCount,
  PLAYER_LIMIT,
  MIN_PLAYERS_TO_START,
  DEFAULT_PHASE_DURATIONS,
  GAME_CARDS,
  TRYAL_CARDS_BASE,
  CARDS_NEED_TARGET,
  CARDS_NEED_TWO_TARGETS,
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
}; 