// cards: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
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
      room.hasShuffledThisDay = true;
      game.sendDeckInfo(room.name);
      game.sendGameMessage(room.name, '🎴 กองการ์ดและกองทิ้งถูกสับรวมเตรียมพร้อมสำหรับวันใหม่เรียบร้อยแล้ว', 'blue', true);
  }

  function playCard(roomName, playerUniqueId, cardIndex, targetUniqueId = null, secondTargetUniqueId = null) {
      const room = game.rooms[roomName];
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
          game.io.to(player.id).emit('game message', 'กรุณาเลือกการ์ดจาก Curse ให้เสร็จก่อนทำ action อื่น.', 'orange');
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
      if (!cardToPlay) {
          game.io.to(player.id).emit('game message', 'การ์ดไม่ถูกต้อง.', 'red');
          return;
      }

      // Public action information only: never include hands, life cards, or hidden roles.
      function emitCardFeedback() {
          const target = room.players[targetUniqueId];
          const result = cardToPlay.name === 'Accusation' || cardToPlay.name === 'Evidence'
              ? room.playerForcedToRevealTryal === targetUniqueId ? 'ครบ 7 แต้ม · เลือกเปิดการ์ดชีวิต'
                  : `ข้อกล่าวหา +${cardToPlay.value || 1} · รวม ${target?.accusationPoints || 0}/7`
              : ({ Witness: 'เลือกเปิดการ์ดชีวิต 1 ใบ', Stocks: 'ข้ามเทิร์นถัดไป',
                  Arson: 'ทิ้งการ์ดในมือทั้งหมด', Robbery: 'ย้ายการ์ดในมือไปยังผู้รับ',
                  Scapegoat: 'ย้ายการ์ดสถานะไปยังผู้รับ', Piety: 'ป้องกันการ์ดแดง',
                  Asylum: 'ป้องกันการสังหารกลางคืน', Matchmaker: 'ผูกวิญญาณแล้ว',
                  Alibi: 'นำข้อกล่าวหาออก', Curse: 'เลือกการ์ดสถานะที่จะทำลาย',
                  Night: 'เข้าสู่กลางคืน', Conspiracy: 'เริ่มพิธีเซ่นไหว้' })[cardToPlay.name] || 'ใช้การ์ดแล้ว';
          game.io.to(roomName).emit('card action feedback', {
              actorId: playerUniqueId, actorName: player.name, cardName: cardToPlay.name,
              targetId: targetUniqueId, targetName: target?.name || null,
              secondTargetName: room.players[secondTargetUniqueId]?.name || null,
              discard: cardToPlay.type === 'Action' || cardToPlay.type === 'Event' || cardToPlay.name === 'Witness', result
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
      // consuming the card. Black Cat is played onto its owner automatically.
      const BLUE_CARDS_THAT_CANNOT_TARGET_SELF = ['Asylum', 'Piety', 'Matchmaker'];
      const targetsSelf = targetUniqueId === playerUniqueId || secondTargetUniqueId === playerUniqueId;
      const cannotTargetSelf =
          ((cardToPlay.color === 'Red' || cardToPlay.color === 'Green') && targetsSelf) ||
          (cardToPlay.color === 'Blue' &&
              BLUE_CARDS_THAT_CANNOT_TARGET_SELF.includes(cardToPlay.name) && targetsSelf);
      if (cannotTargetSelf) {
          game.io.to(player.id).emit('game message', 'ไม่สามารถใช้การ์ดซาเลมกับตัวเองได้', 'red');
          return;
      }

      // --- Piety effect: Prevent red cards from targeting players with Piety ---
      const RED_CARD_NAMES = ['Accusation', 'Evidence', 'Witness'];
      if (
          RED_CARD_NAMES.includes(cardToPlay.name) &&
          targetUniqueId &&
          room.players[targetUniqueId]?.inPlayCards.some(c => c.name === 'Piety')
      ) {
          const message = `${room.players[targetUniqueId].name} มีพลังศรัทธา ใช้การ์ดสีแดงใส่ไม่ได้ · การ์ดยังอยู่ในมือคุณ`;
          game.io.to(player.id).emit('game message', message, 'red');
          game.io.to(player.id).emit('card play rejected', { reason: 'piety', message });
          return;
      }
      
      // Move red and green cards to discard pile (Action and Accusation cards)
      if (cardToPlay.color === 'Green' && cardToPlay.name !== 'Stocks') {
          room.discardPile.push(cardToPlay);
      }
      // Note: Blue cards (Permanent) stay in play, Black cards (Event) are resolved and discarded
      // RED cards (Accusation) will be handled in the card effects section

      // Handle card effects
      switch (cardToPlay.name) {
          case 'Accusation':
          case 'Evidence':
              if (targetUniqueId && room.players[targetUniqueId]) {
                  const targetPlayer = room.players[targetUniqueId];
                  const accVal = cardToPlay.value || 0;
                  player.accusationsGiven = (player.accusationsGiven || 0) + accVal;
                  targetPlayer.accusationsReceived = (targetPlayer.accusationsReceived || 0) + accVal;
                  room.accusedPlayers[targetUniqueId] = (room.accusedPlayers[targetUniqueId] || 0) + accVal;
                  targetPlayer.inPlayCards.push(cardToPlay);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor(cardToPlay.name)} ใส่ <b>${targetPlayer.name}</b> (+${cardToPlay.value || 0})`, 'orange', true);
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);

                  if ((room.accusedPlayers[targetUniqueId] || 0) >= 7) {
                      room.playerForcedToRevealTryal = targetUniqueId;
                      room.playerForcedToRevealSelector = player.uniqueId;
                      game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> มีข้อกล่าวหาถึง 7 แต้มและต้องเปิดเผยการ์ดชีวิต!`, 'gold', true);
                      game.io.to(player.id).emit('prompt select accused tryal', {
                          accusedUniqueId: targetUniqueId,
                          tryalCount: targetPlayer.tryalCards.length
                      });
                      game.io.to(targetPlayer.id).emit('forced reveal notice', {
                          byPlayerName: player.name,
                          reason: 'accusation_threshold',
                          points: room.accusedPlayers[targetUniqueId] || 0
                      });
                  }
                  game.emitRoomState(room.name);
              }
              break;
          
          case 'Scapegoat':
              if (targetUniqueId && secondTargetUniqueId) {
                  const sourcePlayer = room.players[targetUniqueId];
                  const destPlayer = room.players[secondTargetUniqueId];
                  // Move blue, green, and red cards from source to destination
                  const blueCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Blue');
                  const greenCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Green');
                  const redCards = sourcePlayer.inPlayCards.filter(card => card.color === 'Red');
                  // Remove from source
                  sourcePlayer.inPlayCards = sourcePlayer.inPlayCards.filter(card => !['Blue','Green','Red'].includes(card.color));
                  // Add to destination
                  destPlayer.inPlayCards.push(...blueCards, ...greenCards, ...redCards);
                  // Stocks: if any moved, update isSilenced
                  if (greenCards.some(card => card.name === 'Stocks')) {
                      destPlayer.isSilenced = true;
                      sourcePlayer.isSilenced = sourcePlayer.inPlayCards.some(card => card.name === 'Stocks');
                  }
                  // --- อัปเดต Black Cat Holder หลังย้าย ---
                  game.updateBlackCatHolder(room);
                  game.io.to(sourcePlayer.id).emit('update in play cards', sourcePlayer.inPlayCards);
                  game.io.to(destPlayer.id).emit('update in play cards', destPlayer.inPlayCards);
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Scapegoat')} จาก <b>${sourcePlayer.name}</b> ไปยัง <b>${destPlayer.name}</b>`, 'orange', true);
                  // --- ย้ายข้อกล่าวหา (accusationPoints) ถ้ามีการ์ดแดงถูกย้าย ---
                  const accusationPointsToMove = room.accusedPlayers[targetUniqueId] || 0;
                  if (redCards.length > 0 && accusationPointsToMove > 0) {
                      room.accusedPlayers[secondTargetUniqueId] = (room.accusedPlayers[secondTargetUniqueId] || 0) + accusationPointsToMove;
                      room.accusedPlayers[targetUniqueId] = 0;
                      game.sendGameMessage(room.name, `ข้อกล่าวหาของ <b>${sourcePlayer.name}</b> ถูกย้ายไปให้ <b>${destPlayer.name}</b> ด้วย!`, 'orange', true);
                      // ถ้าข้อกล่าวหาใหม่ครบ 7 แต้ม ให้เปิด Tryal Card
                      if (room.accusedPlayers[secondTargetUniqueId] >= 7) {
                          room.playerForcedToRevealTryal = secondTargetUniqueId;
                          room.playerForcedToRevealSelector = player.uniqueId;
                          game.sendGameMessage(room.name, `<b>${destPlayer.name}</b> มีข้อกล่าวหาถึง 7 แต้มและต้องเปิดเผยการ์ดชีวิต!`, 'gold', true);
                          game.io.to(player.id).emit('prompt select accused tryal', {
                              accusedUniqueId: secondTargetUniqueId,
                              tryalCount: destPlayer.tryalCards.length
                          });
                          game.io.to(destPlayer.id).emit('forced reveal notice', {
                              byPlayerName: player.name,
                              reason: 'accusation_threshold',
                              points: room.accusedPlayers[secondTargetUniqueId] || 0
                          });
                          game.emitRoomState(room.name);
                          // ลบการ์ด Scapegoat ออกจากมือก่อน return
                          player.hand.splice(cardIndex, 1);
                          game.io.to(player.id).emit('update hand', player.hand);
                          return;
                      }
                  }
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
                  emitCardUsedOnYou(secondTargetUniqueId, cardToPlay);
              }
              break;
          case 'Curse':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  const blueCards = targetPlayer.inPlayCards.filter(c => c.color === 'Blue');
                  if (blueCards.length > 0) {
                      if (blueCards.length === 1) {
                          // Only one blue card, discard it automatically
                          const cardToDiscard = blueCards[0];
                          targetPlayer.inPlayCards = targetPlayer.inPlayCards.filter(c => c !== cardToDiscard);
                          // Black Cat: remove from game, not to discard
                          if (cardToDiscard.name === 'Black Cat') {
                              game.updateBlackCatHolder(room); // reset holder
                              game.sendGameMessage(room.name, 'การ์ดพิธีเซ่นไหว้ ถูกลบออกจากเกม!', 'grey', true);
                              game.emitRoomState(room.name);
                          } else if (cardToDiscard.name === 'Asylum') {
                              // Remove Asylum effect
                              game.sendGameMessage(room.name, 'การ์ดที่หลบภัยถูกลบและสถานะป้องกันถูกยกเลิก!', 'grey', true);
                              room.discardPile.push(cardToDiscard);
                              game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                          } else if (cardToDiscard.name === 'Piety') {
                              game.sendGameMessage(room.name, 'การ์ดพลังศรัทธาถูกลบและไม่สามารถกันการ์ดแดงได้อีก!', 'grey', true);
                              room.discardPile.push(cardToDiscard);
                              game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                          } else if (cardToDiscard.name === 'Matchmaker') {
                              game.sendGameMessage(room.name, 'การ์ดผูกวิญญาณถูกลบออก!', 'grey', true);
                              room.discardPile.push(cardToDiscard);
                              game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                          } else if (cardToDiscard.name === 'Conspiracy') {
                              game.sendGameMessage(room.name, 'การ์ดพิธีเซ่นไหว้ถูกลบและไปยังกองทิ้ง!', 'grey', true);
                              room.discardPile.push(cardToDiscard);
                              game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                          } else {
                              room.discardPile.push(cardToDiscard);
                          game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                          }
                          // --- เพิ่ม game message ---
                          game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Curse')} ใส่ <b>${targetPlayer.name}</b> ทิ้งการ์ด ${game.getCardNameWithColor(cardToDiscard.name)}`, 'orange', true);
                          // Do NOT end turn here; allow player to continue
                      } else {
                          // Multiple blue cards, prompt player to choose
                          room.awaitingCurseSelection = {
                              selector: playerUniqueId,
                              target: targetUniqueId,
                          };
                          // Consume only the Curse that was played. Keep any
                          // duplicate Curse cards in the player's hand.
                          player.hand.splice(cardIndex, 1);
                          player.hasPlayedCardsThisTurn = true;
                          game.io.to(player.id).emit('update hand', player.hand);
                          game.io.to(player.id).emit('disable draw button');
                          game.io.to(player.id).emit('card played successfully');
      emitCardFeedback();
                          game.io.to(player.id).emit('prompt select curse target', {
                              targetUniqueId,
                              blueCards: blueCards.map(card => ({ name: card.name }))
                          });
                          game.emitRoomState(room.name);
                          return;
                      }
                  } else {
                      game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ไม่มีการ์ดสีน้ำเงินให้ลบ`, 'orange', true);
                  }
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
              }
              break;
          case 'Alibi':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  // หา red cards (Accusation/Evidence) ใน inPlayCards
                  const redCards = targetPlayer.inPlayCards
                      .map((c, idx) => ({ ...c, index: idx }))
                      .filter(c => c.color === 'Red' && (c.name === 'Accusation' || c.name === 'Evidence'));
                  
                  if (redCards.length > 0) {
                      // มีการ์ดสีแดง ต้อง popup ให้เลือก
                      game.io.to(player.id).emit('prompt select alibi removal', {
                          targetUniqueId,
                          redCards: redCards.map(c => ({ name: c.name, value: c.value, index: c.index }))
                      });
                      room.awaitingAlibiSelection = {
                          selector: playerUniqueId,
                          target: targetUniqueId,
                          cardIndex: cardIndex // เก็บ index ของ Alibi ในมือผู้ใช้
                      };
                      // ลบการ์ด Alibi ออกจากมือทันทีเมื่อเริ่มใช้งาน
                      player.hand.splice(cardIndex, 1);
                      game.io.to(player.id).emit('update hand', player.hand);
                      return; // ยังไม่จบเทิร์น
                  } else {
                      game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ไม่มีการ์ดข้อกล่าวหา/หลักฐานให้ลบ`, 'orange', true);
                  }
              }
              break;
          case 'Robbery':
              if (targetUniqueId && secondTargetUniqueId) {
                  const sourcePlayer = room.players[targetUniqueId];
                  const destPlayer = room.players[secondTargetUniqueId];
                  if (sourcePlayer.hand.length > 0) {
                      destPlayer.hand.push(...sourcePlayer.hand);
                      sourcePlayer.hand = [];
                      game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Robbery')} จาก <b>${sourcePlayer.name}</b> ไปยัง <b>${destPlayer.name}</b>`, 'orange', true);
                      game.io.to(sourcePlayer.id).emit('update hand', sourcePlayer.hand);
                      game.io.to(destPlayer.id).emit('update hand', destPlayer.hand);
                  }
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
                  emitCardUsedOnYou(secondTargetUniqueId, cardToPlay);
              }
              break;
          case 'Stocks':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  // Add Stocks card to target player's inPlayCards (stackable)
                  targetPlayer.inPlayCards.push(cardToPlay);
                  targetPlayer.isSilenced = true; // Mark player as silenced
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Stocks')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  // Silence effect will be cleared at the start of new day in setNextTurn function
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
              }
              break;
          case 'Arson':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  if (targetPlayer.hand.length > 0) {
                      room.discardPile.push(...targetPlayer.hand); // Add to discard pile
                      targetPlayer.hand = [];
                      game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Arson')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
                      game.io.to(targetPlayer.id).emit('update hand', targetPlayer.hand);
                  }
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
              }
              break;
          case 'Black Cat':
              // Black Cat goes to the player who plays it
              player.inPlayCards.push(cardToPlay);
                  room.blackCatHolder = player.uniqueId;
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ถือ <b>การ์ดเครื่องเซ่น</b>!`, 'gold', true);
              game.io.to(player.id).emit('update in play cards', player.inPlayCards);
              break;
          case 'Asylum':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  targetPlayer.inPlayCards.push(cardToPlay);
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Asylum')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
              }
              break;
          case 'Piety':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  targetPlayer.inPlayCards.push(cardToPlay);
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Piety')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
              }
              break;
          case 'Matchmaker':
              if (targetUniqueId) {
                  const targetPlayer = room.players[targetUniqueId];
                  targetPlayer.inPlayCards.push(cardToPlay);
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Matchmaker')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  emitCardUsedOnYou(targetUniqueId, cardToPlay);
              }
              break;
          case 'Conspiracy':
              room.conspiracyDrawer = playerUniqueId;
              game.updateBlackCatHolder(room); // เช็คสถานะล่าสุดก่อน
              if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                  const bcHolder = room.players[room.blackCatHolder];
                  // เช็คว่าผู้เล่นยังมี Black Cat จริง
                  if (bcHolder.inPlayCards.some(card => card.name === 'Black Cat') && bcHolder.tryalCards.length > 0) {
                      room.awaitingConspiracySelection = {
                          selector: playerUniqueId,
                          target: room.blackCatHolder,
                          tryalCount: bcHolder.tryalCards.length
                      };
                      game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Conspiracy')}`, 'orange', true);
                      game.io.to(player.id).emit('prompt select blackcat tryal', {
                          blackCatHolder: room.blackCatHolder,
                          tryalCount: bcHolder.tryalCards.length,
                          blackCatHolderName: bcHolder.name
                      });
                      // รอให้ selector เลือกผ่าน UI ก่อน promptTryalCardSelectionToLeft และจบเทิร์น
                      room.discardPile.push(cardToPlay); // <--- FIX: discard Conspiracy after use
                      return; // ไม่จบเทิร์นทันที
                  }
              }
              // --- เพิ่ม flag สำหรับพิธีเซ่นไหว้ ---
              room.awaitingLeftTryalSelections = true;
              room.conspiracyDrawer = playerUniqueId;
              game.promptTryalCardSelectionToLeft(roomName);
              game.emitRoomState(roomName);
              room.discardPile.push(cardToPlay); // <--- FIX: discard Conspiracy after use
              break;
          case 'Witness':
              if (targetUniqueId && room.players[targetUniqueId]) {
                  const targetPlayer = room.players[targetUniqueId];
                  const accVal = cardToPlay.value || 0;
                  player.accusationsGiven = (player.accusationsGiven || 0) + accVal;
                  targetPlayer.accusationsReceived = (targetPlayer.accusationsReceived || 0) + accVal;
                  // เพิ่มแต้มข้อกล่าวหา
                  room.accusedPlayers[targetUniqueId] = (room.accusedPlayers[targetUniqueId] || 0) + accVal;
                  game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Witness')} ใส่ <b>${targetPlayer.name}</b>`, 'orange', true);
                  // Place RED card in front of the target player
                  targetPlayer.inPlayCards.push(cardToPlay);
                  game.io.to(targetPlayer.id).emit('update in play cards', targetPlayer.inPlayCards);
                  // บังคับเปิดการ์ดชีวิต 1 ใบทันที
                  room.playerForcedToRevealTryal = targetUniqueId;
                  room.playerForcedToRevealSelector = player.uniqueId;
                  game.sendGameMessage(room.name, `<b>${targetPlayer.name}</b> ถูกบังคับเปิดการ์ดชีวิตเพราะข้อกล่าวหา 7 แต้ม! การ์ดที่ถูกบังคับเปิดคือ: ชาวบ้าน`, 'gold', true);
                  game.io.to(player.id).emit('prompt select accused tryal', {
                      accusedUniqueId: targetUniqueId,
                      tryalCount: targetPlayer.tryalCards.length
                  });
                  game.io.to(targetPlayer.id).emit('forced reveal notice', {
                      byPlayerName: player.name,
                      reason: 'witness_card',
                      points: room.accusedPlayers[targetUniqueId] || 0
                  });
                  game.emitRoomState(room.name);
              }
              // ไม่ว่า target จะถูกหรือไม่ ให้ลบการ์ดออกจากมือและทิ้งลงกองทิ้งเสมอ
              if (cardIndex >= 0 && cardIndex < player.hand.length) {
                  player.hand.splice(cardIndex, 1);
                  room.discardPile.push(cardToPlay);
              }
              player.hasPlayedCardsThisTurn = true;
              game.io.to(player.id).emit('disable draw button');
              game.io.to(player.id).emit('card played successfully');
      emitCardFeedback();
              game.io.to(player.id).emit('update hand', player.hand);
              game.sendDeckInfo(roomName);
              if (game.canAutoEndTurn(room, player)) {
                  game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดในมือหมดแล้ว จบเทิร์นอัตโนมัติ`, 'orange', true);
                  game.setNextTurn(room);
              } else {
                  game.emitRoomState(room.name);
              }
              return;
          default:
              break;
      }

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
      if (game.canAutoEndTurn(room, player)) {
          game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดในมือหมดแล้ว จบเทิร์นอัตโนมัติ`, 'orange', true);
          game.setNextTurn(room);
      }
      
      game.io.to(player.id).emit('update hand', player.hand);
      game.emitRoomState(room.name);
      
      // Send deck information update
      game.sendDeckInfo(roomName);

      // Helper สำหรับ emit popup
      function emitCardUsedOnYou(targetId, cardObj) {
          if (!room.players[targetId] || !room.players[targetId].alive) return;
          game.io.to(room.players[targetId].id).emit('card used on you', player.name, cardObj.name, game.CARD_DESCRIPTION_THAI?.[cardObj.name] || cardObj.description || '');
      }
      // นำการ์ดไปกองทิ้งถ้าเป็น Witness
      if (cardToPlay.name === 'Witness') {
          room.discardPile.push(cardToPlay);
      }
  }

  function drawCards(roomName, playerUniqueId, count = 2) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      if (!room || !room.gameStarted || room.currentPhase !== 'DAY') {
          const player = room?.players[playerUniqueId];
          if (player) game.io.to(player.id).emit('game message', 'ตอนนี้ยังจั่วการ์ดไม่ได้.', 'red');
          return;
      }
      const player = room.players[playerUniqueId];
      if (!player || !player.alive || player.uniqueId !== room.currentTurnPlayerUniqueId) {
          if (player) {
              game.io.to(player.id).emit('game message', 'ไม่ใช่ตาของคุณหรือคุณไม่สามารถจั่วการ์ดได้.', 'red');
          }
          return;
      }

      if (room.playerForcedToConfess) {
          game.io.to(player.id).emit('game message', `รอให้ ${room.players[room.playerForcedToConfess].name} สารภาพก่อน`, 'orange');
          return;
      }

      if (room.awaitingCurseSelection?.selector === playerUniqueId) {
          game.io.to(player.id).emit('game message', 'กรุณาเลือกการ์ดจาก Curse ให้เสร็จก่อนจั่วการ์ด.', 'orange');
          return;
      }

      if (player.isSilenced) {
          game.io.to(player.id).emit('game message', 'คุณถูกทำให้เงียบและไม่สามารถจั่วการ์ดได้.', 'red');
          return;
      }

      // เพิ่มข้อความแจ้งเตือนการจั่วการ์ด
      game.sendGameMessage(room.name, `<b>${player.name}</b> จั่วการ์ด`, 'blue', true);

      // Check if player has already played cards this turn
      if (player.hasPlayedCardsThisTurn) {
          game.io.to(player.id).emit('game message', 'คุณได้เล่นการ์ดไปแล้วในเทิร์นนี้. คุณต้องจบเทิร์น.', 'red');
          return;
      }

      let drewAnyCard = false;
      for (let i = 0; i < count; i++) {
          if (room.gameDeck.length > 0) {
              const card = room.gameDeck.shift();
              game.io.to(roomName).emit('table card movement', { kind: 'draw', targetId: playerUniqueId, delay: i * 160 });
              if (card.type === 'Event') game.io.to(roomName).emit('table phase cue', { cardName: card.name });
              // If an Event card is drawn, resolve it immediately (กลางวันหรือกลางคืน)
              if (card.type === 'Event') {
                  switch (card.name) {
                      case 'Conspiracy':
                          game.sendGameMessage(room.name, `<b>${player.name}</b> จั่วได้การ์ด ${game.getCardNameWithColor('Conspiracy')} ต้องเปิดการ์ดชีวิตของผู้ถือเครื่องเซ่น!`, 'orange', true);
                          room.conspiracyDrawer = playerUniqueId;
                          if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                              const bcHolder = room.players[room.blackCatHolder];
                              if (bcHolder.tryalCards.length > 0) {
                                  room.awaitingConspiracySelection = {
                                      selector: playerUniqueId,
                                      target: room.blackCatHolder,
                                      tryalCount: bcHolder.tryalCards.length
                                  };
                                  game.io.to(player.id).emit('prompt select blackcat tryal', {
                                      blackCatHolder: room.blackCatHolder,
                                      tryalCount: bcHolder.tryalCards.length,
                                      blackCatHolderName: bcHolder.name,
                                      fromConspiracyDraw: true
                                  });
                                  room.discardPile.push(card); // discard ทันที
                                  return; // resolve event แล้วหยุดจั่วใบถัดไป
                              }
                          }
                          game.sendGameMessage(room.name, 'ไม่มีผู้ถือการ์ดเครื่องเซ่นในเกมแล้ว ข้ามขั้นเปิดการ์ดชีวิตและเข้าสู่ช่วงหยิบการ์ดจากผู้เล่นซ้ายมือทันที', 'blue', true);
                          game.promptTryalCardSelectionToLeft(roomName);
                          room.discardPile.push(card); // discard ทันที
                          return;
                      case 'Night':
                          game.sendGameMessage(room.name, `<b>${player.name}</b> จั่วได้การ์ด ${game.getCardNameWithColor('Night')} เกมจะเข้าสู่ช่วงกลางคืน!`, 'blue', true);
                          room.nightCardDrawer = playerUniqueId;
                          room.discardPile.push(card); // discard ทันที
                          game.changePhase(roomName, 'NIGHT');
                          game.sendGameMessage(room.name, 'กลางคืนเริ่มต้นขึ้น! ปอบและหมอผีเตรียมตัว', 'blue', true);
                          return;
                  }
              } else {
                  player.hand.push(card);
              }
              drewAnyCard = true;
          } else {
              // Reshuffle discard pile into game deck, but keep Night cards at bottom
              const nightCards = room.discardPile.filter(card => card.name === 'Night');
              const otherCards = room.discardPile.filter(card => card.name !== 'Night');
              room.gameDeck = game.shuffleArray([...otherCards]);
              room.discardPile = [];
              // Place Night cards at the bottom of the deck
              if (nightCards.length > 0) {
                  room.gameDeck = room.gameDeck.concat(nightCards);
              }
              // Try drawing again
              if (room.gameDeck.length > 0) {
                  const card = room.gameDeck.shift();
              game.io.to(roomName).emit('table card movement', { kind: 'draw', targetId: playerUniqueId, delay: i * 160 });
              if (card.type === 'Event') game.io.to(roomName).emit('table phase cue', { cardName: card.name });
                  if (card.type === 'Event') {
                      // resolve event ทันที (เหมือนข้างบน)
                      switch (card.name) {
                          case 'Conspiracy':
                              room.conspiracyDrawer = playerUniqueId;
                              if (room.blackCatHolder && room.players[room.blackCatHolder]?.alive) {
                                  const bcHolder = room.players[room.blackCatHolder];
                                  if (bcHolder.tryalCards.length > 0) {
                                      room.awaitingConspiracySelection = {
                                          selector: playerUniqueId,
                                          target: room.blackCatHolder,
                                          tryalCount: bcHolder.tryalCards.length
                                      };
                                      game.sendGameMessage(room.name, `จั่วได้การ์ด ${game.getCardNameWithColor('Conspiracy')}`, 'orange', true);
                                      game.io.to(player.id).emit('prompt select blackcat tryal', {
                                          blackCatHolder: room.blackCatHolder,
                                          tryalCount: bcHolder.tryalCards.length,
                                          blackCatHolderName: bcHolder.name,
                                          fromConspiracyDraw: true
                                      });
                                      room.discardPile.push(card);
                                      // Don't set next turn yet - wait for Tryal selection to complete
                                      return;
                                  }
                              }
                              game.sendGameMessage(room.name, 'ไม่มีผู้ถือการ์ดเครื่องเซ่นในเกมแล้ว ข้ามขั้นเปิดการ์ดชีวิตและเข้าสู่ช่วงหยิบการ์ดจากผู้เล่นซ้ายมือทันที', 'blue', true);
                              game.promptTryalCardSelectionToLeft(roomName);
                              room.discardPile.push(card);
                              // Don't set next turn yet - wait for Tryal selection to complete
                              return;
                          case 'Night':
                              room.nightCardDrawer = playerUniqueId;
                              game.sendGameMessage(room.name, `<b>${player.name}</b> ใช้การ์ด ${game.getCardNameWithColor('Night')}`, 'orange', true);
                              room.discardPile.push(card);
                              game.changePhase(roomName, 'NIGHT');
                              return;
                      }
                  } else {
                      player.hand.push(card);
                  }
                  drewAnyCard = true;
              } else {
                  break; // No more cards to draw
              }
          }
      }
      game.io.to(player.id).emit('update hand', player.hand);
      game.emitRoomState(room.name);
      // Mark that player has drawn cards this turn
      player.hasPlayedCardsThisTurn = true;
      // จบเทิร์นอัตโนมัติหลังจั่ว (ถ้ามีการ์ดให้จั่ว) - ยกเว้นการจั่วอัตโนมัติตอนเริ่มเทิร์น
      if (drewAnyCard && player.hand.length > 0) {
          game.setNextTurn(room);
      }
      // Send deck information update
      game.sendDeckInfo(roomName);
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

  return { shuffleArray, getCardNameWithColor, prepareDeckForNewDay, playCard, drawCards, sendDeckInfo, updateBlackCatHolder };
};
