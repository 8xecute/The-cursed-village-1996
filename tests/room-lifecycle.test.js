jest.mock('uuid', () => ({ v4: () => require('crypto').randomUUID() }));
const { createGameServer } = require('../src/server/createServer');
const { io } = require('socket.io-client');

jest.setTimeout(20000);
const until = async predicate => {
  const deadline = Date.now() + 9000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for game state');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

describe('room lifecycle', () => {
  let game, clients, url;
  beforeEach(async () => {
    game = createGameServer(); clients = [];
    await new Promise(resolve => game.server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${game.server.address().port}`;
  });
  afterEach(async () => {
    clients.forEach(client => client.disconnect());
    await game.close();
  });
  async function connect(id) {
    const client = io(url, { forceNew: true, reconnection: false });
    clients.push(client);
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    client.emit('register uniqueId', id, id);
    return client;
  }
  test('players reconnect, finish, return to the same lobby and start another round', async () => {
    const host = await connect('host');
    host.emit('create room', 'room', 'Host');
    await until(() => game.rooms.room);
    const players = [host];
    for (let i = 1; i < 4; i++) {
      const client = await connect(`p${i}`); players.push(client);
      client.emit('join room', 'room', `Player ${i}`);
      await until(() => game.rooms.room.players[`p${i}`]);
    }
    host.emit('set life card count', 1);
    await until(() => game.rooms.room.customLifeCardCount === 1);
    host.emit('start game', 'room');
    const room = game.rooms.room;
    await until(() => room.lifeSetup?.stage === 'arrange');
    expect(Object.values(room.players).every(p => p.tryalCards.length === 1)).toBe(true);
    players[1].disconnect();
    await until(() => !room.players.p1.connected);
    players[1] = await connect('p1');
    await until(() => room.players.p1.connected);
    const setupId = room.lifeSetup.id;
    players.forEach(p => p.emit('confirm life setup', setupId));
    await until(() => room.isAssigningBlackCat);
    game.finishGame(room, 'Townsfolk', 'จบเกม', 'green');
    const denied = await new Promise(resolve => players[1].emit('restart game', 'room', resolve));
    expect(denied.ok).toBe(false);
    const restarted = await new Promise(resolve => host.emit('restart game', 'room', resolve));
    expect(restarted.ok).toBe(true);
    expect(room.gameStarted).toBe(false);
    expect(room.customLifeCardCount).toBe(1);
    expect(Object.keys(room.players)).toHaveLength(4);
    expect(room.players.p1.isReady).toBe(false);
    expect(Object.values(room.players).every(p => p.tryalCards.length === 0)).toBe(true);
    host.emit('start game', 'room');
    await until(() => room.lifeSetup?.stage === 'arrange');
    expect(room.gameOver).toBe(false);
    expect(Object.values(room.players).every(p => p.tryalCards.length === 1)).toBe(true);
  });
});
