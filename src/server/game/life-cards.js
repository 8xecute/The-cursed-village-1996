// Shared mechanics; callers retain phase-specific messages and continuation order.
module.exports = function createLifeCardServices(game) {
  function openLifeCard(room, player, index) {
    if (!room || room.gameOver || !player?.alive || !Number.isInteger(index) ||
        index < 0 || index >= player.tryalCards.length) return null;
    const history = player.revealedTryalCards ||= [];
    const total = player.tryalCards.length + history.length;
    history.forEach((opened, i) => { if (!Number.isInteger(opened.slot)) opened.slot = player.tryalCards.length + i; });
    const used = new Set(history.map(opened => opened.slot));
    const slots = Array.from({length:total}, (_,i)=>i).filter(slot=>!used.has(slot));
    const slot = slots[index];
    const card = player.tryalCards.splice(index, 1)[0];
    game.onTryalRevealed(room, card);
    history.push({ name: card.name, slot });
    player.revealedTryalCardIndexes.add(card.name);
    return card;
  }

  function syncLifeCards(player) {
    game.io.to(player.id).emit('update tryal cards initial', player.tryalCards);
    game.io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes));
  }

  function resolveLifeCard(room, player, card) {
    if (!room || room.gameOver || !player?.alive || !card) return;
    if (card.name === 'Witch') {
      player.isWitch = player.hasBeenWitch = true;
      game.handlePlayerDeath(room, player, { cause: 'revealed_witch' });
    } else {
      if (card.name === 'Constable') player.isConstable = false;
      game.eliminatePlayerWithoutLifeCards(room, player);
    }
  }

  return { openLifeCard, syncLifeCards, resolveLifeCard };
};
