const registrars = [
  require('./rooms'),
  require('./phases'),
  require('./cards'),
  require('./confession'),
  require('./night'),
  require('./conspiracy'),
  require('./chat'),
  require('./prank'),
];

module.exports = function registerSocketHandlers(game) {
  game.io.on('connection', socket => {
    for (const register of registrars) register(socket, game);
  });
};
