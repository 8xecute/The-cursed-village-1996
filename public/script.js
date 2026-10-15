// Function to generate a short UUID (Client-side implementation)
// Simplified short UUID generator for browser compatibility
function uuidv4() {
    return Math.random().toString(36).substring(2, 10);
}


const socket = io();

// --- Background Music Controls ---
const backgroundMusic = document.getElementById('background-music');
const toggleMusicBtn = document.getElementById('toggle-music-btn');
const musicIcon = document.getElementById('music-icon');
const musicVolumeSlider = document.getElementById('music-volume-slider');
const musicVolumeLabel = document.getElementById('music-volume-label');

let isMusicPlaying = false;
let currentVolume = 0.2; // Start at 20% volume
let hasUserStartedMusic = false; // เพิ่ม flag นี้
let userPausedMusic = false; // เพิ่ม flag นี้

function updateMusicUI() {
    if (isMusicPlaying) {
        musicIcon.textContent = '⏸️'; // แสดง pause icon เมื่อเล่นอยู่
    } else {
        musicIcon.textContent = '▶️'; // แสดง play icon เมื่อหยุด
    }
    musicVolumeLabel.textContent = `${Math.round(currentVolume * 100)}%`;
            musicVolumeSlider.value = Math.round(currentVolume * 100); // default to 20
}

toggleMusicBtn.addEventListener('click', () => {
    if (isMusicPlaying) {
        backgroundMusic.pause();
        isMusicPlaying = false;
        userPausedMusic = true; // ผู้ใช้ pause เอง
    } else {
        backgroundMusic.play().catch(()=>{});
        isMusicPlaying = true;
        userPausedMusic = false; // ผู้ใช้ play เอง
    }
    updateMusicUI();
});

// Slider event
musicVolumeSlider.addEventListener('input', (e) => {
    setMusicVolume(e.target.value / 100);
});

function setMusicVolume(vol) {
    // vol is 0.0-1.0 from UI
    const scaledVol = Math.max(0, Math.min(1, vol)) * 0.3;
    currentVolume = Math.max(0, Math.min(1, vol)); // for UI only
    backgroundMusic.volume = scaledVol;
    updateMusicUI();
}

// --- Play lobby music on page load ---
window.addEventListener('DOMContentLoaded', () => {
    // Set initial lobby music and try to play
    changePhaseMusic('LOBBY');
    
    // Try to play music (may be blocked by browser autoplay policy)
    backgroundMusic.play().then(() => {
        isMusicPlaying = true;
        hasUserStartedMusic = true;
        updateMusicUI();
    }).catch(() => {
        // Autoplay blocked, wait for user interaction
        isMusicPlaying = false;
        updateMusicUI();
    });
});

// --- Play lobby music on room creation ---
socket.on('room joined', (roomName) => {
    currentRoomName = roomName;
    currentRoomDisplay.textContent = roomName || 'ไม่มี';
    roomManagementSection.style.display = 'none';
    roomLobbySection.style.display = 'block';
    gameSection.style.display = 'none'; // Ensure game section is hidden initially
    leaveRoomButton.style.display = 'block';
    // ไม่ต้องสั่งเปิดเพลงหรือเปลี่ยน src ที่นี่อีก ปล่อยให้ระบบเพลงจัดการเองตามเฟส
    localStorage.removeItem('witchPopupAcknowledged'); // <-- Reset flag for new game
});

// --- Music for different game phases ---
const phaseMusic = {
    'LOBBY': 'audio/lobby-music.mp3',
    'DAY': 'audio/day-music.mp3', 
    'NIGHT': 'audio/night-music.mp3',
    'PRE_DAWN': 'audio/predawn-music.mp3',
    'GAME_OVER': 'audio/gameover-music.mp3'
};

let lastMusicPhase = null;

function changePhaseMusic(phase) {
    if (phase === lastMusicPhase) return;
    lastMusicPhase = phase;
    const musicFile = phaseMusic[phase];
    if (musicFile) {
        const isSameSrc = backgroundMusic.src && backgroundMusic.src.includes(musicFile);
        const isActuallyPlaying = !backgroundMusic.paused && !backgroundMusic.ended && backgroundMusic.currentTime > 0;
        if (!isSameSrc) {
            backgroundMusic.src = musicFile;
        }
        // เฟสที่ต้องบังคับเปิดเพลง
        if (["DAY", "NIGHT", "PRE_DAWN"].includes(phase)) {
            backgroundMusic.play().then(() => {
                isMusicPlaying = true;
                userPausedMusic = false;
                updateMusicUI();
            }).catch(()=>{});
        } else if (hasUserStartedMusic && !userPausedMusic) {
            if (!isActuallyPlaying) {
                backgroundMusic.play().then(() => {
                    isMusicPlaying = true;
                    updateMusicUI();
                }).catch(()=>{});
            }
        } else {
            isMusicPlaying = false;
            updateMusicUI();
        }
    }
}

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
const activeRoomsList = document.getElementById('active-rooms-list');
const leaveRoomButton = document.getElementById('leave-room-button');

const roomLobbySection = document.getElementById('room-lobby-section');
const lobbyRoomName = document.getElementById('lobby-room-name');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyMaxPlayers = document.getElementById('lobby-max-players');
const playerListDiv = document.getElementById('player-list');
const startGameButton = document.getElementById('start-game-button');
const readyToggleBtn = document.getElementById('ready-toggle-btn');
if (readyToggleBtn) {
    readyToggleBtn.addEventListener('click', () => {
        if (currentRoomName) {
            socket.emit('toggle ready', currentRoomName);
        }
    });
}
const hostControlsLobby = document.getElementById('host-controls-lobby');
const forceNextPhaseButton = document.getElementById('force-next-phase-button');
const shareRoomLinkBtn = document.getElementById('share-room-link-btn');
const copyRoomLinkHeaderBtn = document.getElementById('copy-room-link-header-btn');
const shareLinkToast = document.getElementById('share-link-toast');
const invitedRoomBanner = document.getElementById('invited-room-banner');
const invitedRoomName = document.getElementById('invited-room-name');


const gameSection = document.getElementById('game-section');
const currentPhaseDisplay = document.getElementById('current-phase-display');
const dayNumberDisplay = document.getElementById('day-number-display');
const currentTurnPlayerDisplay = document.getElementById('current-turn-player-display');
const deckCountDisplay = document.getElementById('deck-count-display');
const discardPileCountDisplay = document.getElementById('discard-pile-count-display');
const waitingStatusBanner = document.getElementById('waiting-status-banner');
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

// Mobile Game View Tabs
const mobileGameTabs = document.getElementById('mobile-game-tabs');
const mobileTabHandBtn = document.getElementById('mobile-tab-hand-btn');
const mobileTabPlayersBtn = document.getElementById('mobile-tab-players-btn');
const mobileTabChatBtn = document.getElementById('mobile-tab-chat-btn');
const tabTurnBadge = document.getElementById('tab-turn-badge');
const tabPlayerCountBadge = document.getElementById('tab-player-count-badge');
const tabChatBadge = document.getElementById('tab-chat-badge');
let currentMobileGameTab = 'hand';

function switchMobileGameTab(tabName) {
    currentMobileGameTab = tabName;
    document.body.setAttribute('data-mobile-game-tab', tabName);
    
    if (mobileTabHandBtn) mobileTabHandBtn.classList.toggle('active', tabName === 'hand');
    if (mobileTabPlayersBtn) mobileTabPlayersBtn.classList.toggle('active', tabName === 'players');
    if (mobileTabChatBtn) mobileTabChatBtn.classList.toggle('active', tabName === 'chat');

    if (tabName === 'chat' && tabChatBadge) {
        tabChatBadge.style.display = 'none';
    }
}

if (mobileTabHandBtn) {
    mobileTabHandBtn.addEventListener('click', () => switchMobileGameTab('hand'));
}
if (mobileTabPlayersBtn) {
    mobileTabPlayersBtn.addEventListener('click', () => switchMobileGameTab('players'));
}
if (mobileTabChatBtn) {
    mobileTabChatBtn.addEventListener('click', () => switchMobileGameTab('chat'));
}

// --- Game State Variables (Client-side) ---
let myUniqueId = localStorage.getItem('uniqueId');
let myPlayerName = localStorage.getItem('playerName'); // Load name from local storage
let currentRoomName = (function() { try { return sessionStorage.getItem('currentRoomName'); } catch(e) { return null; } })();
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
let deathNotified = false;

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

// Set default music volume to 50% (UI), which is 0.35 real volume
musicVolumeSlider.value = 50;
setMusicVolume(0.5);

// Check for room invitation in URL (?room=...)
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room') ? urlParams.get('room').trim() : null;

if (roomFromUrl) {
    if (joinRoomNameInput) {
        joinRoomNameInput.value = roomFromUrl;
    }
    if (invitedRoomBanner && invitedRoomName) {
        invitedRoomName.textContent = roomFromUrl;
        invitedRoomBanner.style.display = 'block';
    }
}

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
    } else if (roomFromUrl && myPlayerName) {
        // Automatically join room from invite URL if player already has a name
        socket.emit('join room', roomFromUrl, myPlayerName);
    } else {
        // Otherwise, request active rooms to display in lobby
        socket.emit('request rooms list');
    }
});

socket.on('active rooms list', (rooms) => {
    console.log('Active rooms:', rooms);
    renderActiveRooms(rooms || []);
});

socket.on('room joined', (roomName) => {
    currentRoomName = roomName;
    try { sessionStorage.setItem('currentRoomName', roomName); } catch (e) {}
    currentRoomDisplay.textContent = roomName || 'ไม่มี';
    roomManagementSection.style.display = 'none';
    roomLobbySection.style.display = 'block';
    gameSection.style.display = 'none'; // Ensure game section is hidden initially
    leaveRoomButton.style.display = 'block';
    if (copyRoomLinkHeaderBtn) copyRoomLinkHeaderBtn.style.display = 'inline-block';
    if (invitedRoomBanner) invitedRoomBanner.style.display = 'none';

    // Update browser URL query parameter with room name
    try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('room') !== roomName) {
            currentUrl.searchParams.set('room', roomName);
            window.history.replaceState({}, '', currentUrl);
        }
    } catch (e) {
        console.error('Failed to update URL:', e);
    }

    // ไม่ต้องสั่งเปิดเพลงหรือเปลี่ยน src ที่นี่อีก ปล่อยให้ระบบเพลงจัดการเองตามเฟส
    localStorage.removeItem('witchPopupAcknowledged'); // <-- Reset flag for new game
});

