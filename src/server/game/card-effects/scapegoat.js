// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, cardIndex, cardToPlay, targetUniqueId, secondTargetUniqueId, emitCardUsedOnYou } = context;
    if (targetUniqueId && secondTargetUniqueId) {
        const sourcePlayer = room.players[targetUniqueId];
        const destPlayer = room.players[secondTargetUniqueId];
        // Move blue, green, and red cards from source to destination
        const blueCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Blue');
        const greenCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Green');
        const redCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Red');
        // Remove from source
        sourcePlayer.inPlayCards = sourcePlayer.inPlayCards.filter(card => !['Blue','Green','Red'].includes(card.color));
        // Add to destination
        destPlayer.inPlayCards.push(...blueCards, ...greenCards, ...redCards);
        game.discardDuplicateMatchmakers(room, destPlayer);
        // Stocks: if any moved, update isSilenced
        if (greenCards.some(card => card.name === 'Stocks')) {
            destPlayer.isSilenced = true;
            sourcePlayer.isSilenced = sourcePlayer.inPlayCards.some(card => card.name === 'Stocks');
        }
        // --- อัปเดต Black Cat Holder หลังย้าย ---
        game.updateBlackCatHolder(room);
        game.io.to(sourcePlayer.id).emit('update in play cards', sourcePlayer.inPlayCards);
        game.io.to(destPlayer.id).emit('update in play cards', destPlayer.inPlayCards);
        game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Scapegoat')} จาก <b>${sourcePlayer.name}</b> ไปยัง <b>${destPlayer.name}</b>`, 'orange', true);
        // --- ย้ายข้อกล่าวหา (accusationPoints) ถ้ามีการ์ดแดงถูกย้าย ---
        const accusationPointsToMove = room.accusedPlayers[targetUniqueId] || 0;
        if (redCards.length > 0 && accusationPointsToMove > 0) {
            room.accusedPlayers[secondTargetUniqueId] = (room.accusedPlayers[secondTargetUniqueId] || 0) + accusationPointsToMove;
            room.accusedPlayers[targetUniqueId] = 0;
            game.sendGameMessage(room.name, `ข้อกล่าวหาของ <b>${sourcePlayer.name}</b> ถูกย้ายไปให้ <b>${destPlayer.name}</b> ด้วย!`, 'orange', true);
            // ถ้าข้อกล่าวหาใหม่ครบ 7 แต้ม ให้เปิด Tryal Card
            if (room.accusedPlayers[secondTargetUniqueId] >= 7) {
                room.playerForcedToRevealTryal = secondTargetUniqueId;
                room.playerForcedToRevealSelector = player.uniqueId;
                game.sendGameMessage(room.name, `<b>${destPlayer.name}</b> มีข้อกล่าวหาถึง 7 แต้มและต้องเปิดเผยการ์ดชีวิต!`, 'gold', true);
                game.io.to(player.id).emit('prompt select accused tryal', {
                    accusedUniqueId: secondTargetUniqueId,
                    tryalCount: destPlayer.tryalCards.length
                });
                game.io.to(destPlayer.id).emit('forced reveal notice', {
                    byPlayerName: player.name,
                    reason: 'accusation_threshold',
                    points: room.accusedPlayers[secondTargetUniqueId] || 0
                });
                game.emitRoomState(room.name);
                // ลบการ์ด Scapegoat ออกจากมือก่อน return
                player.hand.splice(cardIndex, 1);
                game.io.to(player.id).emit('update hand', player.hand);
                return true;
            }
        }
        emitCardUsedOnYou(targetUniqueId, cardToPlay);
        emitCardUsedOnYou(secondTargetUniqueId, cardToPlay);
    }
    return false;
};
