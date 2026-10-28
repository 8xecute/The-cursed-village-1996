// Public cosmetic IDs, independent of roles, hands and the life-card shuffle.
const CHARACTER_COUNT = 12;
function assignCharacterIds(players, shuffle, reset = false) {
    const used = new Set(), missing = [];
    for (const player of players) {
        if (!reset && Number.isInteger(player.characterId) && player.characterId >= 0 &&
            player.characterId < CHARACTER_COUNT && !used.has(player.characterId)) used.add(player.characterId);
        else missing.push(player);
    }
    if (!missing.length) return;
    const available = shuffle(Array.from({length:CHARACTER_COUNT},(_,id)=>id).filter(id=>!used.has(id)));
    for (const player of missing) player.characterId = available.pop() ?? null;
}
module.exports = { assignCharacterIds };
