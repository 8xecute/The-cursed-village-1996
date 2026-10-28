// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, cardToPlay, targetUniqueId, emitCardUsedOnYou } = context;
    if (targetUniqueId) {
        const targetPlayer = room.players[targetUniqueId];
        // Add Stocks card to target player's inPlayCards (stackable)
        targetPlayer.inPlayCards.push(cardToPlay);
        targetPlayer.isSilenced = true; // Mark player as silenced
        game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Stocks')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
        game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
        // Silence effect will be cleared at the start of new day in setNextTurn function
        emitCardUsedOnYou(targetUniqueId, cardToPlay);
    }
    return false;
};
