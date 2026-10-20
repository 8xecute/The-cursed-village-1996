// Effects run after shared authorization and before normal card finalization.
const effects = {
    'Scapegoat': require('./scapegoat'),
    'Curse': require('./curse'),
    'Alibi': require('./alibi'),
    'Robbery': require('./robbery'),
    'Stocks': require('./stocks'),
    'Arson': require('./arson'),
    'Black Cat': require('./black-cat'),
    'Asylum': require('./asylum'),
    'Piety': require('./piety'),
    'Matchmaker': require('./matchmaker'),
    'Conspiracy': require('./conspiracy'),
};
module.exports = function createCardEffects(game) {
    return function applyCardEffect(context) {
        const effect = effects[context.cardToPlay.name];
        return effect ? effect(game, context) : false;
    };
};
