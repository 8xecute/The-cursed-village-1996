// Clock state is scoped to one action key so old callbacks cannot affect a later turn.
function createActionClock({ now = Date.now, schedule = setTimeout, cancel = clearTimeout, onExpire }) {
    let timer = null;
    let current = null;
    let generation = 0;
    function clear() {
        generation++;
        if (timer !== null) cancel(timer);
        timer = null;
        current = null;
    }
    function start(key, seconds) {
        if (!key || !Number.isFinite(seconds) || seconds <= 0) return false;
        if (current?.key === key) return false;
        clear();
        const version = generation;
        current = { key, deadline: now() + seconds * 1000 };
        timer = schedule(() => {
            if (generation !== version || current?.key !== key) return;
            timer = null;
            current = null;
            onExpire(key);
        }, seconds * 1000);
        return true;
    }
    return { start, clear, get current() { return current && { ...current }; } };
}

module.exports = { createActionClock };
