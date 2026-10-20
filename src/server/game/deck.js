// Deck preparation and public pile counts. Dependencies are injected through game.
module.exports = function createDeckServices(game) {
  function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
  }

  function prepareDeckForNewDay(room) {
      if (!room) return;
      if (room.discardPile && room.discardPile.length > 0) {
          room.gameDeck = (room.gameDeck || []).concat(room.discardPile);
          room.discardPile = [];
      }
      if (room.gameDeck && room.gameDeck.length > 0) {
          // Keep exactly one Night card at the bottom of the deck
          const nightCards = room.gameDeck.filter(card => card.name === 'Night');
          const otherCards = room.gameDeck.filter(card => card.name !== 'Night');
          const shuffled = game.shuffleArray(otherCards);
          const nightCard = nightCards.length > 0 ? [nightCards[0]] : [];
          room.gameDeck = shuffled;
          if (nightCard.length > 0) {
              room.gameDeck.push(nightCard[0]);
          }
      }
      game.sendDeckInfo(room.name);
      game.sendGameMessage(room.name, '🎴 กองการ์ดและกองทิ้งถูกสับรวมเตรียมพร้อมสำหรับวันใหม่เรียบร้อยแล้ว', 'blue', true);
  }

  function sendDeckInfo(roomName) {
      const room = game.rooms[roomName];
      if (!room) return;
      
      const deckCount = room.gameDeck ? room.gameDeck.length : 0;
      const discardCount = room.discardPile ? room.discardPile.length : 0;
      
      game.io.to(roomName).emit('deck info update', {
          deckCount: deckCount,
          discardPileCount: discardCount
      });
  }

  return { shuffleArray, prepareDeckForNewDay, sendDeckInfo };
};
