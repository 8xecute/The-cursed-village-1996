// outcome: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function checkWinCondition(room) {
      if (room.gameOver) return;

      const alivePlayers = game.getAlivePlayers(room);
      // เงื่อนไขใหม่: นับจาก hasBeenWitch
      const aliveWitches = alivePlayers.filter(p => p.hasBeenWitch);
      const aliveTownsfolk = alivePlayers.filter(p => !p.hasBeenWitch);

      // ตรวจสอบว่ามีการ์ด Witch ที่ยังไม่ถูกเปิดอยู่ในเกมหรือไม่
      let witchCardLeft = false;
      for (const p of Object.values(room.players)) {
          if (p.tryalCards) {
              p.tryalCards.forEach((card, idx) => {
                  const revealed = p.revealedTryalCardIndexes && (typeof p.revealedTryalCardIndexes.has === 'function'
                      ? p.revealedTryalCardIndexes.has(idx)
                      : p.revealedTryalCardIndexes.includes && p.revealedTryalCardIndexes.includes(idx));
                  if (card.name === 'Witch' && !revealed) {
              witchCardLeft = true;
                  }
              });
          }
      }

      // 1. ทีมปอบชนะเมื่อไม่มีชาวบ้านที่ยังไม่เคยติดเชื้อเหลืออยู่
      if (alivePlayers.length > 0 && aliveWitches.length === alivePlayers.length) {
          game.finishGame(room, 'Witches', 'ปอบชนะ! ผู้เล่นที่ยังรอดทั้งหมดอยู่ฝ่ายปอบแล้ว!', 'red');
          return;
      }
      // 2. ทีมชาวบ้านชนะทันทีเมื่อเปิด Tryal Card ที่เป็น Witch ครบ
      if (!witchCardLeft && aliveTownsfolk.length > 0) {
          game.finishGame(room, 'Townsfolk', 'ชาวบ้านชนะ! เปิดเผยการ์ดปอบครบทุกใบแล้ว!', 'green');
          return;
      }
      // 3. ไม่มีผู้เล่นเหลืออยู่ (เสมอ)
      if (alivePlayers.length === 0) {
          game.finishGame(room, 'None (Draw)', 'ไม่มีผู้เล่นเหลืออยู่... เสมอ!', 'grey');
          return;
      }
  }

  function finishGame(room, winner, message, color) {
      if (room.gameOver) return;
      room.gameOver = true;
      room.currentPhase = 'GAME_OVER';
      room.winner = winner;
      clearInterval(room.phaseInterval);
      clearTimeout(room.nightActionTimeout);
      clearTimeout(room.confessionTimer);
      room.phaseTimer = 0;
      game.sendGameMessage(room.name, message, color, true);

      const playersArr = Object.values(room.players || {});
      room.gameSummary = {
          winner: winner,
          message: message,
          color: color,
          daysSurvived: room.dayNumber,
          players: playersArr.map(p => ({
              name: p.name,
              alive: !!p.alive,
              isHost: !!p.isHost,
              hasBeenWitch: !!p.hasBeenWitch,
              tryalCards: (p.tryalCards || []).map(c => c.name),
              revealedTryals: Array.from(p.revealedTryalCardIndexes || [])
          }))
      };

      game.io.to(room.name).emit('game over summary', room.gameSummary);
      game.emitRoomState(room.name);
  }

  function handlePlayerDeath(room, player, metadata = {}) {
      if (!player || !player.alive || room.gameOver) return;
      player.alive = false;
      if (!room.deathLog) room.deathLog = [];
      if (!room.firstVictim) room.firstVictim = player.name;
      room.deathLog.push({
          playerName: player.name,
          byPlayerName: metadata.byPlayerName || null,
          cause: metadata.cause || 'unknown',
          day: room.dayNumber,
          timestamp: Date.now(),
      });
      // แจ้งเตือนว่าผู้เล่นตาย
      game.sendGameMessage(room.name, `<b>${player.name}</b> ตายแล้ว!`, 'red', true);
      // Reveal all Tryal Cards (เปิดการ์ดชีวิตทั้งหมด)
      player.revealedTryalCardIndexes = new Set(player.tryalCards.map((_, idx) => idx));
      // Sync revealedTryalCardIndexes to array for client (safety)
      game.io.to(player.id).emit('update revealed tryal indexes', Array.from(player.revealedTryalCardIndexes));
      // แสดงชื่อการ์ดชีวิตที่เหลือทั้งหมด
      if (player.tryalCards && player.tryalCards.length > 0) {
          const cardNames = player.tryalCards.map(card => game.getCardNameWithColor(card.name)).join(', ');
          game.sendGameMessage(room.name, `การ์ดชีวิตที่เหลือของ <b>${player.name}</b>: ${cardNames}`, 'gold', true);
      }
      // ทิ้งการ์ดในมือทั้งหมดลงกองทิ้ง
      if (player.hand && player.hand.length > 0) {
          room.discardPile.push(...player.hand);
          player.hand = [];
      }
      // ทิ้งการ์ด inPlayCards (Permanent/Blue)
      if (player.inPlayCards && player.inPlayCards.length > 0) {
          const blueCards = player.inPlayCards.filter(card => card.color === 'Blue');
          const otherCards = player.inPlayCards.filter(card => card.color !== 'Blue');
          if (otherCards.length > 0) {
              room.discardPile.push(...otherCards);
          }
          // การ์ดสีน้ำเงิน (Blue) จะถูกลบออกจากเกม ไม่ใส่ discardPile
          // Reset Black Cat holder if needed
          if (blueCards.some(card => card.name === 'Black Cat')) {
              room.blackCatHolder = null;
          }
          // --- Matchmaker: ถ้าตายและมีการ์ดนี้ ให้ฆ่าคู่ผูกวิญญาณด้วย ---
          if (blueCards.some(card => card.name === 'Matchmaker')) {
              const otherMatchmaker = Object.values(room.players).find(p => p.uniqueId !== player.uniqueId && p.alive && p.inPlayCards && p.inPlayCards.some(c => c.name === 'Matchmaker'));
              if (otherMatchmaker) {
                  game.sendGameMessage(room.name, `${otherMatchmaker.name} ตายพร้อมกับ <b>${player.name}</b> เนื่องจาก Matchmaker!`, 'red', true);
                  game.handlePlayerDeath(room, otherMatchmaker, {
                      byPlayerName: player.name,
                      cause: 'matchmaker_link',
                  });
              }
          }
          player.inPlayCards = [];
      }
      game.updateBlackCatHolder(room);
      game.emitRoomState(room.name); // อัปเดตสถานะผู้เล่น
      game.checkWinCondition(room); // เช็คปอบชนะทันทีหลังมีผู้เล่นตาย
  }

  function eliminatePlayerWithoutLifeCards(room, player) {
      if (!room || room.gameOver || !player || !player.alive || !Array.isArray(player.tryalCards) || player.tryalCards.length > 0) {
          return false;
      }

      game.sendGameMessage(room.name, `<b>${player.name}</b> การ์ดชีวิตหมดแล้ว!`, 'red', true);
      game.handlePlayerDeath(room, player, { cause: 'tryal_cards_exhausted' });
      return true;
  }

  return { checkWinCondition, finishGame, handlePlayerDeath, eliminatePlayerWithoutLifeCards };
};
