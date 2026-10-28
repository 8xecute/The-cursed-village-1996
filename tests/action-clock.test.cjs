const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createActionClock } = require('../src/server/game/action-clock');

test('an old timer cannot expire a later action or restart an active action', () => {
    const callbacks = [];
    const expired = [];
    const clock = createActionClock({
        now: () => 1000,
        schedule: callback => (callbacks.push(callback), callbacks.length),
        cancel: () => {},
        onExpire: key => expired.push(key),
    });
    assert.equal(clock.start('first', 60), true);
    assert.equal(clock.current.deadline, 61000);
    assert.equal(clock.start('first', 60), false);
    assert.equal(clock.start('second', 10), true);
    callbacks[0]();
    assert.deepEqual(expired, []);
    callbacks[1]();
    assert.deepEqual(expired, ['second']);
});

test('cancelled timers do not expire', () => {
    let callback;
    let expired = false;
    const clock = createActionClock({ schedule: fn => (callback = fn, 1), cancel: () => {}, onExpire: () => { expired = true; } });
    clock.start('turn', 60);
    clock.clear();
    callback();
    assert.equal(expired, false);
    assert.equal(clock.current, null);
});

test('the same action can start a fresh 60 seconds after cancellation', () => {
    const callbacks = [];
    const expired = [];
    let now = 1000;
    const clock = createActionClock({ now: () => now, schedule: fn => (callbacks.push(fn), callbacks.length),
        cancel: () => {}, onExpire: key => expired.push(key) });
    clock.start('turn', 60);
    clock.clear();
    now = 51000;
    assert.equal(clock.start('turn', 60), true);
    assert.equal(clock.current.deadline, 111000);
    callbacks[0]();
    assert.deepEqual(expired, []);
    callbacks[1]();
    assert.deepEqual(expired, ['turn']);
});
