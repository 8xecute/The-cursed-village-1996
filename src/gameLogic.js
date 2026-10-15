// Compatibility export. Live game rules are in src/server/game/.
module.exports = { ...require('./legacy/gameLogic'), ...require('./shared/cards') };