socket.on('room state update', (roomState) => {
    console.log('Room state updated:', roomState);
    currentRoomState = roomState; // Store room state for night actions
    updateTryalCardDisplay(); // Always update tryal card display on room state update
    
    // Change background music based on game phase
    if (roomState.currentPhase) {
        changePhaseMusic(roomState.currentPhase);
    }
    // Update lobby/game UI based on roomState
    lobbyRoomName.textContent = roomState.name;
    lobbyPlayerCount.textContent = roomState.playerCount;
    lobbyMaxPlayers.textContent = roomState.maxPlayers;
    playerListDiv.innerHTML = '';
    let isHost = false;
    let myPlayer = null;
    const playersInOrder = Object.values(roomState.players).sort((a, b) => a.name.localeCompare(b.name));

    // Populate player list and check host status
    playersInOrder.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-item ${player.alive ? 'alive' : 'dead'} ${roomState.currentTurnPlayerUniqueId === player.uniqueId ? 'current-turn' : ''}`;
        playerDiv.dataset.uniqueId = player.uniqueId; // Store uniqueId for night actions
        let html = `<span class="player-name-status">${player.name}`;
        // เพิ่ม tag (ทีมปอบ) เฉพาะฝั่งปอบเห็น
        if (myPlayer && myPlayer.hasBeenWitch && player.hasBeenWitch) {
            html += ' <span style="color:#ff1744;font-size:0.95em;font-weight:bold;">(ทีมปอบ)</span>';
        }
        html += ` ${player.isHost ? '(Host)' : ''} ${player.isBlackCatHolder ? ' (เครื่องเซ่น)' : ''}`;
        if (!player.alive) {
            html += ' <span class="player-dead-badge-sm">💀 เสียชีวิตแล้ว</span>';
        }
        if (!roomState.gameStarted) {
            if (player.isHost) {
                html += ' <span class="ready-badge host">👑 หัวห้อง</span>';
            } else if (player.isReady) {
                html += ' <span class="ready-badge ready">✅ พร้อม</span>';
            } else {
                html += ' <span class="ready-badge not-ready">⏳ รอพร้อม</span>';
            }
        }
        html += '</span>';
        if (roomState.gameStarted) {
            html += `<span class="player-stats">การ์ด: ${player.handSize} | ชีวิต: ${player.tryalCardCount} | ข้อกล่าวหา: ${player.accusationPoints}</span>`;
        }
        // --- Show Red Card Status Effects (Accusation/Evidence/Witness) ---
        if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
            const redEffectCards = player.inPlayCards.filter(c => c && typeof c === 'object' && c.color === 'Red');
            if (redEffectCards.length > 0) {
                html += '<div class="sidebar-red-effects" style="margin-top:2px; display:flex; flex-wrap:wrap; gap:4px;">';
                redEffectCards.forEach((cardObj, idx) => {
                    let value = cardObj.value || 1;
                    let cardName = displayCardName(cardObj.name);
                    let badge = `<span class='effect-card card-theme card-red' data-effect='${cardName}' style="padding:1.5px 8px 1.5px 8px;margin:0 4px 2px 0;border-radius:7px;font-size:0.93em;vertical-align:middle;display:inline-flex;align-items:center;gap:2px;">` +
                        `${cardName} <span style=\"color:#fff;background:#b71c1c;padding:0.5px 5px;border-radius:5px;margin-left:2px;font-size:0.95em;\">+${value}</span>` +
                        `</span>`;
                    html += badge;
                });
                html += '</div>';
            }
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

    // Update Ready toggle button for non-hosts
    if (readyToggleBtn) {
        if (!roomState.gameStarted && !isHost) {
            readyToggleBtn.style.display = 'inline-flex';
            const me = roomState.players[myUniqueId];
            if (me && me.isReady) {
                readyToggleBtn.className = 'ready-btn ready';
                readyToggleBtn.innerHTML = '<span class="ready-btn-icon">✅</span> <span class="ready-btn-text">พร้อมแล้ว (กดเพื่อยกเลิก)</span>';
            } else {
                readyToggleBtn.className = 'ready-btn not-ready';
                readyToggleBtn.innerHTML = '<span class="ready-btn-icon">⏳</span> <span class="ready-btn-text">กดพร้อม (Ready)</span>';
            }
        } else {
            readyToggleBtn.style.display = 'none';
        }
    }

    // Host controls visibility
    if (isHost) {
        hostControlsLobby.style.display = 'block';
        startGameButton.style.display = roomState.gameStarted ? 'none' : 'inline-block';
        if (!roomState.gameStarted) {
            const nonHostPlayers = Object.values(roomState.players).filter(p => !p.isHost);
            const readyCount = nonHostPlayers.filter(p => p.isReady).length;
            if (nonHostPlayers.length > 0) {
                startGameButton.textContent = `เริ่มเกม (${readyCount}/${nonHostPlayers.length} พร้อม)`;
            } else {
                startGameButton.textContent = 'เริ่มเกม';
            }
        }
        // Make the game-specific host controls visible if the game has started
        if (roomState.gameStarted) {
            hostControlsGame.style.display = 'block';
        } else {
            hostControlsGame.style.display = 'none';
        }
    } else {
        hostControlsLobby.style.display = 'none';
        hostControlsGame.style.display = 'none';
        startGameButton.style.display = 'none';
    }

    // Game state updates
    if (roomState.gameStarted) {
        document.body.classList.add('in-game');
        roomLobbySection.style.display = 'none';

        // If phase is not NIGHT, ensure night action UI is hidden/reset
        if (roomState.currentPhase !== 'NIGHT') {
            disableNightTargetSelection();
        }

        gameSection.style.display = 'block';

        currentPhaseDisplay.textContent = getPhaseNameTH(roomState.currentPhase);
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

        // Update mobile tabs badges & auto-switch
        if (tabTurnBadge) {
            tabTurnBadge.style.display = isMyTurn ? 'inline-block' : 'none';
        }
        if (tabPlayerCountBadge && roomState.players) {
            const count = Object.keys(roomState.players).length;
            tabPlayerCountBadge.textContent = `(${count})`;
        }
        if (isMyTurn && window.innerWidth <= 768 && currentMobileGameTab !== 'hand') {
            switchMobileGameTab('hand');
        }

        // Show waiting status for global card selection flow
        if (waitingStatusBanner) {
            if (roomState.awaitingLeftTryalSelections) {
                waitingStatusBanner.style.display = 'block';
                waitingStatusBanner.textContent = `กำลังรอผู้เล่นเลือกการ์ดชีวิต ${roomState.leftTryalSelectedCount || 0}/${roomState.leftTryalTotalCount || 0}`;
            } else {
                waitingStatusBanner.style.display = 'none';
                waitingStatusBanner.textContent = '';
            }
        }

        // --- Spectator handling ---
        isSpectatorMode = !!roomState.isSpectator;
        updateSpectatorUI(isSpectatorMode);

        // --- NEW: Disable all controls if player is dead ---
        if (myPlayer && !myPlayer.alive) {
            if (!deathNotified) {
                addGameMessage('💀 คุณตายแล้ว! คุณจะไม่สามารถทำแอ็กชันใดๆ ได้อีก', 'red', true);
                deathNotified = true;
                showDeathNoticeModal();
            }
            if (typeof drawCardButton !== 'undefined' && drawCardButton) drawCardButton.disabled = true;
            if (typeof playCardButton !== 'undefined' && playCardButton) playCardButton.disabled = true;
            if (typeof endTurnButton !== 'undefined' && endTurnButton) endTurnButton.disabled = true;
            if (typeof confessButton !== 'undefined' && confessButton) confessButton.disabled = true;
            if (typeof skipConfessButton !== 'undefined' && skipConfessButton) skipConfessButton.disabled = true;
            // Hide/disable night action section
            var nightActionSection = document.getElementById('night-action-section');
            if (nightActionSection) nightActionSection.style.display = 'none';
            // Hide/disable witch action section
            if (typeof witchActionSection !== 'undefined' && witchActionSection) witchActionSection.style.display = 'none';
            // Hide/disable game actions
            if (typeof gameActionsDiv !== 'undefined' && gameActionsDiv) gameActionsDiv.style.display = 'none';
            // --- ปิด witch chat input/button ---
            if (typeof witchChatInput !== 'undefined' && witchChatInput) witchChatInput.disabled = true;
            if (typeof witchChatSendButton !== 'undefined' && witchChatSendButton) witchChatSendButton.disabled = true;
            if (typeof witchChatInput !== 'undefined' && witchChatInput) witchChatInput.placeholder = 'คุณตายแล้ว ไม่สามารถส่งข้อความได้';
        }
        if (myPlayer && myPlayer.alive) {
            deathNotified = false;
        }

        // --- NEW: Disable all controls if awaitingLeftTryalSelections (พิธีเซ่นไหว้) ---
        if (roomState.awaitingLeftTryalSelections) {
            if (typeof drawCardButton !== 'undefined' && drawCardButton) drawCardButton.disabled = true;
            if (typeof playCardButton !== 'undefined' && playCardButton) playCardButton.disabled = true;
            if (typeof endTurnButton !== 'undefined' && endTurnButton) endTurnButton.disabled = true;
        }

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
            (!roomState.confessionActions || !roomState.confessionActions.includes(myUniqueId)) &&
            (!roomState.nightConfessors || !roomState.nightConfessors.includes(myUniqueId)) &&
            roomState.confessionOrder &&
            roomState.confessionOrder[roomState.currentConfessionIndex] === myUniqueId &&
            !confessPopupShownForThisPreDawn
        ) {
            // ตรวจสอบว่าผู้เล่นได้รับการปกป้องจากหมอผีหรือมีการ์ด Asylum หรือไม่
            const isProtectedByConstable = roomState.playersWhoActedAtNight && 
                roomState.playersWhoActedAtNight['constableSave'] === myUniqueId;
            const hasAsylum = myPlayer.inPlayCards && 
                myPlayer.inPlayCards.some(card => card.name === 'Asylum');
            
            if (isProtectedByConstable || hasAsylum) {
                // ข้ามการสารภาพอัตโนมัติ
                socket.emit('skip confession');
                confessPopupShownForThisPreDawn = true;
                if (isProtectedByConstable) {
                    addGameMessage('คุณได้รับการปกป้องจากหมอผี ข้ามการสารภาพ', 'green', true);
                } else if (hasAsylum) {
                    addGameMessage('คุณมีการ์ดที่หลบภัย ข้ามการสารภาพ', 'green', true);
                }
            } else {
                if (myTryalCards && myTryalCards.length > 0) {
                    showConfessPopup(myTryalCards);
                    confessPopupShownForThisPreDawn = true;
                }
            }
        } else if (roomState.currentPhase === 'DAY' && myPlayer && myPlayer.alive && roomState.playerForcedToRevealTryal === myUniqueId) {
            // ซ่อน confess section เมื่อถูกบังคับเปิดการ์ดชีวิต
            confessSection.style.display = 'none';
        } else {
            confessSection.style.display = 'none';
        }

        // Show/hide Witch action section for Black Cat assignment
        if (roomState.isAssigningBlackCat && myPlayer && (myPlayer.isWitch || myPlayer.hasBeenWitch)) {
            witchActionSection.style.display = 'block';
            if (!document.getElementById('assign-blackcat-popup')) {
                const aliveList = Object.values(roomState.players || {}).filter(p => p.alive);
                showAssignBlackCatPopup(aliveList);
            }
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
            document.body.classList.remove('in-game');
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
    updateWitchChatTeamList();

    // --- Hide overlay on room state update if not in LOBBY phase ---
    if (window.hideMusicOverlayIfNeeded) {
        window.hideMusicOverlayIfNeeded(roomState.currentPhase);
    }
    // --- ปิด popup เลือกฆ่า/วางแมวดำถ้าคนอื่นเลือกไปแล้ว ---
    // ปิด popup เลือกฆ่า (night-action-popup) ถ้า phase ไม่ใช่ NIGHT
    if (roomState.currentPhase !== 'NIGHT') {
        removeNightActionPopup();
    }
    // ปิด popup เลือกวางแมวดำ (assign-blackcat-popup) ถ้าไม่ได้อยู่ในสถานะ assign แล้ว
    if (document.getElementById('assign-blackcat-popup') && !roomState.isAssigningBlackCat) {
        document.getElementById('assign-blackcat-popup').remove();
    }
    // --- ปิด popup เลือกการ์ดชีวิตพิธีเซ่นไหว้ ถ้า phase ไม่ใช่ BLACKCAT_TRYAL หรือผู้เล่นตาย ---
    const blackcatTryalPopup = document.getElementById('blackcat-tryal-select-popup');
    if (blackcatTryalPopup && (roomState.currentPhase !== 'BLACKCAT_TRYAL' || (myPlayer && !myPlayer.alive))) {
        blackcatTryalPopup.remove();
    }
});

socket.on('game message', (message, color = 'black', bold = false) => {
    addGameMessage(message, color, bold);
    // ปิด popup เลือกเป้าหมายปอบถ้าได้รับแจ้งเตือนทีมปอบเลือกเป้าหมายแล้ว
    if (message.startsWith('คืนนี้ทีมปอบ:')) {
        disableNightTargetSelection();
        // แสดงใน witch chat ด้วย
        addWitchChatMessage('SYSTEM', message, Date.now());
    }
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
    // Clear player board and player list
    const playersBoardList = document.getElementById('players-board-list');
    if (playersBoardList) playersBoardList.innerHTML = '';
    const nightPlayersList = document.getElementById('night-players-list');
    if (nightPlayersList) nightPlayersList.innerHTML = '';
    // Hide all game/lobby sections except room management
    document.body.classList.remove('in-game');
    switchMobileGameTab('hand');
    if (tabTurnBadge) tabTurnBadge.style.display = 'none';
    if (tabChatBadge) tabChatBadge.style.display = 'none';
    roomManagementSection.style.display = 'block';
    roomLobbySection.style.display = 'none';
    gameSection.style.display = 'none';
    leaveRoomButton.style.display = 'none';
    if (copyRoomLinkHeaderBtn) copyRoomLinkHeaderBtn.style.display = 'none';
    try {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('room');
        window.history.replaceState({}, '', currentUrl);
    } catch (e) {
        console.error('Failed to clear URL param:', e);
    }
    // Reset game state variables
    currentRoomName = null;
    try { sessionStorage.removeItem('currentRoomName'); } catch (e) {}
    currentRoomState = null;
    myCurrentHand = [];
    myTryalCards = [];
    myRevealedTryalCardIndexes = [];
    selectedCard = null;
    isMyTurn = false;
    hasPlayedCardsThisTurn = false;
    drawButtonDisabled = false;
    // Hide/clear other UI as needed
    updateHandDisplay([]);
    updateTryalCardDisplay();
    updatePlayersGrid(null, myUniqueId);
    updateWitchChatVisibility(false);
    confessSection.style.display = 'none';
    // Show name input if not set
    if (!myPlayerName) {
        nameInputContainer.style.display = 'flex';
    }
    socket.emit('request rooms list');
    addGameMessage('คุณออกจากห้องแล้ว.', 'orange');
});

function renderActiveRooms(rooms) {
    if (!activeRoomsList) return;
    activeRoomsList.innerHTML = '';

    if (!rooms || rooms.length === 0) {
        activeRoomsList.innerHTML = '<div class="room-list-empty">ยังไม่มีห้องที่เปิดอยู่</div>';
        return;
    }

    rooms.forEach((room) => {
        const roomRow = document.createElement('div');
        roomRow.className = 'active-room-item';

        const info = document.createElement('div');
        info.className = 'active-room-info';
        info.innerHTML = `<div class="active-room-name">${room.name}</div><div class="active-room-meta">โฮสต์: ${room.hostName} | ผู้เล่น ${room.playerCount}/${room.maxPlayers}</div>`;

        const joinBtn = document.createElement('button');
        joinBtn.className = 'active-room-join-btn';
        joinBtn.textContent = 'เข้าร่วม';
        joinBtn.disabled = !myPlayerName || room.playerCount >= room.maxPlayers;
        joinBtn.addEventListener('click', () => {
            if (!myPlayerName) {
                addGameMessage('โปรดตั้งชื่อก่อนเข้าร่วมห้อง.', 'red');
                return;
            }
            socket.emit('join room', room.name, myPlayerName);
        });

        roomRow.appendChild(info);
        roomRow.appendChild(joinBtn);
        activeRoomsList.appendChild(roomRow);
    });
}

socket.on('your turn', () => {
    isMyTurn = true;
    hasPlayedCardsThisTurn = false;
    hasDrawnCardThisTurn = false;
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
    if (isMyTurn && !hasDrawnCardThisTurn && hand.length > myCurrentHand.length) {
        hasDrawnCardThisTurn = true;
        updateTurnUI();
    }
});

// --- Track previous tryal cards for Witch popup detection ---
let prevTryalCards = [];

// Reset Witch popup flag at the start of each game
socket.on('room joined', (roomName) => {
    // ... existing code ...
    localStorage.removeItem('witchPopupAcknowledged'); // <-- Reset flag for new game
});

// Show Witch popup when receiving Witch card for the first time (not during Black Cat assignment)
socket.on('update tryal cards initial', (tryalCards, fromName) => {
    const prevHadWitch = prevTryalCards.some(card => card.name === 'Witch');
    const newHasWitch = tryalCards.some(card => card.name === 'Witch');
    const myPlayer = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    const isAssigningBlackCat = currentRoomState && currentRoomState.isAssigningBlackCat;
    if (!prevHadWitch && newHasWitch && myPlayer && myPlayer.hasBeenWitch && !isAssigningBlackCat) {
        showWitchPopup(fromName || '...');
    }
    prevTryalCards = tryalCards.slice();
    myTryalCards = tryalCards;
    updateTryalCardDisplay();
    if (myPlayer) updateWitchChatVisibility(myPlayer.hasBeenWitch);

    // If reconnected during PRE_DAWN confession turn, restore popup if not already showing
    if (
        currentRoomState &&
        currentRoomState.currentPhase === 'PRE_DAWN' &&
        myPlayer && myPlayer.alive &&
        (!currentRoomState.confessionActions || !currentRoomState.confessionActions.includes(myUniqueId)) &&
        (!currentRoomState.nightConfessors || !currentRoomState.nightConfessors.includes(myUniqueId)) &&
        currentRoomState.confessionOrder &&
        currentRoomState.confessionOrder[currentRoomState.currentConfessionIndex] === myUniqueId &&
        myTryalCards && myTryalCards.length > 0 &&
        !document.getElementById('confess-popup')
    ) {
        const isProtectedByConstable = currentRoomState.playersWhoActedAtNight && 
            currentRoomState.playersWhoActedAtNight['constableSave'] === myUniqueId;
        const hasAsylum = myPlayer.inPlayCards && 
            myPlayer.inPlayCards.some(card => card.name === 'Asylum');
        if (!isProtectedByConstable && !hasAsylum) {
            showConfessPopup(myTryalCards);
            confessPopupShownForThisPreDawn = true;
        }
    }
});

