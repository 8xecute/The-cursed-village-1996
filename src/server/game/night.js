// Resolve the committed target only after all confession choices are complete.
module.exports = function createServices(game) {
  function resolveNightActions(roomName) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;
      const targetId = room.playersWhoActedAtNight?.witchKill;
      const target = room.players[targetId];
      const aliveWitches = game.getAlivePlayers(room).filter(player => player.hasBeenWitch || player.isWitch);
      room.killedPlayer = null;
      room.killedPlayerMatchmaker = null;
      if (target?.alive && aliveWitches.length > 0) {
          const protectedBy = target.inPlayCards.some(card => card.name === 'Asylum') ? 'ที่หลบภัย'
              : room.playersWhoActedAtNight.constableSave === targetId ? 'หมอผี'
              : room.nightConfessors?.includes(targetId) ? 'การสารภาพบาป' : null;
          if (protectedBy) {
              game.sendGameMessage(room.name, `${target.name} รอดจากการสังหารด้วย${protectedBy}`, 'green', true);
          } else {
              game.sendGameMessage(room.name, `${target.name} ถูกสังหารในตอนกลางคืน!`, 'red', true);
              game.handlePlayerDeath(room, target, { byPlayerName: room.lastNightKillerName || null, cause: 'night_kill' });
              return;
          }
      }
      game.sendGameMessage(room.name, 'ไม่มีผู้เสียชีวิตจากการสังหารในคืนนี้', 'green', true);
      game.checkWinCondition(room);
  }

  function allWitchesActed(room) {
      const witches = game.getAlivePlayers(room).filter(p => p.hasBeenWitch || p.isWitch);
      // ถ้าไม่มีปอบ หรือมีการเลือก witchKill แล้ว (null หรือ id)
      return witches.length === 0 || room.playersWhoActedAtNight['witchKill'] !== undefined;
  }

  return { resolveNightActions, allWitchesActed };
};
