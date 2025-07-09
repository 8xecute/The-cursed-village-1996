// File: server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // For unique player IDs (Ensure you 'npm install uuid')
const { getGameCardsForPlayerCount } = require('./src/gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // Serve static files from the 'public' directory

const PORT = process.env.PORT || 3000;

// --- Game State Variables ---
const rooms = {}; // Stores all active rooms and their game states

const PLAYER_LIMIT = 12; // Max players per room based on the provided table (up to 12)
const MIN_PLAYERS_TO_START = 4; // Minimum players required to start a game

// Base phase durations in milliseconds - ALL SET TO 0 FOR MANUAL PHASE ADVANCE by Host
const DEFAULT_PHASE_DURATIONS = {
    LOBBY: 0, // No timer for lobby
    DAY: 0, // No automatic timer - Host advances
    NIGHT: 0, // No automatic timer - Host advances, but special timer for Night actions
    PRE_DAWN: 0, // No automatic timer - Host advances, confession period
    GAME_OVER: 0, // No timer
};

// --- Game Cards Configuration (Adapted from new rules) ---
// Card templates to avoid duplication
const CARD_TEMPLATES = {
    conspiracy: { name: 'Conspiracy', type: 'Event', color: 'Black', description: 'ผู้เล่นที่เปิดได้การ์ดนี้ ให้เลือกเปิดการ์ดชีวิต 1 ใบ ของผู้เล่นที่มีการ์ดเครื่องเซ่นอยู่ข้างหน้า. จากนั้นจะเกิดเหตุการณ์ ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นที่อยู่ทางซ้ายมือ 1 ใบ' },
    night: { name: 'Night', type: 'Event', color: 'Black', description: 'เมื่อจั่วได้การ์ดนี้ จะเกิดเหตุการณ์: ผู้ดำเนินเกมจะให้ผู้เล่นทุกคนหลับตา จากนั้นปอบทำการสังหารผู้เล่นหนึ่งคน และหมอผีจะต้องทำการปัดเป่าเพื่อปกป้องผู้เล่น 1 คน' }
};

const GAME_CARDS = [
    // Accusation Cards (Red)
    ...Array(26).fill({ name: 'Accusation', type: 'Accusation', color: 'Red', value: 1, description: 'กล่าวหาผู้เล่นคนอื่น (1 ข้อกล่าวหา)' }),
    ...Array(8).fill({ name: 'Evidence', type: 'Accusation', color: 'Red', value: 3, description: 'กล่าวหาผู้เล่นคนอื่น (3 ข้อกล่าวหา)' }),
    ...Array(3).fill({ name: 'Witness', type: 'Accusation', color: 'Red', value: 7, description: 'กล่าวหาผู้เล่นคนอื่น (7 ข้อกล่าวหา)' }),
    // Action Cards (Green)
    ...Array(2).fill({ name: 'Scapegoat', type: 'Action', color: 'Green', description: 'ย้ายการ์ดสีน้ำเงิน, เขียว และแดง ของจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง' }),
    ...Array(2).fill({ name: 'Curse', type: 'Action', color: 'Green', description: 'ลบการ์ดสีน้ำเงินที่ผู้เล่นเป้าหมายโดน 1 ใบลงไปที่กองทิ้ง' }),
    ...Array(3).fill({ name: 'Alibi', type: 'Action', color: 'Green', description: 'ลบข้อกล่าวหาของผู้เล่นได้สูงสุด 3 ใบ' }),
    ...Array(2).fill({ name: 'Robbery', type: 'Action', color: 'Green', description: 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นเป้าหมาย ไปอีกผู้เล่นหนึ่ง' }),
    ...Array(2).fill({ name: 'Stocks', type: 'Permanent', color: 'Green', description: 'ข้ามตาของผู้เล่นที่โดนการ์ดนี้ สามารถ stack การ์ดนี้เพื่อข้ามตาหลายรอบได้' }),
    ...Array(2).fill({ name: 'Arson', type: 'Action', color: 'Green', description: 'ทิ้งการ์ดในมือทั้งหมดของผู้เล่นเป้าหมายไปที่กองทิ้ง' }),
    // Permanent Cards (Blue)
    ...Array(1).fill({ name: 'Black Cat', type: 'Permanent', color: 'Blue', description: 'หากการ์ดนี้อยู่กับผู้เล่นคนไหน จะต้องเริ่มเล่นเป็นคนแรก. หากมีผู้เล่นคนไหนเปิดได้การ์ดพิธีเซ่นไหว้, ผู้เล่นที่มีการ์ดเครื่องเซ่นจะต้องเปิดการ์ดชีวิต 1 ใบ.' }),
    ...Array(1).fill({ name: 'Asylum', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่จะป้องกันการถูกฆ่าในรอบกลางคืน' }),
    ...Array(1).fill({ name: 'Piety', type: 'Permanent', color: 'Blue', description: 'เลือกผู้เล่นที่ไม่สามารถถูกโจมตีด้วยการ์ดสีแดงได้' }),
    ...Array(2).fill({ name: 'Matchmaker', type: 'Permanent', color: 'Blue', description: 'เลือกวางการ์ดหน้าผู้เล่นเป้าหมาย (ผู้เล่น 2 คนที่มีการ์ดนี้อยู่ตรงหน้า หากผู้เล่นคนใดคนหนึ่งตาย อีกคนต้องตายตาม)' }),
    // Event Cards (Black)
    ...Array(1).fill(CARD_TEMPLATES.conspiracy), // 1 Conspiracy card
    ...Array(1).fill(CARD_TEMPLATES.night), // 1 Night card
];

// Tryal Cards - TOTAL: 60 cards (for 12 players * 5 cards)
// This will be dynamically generated based on player count
const TRYAL_CARDS_BASE = [
    { name: 'Witch', type: 'Role' },
    { name: 'Constable', type: 'Role' },
    { name: 'Not A Witch', type: 'Role' }
];

// Cards that require a target from the player list
const CARDS_NEED_TARGET = ['Accusation', 'Evidence', 'Witness', 'Curse', 'Alibi', 'Robbery', 'Stocks', 'Arson', 'Scapegoat', 'Asylum', 'Piety', 'Matchmaker'];

// Cards that require 2 targets (source and destination)
const CARDS_NEED_TWO_TARGETS = ['Scapegoat', 'Robbery'];


// --- Helper Functions ---
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function sendGameMessage(roomName, message, color = 'black', bold = false) {
    const room = rooms[roomName];
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
    io.to(roomName).emit('game message', message, color, bold);
}

function emitRoomState(roomName) {
    const room = rooms[roomName];
    if (!room) return;

    const playersState = {};
    for (const uniqueId in room.players) {
        const player = room.players[uniqueId];
        playersState[uniqueId] = {
            id: player.id, // socket id
            name: player.name,
            uniqueId: player.uniqueId,
            isHost: player.isHost,
            handSize: player.hand.length,
            tryalCardCount: player.tryalCards.length, // Send total count of Tryal Cards
            tryalCards: player.tryalCards.map(card => ({ name: card.name, type: card.type })), // Send tryal cards for display
            inPlayCards: player.inPlayCards.map(c => c.name), // Send names of permanent cards
            alive: player.alive,
            isSilenced: player.isSilenced,
            isWitch: player.isWitch, // Crucial for win condition
            isConstable: player.isConstable, // Crucial for Night action
            hasBeenWitch: player.hasBeenWitch, // For witch chat access
            // Explicitly send blackCatHolder and gavelHolder for the player list display
            accusationPoints: room.accusedPlayers[uniqueId] || 0,
            isBlackCatHolder: room.blackCatHolder === player.uniqueId,
            mustRevealTryal: room.playerForcedToRevealTryal === uniqueId,
            revealedTryalCardIndexes: Array.from(player.revealedTryalCardIndexes), // Send revealed roles as array
        };
    }

    io.to(roomName).emit('room state update', {
        name: room.name,
        playerCount: Object.keys(room.players).length,
        maxPlayers: PLAYER_LIMIT,
        gameStarted: room.gameStarted,
        currentPhase: room.currentPhase,
        phaseTimer: room.phaseTimer,
        dayNumber: room.dayNumber,
        currentTurnPlayerUniqueId: room.currentTurnPlayerUniqueId,
        currentTurnPlayerName: room.currentTurnPlayerUniqueId ? room.players[room.currentTurnPlayerUniqueId]?.name : null,
        players: playersState,
        phaseConfig: room.phaseConfig,
        confessors: room.confessors, // Players who have confessed this day
        playerForcedToRevealTryal: room.playerForcedToRevealTryal,
        isAssigningBlackCat: room.isAssigningBlackCat, // Flag for witch action
        gameOver: room.gameOver,
        winner: room.winner,
        // Add deck and discard pile information
        deckCount: room.gameDeck ? room.gameDeck.length : 0,
        discardPileCount: room.discardPile ? room.discardPile.length : 0,
        // เพิ่มสำหรับ PRE_DAWN confession popup
        confessionOrder: room.confessionOrder,
        currentConfessionIndex: room.currentConfessionIndex,
    });

    // --- ส่ง hand และ tryalCards ให้แต่ละผู้เล่น (เฉพาะตัวเอง) ---
    for (const uniqueId in room.players) {
        const player = room.players[uniqueId];
        if (player && player.id) {
            io.to(player.id).emit('update hand', player.hand);
            io.to(player.id).emit('update tryal cards initial', player.tryalCards);
        }
    }
}

function getAlivePlayers(room) {
    return Object.values(room.players).filter(p => p.alive && p.connected);
}

function setNextTurn(room) {
    const alivePlayers = getAlivePlayers(room);
    if (alivePlayers.length === 0) {
        sendGameMessage(room.name, "No players left.", 'red', true);
        checkWinCondition(room); // Should already be handled but a fallback
        return;
    }

    let nextPlayerUniqueId = null;

    // Check for Black Cat holder starting first if it's the start of a DAY phase
    if (room.currentPhase === 'DAY' && room.dayNumber > 0 && room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
        // If Black Cat holder exists and is alive, they start the day
        if (!room.blackCatHolderAlreadyActedThisDay) { // Ensure they only start once per day
            nextPlayerUniqueId = room.blackCatHolder;
            room.blackCatHolderAlreadyActedThisDay = true;
        }
    }

    // If no Black Cat holder or they already acted, proceed normally
    if (!nextPlayerUniqueId) {
        const currentTurnIndex = alivePlayers.findIndex(p => p.uniqueId === room.currentTurnPlayerUniqueId);
        let nextTurnIndex = (currentTurnIndex + 1) % alivePlayers.length;
        let nextPlayer = alivePlayers[nextTurnIndex];

        // Skip eliminated or silenced players for regular turns
        let attempts = 0;
        const maxAttempts = alivePlayers.length * 2; // Prevent infinite loops
        while ((!nextPlayer.alive || nextPlayer.isSilenced) && attempts < maxAttempts) {
            // ถ้าโดน Stocks ให้ลบทีละใบ
            if (nextPlayer.isSilenced) {
                const stocksIndex = nextPlayer.inPlayCards.findIndex(card => card.name === 'Stocks');
                if (stocksIndex !== -1) {
                    // Remove one Stocks card
                    const removed = nextPlayer.inPlayCards.splice(stocksIndex, 1)[0];
                    room.discardPile.push(removed);
                    sendGameMessage(room.name, `${nextPlayer.name} ถูกข้ามตาเนื่องจาก Stocks!`, 'orange', true);
                    io.to(nextPlayer.id).emit('update in play cards', nextPlayer.inPlayCards);
                }
                // Check if still has Stocks
                if (!nextPlayer.inPlayCards.some(card => card.name === 'Stocks')) {
                    nextPlayer.isSilenced = false;
                    sendGameMessage(room.name, `${nextPlayer.name} พ้นจากสถานะถูกข้ามตาแล้ว.`, 'green', true);
                }
            }
            nextTurnIndex = (nextTurnIndex + 1) % alivePlayers.length;
            nextPlayer = alivePlayers[nextTurnIndex];
            attempts++;
        }

        if (attempts >= maxAttempts) {
            sendGameMessage(room.name, "No active players can take a turn. Forcing next phase.", 'red', true);
            changePhase(room.name); // No one can play, advance phase
            return;
        }
        nextPlayerUniqueId = nextPlayer.uniqueId;
    }

    room.currentTurnPlayerUniqueId = nextPlayerUniqueId;
    sendGameMessage(room.name, `${room.players[nextPlayerUniqueId].name}'s turn.`, 'blue', true);
    io.to(room.players[nextPlayerUniqueId].id).emit('your turn');
    io.to(room.players[nextPlayerUniqueId].id).emit('enable draw button'); // Re-enable draw button for new player
    
    // Reset the hasPlayedCardsThisTurn flag for the new player
    room.players[nextPlayerUniqueId].hasPlayedCardsThisTurn = false;
    
    emitRoomState(room.name);

    // --- Only shuffle discard pile into draw pile at the start of a new DAY phase ---
    if (room.currentPhase === 'DAY' && room.dayNumber > 0 && !room.hasShuffledThisDay) {
        if (room.discardPile && room.discardPile.length > 0) {
            room.drawPile = room.drawPile || [];
            room.drawPile = room.drawPile.concat(room.discardPile);
            room.discardPile = [];
        }
        if (room.drawPile && room.drawPile.length > 0) {
            // เอา Night card ออกทั้งหมด ยกเว้น 1 ใบ
            const nightCards = room.drawPile.filter(card => card.name === 'Night');
            const otherCards = room.drawPile.filter(card => card.name !== 'Night');
            const shuffled = shuffleArray(otherCards);
            // วาง Night card 1 ใบไว้ล่างสุดเสมอ
            const nightCard = nightCards.length > 0 ? [nightCards[0]] : [];
            room.drawPile = shuffled.concat([]); // shuffle เฉพาะใบอื่น
            if (nightCard.length > 0) {
                room.drawPile.push(nightCard[0]); // push Night card ไปล่างสุด
            }
        }
        room.hasShuffledThisDay = true;
        sendGameMessage(room.name, 'สับกองทิ้งกลับเข้ากองจั่วสำหรับวันใหม่! (Night card อยู่ล่างสุด)', 'orange', true);
        sendDeckInfo(room.name);
    }
    // Reset flag at the end of the day (when phase changes away from DAY)
    if (room.currentPhase !== 'DAY') {
        room.hasShuffledThisDay = false;
    }
}

function startPhaseTimer(roomName, duration) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    clearInterval(room.phaseInterval);
    room.phaseTimer = duration / 1000;
    if (duration === 0) {
        room.phaseTimer = 0; // Ensure it's zero for manual advance
        emitRoomState(roomName);
        return;
    }
    room.phaseInterval = setInterval(() => {
        room.phaseTimer--;
        emitRoomState(roomName);
        if (room.phaseTimer <= 0) {
            clearInterval(room.phaseInterval);
            if (!room.gameOver) { // Prevent phase change if game already ended
                changePhase(roomName);
            }
        }
    }, 1000);
}

// forcedNextPhase allows a card or event to directly trigger a phase change
function changePhase(roomName, forcedNextPhase = null) {
    const room = rooms[roomName];
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
            sendGameMessage(room.name, 'คืนกำลังจะมาถึง...', 'purple', true);
                nextPhase = 'NIGHT';
            // Removed data clearing - keep accusations, confessors, and turn state
            break;
            case 'NIGHT':
                if (room.dayNumber === 0) {
                    // First day - skip PRE_DAWN and go directly to DAY
                    sendGameMessage(room.name, 'เช้าแล้ว! วันใหม่เริ่มต้นขึ้น.', 'blue', true);
                    nextPhase = 'DAY';
                    room.dayNumber++;
                    room.blackCatHolderAlreadyActedThisDay = false;
                    room.playersWhoActedAtNight = {};
                    room.nightConfessors = [];
                } else {
                    // เข้าสู่ NIGHT จริง ๆ
                    sendGameMessage(room.name, 'กลางคืนเริ่มต้นขึ้น! ปอบและหมอผีเตรียมตัว...', 'purple', true);
                    nextPhase = 'NIGHT';
                    // ไม่ต้อง set confessionOrder ที่นี่
                }
                break;
        case 'PRE_DAWN':
            // ตั้งค่าลำดับสารภาพ
            room.confessionOrder = [];
            const witchTarget = room.playersWhoActedAtNight['witchKill'];
            if (room.nightCardDrawer && (!room.playersWhoActedAtNight['constableSave'] || room.nightCardDrawer !== room.playersWhoActedAtNight['constableSave'])) {
                // ข้ามถ้ามี Asylum
                const p = room.players[room.nightCardDrawer];
                if (!p.inPlayCards.some(card => card.name === 'Asylum')) {
                room.confessionOrder.push(room.nightCardDrawer);
                }
            }
            const constableSaveTarget = room.playersWhoActedAtNight['constableSave'];
            getAlivePlayers(room).forEach(p => {
                if (
                    p.uniqueId !== room.nightCardDrawer &&
                    p.uniqueId !== constableSaveTarget &&
                    !p.inPlayCards.some(card => card.name === 'Asylum')
                ) {
                    room.confessionOrder.push(p.uniqueId);
                }
            });
            // witchTarget มีสิทธิ์สารภาพ (แต่ต้องอยู่ท้ายสุด)
            if (witchTarget && !room.confessionOrder.includes(witchTarget)) {
                const p = room.players[witchTarget];
                if (!p.inPlayCards.some(card => card.name === 'Asylum')) {
                room.confessionOrder.push(witchTarget);
                }
            }
            room.currentConfessionIndex = 0;
            // เริ่ม timer สารภาพคนแรก
            if (room.confessionOrder.length > 0 && room.confessionTimerDuration > 0) {
                const firstConfessor = room.confessionOrder[0];
                const firstPlayer = room.players[firstConfessor];
                if (firstPlayer && firstPlayer.alive && firstPlayer.tryalCards.length > 0) {
                    sendGameMessage(room.name, `${firstPlayer.name} มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'purple', true);
                    startConfessionTimer(roomName, firstConfessor);
                }
            }
            nextPhase = 'PRE_DAWN';
            break;
        case 'GAME_OVER':
            return; // Game is over, no more phase changes
        default:
            console.warn(`Unknown phase: ${currentPhase}`);
            return;
    }

    room.currentPhase = nextPhase;
    nextDuration = room.phaseConfig[nextPhase] || DEFAULT_PHASE_DURATIONS[nextPhase];
    startPhaseTimer(roomName, nextDuration);
    emitRoomState(roomName);

    // If transitioning to NIGHT, prompt witch and constable actions
    if (nextPhase === 'NIGHT') {
        // ก่อนเข้า NIGHT: รีเซ็ตและอัปเดต isWitch/isConstable ตาม Tryal Cards ที่อยู่ในมือ
        Object.values(room.players).forEach(player => {
            player.isWitch = player.tryalCards.some(card => card.name === 'Witch');
            player.isConstable = player.tryalCards.some(card => card.name === 'Constable');
        });
        emitRoomState(roomName);
        // --- เพิ่มเช็ค win condition ทันทีเมื่อเข้า NIGHT ---
        checkWinCondition(room);
        if (room.gameOver) return; // ถ้าจบเกมแล้ว ไม่ต้องดำเนินต่อ
        const constables = getAlivePlayers(room).filter(p => p.isConstable);
        const witches = getAlivePlayers(room).filter(p => p.isWitch);
        
        console.log('Night phase - Checking roles:');
        console.log('Constables:', constables.map(p => ({ name: p.name, isConstable: p.isConstable })));
        console.log('Witches:', witches.map(p => ({ name: p.name, isWitch: p.isWitch })));
        
            if (witches.length > 0) {
            // ปอบเลือกเป้าหมาย
                sendGameMessage(room.name, 'ปอบ, เตรียมตัวเลือกเป้าหมายที่จะสังหาร.', 'darkred', true);
                witches.forEach(witch => {
                io.to(witch.id).emit('prompt witch kill');
            });
            // ไม่ prompt constable ที่นี่ ให้รอปอบเลือกเสร็จ
        } else if (constables.length > 0) {
            // ไม่มีปอบ ให้ prompt constable ทันที
                        sendGameMessage(room.name, 'หมอผี, เตรียมตัวใช้ค้อนเพื่อปกป้องผู้เล่น.', 'purple', true);
            constables.forEach(constable => {
                io.to(constable.id).emit('prompt constable action');
            });
                    } else {
            // ไม่มีปอบ ไม่มีสายตรวจ ข้ามไป PRE_DAWN
            changePhase(roomName, 'PRE_DAWN');
        }
    } else if (nextPhase === 'DAY') {
        // --- Always shuffle discard pile into gameDeck and place Night card at the bottom at the start of DAY phase ---
        if (room.discardPile && room.discardPile.length > 0) {
            room.gameDeck = room.gameDeck || [];
            room.gameDeck = room.gameDeck.concat(room.discardPile);
            room.discardPile = [];
        }
        if (room.gameDeck && room.gameDeck.length > 0) {
            // Remove all Night cards except one
            const nightCards = room.gameDeck.filter(card => card.name === 'Night');
            const otherCards = room.gameDeck.filter(card => card.name !== 'Night');
            const shuffled = shuffleArray(otherCards);
            // Place only one Night card at the LAST index (bottom of the deck)
            const nightCard = nightCards.length > 0 ? [nightCards[0]] : [];
            room.gameDeck = shuffled;
            if (nightCard.length > 0) {
                room.gameDeck.push(nightCard[0]); // push Night card to the last position
            }
        }
        setNextTurn(room); // Start the turn cycle for the day phase
    }

    // --- ใน changePhase (หลังหมดเวลา NIGHT ก่อน changePhase(roomName, 'PRE_DAWN')) ---
    if (room.playersWhoActedAtNight && room.playersWhoActedAtNight['constableSave']) {
        const savedPlayer = room.players[room.playersWhoActedAtNight['constableSave']];
        if (savedPlayer && savedPlayer.alive) {
            sendGameMessage(room.name, `${savedPlayer.name} ได้รับการปกป้องจากหมอผี!`, 'green', true);
        }
    }
    getAlivePlayers(room).forEach(p => {
        if (p.inPlayCards.some(card => card.name === 'Asylum')) {
            sendGameMessage(room.name, `${p.name} ได้รับการปกป้องจาก Asylum!`, 'green', true);
        }
    });
    // ...
    // changePhase(roomName, 'PRE_DAWN');
}

function startGame(roomName) {
    const room = rooms[roomName];
    if (!room || room.gameStarted) return;

    const alivePlayers = getAlivePlayers(room);
    if (alivePlayers.length < MIN_PLAYERS_TO_START) {
        io.to(room.hostUniqueId).emit('game message', `ต้องการผู้เล่นอย่างน้อย ${MIN_PLAYERS_TO_START} คนเพื่อเริ่มเกม`, 'red', true);
        return;
    }

    room.gameStarted = true;
    room.dayNumber = 0; // Start at Day 0, will increment to Day 1
    room.currentPhase = 'LOBBY'; // Set to Lobby, next changePhase will move to DAY
    room.blackCatHolder = null; // Will be assigned the first Black Cat drawn
    room.gameMessageHistory = []; // Reset game message history for new game

    // --- Dynamically create TRYAL_CARDS deck based on player count ---
    const playerCount = alivePlayers.length;
    const TRYAL_CARDS = [];
    let witchCount = 0;

    // ปรับเงื่อนไขใหม่: 4-5 คน = 1 ใบ, 6-9 คน = 2 ใบ, 10-12 คน = 3 ใบ
    if (playerCount >= 4 && playerCount <= 5) {
        witchCount = 1;
    } else if (playerCount >= 6 && playerCount <= 9) {
        witchCount = 2;
    } else if (playerCount >= 10 && playerCount <= PLAYER_LIMIT) {
        witchCount = 3;
    }

    // Add Witch cards
    for (let i = 0; i < witchCount; i++) {
        TRYAL_CARDS.push({ name: 'Witch', type: 'Role' });
    }
    // Add Constable card
    TRYAL_CARDS.push({ name: 'Constable', type: 'Role' });
    // Fill the rest with 'Not A Witch' cards to make 5 per player
    const requiredTryalCards = playerCount * 5;
    const notAWitchCount = requiredTryalCards - TRYAL_CARDS.length;
    for (let i = 0; i < notAWitchCount; i++) {
        TRYAL_CARDS.push({ name: 'Not A Witch', type: 'Role' });
    }

    const shuffledTryalCards = shuffleArray([...TRYAL_CARDS]);
    let tryalCardIndex = 0;
    const witches = []; // Array to hold witch players
    alivePlayers.forEach(player => {
        player.tryalCards = [];
        player.revealedTryalCardIndexes = new Set(); // Reset revealed roles for new game
        player.isWitch = false; // Reset role
        player.isConstable = false; // Reset role
        player.hasBeenWitch = false; // Reset has been witch status for new game
        player.isSilenced = false; // Reset status
        player.inPlayCards = []; // Clear permanent cards from previous game
        player.hand = []; // Clear hand from previous game
        player.hasPlayedCardsThisTurn = false; // Initialize turn action flag

        // Deal 5 Tryal Cards to each player
        for (let i = 0; i < 5; i++) {
            if (tryalCardIndex < shuffledTryalCards.length) {
                const card = shuffledTryalCards[tryalCardIndex++];
                player.tryalCards.push(card);
                if (card.name === 'Witch') {
                    player.isWitch = true;
                    player.hasBeenWitch = true; // Mark that this player has been a witch
                    witches.push(player); // Add the player object to the witches array
                } else if (card.name === 'Constable') {
                    player.isConstable = true;
                }
            }
        }
    });

    // --- New Card Dealing Logic ---

    // 1. Separate special cards from the main deck
    const allGameCards = getGameCardsForPlayerCount(playerCount);
    const conspiracyCards = allGameCards.filter(c => c.name === 'Conspiracy');
    const nightCards = allGameCards.filter(c => c.name === 'Night');
    const blackCatCard = allGameCards.find(c => c.name === 'Black Cat');

    // Create the initial deck for dealing, without the special cards (and filter out ALL Night cards)
    let initialDealingDeck = allGameCards.filter(c => c.name !== 'Conspiracy' && c.name !== 'Night' && c.name !== 'Black Cat');

    // 2. Shuffle the initial deck and deal 3 cards to each player
    initialDealingDeck = shuffleArray(initialDealingDeck);
    alivePlayers.forEach(player => {
        for (let i = 0; i < 3; i++) { // Deal 3 cards
            if (initialDealingDeck.length > 0) {
                player.hand.push(initialDealingDeck.pop());
            }
        }
        io.to(player.id).emit('update hand', player.hand);
        io.to(player.id).emit('update tryal cards initial', player.tryalCards);
        emitRoomState(room.name);
    });

    // 3. Prepare the final game deck (no Night, no Conspiracy, no Black Cat)
    room.gameDeck = initialDealingDeck;

    // 4. Add Conspiracy cards back and shuffle
    room.gameDeck.push(...conspiracyCards);
    room.gameDeck = shuffleArray(room.gameDeck);

    // 5. Place only ONE Night card at the bottom of the deck (to be drawn last)
    if (nightCards.length > 0) {
        room.gameDeck.push(nightCards[0]); // Only add the first Night card
    }

    /// 6. Handle the Black Cat card - keep it separate for the Witch to assign
    if (witches.length > 0) {
        room.pendingBlackCatCard = blackCatCard; // Store it in the room state
        room.isAssigningBlackCat = true;
        sendGameMessage(room.name, 'การ์ดเครื่องเซ่นถูกแยกไว้ต่างหาก ปอบจะเลือกผู้เล่นที่จะได้รับการ์ดนี้.', 'purple', true);
        // Emit a prompt to the witch(es) to make a choice
        const potentialTargets = alivePlayers; // Witch can assign to anyone, including themselves.
        witches.forEach(witchPlayer => {
            io.to(witchPlayer.id).emit('popup assign black cat', potentialTargets.map(p => ({ uniqueId: p.uniqueId, name: p.name })));
        });
        // Update clients to show the witch action UI
        emitRoomState(room.name);
        
        // Send initial deck information
        sendDeckInfo(roomName);
    } else {
        sendGameMessage(room.name, 'ไม่มีปอบในเกม การ์ดเครื่องเซ่นจึงไม่ถูกใช้งานในตอนนี้.', 'grey');
        if (blackCatCard) { // Check if blackCatCard was found
            room.discardPile.push(blackCatCard); // Discard the card if no witch
        }
        room.pendingBlackCatCard = null;
        // If no witch, proceed directly to the game
        sendGameMessage(room.name, 'เกมเริ่มแล้ว! คืนแรกได้เริ่มต้นขึ้น.', 'green', true);
        changePhase(room.name, 'NIGHT');
        
        // Send initial deck information
        sendDeckInfo(roomName);
    }
}

function playCard(roomName, playerUniqueId, cardIndex, targetUniqueId = null, secondTargetUniqueId = null) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
        io.to(room.players[playerUniqueId].id).emit('game message', 'ตอนนี้ยังเล่นการ์ดไม่ได้.', 'red');
        return;
    }

    const player = room.players[playerUniqueId];
    if (!player || !player.alive || player.uniqueId !== room.currentTurnPlayerUniqueId) {
        io.to(player.id).emit('game message', 'ไม่ใช่ตาของคุณหรือคุณไม่สามารถเล่นได้.', 'red');
        return;
    }

    if (player.isSilenced) {
        io.to(player.id).emit('game message', 'คุณถูกทำให้เงียบและไม่สามารถเล่นการ์ดได้.', 'red');
        return;
    }

    if (room.playerForcedToRevealTryal) {
        io.to(player.id).emit('game message', `รอให้ ${room.players[room.playerForcedToRevealTryal].name} เปิดเผยการ์ดชีวิตก่อน`, 'orange');
        return;
    }

    const cardToPlay = player.hand[cardIndex];
    if (!cardToPlay) {
        io.to(player.id).emit('game message', 'การ์ดไม่ถูกต้อง.', 'red');
        return;
    }

    // Check if a target is required but not provided, or vice-versa
    const cardNeedsTarget = CARDS_NEED_TARGET.includes(cardToPlay.name);
    const cardNeedsTwoTargets = CARDS_NEED_TWO_TARGETS.includes(cardToPlay.name);
    
    if (cardNeedsTwoTargets && (!targetUniqueId || !secondTargetUniqueId)) {
        io.to(player.id).emit('game message', 'การ์ดนี้ต้องการเป้าหมาย 2 คน.', 'red');
        return;
    } else if (cardNeedsTarget && !cardNeedsTwoTargets && !targetUniqueId) {
        io.to(player.id).emit('game message', 'การ์ดนี้ต้องการเป้าหมาย.', 'red');
        return;
    }
    if (!cardNeedsTarget && (targetUniqueId || secondTargetUniqueId)) {
        io.to(player.id).emit('game message', 'การ์ดนี้ไม่ต้องการเป้าหมาย.', 'red');
        return;
    }

    if (targetUniqueId && !room.players[targetUniqueId]?.alive) {
        io.to(player.id).emit('game message', 'เป้าหมายแรกไม่อยู่ในเกมแล้ว.', 'red');
        return;
    }
    if (secondTargetUniqueId && !room.players[secondTargetUniqueId]?.alive) {
        io.to(player.id).emit('game message', 'เป้าหมายที่สองไม่อยู่ในเกมแล้ว.', 'red');
        return;
    }

    // --- Piety effect: Prevent red cards from targeting players with Piety ---
    const RED_CARD_NAMES = ['Accusation', 'Evidence', 'Witness'];
    if (
        RED_CARD_NAMES.includes(cardToPlay.name) &&
        targetUniqueId &&
        room.players[targetUniqueId]?.inPlayCards.some(c => c.name === 'Piety')
    ) {
        io.to(player.id).emit('game message', `${room.players[targetUniqueId].name} มีการ์ด Piety ไม่สามารถโจมตีด้วยการ์ดสีแดงได้!`, 'red');
        return;
    }

    // Remove card from hand
    player.hand.splice(cardIndex, 1);
    
    // Move red and green cards to discard pile (Action and Accusation cards)
    if (cardToPlay.color === 'Green') {
        room.discardPile.push(cardToPlay);
        sendGameMessage(room.name, `การ์ด ${cardToPlay.name} ถูกทิ้งไปยังกองทิ้ง.`, 'grey');
    }
    // Note: Blue cards (Permanent) stay in play, Black cards (Event) are resolved and discarded
    // RED cards (Accusation) will be handled in the card effects section

    let message = `${player.name} เล่นการ์ด ${cardToPlay.name}.`;
    let messageColor = 'blue';

    // Handle card effects
    switch (cardToPlay.name) {
        case 'Accusation':
        case 'Evidence':
        case 'Witness':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                room.accusedPlayers[targetUniqueId] = (room.accusedPlayers[targetUniqueId] || 0) + cardToPlay.value;
                message = `${player.name} กล่าวหา ${targetPlayer.name} ด้วยการ์ด ${cardToPlay.name} (+${cardToPlay.value} ข้อกล่าวหา).`;
                messageColor = 'red';
                sendGameMessage(room.name, message, messageColor, true);

                // Place RED card in front of the target player
                targetPlayer.inPlayCards.push(cardToPlay);
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);

                const totalAccusations = room.accusedPlayers[targetUniqueId];
                if (totalAccusations >= 7) {
                    // Force Tryal Card reveal instead of confession
                    room.playerForcedToRevealTryal = targetUniqueId;
                    room.playerForcedToRevealSelector = player.uniqueId;
                    sendGameMessage(room.name, `${targetPlayer.name} มีข้อกล่าวหาถึง 7 แต้มและต้องเปิดเผยการ์ดชีวิต!`, 'gold', true);
                    // ส่ง event ไปยังผู้กล่าวหาให้เลือก tryal card ของเป้าหมาย
                    io.to(player.id).emit('prompt select accused tryal', {
                        accusedUniqueId: targetUniqueId,
                        tryalCount: targetPlayer.tryalCards.length
                    });
                    emitRoomState(room.name);
                    return;
                }
            }
            break;
        case 'Scapegoat':
            if (targetUniqueId && secondTargetUniqueId) {
                const sourcePlayer = room.players[targetUniqueId];
                const destPlayer = room.players[secondTargetUniqueId];
                // Move blue, green, and red cards from source to destination
                const blueCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Blue');
                const greenCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Green');
                const redCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Red');
                // Remove from source
                sourcePlayer.inPlayCards = sourcePlayer.inPlayCards.filter(card => !['Blue','Green','Red'].includes(card.color));
                // Add to destination
                destPlayer.inPlayCards.push(...blueCards, ...greenCards, ...redCards);
                // Stocks: if any moved, update isSilenced
                if (greenCards.some(card => card.name === 'Stocks')) {
                    destPlayer.isSilenced = true;
                    sourcePlayer.isSilenced = sourcePlayer.inPlayCards.some(card => card.name === 'Stocks');
                }
                io.to(sourcePlayer.id).emit('update in play cards', sourcePlayer.inPlayCards);
                io.to(destPlayer.id).emit('update in play cards', destPlayer.inPlayCards);
                sendGameMessage(room.name, `${player.name} ย้ายการ์ดถาวร (แดง/เขียว/น้ำเงิน) จาก ${sourcePlayer.name} ไปยัง ${destPlayer.name}.`, 'purple');
                // --- ย้ายข้อกล่าวหา (accusationPoints) ถ้ามีการ์ดแดงถูกย้าย ---
                const accusationPointsToMove = room.accusedPlayers[targetUniqueId] || 0;
                if (redCards.length > 0 && accusationPointsToMove > 0) {
                    room.accusedPlayers[secondTargetUniqueId] = (room.accusedPlayers[secondTargetUniqueId] || 0) + accusationPointsToMove;
                    room.accusedPlayers[targetUniqueId] = 0;
                    sendGameMessage(room.name, `ข้อกล่าวหาของ ${sourcePlayer.name} ถูกย้ายไปให้ ${destPlayer.name} ด้วย!`, 'red');
                    // ถ้าข้อกล่าวหาใหม่ครบ 7 แต้ม ให้เปิด Tryal Card
                    if (room.accusedPlayers[secondTargetUniqueId] >= 7) {
                        room.playerForcedToRevealTryal = secondTargetUniqueId;
                        room.playerForcedToRevealSelector = player.uniqueId;
                        sendGameMessage(room.name, `${destPlayer.name} มีข้อกล่าวหาถึง 7 แต้มและต้องเปิดเผยการ์ดชีวิต!`, 'gold', true);
                        io.to(player.id).emit('prompt select accused tryal', {
                            accusedUniqueId: secondTargetUniqueId,
                            tryalCount: destPlayer.tryalCards.length
                        });
                        emitRoomState(room.name);
                        return;
                    }
                }
            }
            break;
        case 'Curse':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                const blueCards = targetPlayer.inPlayCards.filter(c => c.color === 'Blue');
                if (blueCards.length > 0) {
                    if (blueCards.length === 1) {
                        // Only one blue card, discard it automatically
                        const cardToDiscard = blueCards[0];
                    targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(c => c !== cardToDiscard);
                    room.discardPile.push(cardToDiscard);
                    sendGameMessage(room.name, `${targetPlayer.name} ทิ้งการ์ด ${cardToDiscard.name} เนื่องจากโดนคำสาป.`, 'red');
                    io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                    // If Black Cat is discarded, reset holder
                    if (cardToDiscard.name === 'Black Cat') {
                        room.blackCatHolder = null;
                        sendGameMessage(room.name, 'การ์ดพิธีเซ่นไหว้ ถูกทิ้งแล้ว!', 'grey');
                    }
                } else {
                        // Multiple blue cards, prompt player to choose
                        room.awaitingCurseSelection = {
                            selector: playerUniqueId,
                            target: targetUniqueId,
                            blueCards: blueCards
                        };
                        sendGameMessage(room.name, `${player.name} ต้องเลือกการ์ดสีน้ำเงินของ ${targetPlayer.name} เพื่อทิ้ง.`, 'purple', true);
                        io.to(player.id).emit('prompt select curse target', {
                            targetUniqueId: targetUniqueId,
                            blueCards: blueCards
                        });
                        return; // Don't end turn yet
                    }
                } else {
                    sendGameMessage(room.name, `${targetPlayer.name} ไม่มีการ์ดสีน้ำเงินให้ทิ้ง.`, 'grey');
                }
            }
            break;
        case 'Alibi':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                room.accusedPlayers[targetUniqueId] = Math.max(0, (room.accusedPlayers[targetUniqueId] || 0) - 3);
                sendGameMessage(room.name, `${player.name} เล่น Alibi ให้ ${targetPlayer.name} (-3 ข้อกล่าวหา).`, 'green');
            }
            break;
        case 'Robbery':
            if (targetUniqueId && secondTargetUniqueId) {
                const sourcePlayer = room.players[targetUniqueId];
                const destPlayer = room.players[secondTargetUniqueId];
                if (sourcePlayer.hand.length > 0) {
                    destPlayer.hand.push(...sourcePlayer.hand);
                    sourcePlayer.hand = [];
                    sendGameMessage(room.name, `${player.name} ขโมยการ์ดบนมือทั้งหมดจาก ${sourcePlayer.name} ไปยัง ${destPlayer.name}.`, 'green');
                    io.to(sourcePlayer.id).emit('update hand', sourcePlayer.hand);
                    io.to(destPlayer.id).emit('update hand', destPlayer.hand);
                } else {
                    sendGameMessage(room.name, `${sourcePlayer.name} ไม่มีมือให้ขโมย.`, 'grey');
                }
            }
            break;
        case 'Stocks':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                // Add Stocks card to target player's inPlayCards (stackable)
                targetPlayer.inPlayCards.push(cardToPlay);
                targetPlayer.isSilenced = true; // Mark player as silenced
                sendGameMessage(room.name, `${player.name} ใช้ Stocks กับ ${targetPlayer.name}. ${targetPlayer.name} จะไม่สามารถเล่นการ์ดหรือกระทำการใดๆ ได้ในเทิร์นหน้า.`, 'orange', true);
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                // Silence effect will be cleared at the start of new day in setNextTurn function
            }
            break;
        case 'Arson':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                if (targetPlayer.hand.length > 0) {
                    room.discardPile.push(...targetPlayer.hand); // Add to discard pile
                    targetPlayer.hand = [];
                    sendGameMessage(room.name, `${player.name} ใช้ Arson กับ ${targetPlayer.name}. ${targetPlayer.name} ทิ้งการ์ดบนมือทั้งหมด.`, 'orange');
                    io.to(targetPlayer.id).emit('update hand', targetPlayer.hand);
                } else {
                    io.to(player.id).emit('game message', `${targetPlayer.name} ไม่มีมือให้ทิ้ง.`, 'grey');
                }
            }
            break;
        case 'Black Cat':
            // Black Cat goes to the player who plays it
            player.inPlayCards.push(cardToPlay);
                room.blackCatHolder = player.uniqueId;
                sendGameMessage(room.name, `${player.name} ถือ การ์ดพิธีเซ่นไหว้!`, 'grey', true);
            io.to(player.id).emit('update in play cards', player.inPlayCards);
            break;
        case 'Asylum':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                targetPlayer.inPlayCards.push(cardToPlay);
                sendGameMessage(room.name, `${player.name} ให้ ${targetPlayer.name} การ์ด Asylum เพื่อป้องกันการถูกฆ่าในรอบกลางคืน.`, 'blue');
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
            }
            break;
        case 'Piety':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                targetPlayer.inPlayCards.push(cardToPlay);
                sendGameMessage(room.name, `${player.name} ให้ ${targetPlayer.name} การ์ด Piety เพื่อป้องกันการโจมตีด้วยการ์ดสีแดง.`, 'blue');
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
            }
            break;
        case 'Matchmaker':
            if (targetUniqueId) {
                const targetPlayer = room.players[targetUniqueId];
                targetPlayer.inPlayCards.push(cardToPlay);
                sendGameMessage(room.name, `${player.name} ให้ ${targetPlayer.name} การ์ด Matchmaker.`, 'blue');
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
            }
            break;
        case 'Conspiracy':
            if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                const bcHolder = room.players[room.blackCatHolder];
                if (bcHolder.tryalCards.length > 0) {
                    room.awaitingConspiracySelection = {
                        selector: playerUniqueId,
                        target: room.blackCatHolder,
                        tryalCount: bcHolder.tryalCards.length
                    };
                    sendGameMessage(room.name, `${player.name} จั่วการ์ดเหตุการณ์: พิธีเซ่นไหว้!`, 'black', true); // เปลี่ยนชื่อการ์ด
                    sendGameMessage(room.name, `${player.name} ต้องเลือกการ์ดชีวิตของ ${bcHolder.name} เพื่อเปิดเผย.`, 'purple', true);
                    io.to(player.id).emit('prompt select blackcat tryal', {
                        blackCatHolder: room.blackCatHolder,
                        tryalCount: bcHolder.tryalCards.length
                    });
                    // รอให้ selector เลือกผ่าน UI ก่อน promptTryalCardSelectionToLeft และจบเทิร์น
                    room.discardPile.push(cardToPlay); // <--- FIX: discard Conspiracy after use
                    return; // ไม่จบเทิร์นทันที
                } else {
                    sendGameMessage(room.name, `Black Cat holder ${bcHolder.name} ไม่มี Tryal Card ให้เปิดเผย.`, 'grey');
                }
            } else {
                sendGameMessage(room.name, 'ไม่มีผู้ถือ การ์ดพิธีเซ่นไหว้ อยู่ในเกม.', 'grey');
                // Conspiracy ไม่มีผล (ไม่ต้องเลือกไพ่ใคร)
                // ไม่ break! ต้องวนซ้ายต่อ
            }
            promptTryalCardSelectionToLeft(roomName);
            room.discardPile.push(cardToPlay); // <--- FIX: discard Conspiracy after use
            break;
        default:
            sendGameMessage(room.name, `การ์ด ${cardToPlay.name} ยังไม่มีผลในเกมนี้.`, 'grey');
            break;
    }

    io.to(player.id).emit('update hand', player.hand);
    emitRoomState(room.name);
    // Don't automatically advance to next turn - let player end their turn manually
    sendGameMessage(room.name, `${player.name} เล่นการ์ดแล้ว. สามารถเล่นการ์ดเพิ่มเติมหรือจบเทิร์น.`, 'blue');
    
    // Mark that player has played cards this turn
    player.hasPlayedCardsThisTurn = true;
    
    // Disable draw button after playing a card
    io.to(player.id).emit('disable draw button');
    
    // Send deck information update
    sendDeckInfo(roomName);

    // --- Action Log: ทุกครั้งที่เล่นการ์ด ---
    sendGameMessage(room.name, `${player.name} ใช้การ์ด ${cardToPlay.name}${targetUniqueId ? ' กับ ' + room.players[targetUniqueId].name : ''}`,'orange', true);

    // --- Prevent self-targeting for Salem cards (Red, Green, Blue) except Black Cat ---
    const SALEM_COLORS = ['Red', 'Green', 'Blue'];
    const BLUE_CARDS_EXCEPT_BLACK_CAT = ['Asylum', 'Piety', 'Matchmaker'];
    
    // Check for Red and Green cards (no exceptions)
    if (
        cardNeedsTarget &&
        (cardToPlay.color === 'Red' || cardToPlay.color === 'Green') &&
        targetUniqueId === playerUniqueId
    ) {
        io.to(player.id).emit('game message', 'ไม่สามารถใช้การ์ดซาเลมกับตัวเองได้', 'red');
        return;
    }
    if (
        cardNeedsTwoTargets &&
        (cardToPlay.color === 'Red' || cardToPlay.color === 'Green') &&
        (targetUniqueId === playerUniqueId || secondTargetUniqueId === playerUniqueId)
    ) {
        io.to(player.id).emit('game message', 'ไม่สามารถใช้การ์ดซาเลมกับตัวเองได้', 'red');
        return;
    }
    
    // Check for Blue cards (except Black Cat)
    if (
        cardNeedsTarget &&
        cardToPlay.color === 'Blue' &&
        BLUE_CARDS_EXCEPT_BLACK_CAT.includes(cardToPlay.name) &&
        targetUniqueId === playerUniqueId
    ) {
        io.to(player.id).emit('game message', 'ไม่สามารถใช้การ์ดสีน้ำเงินกับตัวเองได้ (ยกเว้นการ์ดพิธีเซ่นไหว้)', 'red');
        return;
    }
    if (
        cardNeedsTwoTargets &&
        cardToPlay.color === 'Blue' &&
        BLUE_CARDS_EXCEPT_BLACK_CAT.includes(cardToPlay.name) &&
        (targetUniqueId === playerUniqueId || secondTargetUniqueId === playerUniqueId)
    ) {
        io.to(player.id).emit('game message', 'ไม่สามารถใช้การ์ดสีน้ำเงินกับตัวเองได้ (ยกเว้นการ์ดพิธีเซ่นไหว้)', 'red');
        return;
    }
}

function endTurn(roomName, playerUniqueId) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
        io.to(room.players[playerUniqueId].id).emit('game message', 'ตอนนี้ยังจบเทิร์นไม่ได้.', 'red');
        return;
    }

    const player = room.players[playerUniqueId];
    if (!player || !player.alive || player.uniqueId !== room.currentTurnPlayerUniqueId) {
        io.to(player.id).emit('game message', 'ไม่ใช่ตาของคุณหรือคุณไม่สามารถจบเทิร์นได้.', 'red');
        return;
    }

    if (room.playerForcedToRevealTryal) {
        io.to(player.id).emit('game message', `รอให้ ${room.players[room.playerForcedToRevealTryal].name} เปิดเผยการ์ดชีวิตก่อน`, 'orange');
        return;
    }

    sendGameMessage(room.name, `${player.name} จบเทิร์นแล้ว.`, 'blue', true);
    
    setNextTurn(room); // Now advance to next player's turn
}

function drawCards(roomName, playerUniqueId, count = 2) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
        io.to(room.players[playerUniqueId].id).emit('game message', 'ตอนนี้ยังจั่วการ์ดไม่ได้.', 'red');
        return;
    }

    const player = room.players[playerUniqueId];
    if (!player || !player.alive || player.uniqueId !== room.currentTurnPlayerUniqueId) {
        io.to(player.id).emit('game message', 'ไม่ใช่ตาของคุณหรือคุณไม่สามารถเล่นได้.', 'red');
        return;
    }

    if (room.playerForcedToConfess) {
        io.to(player.id).emit('game message', `รอให้ ${room.players[room.playerForcedToConfess].name} สารภาพก่อน`, 'orange');
        return;
    }

    if (player.isSilenced) {
        io.to(player.id).emit('game message', 'คุณถูกทำให้เงียบและไม่สามารถจั่วการ์ดได้.', 'red');
        return;
    }

    // Check if player has already played cards this turn
    if (player.hasPlayedCardsThisTurn) {
        io.to(player.id).emit('game message', 'คุณได้เล่นการ์ดไปแล้วในเทิร์นนี้. คุณต้องจบเทิร์น.', 'red');
        return;
    }

    let drewAnyCard = false;
    for (let i = 0; i < count; i++) {
        if (room.gameDeck.length > 0) {
            const card = room.gameDeck.shift();
            // If an Event card is drawn, resolve it immediately
            if (card.type === 'Event') {
                sendGameMessage(room.name, `${player.name} จั่วการ์ดเหตุการณ์: ${card.name}!`, 'black', true);
                // Resolve event card
                switch (card.name) {
                    case 'Conspiracy':
                        if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                            const bcHolder = room.players[room.blackCatHolder];
                            if (bcHolder.tryalCards.length > 0) {
                                room.awaitingConspiracySelection = {
                                    selector: playerUniqueId,
                                    target: room.blackCatHolder,
                                    tryalCount: bcHolder.tryalCards.length
                                };
                                sendGameMessage(room.name, `${player.name} จั่วการ์ดเหตุการณ์: พิธีเซ่นไหว้!`, 'black', true); // เปลี่ยนชื่อการ์ด
                                sendGameMessage(room.name, `${player.name} ต้องเลือกการ์ดชีวิตของ ${bcHolder.name} เพื่อเปิดเผย.`, 'purple', true);
                                io.to(player.id).emit('prompt select blackcat tryal', {
                                    blackCatHolder: room.blackCatHolder,
                                    tryalCount: bcHolder.tryalCards.length
                                });
                                // รอให้ selector เลือกผ่าน UI ก่อน promptTryalCardSelectionToLeft และจบเทิร์น
                                room.discardPile.push(card); // <--- FIX: discard Conspiracy after use
                                return; // ไม่จบเทิร์นทันที
                            } else {
                                sendGameMessage(room.name, `Black Cat holder ${bcHolder.name} ไม่มี Tryal Card ให้เปิดเผย.`, 'grey');
                            }
                        } else {
                            sendGameMessage(room.name, 'ไม่มีผู้ถือการ์ด เครื่องเซ่น อยู่ในเกม.', 'grey');
                            // Conspiracy ไม่มีผล (ไม่ต้องเลือกไพ่ใคร)
                            // ไม่ break! ต้องวนซ้ายต่อ
                        }
                        promptTryalCardSelectionToLeft(roomName);
                        room.discardPile.push(card); // <--- FIX: discard Conspiracy after use
                        break;
                    case 'Night':
                        room.nightCardDrawer = playerUniqueId;
                        sendGameMessage(room.name, `${player.name} จั่วการ์ด Night! เข้าสู่กลางคืนทันที!`, 'purple', true);
                        // Don't add Night card to hand, discard it immediately
                        room.discardPile.push(card);
                        // Force transition to Night phase immediately
                        changePhase(roomName, 'NIGHT');
                        return; // Don't continue with turn, Night phase handles it
                }
            } else {
                player.hand.push(card);
            }
            drewAnyCard = true;
        } else {
            sendGameMessage(room.name, 'กองการ์ดหมดแล้ว! สับไพ่จาก Discard Pile ใหม่.', 'orange');
            // Reshuffle discard pile into game deck, but keep Night cards at bottom
            const nightCards = room.discardPile.filter(card => card.name === 'Night');
            const otherCards = room.discardPile.filter(card => card.name !== 'Night');
            room.gameDeck = shuffleArray([...otherCards]);
            room.discardPile = [];
            // Place Night cards at the bottom of the deck
            if (nightCards.length > 0) {
                room.gameDeck = room.gameDeck.concat(nightCards);
            }
            // Try drawing again
            if (room.gameDeck.length > 0) {
                const card = room.gameDeck.shift();
                player.hand.push(card);
                drewAnyCard = true;
            } else {
                sendGameMessage(room.name, 'ไม่มีการ์ดให้จั่ว.', 'red');
                break; // No more cards to draw, ไม่ข้ามเทิร์นทันที
            }
        }
    }
    io.to(player.id).emit('update hand', player.hand);
    emitRoomState(room.name);
    // Mark that player has drawn cards this turn
    player.hasPlayedCardsThisTurn = true;
    // จบเทิร์นอัตโนมัติหลังจั่ว (ถ้ามีการ์ดให้จั่ว)
    if (drewAnyCard) {
    setNextTurn(room);
    }
    // Send deck information update
    sendDeckInfo(roomName);
}

function confessTryalCard(roomName, playerUniqueId, cardIndex) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    if (!room || !room.gameStarted || room.currentPhase !== 'PRE_DAWN') {
        io.to(room.players[playerUniqueId].id).emit('game message', 'การสารภาพบาปใช้ได้เฉพาะในช่วงก่อนเช้าเท่านั้น.', 'red');
        return;
    }

    const player = room.players[playerUniqueId];
    if (!player || !player.alive) {
        io.to(player.id).emit('game message', 'คุณไม่สามารถสารภาพบาปได้.', 'red');
        return;
    }

    if (player.tryalCards.length === 0) {
        io.to(player.id).emit('game message', 'คุณไม่มี Tryal Card ให้สารภาพบาป.', 'red');
        return;
    }

    if (room.nightConfessors && room.nightConfessors.includes(playerUniqueId)) {
        io.to(player.id).emit('game message', 'คุณสารภาพบาปไปแล้วในคืนนี้.', 'red');
        return;
    }

    // Validate card index
    if (cardIndex < 0 || cardIndex >= player.tryalCards.length) {
        io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
        return;
    }

    const revealedCard = player.tryalCards.splice(cardIndex, 1)[0]; // Remove selected card
    player.revealedTryalCardIndexes.add(revealedCard.name);
    
    // Clear confession timer for this player
    clearConfessionTimer(roomName);
    
    // Initialize nightConfessors if it doesn't exist
    if (!room.nightConfessors) {
        room.nightConfessors = [];
    }
    room.nightConfessors.push(playerUniqueId); // Mark as confessed for the night

    sendGameMessage(room.name, `${player.name} สารภาพบาปและเปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
    io.to(player.id).emit('update tryal cards initial', player.tryalCards); // Update client's view
    io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes)); // Update client's revealed roles

    if (revealedCard.name === 'Witch') {
        player.isWitch = true;
        player.hasBeenWitch = true;
        sendGameMessage(room.name, `${player.name} คือปอบ!`, 'darkred', true);
        if (player.tryalCards.some(card => card.name === 'Witch') || revealedCard.name === 'Witch') {
            sendGameMessage(room.name, `${player.name} ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'darkred', true);
            handlePlayerDeath(room, player);
    emitRoomState(room.name);
            checkWinCondition(room);
            return;
        }
    }

    emitRoomState(room.name);
    checkWinCondition(room);

    // Advance to next confessor if any
    if (room.confessionOrder && room.currentConfessionIndex < room.confessionOrder.length - 1) {
        room.currentConfessionIndex++;
        emitRoomState(room.name);
        // Start confession timer for the next confessor
        const nextConfessor = room.confessionOrder[room.currentConfessionIndex];
        const nextPlayer = room.players[nextConfessor];
        if (nextPlayer && nextPlayer.alive && nextPlayer.tryalCards.length > 0 && room.confessionTimerDuration > 0) {
            sendGameMessage(room.name, `${nextPlayer.name} มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'purple', true);
            startConfessionTimer(roomName, nextConfessor);
        }
    } else {
        // สารภาพครบแล้ว เปลี่ยนเป็น DAY
        // reset state for new day
        room.dayNumber++;
        room.blackCatHolderAlreadyActedThisDay = false;
        room.playersWhoActedAtNight = {};
        room.nightConfessors = [];
        room.nightCardDrawer = null;
        room.confessionOrder = [];
        room.currentConfessionIndex = 0;
        room.currentPhase = 'DAY';
        emitRoomState(room.name);
        setNextTurn(room);
    }
}

function confessDuringNight(roomName, playerUniqueId, cardIndex) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    // เพิ่มเช็คว่าอยู่ใน PRE_DAWN เท่านั้น
    if (!room || !room.gameStarted || room.currentPhase !== 'PRE_DAWN') {
        io.to(room.players[playerUniqueId].id).emit('game message', 'ตอนนี้ยังสารภาพบาปไม่ได้.', 'red');
        return;
    }

    // Enforce confession order
    if (room.confessionOrder && room.confessionOrder.length > 0) {
        const currentConfessor = room.confessionOrder[room.currentConfessionIndex];
        if (playerUniqueId !== currentConfessor) {
            io.to(room.players[playerUniqueId].id).emit('game message', 'ยังไม่ถึงลำดับของคุณในการสารภาพบาป.', 'red');
            return;
        }
    }

    const player = room.players[playerUniqueId];
    if (!player || !player.alive) {
        io.to(player.id).emit('game message', 'คุณไม่สามารถสารภาพบาปได้.', 'red');
        return;
    }

    if (player.tryalCards.length === 0) {
        io.to(player.id).emit('game message', 'คุณไม่มี Tryal Card ให้สารภาพบาป.', 'red');
        return;
    }

    if (room.nightConfessors && room.nightConfessors.includes(playerUniqueId)) {
        io.to(player.id).emit('game message', 'คุณสารภาพบาปไปแล้วในคืนนี้.', 'red');
        return;
    }

    // Validate card index
    if (cardIndex < 0 || cardIndex >= player.tryalCards.length) {
        io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
        return;
    }

    const revealedCard = player.tryalCards.splice(cardIndex, 1)[0]; // Remove selected card
    player.revealedTryalCardIndexes.add(revealedCard.name);
    
    // Clear confession timer for this player
    clearConfessionTimer(roomName);
    
    // Initialize nightConfessors if it doesn't exist
    if (!room.nightConfessors) {
        room.nightConfessors = [];
    }
    room.nightConfessors.push(playerUniqueId); // Mark as confessed for the night

    sendGameMessage(room.name, `${player.name} สารภาพบาปและเปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
    io.to(player.id).emit('update tryal cards initial', player.tryalCards); // Update client's view
    io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes)); // Update client's revealed roles

    if (revealedCard.name === 'Witch') {
        player.isWitch = true;
        player.hasBeenWitch = true;
        sendGameMessage(room.name, `${player.name} คือปอบ!`, 'darkred', true);
        if (player.tryalCards.some(card => card.name === 'Witch') || revealedCard.name === 'Witch') {
            sendGameMessage(room.name, `${player.name} ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'darkred', true);
            handlePlayerDeath(room, player);
    emitRoomState(room.name);
            checkWinCondition(room);
            return;
        }
    }

    emitRoomState(room.name);
    checkWinCondition(room);

    // Advance to next confessor if any
    if (room.confessionOrder && room.currentConfessionIndex < room.confessionOrder.length - 1) {
        room.currentConfessionIndex++;
        emitRoomState(room.name);
        // Start confession timer for the next confessor
        const nextConfessor = room.confessionOrder[room.currentConfessionIndex];
        const nextPlayer = room.players[nextConfessor];
        if (nextPlayer && nextPlayer.alive && nextPlayer.tryalCards.length > 0 && room.confessionTimerDuration > 0) {
            sendGameMessage(room.name, `${nextPlayer.name} มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'purple', true);
            startConfessionTimer(roomName, nextConfessor);
        }
    } else {
        // สารภาพครบแล้ว เปลี่ยนเป็น DAY
        // reset state for new day
        room.dayNumber++;
        room.blackCatHolderAlreadyActedThisDay = false;
        room.playersWhoActedAtNight = {};
        room.nightConfessors = [];
        room.nightCardDrawer = null;
        room.confessionOrder = [];
        room.currentConfessionIndex = 0;
        room.currentPhase = 'DAY';
        emitRoomState(room.name);
        setNextTurn(room);
    }
}

function resolveNightActions(roomName) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;

    sendGameMessage(room.name, 'ช่วงเวลากลางคืนจบลงถึงช่วงเวลาสารภาพ...', 'purple', true);

    // Debug log
    console.log('--- [DEBUG] resolveNightActions ---');
    console.log('nightConfessors:', room.nightConfessors);
    console.log('playersWhoActedAtNight:', room.playersWhoActedAtNight);

    // 1. Witch Kill (if any alive witches) - but don't reveal who was killed yet
    const aliveWitches = getAlivePlayers(room).filter(p => p.isWitch);
    const chosenToKillUniqueId = room.playersWhoActedAtNight['witchKill'];

    if (aliveWitches.length > 0 && chosenToKillUniqueId) {
        const targetPlayer = room.players[chosenToKillUniqueId];
        if (targetPlayer && targetPlayer.alive) {
            // Check if target has Asylum card
            const hasAsylum = targetPlayer.inPlayCards.some(card => card.name === 'Asylum');
            // Check if target was protected by constable
            const wasProtectedByConstable = room.playersWhoActedAtNight['constableSave'] === chosenToKillUniqueId;
            // Check if target confessed during pre-dawn
            const confessedDuringNight = room.nightConfessors && room.nightConfessors.includes(chosenToKillUniqueId);

            // Debug log
            console.log('Witch target:', targetPlayer.name, 'hasAsylum:', hasAsylum, 'wasProtectedByConstable:', wasProtectedByConstable, 'confessedDuringNight:', confessedDuringNight);
            
            if (hasAsylum || wasProtectedByConstable || confessedDuringNight) {
                if (hasAsylum) {
                    sendGameMessage(room.name, `${targetPlayer.name} ได้รับการปกป้องจาก Asylum!`, 'green', true);
                } else if (wasProtectedByConstable) {
                    sendGameMessage(room.name, `${targetPlayer.name} ได้รับการปกป้องจากสายตรวจ!`, 'green', true);
                } else if (confessedDuringNight) {
                    sendGameMessage(room.name, `${targetPlayer.name} ได้รับการปกป้องจากการสารภาพบาป!`, 'green', true);
                }
            } else {
                // Store the killed player info for later announcement (after confession period)
                room.killedPlayer = targetPlayer;
                // Check win condition after player death
                checkWinCondition(room);
                // Handle Matchmaker if target has it
                const matchmakerCard = targetPlayer.inPlayCards.find(c => c.name === 'Matchmaker');
                if (matchmakerCard) {
                    const otherMatchmakerHolder = getAlivePlayers(room).find(p => p.uniqueId !== targetPlayer.uniqueId && p.inPlayCards.some(c => c.name === 'Matchmaker'));
                    if (otherMatchmakerHolder) {
                        room.killedPlayerMatchmaker = otherMatchmakerHolder;
                        // Check win condition after matchmaker death
                        checkWinCondition(room);
                    }
                }
            }
        }
    } else if (aliveWitches.length > 0) {
        sendGameMessage(room.name, 'ปอบไม่ได้เลือกสังหารใครในคืนนี้.', 'grey');
    } else {
        sendGameMessage(room.name, 'ไม่มีปอบในตอนนี้.', 'grey');
    }

    // 2. Constable Save (if any alive constables) - This is now handled above
    const chosenToSaveUniqueId = room.playersWhoActedAtNight['constableSave'];
    if (chosenToSaveUniqueId && !room.players[chosenToSaveUniqueId]?.alive) {
        // If constable saved someone who was killed, revive them
        const targetPlayer = room.players[chosenToSaveUniqueId];
        targetPlayer.alive = true;
        sendGameMessage(room.name, `${targetPlayer.name} ได้รับการช่วยเหลือจากสายตรวจ!`, 'green', true);
    }

    checkWinCondition(room);
    // Don't change phase here anymore - it's handled in changePhase for PRE_DAWN
    // Remove the pendingPreDawn logic since it's now handled in changePhase

    // --- ใน resolveNightActions ---
    // ไม่ต้องประกาศการปกป้องจากการสารภาพ
    let killed = false;
    if (room.killedPlayer) {
        sendGameMessage(room.name, `${room.killedPlayer.name} ถูกสังหารในตอนกลางคืน!`, 'darkred', true);
        handlePlayerDeath(room, room.killedPlayer);
        // เก็บชื่อไว้ก่อน set เป็น null
        var killedPlayerName = room.killedPlayer.name;
        room.killedPlayer = null;
        killed = true;
    }
    if (room.killedPlayerMatchmaker) {
        // ใช้ killedPlayerName ถ้ามี ไม่ใช้ room.killedPlayer.name โดยตรง
        const matchmakerName = room.killedPlayerMatchmaker.name;
        sendGameMessage(room.name, `${matchmakerName} ตายพร้อมกับ ${killedPlayerName || ''} เนื่องจาก Matchmaker!`, 'darkred', true);
        handlePlayerDeath(room, room.killedPlayerMatchmaker);
        room.killedPlayerMatchmaker = null;
        killed = true;
    }
    if (!killed) {
        sendGameMessage(room.name, 'ทุกคนปลอดภัยในคืนนี้!', 'green', true);
    }
    // ... reset state for new day ...
}

function checkWinCondition(room) {
    if (room.gameOver) return;

    const alivePlayers = getAlivePlayers(room);
    // เงื่อนไขใหม่: นับจาก hasBeenWitch
    const aliveWitches = alivePlayers.filter(p => p.hasBeenWitch);
    const aliveTownsfolk = alivePlayers.filter(p => !p.hasBeenWitch);

    // ตรวจสอบว่ามีการ์ด Witch ที่ยังไม่ถูกเปิดอยู่ในเกมหรือไม่
    let witchCardLeft = false;
    for (const p of Object.values(room.players)) {
        if (p.tryalCards && p.tryalCards.some(card => card.name === 'Witch')) {
            witchCardLeft = true;
            break;
        }
    }

    // 1. ทีมปอบชนะ: ทุกคนที่รอดชีวิตถูกแพร่เชื้อเป็นปอบ (hasBeenWitch==true) และยังมีการ์ดปอบที่ยังไม่เปิดอยู่ในเกม
    if (alivePlayers.length > 0 && aliveWitches.length === alivePlayers.length && witchCardLeft) {
        room.gameOver = true;
        room.winner = 'Witches';
        sendGameMessage(room.name, 'ปอบชนะ! ทุกคนถูกแพร่เชื้อเป็นปอบ และยังมีการ์ดปอบซ่อนอยู่ในเกม!', 'darkred', true);
        emitRoomState(room.name);
        return;
    }
    // 2. ทีมปอบชนะ: ทีมปอบฆ่าทีมชาวบ้านตายหมด (ไม่มี aliveTownsfolk) และยังมีการ์ดปอบที่ยังไม่เปิดอยู่ในเกม
    if (alivePlayers.length > 0 && aliveTownsfolk.length === 0 && witchCardLeft) {
        room.gameOver = true;
        room.winner = 'Witches';
        sendGameMessage(room.name, 'ปอบชนะ! ทีมชาวบ้านถูกกำจัดหมด และยังมีการ์ดปอบซ่อนอยู่ในเกม!', 'darkred', true);
        emitRoomState(room.name);
        return;
    }
    // 3. ทีมชาวบ้านชนะ: เปิดการ์ดปอบครบทั้ง 2 ใบ (ไม่มีการ์ด Witch เหลือใน tryalCards ของทุกคน)
    if (!witchCardLeft) {
        room.gameOver = true;
        room.winner = 'Townsfolk';
        sendGameMessage(room.name, 'ชาวบ้านชนะ! การ์ดปอบถูกเปิดครบหมดแล้ว!', 'green', true);
        emitRoomState(room.name);
        return;
    }
    // 4. ไม่มีผู้เล่นเหลืออยู่ (เสมอ)
    if (alivePlayers.length === 0) {
        room.gameOver = true;
        room.winner = 'None (Draw)';
        sendGameMessage(room.name, 'ไม่มีผู้เล่นเหลืออยู่... เสมอ!', 'grey', true);
        emitRoomState(room.name);
        return;
    }
}

// Event for Conspiracy card and potentially others
function promptTryalCardSelectionToLeft(roomName) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;

    const alivePlayers = getAlivePlayers(room);
    if (alivePlayers.length <= 1) {
        sendGameMessage(room.name, 'จำนวนผู้เล่นไม่พอที่จะส่ง Tryal Card.', 'grey');
        return;
    }

    room.conspiracyTryalSelections = {}; // uniqueId -> index/null

    // Map uniqueId → player object for easier lookup
    const playerOrder = alivePlayers.map(p => p.uniqueId);

    alivePlayers.forEach((player, idx) => {
        const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
        const leftPlayer = alivePlayers[leftIdx];
        if (leftPlayer.tryalCards.length > 0) {
            io.to(player.id).emit('prompt select left tryal', {
                leftPlayerUniqueId: leftPlayer.uniqueId,
                leftPlayerName: leftPlayer.name,
                leftPlayerTryalCount: leftPlayer.tryalCards.length
            });
        } else {
            // แจ้งว่าไม่มีไพ่ให้เลือก และบันทึก null ทันที
            io.to(player.id).emit('prompt select left tryal', {
                leftPlayerUniqueId: leftPlayer.uniqueId,
                leftPlayerName: leftPlayer.name,
                leftPlayerTryalCount: 0
            });
            room.conspiracyTryalSelections[player.uniqueId] = null;
        }
    });
}

// --- Helper Functions for Player Disconnection ---
function handlePlayerDisconnection(room, playerUniqueId, playerName, isDisconnect) {
    // Check if this was the host
    if (room.hostUniqueId === playerUniqueId) {
        // Find a new host from remaining players
        const remainingPlayers = Object.values(room.players).filter(p => p.uniqueId !== playerUniqueId);
        if (remainingPlayers.length > 0) {
            const newHost = remainingPlayers[0];
            room.hostUniqueId = newHost.uniqueId;
            newHost.isHost = true;
            sendGameMessage(room.name, `${newHost.name} กลายเป็นผู้ดูแลห้องใหม่.`, 'blue', true);
        } else {
            // No players left, end the game
            room.gameOver = true;
            room.winner = 'None (All players left)';
            sendGameMessage(room.name, 'ผู้เล่นทั้งหมดออกจากเกมแล้ว. เกมจบลง.', 'grey', true);
        }
    }

    // Check if game should continue
    if (room.gameStarted && !room.gameOver) {
        const alivePlayers = getAlivePlayers(room);
        
        // If less than minimum players, end game
        if (alivePlayers.length < MIN_PLAYERS_TO_START) {
            room.gameOver = true;
            room.winner = 'None (Not enough players)';
            sendGameMessage(room.name, `ผู้เล่นเหลือน้อยเกินไป (${alivePlayers.length}/${MIN_PLAYERS_TO_START}). เกมจบลง.`, 'red', true);
        } else {
            // Check win conditions
            checkWinCondition(room);
        }
    }

    // Update room state for remaining players
    emitRoomState(room.name);
}

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Store a temporary mapping from socket.id to uniqueId
    // This is useful if a client reconnects with the same uniqueId
    socket.on('register uniqueId', (uniqueId, playerName) => {
        socket.uniqueId = uniqueId;
        console.log(`Socket ${socket.id} registered with uniqueId: ${uniqueId}`);

        // If player name is provided on registration (e.g., from localStorage)
        if (playerName && playerName !== '') {
            const roomName = Object.values(rooms).find(room =>
                Object.values(room.players).some(p => p.uniqueId === uniqueId && p.name === playerName)
            )?.name;

            if (roomName) {
                // If the uniqueId and name combo exists in a room, update socket.id
                const player = rooms[roomName].players[uniqueId];
                if (player) {
                    player.id = socket.id; // Update socket ID for reconnection
                    player.connected = true; // Mark as connected
                    socket.join(roomName);
                    socket.currentRoom = roomName;
                    io.to(socket.id).emit('room joined', roomName);
                    emitRoomState(roomName);
                    sendGameMessage(roomName, `${playerName} ได้เชื่อมต่อกลับเข้ามาในเกม.`, 'blue');
                    return; // Exit if reconnected successfully
                }
            }
        }
        // If not reconnected to existing room, prompt name input on client
        io.to(socket.id).emit('request player name');
    });

    socket.on('set player name', (playerName) => {
        if (!socket.uniqueId) {
            console.error('Unique ID not registered before setting name.');
            return;
        }
        // Check if this uniqueId already exists with a different name in an active room
        for (const roomName in rooms) {
            if (rooms[roomName].players[socket.uniqueId] && rooms[roomName].players[socket.uniqueId].name !== playerName) {
                io.to(socket.id).emit('game message', 'ชื่อผู้ใช้นี้ถูกใช้แล้วในห้องที่คุณกำลังเข้าร่วม.', 'red');
                return;
            }
        }

        // If player already has a name set (e.g., from localStorage on new connection)
        // update it on the server side or ensure consistency.
        // This scenario handles a fresh connection where client sends stored name.
        console.log(`Player ${socket.uniqueId} set name to: ${playerName}`);
        // No direct player object exists here yet until they join a room
    });


    // Room Management
    socket.on('create room', (roomName, playerName) => {
        if (rooms[roomName]) {
            io.to(socket.id).emit('game message', 'ชื่อห้องนี้ถูกใช้แล้ว. โปรดเลือกชื่ออื่น.', 'red');
            return;
        }
        if (!playerName || playerName.trim() === '') {
            io.to(socket.id).emit('game message', 'โปรดป้อนชื่อผู้เล่นของคุณก่อนสร้างห้อง.', 'red');
            return;
        }

        rooms[roomName] = {
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
            nightConfessors: [], // List of uniqueIds who confessed during night
            playerForcedToRevealTryal: null, // Player who must reveal Tryal Card
            nightCardDrawer: null, // Who drew the Night card (for confession order)
            confessionOrder: [], // Order of players who should confess during night
            currentConfessionIndex: 0, // Current player in confession order
            confessionTimer: null, // Timer for individual confession
            confessionTimerDuration: DEFAULT_PHASE_DURATIONS.CONFESSION, // Duration for confession timer
            phaseInterval: null, // Timer for current phase
            blackCatHolder: null,
            blackCatHolderAlreadyActedThisDay: false, // To ensure black cat holder only starts once per day
            playersWhoActedAtNight: {}, // { witchKill: uniqueId, constableSave: uniqueId }
            gameOver: false,
            winner: null,
            isAssigningBlackCat: false, // New flag for this specific state
            phaseConfig: { ...DEFAULT_PHASE_DURATIONS }, // Default durations for this room
            witchChatHistory: [], // Chat history for witch team
            gameMessageHistory: [], // Game message history for reconnection
        };

        const newPlayer = {
            id: socket.id,
            uniqueId: socket.uniqueId,
            name: playerName,
            isHost: true,
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
        rooms[roomName].players[socket.uniqueId] = newPlayer;
        socket.join(roomName);
        socket.currentRoom = roomName; // Store current room on socket
        io.to(socket.id).emit('room joined', roomName);
        sendGameMessage(roomName, `${playerName} สร้างห้อง ${roomName} แล้ว.`, 'green');
        sendGameMessage(roomName, 'คุณคือผู้ดูแลห้อง.', 'blue', true);
        emitRoomState(roomName);
    });

    socket.on('join room', (roomName, playerName) => {
        const room = rooms[roomName];
        if (!room) {
            io.to(socket.id).emit('game message', 'ไม่พบห้องนี้.', 'red');
            return;
        }
        if (Object.keys(room.players).length >= PLAYER_LIMIT) {
            io.to(socket.id).emit('game message', 'ห้องเต็มแล้ว.', 'red');
            return;
        }
        if (room.gameStarted) {
            io.to(socket.id).emit('game message', 'เกมในห้องนี้เริ่มไปแล้ว. ไม่สามารถเข้าร่วมได้.', 'red');
            return;
        }
        if (!playerName || playerName.trim() === '') {
            io.to(socket.id).emit('game message', 'โปรดป้อนชื่อผู้เล่นของคุณก่อนเข้าร่วมห้อง.', 'red');
            return;
        }
        // Check if uniqueId already exists in this room (rejoining with same uniqueId)
        if (room.players[socket.uniqueId]) {
            // Player is rejoining with the same uniqueId, update socket.id
            room.players[socket.uniqueId].id = socket.id;
            socket.join(roomName);
            socket.currentRoom = roomName;
            io.to(socket.id).emit('room joined', roomName);
            sendGameMessage(roomName, `${playerName} ได้เชื่อมต่อกลับเข้ามาในเกม.`, 'blue');
        } else {
            // New player joining
            const newPlayer = {
                id: socket.id,
                uniqueId: socket.uniqueId,
                name: playerName,
                isHost: false,
                hand: [],
                tryalCards: [],
                inPlayCards: [],
                alive: true,
                isSilenced: false,
                isWitch: false,
                isConstable: false,
                hasBeenWitch: false, // Track if player has ever been a witch
                revealedTryalCardIndexes: new Set(),
                connected: true, // Mark as connected
            };
            room.players[socket.uniqueId] = newPlayer;
            socket.join(roomName);
            socket.currentRoom = roomName;
            io.to(socket.id).emit('room joined', roomName);
            sendGameMessage(roomName, `${playerName} เข้าร่วมห้อง ${roomName} แล้ว.`, 'green');
        }
        emitRoomState(roomName);
        // --- ส่ง hand และ tryalCards ให้ผู้เล่นนี้ ---
        const player = room.players[socket.uniqueId];
        if (player) {
            io.to(socket.id).emit('update hand', player.hand);
            io.to(socket.id).emit('update tryal cards initial', player.tryalCards);
            emitRoomState(room.name);
        }
    });

    socket.on('join existing room', (roomName) => {
        const room = rooms[roomName];
        if (room && room.players[socket.uniqueId]) {
            const player = room.players[socket.uniqueId];
            player.id = socket.id; // Update socket ID in case of reconnect
            socket.join(roomName);
            socket.currentRoom = roomName;
            io.to(socket.id).emit('room joined', roomName);
            emitRoomState(roomName);
            sendGameMessage(roomName, `${player.name} ได้เชื่อมต่อกลับเข้ามาในเกม.`, 'blue');
            // --- ส่ง hand และ tryalCards ให้ผู้เล่นนี้ ---
            io.to(socket.id).emit('update hand', player.hand);
            io.to(socket.id).emit('update tryal cards initial', player.tryalCards);
            emitRoomState(room.name);
        } else {
            // If they can't rejoin, send them back to the lobby view
            io.to(socket.id).emit('room not found or not in room');
            socket.currentRoom = null;
        }
    });

    socket.on('leave room', () => {
        const roomName = socket.currentRoom;
        if (roomName && rooms[roomName]) {
            const room = rooms[roomName];
            const playerUniqueId = socket.uniqueId;
            const playerName = room.players[playerUniqueId]?.name || 'Unknown Player';

            delete room.players[playerUniqueId];
            socket.leave(roomName);
            socket.currentRoom = null;
            io.to(socket.id).emit('room left');
            sendGameMessage(roomName, `${playerName} ออกจากห้องแล้ว.`, 'orange');

            // Use helper function to handle disconnection logic
            handlePlayerDisconnection(room, playerUniqueId, playerName, false);
        }
    });

    // Game Actions
    socket.on('start game', (roomName) => {
        const room = rooms[roomName];
        if (room && room.hostUniqueId === socket.uniqueId) {
            startGame(roomName);
        } else {
            io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์เริ่มเกม.', 'red');
        }
    });

    socket.on('draw cards', () => {
        const roomName = socket.currentRoom;
        if (roomName) {
            drawCards(roomName, socket.uniqueId);
        }
    });

    socket.on('play card', (cardIndex, targetUniqueId, secondTargetUniqueId) => {
        const roomName = socket.currentRoom;
        if (roomName) {
            playCard(roomName, socket.uniqueId, cardIndex, targetUniqueId, secondTargetUniqueId);
        }
    });

    socket.on('end turn', () => {
        const roomName = socket.currentRoom;
        if (roomName) {
            endTurn(roomName, socket.uniqueId);
        }
    });

    socket.on('confess tryal card', (cardIndex) => {
        const roomName = socket.currentRoom;
        if (roomName) {
            confessTryalCard(roomName, socket.uniqueId, cardIndex);
        }
    });

    socket.on('confess during night', (cardIndex) => {
        const roomName = socket.currentRoom;
        if (roomName) {
            confessDuringNight(roomName, socket.uniqueId, cardIndex);
        }
    });

    socket.on('reveal tryal card', (cardIndex) => {
        const roomName = socket.currentRoom;
        if (roomName) {
            revealTryalCard(roomName, socket.uniqueId, cardIndex);
        }
    });

    socket.on('skip confession', () => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        const player = room.players[socket.uniqueId];

        // เพิ่มเช็คว่าอยู่ใน PRE_DAWN เท่านั้น
        if (!room || room.currentPhase !== 'PRE_DAWN' || !player || !player.alive) {
            io.to(player.id).emit('game message', 'ตอนนี้ยังข้ามการสารภาพบาปไม่ได้.', 'red');
            return;
        }

            // Enforce confession order
            if (room.confessionOrder && room.confessionOrder.length > 0) {
                const currentConfessor = room.confessionOrder[room.currentConfessionIndex];
                if (player.uniqueId !== currentConfessor) {
                    io.to(player.id).emit('game message', 'ยังไม่ถึงลำดับของคุณในการสารภาพบาป.', 'red');
                    return;
                }
            }

            if (room.nightConfessors && room.nightConfessors.includes(player.uniqueId)) {
                io.to(player.id).emit('game message', 'คุณได้ทำการกระทำไปแล้วในคืนนี้.', 'red');
                return;
            }

            // Clear confession timer for this player
            clearConfessionTimer(roomName);
            
            // Mark as confessed (skipped) to prevent further attempts
            if (!room.nightConfessors) {
                room.nightConfessors = [];
            }
            // ถ้าเป็น witchTarget ห้าม push เข้า nightConfessors
            const witchTarget = room.playersWhoActedAtNight['witchKill'];
            if (player.uniqueId !== witchTarget) {
                room.nightConfessors.push(player.uniqueId);
            }
            sendGameMessage(room.name, `${player.name} เลือกที่จะข้ามการสารภาพบาป.`, 'orange', true);

            // Advance to next confessor if any
            if (room.confessionOrder && room.currentConfessionIndex < room.confessionOrder.length - 1) {
                room.currentConfessionIndex++;
                emitRoomState(room.name);
                // Start confession timer for the next confessor
                const nextConfessor = room.confessionOrder[room.currentConfessionIndex];
                const nextPlayer = room.players[nextConfessor];
                if (nextPlayer && nextPlayer.alive && nextPlayer.tryalCards.length > 0 && room.confessionTimerDuration > 0) {
                    sendGameMessage(room.name, `${nextPlayer.name} มีเวลา ${room.confessionTimerDuration} วินาทีในการสารภาพ (จะข้ามการสารภาพหากหมดเวลา).`, 'purple', true);
                    startConfessionTimer(roomName, nextConfessor);
                }
            } else {
                // สารภาพครบแล้ว resolveNightActions และเปลี่ยนเป็น DAY
                resolveNightActions(roomName);
                // ประกาศการตายและเปลี่ยนเฟสเป็น DAY
                sendGameMessage(room.name, 'เช้าแล้ว! ถึงเวลาเวลาตามล่าบอป...', 'blue', true);
                if (room.killedPlayer) {
                    sendGameMessage(room.name, `${room.killedPlayer.name} ถูกสังหารในตอนกลางคืน!`, 'darkred', true);
                    handlePlayerDeath(room, room.killedPlayer);
                    room.killedPlayer = null;
                }
                if (room.killedPlayerMatchmaker) {
                    sendGameMessage(room.name, `${room.killedPlayerMatchmaker.name} ตายพร้อมกับ ${room.killedPlayer.name} เนื่องจาก Matchmaker!`, 'darkred', true);
                    handlePlayerDeath(room, room.killedPlayerMatchmaker);
                    room.killedPlayerMatchmaker = null;
                }
                // reset state for new day
                room.dayNumber++;
                room.blackCatHolderAlreadyActedThisDay = false;
                room.playersWhoActedAtNight = {};
                room.nightConfessors = [];
                room.nightCardDrawer = null;
                room.confessionOrder = [];
                room.currentConfessionIndex = 0;
                room.currentPhase = 'DAY';
                emitRoomState(room.name);
                setNextTurn(room);
        }
    });

    socket.on('constable action', (targetUniqueId) => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        const player = room.players[socket.uniqueId];

        if (room && room.currentPhase === 'NIGHT' && player.isConstable && player.alive) {
            if (room.playersWhoActedAtNight['constableSave']) {
                io.to(socket.id).emit('game message', 'คุณได้ใช้ค้อนไปแล้วในคืนนี้.', 'red');
                return;
            }
            // ถ้า targetUniqueId เป็น null หรือ undefined ให้ถือว่า skip
            if (!targetUniqueId) {
                sendGameMessage(room.name, `${player.name} ไม่ได้เลือกปกป้องใครในคืนนี้.`, 'orange');
                room.playersWhoActedAtNight['constableSave'] = null;
                // ถ้าปอบเลือกเป้าหมายแล้ว ให้ไป PRE_DAWN ทันที
                if (room.playersWhoActedAtNight['witchKill'] || room.playersWhoActedAtNight['witchKill'] === null) {
                    changePhase(roomName, 'PRE_DAWN');
                }
                return;
            }
            if (targetUniqueId && room.players[targetUniqueId]) {
                if (targetUniqueId === socket.uniqueId) {
                    io.to(socket.id).emit('game message', 'คุณไม่สามารถปกป้องตนเองได้.', 'red');
                    return;
                }
                room.playersWhoActedAtNight['constableSave'] = targetUniqueId;
                io.to(socket.id).emit('game message', `คุณได้ใช้ค้อนเพื่อปกป้อง ${room.players[targetUniqueId].name}.`, 'green');
                // ถ้าปอบเลือกเป้าหมายแล้ว ให้ไป PRE_DAWN ทันที
                if (room.playersWhoActedAtNight['witchKill'] || room.playersWhoActedAtNight['witchKill'] === null) {
                    changePhase(roomName, 'PRE_DAWN');
                }
            } else {
                io.to(socket.id).emit('game message', 'เป้าหมายไม่ถูกต้องหรือไม่สามารถปกป้องได้.', 'red');
            }
        } else {
            io.to(socket.id).emit('game message', 'ตอนนี้คุณไม่สามารถใช้ค้อนได้.', 'red');
        }
    });

    socket.on('witch kill target', (targetUniqueId) => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        const player = room.players[socket.uniqueId];

        if (room && room.currentPhase === 'NIGHT' && player.isWitch && player.alive) {
            if (room.playersWhoActedAtNight['witchKill']) {
                io.to(socket.id).emit('game message', 'คุณได้เลือกเป้าหมายการสังหารไปแล้ว.', 'red');
                return;
            }
            // ถ้า targetUniqueId เป็น null หรือ undefined ให้ถือว่า skip
            if (!targetUniqueId) {
                sendGameMessage(room.name, `${player.name} ไม่ได้เลือกสังหารใครในคืนนี้.`, 'orange');
                room.playersWhoActedAtNight['witchKill'] = null;
                // ถ้ามีสายตรวจที่ยังไม่ได้เลือก ให้รอ
                const constables = getAlivePlayers(room).filter(p => p.isConstable);
                if (constables.length > 0 && !room.playersWhoActedAtNight['constableSave'] && room.playersWhoActedAtNight['constableSave'] !== null) {
                    sendGameMessage(room.name, 'สายตรวจ, เตรียมตัวใช้ค้อนเพื่อปกป้องผู้เล่น.', 'purple', true);
                    constables.forEach(constable => {
                        io.to(constable.id).emit('prompt constable action');
                    });
                } else {
                    changePhase(roomName, 'PRE_DAWN');
                }
                return;
            }
            // ป้องกันไม่ให้เลือกเป้าหมายที่มี Asylum
            if (room.players[targetUniqueId]?.inPlayCards.some(card => card.name === 'Asylum')) {
                io.to(socket.id).emit('game message', 'คุณไม่สามารถเลือกเป้าหมายที่ได้รับการปกป้องจาก Asylum ได้.', 'red');
                return;
            }
            if (targetUniqueId && room.players[targetUniqueId]?.alive) {
                room.playersWhoActedAtNight['witchKill'] = targetUniqueId;
                io.to(socket.id).emit('game message', `คุณได้เลือก ${room.players[targetUniqueId].name} เป็นเป้าหมายการสังหาร.`, 'green');
                // แจ้งเตือนทีมปอบทุกคนว่าเลือกฆ่าใคร (เฉพาะปอบเห็น)
                const witches = getAlivePlayers(room).filter(p => p.isWitch);
                witches.forEach(witchPlayer => {
                    io.to(witchPlayer.id).emit('game message', `คืนนี้ทีมปอบเลือกจะฆ่า: ${room.players[targetUniqueId].name}`, 'darkred', true);
                });
                // ถ้ามีสายตรวจที่ยังไม่ได้เลือก ให้รอ
                const constables = getAlivePlayers(room).filter(p => p.isConstable);
                if (constables.length > 0 && !room.playersWhoActedAtNight['constableSave'] && room.playersWhoActedAtNight['constableSave'] !== null) {
                    sendGameMessage(room.name, 'สายตรวจ, เตรียมตัวใช้ค้อนเพื่อปกป้องผู้เล่น.', 'purple', true);
                    constables.forEach(constable => {
                        io.to(constable.id).emit('prompt constable action');
                    });
                } else {
                    changePhase(roomName, 'PRE_DAWN');
                }
            } else {
                io.to(socket.id).emit('game message', 'เป้าหมายไม่ถูกต้องหรือไม่สามารถสังหารได้.', 'red');
            }
        } else {
            io.to(socket.id).emit('game message', 'ตอนนี้คุณไม่สามารถสังหารได้.', 'red');
        }
    });
    socket.on('assign black cat', (targetUniqueId) => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        const player = room.players[socket.uniqueId];

        // Validation
        if (!room || !room.isAssigningBlackCat || !player || !player.isWitch) {
            io.to(socket.id).emit('game message', 'คุณไม่สามารถทำการกระทำนี้ได้ในตอนนี้.', 'red');
            return;
        }

        const targetPlayer = room.players[targetUniqueId];
        if (!targetPlayer) { // Witch can now assign to anyone, including themselves.
            io.to(socket.id).emit('game message', 'เป้าหมายไม่ถูกต้อง.', 'red');
            return;
        }

        // Assign the card
        const blackCatCard = room.pendingBlackCatCard;
        if (blackCatCard) {
            targetPlayer.inPlayCards.push(blackCatCard);
            room.blackCatHolder = targetUniqueId;
            room.pendingBlackCatCard = null;
            room.isAssigningBlackCat = false;

            sendGameMessage(room.name, ` (ปอบ) ได้มอบการ์ดเครื่องเซ่นให้กับ ${targetPlayer.name}!`, 'purple', true);
            io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);

            // Now that the card is assigned, start the first phase of the game
            sendGameMessage(room.name, 'เกมเริ่มแล้ว! คืนแรกได้เริ่มต้นขึ้น.', 'green', true);
            changePhase(room.name, 'NIGHT');
        }
    });

    // Host Controls
    socket.on('set phase times', (roomName, dayTime, nightTime) => {
        const room = rooms[roomName];
        if (room && room.hostUniqueId === socket.uniqueId) {
            room.phaseConfig.DAY = dayTime * 1000;
            room.phaseConfig.NIGHT = nightTime * 1000; // This is event duration, not full phase
            io.to(socket.id).emit('game message', 'ตั้งเวลาเฟสแล้ว.', 'blue');
            emitRoomState(roomName); // Update clients with new phase times
        } else {
            io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์ตั้งเวลา.', 'red');
        }
    });

    socket.on('set confession timer', (roomName, confessionTime) => {
        const room = rooms[roomName];
        if (room && room.hostUniqueId === socket.uniqueId) {
            room.confessionTimerDuration = confessionTime;
            io.to(socket.id).emit('game message', `ตั้งเวลา confession เป็น ${confessionTime} วินาทีแล้ว.`, 'blue');
            emitRoomState(roomName); // Update clients with new confession timer
        } else {
            io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์ตั้งเวลา confession.', 'red');
        }
    });

    socket.on('force next phase', (roomName) => {
        const room = rooms[roomName];
        if (room && room.hostUniqueId === socket.uniqueId) {
            changePhase(roomName);
            io.to(socket.id).emit('game message', 'บังคับไปยังเฟสถัดไป.', 'blue');
        } else {
            io.to(socket.id).emit('game message', 'คุณไม่มีสิทธิ์บังคับเฟส.', 'red');
        }
    });


    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomName = socket.currentRoom;
        if (roomName && rooms[roomName]) {
            const room = rooms[roomName];
            const playerUniqueId = socket.uniqueId;
            if (room.players[playerUniqueId]) {
                const playerName = room.players[playerUniqueId].name;
                
                // Don't immediately remove the player - allow for reconnection
                // Just mark them as disconnected
                room.players[playerUniqueId].connected = false;
                room.players[playerUniqueId].lastDisconnectTime = Date.now();
                
                sendGameMessage(room.name, `${playerName} ได้ตัดการเชื่อมต่อ.`, 'orange');
                
                // Set a timeout to remove the player if they don't reconnect
                setTimeout(() => {
                    if (room.players[playerUniqueId] && !room.players[playerUniqueId].connected) {
                        // Player hasn't reconnected, remove them
                        delete room.players[playerUniqueId];
                        sendGameMessage(room.name, `${playerName} ออกจากเกมแล้ว.`, 'red');
                        handlePlayerDisconnection(room, playerUniqueId, playerName, true);
                    }
                }, 30000); // 30 seconds timeout for reconnection
            }
        }
    });

    socket.on('select tryal card for confession', (targetPlayerUniqueId, cardIndex) => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        const player = room.players[socket.uniqueId];

        if (room && room.playerForcedToRevealTryal === targetPlayerUniqueId && 
            room.playerForcedToRevealSelector === socket.uniqueId) {
            
            const targetPlayer = room.players[targetPlayerUniqueId];
            if (targetPlayer && targetPlayer.tryalCards.length > cardIndex) {
                const selectedCard = targetPlayer.tryalCards.splice(cardIndex, 1)[0];
                targetPlayer.revealedTryalCardIndexes.add(selectedCard.name);
                
                sendGameMessage(room.name, `${player.name} เลือกให้ ${targetPlayer.name} เปิดเผยการ์ดชีวิต: ${selectedCard.name}!`, 'gold', true);
                
                if (selectedCard.name === 'Witch') {
                    targetPlayer.isWitch = true;
                    sendGameMessage(room.name, `${targetPlayer.name} คือปอบ!`, 'darkred', true);
                } else if (selectedCard.name === 'Constable') {
                    targetPlayer.isConstable = true;
                    sendGameMessage(room.name, `${targetPlayer.name} คือสายตรวจ!`, 'green', true);
                }
                
                // Reset accusation points and discard RED cards
                room.accusedPlayers[targetPlayerUniqueId] = 0;
                const redCardsToDiscard = targetPlayer.inPlayCards.filter(card => card.color === 'Red');
                targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(card => card.color !== 'Red');
                room.discardPile.push(...redCardsToDiscard);
                
                if (redCardsToDiscard.length > 0) {
                    sendGameMessage(room.name, `การ์ดข้อกล่าวหาทั้งหมดของ ${targetPlayer.name} ถูกทิ้งแล้ว.`, 'green', true);
                }
                
                room.playerForcedToRevealTryal = null;
                room.playerForcedToRevealSelector = null;
                room.confessors.push(targetPlayerUniqueId);
                
                io.to(targetPlayer.id).emit('update tryal cards initial', targetPlayer.tryalCards);
                io.to(targetPlayer.id).emit('update revealed tryal indexes', Array.from(targetPlayer.revealedTryalCardIndexes));
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                
                emitRoomState(room.name);
                checkWinCondition(room);
            }
        }
    });

    socket.on('select curse target', (targetPlayerUniqueId, cardIndex) => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        const player = room.players[socket.uniqueId];

        if (room && room.awaitingCurseSelection && 
            room.awaitingCurseSelection.selector === socket.uniqueId &&
            room.awaitingCurseSelection.target === targetPlayerUniqueId) {
            
            const targetPlayer = room.players[targetPlayerUniqueId];
            const blueCards = targetPlayer.inPlayCards.filter(c => c.color === 'Blue');
            
            if (targetPlayer && blueCards.length > cardIndex) {
                const cardToDiscard = blueCards[cardIndex];
                targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(c => c !== cardToDiscard);
                room.discardPile.push(cardToDiscard);
                
                sendGameMessage(room.name, `${player.name} เลือกให้ ${targetPlayer.name} ทิ้งการ์ด ${cardToDiscard.name} เนื่องจากโดนคำสาป.`, 'red');
                io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                
                // If Black Cat is discarded, reset holder
                if (cardToDiscard.name === 'Black Cat') {
                    room.blackCatHolder = null;
                    sendGameMessage(room.name, 'การ์ดพิธีเซ่นไหว้ ถูกทิ้งแล้ว!', 'grey');
                }
                
                // Clean up
                delete room.awaitingCurseSelection;
                
                // End turn after curse selection
                setNextTurn(room);
            }
        }
    });

    socket.on('select blackcat tryal', (targetUniqueId, cardIndex) => {
        // Only allow if awaitingConspiracySelection and this socket is the selector
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        if (!room.awaitingConspiracySelection) return;
        if (room.awaitingConspiracySelection.selector !== socket.uniqueId) return;
        if (room.awaitingConspiracySelection.target !== targetUniqueId) return;
        const bcHolder = room.players[targetUniqueId];
        if (!bcHolder || bcHolder.tryalCards.length <= cardIndex) return;
        
        // Reveal the selected Tryal Card
        const revealedCard = bcHolder.tryalCards.splice(cardIndex, 1)[0];
        bcHolder.revealedTryalCardIndexes.add(revealedCard.name);
        sendGameMessage(room.name, `${bcHolder.name} ถูกเลือกเปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
        io.to(bcHolder.id).emit('update tryal cards initial', bcHolder.tryalCards);
        io.to(bcHolder.id).emit('update revealed tryal indexes', Array.from(bcHolder.revealedTryalCardIndexes));
        if (revealedCard.name === 'Witch') {
            bcHolder.isWitch = true;
            sendGameMessage(room.name, `${bcHolder.name} คือปอบ!`, 'darkred', true);
        }
        
        // Check win condition after revealing Tryal Card
        checkWinCondition(room);
        
        // Clean up
        delete room.awaitingConspiracySelection;
        
        // Continue Conspiracy effect
        promptTryalCardSelectionToLeft(roomName);
        
        // จบเทิร์นหลังจากเลือกเสร็จแล้ว
        setNextTurn(room);
    });

    // --- ปิดการ swap tryal cards ---
    // socket.on('swap tryal cards', ...) ไม่ทำงานอีกต่อไป
    // ... existing code ...

    socket.on('select left tryal', (index) => {
        const roomName = socket.currentRoom;
        if (!roomName) return;
        const room = rooms[roomName];
        if (!room) return;
        // Only allow if Conspiracy is active
        if (!room.conspiracyTryalSelections) return;
        const alivePlayers = getAlivePlayers(room);
        const currentPlayer = room.players[socket.uniqueId];
        if (!currentPlayer || !currentPlayer.alive) return;
        // Find left player
        const playerOrder = alivePlayers.map(p => p.uniqueId);
        const idx = playerOrder.indexOf(currentPlayer.uniqueId);
        if (idx === -1) return;
        const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
        const leftPlayer = room.players[playerOrder[leftIdx]];
        if (!leftPlayer || leftPlayer.tryalCards.length === 0) {
            // No card to take
            room.conspiracyTryalSelections[currentPlayer.uniqueId] = null;
            emitRoomState(roomName);
            return;
        }
        // Prevent double selection
        if (room.conspiracyTryalSelections[currentPlayer.uniqueId] !== undefined) return;
        // Validate index
        if (index < 0 || index >= leftPlayer.tryalCards.length) return;
        // --- แค่บันทึก index ที่เลือกไว้ ยังไม่ย้ายไพ่จริง ---
        room.conspiracyTryalSelections[currentPlayer.uniqueId] = index;
        emitRoomState(roomName);
        // If all alive players have made their selection, ดำเนินการย้ายไพ่จริง
        const allDone = alivePlayers.every(p => room.conspiracyTryalSelections[p.uniqueId] !== undefined);
        if (allDone) {
            // เตรียมเก็บไพ่ที่ต้องย้าย
            const takenCards = {};
            alivePlayers.forEach((player, idx) => {
                const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                const leftPlayer = alivePlayers[leftIdx];
                const selIndex = room.conspiracyTryalSelections[player.uniqueId];
                if (selIndex !== null && selIndex !== undefined && leftPlayer.tryalCards.length > selIndex) {
                    takenCards[player.uniqueId] = leftPlayer.tryalCards[selIndex];
                }
            });
            // ลบไพ่ที่ถูกเลือกออกจากซ้ายมือ (จากหลังไปหน้าเพื่อไม่ให้ index เพี้ยน)
            alivePlayers.forEach((player, idx) => {
                const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                const leftPlayer = alivePlayers[leftIdx];
                const selIndex = room.conspiracyTryalSelections[player.uniqueId];
                if (selIndex !== null && selIndex !== undefined && leftPlayer.tryalCards.length > selIndex) {
                    leftPlayer.tryalCards.splice(selIndex, 1);
                }
            });
            // ใส่ไพ่ที่ถูกเลือกให้ผู้เล่นที่เลือก
            alivePlayers.forEach((player, idx) => {
                const card = takenCards[player.uniqueId];
                const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
                const leftPlayer = alivePlayers[leftIdx];
                if (card) {
                    player.tryalCards.push(card);
                    // --- อัพเดทสถานะถ้าได้ Witch หรือ Constable ---
                    if (card.name === 'Witch') {
                        player.isWitch = true;
                        player.hasBeenWitch = true;
                    } else if (card.name === 'Constable') {
                        player.isConstable = true;
                    }
                    sendGameMessage(room.name, `${player.name} หยิบไพ่ ชีวิต จาก ${leftPlayer.name}`, 'orange');
            io.to(player.id).emit('update tryal cards initial', player.tryalCards);
                }
            });
            delete room.conspiracyTryalSelections;
            sendGameMessage(room.name, 'การสลับไพ่ ชีวิต จาก Conspiracy เสร็จสิ้น!', 'blue', true);
            emitRoomState(roomName);
            // --- เงื่อนไขพิเศษ: ถ้าทุกคนที่รอดชีวิตกลายเป็นปอบ และยังมีการ์ดปอบเหลือ ให้รอเช็คตอน NIGHT ---
            const alivePlayersNow = getAlivePlayers(room);
            const allWitchNow = alivePlayersNow.length > 0 && alivePlayersNow.every(p => p.hasBeenWitch);
            let witchCardLeftNow = false;
            for (const p of Object.values(room.players)) {
                if (p.tryalCards && p.tryalCards.some(card => card.name === 'Witch')) {
                    witchCardLeftNow = true;
                    break;
                }
            }
            if (allWitchNow && witchCardLeftNow) {
                room.pendingWitchWinByConspiracy = true;
                // เรียก checkWinCondition ทันทีเพื่อจบเกมถ้าเข้าเงื่อนไข
                checkWinCondition(room);
            } else {
                checkWinCondition(room);
            }
            setNextTurn(room); // Continue normal turn order
        }
    });

    // --- Witch Chat: รับ/ส่งข้อความและประวัติ ---
    socket.on('send witch chat message', (roomName, message) => {
        const room = rooms[roomName];
        if (!room) return;
        const player = room.players[socket.uniqueId];
        if (!player || !player.hasBeenWitch) return; // เฉพาะปอบเท่านั้น
        const timestamp = Date.now();
        const entry = { senderName: player.name, message, timestamp };
        if (!room.witchChatHistory) room.witchChatHistory = [];
        room.witchChatHistory.push(entry);
        if (room.witchChatHistory.length > 100) room.witchChatHistory.shift();
        // ส่งให้เฉพาะปอบในห้อง
        Object.values(room.players).forEach(p => {
            if (p.hasBeenWitch && p.id) {
                io.to(p.id).emit('witch chat message', player.name, message, timestamp);
            }
        });
    });
    socket.on('request witch chat history', (roomName) => {
        const room = rooms[roomName];
        if (!room) return;
        const player = room.players[socket.uniqueId];
        if (!player || !player.hasBeenWitch) return;
        io.to(socket.id).emit('witch chat history', room.witchChatHistory || []);
    });

    // --- Game Message History: สำหรับรีเฟรช ---
    socket.on('request game message history', (roomName) => {
        const room = rooms[roomName];
        if (!room) return;
        io.to(socket.id).emit('game message history', room.gameMessageHistory || []);
    });
});

function sendDeckInfo(roomName) {
    const room = rooms[roomName];
    if (!room) return;
    
    const deckCount = room.gameDeck ? room.gameDeck.length : 0;
    const discardCount = room.discardPile ? room.discardPile.length : 0;
    
    io.to(roomName).emit('deck info update', {
        deckCount: deckCount,
        discardPileCount: discardCount
    });
    
    // Send message about deck status
    if (deckCount === 0) {
        sendGameMessage(room.name, 'กองการ์ดหมดแล้ว! สับไพ่จากกองทิ้งใหม่.', 'orange', true);
    } else {
        sendGameMessage(room.name, `การ์ดในกองกลาง: ${deckCount} ใบ, กองทิ้ง: ${discardCount} ใบ`, 'grey');
    }
}

function clearConfessionTimer(roomName) {
    const room = rooms[roomName];
    if (!room) return;
    
    if (room.confessionTimer) {
        clearTimeout(room.confessionTimer);
        room.confessionTimer = null;
    }
}

function revealTryalCard(roomName, playerUniqueId, cardIndex) {
    const room = rooms[roomName];
    if (!room || room.gameOver) return;
    if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
        io.to(room.players[playerUniqueId].id).emit('game message', 'การเปิดเผยการ์ดชีวิตใช้ได้เฉพาะในช่วงกลางวันเท่านั้น.', 'red');
        return;
    }

    const player = room.players[playerUniqueId];
    if (!player || !player.alive) {
        io.to(player.id).emit('game message', 'คุณไม่สามารถเปิดเผยการ์ดชีวิตได้.', 'red');
        return;
    }

    if (player.tryalCards.length === 0) {
        io.to(player.id).emit('game message', 'คุณไม่มี Tryal Card ให้เปิดเผย.', 'red');
        return;
    }

    // Validate card index
    if (cardIndex < 0 || cardIndex >= player.tryalCards.length) {
        io.to(player.id).emit('game message', 'หมายเลขการ์ดไม่ถูกต้อง.', 'red');
        return;
    }

    const revealedCard = player.tryalCards.splice(cardIndex, 1)[0]; // Remove selected card
    player.revealedTryalCardIndexes.add(revealedCard.name);

    sendGameMessage(room.name, `${player.name} เปิดเผยการ์ดชีวิต: ${revealedCard.name}!`, 'gold', true);
    io.to(player.id).emit('update tryal cards initial', player.tryalCards); // Update client's view
    io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes)); // Update client's revealed roles

    if (revealedCard.name === 'Witch') {
        player.isWitch = true; // Confirm Witch status
        player.hasBeenWitch = true; // Mark that this player has been a witch
        sendGameMessage(room.name, `${player.name} คือปอบ!`, 'darkred', true);
        // ถ้ายังถือ Witch อยู่ (รวมถึงใบที่เพิ่งเปิด)
        if (player.tryalCards.some(card => card.name === 'Witch') || revealedCard.name === 'Witch') {
            sendGameMessage(room.name, `${player.name} ถูกเปิดเผยว่าเป็นปอบและตายทันที!`, 'darkred', true);
            handlePlayerDeath(room, player);
            emitRoomState(room.name);
            checkWinCondition(room);
            return;
        }
    } else if (revealedCard.name === 'Constable') {
        player.isConstable = true; // Confirm Constable status
        sendGameMessage(room.name, `${player.name} คือสายตรวจ!`, 'green', true);
    }

    // Clear the forced reveal state so the game can continue
    room.playerForcedToRevealTryal = null;

    emitRoomState(room.name); // Update all players
    checkWinCondition(room); // Check win condition after revealing Tryal Card
}