// เพิ่ม listener สำหรับ popup ปอบทุกครั้งที่ได้รับการ์ดแม่มดจากคนอื่น
socket.on('show witch popup', (data) => {
    showWitchPopup(data.senderName || '...');
});

socket.on('update revealed tryal indexes', (revealedIndexes) => {
    myRevealedTryalCardIndexes = revealedIndexes;
    updateTryalCardDisplay();
});

socket.on('update in play cards', (inPlayCards) => {
    console.log('In-play cards updated:', inPlayCards);
    if (currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId]) {
        currentRoomState.players[myUniqueId].inPlayCards = inPlayCards;
        updatePlayersGrid(currentRoomState, myUniqueId, nightActionState.actionType);
        updatePlayersBoardGrid(currentRoomState, myUniqueId);
    }
});

socket.on('prompt witch kill', () => {
    nightActionState.hasSubmitted = false;
    createNightActionPopup('witch');
});

socket.on('prompt constable action', () => {
    nightActionState.hasSubmitted = false;
    nightActionState.selectedTargetId = null;
    createNightActionPopup('constable');
});

socket.on('deck info update', (deckInfo) => {
    console.log('[DEBUG] deck info update:', deckInfo);
    deckCountDisplay.textContent = deckInfo.deckCount;
    discardPileCountDisplay.textContent = deckInfo.discardPileCount;
});

// Witch chat socket events
socket.on('witch chat message', (senderName, message, timestamp) => {
    addWitchChatMessage(senderName, message, timestamp);
});

// Witch chat history (do NOT clear on phase change)
socket.on('witch chat history', (messages) => {
    // ลบข้อความเก่าก่อน append ใหม่
    witchChatMessages.innerHTML = '';
    messages.forEach(msg => {
        addWitchChatMessage(msg.senderName, msg.message, msg.timestamp);
    });
});

function addWitchChatMessage(senderName, message, timestamp) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'witch-chat-message';
    if (senderName === 'SYSTEM') {
        msgDiv.style.color = '#ff1744';
        msgDiv.style.fontWeight = 'bold';
        msgDiv.innerHTML = `<span style='color:#ff1744;font-weight:bold;'>SYSTEM</span><br>${message}<br><span style='font-size:0.85em;color:#fff;'>${formatTime(timestamp)}</span>`;
    } else {
        msgDiv.innerHTML = `<span class='sender'>${senderName}</span>: <span class='message'>${message}</span><br><span class='timestamp'>${formatTime(timestamp)}</span>`;
    }
    if (witchChatMessages) {
        witchChatMessages.appendChild(msgDiv);
        witchChatMessages.scrollTop = witchChatMessages.scrollHeight;
    }
    const modalChatMessages = document.getElementById('modal-witch-chat-messages');
    if (modalChatMessages) {
        const modalMsg = msgDiv.cloneNode(true);
        modalChatMessages.appendChild(modalMsg);
        modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
    }
    if (currentMobileGameTab !== 'chat' && tabChatBadge) {
        tabChatBadge.style.display = 'inline-block';
    }
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function sendWitchChatMessage() {
    const message = witchChatInput.value.trim();
    if (message && currentRoomName) {
        if (!currentRoomState || currentRoomState.currentPhase !== 'NIGHT') {
            addGameMessage('แชทปอบใช้งานได้เฉพาะช่วงกลางคืนเท่านั้น', 'orange');
            return;
        }
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
    const myPlayer = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    const isNight = currentRoomState && currentRoomState.currentPhase === 'NIGHT';
    if (isWitch && currentRoomName && isNight) {
        witchChatSection.style.display = 'block';
        socket.emit('request witch chat history', currentRoomName);
        // ปรับปุ่มส่งข้อความและ input: ปล่อยให้ใช้งานได้เฉพาะถ้ายังมีชีวิต
        if (myPlayer && myPlayer.alive) {
        witchChatInput.disabled = false;
        witchChatSendButton.disabled = false;
        witchChatInput.placeholder = '';
        } else {
            witchChatInput.disabled = true;
            witchChatSendButton.disabled = true;
            witchChatInput.placeholder = 'คุณตายแล้ว ไม่สามารถส่งข้อความได้';
        }
    } else {
        witchChatSection.style.display = 'none';
    }
}

// --- Accused Tryal Card Selection Popup ---
let accusedTryalSelection = null;

function showAccusedTryalSelection(accusedUniqueId, tryalCount) {
    // Remove any existing popups to prevent overlapping
    const existing = document.getElementById('accused-tryal-select-popup');
    if (existing) existing.remove();
    const existingOverlay = document.getElementById('accused-tryal-select-overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingPopup = document.getElementById('accused-tryal-select-popup');
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.id = 'accused-tryal-select-overlay';
    overlay.className = 'tryal-modal-overlay';

    const container = document.createElement('div');
    container.id = 'accused-tryal-select-popup';
    container.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = '⚖️ เลือกการ์ดชีวิตของผู้ถูกกล่าวหาเพื่อเปิดเผย';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'เลือกการ์ดชีวิต 1 ใบเพื่อทำการเปิดโปงความจริงต่อหน้าชาวบ้าน';
    subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
    container.appendChild(subtitle);

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.className = 'tryal-card-btn';
        cardBtn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i+1}</span>`;
        cardBtn.onclick = () => {
            socket.emit('select tryal card for confession', accusedUniqueId, i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (container && container.parentNode) container.parentNode.removeChild(container);
        };
        cardsDiv.appendChild(cardBtn);
    }
    container.appendChild(cardsDiv);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
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

socket.on('forced reveal notice', ({ byPlayerName, reason, points }) => {
    const old = document.getElementById('forced-reveal-notice-popup');
    if (old) old.remove();
    const oldOverlay = document.getElementById('forced-reveal-notice-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'forced-reveal-notice-overlay';
    overlay.className = 'tryal-modal-overlay';

    const popup = document.createElement('div');
    popup.id = 'forced-reveal-notice-popup';
    popup.className = 'tryal-selection-popup';

    const detail = reason === 'witness_card'
        ? 'คุณถูกใช้การ์ดพยาน และกำลังจะถูกเปิดการ์ดชีวิต!'
        : `คุณมีข้อกล่าวหาสะสมครบ ${points || 0} แต้ม และกำลังจะถูกเปิดการ์ดชีวิต!`;

    popup.innerHTML = `
        <div style="font-family:'Creepster','Noto Serif Thai',serif;font-size:1.4em;font-weight:bold;margin-bottom:12px;color:#ff8a80;text-shadow:0 0 12px rgba(255,82,82,0.5);">⚠️ คุณกำลังถูกบังคับเปิดการ์ดชีวิต!</div>
        <div style="margin-bottom:10px;color:#ffccbc;">ผู้ที่ทำให้เกิดเหตุการณ์: <b style="color:#fff;">${byPlayerName || 'ไม่ทราบชื่อ'}</b></div>
        <div style="margin-bottom:16px;color:#cfd8dc;font-size:1em;">${detail}</div>
    `;

    const okBtn = document.createElement('button');
    okBtn.className = 'tryal-popup-action-btn action-btn';
    okBtn.textContent = 'รับทราบ';
    okBtn.onclick = () => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    };
    popup.appendChild(okBtn);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
});

// --- Black Cat Tryal Card Selection Popup (สำหรับ พิธีเซ่นไหว้) ---
let blackCatTryalSelection = null;

function showBlackCatTryalSelection(blackCatHolder, tryalCount, fromConspiracyDraw = false) {
    // Remove any existing popups to prevent overlapping
    const old = document.getElementById('blackcat-tryal-select-popup');
    if (old) old.remove();
    const existing = document.getElementById('select-blackcat-tryal-popup');
    if (existing) existing.remove();
    const oldOverlay = document.getElementById('blackcat-tryal-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'blackcat-tryal-overlay';
    overlay.className = 'tryal-modal-overlay';

    const container = document.createElement('div');
    container.id = 'blackcat-tryal-select-popup';
    container.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = fromConspiracyDraw
        ? '🕯️ การ์ดพิธีเซ่นไหว้: ต้องเปิดการ์ดชีวิตของผู้ถือเครื่องเซ่น'
        : '🐱 เลือกการ์ดชีวิตของผู้ถือการ์ดเครื่องเซ่นเพื่อเปิดเผย';
    container.appendChild(title);

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.className = 'tryal-card-btn';
        cardBtn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i+1}</span>`;
        cardBtn.onclick = () => {
            socket.emit('select blackcat tryal', blackCatHolder, i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (container && container.parentNode) container.parentNode.removeChild(container);
        };
        cardsDiv.appendChild(cardBtn);
    }
    container.appendChild(cardsDiv);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
}

// handled by the unified popup listener near the bottom of this file

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
        socket.emit('request rooms list');

        // Auto-join invited room if available
        const pendingRoom = (joinRoomNameInput && joinRoomNameInput.value.trim()) || roomFromUrl;
        if (pendingRoom) {
            socket.emit('join room', pendingRoom, myPlayerName);
        }
    }
});

