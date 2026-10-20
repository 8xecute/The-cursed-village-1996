// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, cardToPlay, targetUniqueId, emitCardUsedOnYou } = context;
    const targetPlayer = room.players[targetUniqueId];
    targetPlayer.inPlayCards.push(cardToPlay);
    game.updateBlackCatHolder(room);
    game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Black Cat')} ใส่ <b>${targetPlayer.name}</b>`, 'gold', true);
    game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
    emitCardUsedOnYou(targetUniqueId, cardToPlay);
    return false;
};
