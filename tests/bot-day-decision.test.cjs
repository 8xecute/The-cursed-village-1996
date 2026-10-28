const {test}=require('node:test');const assert=require('node:assert/strict');
const {chooseCardAction,chooseDayDecision}=require('../src/bots/strategy');
const state={players:{bot:{uniqueId:'bot',alive:true},target:{uniqueId:'target',alive:true,tryalCardCount:5,handSize:0,inPlayCards:[],accusationPoints:0}}};
test('one accusation can be played without waiting for seven points',()=>{
 const hand=[{name:'Accusation',color:'Red'}];const candidate=chooseCardAction({state,id:'bot',hand});
 assert.equal(candidate.kind,'red');assert.deepEqual(candidate.indexes,[0]);
 assert.equal(chooseDayDecision({candidate,handSize:1,hasPlayed:false,random:()=>.99}),'play');
 assert.equal(chooseDayDecision({candidate,handSize:1,hasPlayed:false,random:()=>0}),'draw');
});
test('a bot never draws after playing and takes a strong reveal opportunity',()=>{
 const candidate={kind:'red',score:1};
 assert.equal(chooseDayDecision({candidate,handSize:1,hasPlayed:true,random:()=>0}),'play');
 assert.equal(chooseDayDecision({candidate:null,handSize:1,hasPlayed:true}),'end');
 assert.equal(chooseDayDecision({candidate:{kind:'red',score:12},handSize:1,hasPlayed:false,random:()=>0}),'play');
});
test('Piety and known witch allies remain invalid red targets',()=>{
 const hand=[{name:'Accusation',color:'Red'}];
 const protectedState=JSON.parse(JSON.stringify(state));protectedState.players.target.inPlayCards=[{name:'Piety'}];
 assert.equal(chooseCardAction({state:protectedState,id:'bot',hand}),null);
 const allies=JSON.parse(JSON.stringify(state));allies.players.bot.hasBeenWitch=true;allies.players.target.hasBeenWitch=true;
 assert.equal(chooseCardAction({state:allies,id:'bot',hand}),null);
});
