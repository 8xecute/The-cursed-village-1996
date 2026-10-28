// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { room, player, playerUniqueId, cardIndex, cardToPlay, targetUniqueId } = context;
    if (targetUniqueId) {
        const targetPlayer = room.players[targetUniqueId];
        // หา red cards (Accusation/Evidence) ใน inPlayCards
        const redCards = targetPlayer.inPlayCards
            .map((c, idx) => ({ ...c, index: idx }))
            .filter(c => c.color === 'Red' && (c.name === 'Accusation' || c.name === 'Evidence'));
        
        if (redCards.length > 0) {
            // มีการ์ดสีแดง ต้อง popup ให้เลือก
            game.io.to(player.id).emit('prompt select alibi removal', {
                targetUniqueId,
                redCards: redCards.map(c => ({ name: c.name, value: c.value, index: c.index }))
            });
            room.awaitingAlibiSelection = {
                card: cardToPlay,
                selector: playerUniqueId,
                target: targetUniqueId,
                cardIndex: cardIndex // เก็บ index ของ Alibi ในมือผู้ใช้
            };
            // ลบการ์ด Alibi ออกจากมือทันทีเมื่อเริ่มใช้งาน
            player.hand.splice(cardIndex, 1);
            game.io.to(player.id).emit('update hand', player.hand);
            game.emitRoomState(room.name);
            return true; // ยังไม่จบเทิร์น
        } else {
            game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ไม่มีการ์ดข้อกล่าวหา/หลักฐานให้ลบ`, 'orange', true);
        }
    }
    return false;
};
