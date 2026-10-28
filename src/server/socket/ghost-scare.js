module.exports = function registerGhostScare(socket, game) {
    socket.on('ghost scare', (targetId, ack) => {
        const reply = result => { if (typeof ack === 'function') ack(result); };
        const room = game.rooms[socket.currentRoom];
        const player = room?.players[socket.uniqueId];
        if (!room?.gameStarted || room.gameOver || !player || player.id !== socket.id || player.alive !== false || player.isBot || player.isSpectator)
            return reply({ ok: false, message: 'ใช้ได้หลังคุณตาย และเกมยังไม่จบเท่านั้น' });
        const now = Date.now();
        if (player.ghostScareAvailableAt > now) return reply({ ok: false,
            message: `รออีก ${Math.ceil((player.ghostScareAvailableAt - now) / 1000)} วินาที จึงจะหลอกได้อีกครั้ง`,
            availableAt: player.ghostScareAvailableAt });
        const target = typeof targetId === 'string' && room.players[targetId];
        if (!target?.alive || !target.id || target.connected === false || target.isBot || target.isReplacementBot || target.reconnectDeadline)
            return reply({ ok: false, message: 'เลือกผู้เล่นที่ยังมีชีวิตและออนไลน์อยู่' });
        if (target.ghostScareUntil > now) return reply({ ok: false, message: 'คนนี้กำลังโดนหลอกอยู่ ลองเลือกใหม่อีกครั้ง' });
        // Commit before emitting, so double clicks/reconnects cannot bypass cooldown.
        player.ghostScareAvailableAt = now + 2 * 60 * 1000;
        target.ghostScareUntil = now + 3800;
        game.io.to(target.id).emit('ghost scare received', { actorName: player.name, duration: 3400 });
        reply({ ok: true, targetName: target.name, availableAt: player.ghostScareAvailableAt });
        game.emitRoomState(room.name);
    });
};
