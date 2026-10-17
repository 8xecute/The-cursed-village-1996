module.exports = function registerPrank(socket, game) {
    function context() {
        const room = game.rooms[socket.currentRoom];
        const player = room?.players[socket.uniqueId];
        return player?.id === socket.id ? { room, player } : {};
    }
    socket.on('prank gun grant', (id, grant) => {
        const { room, player } = context();
        if (!room?.gameStarted || room.gameOver || room.prankShot || room.hostUniqueId !== player.uniqueId || !player.isHost) return;
        const target = room.players[id];
        if (!target?.alive || typeof grant !== 'boolean') return;
        target.prankGun = grant;
        game.emitRoomState(room.name);
    });
    socket.on('prank gun shoot', id => {
        const { room, player } = context();
        if (!room?.gameStarted || room.gameOver || room.currentPhase !== 'DAY' || !player?.alive || !player.prankGun || game.hasPendingCardAction(room)) return;
        const target = room.players[id];
        if (!target?.alive || id === player.uniqueId) return;
        player.prankGun = false;
        const shot = { actorId: player.uniqueId, targetId: id, actorName: player.name, targetName: target.name, raiseDuration: 900, bulletDuration: 4200, duration: 5100 };
        room.prankShot = shot;
        game.io.to(room.name).emit('prank gun shot', shot);
        game.emitRoomState(room.name);
        setTimeout(() => {
            if (game.rooms[room.name] !== room || room.prankShot !== shot) return;
            room.prankShot = null;
            if (!room.gameStarted || room.gameOver || room.currentPhase !== 'DAY') return;
            const previousTurn = room.currentTurnPlayerUniqueId;
            if (target.alive) {
                game.sendGameMessage(room.name, `${player.name} ยิงปืนเทพทรูใส่ ${target.name}!`, 'orange');
                game.handlePlayerDeath(room, target, { cause: 'prank_gun', byPlayerName: player.name });
            }
            game.checkWinCondition(room);
            if (!room.gameOver && !room.players[room.currentTurnPlayerUniqueId]?.alive && room.currentPhase === 'DAY') game.setNextTurn(room, previousTurn, true);
            game.emitRoomState(room.name);
        }, shot.duration);
    });
};
