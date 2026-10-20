// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, playerUniqueId, cardIndex, cardToPlay, targetUniqueId, emitCardFeedback, emitCardUsedOnYou } = context;
    if (targetUniqueId) {
        const targetPlayer = room.players[targetUniqueId];
        const blueCards = targetPlayer.inPlayCards.filter(c => c.color === 'Blue');
        if (blueCards.length > 0) {
            if (blueCards.length === 1) {
                // Only one blue card, discard it automatically
                const cardToDiscard = blueCards[0];
                targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(c => c !== cardToDiscard);
                // Black Cat: remove from game, not to discard
                if (cardToDiscard.name === 'Black Cat') {
                    room.discardPile.push(cardToDiscard);
                    game.updateBlackCatHolder(room); // reset holder
                    game.sendGameMessage(room.name, 'การ์ดเครื่องเซ่นถูกทิ้งลงกองทิ้ง', 'grey', true);
                    game.emitRoomState(room.name);
                } else if (cardToDiscard.name === 'Asylum') {
                    // Remove Asylum effect
                    game.sendGameMessage(room.name, 'การ์ดที่หลบภัยถูกลบและสถานะป้องกันถูกยกเลิก!', 'grey', true);
                    room.discardPile.push(cardToDiscard);
                    game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                } else if (cardToDiscard.name === 'Piety') {
                    game.sendGameMessage(room.name, 'การ์ดพลังศรัทธาถูกลบและไม่สามารถกันการ์ดแดงได้อีก!', 'grey', true);
                    room.discardPile.push(cardToDiscard);
                    game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                } else if (cardToDiscard.name === 'Matchmaker') {
                    game.sendGameMessage(room.name, 'การ์ดผูกวิญญาณถูกลบออก!', 'grey', true);
                    room.discardPile.push(cardToDiscard);
                    game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                } else if (cardToDiscard.name === 'Conspiracy') {
                    game.sendGameMessage(room.name, 'การ์ดพิธีเซ่นไหว้ถูกลบและไปยังกองทิ้ง!', 'grey', true);
                    room.discardPile.push(cardToDiscard);
                    game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                } else {
                    room.discardPile.push(cardToDiscard);
                game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                }
                // --- เพิ่ม game message ---
                game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Curse')} ใส่ <b>${targetPlayer.name}</b> ทิ้งการ์ด ${game.getCardNameWithColor(cardToDiscard.name)}`, 'orange', true);
                // Do NOT end turn here; allow player to continue
            } else {
                // Multiple blue cards, prompt player to choose
                room.awaitingCurseSelection = {
                    selector: playerUniqueId,
                    target: targetUniqueId,
                };
                // Consume only the Curse that was played. Keep any
                // duplicate Curse cards in the player's hand.
                player.hand.splice(cardIndex, 1);
                player.hasPlayedCardsThisTurn = true;
                game.io.to(player.id).emit('update hand', player.hand);
                game.io.to(player.id).emit('disable draw button');
                game.io.to(player.id).emit('card played successfully');
      emitCardFeedback();
                game.io.to(player.id).emit('prompt select curse target', {
                    targetUniqueId,
                    blueCards: blueCards.map(card => ({ name: card.name }))
                });
                game.emitRoomState(room.name);
                return true;
            }
        } else {
            game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ไม่มีการ์ดสีน้ำเงินให้ลบ`, 'orange', true);
        }
        emitCardUsedOnYou(targetUniqueId, cardToPlay);
    }
    return false;
};
