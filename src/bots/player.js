const { io } = require('socket.io-client');

const { alliesFor, chooseCardAction, chooseNightTarget, chooseProtectedTarget } = require('./strategy');

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
    let handReceived = false, turnKey = null, stopPlayingThisTurn = false, inFlight = false, responseSeen = false;
    let suspicion = {};

    function later(key, callback, delay = 900 + Math.floor(Math.random() * 700)) {
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
    function clearTimer(key) {
        if (timers.has(key)) clearTimeout(timers.get(key));
        timers.delete(key);
    }

    function currentBot() {
        return roomState?.players?.[uniqueId];
    }

    function submitDayAction() {
        const me = currentBot();
        if (!roomState?.gameStarted || roomState.gameOver || roomState.currentPhase !== 'DAY' ||
            roomState.currentTurnPlayerUniqueId !== uniqueId || !me?.alive || !handReceived ||
            roomState.pendingCardAction || inFlight) return;
        const candidate = !stopPlayingThisTurn ? chooseCardAction({state:roomState, id:uniqueId, hand, suspicion}) : null;
        if (!candidate || candidate.score < 4) {
            socket.emit(me.hasPlayedCardsThisTurn ? 'end turn' : 'draw cards');
            return;
        }
        inFlight = true; responseSeen = false;
        if (candidate.kind === 'red') socket.emit('play red cards', candidate.indexes, candidate.targetId);
        else socket.emit('play card', candidate.cardIndex, candidate.targetId, candidate.secondTargetId);
        // Recover if a target changed or the server rejected a choice silently.
        const recover = () => {
            const bot = currentBot();
            if (!inFlight || roomState?.currentPhase !== 'DAY' || roomState.currentTurnPlayerUniqueId !== uniqueId ||
                !bot?.alive) return;
            if (roomState.pendingCardAction) { later('day-watchdog', recover, 2500);return; }
            inFlight = false; stopPlayingThisTurn = true;
            later('day-turn', submitDayAction, 200);
        };
        later('day-watchdog', recover, 2500);
    }

    socket.on('connect', () => socket.emit('register uniqueId', uniqueId, name));
    socket.on('room state update', state => {
        roomState = state;
        const me = currentBot();
        if (!me || !state.gameStarted || state.gameOver) return;
        const nextTurnKey = `${state.name}:${state.turnSerial || 0}:${state.currentTurnPlayerUniqueId}`;
        if (nextTurnKey !== turnKey) {
            turnKey = nextTurnKey; stopPlayingThisTurn = false; inFlight = false; responseSeen = false;
            clearTimer('day-turn');clearTimer('day-watchdog');
        }
        if (state.currentPhase !== 'DAY') { inFlight = false;responseSeen = false;clearTimer('day-watchdog'); }
        if (inFlight && responseSeen && !state.pendingCardAction) {
            inFlight = false;responseSeen = false;clearTimer('day-watchdog');
        }

        if (state.currentPhase === 'SETUP' && state.lifeSetup?.stage === 'arrange' && !state.lifeSetup.confirmed.includes(uniqueId)) {
            const setupId = state.lifeSetup.id;
            later('life-setup', () => {
                if (roomState?.currentPhase === 'SETUP' && roomState.lifeSetup?.id === setupId && roomState.lifeSetup.stage === 'arrange') socket.emit('confirm life setup', setupId);
            }, 1000);
        }
        if (state.currentPhase === 'DAY' && state.currentTurnPlayerUniqueId === uniqueId && me.alive && !state.pendingCardAction && !inFlight) {
            later('day-turn', submitDayAction);
        }
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

        if (state.currentPhase === 'PRE_DAWN' && state.confessionOrder?.includes(uniqueId) &&
            !(state.confessionActions || []).includes(uniqueId)) {
            later('confession', () => {
                if (roomState?.currentPhase !== 'PRE_DAWN' || !roomState.confessionOrder?.includes(uniqueId) || roomState.confessionActions?.includes(uniqueId)) return;
                const safeIndex = tryalCards.findIndex(card => card.name === 'Not A Witch');
                if (tryalCards.length > 1 && safeIndex >= 0 && Math.random() < 0.5) {
                    socket.emit('confess during night', safeIndex);
                } else {
                    socket.emit('skip confession');
                }
            });
        }

    });
    socket.on('update hand', cards => {
        hand = Array.isArray(cards) ? cards : [];handReceived = true;
        if (roomState?.currentPhase === 'DAY' && roomState.currentTurnPlayerUniqueId === uniqueId && !roomState.pendingCardAction && !inFlight)
            later('day-turn', submitDayAction);
    });
    socket.on('update tryal cards initial', cards => { tryalCards = Array.isArray(cards) ? cards : []; });

    socket.on('your turn', () => later('day-turn', submitDayAction));
    socket.on('card played successfully', () => { if (inFlight) responseSeen = true; });
    socket.on('card play rejected', () => {
        if (!inFlight) return;
        inFlight = false;responseSeen = false;stopPlayingThisTurn = true;clearTimer('day-watchdog');
        later('day-turn', submitDayAction, 250);
    });
    socket.on('card action feedback', event => {
        if (!roomState || !event?.actorId || event.actorId === uniqueId || event.batchIndex > 0 ||
            !['Accusation','Evidence','Witness','Stocks','Arson'].includes(event.cardName)) return;
        if (alliesFor(roomState, uniqueId).allies.has(event.targetId))
            suspicion[event.actorId] = Math.min(5, (suspicion[event.actorId] || 0) + 1);
    });

    socket.on('popup assign black cat', potentialTargets => {
        later('assign-black-cat', () => {
            const allies = alliesFor(roomState || {}, uniqueId).allies;
            const targets = (potentialTargets || []).filter(player => !allies.has(player.uniqueId));
            const target = pickRandom(targets.length ? targets : (potentialTargets || []));
            if (target) socket.emit('assign black cat', target.uniqueId);
        });
    });

    socket.on('prompt witch kill', () => {
        later('witch-action', () => {
            const target = chooseNightTarget(roomState, uniqueId, suspicion);
            socket.emit('witch mark target', target?.uniqueId || null, roomState?.witchNightState?.nightId);
        });
    });

    socket.on('prompt constable action', () => {
        later('constable-action', () => {
            const target = chooseProtectedTarget(roomState, uniqueId);
            socket.emit('constable action', target?.uniqueId || null);
        });
    });

    socket.on('prompt select accused tryal', ({ accusedUniqueId, tryalCount } = {}) => {
        if (inFlight) responseSeen = true;
        later('accused-tryal', () => {
            const count = Math.min(Number(tryalCount) || 0, roomState?.players?.[accusedUniqueId]?.tryalCardCount || 0);
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
        if (inFlight) responseSeen = true;
        later('curse-selection', () => {
            const count = Array.isArray(blueCards) ? blueCards.length : 0;
            if (count > 0) {
                const preferred = blueCards.findIndex(card => ['Piety','Asylum','Black Cat'].includes(card.name));
                socket.emit('select curse target', targetUniqueId, preferred < 0 ? 0 : preferred);
            }
        });
    });

    socket.on('prompt select alibi removal', ({ redCards } = {}) => {
        if (inFlight) responseSeen = true;
        later('alibi-selection', () => {
            const accusations = (redCards || []).filter(card => card.name === 'Accusation').slice(0,3);
            const evidence = (redCards || []).find(card => card.name === 'Evidence');
            const selected = accusations.length === 3 || !evidence ? accusations : [evidence];
            if (selected.length) socket.emit('select alibi removal', { selectedIndexes: selected.map(card => card.index) });
        });
    });

    socket.on('game over summary', clearTimers);
    socket.on('game restarted', () => {
        hand = [];
        tryalCards = [];
        handReceived = false;turnKey = null;stopPlayingThisTurn = false;inFlight = responseSeen = false;suspicion = {};
        clearTimers();
    });
    socket.on('disconnect', () => { clearTimers();handReceived = false;turnKey = null;inFlight = responseSeen = false; });
    return socket;
}

module.exports = { createBotClient };
