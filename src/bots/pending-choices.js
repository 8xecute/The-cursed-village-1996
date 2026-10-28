// Shared choices for resolving an already-started card action.
function lifeIndex(count, random = Math.random) {
    return Number.isInteger(count) && count > 0 ? Math.floor(random() * count) : null;
}

function curseIndex(cards) {
    if (!Array.isArray(cards) || !cards.length) return null;
    const preferred = cards.findIndex(card => ['Piety', 'Asylum', 'Black Cat'].includes(card.name));
    return preferred < 0 ? 0 : preferred;
}

function alibiIndexes(cards) {
    const accusations = (cards || []).filter(card => card.name === 'Accusation').slice(0, 3);
    const evidence = (cards || []).find(card => card.name === 'Evidence');
    return (accusations.length === 3 || !evidence ? accusations : [evidence]).map(card => card.index);
}

module.exports = { lifeIndex, curseIndex, alibiIndexes };
