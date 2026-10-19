const { io } = require('socket.io-client');

const TARGET_CARDS = new Set([
    'Accusation', 'Evidence', 'Witness', 'Curse', 'Alibi', 'Robbery',
    'Stocks', 'Arson', 'Scapegoat', 'Asylum', 'Piety', 'Matchmaker', 'Black Cat',
]);
const TWO_TARGET_CARDS = new Set(['Robbery', 'Scapegoat']);

function pickRandom(items) {
    return items.length ? items[Math.floor(Math.random() * items.length)] : null;
}

function createBotClient({ url, uniqueId, token, name }) {
    const socket = io(url, {
        auth: { botToken: token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
    });
    const timers = new Map();
    let roomState = null;
    let hand = [];
    let tryalCards = [];

    function later(key, callback, delay = 350 + Math.floor(Math.random() * 500)) {
        if (timers.has(key)) return;
        const timer = setTimeout(() => {
            timers.delete(key);
            callback();
        }, delay);
        timers.set(key, timer);
    }

    function clearTimers() {
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
    }

    function currentBot() {
        return roomState?.players?.[uniqueId];
    }

    function aliveOthers() {
        return Object.values(roomState?.players || {}).filter(player => player.alive && player.uniqueId !== uniqueId);
    }

    function submitDayAction() {
        const me = currentBot();
        if (!roomState?.gameStarted || roomState.gameOver || roomState.currentPhase !== 'DAY' ||
            roomState.currentTurnPlayerUniqueId !== uniqueId || !me?.alive || me.hasPlayedCardsThisTurn) return;

        const candidate = chooseCardAction();
        if (candidate && Math.random() < 0.55) {
            socket.emit('play card', candidate.cardIndex, candidate.targetId, candidate.secondTargetId);
            later('day-fallback', () => {
                const updatedMe = currentBot();
                if (roomState?.currentPhase === 'DAY' && roomState.currentTurnPlayerUniqueId === uniqueId &&
                    updatedMe?.alive && !updatedMe.hasPlayedCardsThisTurn) {
                    socket.emit('draw cards');
                }
            }, 1200);
        } else {
            socket.emit('draw cards');
        }
    }

    function chooseCardAction() {
        const others = aliveOthers();
        const allAlive = Object.values(roomState?.players || {}).filter(player => player.alive);
        const candidates = [];

        hand.forEach((card, cardIndex) => {
            if (!card?.name) return;
            if (!TARGET_CARDS.has(card.name)) {
                candidates.push({ cardIndex });
                return;
            }

            let targets = others;
            if (['Accusation', 'Evidence', 'Witness'].includes(card.name)) {
                targets = others.filter(player => !player.inPlayCards?.some(effect => effect.name === 'Piety'));
            } else if (card.name === 'Curse') {
                targets = others.filter(player => player.inPlayCards?.some(effect => effect.color === 'Blue'));
            } else if (card.name === 'Alibi') {
                targets = others.filter(player => player.inPlayCards?.some(effect => effect.color === 'Red'));
            } else if (card.name === 'Robbery') {
                targets = others.filter(player => player.handSize > 0);
            }
            if (!targets.length) return;

            if (TWO_TARGET_CARDS.has(card.name)) {
                const source = pickRandom(targets);
                const destinations = allAlive.filter(player => player.uniqueId !== uniqueId && player.uniqueId !== source.uniqueId);
                const destination = pickRandom(destinations);
                if (source && destination) {
                    candidates.push({ cardIndex, targetId: source.uniqueId, secondTargetId: destination.uniqueId });
                }
            } else {
                const target = pickRandom(targets);
                if (target) candidates.push({ cardIndex, targetId: target.uniqueId });
            }
        });

        return pickRandom(candidates);
    }

    socket.on('connect', () => socket.emit('register uniqueId', uniqueId, name));
    socket.on('room state update', state => {
        roomState = state;
        const me = currentBot();
        if (!me || !state.gameStarted || state.gameOver) return;

        const witchNight = state.witchNightState;
        if (state.currentPhase === 'NIGHT' && witchNight && !witchNight.committed &&
            witchNight.members?.every(member => member.isBot) &&
            Object.prototype.hasOwnProperty.call(witchNight.marks || {}, uniqueId)) {
            const nightId = witchNight.nightId;
            later('witch-confirm', () => {
                const latest = roomState?.witchNightState;
                if (roomState?.currentPhase !== 'NIGHT' || !latest || latest.nightId !== nightId || latest.committed ||
                    !latest.members?.every(member => member.isBot) ||
                    !Object.prototype.hasOwnProperty.call(latest.marks || {}, uniqueId)) return;
                socket.emit('witch kill target', latest.marks[uniqueId], { confirmed: true, nightId });
            }, 1500);
        }

        if (state.currentPhase === 'PRE_DAWN' && state.confessionOrder?.[state.currentConfessionIndex] === uniqueId &&
            !(state.confessionActions || []).includes(uniqueId)) {
            later('confession', () => {
                if (roomState?.currentPhase !== 'PRE_DAWN' || roomState.confessionOrder?.[roomState.currentConfessionIndex] !== uniqueId) return;
                if (tryalCards.length > 0 && Math.random() < 0.5) {
                    socket.emit('confess during night', Math.floor(Math.random() * tryalCards.length));
                } else {
                    socket.emit('skip confession');
                }
            });
        }

        if (state.currentPhase === 'DAY' && state.currentTurnPlayerUniqueId === uniqueId && me.alive && me.hasPlayedCardsThisTurn) {
            later('end-turn', () => {
                if (roomState?.currentPhase === 'DAY' && roomState.currentTurnPlayerUniqueId === uniqueId && currentBot()?.hasPlayedCardsThisTurn) {
                    socket.emit('end turn');
                }
            }, 650);
        }
    });
    socket.on('update hand', cards => { hand = Array.isArray(cards) ? cards : []; });
    socket.on('update tryal cards initial', cards => { tryalCards = Array.isArray(cards) ? cards : []; });

    socket.on('your turn', () => later('day-turn', submitDayAction));

    socket.on('popup assign black cat', potentialTargets => {
        later('assign-black-cat', () => {
            const target = pickRandom(potentialTargets || []);
            if (target) socket.emit('assign black cat', target.uniqueId);
        });
    });

    socket.on('prompt witch kill', () => {
        later('witch-action', () => {
            const targets = aliveOthers().filter(player =>
                !player.hasBeenWitch && !player.inPlayCards?.some(card => card.name === 'Asylum'));
            const target = pickRandom(targets);
            socket.emit('witch mark target', target?.uniqueId || null, roomState?.witchNightState?.nightId);
        });
    });

    socket.on('prompt constable action', () => {
        later('constable-action', () => {
            const target = pickRandom(aliveOthers());
            socket.emit('constable action', target?.uniqueId || null);
        });
    });

    socket.on('prompt select accused tryal', ({ accusedUniqueId, tryalCount } = {}) => {
        later('accused-tryal', () => {
            const count = Math.min(Number(tryalCount) || 0, tryalCards.length);
            if (count > 0) socket.emit('select tryal card for confession', accusedUniqueId, Math.floor(Math.random() * count));
        });
    });

    socket.on('prompt select blackcat tryal', ({ blackCatHolder, tryalCount } = {}) => {
        later('blackcat-tryal', () => {
            const count = Math.min(Number(tryalCount) || 0, roomState?.players?.[blackCatHolder]?.tryalCardCount || 0);
            if (count > 0) socket.emit('select blackcat tryal', blackCatHolder, Math.floor(Math.random() * count));
        });
    });

    socket.on('prompt select left tryal', ({ leftPlayerTryalCount } = {}) => {
        later('left-tryal', () => {
            const count = Number(leftPlayerTryalCount) || 0;
            socket.emit('select left tryal', count > 0 ? Math.floor(Math.random() * count) : 0);
        });
    });

    socket.on('prompt select curse target', ({ targetUniqueId, blueCards } = {}) => {
        later('curse-selection', () => {
            const count = Array.isArray(blueCards) ? blueCards.length : 0;
            if (count > 0) socket.emit('select curse target', targetUniqueId, Math.floor(Math.random() * count));
        });
    });

    socket.on('prompt select alibi removal', ({ redCards } = {}) => {
        later('alibi-selection', () => {
            const validCards = (redCards || []).filter(card => Number(card.value || 1) <= 3);
            const card = pickRandom(validCards);
            if (card) socket.emit('select alibi removal', { selectedIndexes: [card.index] });
        });
    });

    socket.on('game over summary', clearTimers);
    socket.on('game restarted', () => {
        hand = [];
        tryalCards = [];
        clearTimers();
    });
    socket.on('disconnect', clearTimers);
    return socket;
}

module.exports = { createBotClient };
