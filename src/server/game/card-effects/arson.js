// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, cardToPlay, targetUniqueId, emitCardUsedOnYou } = context;
    if (targetUniqueId) {
        const targetPlayer = room.players[targetUniqueId];
        if (targetPlayer.hand.length > 0) {
            room.discardPile.push(...targetPlayer.hand); // Add to discard pile
            targetPlayer.hand = [];
            game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Arson')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
            game.io.to(targetPlayer.id).emit('update hand', targetPlayer.hand);
        }
        emitCardUsedOnYou(targetUniqueId, cardToPlay);
    }
    return false;
};
