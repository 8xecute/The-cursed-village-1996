// Function to generate a UUID (Client-side implementation, since we're not installing npm packages in browser)
// Simplified UUID generator for browser compatibility
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


const socket = io();

// --- UI Elements ---
const nameInputContainer = document.getElementById('name-input-container');
const nameInput = document.getElementById('name-input');
const setNameButton = document.getElementById('set-name-button');
const playerNameDisplay = document.getElementById('player-name-display');
const playerUniqueIdDisplay = document.getElementById('player-unique-id-display');
const currentRoomDisplay = document.getElementById('current-room-display');

const roomManagementSection = document.getElementById('room-management-section');
const newRoomNameInput = document.getElementById('new-room-name-input');
const createRoomButton = document.getElementById('create-room-button');
const joinRoomNameInput = document.getElementById('join-room-name-input');
const joinRoomButton = document.getElementById('join-room-button');
const leaveRoomButton = document.getElementById('leave-room-button');

const roomLobbySection = document.getElementById('room-lobby-section');
const lobbyRoomName = document.getElementById('lobby-room-name');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyMaxPlayers = document.getElementById('lobby-max-players');
const playerListDiv = document.getElementById('player-list');
const startGameButton = document.getElementById('start-game-button');
const hostControlsLobby = document.getElementById('host-controls-lobby');
const forceNextPhaseButton = document.getElementById('force-next-phase-button');


const gameSection = document.getElementById('game-section');
const currentPhaseDisplay = document.getElementById('current-phase-display');
const dayNumberDisplay = document.getElementById('day-number-display');
const currentTurnPlayerDisplay = document.getElementById('current-turn-player-display');
const deckCountDisplay = document.getElementById('deck-count-display');
const discardPileCountDisplay = document.getElementById('discard-pile-count-display');
const handCardCount = document.getElementById('hand-card-count');
const playerHandDiv = document.getElementById('player-hand');
const tryalCardsDisplay = document.getElementById('tryal-cards-display');
const myRevealedTryalCards = document.getElementById('my-revealed-tryal-cards');
const mySecretTryalCardsCount = document.getElementById('my-secret-tryal-cards-count');
const myRoleDisplay = document.getElementById('my-role-display'); // To display the *first* Tryal Card
const gameActionsDiv = document.getElementById('game-actions');
const drawCardButton = document.getElementById('draw-card-button');
const playCardButton = document.getElementById('play-card-button');
const endTurnButton = document.getElementById('end-turn-button');
const cardTargetSelect = document.getElementById('card-target-select');
const cardSecondTargetSelect = document.getElementById('card-second-target-select');
const hostControlsGame = document.getElementById('host-controls-game');
const forceNextPhaseGameButton = document.getElementById('force-next-phase-game-button');
const turnControlsDiv = document.getElementById('turn-controls');

const confessSection = document.getElementById('confess-section');
const confessButton = document.getElementById('confess-button');

const gameMessagesDiv = document.getElementById('game-messages');
const cardDescriptionPopup = document.getElementById('card-description-popup');

// Witch chat elements
const witchChatSection = document.getElementById('witch-chat-section');
const witchChatMessages = document.getElementById('witch-chat-messages');
const witchChatInput = document.getElementById('witch-chat-input');
const witchChatSendButton = document.getElementById('witch-chat-send');

// Witch-specific action elements
const witchActionSection = document.getElementById('witch-action-section');
const assignBlackCatAction = document.getElementById('assign-black-cat-action');
const blackCatTargetSelect = document.getElementById('black-cat-target-select');
const confirmBlackCatButton = document.getElementById('confirm-black-cat-button');

// --- Game State Variables (Client-side) ---
let myUniqueId = localStorage.getItem('uniqueId');
let myPlayerName = localStorage.getItem('playerName'); // Load name from local storage
let currentRoomName = null;
let myCurrentHand = [];
let myTryalCards = []; // My personal stack of Tryal Cards
let myRevealedTryalCardIndexes = []; // Indexes revealed from my stack
let selectedCard = null; // Global variable to store the currently selected card
let currentRoomState = null; // Store current room state for night actions
// --- Popup Confess Control ---
let confessPopupShownForThisPreDawn = false;
let lastConfessPhase = null;
let lastConfessDay = null;

// Turn state tracking
let isMyTurn = false; // Track if it's currently my turn
let hasPlayedCardsThisTurn = false; // Track if I've played any cards this turn
let drawButtonDisabled = false; // Track if draw button is disabled

// Constants to avoid duplication with server
const CARDS_NEED_TARGET = ['Accusation', 'Evidence', 'Witness', 'Curse', 'Alibi', 'Stocks', 'Arson', 'Asylum', 'Piety', 'Matchmaker'];

// Cards that require 2 targets (source and destination)
const CARDS_NEED_TWO_TARGETS = ['Scapegoat', 'Robbery'];

// State for night actions
let nightActionState = {
    isSelecting: false,
    actionType: null, // 'constable' or 'witch'
    selectedTargetId: null,
    hasSubmitted: false // เพิ่ม flag นี้
};

// --- Initialization ---
if (!myUniqueId) {
    myUniqueId = uuidv4();
    localStorage.setItem('uniqueId', myUniqueId);
}
playerUniqueIdDisplay.textContent = myUniqueId;

if (myPlayerName) {
    playerNameDisplay.textContent = myPlayerName;
    nameInput.value = myPlayerName;
    nameInputContainer.style.display = 'none'; // Hide name input if already set
    socket.emit('set player name', myPlayerName); // Send name to server on load
} else {
    nameInputContainer.style.display = 'flex';
    nameInput.placeholder = 'กรอกชื่อของคุณ';
}

// --- Socket.IO Event Listeners ---
socket.on('connect', () => {
    console.log('Connected to server!');
    // Register uniqueId and name on connect/reconnect
    // We send playerName here because it's required for creating/joining rooms.
    // If not set, it will be an empty string, server will handle it.
    socket.emit('register uniqueId', myUniqueId, myPlayerName || '');

    // If player was in a room before disconnecting, try to rejoin
    if (currentRoomName) {
        socket.emit('join existing room', currentRoomName);
    } else {
        // Otherwise, request active rooms to display in lobby
        socket.emit('request rooms list');
    }
});

socket.on('active rooms list', (rooms) => {
    // This event is primarily for the initial lobby view
    // Not directly displaying them in this simplified UI
    console.log('Active rooms:', rooms);
    // You would typically render these in a list for the user to choose
});

socket.on('room joined', (roomName) => {
    currentRoomName = roomName;
    currentRoomDisplay.textContent = roomName || 'ไม่มี';
    roomManagementSection.style.display = 'none';
    roomLobbySection.style.display = 'block';
    gameSection.style.display = 'none'; // Ensure game section is hidden initially
    leaveRoomButton.style.display = 'block';
    // ซ่อนปุ่มเริ่มเกมไว้ก่อนจนกว่าจะรู้ว่าเป็น host จริง
    startGameButton.style.display = 'none';
});

