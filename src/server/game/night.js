// night: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function resolveNightActions(roomName) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;

      game.sendGameMessage(room.name, 'ช่วงเวลากลางคืนจบลงถึงช่วงเวลาสารภาพ...', 'blue', true);

      // Debug log
      // console.log('--- [DEBUG] resolveNightActions ---');
      // console.log('nightConfessors:', room.nightConfessors);
      // console.log('playersWhoActedAtNight:', room.playersWhoActedAtNight);

      // 1. Witch Kill (if any alive witches) - but don't reveal who was killed yet
      const aliveWitches = game.getAlivePlayers(room).filter(p => p.hasBeenWitch || p.isWitch);
      const chosenToKillUniqueId = room.playersWhoActedAtNight['witchKill'];

      if (aliveWitches.length > 0 && chosenToKillUniqueId) {
          const targetPlayer = room.players[chosenToKillUniqueId];
          if (targetPlayer && targetPlayer.alive) {
              // Check if target has Asylum card
              const hasAsylum = targetPlayer.inPlayCards.some(card => card.name === 'Asylum');
              // Check if target was protected by constable
              const wasProtectedByConstable = room.playersWhoActedAtNight['constableSave'] === chosenToKillUniqueId;
              // Check if target confessed during pre-dawn
              const confessedDuringNight = room.nightConfessors && room.nightConfessors.includes(chosenToKillUniqueId);

              // Debug log
              // console.log('Witch target:', targetPlayer.name, 'hasAsylum:', hasAsylum, 'wasProtectedByConstable:', wasProtectedByConstable, 'confessedDuringNight:', confessedDuringNight);
              
              if (hasAsylum || wasProtectedByConstable || confessedDuringNight) {
                  
              } else {
                  // Store the killed player info for later announcement (after confession period)
                  room.killedPlayer = targetPlayer;
                  // Check win condition after player death
                  game.checkWinCondition(room);
                  // Handle Matchmaker if target has it
                  const matchmakerCard = targetPlayer.inPlayCards.find(c => c.name === 'Matchmaker');
                  if (matchmakerCard) {
                      const otherMatchmakerHolder = game.getAlivePlayers(room).find(p => p.uniqueId !== targetPlayer.uniqueId && p.inPlayCards.some(c => c.name === 'Matchmaker'));
                      if (otherMatchmakerHolder) {
                          room.killedPlayerMatchmaker = otherMatchmakerHolder;
                          // Check win condition after matchmaker death
                          game.checkWinCondition(room);
                      }
                  }
              }
          }
      }

      // 2. Constable Save (if any alive constables) - This is now handled above
      const chosenToSaveUniqueId = room.playersWhoActedAtNight['constableSave'];
      if (chosenToSaveUniqueId && !room.players[chosenToSaveUniqueId]?.alive) {
          // If constable saved someone who was killed, revive them
          const targetPlayer = room.players[chosenToSaveUniqueId];
          targetPlayer.alive = true;
          game.sendGameMessage(room.name, `${targetPlayer.name} ได้รับการช่วยเหลือจากหมอผี!`, 'green', true);
      }

      game.checkWinCondition(room);
      // Don't change phase here anymore - it's handled in changePhase for PRE_DAWN
      // Remove the pendingPreDawn logic since it's now handled in changePhase

      // --- ใน resolveNightActions ---
      // ไม่ต้องประกาศการปกป้องจากการสารภาพ
      let killed = false;
      if (room.killedPlayer) {
          game.sendGameMessage(room.name, `${room.killedPlayer.name} ถูกสังหารในตอนกลางคืน!`, 'red', true);
          game.handlePlayerDeath(room, room.killedPlayer, {
              byPlayerName: room.lastNightKillerName || null,
              cause: 'night_kill',
          });
          if (room.gameOver) return;
          // เก็บชื่อไว้ก่อน set เป็น null
          var killedPlayerName = room.killedPlayer.name;
          room.killedPlayer = null;
          killed = true;
      }
      if (room.killedPlayerMatchmaker) {
          // ใช้ killedPlayerName ถ้ามี ไม่ใช้ room.killedPlayer.name โดยตรง
          const matchmakerName = room.killedPlayerMatchmaker.name;
          game.sendGameMessage(room.name, `${matchmakerName} ตายพร้อมกับ ${killedPlayerName || ''} เนื่องจาก Matchmaker!`, 'red', true);
          game.handlePlayerDeath(room, room.killedPlayerMatchmaker, {
              byPlayerName: killedPlayerName || null,
              cause: 'matchmaker_link',
          });
          room.killedPlayerMatchmaker = null;
          killed = true;
      }
      if (!killed) {
          game.sendGameMessage(room.name, 'ทุกคนปลอดภัยในคืนนี้!', 'green', true);
      }
      // ... reset state for new day ...
  }

  function allWitchesActed(room) {
      const witches = game.getAlivePlayers(room).filter(p => p.hasBeenWitch || p.isWitch);
      // ถ้าไม่มีปอบ หรือมีการเลือก witchKill แล้ว (null หรือ id)
      return witches.length === 0 || room.playersWhoActedAtNight['witchKill'] !== undefined;
  }

  return { resolveNightActions, allWitchesActed };
};
