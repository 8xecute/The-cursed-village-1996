// Preserve handler registration order while separating room responsibilities.
const registrars = [
  require('./rooms/identity'),
  require('./rooms/membership'),
  require('./rooms/lobby'),
  require('./rooms/connection'),
];
module.exports = function registerRoomHandlers(socket, game) {
  for (const register of registrars) register(socket, game);
};