socket.on('room state update', (roomState) => {
    console.log('Room state updated:', roomState);
    currentRoomState = roomState; // Store room state for night actions
    updateTryalCardDisplay(); // Always update tryal card display on room state update
    // Update lobby/game UI based on roomState
    lobbyRoomName.textContent = roomState.name;
    lobbyPlayerCount.textContent = roomState.playerCount;
    lobbyMaxPlayers.textContent = roomState.maxPlayers;
    playerListDiv.innerHTML = '';
    let isHost = false;
    let myPlayer = null;
    const playersInOrder = Object.values(roomState.players).sort((a,b) => a.name.localeCompare(b.name)); // Sort for consistent display

    // Populate player list and check host status
    playersInOrder.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-item ${player.alive ? 'alive' : 'dead'} ${roomState.currentTurnPlayerUniqueId === player.uniqueId ? 'current-turn' : ''}`;
        playerDiv.dataset.uniqueId = player.uniqueId; // Store uniqueId for night actions
        let html = `<span class="player-name-status">${player.name} ${player.isHost ? '(Host)' : ''} ${player.alive ? '' : '- Eliminated'} ${player.isBlackCatHolder ? ' (เครื่องเซ่น)' : ''}</span>`;
        if (roomState.gameStarted) {
            html += `<span class="player-stats">การ์ด: ${player.handSize} | ชีวิต: ${player.tryalCardCount} | ข้อกล่าวหา: ${player.accusationPoints}</span>`;
        }
        playerDiv.innerHTML = html;
        playerListDiv.appendChild(playerDiv);

        if (player.uniqueId === myUniqueId) {
            isHost = player.isHost;
            myPlayer = player;
        }
    });

    // Populate the target selection dropdown with the latest player data
    populateCardTargetSelect(roomState.players, myUniqueId);

    // Host controls visibility
    if (isHost) {
        hostControlsLobby.style.display = 'block';
        // Make the game-specific host controls visible if the game has started
        if (roomState.gameStarted) {
            hostControlsGame.style.display = 'block';
        } else {
            hostControlsGame.style.display = 'none';
        }
    } else {
        hostControlsLobby.style.display = 'none';
        hostControlsGame.style.display = 'none';
    }

    // Game state updates
    if (roomState.gameStarted) {
        roomLobbySection.style.display = 'none';

        // If phase is not NIGHT, ensure night action UI is hidden/reset
        if (roomState.currentPhase !== 'NIGHT') {
            disableNightTargetSelection();
        }

        gameSection.style.display = 'block';

        currentPhaseDisplay.textContent = roomState.currentPhase;
        dayNumberDisplay.textContent = roomState.dayNumber;
        currentTurnPlayerDisplay.textContent = roomState.currentTurnPlayerName || 'N/A';
        
        // Update deck information
        if (roomState.deckCount !== undefined) {
            deckCountDisplay.textContent = roomState.deckCount;
        }
        if (roomState.discardPileCount !== undefined) {
            discardPileCountDisplay.textContent = roomState.discardPileCount;
        }

        // Update turn status
        isMyTurn = roomState.currentTurnPlayerUniqueId === myUniqueId;
        if (!isMyTurn) {
            hasPlayedCardsThisTurn = false; // Reset when turn changes
        }
        updateTurnUI();

        // Update my hand display (only if my hand data is sent by server)
        // Server only sends myHand via specific 'update hand' event
        handCardCount.textContent = myPlayer ? myPlayer.handSize : 0;

        // Update Tryal card display
        updateTryalCardDisplay();

        // Show/hide confess section
        // --- Reset confess popup flag when phase or day changes ---
        if (roomState.currentPhase !== lastConfessPhase || roomState.dayNumber !== lastConfessDay) {
            confessPopupShownForThisPreDawn = false;
            lastConfessPhase = roomState.currentPhase;
            lastConfessDay = roomState.dayNumber;
        }
        if (
            roomState.currentPhase === 'PRE_DAWN' &&
            myPlayer && myPlayer.alive &&
            (!roomState.nightConfessors || !roomState.nightConfessors.includes(myUniqueId)) &&
            roomState.confessionOrder &&
            roomState.confessionOrder[roomState.currentConfessionIndex] === myUniqueId &&
            !confessPopupShownForThisPreDawn
        ) {
            showConfessPopup(myTryalCards);
            confessPopupShownForThisPreDawn = true;
        } else if (roomState.currentPhase === 'DAY' && myPlayer && myPlayer.alive && roomState.playerForcedToRevealTryal === myUniqueId) {
            // Show forced reveal section during DAY phase
            confessSection.style.display = 'block';
            // Update confess button text for forced reveal
            const confessButton = document.getElementById('confess-button');
            if (confessButton) {
                confessButton.textContent = 'Reveal Tryal Card (Forced)';
            }
        } else {
            confessSection.style.display = 'none';
        }

        // Show/hide Witch action section for Black Cat assignment
        if (roomState.isAssigningBlackCat && myPlayer && myPlayer.isWitch) {
            witchActionSection.style.display = 'block';
            // Specific actions inside will be shown by their respective prompts
        } else {
            witchActionSection.style.display = 'none';
        }

        // Show/hide witch chat based on witch status
        if (myPlayer) {
            updateWitchChatVisibility(myPlayer.hasBeenWitch);
        }

        // Request game message history for reconnection
        if (currentRoomName) {
            socket.emit('request game message history', currentRoomName);
        }

        // Show/hide Night action section
        if (roomState.currentPhase === 'NIGHT' && myPlayer && myPlayer.alive) {
            // Check if player is witch or constable
            if (myPlayer.isWitch || myPlayer.isConstable) {
                const nightActionSection = document.getElementById('night-action-section');
                if (nightActionSection) nightActionSection.style.display = 'block';
                // Update players grid
                updatePlayersGrid(roomState, myUniqueId, nightActionState.actionType);
                // The specific prompts will be handled by socket events
                
                // If player is both witch and constable, show special message
                if (myPlayer.isWitch && myPlayer.isConstable) {
                    addGameMessage('คุณเป็นทั้งปอบและหมอผี! คุณจะใช้สิทธิ์สังหารก่อน แล้วค่อยใช้สิทธิ์ปกป้อง', 'purple', true);
                }
            } else {
                const nightActionSection = document.getElementById('night-action-section');
                if (nightActionSection) nightActionSection.style.display = 'none';
            }
        } else {
            const nightActionSection = document.getElementById('night-action-section');
            if (nightActionSection) nightActionSection.style.display = 'none';
            // Ensure night target selection is disabled when not in night phase
            disableNightTargetSelection();
        }

        // --- Always update players board grid when game is started ---
        if (roomState.gameStarted) {
            updatePlayersBoardGrid(roomState, myUniqueId);
        } else {
            // ซ่อน section ถ้าเกมยังไม่เริ่ม
            const section = document.getElementById('players-board-section');
            if (section) section.style.display = 'none';
        }

        // Show game over message and stats
        if (roomState.gameOver) {
            addGameMessage(`เกมจบแล้ว! ผู้ชนะคือ: ${roomState.winner}!`, 'gold', true);
            // Optionally disable all game actions
            gameActionsDiv.style.display = 'none';
            confessSection.style.display = 'none';
            
            // แสดงสถิติเกมจบแล้ว
            showGameOverStats(roomState);
        }

        // Reset nightActionState.hasSubmitted เมื่อเริ่มรอบใหม่ (เฟสเปลี่ยน)
        nightActionState.hasSubmitted = false;
        
        // ลบ popup สถิติถ้าเกมยังไม่จบ
        if (!roomState.gameOver) {
            const statsPopup = document.querySelector('.stats-popup');
            if (statsPopup) {
                statsPopup.remove();
            }
        }

        // ถ้าเพิ่ง forced reveal ให้ disable draw card button
        if (forcedRevealJustHappened) {
            drawCardButton.disabled = true;
        }

        // --- Witch Action Popup State ---
        let witchActionPopupOpen = false;
        let witchActionHasChosen = false;
        let witchActionType = null; // 'blackcat' or 'kill'

        function showWitchActionPopup(type) {
            witchActionPopupOpen = true;
            witchActionHasChosen = false;
            witchActionType = type;
            // ... existing popup creation code ...
        }

        // Example: When confirming Black Cat assignment
        // witchActionHasChosen = true; witchActionPopupOpen = false;

        // Example: When confirming witch kill
        // witchActionHasChosen = true; witchActionPopupOpen = false;

        // In room state update or phase update
        function handleWitchActionPopupState(roomState) {
            if (witchActionPopupOpen && !witchActionHasChosen) {
                // Black Cat assignment
                if (witchActionType === 'blackcat' && !roomState.isAssigningBlackCat) {
                    // Find which witch made the selection (if possible)
                    const lastWitch = roomState.lastBlackCatAssignerName || 'ปอบคนอื่น';
                    addGameMessage(`${lastWitch} ได้เลือกเป้าหมายเครื่องเซ่นแล้ว คุณไม่ได้เลือกทันเวลา`, 'orange', true);
                    // Close popup (implement actual popup close logic here)
                    witchActionPopupOpen = false;
                }
                // Witch kill
                if (witchActionType === 'kill' && roomState.currentPhase !== 'NIGHT') {
                    const lastWitch = roomState.lastWitchKillerName || 'ปอบคนอื่น';
                    addGameMessage(`${lastWitch} ได้เลือกเป้าหมายฆ่าตอนกลางคืน`, 'orange', true);
                    witchActionPopupOpen = false;
                }
            }
        }

        // Call handleWitchActionPopupState(currentRoomState) inside socket.on('room state update', ...) after updating currentRoomState.
        // ... existing code ...
    } else {
        gameSection.style.display = 'none';
        roomLobbySection.style.display = 'block';
    }
});

socket.on('game message', (message, color = 'black', bold = false) => {
    addGameMessage(message, color, bold);
    // Special handling for duplicate room or join-not-found
    if (message.includes('ชื่อห้องนี้ถูกใช้แล้ว')) {
        alert('Cannot create room: Room name already exists!');
    }
    if (message.includes('ไม่พบห้องนี้.')) {
        alert('Cannot join: Room not found!');
    }
});

// Game message history for reconnection
socket.on('game message history', (messages) => {
    // Clear existing messages and load history
    gameMessagesDiv.innerHTML = '';
    messages.forEach(msg => {
        addGameMessage(msg.message, msg.color, msg.bold);
    });
});

socket.on('request player name', () => {
    // If name is not set, show input. If already set, do nothing.
    if (!myPlayerName) {
        nameInputContainer.style.display = 'flex';
    }
});

socket.on('room left', () => {
    // ลบ popup สถิติถ้ามี
    const statsPopup = document.querySelector('.stats-popup');
    if (statsPopup) {
        statsPopup.remove();
    }
    
    currentRoomName = null;
    roomManagementSection.style.display = 'block';
    roomLobbySection.style.display = 'none';
    gameSection.style.display = 'none';
    leaveRoomButton.style.display = 'none';
    addGameMessage('คุณออกจากห้องแล้ว.', 'orange');
    // รีเฟรชหน้าเว็บหลังออกจากห้อง
    setTimeout(() => { location.reload(); }, 500);
});

socket.on('your turn', () => {
    isMyTurn = true;
    hasPlayedCardsThisTurn = false;
    updateTurnUI();
    addGameMessage('นี่คือตาของคุณ!', 'blue', true);
    // Reset forced reveal flag
    forcedRevealJustHappened = false;
    drawCardButton.disabled = false;
});

socket.on('disable draw button', () => {
    drawButtonDisabled = true;
    updateDrawCardButton();
});

socket.on('enable draw button', () => {
    drawButtonDisabled = false;
    updateDrawCardButton();
});

socket.on('update hand', (hand) => {
    myCurrentHand = hand;
    updateHandDisplay(myCurrentHand);
});

socket.on('update tryal cards initial', (tryalCards) => {
    myTryalCards = tryalCards;
    updateTryalCardDisplay();
    // Also update witch chat visibility in case hasBeenWitch changed
    const myPlayer = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (myPlayer) updateWitchChatVisibility(myPlayer.hasBeenWitch);
});

socket.on('update revealed tryal indexes', (revealedIndexes) => {
    myRevealedTryalCardIndexes = revealedIndexes;
    updateTryalCardDisplay();
});

socket.on('update in play cards', (inPlayCards) => {
    // Update in-play cards display if needed
    console.log('In-play cards updated:', inPlayCards);
});

socket.on('prompt witch kill', () => {
    createNightActionPopup('witch');
});

socket.on('prompt constable action', () => {
    createNightActionPopup('constable');
});

socket.on('deck info update', (deckInfo) => {
    deckCountDisplay.textContent = deckInfo.deckCount;
    discardPileCountDisplay.textContent = deckInfo.discardPileCount;
});

// Witch chat socket events
socket.on('witch chat message', (senderName, message, timestamp) => {
    addWitchChatMessage(senderName, message, timestamp);
});

socket.on('witch chat history', (messages) => {
    // Clear existing messages and load history
    witchChatMessages.innerHTML = '';
    messages.forEach(msg => {
        addWitchChatMessage(msg.senderName, msg.message, msg.timestamp);
    });
});

// Witch chat functionality
function addWitchChatMessage(senderName, message, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'witch-chat-message';
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = senderName;
    
    const messageTextDiv = document.createElement('div');
    messageTextDiv.className = 'message';
    messageTextDiv.textContent = message;
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date(timestamp).toLocaleTimeString();
    
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(messageTextDiv);
    messageDiv.appendChild(timestampDiv);
    
    witchChatMessages.appendChild(messageDiv);
    witchChatMessages.scrollTop = witchChatMessages.scrollHeight;
}

function sendWitchChatMessage() {
    const message = witchChatInput.value.trim();
    if (message && currentRoomName) {
        socket.emit('send witch chat message', currentRoomName, message);
        witchChatInput.value = '';
    }
}

// Witch chat event listeners
witchChatSendButton.addEventListener('click', sendWitchChatMessage);
witchChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendWitchChatMessage();
    }
});

// Function to show/hide witch chat based on witch status
function updateWitchChatVisibility(isWitch) {
    // แสดงแชทปอบตอนกลางคืนหรือช่วงวางเครื่องเซ่น (isAssigningBlackCat) และเป็นปอบเท่านั้น
    const isNight = currentRoomState && currentRoomState.currentPhase === 'NIGHT';
    const isAssigningBlackCat = currentRoomState && currentRoomState.isAssigningBlackCat;
    if (isWitch && (isNight || isAssigningBlackCat) && currentRoomName) {
        witchChatSection.style.display = 'block';
        // Request chat history when becoming visible
        socket.emit('request witch chat history', currentRoomName);
    } else {
        witchChatSection.style.display = 'none';
    }
}

// --- Accused Tryal Card Selection Popup ---
let accusedTryalSelection = null;

function showAccusedTryalSelection(accusedUniqueId, tryalCount) {
    if (document.getElementById('accused-tryal-select-popup')) return;
    const container = document.createElement('div');
    container.id = 'accused-tryal-select-popup';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.background = '#222';
    container.style.padding = '30px';
    container.style.borderRadius = '10px';
    container.style.zIndex = 9999;
    container.style.boxShadow = '0 0 20px #000';
    container.style.textAlign = 'center';

    const title = document.createElement('h3');
    title.textContent = 'เลือก การ์ดชีวิต ของผู้ถูกกล่าวหาเพื่อเปิดเผย';
    title.style.color = '#ffd700';
    container.appendChild(title);

    const cardsDiv = document.createElement('div');
    cardsDiv.style.display = 'flex';
    cardsDiv.style.gap = '10px';
    cardsDiv.style.justifyContent = 'center';
    cardsDiv.style.margin = '20px 0';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.textContent = `Card ${i + 1}`;
        cardBtn.style.width = '80px';
        cardBtn.style.height = '120px';
        cardBtn.style.fontSize = '1.1em';
        cardBtn.style.background = '#556B2F';
        cardBtn.style.color = '#fff';
        cardBtn.style.border = '2px solid #ffd700';
        cardBtn.style.borderRadius = '8px';
        cardBtn.style.cursor = 'pointer';
        cardBtn.style.transition = 'transform 0.2s';
        cardBtn.onmouseover = () => cardBtn.style.transform = 'scale(1.08)';
        cardBtn.onmouseout = () => cardBtn.style.transform = '';
        cardBtn.onclick = () => {
            socket.emit('select tryal card for confession', accusedUniqueId, i);
            document.body.removeChild(container);
            accusedTryalSelection = null;
        };
        cardsDiv.appendChild(cardBtn);
    }

    container.appendChild(cardsDiv);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.marginTop = '10px';
    cancelBtn.style.background = '#444';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = '1px solid #888';
    cancelBtn.style.borderRadius = '5px';
    cancelBtn.style.padding = '8px 18px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = () => {
        document.body.removeChild(container);
        accusedTryalSelection = null;
    };
    container.appendChild(cancelBtn);

    document.body.appendChild(container);
}

// --- Disable draw card after forced reveal (accusation 7) until next turn ---
let forcedRevealJustHappened = false;

socket.on('prompt select accused tryal', ({ accusedUniqueId, tryalCount }) => {
    accusedTryalSelection = { accusedUniqueId, tryalCount };
    showAccusedTryalSelection(accusedUniqueId, tryalCount);
    // Disable draw card button until next turn
    drawCardButton.disabled = true;
    forcedRevealJustHappened = true;
});

// --- Black Cat Tryal Card Selection Popup (สำหรับ พิธีเซ่นไหว้) ---
let blackCatTryalSelection = null;

function showBlackCatTryalSelection(blackCatHolder, tryalCount) {
    if (document.getElementById('blackcat-tryal-select-popup')) return;
    const container = document.createElement('div');
    container.id = 'blackcat-tryal-select-popup';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.background = '#222';
    container.style.padding = '30px';
    container.style.borderRadius = '10px';
    container.style.zIndex = 9999;
    container.style.boxShadow = '0 0 20px #000';
    container.style.textAlign = 'center';

    const title = document.createElement('h3');
    title.textContent = 'เลือก การ์ดชีวิต ของผู้ถือ การ์ดเครื่องเซ่น เพื่อเปิดเผย';
    title.style.color = '#ffd700';
    container.appendChild(title);

    const cardsDiv = document.createElement('div');
    cardsDiv.style.display = 'flex';
    cardsDiv.style.gap = '10px';
    cardsDiv.style.justifyContent = 'center';
    cardsDiv.style.margin = '20px 0';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.textContent = `Card ${i + 1}`;
        cardBtn.style.width = '80px';
        cardBtn.style.height = '120px';
        cardBtn.style.fontSize = '1.1em';
        cardBtn.style.background = '#556B2F';
        cardBtn.style.color = '#fff';
        cardBtn.style.border = '2px solid #ffd700';
        cardBtn.style.borderRadius = '8px';
        cardBtn.style.cursor = 'pointer';
        cardBtn.style.transition = 'transform 0.2s';
        cardBtn.onmouseover = () => cardBtn.style.transform = 'scale(1.08)';
        cardBtn.onmouseout = () => cardBtn.style.transform = '';
        cardBtn.onclick = () => {
            socket.emit('select blackcat tryal', blackCatHolder, i);
            document.body.removeChild(container);
            blackCatTryalSelection = null;
        };
        cardsDiv.appendChild(cardBtn);
    }

    container.appendChild(cardsDiv);
    // (No cancel button)
    document.body.appendChild(container);
}

socket.on('prompt select blackcat tryal', ({ blackCatHolder, tryalCount }) => {
    blackCatTryalSelection = { blackCatHolder, tryalCount };
    showBlackCatTryalSelection(blackCatHolder, tryalCount);
});

socket.on('prompt select curse target', (data) => {
    showCurseTargetSelection(data.targetUniqueId, data.blueCards);
});

// --- UI Event Listeners ---
// Add event listener for card target selection
cardTargetSelect.addEventListener('change', () => {
    updateDrawCardButton();
});

setNameButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        myPlayerName = name;
        localStorage.setItem('playerName', myPlayerName);
        playerNameDisplay.textContent = myPlayerName;
        nameInputContainer.style.display = 'none';
        socket.emit('set player name', myPlayerName);
    }
});

createRoomButton.addEventListener('click', () => {
    const roomName = newRoomNameInput.value.trim();
    if (roomName && myPlayerName) {
        socket.emit('create room', roomName, myPlayerName);
    } else {
        addGameMessage('โปรดป้อนชื่อห้องและชื่อผู้เล่นของคุณ.', 'red');
    }
});

joinRoomButton.addEventListener('click', () => {
    const roomName = joinRoomNameInput.value.trim();
    if (roomName && myPlayerName) {
        socket.emit('join room', roomName, myPlayerName);
    } else {
        addGameMessage('โปรดป้อนชื่อห้องและชื่อผู้เล่นของคุณ.', 'red');
    }
});

leaveRoomButton.addEventListener('click', () => {
    socket.emit('leave room');
});

startGameButton.addEventListener('click', () => {
    if (currentRoomName) {
        socket.emit('start game', currentRoomName);
    }
});

// Consolidated force next phase function
function handleForceNextPhase() {
    if (currentRoomName) {
        socket.emit('force next phase', currentRoomName);
    }
    }

forceNextPhaseButton.addEventListener('click', handleForceNextPhase);
forceNextPhaseGameButton.addEventListener('click', handleForceNextPhase);

drawCardButton.addEventListener('click', () => {
    if (!isMyTurn) {
        addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
        return;
    }
    socket.emit('draw cards');
});

playCardButton.addEventListener('click', () => {
    if (!isMyTurn) {
        addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
        return;
    }
    if (selectedCard === null) {
        addGameMessage('กรุณาเลือกการ์ดก่อน.', 'red');
        return;
    }
    const card = myCurrentHand[selectedCard];
    let targetUniqueId = null;
    let secondTargetUniqueId = null;
    if (CARDS_NEED_TWO_TARGETS.includes(card.name)) {
        // --- Popup เลือกเป้าหมายแรก ---
        const playerList = Object.values(currentRoomState.players).filter(p => p.alive && p.uniqueId !== myUniqueId);
        showSelectPlayerPopup('เลือกเป้าหมายแรก (ผู้ที่จะถูกย้าย/ถูกขโมย)', playerList, (firstId) => {
            // --- Popup เลือกเป้าหมายที่สอง ---
            const secondList = playerList.filter(p => p.uniqueId !== firstId);
            showSelectPlayerPopup('เลือกเป้าหมายที่สอง (ผู้รับการ์ด)', secondList, (secondId) => {
                socket.emit('play card', selectedCard, firstId, secondId);
                clearCardSelection();
            });
        });
        return;
    }
    if (CARDS_NEED_TARGET.includes(card.name)) {
        // --- Popup เลือกเป้าหมายเดียว ---
        // Blue card ห้ามเลือกตัวเอง
        const playerList = Object.values(currentRoomState.players).filter(p => p.alive && (card.color !== 'Blue' ? p.uniqueId !== myUniqueId : true));
        showSelectPlayerPopup('เลือกเป้าหมาย', playerList, (targetId) => {
            socket.emit('play card', selectedCard, targetId);
            clearCardSelection();
        }, card);
                    return;
                }
    // Special handling for Night card
    if (card.name === 'Night') {
        addGameMessage('คุณกำลังเล่นการ์ด Night! เตรียมตัวสำหรับความมืดมิด!', 'purple', true);
        // Note: Night card will be automatically played after turn ends if drawn
    }
    
    socket.emit('play card', selectedCard, targetUniqueId, secondTargetUniqueId);
    clearCardSelection();
});

endTurnButton.addEventListener('click', () => {
    if (!isMyTurn) {
        addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
        return;
    }
    
    socket.emit('end turn');
    clearCardSelection();
});

confessButton.addEventListener('click', () => {
    if (currentRoomName) {
        if (currentRoomState && currentRoomState.currentPhase === 'PRE_DAWN') {
            // For PRE_DAWN confession, prompt for card selection
            const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${myTryalCards.length}):`);
            const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
            if (!isNaN(index) && index >= 0 && index < myTryalCards.length) {
                socket.emit('confess during night', index);
            } else {
                addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
            }
            confessPopupShownForThisPreDawn = false;
        } else if (currentRoomState && currentRoomState.currentPhase === 'DAY' && currentRoomState.playerForcedToRevealTryal === myUniqueId) {
            // For DAY forced reveal, prompt for card selection
            const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${myTryalCards.length}):`);
            const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
            if (!isNaN(index) && index >= 0 && index < myTryalCards.length) {
                socket.emit('reveal tryal card', index);
        } else {
                addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
        }
        confessPopupShownForThisPreDawn = false;
    } else {
            // Legacy confession (should not be used anymore)
            const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${myTryalCards.length}):`);
            const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
            if (!isNaN(index) && index >= 0 && index < myTryalCards.length) {
                socket.emit('confess tryal card', index);
            } else {
                addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
            }
        }
    }
});

