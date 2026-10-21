// Layout positions are separate from the indexes sent by life-card actions.
export function lifeSlots(player) {
    const count = Number(player.tryalCardCount) || 0;
    const opened = player.revealedTryalCards || [];
    const total = count + opened.length;
    const occupied = new Map();
    opened.forEach((card, index) => {
        const slot = Number.isInteger(card.slot) && card.slot >= 0 && card.slot < total ? card.slot : count + index;
        occupied.set(slot, { card, revealedIndex:index });
    });
    let remainingIndex = 0;
    return Array.from({length:total}, (_, slot) => occupied.has(slot)
        ? {slot, ...occupied.get(slot), opened:true}
        : {slot, card:player.tryalCards?.[remainingIndex], lifeIndex:remainingIndex++, opened:false});
}
