const { getGameCardsForPlayerCount } = require('../../shared/cards');
function maxStartingHand(playerCount) {
    const available = getGameCardsForPlayerCount(playerCount).filter(card => !['Conspiracy', 'Night', 'Black Cat'].includes(card.name)).length;
    return Math.max(1, Math.min(10, Math.floor(available / Math.max(1, playerCount))));
}
module.exports = { maxStartingHand };