// Add skip confession button event listener
const skipConfessButton = document.getElementById('skip-confess-button');
skipConfessButton.addEventListener('click', () => {
    if (currentRoomName) {
        socket.emit('skip confession');
        confessPopupShownForThisPreDawn = false;
    }
});

confirmBlackCatButton.addEventListener('click', () => {
    const targetUniqueId = blackCatTargetSelect.value;
    if (targetUniqueId) {
        socket.emit('assign black cat', targetUniqueId);
        // Hide the UI after selection
        witchActionSection.style.display = 'none';
        assignBlackCatAction.style.display = 'none';
    } else {
        addGameMessage('โปรดเลือกผู้เล่นที่จะรับการ์ดเครื่องเซ่น.', 'red');
    }
});

const confirmNightActionButton = document.getElementById('confirm-night-action-button');
confirmNightActionButton.addEventListener('click', () => {
    if (!nightActionState.isSelecting || !nightActionState.selectedTargetId) {
        addGameMessage('โปรดเลือกเป้าหมายก่อน.', 'red');
        return;
    }

    if (nightActionState.actionType === 'constable') {
        socket.emit('constable action', nightActionState.selectedTargetId);
        addGameMessage('คุณได้เลือกที่จะปกป้องเป้าหมายแล้ว', 'green');
    } else if (nightActionState.actionType === 'witch') {
        socket.emit('witch kill target', nightActionState.selectedTargetId);
        addGameMessage('คุณได้เลือกเป้าหมายที่จะสังหารแล้ว', 'darkred');
    }

    // Hide UI and reset state after confirming
    disableNightTargetSelection();
});

// --- Helper Functions (Client-side UI) ---
function addGameMessage(message, color, bold = false) {
    message = replaceCardNamesInMessage(message);
    // กำหนดสีให้อ่านง่ายและเหมาะกับสถานการณ์ (สดและตัดกับพื้นหลัง)
    const colorMap = {
        red:      '#ef5350',   // สดขึ้น
        green:    '#66bb6a',   // สดขึ้น
        blue:     '#42a5f5',   // ฟ้าอ่อนสด
        gold:     '#ffb300',   // เหลืองทองเข้ม
        gray:     '#e0e0e0',   // เทาอ่อน
        orange:   '#ffb74d',   // ส้มสด
        purple:   '#ba68c8',   // ม่วงสด
        darkred:  '#c62828',   // แดงเข้ม
        darkblue: '#3949ab',   // น้ำเงินเข้ม
        black:    '#fff',      // ขาว
    };
    let useColor = colorMap[color] || colorMap.black;

    const messageDiv = document.createElement('div');
    if (bold) messageDiv.style.fontWeight = 'bold';
    messageDiv.style.color = useColor;
    messageDiv.innerHTML = message;
    const gameMessages = document.getElementById('game-messages');
    if (gameMessages) gameMessages.appendChild(messageDiv);
    gameMessages.scrollTop = gameMessages.scrollHeight;
}

function clearCardSelection() {
    selectedCard = null;
    playerHandDiv.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
    });
    cardTargetSelect.style.display = 'none';
    cardTargetSelect.value = '';
    cardSecondTargetSelect.style.display = 'none';
    cardSecondTargetSelect.value = '';
}

function updateTurnUI() {
    drawCardButton.disabled = !isMyTurn || drawButtonDisabled;
    playCardButton.disabled = !isMyTurn;
    endTurnButton.disabled = !isMyTurn;
    // ไม่ต้องซ่อน turnControlsDiv หรือ #game-actions แล้ว
    if (!isMyTurn) {
        clearCardSelection();
        drawButtonDisabled = false; // Reset when turn changes
    }
    // เพิ่ม/ลบ class my-turn-active
    if (isMyTurn) {
        document.querySelector('.main-game-content')?.classList.add('my-turn-active');
        document.querySelector('.hand-action-buttons')?.classList.add('my-turn-active');
    } else {
        document.querySelector('.main-game-content')?.classList.remove('my-turn-active');
        document.querySelector('.hand-action-buttons')?.classList.remove('my-turn-active');
    }
    updateDrawCardButton();
}