// --- Copy & Share Room Link Functionality ---
function copyRoomShareLink() {
    const roomName = currentRoomName || (joinRoomNameInput ? joinRoomNameInput.value.trim() : '') || roomFromUrl;
    if (!roomName) {
        addGameMessage('ยังไม่ได้อยู่ในห้อง ไม่สามารถคัดลอกลิงก์ได้', 'red', true);
        return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomName)}`;

    const onCopied = () => {
        if (shareLinkToast) {
            shareLinkToast.style.display = 'block';
            setTimeout(() => {
                shareLinkToast.style.display = 'none';
            }, 3000);
        }
        addGameMessage(`คัดลอกลิงก์ห้อง "${roomName}" แล้ว: ${shareUrl}`, 'green', true);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(onCopied).catch(() => {
            fallbackCopy(shareUrl, onCopied);
        });
    } else {
        fallbackCopy(shareUrl, onCopied);
    }
}

function fallbackCopy(text, onSuccess) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        if (onSuccess) onSuccess();
    } catch (e) {
        prompt('คัดลอกลิงก์ด้านล่างเพื่อชวนเพื่อนเข้าห้อง:', text);
    }
    document.body.removeChild(textArea);
}

if (shareRoomLinkBtn) {
    shareRoomLinkBtn.addEventListener('click', copyRoomShareLink);
}
if (copyRoomLinkHeaderBtn) {
    copyRoomLinkHeaderBtn.addEventListener('click', copyRoomShareLink);
}

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

leaveRoomButton.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากห้อง?')) {
    socket.emit('leave room');
  }
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

let drawCardPendingTimeout = null;
let drawCardConfirming = false;

function resetDrawCardButton() {
    if (drawCardPendingTimeout) {
        clearTimeout(drawCardPendingTimeout);
        drawCardPendingTimeout = null;
    }
    drawCardConfirming = false;
    if (drawCardButton) {
        drawCardButton.classList.remove('confirming');
        drawCardButton.innerHTML = '🃏 จั่วการ์ด';
    }
}

drawCardButton.addEventListener('click', () => {
    const me = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (me && !me.alive) {
        addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
        resetDrawCardButton();
        return;
    }
    if (!isMyTurn) {
        addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
        resetDrawCardButton();
        return;
    }
    if (me && me.hasPlayedCardsThisTurn) {
        addGameMessage('คุณได้เล่นการ์ดไปแล้วในเทิร์นนี้ คุณต้องจบเทิร์น.', 'red');
        resetDrawCardButton();
        return;
    }

    // First tap: prompt confirmation with countdown reset
    if (!drawCardConfirming) {
        drawCardConfirming = true;
        drawCardButton.classList.add('confirming');
        drawCardButton.innerHTML = '⚠️ แตะยืนยันจั่ว?';
        if (drawCardPendingTimeout) clearTimeout(drawCardPendingTimeout);
        drawCardPendingTimeout = setTimeout(() => {
            resetDrawCardButton();
        }, 3500);
        return;
    }

    // Second tap: confirmed draw cards
    resetDrawCardButton();
    socket.emit('draw cards');
});

playCardButton.addEventListener('click', () => {
    const me = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (me && !me.alive) {
        addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
        return;
    }
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
                // --- Disable draw after playing card ---
                drawCardButton.disabled = true;
            });
        });
        return;
    }
    if (CARDS_NEED_TARGET.includes(card.name)) {
        // --- Popup เลือกเป้าหมาย ---
        const playerList = Object.values(currentRoomState.players).filter(p => p.alive && p.uniqueId !== myUniqueId);
        showSelectPlayerPopup('เลือกเป้าหมาย', playerList, (targetId) => {
            socket.emit('play card', selectedCard, targetId, null);
            clearCardSelection();
            drawCardButton.disabled = true;
        }, card);
        return;
    }
    if (card.name === 'Curse') {
        // Disable draw after playing Curse
        drawCardButton.disabled = true;
    }
    socket.emit('play card', selectedCard, null, null);
    clearCardSelection();
    // --- Disable draw after playing card (ทั่วไป) ---
    drawCardButton.disabled = true;
});

let endTurnPendingTimeout = null;
let endTurnConfirming = false;

function resetEndTurnButton() {
    if (endTurnPendingTimeout) {
        clearTimeout(endTurnPendingTimeout);
        endTurnPendingTimeout = null;
    }
    endTurnConfirming = false;
    if (endTurnButton) {
        endTurnButton.classList.remove('confirming');
        endTurnButton.innerHTML = '🛑 จบเทิร์น';
    }
}

endTurnButton.addEventListener('click', () => {
    const me = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (me && !me.alive) {
        addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
        resetEndTurnButton();
        return;
    }
    if (!isMyTurn) {
        addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
        resetEndTurnButton();
        return;
    }
    if (!me || !me.hasPlayedCardsThisTurn) {
        addGameMessage('คุณต้องเลือกจั่วการ์ด 2 ใบ หรือเล่นการ์ดก่อนจบเทิร์น', 'red');
        resetEndTurnButton();
        return;
    }
    
    // First tap: prompt confirmation with countdown reset
    if (!endTurnConfirming) {
        endTurnConfirming = true;
        endTurnButton.classList.add('confirming');
        endTurnButton.innerHTML = '⚠️ แตะยืนยัน?';
        if (endTurnPendingTimeout) clearTimeout(endTurnPendingTimeout);
        endTurnPendingTimeout = setTimeout(() => {
            resetEndTurnButton();
        }, 3500);
        return;
    }

    // Second tap: confirmed end turn
    resetEndTurnButton();
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
        } else if (currentRoomState && currentRoomState.currentPhase === 'DAY' && currentRoomState.playerForcedToRevealTryal === myUniqueId) {
            // For DAY forced reveal, prompt for card selection
            const cardIndex = prompt(`เลือกหมายเลขการ์ดชีวิตที่จะเปิดเผย (1-${myTryalCards.length}):`);
            const index = parseInt(cardIndex, 10) - 1; // Convert to 0-based index
            if (!isNaN(index) && index >= 0 && index < myTryalCards.length) {
                socket.emit('reveal tryal card', index);
        } else {
                addGameMessage('หมายเลขการ์ดไม่ถูกต้อง.', 'red');
        }
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
    const me = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (me && !me.alive) {
        addGameMessage('คุณตายแล้ว ไม่สามารถทำแอ็กชันได้', 'red');
        return;
    }
    if (currentRoomName) {
        socket.emit('skip confession');
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
    if (currentMobileGameTab !== 'chat' && tabChatBadge) {
        tabChatBadge.style.display = 'inline-block';
    }
}

function clearCardSelection() {
    selectedCard = null;
    if (playerHandDiv) {
        playerHandDiv.querySelectorAll('.card').forEach(card => {
            card.classList.remove('selected');
        });
    }
    if (cardTargetSelect) {
        cardTargetSelect.style.display = 'none';
        cardTargetSelect.value = '';
    }
    if (cardSecondTargetSelect) {
        cardSecondTargetSelect.style.display = 'none';
        cardSecondTargetSelect.value = '';
    }
    if (playCardButton) {
        playCardButton.classList.remove('can-play');
        playCardButton.innerHTML = '⚡ เล่นการ์ดที่เลือก';
    }
    resetEndTurnButton();
    resetDrawCardButton();
}

function updateTurnUI() {
    drawCardButton.disabled = !isMyTurn || drawButtonDisabled;
    playCardButton.disabled = !isMyTurn;
    endTurnButton.disabled = !isMyTurn;
    // ไม่ต้องซ่อน turnControlsDiv หรือ #game-actions แล้ว
    if (!isMyTurn) {
        clearCardSelection();
        resetEndTurnButton();
        resetDrawCardButton();
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
    // ปุ่มจบเทิร์น enable เสมอถ้าเป็นเทิร์นเรา
    endTurnButton.disabled = !isMyTurn;
}

function updateDrawCardButton() {
    const me = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (me && me.hasPlayedCardsThisTurn) {
        drawCardButton.disabled = true;
        return;
    }
    // Disable draw card button if a card is selected and needs a target
    if (selectedCard !== null && myCurrentHand[selectedCard] && CARDS_NEED_TARGET.includes(myCurrentHand[selectedCard].name) && cardTargetSelect && cardTargetSelect.value) {
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
    // เก็บข้อมูลการ์ดที่เลือกไว้
    let selectedCardData = null;
    if (selectedCard !== null && myCurrentHand[selectedCard]) {
        selectedCardData = myCurrentHand[selectedCard];
    }
    
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
                
                // ส่งข้อมูลการสลับตำแหน่งไปยัง server
                socket.emit('swap hand cards', fromIdx, toIdx);
                
                // ปรับ selectedCard index ถ้าจำเป็น
                if (selectedCard === fromIdx) {
                    selectedCard = toIdx;
                } else if (selectedCard === toIdx) {
                    selectedCard = fromIdx;
                }
                
                updateHandDisplay(myCurrentHand);
            }
        });
        
        // --- Tooltip ---
        cardElement.setAttribute('title', displayCardDescription(card.name));
        
        // --- Click to select ---
        cardElement.addEventListener('click', () => {
            if (!isMyTurn) {
                addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
                return;
            }
            if (selectedCard === index) {
                // แตะซ้ำที่การ์ดเดิมเพื่อยกเลิกการเลือก
                clearCardSelection();
                return;
            }
            clearCardSelection();
            selectedCard = index;
            cardElement.classList.add('selected');
            cardTargetSelect.style.display = 'none';
            cardTargetSelect.value = '';
            cardSecondTargetSelect.style.display = 'none';
            cardSecondTargetSelect.value = '';

            // ไฮไลต์ปุ่มเล่นการ์ดและแสดงชื่อการ์ดที่เลือก
            if (playCardButton) {
                playCardButton.classList.add('can-play');
                const cardNameTH = (typeof displayCardName === 'function') ? displayCardName(card.name) : card.name;
                playCardButton.innerHTML = `⚡ เล่น: <b>${cardNameTH}</b>`;
            }
        });
        
        // ถ้าการ์ดนี้เป็นการ์ดที่เลือกไว้ ให้เพิ่ม selected class
        if (selectedCardData && card.name === selectedCardData.name && 
            card.color === selectedCardData.color) {
            cardElement.classList.add('selected');
            selectedCard = index;
        }
        
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
            cardDiv.dataset.index = idx;
            cardDiv.setAttribute('title', displayCardDescription(card.name)); // <-- Add tooltip for tryal cards
            
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
        const revealedNames = myRevealedTryalCardIndexes
            .map((item) => {
                if (typeof item === 'number') return myTryalCards[item]?.name;
                if (typeof item === 'string') return item;
                return null;
            })
            .filter(Boolean)
            .map((name) => displayCardName(name));
        myRevealedTryalCards.textContent = `Revealed: ${revealedNames.join(', ')}`;
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

    let myPlayer = roomState.players && roomState.players[myUniqueId];
    let isWitchView = myPlayer && myPlayer.hasBeenWitch;
    playersInOrder.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-board-card' + (!player.alive ? ' dead' : '') + (roomState.currentTurnPlayerUniqueId === player.uniqueId ? ' current-turn' : '');
        // Header
        let header = `<div class='player-board-header'>`;
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) {
            header += `<span style="color:#ffd700;font-size:1.2em;margin-right:6px;vertical-align:middle;">🔥</span>`;
        }
        header += `${player.name}`;
        if (isWitchView && player.hasBeenWitch) header += ' <span style="color:#ff1744;font-size:0.95em;font-weight:bold;">(ทีมปอบ)</span>';
        if (player.isHost) header += ' <span style="color:#ff4500;">(Host)</span>';
        if (player.isBlackCatHolder) header += ' <span style="color:#ffd700;">(เครื่องเซ่น)</span>';
        if (!player.alive) header += ' <span class="player-dead-badge">💀 เสียชีวิตแล้ว</span>';
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) header += ' <span style="color:#2196f3;font-weight:bold;">[เทิร์น]</span>';
        header += '</div>';
        // Status
        let status = `<div class='player-board-status'>`;
        status += `การ์ดในมือ: ${player.handSize} | ข้อกล่าวหา: ${player.accusationPoints}`;
        // --- Effect: Blue, Green, and now Red cards ---
        let blueEffectCards = [];
        let greenEffectCards = [];
        let redEffectCards = [];
        let blackEffectCards = [];
        
        if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
            console.log(`Player ${player.name} inPlayCards:`, player.inPlayCards);
            
            // แยกการ์ดตามสี
            player.inPlayCards.forEach(card => {
                if (typeof card === 'object') {
                    if (card.color === 'Red') {
                        redEffectCards.push(card);
                    } else if (card.color === 'Blue') {
                        blueEffectCards.push(card);
                    } else if (card.color === 'Green') {
                        greenEffectCards.push(card);
                    } else if (card.color === 'Black') {
                        blackEffectCards.push(card);
                    }
                } else if (typeof card === 'string') {
                    // Legacy string cards - กำหนดสีตามชื่อการ์ด
                    if (card === 'Accusation' || card === 'Evidence' || card === 'Witness') {
                        redEffectCards.push(card);
                    } else if (card === 'Stocks') {
                        greenEffectCards.push(card);
                    } else if (card === 'Black Cat' || card === 'Asylum' || card === 'Piety' || card === 'Matchmaker') {
                        blueEffectCards.push(card);
        }
                }
            });
            
            console.log(`Player ${player.name} blueEffectCards:`, blueEffectCards);
            console.log(`Player ${player.name} greenEffectCards:`, greenEffectCards);
            console.log(`Player ${player.name} redEffectCards:`, redEffectCards);
            console.log(`Player ${player.name} blackEffectCards:`, blackEffectCards);
        }
        
        // --- Show All Status Effects (Blue/Green/Red/Black) in one bar ---
        if (blueEffectCards.length > 0 || greenEffectCards.length > 0 || redEffectCards.length > 0 || blackEffectCards.length > 0) {
            status += `<div class='effect-bar' style='display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;'>`;
            
            // Blue effects (Permanent cards)
            blueEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-blue' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            // Green effects (Action cards)
            greenEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-green' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            // Red effects (Accusation cards)
            redEffectCards.forEach((cardObj, idx) => {
                let value = (typeof cardObj === 'object' && cardObj.value) ? cardObj.value :
                    (cardObj === 'Accusation' ? 1 : cardObj === 'Evidence' ? 3 : cardObj === 'Witness' ? 7 : 1);
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-red' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName} <span style=\"color:#fff;background:#b71c1c;padding:0.5px 5px;border-radius:5px;margin-left:2px;font-size:0.95em;\">+${value}</span></span>`;
            });
            
            // Black effects (Event cards)
            blackEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-black' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            status += `</div>`;
        }
        status += '</div>';
        // Tryal Cards
        let tryals = `<div class='player-board-tryals'>`;
        if (player.tryalCards && Array.isArray(player.tryalCards)) {
            player.tryalCards.forEach((cardObj, idx) => {
                const revealed = !!(
                    player.revealedTryalCardIndexes &&
                    (
                        player.revealedTryalCardIndexes.includes(idx) ||
                        player.revealedTryalCardIndexes.includes(cardObj.name)
                    )
                );
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
                const cardTitle = revealed
                    ? displayCardDescription(cardObj.name)
                    : 'การ์ดชีวิตที่ยังไม่เปิดเผย';
                tryals += `<div class='${cardClass}${revealed ? ' revealed' : ''}${cardThemeClass}' title='${cardTitle}'>${revealed ? displayCardName(cardObj.name) : 'Card ' + (idx + 1)}</div>`;
            });
        }
        tryals += '</div>';
        card.innerHTML = header + status + tryals;
        nightPlayersList.appendChild(card);
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
    // --- เรียงลำดับผู้เล่นตามลำดับเดิม ---
    const allPlayers = Object.values(roomState.players);
    let playersInOrder = allPlayers;
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
        if (!player.alive) header += ' <span class="player-dead-badge">💀 เสียชีวิตแล้ว</span>';
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) header += ' <span style="color:#2196f3;font-weight:bold;">[เทิร์น]</span>';
        header += '</div>';
        // Status
        let status = `<div class='player-board-status'>`;
        status += `การ์ดในมือ: ${player.handSize} | ข้อกล่าวหา: ${player.accusationPoints}`;
        // --- Effect: Blue, Green, and now Red cards ---
        let blueEffectCards = [];
        let greenEffectCards = [];
        let redEffectCards = [];
        let blackEffectCards = [];
        
        if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
            console.log(`Player ${player.name} inPlayCards:`, player.inPlayCards);
            
            // แยกการ์ดตามสี
            player.inPlayCards.forEach(card => {
                if (typeof card === 'object') {
                    if (card.color === 'Red') {
                        redEffectCards.push(card);
                    } else if (card.color === 'Blue') {
                        blueEffectCards.push(card);
                    } else if (card.color === 'Green') {
                        greenEffectCards.push(card);
                    } else if (card.color === 'Black') {
                        blackEffectCards.push(card);
                    }
                } else if (typeof card === 'string') {
                    // Legacy string cards - กำหนดสีตามชื่อการ์ด
                    if (card === 'Accusation' || card === 'Evidence' || card === 'Witness') {
                        redEffectCards.push(card);
                    } else if (card === 'Stocks') {
                        greenEffectCards.push(card);
                    } else if (card === 'Black Cat' || card === 'Asylum' || card === 'Piety' || card === 'Matchmaker') {
                        blueEffectCards.push(card);
        }
                }
            });
            
            console.log(`Player ${player.name} blueEffectCards:`, blueEffectCards);
            console.log(`Player ${player.name} greenEffectCards:`, greenEffectCards);
            console.log(`Player ${player.name} redEffectCards:`, redEffectCards);
            console.log(`Player ${player.name} blackEffectCards:`, blackEffectCards);
        }
        
        // --- Show All Status Effects (Blue/Green/Red/Black) in one bar ---
        if (blueEffectCards.length > 0 || greenEffectCards.length > 0 || redEffectCards.length > 0 || blackEffectCards.length > 0) {
            status += `<div class='effect-bar' style='display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;'>`;
            
            // Blue effects (Permanent cards)
            blueEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-blue' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            // Green effects (Action cards)
            greenEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-green' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            // Red effects (Accusation cards)
            redEffectCards.forEach((cardObj, idx) => {
                let value = (typeof cardObj === 'object' && cardObj.value) ? cardObj.value :
                    (cardObj === 'Accusation' ? 1 : cardObj === 'Evidence' ? 3 : cardObj === 'Witness' ? 7 : 1);
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-red' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName} <span style=\"color:#fff;background:#b71c1c;padding:0.5px 5px;border-radius:5px;margin-left:2px;font-size:0.95em;\">+${value}</span></span>`;
            });
            
            // Black effects (Event cards)
            blackEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? displayCardName(cardObj) : displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? displayCardDescription(cardObj) : displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-black' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            status += `</div>`;
        }
        status += '</div>';
        // Tryal Cards
        let tryals = `<div class='player-board-tryals'>การ์ดชีวิตที่เหลือ: <b>${player.tryalCardCount}</b> ใบ</div>`;
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

