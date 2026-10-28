// Integration check: real Socket.IO clients against an isolated ephemeral server.
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io: clientIO } = require('socket.io-client');
const { createGameServer } = require('../src/server/createServer');

const game = createGameServer();
game.server.listen(0, '127.0.0.1');
const clients = [];
const roomName = 'witch-marks-integration';

function waitEvent(socket, event, action, predicate = () => true) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timeout: ${event}`)); }, 4000);
        const listener = data => {
            if (!predicate(data)) return;
            clearTimeout(timeout); socket.off(event, listener); resolve(data);
        };
        socket.on(event, listener);
        action();
    });
}

async function connect(id) {
    const socket = clientIO(`http://127.0.0.1:${game.server.address().port}`, { transports: ['websocket'], autoConnect: false, reconnection: false });
    socket.on('room state update', state => { socket.latestState = state; });
    clients.push(socket);
    await waitEvent(socket, 'connect', () => socket.connect());
    socket.emit('register uniqueId', id, id);
    return socket;
}

async function barrier(socket) {
    await waitEvent(socket, 'game message history', () => socket.emit('request game message history', roomName));
}

async function main() {
    if (!game.server.listening) await once(game.server, 'listening');
    const host = await connect('witch-1');
    await waitEvent(host, 'room joined', () => host.emit('create room', roomName, 'witch-1'));
    const users = [host];
    for (const id of ['witch-2', 'constable', 'town-1', 'town-2', 'town-3']) {
        const socket = await connect(id);
        await waitEvent(socket, 'room joined', () => socket.emit('join room', roomName, id));
        users.push(socket);
    }
    const room = game.rooms[roomName];
    room.gameStarted = true;
    room.dayNumber = 1;
    room.currentPhase = 'DAY';
    room.playersWhoActedAtNight = {};
    for (const player of Object.values(room.players)) {
        player.alive = true;
        player.isWitch = player.uniqueId.startsWith('witch-');
        player.hasBeenWitch = player.isWitch;
        player.isConstable = player.uniqueId === 'constable';
        player.tryalCards = [{ name: player.isWitch ? 'Witch' : player.isConstable ? 'Constable' : 'Not A Witch', type: 'Role' },
            ...Array.from({ length: 4 }, () => ({ name: 'Not A Witch', type: 'Role' }))];
    }
    await waitEvent(host, 'room state update', () => game.changePhase(roomName, 'NIGHT'), state => state.currentPhase === 'NIGHT');
    const nightId = room.witchNightId;
    const spectator = await connect('spectator');
    await waitEvent(spectator, 'room joined', () => spectator.emit('join room', roomName, 'spectator'));
    await barrier(spectator);

    host.emit('witch mark target', 'town-1', nightId);
    await barrier(host);
    users[1].emit('witch mark target', 'town-2', nightId);
    await barrier(users[1]);
    await waitEvent(host, 'room state update', () => game.emitRoomState(roomName));
    assert.equal(room.playersWhoActedAtNight.witchKill, undefined, 'marks must not commit a kill');
    assert.equal(host.latestState.witchNightState.marks['witch-2'], 'town-2');
    assert.equal(users[1].latestState.witchNightState.marks['witch-1'], 'town-1');
    assert.equal(users[3].latestState.witchNightState, null, 'town must not receive marks');
    assert.ok(spectator.latestState.witchNightState == null, 'spectator must not receive marks');
    assert.ok(Object.values(room.players).every(player => player.alive && player.tryalCards.length === 5));

    for (const [target, confirmation] of [
        ['town-1', undefined],
        ['town-1', { confirmed: false, nightId }],
        ['town-1', { confirmed: true, nightId: 'old-night' }],
        ['town-2', { confirmed: true, nightId }],
    ]) {
        host.emit('witch kill target', target, confirmation);
        await barrier(host);
        assert.equal(room.playersWhoActedAtNight.witchKill, undefined, 'unconfirmed, stale or mismatched kill must fail');
    }
    room.players['town-3'].inPlayCards = [{ name: 'Asylum', color: 'Blue' }];
    for (const target of ['witch-1', 'town-3', 'missing-player']) {
        host.emit('witch mark target', target, nightId);
        await barrier(host);
        assert.equal(room.witchNightMarks['witch-1'], 'town-1', 'invalid targets must not replace marks');
    }
    users[3].emit('witch mark target', 'town-2', nightId);
    users[3].emit('witch kill target', 'town-2', { confirmed: true, nightId });
    await barrier(users[3]);
    assert.equal(room.witchNightMarks['town-1'], undefined);
    assert.equal(room.playersWhoActedAtNight.witchKill, undefined);

    room.players['town-1'].inPlayCards = [{ name: 'Asylum', color: 'Blue' }];
    host.emit('witch kill target', 'town-1', { confirmed: true, nightId });
    await barrier(host);
    assert.equal(room.playersWhoActedAtNight.witchKill, undefined, 'recheck protection on final confirmation');
    room.players['town-1'].inPlayCards = [];
    room.players['town-1'].alive = false;
    host.emit('witch kill target', 'town-1', { confirmed: true, nightId });
    await barrier(host);
    assert.equal(room.playersWhoActedAtNight.witchKill, undefined, 'dead target cannot be committed');
    room.players['town-1'].alive = true;

    // Reconnect restores the private marks for the same player.
    const reconnected = await connect('witch-1');
    await barrier(reconnected);
    assert.equal(reconnected.latestState.witchNightState.marks['witch-1'], 'town-1');

    reconnected.emit('witch kill target', 'town-1', { confirmed: true, nightId });
    users[1].emit('witch kill target', 'town-2', { confirmed: true, nightId });
    await Promise.all([barrier(reconnected), barrier(users[1])]);
    const committed = room.playersWhoActedAtNight.witchKill;
    assert.ok(['town-1', 'town-2'].includes(committed));
    assert.equal(room.currentPhase, 'NIGHT', 'wait for the constable after commitment');
    assert.equal(reconnected.latestState.witchNightState.committed, true);
    users[1].emit('witch kill target', 'town-3', { confirmed: true, nightId });
    await barrier(users[1]);
    assert.equal(room.playersWhoActedAtNight.witchKill, committed, 'second confirmation cannot replace the kill');

    room.playersWhoActedAtNight = {};
    game.changePhase(roomName, 'NIGHT');
    assert.notEqual(room.witchNightId, nightId);
    assert.equal(Object.keys(room.witchNightMarks).length, 0, 'new night must clear marks');
    reconnected.emit('witch mark target', 'town-1', nightId);
    await barrier(reconnected);
    assert.equal(room.witchNightMarks['witch-1'], undefined, 'late mark from previous night must fail');
    room.players['witch-1'].alive = false;
    reconnected.emit('witch mark target', 'town-1', room.witchNightId);
    reconnected.emit('witch kill target', 'town-1', { confirmed: true, nightId: room.witchNightId });
    await barrier(reconnected);
    assert.equal(room.witchNightMarks['witch-1'], undefined, 'dead witch cannot mark');
    assert.equal(room.playersWhoActedAtNight.witchKill, undefined, 'dead witch cannot commit');
    room.players['witch-2'].isWitch = false;
    users[1].emit('witch mark target', null, room.witchNightId);
    await barrier(users[1]);
    users[1].emit('witch kill target', null, { confirmed: true, nightId: room.witchNightId });
    await barrier(users[1]);
    assert.equal(room.playersWhoActedAtNight.witchKill, null, 'infected teammate can explicitly confirm skipping');
    console.log('PASS: private shared marks, no premature kill, confirmation validation, protected targets, reconnect, concurrent confirmation, nightly reset and dead-player guards.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const room of Object.values(game.rooms)) {
        for (const player of Object.values(room.players)) clearTimeout(player.disconnectTimeout);
        clearInterval(room.phaseInterval); clearTimeout(room.confessionTimer); clearTimeout(room.nightActionTimeout);
        room.players = {}; room.spectators = {};
    }
    clients.forEach(socket => socket.disconnect());
    await game.close();
});
