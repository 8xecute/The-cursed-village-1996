const registrars = [
  require('./usage'),
  require('./rooms'),
  require('./phases'),
  require('./cards'),
  require('./confession'),
  require('./night'),
  require('./conspiracy'),
  require('./chat'),
  require('./prank'),
  require('./ghost-scare'),
];

module.exports = function registerSocketHandlers(game) {
  game.io.on('connection', socket => {
    socket.use(([event], next) => {
      if (event === 'register uniqueId' || event === 'leave room') return next();
      if (socket.pendingReturnRoom) return;
      const player = game.rooms[socket.currentRoom]?.players[socket.uniqueId];
      if (player && player.id !== socket.id) return;
      next();
    });
    for (const register of registrars) register(socket, game);
  });
};
