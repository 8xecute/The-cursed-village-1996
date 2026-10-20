// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, cardToPlay, targetUniqueId, emitCardUsedOnYou } = context;
    if (targetUniqueId) {
        const targetPlayer = room.players[targetUniqueId];
        targetPlayer.inPlayCards.push(cardToPlay);
        game.discardDuplicateMatchmakers(room, targetPlayer);
        game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Matchmaker')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
        game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
        emitCardUsedOnYou(targetUniqueId, cardToPlay);
    }
    return false;
};
