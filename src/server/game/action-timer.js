const { createActionClock } = require('./action-clock');
const { lifeIndex, curseIndex, alibiIndexes } = require('../../bots/pending-choices');
module.exports = game => {
  function task(room) {
    if (!room.gameStarted || room.gameOver || room.currentPhase !== 'DAY' || room.prankShot) return null;
    if (room.playerForcedToRevealTryal) return { id: room.playerForcedToRevealSelector, kind: 'life', target: room.playerForcedToRevealTryal };
    for (const [field, kind] of [['awaitingCurseSelection','curse'],['awaitingAlibiSelection','alibi'],['awaitingConspiracySelection','blackcat']]) {
      if (room[field]) return { id: room[field].selector, kind, target: room[field].target };
    }
    if (room.awaitingLeftTryalSelections) {
      const pending = game.getAlivePlayers(room).find(p => room.conspiracyTryalSelections?.[p.uniqueId] === undefined);
      return pending ? {id:pending.uniqueId,kind:'left'} : null;
    }
    if (room.pendingDraw || room.isAssigningBlackCat) return null;
    return {id:room.currentTurnPlayerUniqueId,kind:'turn'};
  }
  function invoke(room, id, event, ...args) {
    const handlers = new Map();
    const socket = { id:room.players[id]?.id, uniqueId:id, currentRoom:room.name, on:(name,fn)=>handlers.set(name,fn) };
    require('../socket/confession')(socket,game);
    require('../socket/conspiracy')(socket,game);
    require('../socket/card-effects/curse')(socket,game);
    require('../socket/card-effects/alibi')(socket,game);
    handlers.get(event)?.(...args);
  }
  function expire(room, expected) {
    if (game.rooms[room.name] !== room || room.actionClockKey !== expected) return;
    const action=task(room), player=room.players[action?.id];
    if (!player?.alive) return;
    game.sendGameMessage(room.name, `${player.name} หมดเวลา · ระบบทำแอ็กชันให้อัตโนมัติ`, 'orange');
    if(action.kind==='turn') {
      if(player.hasPlayedCardsThisTurn) game.endTurn(room.name,player.uniqueId);
      else game.drawCards(room.name,player.uniqueId,2);
    } else if(action.kind==='life' || action.kind==='blackcat') {
      const index=lifeIndex(room.players[action.target]?.tryalCards.length || 0);
      if(index!==null) invoke(room,action.id,action.kind==='life'?'select tryal card for confession':'select blackcat tryal',action.target,index);
    } else if(action.kind==='curse') {
      const index=curseIndex(room.players[action.target]?.inPlayCards.filter(c=>c.color==='Blue') || []);
      invoke(room,action.id,index===null?'cancel curse selection':'select curse target',action.target,index);
    } else if(action.kind==='alibi') {
      const cards=(room.players[action.target]?.inPlayCards || []).map((c,index)=>({...c,index})).filter(c=>c.color==='Red');
      const selectedIndexes=alibiIndexes(cards);
      invoke(room,action.id,selectedIndexes.length?'select alibi removal':'cancel alibi selection',{selectedIndexes});
    } else if(action.kind==='left') {
      const alive=game.getAlivePlayers(room), index=alive.findIndex(p=>p.uniqueId===action.id);
      const left=alive[(index+alive.length-1)%alive.length];
      invoke(room,action.id,'select left tryal',lifeIndex(left?.tryalCards.length || 0) ?? 0);
    }
    game.emitRoomState(room.name);
  }
  function syncActionClock(room) {
    room.actionClock ||= createActionClock({onExpire:key=>expire(room,key)});
    const action=task(room), p=room.players[action?.id];
    const key=action && p?.alive ? JSON.stringify([room.turnSerial,action,p.hand.length,p.inPlayCards.length,p.hasPlayedCardsThisTurn]) : null;
    if(key!==room.actionClockKey) {
      room.actionClock.clear();room.actionClockKey=key;
      if(key && room.actionSeconds) room.actionClock.start(key,room.actionSeconds);
    }
    return {seconds:room.actionSeconds || 0, deadline:room.actionClock.current?.deadline || null, playerId:action?.id || null, serverNow:Date.now(), available:!!key};
  }
  function registerActionClock(socket) {
    socket.on('set action seconds',seconds=>{
      const room=game.rooms[socket.currentRoom];
      if(!room || room.gameStarted || room.hostUniqueId!==socket.uniqueId || !Number.isInteger(seconds) || seconds<0 || seconds>600) return;
      room.actionSeconds=seconds;game.emitRoomState(room.name);
    });
    socket.on('start action clock',()=>{
      const room=game.rooms[socket.currentRoom];
      if(!room?.players[socket.uniqueId]?.alive || room.actionSeconds) return;
      const state=syncActionClock(room);
      if(state.available && !state.deadline) {room.actionClock.start(room.actionClockKey,60);game.emitRoomState(room.name);}
    });
    socket.on('cancel action clock',()=>{
      const room=game.rooms[socket.currentRoom];
      if(!room) return;
      const state=syncActionClock(room);
      if(state.playerId!==socket.uniqueId || !state.deadline || state.deadline-Date.now()>10000) return;
      room.actionClock.clear();game.emitRoomState(room.name);
    });
  }
  return {syncActionClock,registerActionClock};
};