function updateDrawCardButton() {
    // Disable draw card button if a card is selected and needs a target
    if (selectedCard !== null && myCurrentHand[selectedCard] && CARDS_NEED_TARGET.includes(myCurrentHand[selectedCard].name) && cardTargetSelect.value) {
        drawCardButton.disabled = true;
    } else if (isMyTurn && !drawButtonDisabled) {
        // Don't disable draw button for Night card since it's played after turn ends
        drawCardButton.disabled = false;
            } else {
        drawCardButton.disabled = true;
            }
}

function showCardDescription(card, cardElement) {
    // Show card description on hover
    cardElement.addEventListener('mouseover', () => {
            if (card.description && cardDescriptionPopup) {
                cardDescriptionPopup.textContent = card.description;
                cardDescriptionPopup.classList.add('show');
            }
        });
    cardElement.addEventListener('mousemove', (event) => {
            if (cardDescriptionPopup) {
                cardDescriptionPopup.style.left = `${event.pageX + 15}px`;
                cardDescriptionPopup.style.top = `${event.pageY + 15}px`;
            }
        });
    cardElement.addEventListener('mouseout', () => {
            if (cardDescriptionPopup) {
                cardDescriptionPopup.classList.remove('show');
            }
        });
}

function updateHandDisplay(hand) {
    myCurrentHand = hand;
    playerHandDiv.innerHTML = '';
    handCardCount.textContent = hand.length;

    hand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = `card card-${card.color.toLowerCase()}`;
        
        // แสดงรูปการ์ดแทนข้อความ
        const cardImage = createCardImage(card.name);
        cardImage.style.width = '100%';
        cardImage.style.height = '100%';
        cardImage.style.objectFit = 'cover';
        cardImage.style.borderRadius = '4px';
        cardElement.appendChild(cardImage);
        
        cardElement.dataset.index = index;
        // --- Drag & Drop ---
        cardElement.draggable = true;
        cardElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            cardElement.classList.add('dragging');
        });
        cardElement.addEventListener('dragend', (e) => {
            cardElement.classList.remove('dragging');
        });
        cardElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            cardElement.classList.add('drag-over');
        });
        cardElement.addEventListener('dragleave', (e) => {
            cardElement.classList.remove('drag-over');
        });
        cardElement.addEventListener('drop', (e) => {
            e.preventDefault();
            cardElement.classList.remove('drag-over');
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIdx = index;
            if (fromIdx !== toIdx) {
                // Swap cards in hand
                const temp = myCurrentHand[fromIdx];
                myCurrentHand[fromIdx] = myCurrentHand[toIdx];
                myCurrentHand[toIdx] = temp;
                // (Optional) emit to server: socket.emit('swap hand cards', fromIdx, toIdx);
                updateHandDisplay(myCurrentHand);
            }
        });
        // --- Tooltip ---
        cardElement.addEventListener('mouseover', () => {
            if (card.description && cardDescriptionPopup) {
                cardDescriptionPopup.textContent = card.description;
                cardDescriptionPopup.classList.add('show');
            }
        });
        cardElement.addEventListener('mousemove', (event) => {
            if (cardDescriptionPopup) {
                cardDescriptionPopup.style.left = `${event.pageX + 15}px`;
                cardDescriptionPopup.style.top = `${event.pageY + 15}px`;
            }
        });
        cardElement.addEventListener('mouseout', () => {
            if (cardDescriptionPopup) {
                cardDescriptionPopup.classList.remove('show');
            }
        });
        // --- Click to select ---
        cardElement.addEventListener('click', () => {
            if (!isMyTurn) {
                addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
                return;
            }
            clearCardSelection();
            selectedCard = index;
            cardElement.classList.add('selected');
            // ไม่ต้องแสดง select target แล้ว (popup จะขึ้นเองตอนเล่นการ์ด)
                cardTargetSelect.style.display = 'none';
            cardTargetSelect.value = '';
            cardSecondTargetSelect.style.display = 'none';
            cardSecondTargetSelect.value = '';
        });
        playerHandDiv.appendChild(cardElement);
    });
}

// ฟังก์ชันสร้างรูปการ์ด
function createCardImage(cardName) {
    const img = document.createElement('img');
    
    // แมปชื่อการ์ดกับชื่อไฟล์
    const cardImageMap = {
        'Accusation': 'accusation.png',
        'Evidence': 'evidence.png',
        'Witness': 'witness.png',
        'Scapegoat': 'scapegoat.png',
        'Curse': 'curse.png',
        'Alibi': 'alibi.png',
        'Robbery': 'robbery.png',
        'Stocks': 'stocks.png',
        'Arson': 'arson.png',
        'Black Cat': 'blackcat.png',
        'Asylum': 'asylum.png',
        'Piety': 'piety.png',
        'Matchmaker': 'matchmaker.png',
        'Conspiracy': 'conspiracy.png',
        'Night': 'night.png',
        'Witch': 'witch.png',
        'Not A Witch': 'notawitch.png',
        'Constable': 'constable.png'
    };
    
    const imageFileName = cardImageMap[cardName] || 'accusation.png'; // fallback
    img.src = `cards/${imageFileName}`;
    img.alt = displayCardName(cardName);
    img.title = displayCardDescription(cardName);
    
    // ตั้งค่าสไตล์ของรูป
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '8px';
    
    return img;
}

function populateCardTargetSelect(playersData, myUniqueId, selectedCardObj = null) {
    cardTargetSelect.innerHTML = '<option value="">Select Target</option>';
    cardSecondTargetSelect.innerHTML = '<option value="">Select Second Target</option>';
    
    // Check if card needs 2 targets
    const needsTwoTargets = selectedCardObj && CARDS_NEED_TWO_TARGETS.includes(selectedCardObj.name);
    const SALEM_COLORS = ['Red', 'Green', 'Blue'];
    if (needsTwoTargets) {
        // For cards that need 2 targets, show all players except self for Salem cards
        for (const uniqueId in playersData) {
            const player = playersData[uniqueId];
            let allow = true;
            if (
                selectedCardObj &&
                selectedCardObj.color && SALEM_COLORS.includes(selectedCardObj.color) &&
                player.uniqueId === myUniqueId
            ) {
                allow = false;
            }
            if (player.alive && allow) {
                const option1 = document.createElement('option');
                option1.value = player.uniqueId;
                option1.textContent = player.name;
                cardTargetSelect.appendChild(option1);
                const option2 = document.createElement('option');
                option2.value = player.uniqueId;
                option2.textContent = player.name;
                cardSecondTargetSelect.appendChild(option2);
            }
        }
        cardSecondTargetSelect.style.display = 'inline-block';
    } else {
        // For single target cards
        for (const uniqueId in playersData) {
            const player = playersData[uniqueId];
            let allow = true;
            if (
                selectedCardObj &&
                selectedCardObj.color && SALEM_COLORS.includes(selectedCardObj.color) &&
                player.uniqueId === myUniqueId
            ) {
                allow = false;
            } else if (!player.alive) {
                allow = false;
            }
            if (allow) {
                const option = document.createElement('option');
                option.value = player.uniqueId;
                option.textContent = player.name;
                cardTargetSelect.appendChild(option);
            }
        }
        cardSecondTargetSelect.style.display = 'none';
    }
}

function enableNightTargetSelection(actionType) {
    console.log('enableNightTargetSelection called with actionType:', actionType);
    console.log('Current room state:', currentRoomState);
    console.log('My unique ID:', myUniqueId);
    
    nightActionState.isSelecting = true;
    nightActionState.actionType = actionType;
    nightActionState.selectedTargetId = null;

    // Update night action UI
    const nightActionSection = document.getElementById('night-action-section');
    const nightActionTitle = document.getElementById('night-action-title');
    const nightActionInstruction = document.getElementById('night-action-instruction');
    const confirmButton = document.getElementById('confirm-night-action-button');

    if (actionType === 'witch') {
        nightActionTitle.textContent = 'Witch Action - เลือกเป้าหมายที่จะสังหาร';
        nightActionInstruction.textContent = 'คุณเป็นปอบ! เลือกผู้เล่นที่มีชีวิตอยู่ที่จะสังหารในคืนนี้:';
    } else if (actionType === 'constable') {
        nightActionTitle.textContent = 'Constable Action - เลือกผู้เล่นที่จะปกป้อง';
        // Check if player is also a witch
        if (currentRoomState && currentRoomState.players[myUniqueId] && currentRoomState.players[myUniqueId].isWitch) {
            nightActionInstruction.textContent = 'คุณเป็นทั้งปอบและหมอผี! ตอนนี้คุณใช้สิทธิ์หมอผีเพื่อปกป้องผู้เล่น:';
        } else {
            nightActionInstruction.textContent = 'คุณเป็นหมอผี! เลือกผู้เล่นที่จะปกป้องด้วยการปัดเป่าของคุณ';
        }
    }

    console.log('Showing night action section');
    nightActionSection.style.display = 'block';
    confirmButton.style.display = 'inline-block';
    
    console.log('Night action section display style:', nightActionSection.style.display);
    console.log('Confirm button display style:', confirmButton.style.display);

    // Update night players grid with selectable targets
    if (currentRoomState) {
        console.log('Calling updatePlayersGrid with actionType:', actionType);
        updatePlayersGrid(currentRoomState, myUniqueId, actionType);
    } else {
        console.log('No currentRoomState available');
    }

    addGameMessage(`เลือกผู้เล่นจากรายการด้านล่าง แล้วกดยืนยัน (${actionType === 'witch' ? 'สังหาร' : 'ปกป้อง'})`, 'blue');
}

function disableNightTargetSelection() {
    if (!nightActionState.isSelecting) return; // No need to disable if not enabled

    nightActionState.isSelecting = false;
    nightActionState.actionType = null;
    nightActionState.selectedTargetId = null;

    // Hide night action UI but keep players grid visible
    const nightActionSection = document.getElementById('night-action-section');
    const confirmButton = document.getElementById('confirm-night-action-button');
    
    nightActionSection.style.display = 'none';
    confirmButton.style.display = 'none';

    // Remove click listeners from night player cards
    document.querySelectorAll('.night-player-card').forEach(card => {
        card.classList.remove('selectable-target', 'selected');
        card.removeEventListener('click', handleNightPlayerCardClick);
    });
}

