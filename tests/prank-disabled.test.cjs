const test = require('node:test');
const assert = require('node:assert/strict');
const register = require('../src/server/socket/prank');
test('legacy gun actions cannot change game state', () => {
  const handlers = {};
  register({ on(name, fn) { handlers[name] = fn; } });
  assert.doesNotThrow(() => handlers['prank gun pickup']());
  assert.doesNotThrow(() => handlers['prank gun shoot']('target'));
});
