const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../src/server/game/action-timer');
function fixture(){
 const room={name:'r',gameStarted:true,currentPhase:'DAY',turnSerial:1,currentTurnPlayerUniqueId:'p',players:{p:{id:'socket',uniqueId:'p',alive:true,hand:[{}],inPlayCards:[],hasPlayedCardsThisTurn:false}},actionSeconds:0};
 const calls=[];
 const game={rooms:{r:room},sendGameMessage:()=>{},getAlivePlayers:()=>Object.values(room.players),drawCards:()=>calls.push('draw'),endTurn:()=>calls.push('end'),emitRoomState:()=>service.syncActionClock(room)};
 const service=create(game);return {room,calls,service};
}
test('deadline draws before play and ends after play',async()=>{
 for(const played of [false,true]){
 const {room,calls,service}=fixture();room.actionSeconds=.01;room.players.p.hasPlayedCardsThisTurn=played;service.syncActionClock(room);
 await new Promise(r=>setTimeout(r,30));assert.deepEqual(calls,[played?'end':'draw']);room.actionClock.clear();
 }
});
test('only acting player cancels in last ten seconds, another player can restart manual clock',()=>{
 const {room,service}=fixture();room.players.other={id:'other',uniqueId:'other',alive:true,hand:[],inPlayCards:[]};
 const handlers={};service.registerActionClock({currentRoom:'r',uniqueId:'other',on:(k,v)=>handlers[k]=v});
 service.syncActionClock(room);handlers['start action clock']();assert.ok(room.actionClock.current);
 handlers['cancel action clock']();assert.ok(room.actionClock.current);
 room.actionClock.clear();room.actionClock.start(room.actionClockKey,5);
 const own={};service.registerActionClock({currentRoom:'r',uniqueId:'p',on:(k,v)=>own[k]=v});
 own['cancel action clock']();assert.equal(room.actionClock.current,null);
 handlers['start action clock']();assert.ok(room.actionClock.current.deadline-Date.now()>59000);room.actionClock.clear();
});
test('game over clears active countdown',()=>{const {room,service}=fixture();room.actionSeconds=60;service.syncActionClock(room);room.gameOver=true;assert.equal(service.syncActionClock(room).deadline,null);});