function showAssignBlackCatPopup(potentialTargets) {
    if (!potentialTargets || potentialTargets.length === 0) return;
    const old = document.getElementById('assign-blackcat-popup');
    if (old) old.remove();
    const oldOverlay = document.getElementById('assign-blackcat-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'assign-blackcat-overlay';
    overlay.className = 'tryal-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9998';
    overlay.style.background = 'rgba(10, 8, 8, 0.85)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.boxSizing = 'border-box';

    const container = document.createElement('div');
    container.id = 'assign-blackcat-popup';
    container.style.background = 'radial-gradient(circle at top, #2b1f1a 0%, #171210 60%, #0d0a09 100%)';
    container.style.border = '2px solid #8d6e63';
    container.style.borderRadius = '16px';
    container.style.padding = '24px 20px';
    container.style.maxWidth = '420px';
    container.style.width = '100%';
    container.style.boxShadow = '0 16px 40px rgba(0,0,0,0.85), 0 0 24px rgba(183,28,28,0.3)';
    container.style.textAlign = 'center';
    container.style.boxSizing = 'border-box';
    container.style.color = '#e0d7cd';

    const title = document.createElement('h3');
    title.innerHTML = '🕯️ ปอบเลือกผู้รับการ์ดเครื่องเซ่น';
    title.style.fontFamily = "'Creepster', 'Noto Serif Thai', serif";
    title.style.color = '#ffb74d';
    title.style.fontSize = '1.5em';
    title.style.margin = '0 0 8px 0';
    title.style.textShadow = '0 2px 10px rgba(0,0,0,0.8)';
    container.appendChild(title);

    // Witch team members info
    if (currentRoomState && currentRoomState.players) {
        const witchTeam = Object.values(currentRoomState.players).filter(p => p.hasBeenWitch || p.isWitch);
        if (witchTeam.length > 0) {
            const witchList = document.createElement('div');
            witchList.style.background = 'rgba(183, 28, 28, 0.2)';
            witchList.style.border = '1px solid rgba(229, 115, 115, 0.4)';
            witchList.style.color = '#ffcdd2';
            witchList.style.padding = '6px 12px';
            witchList.style.borderRadius = '8px';
            witchList.style.marginBottom = '14px';
            witchList.style.fontSize = '0.9em';
            witchList.style.fontWeight = '600';
            witchList.innerHTML = '👥 สมาชิกทีมปอบ: <span style="color:#fff;">' + witchTeam.map(p => p.name).join(', ') + '</span>';
            container.appendChild(witchList);
        }
    }

    const subtitle = document.createElement('p');
    subtitle.textContent = 'เลือกผู้เล่นที่จะเริ่มต้นเกมด้วยการ์ดเครื่องเซ่น:';
    subtitle.style.color = '#d7ccc8';
    subtitle.style.fontSize = '0.95em';
    subtitle.style.margin = '0 0 14px 0';
    container.appendChild(subtitle);

    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '12px 14px';
    select.style.fontSize = '1em';
    select.style.borderRadius = '8px';
    select.style.border = '1.5px solid #8d6e63';
    select.style.background = '#251e1c';
    select.style.color = '#fff';
    select.style.marginBottom = '18px';
    select.style.outline = 'none';
    select.style.boxSizing = 'border-box';
    select.innerHTML = '<option value="">-- แตะเพื่อเลือกผู้เล่น --</option>';

    potentialTargets.forEach(target => {
        const option = document.createElement('option');
        option.value = target.uniqueId;
        option.textContent = target.name;
        select.appendChild(option);
    });
    container.appendChild(select);

    const btn = document.createElement('button');
    btn.innerHTML = '✅ ยืนยันการมอบการ์ดเครื่องเซ่น';
    btn.style.width = '100%';
    btn.style.padding = '12px 20px';
    btn.style.fontSize = '1.05em';
    btn.style.fontWeight = 'bold';
    btn.style.background = 'linear-gradient(135deg, #b71c1c 0%, #880e4f 100%)';
    btn.style.color = '#fff';
    btn.style.border = '1px solid #ef5350';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 14px rgba(183, 28, 28, 0.4)';
    btn.style.transition = 'all 0.2s ease';
    btn.style.boxSizing = 'border-box';

    btn.onclick = () => {
        if (select.value) {
            socket.emit('assign black cat', select.value);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        } else {
            alert('กรุณาเลือกผู้เล่นก่อนยืนยัน!');
        }
    };
    container.appendChild(btn);

    overlay.appendChild(container);
    document.body.appendChild(overlay);
}

socket.on('popup assign black cat', (potentialTargets) => {
    showAssignBlackCatPopup(potentialTargets);
});

function removeNightActionPopup() {
    const existingPopup = document.getElementById('night-action-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    const existingOverlay = document.getElementById('night-action-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
}

function createNightActionPopup(actionType, timer) {
    console.log('createNightActionPopup called with actionType:', actionType, 'timer:', timer);
    
    // Remove existing popup & overlay if any
    removeNightActionPopup();
    
    const overlay = document.createElement('div');
    overlay.id = 'night-action-overlay';
    overlay.className = 'night-action-overlay';

    const popup = document.createElement('div');
    popup.id = 'night-action-popup';
    popup.className = `night-action-modal ${actionType === 'witch' ? 'theme-witch-night' : 'theme-constable-night'}`;
    
    const icon = actionType === 'witch' ? '🩸' : '🛡️';
    const title = actionType === 'witch' ? 'ปอบ — เลือกเป้าหมายสังหาร' : 'หมอผี — เลือกผู้เล่นเพื่อปกป้อง';
    const subtitle = actionType === 'witch'
        ? 'เลือกชาวบ้าน 1 คนในความมืดมิดเพื่อสังหารในคืนนี้'
        : 'เลือกผู้เล่น 1 คนเพื่อคุ้มครองจากเงื้อมมือของปอบ';
    
    popup.innerHTML = `
        <div class="night-action-header">
            <h2 class="night-action-title">${icon} ${title}</h2>
            <div class="night-action-subtitle">${subtitle}</div>
        </div>
        <div id="night-action-witch-team-container"></div>
        <div id="night-action-players-list" class="night-targets-scroll"></div>
        ${actionType === 'witch' ? `
        <div class="modal-witch-chat-section" id="modal-witch-chat-section">
            <div class="modal-witch-chat-header">
                <span>💬 แชทปรึกษาทีมปอบ</span>
                <span class="modal-witch-chat-sub">คุยสดกับเพื่อนปอบก่อนยืนยัน</span>
            </div>
            <div id="modal-witch-chat-messages" class="modal-witch-chat-messages"></div>
            <div class="modal-witch-chat-input-bar">
                <input type="text" id="modal-witch-chat-input" placeholder="พิมพ์ข้อความปรึกษาเพื่อนปอบ..." maxlength="100">
                <button type="button" id="modal-witch-chat-send" class="btn btn-sm btn-danger">ส่ง</button>
            </div>
        </div>
        ` : ''}
        <div class="night-action-footer">
            ${actionType === 'witch' ? `<button type="button" id="propose-night-action-btn" class="btn btn-secondary btn-sm" style="display: none; margin-right: 8px;">💡 เสนอชื่อในแชท</button>` : ''}
            <button id="confirm-night-action" class="night-confirm-btn" style="display: none;">
                ยืนยันการเลือก
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // แสดงรายชื่อทีมปอบ (ถ้ามี)
    if (actionType === 'witch' && currentRoomState && currentRoomState.players) {
        const witchTeam = Object.values(currentRoomState.players).filter(p => p.hasBeenWitch);
        if (witchTeam.length > 0) {
            const teamContainer = popup.querySelector('#night-action-witch-team-container');
            if (teamContainer) {
                const witchList = document.createElement('div');
                witchList.className = 'night-witch-team-box';
                witchList.innerHTML = '🤝 สมาชิกทีมปอบ: <strong>' + witchTeam.map(p => p.name).join(', ') + '</strong>';
                teamContainer.appendChild(witchList);
            }
        }

        // เชื่อมต่อแชทปอบในโมดอล
        const modalChatInput = popup.querySelector('#modal-witch-chat-input');
        const modalChatSend = popup.querySelector('#modal-witch-chat-send');
        const modalChatMessages = popup.querySelector('#modal-witch-chat-messages');

        if (modalChatMessages && witchChatMessages) {
            modalChatMessages.innerHTML = witchChatMessages.innerHTML;
            modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
        }

        const sendFromModal = () => {
            if (!modalChatInput) return;
            const msg = modalChatInput.value.trim();
            if (msg && currentRoomName) {
                socket.emit('send witch chat message', currentRoomName, msg);
                modalChatInput.value = '';
            }
        };

        if (modalChatSend) modalChatSend.onclick = sendFromModal;
        if (modalChatInput) {
            modalChatInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendFromModal();
                }
            };
        }
    }

    // Populate players list
    console.log('Calling populateNightActionPlayersList');
    populateNightActionPlayersList(actionType);
}

function autoSubmitNightAction(actionType) {
    // ส่ง action แบบ skip (ไม่เลือกเป้าหมาย)
    if (actionType === 'witch') {
        socket.emit('witch kill target', null); // null = ไม่เลือก
    } else if (actionType === 'constable') {
        socket.emit('constable action', null); // null = ไม่เลือก
    }
    // ปิด popup
    removeNightActionPopup();
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
        removeNightActionPopup();
    } else if (actionType === 'constable') {
        socket.emit('constable action', nightActionState.selectedTargetId);
        addGameMessage('คุณได้เลือกที่จะปกป้องเป้าหมายแล้ว', 'green');
        removeNightActionPopup();
    }
    
    // Hide UI and reset state after confirming
    disableNightTargetSelection();
}

function showConfessPopup(tryalCards) {
    // Remove any existing popups to prevent overlapping
    const existing = document.getElementById('confess-popup');
    if (existing) existing.remove();
    const existingOverlay = document.getElementById('confess-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    if (!tryalCards || tryalCards.length === 0) return; // ไม่เด้ง popup ถ้าไม่มีไพ่

    const overlay = document.createElement('div');
    overlay.id = 'confess-overlay';
    overlay.className = 'tryal-modal-overlay';

    const popup = document.createElement('div');
    popup.id = 'confess-popup';
    popup.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = '🕯️ สารภาพบาป: เลือกการ์ดชีวิตของคุณ';
    popup.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'เลือกการ์ดชีวิต 1 ใบเพื่อเปิดเผยต่อหน้าทุกคน หรือเลือกข้ามการสารภาพ';
    subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
    popup.appendChild(subtitle);

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    tryalCards.forEach((card, i) => {
        const btn = document.createElement('button');
        btn.className = 'tryal-card-btn';
        btn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i+1}</span>`;
        btn.onclick = () => {
            socket.emit('confess tryal card', i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
        };
        cardsDiv.appendChild(btn);
    });
    popup.appendChild(cardsDiv);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.id = 'skip-confess-button';
    skipBtn.className = 'tryal-popup-action-btn action-btn';
    skipBtn.textContent = 'ข้ามการสารภาพ';
    skipBtn.onclick = () => {
        socket.emit('skip confession');
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    };
    popup.appendChild(skipBtn);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
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
        // Witches can target any alive player who does NOT have Asylum and is not self
        eligiblePlayers = Object.values(currentRoomState.players).filter(player =>
            player.alive &&
            player.uniqueId !== myUniqueId &&
            !(player.inPlayCards && player.inPlayCards.some(card => (typeof card === 'string' ? card === 'Asylum' : card.name === 'Asylum')))
        );
    } else if (actionType === 'constable') {
        // Constables can target any player except themselves, and only alive
        eligiblePlayers = Object.values(currentRoomState.players).filter(player => player.uniqueId !== myUniqueId && player.alive);
    }
    
    console.log('Eligible players for night action:', eligiblePlayers.map(p => ({ name: p.name, uniqueId: p.uniqueId })));
    
    if (eligiblePlayers.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'color: #baa89b; text-align: center; padding: 24px; font-style: italic; font-size: 0.95em;';
        emptyDiv.textContent = 'ไม่มีเป้าหมายที่เลือกได้ในขณะนี้';
        playersList.appendChild(emptyDiv);
        return;
    }

    eligiblePlayers.forEach(player => {
        console.log(`Adding player ${player.name} to night action list`);
        
        const playerDiv = document.createElement('div');
        playerDiv.className = 'night-target-row';
        playerDiv.dataset.uniqueId = player.uniqueId;
        
        playerDiv.innerHTML = `
            <div class="night-target-info">
                <div class="night-target-name">${player.name}</div>
                <div class="night-target-meta">การ์ดในมือ: ${player.handSize ?? 0} ใบ | การ์ดชีวิต: ${player.tryalCardCount ?? 0} ใบ</div>
            </div>
            <div class="night-target-badge">แตะเลือก</div>
        `;
        
        playerDiv.addEventListener('click', () => {
            console.log(`Player ${player.name} clicked in night action popup`);
            
            // Remove previous selection
            playersList.querySelectorAll('.night-target-row').forEach(p => {
                p.classList.remove('selected');
                const badge = p.querySelector('.night-target-badge');
                if (badge) badge.textContent = 'แตะเลือก';
            });
            
            // Highlight selected player
            playerDiv.classList.add('selected');
            const badge = playerDiv.querySelector('.night-target-badge');
            if (badge) badge.textContent = '✓ เลือกแล้ว';
            
            // Update state
            nightActionState.selectedTargetId = player.uniqueId;
            console.log('Updated nightActionState.selectedTargetId to:', player.uniqueId);
            
            // Show confirm button
            const confirmBtn = document.getElementById('confirm-night-action');
            if (confirmBtn) {
                confirmBtn.style.display = 'inline-block';
            }

            // Show propose to witch chat button
            const proposeBtn = document.getElementById('propose-night-action-btn');
            if (proposeBtn && actionType === 'witch') {
                proposeBtn.style.display = 'inline-block';
                proposeBtn.onclick = () => {
                    if (currentRoomName) {
                        socket.emit('send witch chat message', currentRoomName, `💡 ขอเสนอเป้าหมาย: "${player.name}"`);
                    }
                };
            }
        });
        
        playersList.appendChild(playerDiv);
    });
    
    // Add confirm button event listener
    const confirmBtn = document.getElementById('confirm-night-action');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            console.log('Confirm button clicked');
            submitNightAction(actionType);
        };
    }
}

