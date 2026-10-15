const { createGameServer } = require('./src/server/createServer');

const game = createGameServer();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') console.log = function () {};
game.server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});
