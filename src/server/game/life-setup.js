// Private life deck, round-robin dealing, and unanimous preparation barrier.
module.exports = function createLifeSetupServices(game) {
  function cancelLifeSetup(room) {
    clearTimeout(room.lifeSetupTimer);
    room.lifeSetupTimer = null;
    room.lifeSetup = null;
  }
  function beginLifeSetup(room, cards, count) {
    cancelLifeSetup(room);
    const setup = room.lifeSetup = { id: game.uuidv4(), stage: 'shuffle', order: game.getAlivePlayers(room).map(p => p.uniqueId),
      cards, count, dealt: 0, total: cards.length, confirmed: [], lastDeal: null };
    const valid = () => game.rooms[room.name] === room && room.lifeSetup === setup && !room.gameOver && room.currentPhase === 'SETUP';
    function next() {
      if (!valid()) return;
      if (setup.dealt === setup.total) {
        setup.stage = 'arrange';
        for (const id of setup.order) {
          const player = room.players[id];
          player.isWitch = player.hasBeenWitch = player.tryalCards.some(c => c.name === 'Witch');
          player.isConstable = player.tryalCards.some(c => c.name === 'Constable');
        }
        setup.cards = [];
        room.lifeSetupTimer = null;
        game.emitRoomState(room.name);
        return;
      }
      setup.stage = 'deal';
      const id = setup.order[setup.dealt % setup.order.length];
      const player = room.players[id];
      const index = player.tryalCards.length;
      player.tryalCards.push(setup.cards[setup.dealt]);
      setup.dealt++;
      setup.lastDeal = { playerId: id, index, sequence: setup.dealt };
      game.emitRoomState(room.name);
      game.io.to(room.name).emit('table card movement', { kind: 'life-deal', targetId: id, lifeIndex: index });
      room.lifeSetupTimer = setTimeout(next, setup.dealt === setup.total ? 750 : 380);
    }
    game.emitRoomState(room.name);
    game.sendDeckInfo(room.name);
    room.lifeSetupTimer = setTimeout(next, 1800);
  }
  function swapSetupLives(roomName, id, from, to, setupId) {
    const room = game.rooms[roomName], setup = room?.lifeSetup, player = room?.players[id];
    if (!room || room.gameOver || room.currentPhase !== 'SETUP' || setup?.stage !== 'arrange' || setup.id !== setupId ||
        !player?.alive || setup.confirmed.includes(id) || !Number.isInteger(from) || !Number.isInteger(to) ||
        from < 0 || to < 0 || from >= player.tryalCards.length || to >= player.tryalCards.length || from === to) return;
    [player.tryalCards[from], player.tryalCards[to]] = [player.tryalCards[to], player.tryalCards[from]];
    game.emitRoomState(roomName);
  }
  function confirmLifeSetup(roomName, id, setupId) {
    const room = game.rooms[roomName], setup = room?.lifeSetup;
    if (!room || room.gameOver || room.currentPhase !== 'SETUP' || setup?.stage !== 'arrange' || setup.id !== setupId ||
        !room.players[id]?.alive || !setup.order.includes(id) || setup.confirmed.includes(id)) return;
    setup.confirmed.push(id);
    if (!setup.order.every(id => setup.confirmed.includes(id))) { game.emitRoomState(roomName); return; }
    cancelLifeSetup(room);
    const witches = game.getAlivePlayers(room).filter(p => p.isWitch);
    room.currentPhase = 'LOBBY';
    if (witches.length) {
      room.isAssigningBlackCat = true;
      game.sendGameMessage(room.name, 'ทุกคนยืนยันการ์ดชีวิตแล้ว ปอบเลือกผู้รับเครื่องเซ่นได้', 'blue', true);
      game.emitRoomState(room.name);
      const targets = game.getAlivePlayers(room).map(p => ({ uniqueId: p.uniqueId, name: p.name }));
      witches.forEach(player => game.io.to(player.id).emit('popup assign black cat', targets));
    } else {
      if (room.pendingBlackCatCard) room.discardPile.push(room.pendingBlackCatCard);
      room.pendingBlackCatCard = null;
      game.changePhase(room.name, 'NIGHT');
    }
  }
  return { beginLifeSetup, cancelLifeSetup, swapSetupLives, confirmLifeSetup };
};