// --- พิธีเซ่นไหว้: เลือกไพ่ ชีวิต ของผู้เล่นซ้ายมือ ---
socket.on('prompt select left tryal', ({ leftPlayerUniqueId, leftPlayerName, leftPlayerTryalCount }) => {
    const me = currentRoomState && currentRoomState.players && currentRoomState.players[myUniqueId];
    if (me && !me.alive) {
        return;
    }
    // Remove any existing popups to prevent overlapping
    const existing = document.getElementById('select-left-tryal-popup');
    if (existing) existing.remove();
    
    const existingOverlay = document.getElementById('select-left-tryal-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // สร้าง background overlay
    const overlay = document.createElement('div');
    overlay.id = 'select-left-tryal-overlay';
    overlay.className = 'tryal-modal-overlay';

    const popup = document.createElement('div');
    popup.id = 'select-left-tryal-popup';
    popup.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = '🔮 พิธีเซ่นไหว้: สุ่มหยิบการ์ดชีวิต';
    popup.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.innerHTML = `หยิบการ์ดชีวิตจากผู้เล่นทางซ้ายมือ: <b style="color:#ffb74d;">${leftPlayerName}</b>`;
    subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
    popup.appendChild(subtitle);

    if (leftPlayerTryalCount === 0) {
        const msg = document.createElement('div');
        msg.textContent = 'ผู้เล่นซ้ายมือไม่มีการ์ดชีวิตให้หยิบ';
        msg.style.color = '#cfd8dc';
        popup.appendChild(msg);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        setTimeout(() => {
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
        }, 2000);
        return;
    }

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    for (let i = 0; i < leftPlayerTryalCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'tryal-card-btn';
        btn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i + 1}</span>`;
        btn.onclick = () => {
            socket.emit('select left tryal', i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
            setTimeout(() => { updateTryalCardDisplay(); }, 300);
        };
        cardsDiv.appendChild(btn);
    }
    popup.appendChild(cardsDiv);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
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
        cardDiv.style.cursor = 'grab';
        cardDiv.style.transition = 'transform 0.18s, border-color 0.18s';
        cardDiv.setAttribute('title', displayCardDescription(card.name)); // <-- Add tooltip for tryal cards
        
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
    // Remove existing modal if any
    const oldModal = document.querySelector('.modal.select-player-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal select-player-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.65)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    // Close on click outside
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    // Close on ESC
    function escListener(e) {
        if (e.key === 'Escape') {
            if (document.body.contains(modal)) document.body.removeChild(modal);
            document.removeEventListener('keydown', escListener);
        }
    }
    document.addEventListener('keydown', escListener);

    const content = document.createElement('div');
    content.style.background = '#2d2d2d'; // เทาเข้ม
    content.style.color = '#ff9800';
    content.style.padding = '14px 10px';
    content.style.borderRadius = '12px';
    content.style.boxShadow = '0 2px 12px #0002';
    content.style.textAlign = 'center';
    content.style.minWidth = '0';
    content.style.maxWidth = '240px';
    content.style.width = '100%';
    content.style.maxHeight = '75vh';
    content.style.overflowY = 'auto';
    content.style.position = 'relative';
    content.style.border = '2.5px solid #ff9800';
    content.style.fontSize = '0.9em';

    const titleElem = document.createElement('h3');
    titleElem.textContent = title;
    titleElem.style.color = '#ff9800';
    titleElem.style.fontWeight = 'bold';
    titleElem.style.marginBottom = '10px';
    titleElem.style.fontSize = '1.02em'; // เดิม 1.13em ลดลง 10%
    content.appendChild(titleElem);

    const listDiv = document.createElement('div');
    listDiv.style.display = 'flex';
    listDiv.style.flexDirection = 'column';
    listDiv.style.justifyContent = 'center';
    listDiv.style.gap = '8px';
    listDiv.style.marginBottom = '14px';

    // กรองเฉพาะผู้เล่นที่ alive
    let alivePlayers = playerList.filter(p => p.alive);
    if (cardObj && cardObj.color === 'Blue') {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== myUniqueId);
    } else if (cardObj && ['Red','Green','Blue'].includes(cardObj.color)) {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== myUniqueId);
    }
    if (actionType === 'constable') {
        alivePlayers = alivePlayers.filter(p => !p.inPlayCards || !p.inPlayCards.some(card => card === 'Asylum' || card.name === 'Asylum'));
    }
    if (actionType === 'witch') {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== myUniqueId);
    }

    let selectedId = null;
    alivePlayers.forEach(player => {
        const btn = document.createElement('div');
        btn.className = 'player-select-card';
        btn.style.background = '#444'; // การ์ดผู้เล่นเทาอ่อนขึ้น
        btn.style.color = '#ff9800';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1.02em';
        btn.style.padding = '8px 8px 6px 8px';
        btn.style.borderRadius = '9px';
        btn.style.margin = '0 auto';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 1px 6px #ff980022';
        btn.style.transition = 'all 0.13s';
        btn.style.minWidth = '0';
        btn.style.maxWidth = '210px';
        btn.style.width = '100%';
        btn.style.height = '57px';
        btn.style.display = 'flex';
        btn.style.flexDirection = 'row';
        btn.style.alignItems = 'center';
        btn.style.position = 'relative';
        btn.style.border = '2px solid #ffe0b2';
        // Highlight current turn
        if (currentRoomState && currentRoomState.currentTurnPlayerUniqueId === player.uniqueId) {
            btn.innerHTML += '<span style="color:#ff9800;font-size:1.08em;position:absolute;top:6px;right:10px;">🔥</span>';
        }
        // Icon (profile or emoji)
        btn.innerHTML += `<div style=\"font-size:1.3em;margin-right:10px;\">👤</div>`;
        // Name + status
        let info = `<div style=\"display:flex;flex-direction:column;align-items:flex-start;justify-content:center;\">`;
        info += `<span style=\"font-weight:bold;font-size:0.97em;color:#ff9800;\">${player.name}</span>`;
        info += `<span style=\"font-size:0.88em;color:#fff;opacity:0.95;\">การ์ด: ${player.handSize} | ชีวิต: ${player.tryalCardCount}`;
        // คำนวณคะแนนข้อกล่าวหา
        if (player.inPlayCards && player.inPlayCards.length > 0) {
            let accusationPoints = 0;
            player.inPlayCards.forEach(c => {
                if (c.name === 'Accusation' || c === 'Accusation') accusationPoints += 1;
                if (c.name === 'Evidence' || c === 'Evidence') accusationPoints += 3;
            });
            if (accusationPoints > 0) {
                info += ` | กล่าวหา: ${accusationPoints}`;
            }
        }
        info += `</span>`;
        if (player.inPlayCards && player.inPlayCards.length > 0) {
            // แสดงชื่อการ์ดอื่นๆ (ยกเว้น Accusation/Evidence)
            const statusText = player.inPlayCards.map(c => {
                if (c.name === 'Accusation' || c === 'Accusation') {
                    return null;
                } else if (c.name === 'Evidence' || c === 'Evidence') {
                    return null;
                } else {
                    return getCardNameTH(c);
                }
            }).filter(Boolean).join(', ');
            if (statusText) {
                info += `<span style='font-size:0.84em;color:#ffb74d;'>${statusText}</span>`;
            }
        }
        info += `</div>`;
        btn.innerHTML += info;
        btn.addEventListener('mouseover', () => {
            // ไม่เปลี่ยนสีหรือขอบเมื่อ hover
        });
        btn.addEventListener('mouseout', () => {
            // ไม่เปลี่ยนสีหรือขอบเมื่อ mouseout
        });
        btn.addEventListener('click', () => {
            // Remove highlight from all
            listDiv.querySelectorAll('.player-select-card').forEach(el => {
                // ไม่เปลี่ยนสีหรือขอบเมื่อเลือก
                el.style.transform = '';
            });
            btn.style.transform = 'scale(1.06)'; // อนุญาตขยายเล็กน้อยถ้าต้องการ
            selectedId = player.uniqueId;
            confirmBtn.disabled = false;
        });
        listDiv.appendChild(btn);
    });
    content.appendChild(listDiv);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'ยืนยันเป้าหมาย';
    confirmBtn.style.background = 'linear-gradient(90deg, #ff9800 60%, #ff6f00 100%)';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.fontSize = '0.97em'; // เดิม 1.08em
    confirmBtn.style.padding = '8px 20px';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '7px';
    confirmBtn.style.boxShadow = '0 1px 6px #ff980088';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.marginTop = '6px';
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => {
        if (selectedId) {
            if (document.body.contains(modal)) document.body.removeChild(modal);
            callback(selectedId);
        }
    });
    content.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.marginTop = '6px';
    cancelBtn.style.background = '#616161';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '0.97em'; // เดิม 1.08em
    cancelBtn.style.padding = '8px 20px';
    cancelBtn.style.borderRadius = '7px';
    cancelBtn.style.border = 'none';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', () => {
        if (document.body.contains(modal)) document.body.removeChild(modal);
    });
    content.appendChild(cancelBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);
}

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
        'Accusation': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 1 ข้อกล่าวหา)',
        'Evidence': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 3 ข้อกล่าวหา)',
        'Witness': 'ใช้เพื่อกล่าวหาผู้เล่นที่สงสัยว่าเป็นปอบ (เพิ่ม 7 ข้อกล่าวหา)',
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

