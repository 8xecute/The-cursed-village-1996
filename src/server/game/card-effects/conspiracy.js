// Return true when the effect has already handled card consumption/continuation.
module.exports = function applyEffect(game, context) {
    const { roomName, room, player, playerUniqueId, cardToPlay } = context;
    room.conspiracyDrawer = playerUniqueId;
    game.updateBlackCatHolder(room); // เช็คสถานะล่าสุดก่อน
    if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
        const bcHolder = room.players[room.blackCatHolder];
        // เช็คว่าผู้เล่นยังมี Black Cat จริง
        if (bcHolder.inPlayCards.some(card => card.name === 'Black Cat') && bcHolder.tryalCards.length > 0) {
            room.awaitingConspiracySelection = {
                selector: playerUniqueId,
                target: room.blackCatHolder,
                tryalCount: bcHolder.tryalCards.length
            };
            game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Conspiracy')}`, 'orange', true);
            game.io.to(player.id).emit('prompt select blackcat tryal', {
                blackCatHolder: room.blackCatHolder,
                tryalCount: bcHolder.tryalCards.length,
                blackCatHolderName: bcHolder.name
            });
            // รอให้ selector เลือกผ่าน UI ก่อน promptTryalCardSelectionToLeft และจบเทิร์น
            room.discardPile.push(cardToPlay); // <--- FIX: discard Conspiracy after use
            return true; // ไม่จบเทิร์นทันที
        }
    }
    // --- เพิ่ม flag สำหรับพิธีเซ่นไหว้ ---
    room.awaitingLeftTryalSelections = true;
    room.conspiracyDrawer = playerUniqueId;
    game.promptTryalCardSelectionToLeft(roomName);
    game.emitRoomState(roomName);
    room.discardPile.push(cardToPlay); // <--- FIX: discard Conspiracy after use
    return false;
};
