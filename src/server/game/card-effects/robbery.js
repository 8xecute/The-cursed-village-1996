// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, cardToPlay, targetUniqueId, secondTargetUniqueId, emitCardUsedOnYou } = context;
    if (targetUniqueId && secondTargetUniqueId) {
        const sourcePlayer = room.players[targetUniqueId];
        const destPlayer = room.players[secondTargetUniqueId];
        if (sourcePlayer.hand.length > 0) {
            destPlayer.hand.push(...sourcePlayer.hand);
            sourcePlayer.hand = [];
            game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Robbery')} จาก <b>${sourcePlayer.name}</b> ไปยัง <b>${destPlayer.name}</b>`, 'orange', true);
            game.io.to(sourcePlayer.id).emit('update hand', sourcePlayer.hand);
            game.io.to(destPlayer.id).emit('update hand', destPlayer.hand);
        }
        emitCardUsedOnYou(targetUniqueId, cardToPlay);
        emitCardUsedOnYou(secondTargetUniqueId, cardToPlay);
    }
    return false;
};
