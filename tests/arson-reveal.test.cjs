const {test}=require('node:test');const assert=require('node:assert/strict');const arson=require('../src/server/game/card-effects/arson');
test('arson publicly reveals exactly the discarded hand',()=>{
 const cards=[{name:'Evidence',color:'Red'},{name:'Alibi',color:'Green'}];const target={id:'t',name:'Target',hand:[...cards]};const room={name:'r',players:{t:target},discardPile:[]};const events=[];
 const game={io:{to:id=>({emit:(...args)=>events.push([id,...args])})},sendGameMessage:()=>{},getCardNameWithColor:n=>n};
 arson(game,{room,player:{name:'Actor'},cardToPlay:{name:'Arson'},targetUniqueId:'t',emitCardUsedOnYou:()=>{}});
 assert.deepEqual(room.discardPile,cards);assert.deepEqual(target.hand,[]);assert.deepEqual(events.find(e=>e[1]==='arson cards revealed')[2].cards,cards);
 assert.equal(room.discardPile.at(-1).name,'Alibi');
});