function updateTryalCardDisplay() {
    const tryalCardsList = document.getElementById('my-tryal-cards-list');
    if (tryalCardsList) {
        tryalCardsList.innerHTML = '';
        myTryalCards.forEach((card, idx) => {
            // Card UI
            const cardDiv = document.createElement('div');
            let tryalClass = '';
            if (card.name === 'Witch') tryalClass = 'witch';
            else if (card.name === 'Constable') tryalClass = 'constable';
            else tryalClass = 'notawitch';
            cardDiv.className = `card tryal-card-in-hand tryal-card ${tryalClass}`;
            cardDiv.style.display = 'inline-flex';
            cardDiv.style.margin = '5px';
            cardDiv.style.width = '100px';
            cardDiv.style.height = '140px';
            cardDiv.style.justifyContent = 'center';
            cardDiv.style.alignItems = 'center';
            cardDiv.style.fontSize = '1.1em';
            cardDiv.style.fontWeight = 'bold';
            cardDiv.style.cursor = 'grab';
            cardDiv.dataset.index = idx;
            cardDiv.title = displayCardDescription(card.name); // <-- Add tooltip for tryal cards
            
            // แสดงรูปการ์ดแทนข้อความ
            const cardImage = createCardImage(card.name);
            cardImage.style.width = '100%';
            cardImage.style.height = '100%';
            cardImage.style.objectFit = 'cover';
            cardImage.style.borderRadius = '6px';
            cardDiv.appendChild(cardImage);
            
            // Drag & drop events
            cardDiv.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', idx);
                cardDiv.classList.add('dragging');
            });
            cardDiv.addEventListener('dragend', (e) => {
                cardDiv.classList.remove('dragging');
            });
            cardDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                cardDiv.classList.add('drag-over');
            });
            cardDiv.addEventListener('dragleave', (e) => {
                cardDiv.classList.remove('drag-over');
            });
            cardDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                cardDiv.classList.remove('drag-over');
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIdx = idx;
                if (fromIdx !== toIdx) {
                    // Swap cards
                    const temp = myTryalCards[fromIdx];
                    myTryalCards[fromIdx] = myTryalCards[toIdx];
                    myTryalCards[toIdx] = temp;
                    // Emit swap to server
                    socket.emit('swap tryal cards', fromIdx, toIdx);
                    updateTryalCardDisplay();
                }
            });
            tryalCardsList.appendChild(cardDiv);
        });
    }
    if (myRevealedTryalCardIndexes && myRevealedTryalCardIndexes.length > 0) {
        myRevealedTryalCards.textContent = `Revealed: ${myRevealedTryalCardIndexes.map(i => myTryalCards[i]?.name).filter(Boolean).join(', ')}`;
    } else {
        myRevealedTryalCards.textContent = '';
    }
    // Use hasBeenWitch for team display and update witch chat
    const myPlayer = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (myPlayer) {
        // ทีมปอบ: ถ้าเคยมีไพ่ Witch (hasBeenWitch)
        if (myPlayer.hasBeenWitch) {
            myRoleDisplay.textContent = 'ทีมปอบ';
            myRoleDisplay.classList.add('team-witch');
            myRoleDisplay.classList.remove('team-town');
        } else {
            myRoleDisplay.textContent = 'ทีมชาวบ้าน';
            myRoleDisplay.classList.add('team-town');
            myRoleDisplay.classList.remove('team-witch');
        }
        updateWitchChatVisibility(myPlayer.hasBeenWitch);
    }
    // Update tryal card count in heading
    const tryalCardCountSpan = document.getElementById('tryal-card-count');
    if (tryalCardCountSpan) {
        tryalCardCountSpan.textContent = myTryalCards.length;
    }
}

function updatePlayersGrid(roomState, myUniqueId, actionType = null) {
    const nightPlayersListSection = document.getElementById('night-players-list-section');
    const nightPlayersList = document.getElementById('night-players-list');
    
    if (!roomState || !roomState.players) {
        nightPlayersListSection.style.display = 'none';
        return;
    }

    // แสดง section ตลอดเวลาเมื่อเกมเริ่มแล้ว
    if (roomState.gameStarted) {
        nightPlayersListSection.style.display = 'block';
    } else {
        nightPlayersListSection.style.display = 'none';
        return;
    }

    nightPlayersList.innerHTML = ''; // Clear existing cards

    const playersInOrder = Object.values(roomState.players).sort((a, b) => a.name.localeCompare(b.name));

    playersInOrder.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-board-card' + (!player.alive ? ' dead' : '') + (roomState.currentTurnPlayerUniqueId === player.uniqueId ? ' current-turn' : '');
        // Header
        let header = `<div class='player-board-header'>`;
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) {
            header += `<span style="color:#ffd700;font-size:1.2em;margin-right:6px;vertical-align:middle;">🔥</span>`;
        }
        header += `${player.name}`;
        if (player.isHost) header += ' <span style="color:#ff4500;">(Host)</span>';
        if (player.isBlackCatHolder) header += ' <span style="color:#ffd700;">(เครื่องเซ่น)</span>';
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) header += ' <span style="color:#2196f3;font-weight:bold;">[เทิร์น]</span>';
        header += '</div>';
        // Status
        let status = `<div class='player-board-status'>`;
        status += `การ์ดในมือ: ${player.handSize} | ข้อกล่าวหา: ${player.accusationPoints}`;
        // --- Effect: เฉพาะ Blue + Stocks (Green) ---
        let effectCards = [];
        if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
            effectCards = player.inPlayCards.filter(c => c === 'Stocks' || c === 'Black Cat' || c === 'Asylum' || c === 'Piety' || c === 'Matchmaker');
        }
        if (effectCards.length > 0) {
            status += `<br><span class='effect-label' style="display:inline-block;margin-top:2px;font-size:1.08em;font-weight:bold;color:#ffd700;">✨ ผลพิเศษ:</span> `;
            effectCards.forEach(cardName => {
                let desc = '';
                let themeClass = '';
                switch(cardName) {
                    case 'Stocks': desc = 'ข้ามตา'; cardName = 'พันธนาการ'; themeClass = 'card-theme card-green'; break;
                    case 'Black Cat': desc = 'เริ่มเล่นเป็นคนแรก/โดน พิธีเซ่นไหว้'; cardName = 'เครื่องเซ่น'; themeClass = 'card-theme card-blue'; break;
                    case 'Asylum': desc = 'ป้องกันถูกฆ่าตอนกลางคืน'; cardName = 'ที่หลบภัย'; themeClass = 'card-theme card-blue'; break;
                    case 'Piety': desc = 'กันโจมตีด้วยการ์ดแดง'; cardName = 'พลังศรัทธา'; themeClass = 'card-theme card-blue'; break;
                    case 'Matchmaker': desc = 'ตายคู่'; cardName = 'ผูกวิญญาณ'; themeClass = 'card-theme card-green'; break;
                    default: desc = ''; themeClass = 'card-theme card-black';
                }
                status += `<span class='effect-card ${themeClass}' title='${desc}' style="padding:2px 10px;margin:0 4px;border-radius:8px;font-size:1.08em;vertical-align:middle;box-shadow:0 2px 8px #ffd70044;">${cardName}</span>`;
            });
        }
        status += '</div>';
        // Tryal Cards
        let tryals = `<div class='player-board-tryals'>`;
        if (player.tryalCards && Array.isArray(player.tryalCards)) {
            player.tryalCards.forEach((cardObj, idx) => {
                const revealed = player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.includes(idx);
                let cardClass = 'player-board-tryal-card';
                let cardThemeClass = '';
                if (revealed) {
                    if (cardObj.name === 'Witch') {
                        cardThemeClass = ' card-theme card-red';
                    } else if (cardObj.name === 'Constable') {
                        cardThemeClass = ' card-theme card-blue';
                    } else {
                        cardThemeClass = ' card-theme card-black';
                    }
                }
                tryals += `<div class='${cardClass}${revealed ? ' revealed' : ''}${cardThemeClass}' title='${displayCardDescription(cardObj.name)}'>${revealed ? displayCardName(cardObj.name) : 'Card ' + (idx + 1)}</div>`;
            });
        }
        tryals += '</div>';
        card.innerHTML = header + status + tryals;
        list.appendChild(card);
    });
}

function handleNightPlayerCardClick(event) {
    console.log('handleNightPlayerCardClick called');
    console.log('nightActionState:', nightActionState);
    
    if (!nightActionState.isSelecting) {
        console.log('Not in night action selection mode');
        return;
    }

    // Clear previous selection
    document.querySelectorAll('.night-player-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = event.currentTarget;
    selectedCard.classList.add('selected');

    // Get the player's uniqueId from the dataset
    const targetUniqueId = selectedCard.dataset.uniqueId;
    console.log('Selected target uniqueId:', targetUniqueId);
    
    if (targetUniqueId) {
        nightActionState.selectedTargetId = targetUniqueId;
        
        // Get player name for display
        const playerNameElement = selectedCard.querySelector('.player-name');
        const playerName = playerNameElement.textContent.split(' ')[0]; // Get first part of name
        console.log('Selected player name:', playerName);
        addGameMessage(`เลือก ${playerName} เป็นเป้าหมาย`, 'blue');
    }
}

function updatePlayersBoardGrid(roomState, myUniqueId) {
    const section = document.getElementById('players-board-section');
    const list = document.getElementById('players-board-list');
    if (!roomState || !roomState.players) {
        section.style.display = 'none';
        return;
    }
    if (roomState.gameStarted) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
        return;
    }
    list.innerHTML = '';
    const playersInOrder = Object.values(roomState.players).sort((a, b) => a.name.localeCompare(b.name));
    playersInOrder.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-board-card' + (!player.alive ? ' dead' : '') + (roomState.currentTurnPlayerUniqueId === player.uniqueId ? ' current-turn' : '');
        // Header
        let header = `<div class='player-board-header'>`;
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) {
            header += `<span style="color:#ffd700;font-size:1.2em;margin-right:6px;vertical-align:middle;">🔥</span>`;
        }
        header += `${player.name}`;
        if (player.isHost) header += ' <span style="color:#ff4500;">(Host)</span>';
        if (player.isBlackCatHolder) header += ' <span style="color:#ffd700;">(เครื่องเซ่น)</span>';
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) header += ' <span style="color:#2196f3;font-weight:bold;">[เทิร์น]</span>';
        header += '</div>';
        // Status
        let status = `<div class='player-board-status'>`;
        status += `การ์ดในมือ: ${player.handSize} | ข้อกล่าวหา: ${player.accusationPoints}`;
        // --- Effect: เฉพาะ Blue + Stocks (Green) ---
        let effectCards = [];
        if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
            effectCards = player.inPlayCards.filter(c => c === 'Stocks' || c === 'Black Cat' || c === 'Asylum' || c === 'Piety' || c === 'Matchmaker');
        }
        if (effectCards.length > 0) {
            status += `<br><span class='effect-label' style="display:inline-block;margin-top:2px;font-size:1.08em;font-weight:bold;color:#ffd700;">✨ ผลพิเศษ:</span> `;
            effectCards.forEach(cardName => {
                let desc = '';
                let themeClass = '';
                switch(cardName) {
                    case 'Stocks': desc = 'ข้ามตา'; cardName = 'พันธนาการ'; themeClass = 'card-theme card-green'; break;
                    case 'Black Cat': desc = 'เริ่มเล่นเป็นคนแรก/โดน พิธีเซ่นไหว้'; cardName = 'เครื่องเซ่น'; themeClass = 'card-theme card-blue'; break;
                    case 'Asylum': desc = 'ป้องกันถูกฆ่าตอนกลางคืน'; cardName = 'ที่หลบภัย'; themeClass = 'card-theme card-blue'; break;
                    case 'Piety': desc = 'กันโจมตีด้วยการ์ดแดง'; cardName = 'พลังศรัทธา'; themeClass = 'card-theme card-blue'; break;
                    case 'Matchmaker': desc = 'ตายคู่'; cardName = 'ผูกวิญญาณ'; themeClass = 'card-theme card-green'; break;
                    default: desc = ''; themeClass = 'card-theme card-black';
                }
                status += `<span class='effect-card ${themeClass}' title='${desc}' style="padding:2px 10px;margin:0 4px;border-radius:8px;font-size:1.08em;vertical-align:middle;box-shadow:0 2px 8px #ffd70044;">${cardName}</span>`;
            });
        }
        status += '</div>';
        // Tryal Cards
        let tryals = `<div class='player-board-tryals'>`;
        if (player.tryalCards && Array.isArray(player.tryalCards)) {
            player.tryalCards.forEach((cardObj, idx) => {
                const revealed = player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.includes(idx);
                let cardClass = 'player-board-tryal-card';
                let cardThemeClass = '';
                if (revealed) {
                    if (cardObj.name === 'Witch') {
                        cardThemeClass = ' card-theme card-red';
                    } else if (cardObj.name === 'Constable') {
                        cardThemeClass = ' card-theme card-blue';
                    } else {
                        cardThemeClass = ' card-theme card-black';
                    }
                }
                tryals += `<div class='${cardClass}${revealed ? ' revealed' : ''}${cardThemeClass}' title='${displayCardDescription(cardObj.name)}'>${revealed ? displayCardName(cardObj.name) : 'Card ' + (idx + 1)}</div>`;
            });
        }
        tryals += '</div>';
        card.innerHTML = header + status + tryals;
        list.appendChild(card);
    });
}

