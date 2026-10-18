const { createGameServer } = require('./src/server/createServer');
const { usageLog } = require('./src/server/usage-log');

const game = createGameServer();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') console.log = function () {};
game.server.listen(PORT, () => {
  usageLog('server_started', { port: Number(PORT), environment: process.env.NODE_ENV || 'development', commit: process.env.RENDER_GIT_COMMIT || null });
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT}`);
});