// Helper function: Reveal all Tryal Cards and discard hand when a player dies
function handlePlayerDeath(room, player) {
    if (!player || !player.alive || room.gameOver) return;
    player.alive = false;
    sendGameMessage(room.name, `${player.name} ตายแล้ว!`, 'red', true);
    // Reveal all Tryal Cards
    player.revealedTryalCardIndexes = new Set(player.tryalCards.map((_, idx) => idx));
    // Discard all cards in hand
    if (player.hand && player.hand.length > 0) {
        room.discardPile.push(...player.hand);
        player.hand = [];
    }
    // Discard all inPlayCards (Permanent/Blue)
    if (player.inPlayCards && player.inPlayCards.length > 0) {
        const blueCards = player.inPlayCards.filter(card => card.color === 'Blue');
        const otherCards = player.inPlayCards.filter(card => card.color !== 'Blue');
        if (otherCards.length > 0) {
            room.discardPile.push(...otherCards);
        }
        // การ์ดสีน้ำเงิน (Blue) จะถูกลบออกจากเกม ไม่ใส่ discardPile
        if (blueCards.some(card => card.name === 'Black Cat')) {
            room.blackCatHolder = null;
        }
        player.inPlayCards = [];
    }
    // --- Matchmaker: If this player has Matchmaker, kill the other linked player immediately ---
    const hadMatchmaker = player.inPlayCards && player.inPlayCards.some(c => c.name === 'Matchmaker');
    if (hadMatchmaker) {
        const otherMatchmakerHolder = getAlivePlayers(room).find(p => p.uniqueId !== player.uniqueId && p.inPlayCards.some(c => c.name === 'Matchmaker'));
        if (otherMatchmakerHolder) {
            sendGameMessage(room.name, `${otherMatchmakerHolder.name} ตายพร้อมกับ ${player.name} เนื่องจากผูกวิญญาณ!`, 'darkred', true);
            handlePlayerDeath(room, otherMatchmakerHolder);
        }
    }
    emitRoomState(room.name);
}

// เพิ่มฟังก์ชัน helper
function allWitchesActed(room) {
    const witches = getAlivePlayers(room).filter(p => p.isWitch);
    // ถ้าไม่มีปอบ หรือมีการเลือก witchKill แล้ว (null หรือ id)
    return witches.length === 0 || room.playersWhoActedAtNight['witchKill'] !== undefined;
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});