socket.on('must play night card', () => {
    drawCardButton.disabled = true;
    endTurnButton.disabled = true;
    // Popup แจ้งเตือน
    if (!document.getElementById('must-play-night-popup')) {
        const popup = document.createElement('div');
        popup.id = 'must-play-night-popup';
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = '#222';
        popup.style.padding = '30px';
        popup.style.borderRadius = '10px';
        popup.style.zIndex = 9999;
        popup.style.boxShadow = '0 0 20px #000';
        popup.style.textAlign = 'center';
        popup.innerHTML = '<h3 style="color:#ffd700;">คุณต้องเล่นการ์ด Night ก่อนจบเทิร์น!</h3>';
        document.body.appendChild(popup);
    }
});

socket.on('popup assign black cat', (potentialTargets) => {
    // Popup UI เด่นๆ
    if (document.getElementById('assign-blackcat-popup')) return;
    const container = document.createElement('div');
    container.id = 'assign-blackcat-popup';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.background = 'linear-gradient(135deg, #1a1a1a, #2a2a2a)';
    container.style.padding = '40px';
    container.style.borderRadius = '15px';
    container.style.zIndex = 9999;
    container.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.5)';
    container.style.textAlign = 'center';
    container.style.border = '3px solid #ffd700';
    container.style.minWidth = '400px';
    container.style.animation = 'pulse 2s infinite';
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.5); }
            50% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.8); }
            100% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.5); }
        }
    `;
    document.head.appendChild(style);
    
    const title = document.createElement('h2');
    title.textContent = '🎭 ปอบเลือกผู้รับการ์ดเครื่องเซ่น 🎭';
    title.style.color = '#ffd700';
    title.style.fontSize = '1.5em';
    title.style.marginBottom = '20px';
    title.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    container.appendChild(title);
    
    const subtitle = document.createElement('p');
    subtitle.textContent = 'เลือกผู้เล่นที่จะได้รับการ์ดเครื่องเซ่น:';
    subtitle.style.color = '#fff';
    subtitle.style.marginBottom = '15px';
    container.appendChild(subtitle);
    
    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '12px';
    select.style.fontSize = '1.1em';
    select.style.borderRadius = '8px';
    select.style.border = '2px solid #ffd700';
    select.style.background = '#333';
    select.style.color = '#fff';
    select.style.marginBottom = '20px';
    select.innerHTML = '<option value="">-- เลือกผู้เล่น --</option>';
    potentialTargets.forEach(target => {
        const option = document.createElement('option');
        option.value = target.uniqueId;
        option.textContent = target.name;
        select.appendChild(option);
    });
    container.appendChild(select);
    
    const btn = document.createElement('button');
    btn.textContent = '✅ ยืนยันการเลือก';
    btn.style.padding = '15px 30px';
    btn.style.fontSize = '1.2em';
    btn.style.fontWeight = 'bold';
    btn.style.background = 'linear-gradient(45deg, #ffd700, #ffed4e)';
    btn.style.color = '#000';
    btn.style.border = 'none';
    btn.style.borderRadius = '10px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)';
    btn.style.transition = 'all 0.3s ease';
    btn.onmouseover = () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.6)';
    };
    btn.onmouseout = () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)';
    };
    btn.onclick = () => {
        if (select.value) {
            socket.emit('assign black cat', select.value);
            document.body.removeChild(container);
        } else {
            alert('กรุณาเลือกผู้เล่นก่อน!');
        }
    };
    container.appendChild(btn);
    document.body.appendChild(container);
    // แสดงรายชื่อทีมปอบ
    if (currentRoomState && currentRoomState.players) {
        const witchTeam = Object.values(currentRoomState.players).filter(p => p.hasBeenWitch);
        if (witchTeam.length > 0) {
            const witchList = document.createElement('div');
            witchList.style.background = '#222';
            witchList.style.color = '#ffd700';
            witchList.style.padding = '10px 16px';
            witchList.style.borderRadius = '8px';
            witchList.style.marginBottom = '18px';
            witchList.style.fontWeight = 'bold';
            witchList.innerHTML = 'ทีมปอบ: ' + witchTeam.map(p => p.name).join(', ');
            container.appendChild(witchList);
        }
    }
});

function createNightActionPopup(actionType, timer) {
    console.log('createNightActionPopup called with actionType:', actionType, 'timer:', timer);
    
    // Remove existing popup if any
    const existingPopup = document.getElementById('night-action-popup');
    if (existingPopup) {
        console.log('Removing existing night action popup');
        existingPopup.remove();
    }
    
    const popup = document.createElement('div');
    popup.id = 'night-action-popup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #2a2a2a;
        border: 3px solid #ff7f50;
        border-radius: 15px;
        padding: 30px;
        z-index: 1000;
        min-width: 400px;
        max-width: 600px;
        box-shadow: 0 0 30px rgba(255, 127, 80, 0.5);
        animation: popupFadeIn 0.3s ease-out;
    `;
    
    const title = actionType === 'witch' ? 'ปอบ - เลือกเป้าหมายที่จะสังหาร' : 'หมอผี - เลือกผู้เล่นที่จะปกป้อง';
    const titleColor = actionType === 'witch' ? '#ff6666' : '#66ccff';
    
    popup.innerHTML = `
        <h2 style="color: ${titleColor}; margin-top: 0; text-align: center; font-size: 1.5em;">${title}</h2>
        <div style="color: #ccc; text-align: center; margin-bottom: 20px;">
            คลิกที่ชื่อผู้เล่นเพื่อเลือกเป้าหมาย
        </div>
        <div id="night-action-players-list" style="max-height: 300px; overflow-y: auto;"></div>
        <div style="text-align: center; margin-top: 20px;">
            <button id="confirm-night-action" style="
                background: #ff4500; 
                color: white; 
                padding: 12px 24px; 
                border: none; 
                border-radius: 8px; 
                font-size: 1.1em; 
                cursor: pointer;
                display: none;
            ">ยืนยันการเลือก</button>
        </div>
    `;
    
    console.log('Adding popup to document body');
    document.body.appendChild(popup);
    
    // Populate players list
    console.log('Calling populateNightActionPlayersList');
    populateNightActionPlayersList(actionType);
    // แสดงรายชื่อทีมปอบ
    if (currentRoomState && currentRoomState.players) {
        const witchTeam = Object.values(currentRoomState.players).filter(p => p.hasBeenWitch);
        if (witchTeam.length > 0) {
            const witchList = document.createElement('div');
            witchList.style.background = '#222';
            witchList.style.color = '#ffd700';
            witchList.style.padding = '10px 16px';
            witchList.style.borderRadius = '8px';
            witchList.style.marginBottom = '18px';
            witchList.style.fontWeight = 'bold';
            witchList.innerHTML = 'ทีมปอบ: ' + witchTeam.map(p => p.name).join(', ');
            popup.appendChild(witchList);
        }
    }
}

function autoSubmitNightAction(actionType) {
    // ส่ง action แบบ skip (ไม่เลือกเป้าหมาย)
    if (actionType === 'witch') {
        socket.emit('witch kill target', null); // null = ไม่เลือก
    } else if (actionType === 'constable') {
        socket.emit('constable action', null); // null = ไม่เลือก
    }
    // ปิด popup
    const popup = document.getElementById('night-action-popup');
    if (popup) {
            popup.remove();
    }
    nightActionState.selectedTargetId = null;
    disableNightTargetSelection();
}

function submitNightAction(actionType) {
    console.log('submitNightAction called with actionType:', actionType);
    console.log('nightActionState:', nightActionState);
    
    if (!nightActionState.selectedTargetId) {
        console.log('No target selected');
        addGameMessage('กรุณาเลือกเป้าหมายก่อน', 'red');
        return;
    }
    
    console.log('Submitting night action:', actionType, 'target:', nightActionState.selectedTargetId);
    
    if (actionType === 'witch') {
        socket.emit('witch kill target', nightActionState.selectedTargetId);
        nightActionState.hasSubmitted = true; // ตั้ง flag
        // ปิด popup ทันที
        const popup = document.getElementById('night-action-popup');
        if (popup) {
            popup.remove();
        }
    } else if (actionType === 'constable') {
        socket.emit('constable action', nightActionState.selectedTargetId);
        addGameMessage('คุณได้เลือกที่จะปกป้องเป้าหมายแล้ว', 'green');
        // ปิด popup ทันที (optionally)
    const popup = document.getElementById('night-action-popup');
    if (popup) {
        popup.remove();
        }
    }
    
    // Hide UI and reset state after confirming
    disableNightTargetSelection();
}

function showConfessPopup(tryalCards) {
    if (document.getElementById('confess-popup')) return;
    if (!tryalCards || tryalCards.length === 0) return; // ไม่เด้ง popup ถ้าไม่มีไพ่
    const popup = document.createElement('div');
    popup.id = 'confess-popup';
    popup.style = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;padding:30px;border-radius:10px;z-index:9999;text-align:center;box-shadow:0 0 20px #000;';

    const title = document.createElement('h3');
    title.textContent = 'เลือก การ์ดชีวิต เพื่อสารภาพ';
    title.style.color = '#ffd700';
    popup.appendChild(title);

    const cardsDiv = document.createElement('div');
    cardsDiv.style.display = 'flex';
    cardsDiv.style.gap = '10px';
    cardsDiv.style.justifyContent = 'center';
    cardsDiv.style.margin = '20px 0';

    tryalCards.forEach((card, i) => {
        const btn = document.createElement('button');
        btn.textContent = displayCardName(card.name);
        btn.style = 'width:80px;height:120px;font-size:1.1em;background:#556B2F;color:#fff;border:2px solid #ffd700;border-radius:8px;cursor:pointer;';
        btn.onclick = () => {
            socket.emit('confess during night', i);
            if (document.body.contains(popup)) document.body.removeChild(popup);
        };
        cardsDiv.appendChild(btn);
    });
    popup.appendChild(cardsDiv);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'ข้ามการสารภาพ';
    skipBtn.style = 'margin-top:10px;background:#444;color:#fff;border:1px solid #888;border-radius:5px;padding:8px 18px;cursor:pointer;';
    skipBtn.onclick = () => {
        socket.emit('skip confession');
        if (document.body.contains(popup)) document.body.removeChild(popup);
    };
    popup.appendChild(skipBtn);

    document.body.appendChild(popup);
}

