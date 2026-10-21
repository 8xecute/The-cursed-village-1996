// Shared card authorization and finalization; individual effects live in card-effects/.
const createCardEffects = require('./card-effects');
module.exports = function createServices(game) {
  const applyCardEffect = createCardEffects(game);
  function applyTwoPlayerRules(room) {
      if (!room.gameStarted || game.getAlivePlayers(room).length > 2) return;
      if (!room.twoPlayerRulesAnnounced) {
          room.twoPlayerRulesAnnounced = true;
          game.sendGameMessage(room.name, 'เหลือผู้เล่นไม่เกิน 2 คน: นำการ์ดสีน้ำเงิน แพะรับบาป และช่วงชิงออกจากเกมทั้งหมด การ์ดเหล่านี้จะไม่กลับเข้ากองจั่ว', 'gold', true);
      }
      const excluded = card => card.color === 'Blue' || ['Scapegoat', 'Robbery'].includes(card.name);
      const remove = cards => (cards || []).filter(card => {
          if (!excluded(card)) return true;
          (room.removedGameCards ||= []).push(card); return false;
      });
      room.gameDeck = remove(room.gameDeck);
      room.discardPile = remove(room.discardPile);
      for (const player of Object.values(room.players)) {
          const oldHand = player.hand.length, oldEffects = player.inPlayCards.length;
          const removedFromHand = player.hand.filter(excluded);
          player.hand = remove(player.hand); player.inPlayCards = remove(player.inPlayCards);
          if (player.alive && removedFromHand.length) {
              const counts = {};
              removedFromHand.forEach(card => { const name = game.CARD_NAME_THAI[card.name] || card.name; counts[name] = (counts[name] || 0) + 1; });
              game.io.to(player.id).emit('game message', `กติกาเหลือ 2 คน: นำการ์ดในมือออกจากเกม ${Object.entries(counts).map(([name, count]) => `${name} ${count} ใบ`).join(', ')}`, 'gold');
          }
          if (player.hand.length !== oldHand) game.io.to(player.id).emit('update hand', player.hand);
          if (player.inPlayCards.length !== oldEffects) game.io.to(player.id).emit('update in play cards', player.inPlayCards);
      }
      game.updateBlackCatHolder(room);
  }
  function discardDuplicateMatchmakers(room, player) {
      const cards = player.inPlayCards.filter(card => card.name === 'Matchmaker');
      if (cards.length < 2) return;
      player.inPlayCards = player.inPlayCards.filter(card => card.name !== 'Matchmaker');
      room.discardPile.push(...cards);
      game.sendGameMessage(room.name, `${player.name} มีผูกวิญญาณสองใบ จึงทิ้งทั้งคู่`, 'grey');
  }
  function onTryalRevealed(room, card) {
      if (card.name !== 'Constable') return;
      for (const player of Object.values(room.players)) player.isConstable = false;
      game.sendGameMessage(room.name, 'การ์ดหมอผีถูกเปิดแล้ว ความสามารถหมอผีสิ้นสุดลง', 'blue');
  }
  function getCardNameWithColor(cardName) {
      const cardNameThai = game.CARD_NAME_THAI[cardName] || cardName;
      
      // หาสีการ์ดจาก GAME_CARDS
      let cardColor = 'white'; // default
      for (const card of game.GAME_CARDS) {
          if (card.name === cardName) {
              cardColor = card.color;
              break;
          }
      }
      
      // กำหนดสี HTML ตามประเภทการ์ด
      let colorCode = '#ffffff'; // default white
      switch (cardColor) {
          case 'Red':
              colorCode = '#ff4444';
              break;
          case 'Green':
              colorCode = '#32cd32';
              break;
          case 'Blue':
              colorCode = '#4169e1';
              break;
          case 'Black':
              colorCode = '#666666';
              break;
          default:
              colorCode = '#ffffff';
      }
      
      return `<span style="color: ${colorCode}; font-weight: bold;">${cardNameThai}</span>`;
  }

  function playCard(roomName, playerUniqueId, cardIndex, targetUniqueId = null, secondTargetUniqueId = null) {
      const room = game.rooms[roomName];
      if (room?.prankShot || room?.pendingDraw) return;
      if (!room || room.gameOver) return;
      if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
          const player = room?.players[playerUniqueId];
          if (player) game.io.to(player.id).emit('game message', 'ตอนนี้ยังเล่นการ์ดไม่ได้.', 'red');
          return;
      }
      const player = room.players[playerUniqueId];
      if (!player || !player.alive || player.uniqueId !== room.currentTurnPlayerUniqueId) {
          if (player) {
              game.io.to(player.id).emit('game message', 'ไม่ใช่ตาของคุณหรือคุณไม่สามารถเล่นการ์ดได้.', 'red');
          }
          return;
      }

      if (room.awaitingCurseSelection?.selector === playerUniqueId) {
          game.io.to(player.id).emit('game message', 'กรุณาเลือกการ์ดจากคำสาปให้เสร็จก่อนทำอย่างอื่น.', 'orange');
          return;
      }

      if (room.awaitingAlibiSelection) {
          game.io.to(player.id).emit('game message', 'กรุณาเลือกข้อแก้ต่างให้เสร็จ หรือยกเลิก ก่อนเล่นการ์ดใบอื่น', 'orange');
          return;
      }

      if (player.isSilenced) {
          game.io.to(player.id).emit('game message', 'คุณถูกทำให้เงียบและไม่สามารถเล่นการ์ดได้.', 'red');
          return;
      }

      if (room.playerForcedToRevealTryal) {
          game.io.to(player.id).emit('game message', `รอให้ ${room.players[room.playerForcedToRevealTryal].name} เปิดเผยการ์ดชีวิตก่อน`, 'orange');
          return;
      }

      const cardToPlay = player.hand[cardIndex];
      const pendingReason = game.pendingActionReason(room);
      if (pendingReason) {
          game.io.to(player.id).emit('game message', pendingReason, 'orange');
          return;
      }
      if (!cardToPlay) {
          game.io.to(player.id).emit('game message', 'การ์ดไม่ถูกต้อง.', 'red');
          return;
      }

      // Single-card clients and bots use the same atomic red-card action as batches.
      if (cardToPlay.color === 'Red') {
          if (secondTargetUniqueId) {
              game.io.to(player.id).emit('game message', 'การ์ดนี้ต้องการเป้าหมาย 1 คน.', 'red');
              return;
          }
          return game.playRedCards(roomName, playerUniqueId, [cardIndex], targetUniqueId);
      }

      // Public action information only: never include hands, life cards, or hidden roles.
      function emitCardFeedback() {
          const target = room.players[targetUniqueId];
          const result = ({ Stocks: 'ข้ามเทิร์นถัดไป',
                  Arson: 'ทิ้งการ์ดในมือทั้งหมด', Robbery: 'ย้ายการ์ดในมือไปยังผู้รับ',
                  Scapegoat: 'ย้ายการ์ดสถานะไปยังผู้รับ', Piety: 'ป้องกันการ์ดแดง',
                  Asylum: 'ป้องกันการสังหารกลางคืน', Matchmaker: 'ผูกวิญญาณแล้ว',
                  Alibi: 'นำข้อกล่าวหาออก', Curse: 'เลือกการ์ดสถานะที่จะทำลาย',
                  Night: 'เข้าสู่กลางคืน', Conspiracy: 'เริ่มพิธีเซ่นไหว้' })[cardToPlay.name] || 'ใช้การ์ดแล้ว';
          game.io.to(roomName).emit('card action feedback', {
              actorId: playerUniqueId, actorName: player.name, cardName: cardToPlay.name,
              targetId: targetUniqueId, targetName: target?.name || null,
              secondTargetName: room.players[secondTargetUniqueId]?.name || null,
              discard: cardToPlay.type === 'Action' || cardToPlay.type === 'Event', result
          });
      }

      // Check if a target is required but not provided, or vice-versa
      const cardNeedsTarget = game.CARDS_NEED_TARGET.includes(cardToPlay.name);
      const cardNeedsTwoTargets = game.CARDS_NEED_TWO_TARGETS.includes(cardToPlay.name);
      
      if (cardNeedsTwoTargets && (!targetUniqueId || !secondTargetUniqueId)) {
          game.io.to(player.id).emit('game message', 'การ์ดนี้ต้องการเป้าหมาย 2 คน.', 'red');
          return;
      } else if (cardNeedsTarget && !cardNeedsTwoTargets && !targetUniqueId) {
          game.io.to(player.id).emit('game message', 'การ์ดนี้ต้องการเป้าหมาย.', 'red');
          return;
      }
      if (!cardNeedsTarget && (targetUniqueId || secondTargetUniqueId)) {
          game.io.to(player.id).emit('game message', 'การ์ดนี้ไม่ต้องการเป้าหมาย.', 'red');
          return;
      }

      if (targetUniqueId && !room.players[targetUniqueId]?.alive) {
          game.io.to(player.id).emit('game message', 'เป้าหมายแรกไม่อยู่ในเกมแล้ว.', 'red');
          return;
      }
      if (secondTargetUniqueId && !room.players[secondTargetUniqueId]?.alive) {
          game.io.to(player.id).emit('game message', 'เป้าหมายที่สองไม่อยู่ในเกมแล้ว.', 'red');
          return;
      }

      // Enforce the no-self-target rule before applying any card effects or
      // consuming the card. Initial Black Cat assignment is handled separately.
      const BLUE_CARDS_THAT_CANNOT_TARGET_SELF = ['Asylum', 'Piety', 'Matchmaker', 'Black Cat'];
      const targetsSelf = targetUniqueId === playerUniqueId || secondTargetUniqueId === playerUniqueId;
      const cannotTargetSelf =
          ((cardToPlay.color === 'Red' || cardToPlay.color === 'Green') && targetsSelf) ||
          (cardToPlay.color === 'Blue' &&
              BLUE_CARDS_THAT_CANNOT_TARGET_SELF.includes(cardToPlay.name) && targetsSelf);
      if (cannotTargetSelf) {
          game.io.to(player.id).emit('game message', 'ไม่สามารถใช้การ์ดซาเลมกับตัวเองได้', 'red');
          return;
      }

      // Move red and green cards to discard pile (Action and Accusation cards)
      if (cardToPlay.color === 'Green' && cardToPlay.name !== 'Stocks') {
          room.discardPile.push(cardToPlay);
      }
      // Note: Blue cards (Permanent) stay in play, Black cards (Event) are resolved and discarded
      // RED cards (Accusation) will be handled in the card effects section

      const handled = applyCardEffect({ roomName, room, player, playerUniqueId, cardIndex, cardToPlay,
          targetUniqueId, secondTargetUniqueId, emitCardFeedback, emitCardUsedOnYou });
      if (handled) return;

      // Remove card from hand (after handling effects)
      player.hand.splice(cardIndex, 1);
      
      // Mark that player has played cards this turn
      player.hasPlayedCardsThisTurn = true;
      
      // Disable draw button after playing a card
      game.io.to(player.id).emit('disable draw button');
      
      // Send card played event to client
      game.io.to(player.id).emit('card played successfully');
      emitCardFeedback();
      
      // จบเทิร์นอัตโนมัติถ้าการ์ดในมือหมด (หลังจากลบการ์ดแล้ว)
      game.finishEmptyHandTurn(room);
      
      game.io.to(player.id).emit('update hand', player.hand);
      game.emitRoomState(room.name);
      
      // Send deck information update
      game.sendDeckInfo(roomName);

      // Helper สำหรับ emit popup
      function emitCardUsedOnYou(targetId, cardObj) {
          if (!room.players[targetId] || !room.players[targetId].alive) return;
          game.io.to(room.players[targetId].id).emit('card used on you', player.name, cardObj.name, game.CARD_DESCRIPTION_THAI?.[cardObj.name] || cardObj.description || '');
      }
  }

  function updateBlackCatHolder(room) {
      let found = false;
      Object.values(room.players).forEach(p => {
          if (p.inPlayCards && p.inPlayCards.some(card => card.name === 'Black Cat')) {
              room.blackCatHolder = p.uniqueId;
              found = true;
          }
      });
      if (!found) room.blackCatHolder = null;
  }

  return { getCardNameWithColor, playCard, updateBlackCatHolder, applyTwoPlayerRules, discardDuplicateMatchmakers, onTryalRevealed };
};
