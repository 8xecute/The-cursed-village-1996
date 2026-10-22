module.exports = function registerPrank(socket, game) {
    function context() {
        const room = game.rooms[socket.currentRoom];
        const player = room?.players[socket.uniqueId];
        return player?.id === socket.id ? { room, player } : {};
    }
    socket.on('prank gun pickup', () => {
        const { room, player } = context();
        if (!room?.gameStarted || room.gameOver || room.prankShot || !player?.alive || room.currentPhase !== 'DAY') return;
        if (Object.values(room.players).some(other => other.alive && other.prankGun)) return;
        for (const other of Object.values(room.players)) other.prankGun = other === player;
        game.emitRoomState(room.name);
    });
    socket.on('prank gun shoot', id => {
        const { room, player } = context();
        if (!room?.gameStarted || room.gameOver || room.prankShot || room.currentPhase !== 'DAY' || !player?.alive || !player.prankGun || game.hasPendingCardAction(room)) return;
        const target = room.players[id];
        if (!target?.alive || id === player.uniqueId) return;
        const shot = { actorId: player.uniqueId, targetId: id, actorName: player.name, targetName: target.name,
            startedAt: Date.now(), raiseDuration: 2800, bulletDuration: 3400, recoveryDuration: 900 };
        shot.duration = shot.raiseDuration + shot.bulletDuration + shot.recoveryDuration;
        room.prankShot = shot;
        game.io.to(room.name).emit('prank gun shot', shot);
        game.emitRoomState(room.name);
        setTimeout(() => {
            if (game.rooms[room.name] !== room || room.prankShot !== shot) return;
            if (!room.gameStarted || room.gameOver || room.currentPhase !== 'DAY') return;
            if (target.alive) {
                game.sendGameMessage(room.name, `${player.name} ยิงปืนเทพทรูใส่ ${target.name}!`, 'orange');
                game.handlePlayerDeath(room, target, { cause: 'prank_gun', byPlayerName: player.name });
            }
            game.checkWinCondition(room);
            game.emitRoomState(room.name);
        }, shot.raiseDuration + shot.bulletDuration);
        setTimeout(() => {
            if (game.rooms[room.name] !== room || room.prankShot !== shot) return;
            room.prankShot = null;
            // Turn advancement is blocked during the shot, including linked deaths.
            game.finishEmptyHandTurn(room);
            game.emitRoomState(room.name);
        }, shot.duration);
    });
};
