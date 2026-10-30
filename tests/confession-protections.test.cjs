const {test}=require('node:test');const assert=require('node:assert/strict');
const confession=require('../src/server/game/confession');const phases=require('../src/server/game/phases');
test('protection announcement precedes confession state and excludes dead players',()=>{
 const players=[{uniqueId:'a',name:'A',alive:true,inPlayCards:[]},{uniqueId:'b',name:'B',alive:true,inPlayCards:[{name:'Asylum'}]},{uniqueId:'c',name:'C',alive:false,inPlayCards:[{name:'Asylum'}]}];
 const room={name:'r',players:Object.fromEntries(players.map(p=>[p.uniqueId,p])),gameStarted:true,currentPhase:'NIGHT',dayNumber:1,phaseConfig:{PRE_DAWN:0},playersWhoActedAtNight:{constableSave:'a',witchKill:'b'}};
 const events=[];const game={rooms:{r:room},getAlivePlayers:r=>Object.values(r.players).filter(p=>p.alive),io:{to:()=>({emit:(event,data)=>events.push([event,data])})},sendGameMessage:(...args)=>events.push(['log',args]),emitRoomState:()=>events.push(['state']),DEFAULT_PHASE_DURATIONS:{},finishConfessionIfReady:()=>{}};
 Object.assign(game,require('../src/server/game/night')(game));Object.assign(game,confession(game));game.finishConfessionIfReady=()=>{};Object.assign(game,phases(game));game.changePhase('r','PRE_DAWN');
 const announcement=events.find(e=>e[0]==='confession protection announcement');assert.ok(announcement);assert.match(announcement[1].message,/A.*หมอผีปกป้อง/);assert.match(announcement[1].message,/B.*ที่หลบภัย/);assert.ok(!announcement[1].message.includes('C ('));
 assert.ok(events.indexOf(announcement)<events.findIndex(e=>e[0]==='state'));assert.deepEqual(room.confessionActions,['a','b']);assert.equal(room.currentPhase,'PRE_DAWN');
 assert.equal(game.getConfessionProtections(room).length,2);
});
