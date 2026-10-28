// Draw continuation pauses for events and resumes the same turn afterward.
module.exports = function createDrawServices(game) {
  function drawCards(roomName, playerUniqueId, count = 2) {
      const room = game.rooms[roomName];
      const player = room?.players[playerUniqueId];
      if (!room || room.gameOver || !room.gameStarted || room.currentPhase !== 'DAY' ||
          room.prankShot || room.pendingDraw || game.hasPendingCardAction(room) ||
          !player?.alive || playerUniqueId !== room.currentTurnPlayerUniqueId || player.isSilenced) return;
      if (player.hasPlayedCardsThisTurn) {
          game.io.to(player.id).emit('game message', 'คุณเล่นการ์ดแล้วในเทิร์นนี้ จั่วเพิ่มไม่ได้', 'red');
          return;
      }
      game.applyTwoPlayerRules(room);
      player.hasPlayedCardsThisTurn = true;
      room.pendingDraw = { playerId: playerUniqueId, remaining: count, waiting: false };
      game.io.to(player.id).emit('disable draw button');
      game.sendGameMessage(room.name, `${player.name} จั่วการ์ด ${count} ใบ`, 'blue', true);
      continuePendingDraw(room);
  }

  function continuePendingDraw(room, fallbackPlayerId = null) {
      if (!room || room.gameOver) return;
      const draw = room.pendingDraw;
      if (!draw) {
          game.setNextTurn(room, fallbackPlayerId, !!fallbackPlayerId);
          return;
      }
      if (room.currentPhase !== 'DAY') return;
      const player = room.players[draw.playerId];
      if (!player?.alive) {
          room.pendingDraw = null;
          game.setNextTurn(room, draw.playerId, true);
          return;
      }
      room.currentTurnPlayerUniqueId = draw.playerId;
      if (draw.waiting && draw.remaining > 0) {
          game.sendGameMessage(room.name, `${player.name} จั่วต่ออีก ${draw.remaining} ใบให้ครบเทิร์นเดิม`, 'blue', true);
      }
      draw.waiting = false;
      game.applyTwoPlayerRules(room);
      let delay = 0;
      while (draw.remaining > 0) {
          if (!room.gameDeck.length) {
              const night = room.discardPile.filter(card => card.name === 'Night');
              room.gameDeck = game.shuffleArray(room.discardPile.filter(card => card.name !== 'Night')).concat(night);
              room.discardPile = [];
          }
          const card = room.gameDeck.shift();
          if (!card) {
              game.sendGameMessage(room.name, 'ไม่เหลือการ์ดให้จั่วในกองจั่วและกองทิ้ง', 'grey', true);
              break;
          }
          draw.remaining--;
          game.io.to(room.name).emit('table card movement', { kind: 'draw', targetId: draw.playerId, delay });
          delay += 160;
          if (card.type !== 'Event') {
              player.hand.push(card);
              continue;
          }
          draw.waiting = true;
          room.discardPile.push(card);
          game.io.to(player.id).emit('update hand', player.hand);
          game.io.to(room.name).emit('table phase cue', { cardName: card.name });
          game.sendGameMessage(room.name, `${player.name} จั่วได้ ${game.getCardNameWithColor(card.name)} · หลังเหตุการณ์จั่วต่ออีก ${draw.remaining} ใบ`, 'blue', true);
          game.sendDeckInfo(room.name);
          game.emitRoomState(room.name);
          if (card.name === 'Night') {
              room.nightCardDrawer = draw.playerId;
              game.changePhase(room.name, 'NIGHT');
              return;
          }
          if (card.name === 'Conspiracy') {
              room.conspiracyDrawer = draw.playerId;
              const holder = room.players[room.blackCatHolder];
              if (holder?.alive && holder.tryalCards.length > 0) {
                  room.awaitingConspiracySelection = { selector: draw.playerId, target: holder.uniqueId, tryalCount: holder.tryalCards.length };
                  game.io.to(player.id).emit('prompt select blackcat tryal', {
                      blackCatHolder: holder.uniqueId, blackCatHolderName: holder.name,
                      tryalCount: holder.tryalCards.length, fromConspiracyDraw: true
                  });
                  game.emitRoomState(room.name);
              } else game.promptTryalCardSelectionToLeft(room.name);
              return;
          }
      }
      room.pendingDraw = null;
      game.io.to(player.id).emit('update hand', player.hand);
      game.sendDeckInfo(room.name);
      game.emitRoomState(room.name);
      game.setNextTurn(room, draw.playerId, true);
  }

  return { drawCards, continuePendingDraw };
};
