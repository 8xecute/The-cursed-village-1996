// Shared red-card action for single-card clients, bots, and multi-card batches.
// Commit the whole selection once and reveal at most one life card.
module.exports = function createRedCardServices(game) {
  function playRedCards(roomName, playerId, indexes, targetId) {
      const room=game.rooms[roomName], player=room?.players[playerId], target=room?.players[targetId];
      if (!room || room.gameOver || !room.gameStarted || room.currentPhase!=='DAY' ||
          !player?.alive || player.isSilenced || room.currentTurnPlayerUniqueId!==playerId ||
          game.hasPendingCardAction(room) || !target?.alive || targetId===playerId) return;
      const reject=message=>{game.io.to(player.id).emit('game message',message,'orange');game.io.to(player.id).emit('card play rejected',{reason:'red_batch',message});};
      if(!Array.isArray(indexes) || indexes.length<1 || indexes.length>7 ||
          new Set(indexes).size!==indexes.length || indexes.some(i=>!Number.isInteger(i)||i<0||i>=player.hand.length)) return;
      const cards=indexes.map(i=>player.hand[i]);
      if(cards.some(card=>card.color!=='Red'||!['Accusation','Evidence','Witness'].includes(card.name))) return;
      const points=cards.reduce((total,card)=>total+card.value,0);
      const existing=room.accusedPlayers[targetId]||0;
      if(points<1||points>7) {reject('เล่นการ์ดแดงได้รวมไม่เกิน 7 แต้มต่อแอ็กชัน กรุณาลดจำนวนไพ่');return;}
      if(target.inPlayCards.some(card=>card.name==='Piety')) {reject('เป้าหมายมีพลังศรัทธา ใช้การ์ดแดงใส่ไม่ได้');return;}
      // Validate the whole batch before consuming any card; commit as one action.
      [...indexes].sort((a,b)=>b-a).forEach(index=>player.hand.splice(index,1));
      target.inPlayCards.push(...cards);
      room.accusedPlayers[targetId]=existing+points;
      player.hasPlayedCardsThisTurn=true;
      game.sendGameMessage(room.name, `${player.name} ใช้การ์ดแดง ${cards.length} ใบ (${cards.map(card=>game.CARD_NAME_THAI[card.name]||card.name).join(', ')}) ใส่ ${target.name} +${points} รวม ${existing+points}/7`, 'orange', true);
      game.io.to(player.id).emit('update hand',player.hand);
      game.io.to(player.id).emit('disable draw button');
      game.io.to(player.id).emit('card played successfully');
      game.io.to(target.id).emit('update in play cards',target.inPlayCards);
      game.io.to(target.id).emit('card used on you',player.name,cards[0].name,`ใช้การ์ดแดง ${cards.length} ใบ · ข้อกล่าวหา +${points} รวม ${existing+points}/7`);
      cards.forEach((card,index)=>game.io.to(room.name).emit('card action feedback',{
          actorId:playerId,actorName:player.name,cardName:card.name,targetId,targetName:target.name,
          discard:false,delay:index*180,result:`ข้อกล่าวหารวม ${existing+points}/7`
      }));
      // One batch can trigger only one reveal, even when the total exceeds seven.
      if(existing+points>=7) {
          room.playerForcedToRevealTryal=targetId;
          room.playerForcedToRevealSelector=playerId;
          game.io.to(player.id).emit('prompt select accused tryal',{accusedUniqueId:targetId,tryalCount:target.tryalCards.length});
          game.io.to(target.id).emit('forced reveal notice',{byPlayerName:player.name,reason:'accusation_threshold',points:existing+points});
      }
      game.emitRoomState(roomName);
      game.sendDeckInfo(roomName);
      game.finishEmptyHandTurn(room);
  }

  return { playRedCards };
};
