const {test}=require('node:test');const assert=require('node:assert/strict');
const factory=require('../src/server/game/confession');
test('a player with one life can commit confession',()=>{
 const p={uniqueId:'p',alive:true,tryalCards:[{name:'Not A Witch'}]};
 const room={name:'r',gameStarted:true,currentPhase:'PRE_DAWN',players:{p},confessionActions:[]};
 const game={rooms:{r:room},isNightProtected:()=>false,emitRoomState:()=>{},getAlivePlayers:()=>[p,{uniqueId:'waiting'}]};
 const services=factory(game);services.submitConfessionChoice('r','p',0);
 assert.deepEqual(room.confessionActions,['p']);assert.equal(room.confessionChoices.p,0);
});