function populateNightActionPlayersList(actionType) {
    console.log('populateNightActionPlayersList called with actionType:', actionType);
    console.log('currentRoomState:', currentRoomState);
    
    const playersList = document.getElementById('night-action-players-list');
    if (!playersList || !currentRoomState) {
        console.log('No players list element or no room state');
        return;
    }
    
    playersList.innerHTML = '';
    
    // Filter players based on action type
    let eligiblePlayers = [];
    if (actionType === 'witch') {
        // Witches can target any alive player who does NOT have Asylum
        eligiblePlayers = Object.values(currentRoomState.players).filter(player => player.alive && !(player.inPlayCards && player.inPlayCards.some(cardName => cardName === 'Asylum')));
    } else if (actionType === 'constable') {
        // Constables can target any player except themselves, and only alive
        eligiblePlayers = Object.values(currentRoomState.players).filter(player => player.uniqueId !== myUniqueId && player.alive);
    }
    
    console.log('Eligible players for night action:', eligiblePlayers.map(p => ({ name: p.name, uniqueId: p.uniqueId })));
    
    eligiblePlayers.forEach(player => {
        console.log(`Adding player ${player.name} to night action list`);
        
        const playerDiv = document.createElement('div');
        playerDiv.style.cssText = `
            background: #444;
            border: 2px solid #666;
            border-radius: 8px;
            padding: 15px;
            margin: 8px 0;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        playerDiv.innerHTML = `
            <div>
                <div style="font-weight: bold; color: #fff;">${player.name}</div>
                <div style="font-size: 0.9em; color: #ccc;">
                    การ์ด: ${player.handSize} | ชีวิต: ${player.tryalCardCount}
                </div>
            </div>
            <div style="color: #888;">คลิกเพื่อเลือก</div>
        `;
        
        playerDiv.addEventListener('click', () => {
            console.log(`Player ${player.name} clicked in night action popup`);
            
            // Remove previous selection
            playersList.querySelectorAll('div').forEach(p => {
                p.style.borderColor = '#666';
                p.style.background = '#444';
            });
            
            // Highlight selected player
            playerDiv.style.borderColor = '#ffd700';
            playerDiv.style.background = '#5a5a5a';
            playerDiv.style.boxShadow = '0 0 10px #ffd700';
            
            // Update state
            nightActionState.selectedTargetId = player.uniqueId;
            console.log('Updated nightActionState.selectedTargetId to:', player.uniqueId);
            
            // Show confirm button
            const confirmBtn = document.getElementById('confirm-night-action');
            if (confirmBtn) {
                confirmBtn.style.display = 'inline-block';
            }
        });
        
        playerDiv.addEventListener('mouseover', () => {
            if (nightActionState.selectedTargetId !== player.uniqueId) {
                playerDiv.style.borderColor = '#ff7f50';
                playerDiv.style.background = '#4a4a4a';
            }
        });
        
        playerDiv.addEventListener('mouseout', () => {
            if (nightActionState.selectedTargetId !== player.uniqueId) {
                playerDiv.style.borderColor = '#666';
                playerDiv.style.background = '#444';
            }
        });
        
        playersList.appendChild(playerDiv);
    });
    
    // Add confirm button event listener
    const confirmBtn = document.getElementById('confirm-night-action');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            console.log('Confirm button clicked');
            submitNightAction(actionType);
        });
    }
}

// --- พิธีเซ่นไหว้: เลือกไพ่ ชีวิต ของผู้เล่นซ้ายมือ ---
socket.on('prompt select left tryal', ({ leftPlayerUniqueId, leftPlayerName, leftPlayerTryalCount }) => {
    if (document.getElementById('select-left-tryal-popup')) return;
    const popup = document.createElement('div');
    popup.id = 'select-left-tryal-popup';
    popup.style = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;padding:30px;border-radius:10px;z-index:9999;text-align:center;box-shadow:0 0 20px #000;';

    const title = document.createElement('h3');
    title.textContent = `เลือก การ์ดชีวิต จากผู้เล่นซ้ายมือ: ${leftPlayerName}`;
    title.style.color = '#ffd700';
    popup.appendChild(title);

    if (leftPlayerTryalCount === 0) {
        const msg = document.createElement('div');
        msg.textContent = 'ผู้เล่นซ้ายมือไม่มีไพ่ ชีวิต ให้เลือก';
        msg.style.color = '#fff';
        popup.appendChild(msg);
        document.body.appendChild(popup);
        setTimeout(() => {
            if (document.body.contains(popup)) document.body.removeChild(popup);
        }, 2000);
        return;
    }

    const cardsDiv = document.createElement('div');
    cardsDiv.style.display = 'flex';
    cardsDiv.style.gap = '10px';
    cardsDiv.style.justifyContent = 'center';
    cardsDiv.style.margin = '20px 0';

    for (let i = 0; i < leftPlayerTryalCount; i++) {
        const btn = document.createElement('button');
        btn.textContent = `Card ${i + 1}`;
        btn.style = 'width:80px;height:120px;font-size:1.1em;background:#556B2F;color:#fff;border:2px solid #ffd700;border-radius:8px;cursor:pointer;';
        btn.onclick = () => {
            socket.emit('select left tryal', i);
            if (document.body.contains(popup)) document.body.removeChild(popup);
            // หลังเลือกแล้ว ให้ refresh tryal card display (ป้องกันไม่สลับ)
            setTimeout(() => { updateTryalCardDisplay(); }, 300);
        };
        cardsDiv.appendChild(btn);
    }
    popup.appendChild(cardsDiv);

    document.body.appendChild(popup);
});

// --- Curse: show blue card names in popup ---
function showCurseTargetSelection(targetUniqueId, blueCards) {
    const modal = document.createElement('div');
    modal.className = 'modal curse-target-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    const content = document.createElement('div');
    content.style.background = 'rgba(34,34,34,0.97)';
    content.style.color = '#fff';
    content.style.padding = '32px';
    content.style.borderRadius = '12px';
    content.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)';
    content.style.textAlign = 'center';

    const titleElem = document.createElement('h3');
    titleElem.textContent = 'เลือกการ์ดสีน้ำเงินที่จะทำลาย';
    titleElem.style.color = '#fff';
    titleElem.style.fontWeight = 'bold';
    titleElem.style.marginBottom = '18px';
    content.appendChild(titleElem);

    const cardList = document.createElement('div');
    cardList.style.display = 'flex';
    cardList.style.justifyContent = 'center';
    cardList.style.gap = '18px';
    cardList.style.flexWrap = 'wrap';

    blueCards.forEach((card, idx) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card blue-card';
        cardDiv.style.border = '2.5px solid #1565c0';
        cardDiv.style.background = 'linear-gradient(135deg, #1e1e5a 70%, #29b6f6 100%)';
        cardDiv.style.color = '#fff';
        cardDiv.style.fontWeight = 'bold';
        cardDiv.style.fontSize = '1.15em';
        cardDiv.style.textShadow = '1px 1px 4px #000a';
        cardDiv.style.padding = '12px';
        cardDiv.style.minWidth = '120px';
        cardDiv.style.minHeight = '160px';
        cardDiv.style.display = 'flex';
        cardDiv.style.alignItems = 'center';
        cardDiv.style.justifyContent = 'center';
        cardDiv.style.cursor = 'pointer';
        cardDiv.style.transition = 'transform 0.18s, border-color 0.18s';
        cardDiv.title = displayCardDescription(card.name);
        
        // แสดงรูปการ์ดแทนข้อความ
        const cardImage = createCardImage(card.name);
        cardImage.style.width = '100%';
        cardImage.style.height = '100%';
        cardImage.style.objectFit = 'cover';
        cardImage.style.borderRadius = '6px';
        cardDiv.appendChild(cardImage);
        
        cardDiv.addEventListener('mouseover', () => {
            cardDiv.style.transform = 'scale(1.08)';
            cardDiv.style.borderColor = '#ffd700';
        });
        cardDiv.addEventListener('mouseout', () => {
            cardDiv.style.transform = '';
            cardDiv.style.borderColor = '#1565c0';
        });
        cardDiv.addEventListener('click', () => {
            socket.emit('select curse target', targetUniqueId, idx);
            document.body.removeChild(modal);
        });
        cardList.appendChild(cardDiv);
    });
    content.appendChild(cardList);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.marginTop = '24px';
    cancelBtn.style.background = '#ff4500';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '1.1em';
    cancelBtn.style.padding = '10px 28px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    content.appendChild(cancelBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);
}

// --- Popup เลือกผู้เล่น (ใช้กับ Scapegoat/Robbery หรือเลือกเป้าหมายที่สอง) ---
function showSelectPlayerPopup(title, playerList, callback, cardObj = null, actionType = null) {
    const modal = document.createElement('div');
    modal.className = 'modal select-player-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    const content = document.createElement('div');
    content.style.background = 'rgba(34,34,34,0.97)'; // เปลี่ยนจาก #fff เป็นสีเข้มโปร่งแสง
    content.style.color = '#fff';
    content.style.padding = '32px';
    content.style.borderRadius = '12px';
    content.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)';
    content.style.textAlign = 'center';

    const titleElem = document.createElement('h3');
    titleElem.textContent = title;
    titleElem.style.color = '#fff';
    titleElem.style.fontWeight = 'bold';
    titleElem.style.marginBottom = '18px';
    content.appendChild(titleElem);

    const listDiv = document.createElement('div');
    listDiv.style.display = 'flex';
    listDiv.style.justifyContent = 'center';
    listDiv.style.gap = '18px';
    listDiv.style.flexWrap = 'wrap';

    // กรองเฉพาะผู้เล่นที่ alive
    let alivePlayers = playerList.filter(p => p.alive);
    // --- ห้ามเลือกตัวเองสำหรับการ์ดสีน้ำเงิน ---
    if (cardObj && cardObj.color === 'Blue') {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== myUniqueId);
    } else if (cardObj && ['Red','Green','Blue'].includes(cardObj.color)) {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== myUniqueId);
    }
    // --- เงื่อนไขเพิ่มเติมสำหรับหมอผี ---
    if (actionType === 'constable') {
        alivePlayers = alivePlayers.filter(p => !p.inPlayCards || !p.inPlayCards.some(card => card === 'Asylum' || card.name === 'Asylum'));
    }
    // --- เงื่อนไขเพิ่มเติมสำหรับแม่มด ---
    if (actionType === 'witch') {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== myUniqueId);
    }
    alivePlayers.forEach(player => {
        const btn = document.createElement('button');
        btn.textContent = player.name;
        btn.style.background = '#1976d2';
        btn.style.color = '#fff'; // บังคับให้ font เป็นสีขาว
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1.1em';
        btn.style.padding = '16px 28px';
        btn.style.borderRadius = '8px';
        btn.style.margin = '6px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => {
            document.body.removeChild(modal);
            callback(player.uniqueId);
        });
        listDiv.appendChild(btn);
    });

    content.appendChild(listDiv);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.marginTop = '24px';
    cancelBtn.style.background = '#ff4500';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '1.1em';
    cancelBtn.style.padding = '10px 28px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    content.appendChild(cancelBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);
}

// --- Room Management: Change Player Name ---
const roomPlayerNameInput = document.getElementById('room-player-name-input');
const roomSetNameButton = document.getElementById('room-set-name-button');

roomSetNameButton.addEventListener('click', () => {
    const newName = roomPlayerNameInput.value.trim();
    if (!newName) {
        addGameMessage('Please enter a valid name.', 'red', true);
        return;
    }
    myPlayerName = newName;
    localStorage.setItem('playerName', myPlayerName);
    playerNameDisplay.textContent = myPlayerName;
    nameInput.value = myPlayerName;
    socket.emit('set player name', myPlayerName);
    addGameMessage('Name updated successfully!', 'green', true);
});

// --- Card Name Localization ---
function displayCardName(name) {
    const map = {
        'Accusation': 'ข้อกล่าวหา',
        'Evidence': 'หลักฐาน',
        'Witness': 'พยาน',
        'Scapegoat': 'แพะรับบาป',
        'Curse': 'คำสาป',
        'Alibi': 'ข้อแก้ต่าง',
        'Robbery': 'ช่วงชิง',
        'Stocks': 'พันธนาการ',
        'Arson': 'วางเพลิง',
        'Black Cat': 'เครื่องเซ่น',
        'Asylum': 'ที่หลบภัย',
        'Piety': 'พลังศรัทธา',
        'Matchmaker': 'ผูกวิญญาณ',
        'Conspiracy': 'พิธีเซ่นไหว้',
        'Night': 'ยามวิกาล',
        'Witch': 'ปอบ',
        'Not A Witch': 'ชาวบ้าน',
        'Constable': 'หมอผี',
    };
    return map[name] || name;
}

// --- Card Description Localization ---
function displayCardDescription(name) {
    const map = {
        'Accusation': 'มี 1 ข้อกล่าวหา ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ',
        'Evidence': 'มี 3 ข้อกล่าวหา ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ',
        'Witness': 'มี 7 ข้อกล่าวหา ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ',
        'Scapegoat': 'ย้ายการ์ดสีน้ำเงิน, เขียว, แดงของผู้เล่นคนหนึ่ง ไปยังผู้เล่นอีกคนหนึ่ง',
        'Curse': 'ทำลายการ์ดสีน้ำเงิน 1 ใบ ที่อยู่หน้าผู้เล่นเป้าหมาย',
        'Alibi': 'ลบการ์ดข้อกล่าวหาออกจากผู้เล่นเป้าหมายได้สูงสุด 3 ใบ',
        'Robbery': 'ขโมยการ์ดบนมือทั้งหมดจากผู้เล่นคนหนึ่ง ไปให้ผู้เล่นอีกคนหนึ่ง',
        'Stocks': 'ผู้เล่นที่ถูกการ์ดนี้จะต้องข้ามตาของตัวเอง',
        'Arson': 'บังคับให้ผู้เล่นเป้าหมายทิ้งการ์ดบนมือทั้งหมด',
        'Black Cat': 'ผู้เล่นที่ถือการ์ดนี้จะต้องเริ่มเล่นเป็นคนแรก และหากมีผู้เล่นเปิดได้ "พิธีเซ่นไหว้" ผู้เล่นที่ถือ "เครื่องเซ่น" จะต้องเปิดการ์ดชีวิต 1 ใบ',
        'Asylum': 'ป้องกันการถูกสังหารในช่วง "ยามวิกาล"',
        'Piety': 'การ์ดข้อกล่าวหา (สีแดง) จะไม่มีผลกับผู้เล่นที่ถือการ์ดนี้',
        'Matchmaker': 'ผู้เล่น 2 คนที่ถือการ์ดนี้ หากคนใดคนหนึ่งตาย อีกคนต้องตายตาม',
        'Conspiracy': 'ผู้เล่นที่เปิดการ์ดนี้ ต้องเปิดการ์ดชีวิต 1 ใบของผู้เล่นที่มี "เครื่องเซ่น" จากนั้นจะเกิดเหตุการณ์ให้ผู้เล่นทุกคนหยิบการ์ดชีวิตจากผู้เล่นทางซ้ายมือ 1 ใบ (ช่วงที่ปอบแพร่เชื้อ)',
        'Night': 'ผู้ดำเนินเกมสั่งให้ทุกคนหลับตา "ปอบ" เลือกเหยื่อเพื่อสังหาร และ "หมอผี" เลือก 1 คนเพื่อปัดเป่าป้องกัน',
        'Witch': 'ผู้เล่นที่มีการ์ดนี้จะเป็น "ปอบ" ไปจนจบเกม แม้การ์ดจะถูกส่งต่อให้คนอื่นก็ตาม',
        'Not A Witch': 'เป็นชาวบ้านธรรมดา ไม่มีความสามารถพิเศษ',
        'Constable': 'สามารถปัดเป่าปกป้องผู้เล่นคนอื่นจากการถูกปอบสิงฆ่าในยามวิกาล',
    };
    return map[name] || '';
}

// ฟังก์ชันแสดงสถิติตอนจบเกม
function showGameOverStats(roomState) {
    // ลบ popup เดิมถ้ามี
    const oldPopup = document.getElementById('game-over-popup');
    if (oldPopup) oldPopup.remove();

    // สร้าง popup
    const popup = document.createElement('div');
    popup.id = 'game-over-popup';
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.background = '#222';
    popup.style.padding = '32px 24px';
    popup.style.borderRadius = '16px';
    popup.style.zIndex = 9999;
    popup.style.boxShadow = '0 0 32px #000a';
    popup.style.textAlign = 'center';
    popup.style.minWidth = '340px';
    popup.style.maxWidth = '95vw';
    popup.style.color = '#fff';

    // หัวข้อ
    let winnerIcon = roomState.winner === 'witches' || roomState.winner === 'Witches' ? '🧙‍♀️' : (roomState.winner === 'constables' || roomState.winner === 'Townsfolk' ? '🛡️' : '🤝');
    popup.innerHTML = `<h2 style="color:#ffd700;">${winnerIcon} เกมจบแล้ว!</h2><h3 style="margin-bottom:18px;">ผู้ชนะ: <span style="color:${roomState.winner === 'witches' || roomState.winner === 'Witches' ? '#ff1744' : (roomState.winner === 'constables' || roomState.winner === 'Townsfolk' ? '#43a047' : '#ffd700')};">${roomState.winner === 'witches' ? 'ทีมปอบ' : (roomState.winner === 'constables' || roomState.winner === 'Townsfolk' ? 'ทีมชาวบ้าน' : 'เสมอ')}</span></h3>`;

    // ตารางสถิติ
    let statTable = `<table style="width:100%;margin:0 auto 18px auto;border-collapse:collapse;font-size:1em;">
        <thead><tr style="background:#333;"><th>ชื่อ</th><th>สถานะ</th><th>ทีม</th><th>บทบาท</th><th>Tryal Card</th></tr></thead><tbody>`;
    const players = Object.values(roomState.players || {}).sort((a, b) => a.name.localeCompare(b.name));
    players.forEach(player => {
        const isAlive = player.alive;
        const team = player.isWitch || player.hasBeenWitch ? 'ปอบ' : (player.isConstable ? 'หมอผี' : 'ชาวบ้าน');
        const role = player.isWitch ? 'ปอบ' : (player.isConstable ? 'หมอผี' : 'ชาวบ้าน');
        const tryalCards = (player.tryalCards || []).map((card, idx) => {
            const revealed = player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.includes ? player.revealedTryalCardIndexes.includes(idx) : (player.revealedTryalCardIndexes && player.revealedTryalCardIndexes.has && player.revealedTryalCardIndexes.has(idx));
            return `<span style="display:inline-block;padding:2px 8px;margin:0 2px;border-radius:6px;background:${card.name==='Witch'?'#b71c1c':(card.name==='Constable'?'#1565c0':'#444')};color:#fff;font-weight:bold;opacity:${revealed?1:0.5};">${card.name==='Witch'?'ปอบ':(card.name==='Constable'?'หมอผี':'ชาวบ้าน')}</span>`;
        }).join('');
        statTable += `<tr style="background:${isAlive?'#263238':'#111'};"><td>${player.name}</td><td style="color:${isAlive?'#43a047':'#ff1744'};font-weight:bold;">${isAlive?'รอด':'ตาย'}</td><td>${team}</td><td>${role}</td><td>${tryalCards}</td></tr>`;
    });
    statTable += '</tbody></table>';
    popup.innerHTML += statTable;

    // ปุ่ม replay และกลับสู่ล็อบบี้
    const btnReplay = document.createElement('button');
    btnReplay.textContent = 'เล่นใหม่ (Replay)';
    btnReplay.style.margin = '0 10px 0 0';
    btnReplay.style.padding = '10px 22px';
    btnReplay.style.fontSize = '1.1em';
    btnReplay.style.background = '#1976d2';
    btnReplay.style.color = '#fff';
    btnReplay.style.border = 'none';
    btnReplay.style.borderRadius = '8px';
    btnReplay.style.cursor = 'pointer';
    btnReplay.onclick = () => { window.location.reload(); };

    const btnLobby = document.createElement('button');
    btnLobby.textContent = 'กลับสู่ล็อบบี้';
    btnLobby.style.padding = '10px 22px';
    btnLobby.style.fontSize = '1.1em';
    btnLobby.style.background = '#444';
    btnLobby.style.color = '#fff';
    btnLobby.style.border = 'none';
    btnLobby.style.borderRadius = '8px';
    btnLobby.style.cursor = 'pointer';
    btnLobby.onclick = () => { window.location.href = '/'; };

    popup.appendChild(btnReplay);
    popup.appendChild(btnLobby);

    document.body.appendChild(popup);
}

// ฟังก์ชันกลับไปหน้า Lobby
function returnToLobby() {
    // ลบ popup สถิติ
    const statsPopup = document.querySelector('.stats-popup');
    if (statsPopup) {
        statsPopup.remove();
    }
    
    // ออกจากห้องปัจจุบัน
    if (currentRoomName) {
        socket.emit('leave room');
    }
    
    // แสดงหน้า Lobby
    roomLobbySection.style.display = 'block';
    gameSection.style.display = 'none';
    
    // รีเซ็ตสถานะเกม
    currentRoomName = null;
    myPlayerName = null;
    isMyTurn = false;
    selectedCard = null;
    myCurrentHand = [];
    myTryalCards = [];
    myRevealedTryalCardIndexes = [];
    
    // ล้างข้อความเกม
    gameMessagesDiv.innerHTML = '';
    
    addGameMessage('กลับไปหน้า Lobby แล้ว', 'blue');
}

// ฟังก์ชันไปหน้าตั้งชื่อใหม่
function goToNameSetup() {
    // ลบ popup สถิติ
    const statsPopup = document.querySelector('.stats-popup');
    if (statsPopup) {
        statsPopup.remove();
    }
    
    // ออกจากห้องปัจจุบัน
    if (currentRoomName) {
        socket.emit('leave room');
    }
    
    // แสดงหน้าตั้งชื่อ
    roomManagementSection.style.display = 'block';
    roomLobbySection.style.display = 'none';
    gameSection.style.display = 'none';
    
    // รีเซ็ตชื่อผู้เล่น
    myPlayerName = null;
    nameInput.value = '';
    nameInputContainer.style.display = 'flex';
    
    // รีเซ็ตสถานะเกม
    currentRoomName = null;
    isMyTurn = false;
    selectedCard = null;
    myCurrentHand = [];
    myTryalCards = [];
    myRevealedTryalCardIndexes = [];
    
    // ล้างข้อความเกม
    gameMessagesDiv.innerHTML = '';
    
    addGameMessage('ไปหน้าตั้งชื่อใหม่แล้ว', 'blue');
}

// Card name mapping (EN->TH)
const cardNameMap = {
    'Accusation': 'ข้อกล่าวหา',
    'Evidence': 'หลักฐาน',
    'Witness': 'พยาน',
    'Scapegoat': 'แพะรับบาป',
    'Curse': 'คำสาป',
    'Alibi': 'ข้อแก้ต่าง',
    'Robbery': 'ช่วงชิง',
    'Stocks': 'พันธนาการ',
    'Arson': 'วางเพลิง',
    'Black Cat': 'เครื่องเซ่น',
    'Asylum': 'ที่หลบภัย',
    'Piety': 'พลังศรัทธา',
    'Matchmaker': 'ผูกวิญญาณ',
    'Conspiracy': 'พิธีเซ่นไหว้',
    'Night': 'ยามวิกาล',
    'Witch': 'ปอบ',
    'Not A Witch': 'ชาวบ้าน',
    'Constable': 'หมอผี',
};
function getCardNameTH(name) {
    return cardNameMap[name] || name;
}

// ฟังก์ชันแทนที่ชื่อการ์ดอังกฤษในข้อความเป็นไทย
function replaceCardNamesInMessage(message) {
    // เรียงลำดับชื่อการ์ดจากยาวไปสั้นเพื่อป้องกันการแทนที่ซ้อน
    const cardNames = Object.keys(cardNameMap).sort((a, b) => b.length - a.length);
    let result = message;
    cardNames.forEach(en => {
        // ใช้ regex แบบ whole word (\b) เพื่อไม่ให้แทนที่คำที่ซ้อนกัน
        const regex = new RegExp(`\\b${en}\\b`, 'g');
        result = result.replace(regex, cardNameMap[en]);
    });
    return result;
}

// --- Game Rules Modal Popup ---
document.addEventListener('DOMContentLoaded', function() {
  const showRulesBtn = document.getElementById('show-rules-btn');
  const rulesModal = document.getElementById('game-rules-modal');
  const closeRulesModal = document.getElementById('close-rules-modal');
  if (showRulesBtn && rulesModal && closeRulesModal) {
    showRulesBtn.onclick = function() {
      rulesModal.style.display = 'flex';
    };
    closeRulesModal.onclick = function() {
      rulesModal.style.display = 'none';
    };
    window.addEventListener('click', function(event) {
      if (event.target === rulesModal) {
        rulesModal.style.display = 'none';
      }
    });
  }
});

// --- Card Explain Modal Popup ---
document.addEventListener('DOMContentLoaded', function() {
  const showCardsBtn = document.getElementById('show-cards-btn');
  const cardsModal = document.getElementById('card-explain-modal');
  const closeCardsModal = document.getElementById('close-cards-modal');
  if (showCardsBtn && cardsModal && closeCardsModal) {
    showCardsBtn.onclick = function() {
      cardsModal.style.display = 'flex';
    };
    closeCardsModal.onclick = function() {
      cardsModal.style.display = 'none';
    };
    window.addEventListener('click', function(event) {
      if (event.target === cardsModal) {
        cardsModal.style.display = 'none';
      }
    });
  }
});