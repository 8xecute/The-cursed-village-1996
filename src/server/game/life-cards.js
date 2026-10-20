// Shared mechanics; callers retain phase-specific messages and continuation order.
module.exports = function createLifeCardServices(game) {
  function openLifeCard(room, player, index) {
    if (!room || room.gameOver || !player?.alive || !Number.isInteger(index) ||
        index < 0 || index >= player.tryalCards.length) return null;
    const card = player.tryalCards.splice(index, 1)[0];
    game.onTryalRevealed(room, card);
    (player.revealedTryalCards ||= []).push({ name: card.name });
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
