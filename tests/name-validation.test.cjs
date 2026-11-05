const test = require('node:test');
const assert = require('node:assert/strict');
const registerMembership = require('../src/server/socket/rooms/membership');
const registerIdentity = require('../src/server/socket/rooms/identity');

test('room creation, joining and renaming reject markup in player names', () => {
  const handlers = {};
  const events = [];
  const socket = { on: (name, fn) => { handlers[name] = fn; }, emit: (...args) => events.push(args), uniqueId: 'p', currentRoom: 'room' };
  const room = { players: { p: { id: 'socket', name: 'เดิม' } } };
  socket.id = 'socket';
  const game = { rooms: { room } };
  registerMembership(socket, game);
  registerIdentity(socket, game);
  const unsafe = '<img src=x onerror=alert(1)>';
  handlers['create room']('new', unsafe);
  handlers['join room']('room', unsafe);
  handlers['set player name'](unsafe);
  assert.equal(game.rooms.new, undefined);
  assert.equal(room.players.p.name, 'เดิม');
  assert.equal(events.filter(([name]) => name === 'game message').length, 3);
});