// ฟังก์ชันแสดงสถิติตอนจบเกม และหน้าจอสรุปผลชัยชนะ
function showGameOverModal(data) {
    if (!data) return;
    const summary = data.gameSummary || data;
    const modal = document.getElementById('game-over-modal');
    if (!modal) return;

    // ลบ popup เดิมถ้ามี
    const oldPopup = document.getElementById('game-over-popup');
    if (oldPopup) oldPopup.remove();

    const victoryBadge = document.getElementById('victory-badge');
    const victoryTitle = document.getElementById('victory-title');
    const victoryMessage = document.getElementById('victory-message');
    const mvpCardsGrid = document.getElementById('mvp-cards-grid');
    const rolesRevealTbody = document.getElementById('roles-reveal-tbody');
    const rematchBtn = document.getElementById('rematch-btn');
    const rematchWaiting = document.getElementById('rematch-waiting-notice');
    const closeBtn = document.getElementById('close-victory-modal-btn');

    const winner = summary.winner || '';
    const isWitchWin = winner.toLowerCase().includes('witch') || winner.includes('ปอบ');
    const isTownWin = winner.toLowerCase().includes('town') || winner.toLowerCase().includes('constable') || winner.includes('ชาวบ้าน');

    if (isWitchWin) {
        if (victoryBadge) victoryBadge.textContent = '🧙‍♀️ ฝ่ายปอบเป็นผู้ชนะ!';
        if (victoryTitle) {
            victoryTitle.className = 'victory-title witch-win';
            victoryTitle.textContent = 'เหล่าปอบยึดครองหมู่บ้านสำเร็จ!';
        }
    } else if (isTownWin) {
        if (victoryBadge) victoryBadge.textContent = '🏆 ฝ่ายชาวบ้านเป็นผู้ชนะ!';
        if (victoryTitle) {
            victoryTitle.className = 'victory-title townsfolk-win';
            victoryTitle.textContent = 'ชาวบ้านกำจัดปอบได้สำเร็จ!';
        }
    } else {
        if (victoryBadge) victoryBadge.textContent = '⚖️ สรุปผลการเล่น';
        if (victoryTitle) {
            victoryTitle.className = 'victory-title';
            victoryTitle.textContent = winner || 'เกมสิ้นสุดลงแล้ว';
        }
    }

    if (victoryMessage) {
        victoryMessage.innerHTML = summary.message || 'การต่อสู้อันดุเดือดระหว่างชาวบ้านและปอบได้จบลงแล้ว';
    }

    // Render MVP Cards
    if (mvpCardsGrid) {
        const mvp = summary.mvp || {};
        let cardsHtml = '';

        // Card 1: Top Accuser
        const topAccuser = mvp.mostAccuser;
        cardsHtml += `
            <div class="mvp-card">
                <div class="mvp-icon">🗣️</div>
                <div class="mvp-award-name">ยอดนักกล่าวหา</div>
                <div class="mvp-player-name">${topAccuser ? topAccuser.name : '-'}</div>
                <div class="mvp-detail">${topAccuser ? `ลงข้อกล่าวหา +${topAccuser.count} แต้ม` : 'ไม่มีการกล่าวหา'}</div>
            </div>
        `;

        // Card 2: Most Accused
        const mostAccused = mvp.mostAccused;
        cardsHtml += `
            <div class="mvp-card">
                <div class="mvp-icon">🎯</div>
                <div class="mvp-award-name">เป้าหมายยอดฮิต</div>
                <div class="mvp-player-name">${mostAccused ? mostAccused.name : '-'}</div>
                <div class="mvp-detail">${mostAccused ? `โดนกล่าวหา ${mostAccused.count} แต้ม` : 'ไม่มีผู้ถูกเพ่งเล็ง'}</div>
            </div>
        `;

        // Card 3: First Victim
        const firstVictim = mvp.firstVictim;
        cardsHtml += `
            <div class="mvp-card">
                <div class="mvp-icon">🕯️</div>
                <div class="mvp-award-name">สังเวยคนแรก</div>
                <div class="mvp-player-name">${firstVictim ? firstVictim.name : '-'}</div>
                <div class="mvp-detail">${firstVictim ? 'เหยื่อเคราะห์ร้ายรายแรก' : 'ไม่มีใครตาย'}</div>
            </div>
        `;

        // Card 4: Surviving Townsfolk
        const survivors = mvp.survivingTownsfolk || [];
        cardsHtml += `
            <div class="mvp-card">
                <div class="mvp-icon">🛡️</div>
                <div class="mvp-award-name">ชาวบ้านผู้รอดชีวิต</div>
                <div class="mvp-player-name">${survivors.length > 0 ? survivors.join(', ') : '-'}</div>
                <div class="mvp-detail">${survivors.length > 0 ? `รอดชีวิต ${survivors.length} คน` : 'ไม่มีชาวบ้านรอดชีวิต'}</div>
            </div>
        `;

        mvpCardsGrid.innerHTML = cardsHtml;
    }

    // Render Roles Reveal Table
    if (rolesRevealTbody) {
        let rowsHtml = '';
        const rawPlayers = summary.players || {};
        const playerList = Array.isArray(rawPlayers) ? rawPlayers : Object.values(rawPlayers);
        const sortedPlayers = [...playerList].sort((a, b) => a.name.localeCompare(b.name));

        sortedPlayers.forEach(p => {
            let roleBadge = '';
            if (p.hasBeenWitch || p.role === 'Witch' || p.isWitch) {
                roleBadge = '<span class="role-tag witch">ปอบ 🧙‍♀️</span>';
            } else if (p.isConstable || p.role === 'Constable') {
                roleBadge = '<span class="role-tag constable">หมอผี 🛡️</span>';
            } else {
                roleBadge = '<span class="role-tag town">ชาวบ้าน 🌾</span>';
            }

            const statusText = p.alive
                ? '<span style="color:#81c784;font-weight:600;">รอดชีวิต</span>'
                : '<span style="color:#e57373;font-weight:600;">เสียชีวิต</span>';

            const tryalCards = Array.isArray(p.tryalCards) ? p.tryalCards : [];
            const tryalPills = tryalCards.map(tc => {
                const cardName = typeof tc === 'string' ? tc : tc.name;
                let pillClass = 'not-witch';
                let cardTh = displayCardName(cardName);
                if (cardName === 'Witch') {
                    pillClass = 'witch';
                    cardTh = 'ปอบ';
                } else if (cardName === 'Constable') {
                    pillClass = 'constable';
                    cardTh = 'หมอผี';
                }
                return `<span class="tryal-pill ${pillClass}">${cardTh}</span>`;
            }).join('');

            rowsHtml += `
                <tr>
                    <td style="font-weight:600;">${p.name}</td>
                    <td>${roleBadge}</td>
                    <td>${statusText}</td>
                    <td><div class="tryal-pill-container">${tryalPills || '-'}</div></td>
                </tr>
            `;
        });
        rolesRevealTbody.innerHTML = rowsHtml;
    }

    // Rematch Actions
    const isMeHost = (currentRoomState && currentRoomState.hostUniqueId === myUniqueId);
    if (rematchBtn) {
        if (isMeHost) {
            rematchBtn.style.display = 'inline-block';
            rematchBtn.onclick = () => {
                if (currentRoomName) {
                    socket.emit('restart game', currentRoomName);
                }
                modal.style.display = 'none';
            };
        } else {
            rematchBtn.style.display = 'none';
        }
    }

    if (rematchWaiting) {
        rematchWaiting.style.display = isMeHost ? 'none' : 'block';
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    modal.style.display = 'flex';
}

function showGameOverStats(roomState) {
    showGameOverModal(roomState.gameSummary || roomState);
}

socket.on('game over summary', (summary) => {
    showGameOverModal(summary);
});

socket.on('game restarted', () => {
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';
    const oldPopup = document.getElementById('game-over-popup');
    if (oldPopup) oldPopup.remove();

    document.body.classList.remove('in-game');
    if (gameSection) gameSection.style.display = 'none';
    if (roomLobbySection) roomLobbySection.style.display = 'block';
    addGameMessage('หัวห้องได้เริ่มรอบใหม่แล้ว! กลับสู่หน้าล็อบบี้', 'green', true);
});

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
    try { sessionStorage.removeItem('currentRoomName'); } catch (e) {}
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
    try { sessionStorage.removeItem('currentRoomName'); } catch (e) {}
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
    if (name && typeof name === 'object') {
        return cardNameMap[name.name] || name.name || '';
    }
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

    // Category Filter Pills Handler
    const filterPills = cardsModal.querySelectorAll('.card-filter-pill');
    const cardItems = cardsModal.querySelectorAll('.card-explain-card');
    filterPills.forEach(function(pill) {
      pill.addEventListener('click', function() {
        filterPills.forEach(function(p) { p.classList.remove('active'); });
        pill.classList.add('active');
        const filterVal = pill.getAttribute('data-filter');
        cardItems.forEach(function(card) {
          if (filterVal === 'all' || card.getAttribute('data-cat') === filterVal) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }
});

// --- Custom Tooltip for all elements with title attribute ---
(function() {
  let tooltipDiv = null;
  function showTooltip(e) {
    const text = this.getAttribute('title');
    if (!text) return;
    this.setAttribute('data-original-title', text);
    this.removeAttribute('title');
    if (!tooltipDiv) {
      tooltipDiv = document.createElement('div');
      tooltipDiv.className = 'custom-tooltip';
      document.body.appendChild(tooltipDiv);
    }
    tooltipDiv.textContent = text;
    tooltipDiv.classList.add('show');
    // Always show above the card
    const rect = this.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;
    const margin = 8;
    // Temporarily show to get height
    tooltipDiv.style.top = '0px';
    tooltipDiv.style.left = '0px';
    const tooltipRect = tooltipDiv.getBoundingClientRect();
    let top = rect.top + scrollY - tooltipRect.height - margin;
    let left = rect.left + scrollX + rect.width/2 - tooltipRect.width/2;
    // Clamp top
    if (top < scrollY) top = scrollY + margin;
    // Clamp left/right
    if (left < scrollX) left = scrollX + margin;
    if (left + tooltipRect.width > window.innerWidth + scrollX) {
      left = window.innerWidth + scrollX - tooltipRect.width - margin;
    }
    tooltipDiv.style.top = top + 'px';
    tooltipDiv.style.left = left + 'px';
  }
  function hideTooltip(e) {
    if (this.getAttribute('data-original-title')) {
      this.setAttribute('title', this.getAttribute('data-original-title'));
      this.removeAttribute('data-original-title');
    }
    if (tooltipDiv) {
      tooltipDiv.classList.remove('show');
      tooltipDiv.textContent = '';
    }
  }
  document.addEventListener('mouseover', function(e) {
    let el = e.target;
    while (el && el !== document.body) {
      if (el.hasAttribute('title')) {
        showTooltip.call(el, e);
        el.addEventListener('mouseleave', hideTooltip, { once: true });
        break;
      }
      el = el.parentElement;
    }
  });
})();

drawCardButton.setAttribute('title', 'เมื่อจั่วการ์ดแล้วจบเทิร์นทันที');
playCardButton.setAttribute('title', 'เลือกการ์ดในมือก่อนแล้วกดปุ่มนี้เพื่อใช้การ์ด');
endTurnButton.setAttribute('title', 'กดปุ่มนี้เพื่อจบเทิร์นหลังเล่นการ์ด');

// Helper: แปลงชื่อเฟสเป็นภาษาไทย
function getPhaseNameTH(phase) {
  switch (phase) {
    case 'DAY': return 'กลางวัน';
    case 'NIGHT': return 'กลางคืน';
    case 'PRE_DAWN': return 'ก่อนรุ่งสาง';
    case 'GAME_OVER': return 'จบเกม';
    case 'LOBBY': return 'รอล็อบบี้';
    default: return phase;
  }
}

function updateWitchChatTeamList() {
  const witchTeamDiv = document.getElementById('witch-team-list');
  if (!witchTeamDiv) return;
  if (!currentRoomState || !currentRoomState.players) {
    witchTeamDiv.innerHTML = '';
    return;
  }
  const witches = Object.values(currentRoomState.players).filter(p => p.hasBeenWitch);
  witchTeamDiv.innerHTML = '<b>ทีมปอบ:</b> ' + witches.map(p => p.isWitch ? `<span style="color:#ff1744;font-weight:bold;">${p.name}</span>` : `<span style="color:#ffd700;">${p.name}</span>`).join(', ');
}

// --- Overlay interaction for music start ---
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('music-overlay');
    const enterBtn = document.getElementById('enter-village-btn');
    // แสดง overlay เฉพาะหน้าแรก (ก่อน join/create lobby)
    let hasEnteredVillage = false;
    if (overlay) {
        // Hide overlay permanently afterเข้า lobby ครั้งแรก
        window.hideMusicOverlayIfNeeded = function(phase) {
            if (phase && phase !== 'LOBBY') {
                overlay.style.display = 'none';
                hasEnteredVillage = true;
            }
        };
    }
    if (overlay && enterBtn) {
        enterBtn.addEventListener('click', () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 500);
            // บังคับเปิดเพลง lobby-music แค่ตอนนี้เท่านั้น (ก่อนเข้า lobby/game)
            if (!isMusicPlaying) {
                if (!backgroundMusic.src || !backgroundMusic.src.includes('lobby-music.mp3')) {
                    backgroundMusic.src = 'audio/lobby-music.mp3';
                }
                backgroundMusic.play().then(()=>{
                    isMusicPlaying = true;
                    hasUserStartedMusic = true; // เซ็ต flag ว่า user เคยกดเริ่มเพลงเองแล้ว
                    updateMusicUI();
                }).catch(()=>{});
            } else {
                hasUserStartedMusic = true; // เซ็ต flag แม้จะเล่นอยู่แล้ว
            }
            hasEnteredVillage = true;
        });
    }
    // ถ้า reload แล้วอยู่ใน lobby/game ไม่ต้องแสดง overlay
    socket.on('room state update', (roomState) => {
        if (window.hideMusicOverlayIfNeeded) {
            window.hideMusicOverlayIfNeeded(roomState.currentPhase);
        }
    });
});

// --- Death Notification Modal ---
function showDeathNoticeModal() {
    const existing = document.getElementById('death-notice-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'death-notice-overlay';
    overlay.className = 'death-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'death-modal-content';
    modal.innerHTML = `
        <div class="death-modal-icon">🪦</div>
        <h2 class="death-modal-title">คุณเสียชีวิตแล้ว!</h2>
        <div class="death-modal-badge">☠️ เข้าสู่สถานะวิญญาณเร่ร่อน</div>
        <p class="death-modal-desc">
            ชีวิตของคุณในหมู่บ้านต้องคำสาปได้ดับสูญแล้ว...<br>
            คุณไม่สามารถจั่วการ์ด เล่นการ์ด หรือกล่าวหาใครได้อีกต่อไป<br>
            แต่ยังคงสามารถเฝ้าดูชะตากรรมของหมู่บ้านต่อได้ในฐานะวิญญาณ
        </p>
        <button type="button" class="death-modal-close-btn" id="death-modal-close-btn">
            👁️ รับทราบ (เฝ้าดูต่อในฐานะวิญญาณ)
        </button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#death-modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            overlay.remove();
        };
    }
}

// --- Spectator UI Support ---
function updateSpectatorUI(isSpec) {
    let specBanner = document.getElementById('spectator-status-banner');
    if (isSpec) {
        if (!specBanner) {
            specBanner = document.createElement('div');
            specBanner.id = 'spectator-status-banner';
            specBanner.className = 'spectator-status-banner';
            specBanner.innerHTML = '<span>👁️ <strong>โหมดผู้ชม (Spectator)</strong> — คุณกำลังเฝ้าดูการเล่น ไม่สามารถกระทำแอ็กชัน และไม่เห็นบทบาทลับ</span>';
            const gamePage = document.getElementById('game-page');
            if (gamePage) gamePage.insertBefore(specBanner, gamePage.firstChild);
        } else {
            specBanner.style.display = 'flex';
        }
        // Disable hand action controls for spectators
        if (typeof drawCardButton !== 'undefined' && drawCardButton) drawCardButton.disabled = true;
        if (typeof playCardButton !== 'undefined' && playCardButton) playCardButton.disabled = true;
        if (typeof endTurnButton !== 'undefined' && endTurnButton) endTurnButton.disabled = true;
        if (typeof confessButton !== 'undefined' && confessButton) confessButton.disabled = true;
        const gameActions = document.getElementById('game-actions');
        if (gameActions) gameActions.style.display = 'none';
        const confessSection = document.getElementById('confess-section');
        if (confessSection) confessSection.style.display = 'none';
        const witchChatSection = document.getElementById('witch-chat-section');
        if (witchChatSection) witchChatSection.style.display = 'none';
    } else if (specBanner) {
        specBanner.style.display = 'none';
    }
}

socket.on('joined as spectator', ({ roomName, name }) => {
    isSpectatorMode = true;
    addGameMessage(`👁️ คุณเข้าร่วมในฐานะผู้ชมของห้อง ${roomName}`, 'gray', true);
    updateSpectatorUI(true);
});

// --- Witch Card Popup Logic ---
function showWitchPopup(fromName) {
    // ถ้าเคยกดเข้าใจแล้ว ไม่ต้องแสดง popup อีก
    if (localStorage.getItem('witchPopupAcknowledged') === '1') return;
    const popup = document.getElementById('witch-popup');
    const desc = document.getElementById('witch-popup-desc');
    const fromElem = document.getElementById('witch-popup-from');
    const closeBtn = document.getElementById('witch-popup-close');
    if (popup && desc && closeBtn) {
        // เพิ่มบรรทัดแสดงชื่อผู้ส่งการ์ดปอบ
        if (fromElem) {
            fromElem.innerHTML = fromName && fromName !== '...' ? `คุณได้รับการ์ดปอบจาก <b>${fromName}</b>` : '';
            fromElem.style.display = fromName && fromName !== '...' ? 'block' : 'none';
        }
        desc.innerHTML = `คุณได้การ์ดปอบจาก ...<br>คุณจะกลายเป็นทีมปอบ จะต้องช่วยเหลือปอบในการกำจัดชาวบ้าน หรือปกป้องการ์ดปอบเพื่อแพร่เชื้อ`;
        popup.style.display = 'flex';
        closeBtn.onclick = () => {
            popup.style.display = 'none';
            localStorage.setItem('witchPopupAcknowledged', '1');
        };
    }
}

document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('enter-village-btn');
  var modal = document.getElementById('music-overlay');
  if (btn && modal) {
    btn.onclick = function() {
      modal.classList.add('hidden');
    };
  }
});

// Track if player has drawn a card this turn
let hasDrawnCardThisTurn = false;

// When player draws a card
socket.on('update hand', (hand) => {
    // ... existing code ...
    if (isMyTurn && !hasDrawnCardThisTurn && hand.length > myCurrentHand.length) {
        hasDrawnCardThisTurn = true;
        updateTurnUI();
    }
    myCurrentHand = hand;
    updateHandDisplay(myCurrentHand);
});

// When player plays a card
function afterPlayCard() {
    hasPlayedCardsThisTurn = true;
    updateTurnUI();
}

// Listen for card played successfully event from server
socket.on('card played successfully', () => {
    hasPlayedCardsThisTurn = true;
    updateTurnUI();
});

// --- พิธีเซ่นไหว้: เลือกการ์ดชีวิตของผู้ถือเครื่องเซ่น ---
socket.on('prompt select blackcat tryal', ({ blackCatHolder, tryalCount, blackCatHolderName, fromConspiracyDraw = false }) => {
    // Remove existing popup if any
    const existing = document.getElementById('select-blackcat-tryal-popup');
    if (existing) existing.remove();
    const oldPopup = document.getElementById('blackcat-tryal-select-popup');
    if (oldPopup) oldPopup.remove();
    const existingOverlay = document.getElementById('select-blackcat-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'select-blackcat-overlay';
    overlay.className = 'tryal-modal-overlay';

    const popup = document.createElement('div');
    popup.id = 'select-blackcat-tryal-popup';
    popup.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = fromConspiracyDraw
        ? '🕯️ การ์ดพิธีเซ่นไหว้: ต้องเปิดการ์ดชีวิตของผู้ถือเครื่องเซ่น'
        : '🐱 เลือกการ์ดชีวิตของผู้ถือเครื่องเซ่นเพื่อเปิดเผย';
    popup.appendChild(title);

    const holderName = blackCatHolderName || (currentRoomState && currentRoomState.players && currentRoomState.players[blackCatHolder] && currentRoomState.players[blackCatHolder].name) || 'ไม่ทราบชื่อ';
    const subtitle = document.createElement('p');
    subtitle.innerHTML = `ผู้ถือการ์ดเครื่องเซ่นในปัจจุบัน: <b style="color:#ffb74d;">${holderName}</b>`;
    subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
    popup.appendChild(subtitle);

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    for (let i = 0; i < tryalCount; i++) {
        const cardBtn = document.createElement('button');
        cardBtn.className = 'tryal-card-btn';
        cardBtn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i + 1}</span>`;
        cardBtn.onclick = () => {
            socket.emit('select blackcat tryal', blackCatHolder, i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
        };
        cardsDiv.appendChild(cardBtn);
    }

    popup.appendChild(cardsDiv);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
});

