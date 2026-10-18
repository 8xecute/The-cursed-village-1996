const { usageLog } = require('../usage-log');

module.exports = function registerUsage(socket, game) {
    const started = Date.now();
    const fields = () => ({ connectionId: socket.id, playerId: socket.uniqueId || null,
        playerName: game.rooms[socket.currentRoom]?.players?.[socket.uniqueId]?.name ||
            game.rooms[socket.currentRoom]?.spectators?.[socket.uniqueId]?.name || socket.data.usageName || null,
        roomName: socket.currentRoom || null,
        roundId: game.rooms[socket.currentRoom]?.usageRoundId || null,
        isBot: !!game.rooms[socket.currentRoom]?.players?.[socket.uniqueId]?.isBot });
    usageLog('connection_opened', { connectionId: socket.id, transport: socket.conn.transport.name,
        device: /mobile|android|iphone|ipad/i.test(socket.handshake.headers['user-agent'] || '') ? 'mobile' : 'desktop_or_other' });
    socket.onAnyOutgoing((event, ...args) => {
        if (event === 'room joined') {
            const room = game.rooms[args[0]];
            const spec = !!room?.spectators?.[socket.uniqueId];
            usageLog('room_joined', { ...fields(), roomName: args[0], role: spec ? 'spectator' : 'player', gameStarted: !!room?.gameStarted });
        }
    });
    socket.on('leave room', () => usageLog('room_leave_requested', fields()));
    socket.on('disconnect', reason => usageLog('connection_closed', { ...fields(), reason, durationSeconds: Math.round((Date.now() - started) / 1000) }));
};
