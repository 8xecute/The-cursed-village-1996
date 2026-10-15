// conspiracy: game services. Dependencies are injected through game.
module.exports = function createServices(game) {
  function promptTryalCardSelectionToLeft(roomName) {
      const room = game.rooms[roomName];
      if (!room || room.gameOver) return;

      const alivePlayers = game.getAlivePlayers(room);
      if (alivePlayers.length <= 1) {
          room.awaitingLeftTryalSelections = false;
          game.sendGameMessage(room.name, 'จำนวนผู้เล่นไม่พอที่จะส่ง Tryal Card.', 'grey');
          game.emitRoomState(roomName);
          return;
      }

      room.awaitingLeftTryalSelections = true;
      room.conspiracyTryalSelections = {}; // uniqueId -> index/null

      // Map uniqueId → player object for easier lookup
      const playerOrder = alivePlayers.map(p => p.uniqueId);

      alivePlayers.forEach((player, idx) => {
          const leftIdx = (idx + alivePlayers.length - 1) % alivePlayers.length;
          const leftPlayer = alivePlayers[leftIdx];
          if (leftPlayer.tryalCards.length > 0) {
              game.io.to(player.id).emit('prompt select left tryal', {
                  leftPlayerUniqueId: leftPlayer.uniqueId,
                  leftPlayerName: leftPlayer.name,
                  leftPlayerTryalCount: leftPlayer.tryalCards.length
              });
          } else {
              // แจ้งว่าไม่มีไพ่ให้เลือก และบันทึก null ทันที
              game.io.to(player.id).emit('prompt select left tryal', {
                  leftPlayerUniqueId: leftPlayer.uniqueId,
                  leftPlayerName: leftPlayer.name,
                  leftPlayerTryalCount: 0
              });
              room.conspiracyTryalSelections[player.uniqueId] = null;
          }
      });
      game.emitRoomState(roomName);
  }

  return { promptTryalCardSelectionToLeft };
};