function showWitchPopup(senderName) {
    // Remove existing popup if any
    const existing = document.getElementById('witch-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'witch-popup';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(20,10,20,0.92)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const cardImg = document.createElement('img');
    cardImg.src = 'cards/witch.png';
    cardImg.alt = 'ปอบ';
    cardImg.style.width = '160px';
    cardImg.style.height = '220px';
    cardImg.style.marginBottom = '18px';
    cardImg.style.boxShadow = '0 0 32px #ff1744cc';
    overlay.appendChild(cardImg);

    const title = document.createElement('div');
    title.textContent = 'คุณได้รับการ์ดปอบ!';
    title.style.color = '#ff1744';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '2em';
    title.style.marginBottom = '12px';
    overlay.appendChild(title);

    // เพิ่มชื่อผู้ส่งถ้ามี
    if (senderName && senderName !== '...') {
        const fromDiv = document.createElement('div');
        fromDiv.textContent = `คุณได้รับการ์ดปอบจาก ${senderName}`;
        fromDiv.style.color = '#ffd180';
        fromDiv.style.fontWeight = 'bold';
        fromDiv.style.fontSize = '1.15em';
        fromDiv.style.marginBottom = '10px';
        overlay.appendChild(fromDiv);
    }

    const desc = document.createElement('div');
    desc.innerHTML = 'คุณจะกลายเป็นทีมปอบ จะต้องช่วยเหลือปอบในการกำจัดชาวบ้าน หรือปกป้องการ์ดปอบเพื่อแพร่เชื้อ';
    desc.style.color = '#ffe0b2';
    desc.style.fontSize = '1.1em';
    desc.style.marginBottom = '28px';
    desc.style.textAlign = 'center';
    overlay.appendChild(desc);

    const btn = document.createElement('button');
    btn.textContent = 'เข้าใจแล้ว';
    btn.style.fontSize = '1.25em';
    btn.style.background = 'linear-gradient(90deg, #ff9800 60%, #ff5722 100%)';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.padding = '14px 38px';
    btn.style.fontWeight = 'bold';
    btn.style.boxShadow = '0 2px 16px #ff572288';
    btn.style.cursor = 'pointer';
    btn.onclick = () => {
        overlay.remove();
    };
    overlay.appendChild(btn);

    document.body.appendChild(overlay);
}

// เมื่อเลือกเป้าหมาย Curse จาก popup (select curse target)
socket.on('prompt select curse target', ({ targetUniqueId, blueCards }) => {
    // ... popup code ...
    // เมื่อเลือกการ์ดแล้ว
    // ...
    // หลังจากเลือกแล้วให้ disable drawCardButton
    drawCardButton.disabled = true;
});

socket.on('card used on you', (senderName, cardName, cardDesc) => {
    console.log('[DEBUG] card used on you', senderName, cardName, cardDesc);
    // Remove existing popup if any
    const old = document.getElementById('card-used-on-you-popup');
    if (old) old.remove();
    
    const popup = document.createElement('div');
    popup.id = 'card-used-on-you-popup';
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.background = '#232323';
    popup.style.color = '#fff';
    popup.style.padding = '28px 24px 18px 24px';
    popup.style.borderRadius = '16px';
    popup.style.boxShadow = '0 0 32px #000a';
    popup.style.zIndex = '99999';
    popup.style.textAlign = 'center';
    popup.style.minWidth = '260px';
    popup.style.maxWidth = '90vw';
    popup.style.fontSize = '1.08em';

    // ปุ่มปิด
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '14px';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#fff';
    closeBtn.style.fontSize = '1.3em';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => { if (document.body.contains(popup)) popup.remove(); };
    popup.appendChild(closeBtn);

    // ข้อความ
    const msg = document.createElement('div');
    msg.innerHTML = `<b style='color:#ff9800;'>${senderName}</b> <span style='color:#fff;'>ใช้การ์ดใส่คุณ</span>`;
    msg.style.marginBottom = '10px';
    msg.style.fontWeight = 'bold';
    popup.appendChild(msg);

    // รูปการ์ด
    const cardImg = createCardImage(cardName);
    cardImg.style.width = '90px';
    cardImg.style.height = '130px';
    cardImg.style.margin = '0 0 10px 0';
    cardImg.style.display = 'block';
    cardImg.style.marginLeft = 'auto';
    cardImg.style.marginRight = 'auto';
    // --- เพิ่มขอบสีตามประเภทการ์ด ---
    const cardColorMap = {
        'Accusation': 'Red', 'Evidence': 'Red', 'Witness': 'Red',
        'Alibi': 'Green', 'Stocks': 'Green', 'Arson': 'Green', 'Curse': 'Green', 'Scapegoat': 'Green', 'Robbery': 'Green',
        'Black Cat': 'Blue', 'Asylum': 'Blue', 'Piety': 'Blue', 'Matchmaker': 'Blue',
        'Conspiracy': 'Gold',
    };
    const borderColorMap = {
        'Red': '#e53935',
        'Green': '#43a047',
        'Blue': '#1976d2',
        'Gold': '#ffb300',
        'Black': '#333',
    };
    const colorKey = cardColorMap[cardName] || 'Black';
    cardImg.style.border = `3px solid ${borderColorMap[colorKey] || '#333'}`;
    cardImg.style.borderRadius = '8px';
    // ---
    popup.appendChild(cardImg);

    // ชื่อการ์ด
    const cardTitle = document.createElement('div');
    cardTitle.textContent = displayCardName(cardName);
    cardTitle.style.color = '#ff9800';
    cardTitle.style.fontWeight = 'bold';
    cardTitle.style.fontSize = '1.1em';
    cardTitle.style.marginBottom = '6px';
    popup.appendChild(cardTitle);

    // คำอธิบายการ์ด
    const desc = document.createElement('div');
    desc.textContent = cardDesc || displayCardDescription(cardName);
    desc.style.color = '#fff';
    desc.style.fontSize = '0.98em';
    desc.style.marginBottom = '2px';
    popup.appendChild(desc);

    document.body.appendChild(popup);
    // ปิดอัตโนมัติหลัง 5 วินาที
    const timer = setTimeout(() => { if (document.body.contains(popup)) popup.remove(); }, 5000);
    // ถ้ากดปิดเอง ให้ clearTimeout
    closeBtn.addEventListener('click', () => clearTimeout(timer));
});

// --- Popup เลือกการ์ดแดงสำหรับ Alibi ---
function showAlibiRedCardSelectionPopup(targetUniqueId, redCards) {
    if (document.getElementById('alibi-redcard-select-popup')) return;
    const container = document.createElement('div');
    container.id = 'alibi-redcard-select-popup';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.background = '#222';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 0 30px #000a';
    container.style.padding = '28px 24px 18px 24px';
    container.style.zIndex = '9999';
    container.style.textAlign = 'center';
    
    const title = document.createElement('div');
    title.textContent = 'เลือกการ์ดข้อกล่าวหาที่จะลบ (เลือกได้ชนิดเดียว, แต้มรวมไม่เกิน 3)';
    title.style.color = '#ffe799';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '1.18em';
    title.style.marginBottom = '18px';
    container.appendChild(title);

    // Group red cards by type
    const accCards = redCards.filter(c => c.name === 'Accusation');
    const evidenceCards = redCards.filter(c => c.name === 'Evidence');
    // (ถ้ามี Witness ก็เพิ่มได้)
    // const witnessCards = redCards.filter(c => c.name === 'Witness');

    // State
    let selectedType = null; // 'Accusation' หรือ 'Evidence'
    let selectedIndexes = [];

    // Card list section
    const cardListDiv = document.createElement('div');
    cardListDiv.style.display = 'flex';
    cardListDiv.style.justifyContent = 'center';
    cardListDiv.style.gap = '18px';
    cardListDiv.style.margin = '18px 0';

    // Helper: render card buttons
    function renderCardButtons() {
        cardListDiv.innerHTML = '';
        // Show only one type at a time
        let cardsToShow = [];
        if (selectedType === 'Accusation') cardsToShow = accCards;
        else if (selectedType === 'Evidence') cardsToShow = evidenceCards;
        // else if (selectedType === 'Witness') cardsToShow = witnessCards;
        cardsToShow.forEach((card, idx) => {
            const cardBtn = document.createElement('button');
            cardBtn.textContent = `${displayCardName(card.name)} (+${card.value})`;
            cardBtn.style.width = '90px';
            cardBtn.style.height = '120px';
            cardBtn.style.fontSize = '1.08em';
            cardBtn.style.fontWeight = 'bold';
            cardBtn.style.background = card.name === 'Accusation' ? '#b71c1c' : '#6d4c41';
            cardBtn.style.color = '#fff';
            cardBtn.style.borderRadius = '10px';
            cardBtn.style.boxShadow = '0 4px 18px #a97c5088';
            cardBtn.style.cursor = 'pointer';
            cardBtn.style.margin = '0 6px';
            cardBtn.style.opacity = selectedIndexes.includes(card.index) ? '1' : '0.7';
            cardBtn.onclick = () => {
                if (selectedType === 'Accusation') {
                    // toggle select, max 3
                    if (selectedIndexes.includes(card.index)) {
                        selectedIndexes = selectedIndexes.filter(i => i !== card.index);
                    } else if (selectedIndexes.length < 3) {
                        selectedIndexes.push(card.index);
                    }
                } else if (selectedType === 'Evidence') {
                    selectedIndexes = [card.index]; // evidence เลือกได้แค่ 1
                }
                renderCardButtons();
                updateConfirmBtn();
            };
            if (selectedType === 'Accusation' && selectedIndexes.length >= 3 && !selectedIndexes.includes(card.index)) {
                cardBtn.disabled = true;
                cardBtn.style.opacity = '0.4';
            }
            if (selectedType === 'Evidence' && selectedIndexes.length >= 1 && !selectedIndexes.includes(card.index)) {
                cardBtn.disabled = true;
                cardBtn.style.opacity = '0.4';
            }
            cardListDiv.appendChild(cardBtn);
        });
    }

    // Type selector
    const typeSelectorDiv = document.createElement('div');
    typeSelectorDiv.style.display = 'flex';
    typeSelectorDiv.style.justifyContent = 'center';
    typeSelectorDiv.style.gap = '24px';
    typeSelectorDiv.style.marginBottom = '10px';
    // Accusation
    const accBtn = document.createElement('button');
    accBtn.textContent = `ข้อกล่าวหา (+1) x${accCards.length}`;
    accBtn.style.background = selectedType === 'Accusation' ? '#b71c1c' : '#444';
    accBtn.style.color = '#fff';
    accBtn.style.fontWeight = 'bold';
    accBtn.style.borderRadius = '8px';
    accBtn.style.padding = '8px 18px';
    accBtn.onclick = () => {
        selectedType = 'Accusation';
        selectedIndexes = [];
        accBtn.style.background = '#b71c1c';
        evidenceBtn.style.background = '#444';
        renderCardButtons();
        updateConfirmBtn();
    };
    typeSelectorDiv.appendChild(accBtn);
    // Evidence
    const evidenceBtn = document.createElement('button');
    evidenceBtn.textContent = `หลักฐาน (+3) x${evidenceCards.length}`;
    evidenceBtn.style.background = selectedType === 'Evidence' ? '#6d4c41' : '#444';
    evidenceBtn.style.color = '#fff';
    evidenceBtn.style.fontWeight = 'bold';
    evidenceBtn.style.borderRadius = '8px';
    evidenceBtn.style.padding = '8px 18px';
    evidenceBtn.onclick = () => {
        selectedType = 'Evidence';
        selectedIndexes = [];
        accBtn.style.background = '#444';
        evidenceBtn.style.background = '#6d4c41';
        renderCardButtons();
        updateConfirmBtn();
    };
    typeSelectorDiv.appendChild(evidenceBtn);
    container.appendChild(typeSelectorDiv);
    container.appendChild(cardListDiv);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'ยืนยันการลบ';
    confirmBtn.style.background = '#ff9800';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.fontSize = '1.1em';
    confirmBtn.style.borderRadius = '8px';
    confirmBtn.style.marginTop = '18px';
    confirmBtn.style.padding = '10px 28px';
    confirmBtn.disabled = true;
    confirmBtn.onclick = () => {
        if (selectedIndexes.length > 0) {
            socket.emit('select alibi removal', { targetUniqueId, selectedIndexes });
            document.body.removeChild(container);
        }
    };
    container.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.background = '#888';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '1.1em';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.marginLeft = '16px';
    cancelBtn.style.marginTop = '18px';
    cancelBtn.style.padding = '10px 28px';
    cancelBtn.onclick = () => {
        // ส่ง event ยกเลิกไปยัง server
        socket.emit('cancel alibi selection');
        document.body.removeChild(container);
    };
    container.appendChild(cancelBtn);

    // Helper: update confirm button state
    function updateConfirmBtn() {
        if (selectedType === 'Accusation') {
            confirmBtn.disabled = selectedIndexes.length === 0 || selectedIndexes.length > 3;
        } else if (selectedType === 'Evidence') {
            confirmBtn.disabled = selectedIndexes.length !== 1;
        } else {
            confirmBtn.disabled = true;
        }
    }

    document.body.appendChild(container);
}

socket.on('prompt select alibi removal', ({ targetUniqueId, redCards }) => {
    showAlibiRedCardSelectionPopup(targetUniqueId, redCards);
});
