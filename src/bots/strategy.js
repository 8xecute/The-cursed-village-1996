// Decisions use only the bot's own cards and the state delivered to its socket.
// Unknown villagers remain unknown; accusations and attacks are clues, not proof.
const RED_VALUES = { Accusation: 1, Evidence: 3, Witness: 7 };
const effects = player => player.inPlayCards || [];
const hasEffect = (player, name) => effects(player).some(card => card.name === name);

function alliesFor(state, id) {
    const me = state.players?.[id];
    const witch = !!(me?.hasBeenWitch || me?.isWitch);
    const allies = new Set([id]);
    if (witch) Object.values(state.players || {}).forEach(player => {
        if (player.hasBeenWitch || player.isWitch) allies.add(player.uniqueId);
    });
    return { witch, allies };
}

function threat(player, suspicion = {}) {
    return Math.min(8, Number(player.accusationPoints) || 0) * .7 +
        Math.min(5, Number(player.handSize) || 0) * .35 +
        Math.min(5, Number(suspicion[player.uniqueId]) || 0) * 1.5;
}

function bestRedBatch(hand, existing) {
    const combinations = Array(8).fill(null);
    combinations[0] = [];
    hand.forEach((card, index) => {
        const value = RED_VALUES[card?.name];
        if (card?.color !== 'Red' || !value) return;
        for (let points = 7; points >= value; points--) {
            if (!combinations[points - value]) continue;
            const next = [...combinations[points - value], index];
            if (!combinations[points] || next.length > combinations[points].length) combinations[points] = next;
        }
    });
    let best = null;
    for (let points = 1; points <= 7; points++) {
        const indexes = combinations[points];
        if (!indexes) continue;
        const reveal = existing + points >= 7;
        const wasted = Math.max(0, existing + points - 7);
        const score = (reveal ? 12 : points * 1.1) - wasted * 1.3 - indexes.length * .12;
        if (!best || score > best.score) best = { indexes, points, score };
    }
    return best;
}

function chooseCardAction({ state, id, hand, suspicion = {} }) {
    const me = state.players?.[id];
    if (!me?.alive) return null;
    const { witch, allies } = alliesFor(state, id);
    const others = Object.values(state.players || {}).filter(player => player.alive && player.uniqueId !== id);
    const enemies = others.filter(player => !allies.has(player.uniqueId));
    const friends = others.filter(player => !witch || allies.has(player.uniqueId));
    const candidates = [];
    const add = (score, action) => candidates.push({ score, ...action });
    for (const target of enemies) {
        if (hasEffect(target, 'Piety') || !target.tryalCardCount) continue;
        const batch = bestRedBatch(hand, Number(target.accusationPoints) || 0);
        if (batch) add(batch.score + threat(target, suspicion), { kind:'red', indexes:batch.indexes, targetId:target.uniqueId });
    }
    hand.forEach((card, cardIndex) => {
        const one = (target, score) => add(score, { kind:'single', cardIndex, targetId:target.uniqueId });
        for (const target of others) {
            const enemy = !allies.has(target.uniqueId), priority = threat(target, suspicion);
            const reds = effects(target).filter(effect => effect.name === 'Accusation' || effect.name === 'Evidence');
            switch (card.name) {
            case 'Curse':
                if (enemy && effects(target).some(effect => effect.color === 'Blue' && ['Piety','Asylum'].includes(effect.name)))
                    one(target, 6 + priority + (hasEffect(target, 'Piety') ? 2 : 0));
                else if (witch && !enemy && hasEffect(target, 'Black Cat')) one(target, 6);
                break;
            case 'Alibi':
                if (friends.includes(target) && reds.length) one(target, 4 + Math.min(3, target.accusationPoints || 0) + (witch ? 3 : 0));
                break;
            case 'Stocks': if (enemy) one(target, 5 + priority); break;
            case 'Arson': if (enemy && target.handSize >= 2) one(target, 4 + Math.min(5, target.handSize) + priority); break;
            case 'Black Cat': if (enemy && !target.isBlackCatHolder) one(target, 4 + priority); break;
            case 'Asylum':
                if (friends.includes(target) && !hasEffect(target, 'Asylum')) one(target, 4 + (witch ? 3 : 0) + (target.tryalCardCount <= 2 ? 1 : 0));
                break;
            case 'Piety':
                if (friends.includes(target) && !hasEffect(target, 'Piety')) one(target, 4 + (witch ? 3 : 0) + Math.min(3, target.accusationPoints || 0));
                break;
            case 'Matchmaker':
                if (enemy && !hasEffect(target, 'Matchmaker') && !hasEffect(me, 'Matchmaker') &&
                    !others.some(p => allies.has(p.uniqueId) && hasEffect(p, 'Matchmaker'))) one(target, 3 + priority);
                break;
            case 'Robbery':
                if (!enemy || !target.handSize) break;
                for (const recipient of friends.filter(p => p.uniqueId !== target.uniqueId))
                    add(4 + Math.min(5, target.handSize) + priority + (witch ? 2 : 0),
                        { kind:'single', cardIndex, targetId:target.uniqueId, secondTargetId:recipient.uniqueId });
                break;
            case 'Scapegoat': {
                const harm = effects(target).filter(effect => effect.color === 'Red' || effect.name === 'Stocks');
                if (!friends.includes(target) || !harm.length) break;
                for (const recipient of enemies.filter(p => p.uniqueId !== target.uniqueId))
                    add(5 + Math.min(6, target.accusationPoints || 0) + (witch ? 3 : 0),
                        { kind:'single', cardIndex, targetId:target.uniqueId, secondTargetId:recipient.uniqueId });
                break;
            }
            }
        }
    });
    candidates.sort((a,b) => b.score - a.score);
    return candidates[0] || null;
}

function chooseNightTarget(state, id, suspicion = {}) {
    const { allies } = alliesFor(state, id);
    return Object.values(state.players || {}).filter(player => player.alive && !allies.has(player.uniqueId) && !hasEffect(player, 'Asylum'))
        .sort((a,b) => (threat(b, suspicion) + (b.tryalCardCount <= 2 ? 2 : 0)) - (threat(a, suspicion) + (a.tryalCardCount <= 2 ? 2 : 0)))[0] || null;
}

function chooseProtectedTarget(state, id) {
    const { witch, allies } = alliesFor(state, id);
    return Object.values(state.players || {}).filter(player => player.alive && player.uniqueId !== id)
        .sort((a,b) => {
            const score = player => Number(player.handSize || 0) + (player.tryalCardCount <= 2 ? 3 : 0) +
                (witch && allies.has(player.uniqueId) ? 20 : 0) - (hasEffect(player, 'Asylum') ? 15 : 0);
            return score(b) - score(a);
        })[0] || null;
}

function chooseDayDecision({ candidate, handSize, hasPlayed, random = Math.random }) {
    // A small red batch still builds pressure; it need not reveal a life today.
    const useful = candidate && (candidate.kind === 'red' ? candidate.score > 0 : candidate.score >= 4);
    if (!useful) return hasPlayed ? 'end' : 'draw';
    if (!hasPlayed && candidate.score < 12) {
        const drawChance = handSize <= 2 ? .45 : handSize <= 5 ? .25 : .12;
        if (random() < drawChance) return 'draw';
    }
    return 'play';
}

module.exports = { alliesFor, bestRedBatch, chooseCardAction, chooseNightTarget, chooseProtectedTarget, chooseDayDecision };
