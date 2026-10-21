// Render current UI components with local example data, without a game server.
// node scripts/preview-october-update.cjs OUTPUT_DIRECTORY
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const publicRoot = path.resolve(__dirname, '../public');
(async () => {
    const output = path.resolve(process.argv[2]); fs.mkdirSync(output, {recursive:true});
    const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
    try {
        const page = await browser.newPage({viewport:{width:1600,height:1000}});
        page.on('pageerror', error => console.error(error.message));
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.hostname !== 'preview.test') return route.abort();
            const file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
            if (!file.startsWith(publicRoot + path.sep) || !fs.existsSync(file)) return route.abort();
            const extension = path.extname(file);
            const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8', '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary'}[extension] || 'application/octet-stream';
            let body = fs.readFileSync(file);
            if (extension === '.html') body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
            return route.fulfill({contentType:type,body});
        });
        await page.goto('http://preview.test/');
        await page.screenshot({path:path.join(output,'halloween-home.png')});
        await page.addScriptTag({url:'/table3d.bundle.js'});
        await page.evaluate(async () => {
            const {client} = await import('/js/core/client.js'); window.previewClient = client;
            const handlers = new Map();
            client.state.socket = {connected:true, on(name, handler) { if (!handlers.has(name)) handlers.set(name,[]); handlers.get(name).push(handler); }, emit() {}};
            window.previewEvent = (name, data) => handlers.get(name)?.forEach(handler=>handler(data));
            client.state.myUniqueId='p0'; client.state.myPlayerName='คุณ';
            for(const [key,id] of Object.entries({drawCardButton:'draw-card-btn',playCardButton:'play-card-btn',endTurnButton:'end-turn-btn'})) client.dom[key]=document.getElementById(id) || document.createElement('button');
            client.state.cardNameMap={};
            await import('/js/cards/translations.js'); await import('/js/cards/hand.js');
            client.actions.getTable3DInteraction=()=>null; client.actions.handleTable3DPlayer=()=>{};
            const hand=['Accusation','Evidence','Stocks','Accusation','Alibi','Scapegoat','Matchmaker','Arson','Piety','Curse','Accusation','Robbery'].map(name=>({name,color:['Accusation','Evidence'].includes(name)?'Red':['Matchmaker','Piety'].includes(name)?'Blue':'Green'}));
            const players=Object.fromEntries(Array.from({length:4},(_,i)=>['p'+i,{
                uniqueId:'p'+i,name:['คุณ','คำปัน','มาลี','แก้ว'][i],alive:true,handSize:i?5:hand.length,tryalCardCount:5,
                tryalCards:['Witch','Constable','Not A Witch','Not A Witch','Not A Witch'].map(name=>({name:i?null:name})),
                inPlayCards:i===1?[{name:'Evidence',color:'Red'},{name:'Piety',color:'Blue'},{name:'Stocks',color:'Green'}]:[],revealedTryalCards:[]
            }]));
            const state={gameStarted:true,currentPhase:'DAY',players,hostUniqueId:'p0',currentTurnPlayerUniqueId:'p3',playerCount:4,maxPlayers:12,deckCount:16,discardPileCount:9,
                prankGunAdmin:Object.values(players).map(p=>({id:p.uniqueId,name:p.name,armed:false}))};
            players.p0.revealedTryalCards=players.p0.tryalCards.splice(3,2).map((card,i)=>({...card,slot:3+i})); players.p0.tryalCardCount=3;
            client.state.myCurrentHand=hand; client.actions.clearCardSelection=()=>{};
            client.state.currentRoomState=state; window.previewState=state;
            for (const name of ['messages','table3d-log','play-experience','prank','help','life-setup','ghost-scare']) (await import('/js/views/'+name+'.js')).initialize();
            (await import('/js/game/summary.js')).initialize();
            (await import('/js/training/tutorial.js')).initialize();
            (await import('/js/rooms/settings.js')).initialize();
            document.getElementById('music-overlay').remove();
            document.getElementById('game-section').style.display='block';
            document.body.classList.add('in-game','game-view-3d','table3d-fullscreen');
            document.getElementById('table3d-section').hidden=false;
            document.getElementById('table3d-loading').hidden=true;
            document.getElementById('table3d-player-name').textContent='คุณ · ชาวบ้าน';
            document.getElementById('table3d-player-status').textContent='ชีวิต 5 · ไพ่ 12 · ข้อกล่าวหา 0';
            const end=document.querySelector('.table3d-end-turn'); end.disabled=false;
            const engine=window.VillageTable3D.create({container:document.getElementById('table3d-canvas'),quality:'high'});
            const options={state,me:'p0',hand,handLowered:false,imageFor:name=>client.actions.createCardImage(name).src};
            client.state.table3D=engine; client.actions.syncTable3D=()=>engine.update(options);
            window.previewOptions=options; window.previewEngine=engine; engine.setActive(true); engine.update(options);
            (await import('/js/views/hand-order.js')).initialize();
            previewEvent('room state update',state);
            client.actions.addGameMessage('คำปัน เล่นหลักฐานใส่ คุณ · ข้อกล่าวหา +3 แต้ม','orange');
            client.actions.addGameMessage('มาลี จั่วการ์ด 2 ใบ','blue');
            client.actions.addGameMessage('คุณ ใช้พันธนาการใส่ แก้ว','green');
            document.getElementById('table3d-log').open=true;
            previewEvent('card action feedback',{actorName:'คำปัน',targetName:'คุณ',cardName:'Evidence',result:'ข้อกล่าวหา +3 แต้ม'});
        });
        await page.waitForTimeout(1300);
        await page.screenshot({path:path.join(output,'oct21-table-desktop.png')});
        await page.evaluate(()=>{
            const state=window.previewState;
            state.currentPhase='SETUP'; state.lifeSetup={id:'preview',stage:'arrange',order:Object.keys(state.players),confirmed:[],total:20,dealt:20};
            previewEvent('room state update',state);
        });
        await page.waitForTimeout(150);
        await page.screenshot({path:path.join(output,'oct21-setup-colors.png')});
        await page.evaluate(()=>{window.previewState.currentPhase='DAY';delete window.previewState.lifeSetup;previewEvent('room state update',window.previewState);});
        await page.waitForTimeout(100);
        await page.evaluate(()=>previewEvent('ghost scare received',{actorName:'คำปัน',duration:3400}));
        await page.waitForTimeout(1100);
        await page.screenshot({path:path.join(output,'oct21-ghost-scare.png')});
        await page.waitForTimeout(2400);
        await page.evaluate(()=>{
            document.getElementById('table3d-log').open=false;
            window.previewOptions.handLowered=true; window.previewEngine.update(window.previewOptions);
            window.previewEngine.animateShot({actorId:'p1',targetId:'p3',raiseDuration:900,bulletDuration:4200});
        });
        await page.waitForTimeout(1050);
        await page.screenshot({path:path.join(output,'halloween-shotgun-raised.png')});
        await page.waitForTimeout(1500);
        await page.screenshot({path:path.join(output,'halloween-shotgun-pellets.png')});
        await page.evaluate(()=>{window.previewOptions.handLowered=false;window.previewEngine.update(window.previewOptions);window.previewEngine.stepSeat(2);});
        await page.waitForTimeout(200);
        await page.screenshot({path:path.join(output,'oct21-female-hands.png')});
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>window.previewEngine.resetCamera());
        await page.waitForTimeout(250);
        await page.screenshot({path:path.join(output,'oct21-table-mobile.png')});
        await page.setViewportSize({width:1100,height:900});
        await page.evaluate(()=>{
            const client=window.previewClient;
            client.actions.showGameOverModal({winner:'ชาวบ้าน',message:'ชาวบ้านกำจัดปอบได้สำเร็จ',initialWitchCardCount:1,
                players:Object.values(client.state.currentRoomState.players).map((p,i)=>({...p,hasBeenWitch:i===0,tryalCards:p.tryalCards.map(c=>({name:c.name||'Not A Witch'}))}))});
        });
        await page.waitForTimeout(450);
        await page.screenshot({path:path.join(output,'oct21-game-summary.png')});
        await page.evaluate(()=>{
            document.getElementById('game-over-modal').style.display='none'; window.previewEngine.setActive(false);
            document.body.classList.remove('in-game','game-view-3d','table3d-fullscreen');
            document.getElementById('table3d-section').hidden=true;
            window.previewClient.state.currentRoomState=null;
            document.getElementById('show-guide-picker-btn').click();
        });
        await page.screenshot({path:path.join(output,'oct21-guide-picker.png')});
        await page.evaluate(()=>{document.getElementById('guide-picker').close();document.getElementById('show-training-btn').click();});
        await page.getByRole('button',{name:'ฝึก 3D',exact:true}).click();
        await page.locator('[data-training-action="start"]').click();
        await page.waitForTimeout(1200);
        await page.screenshot({path:path.join(output,'oct21-training-3d.png')});
        await page.setViewportSize({width:390,height:844});
        await page.waitForTimeout(250);
        await page.screenshot({path:path.join(output,'oct21-training-mobile.png')});
        await page.setViewportSize({width:1100,height:900});
        await page.evaluate(async()=>{
            document.getElementById('training-dialog').close();
            const client=window.previewClient; client.state.currentRoomState=window.previewState;
            client.state.myTryalCards=window.previewState.players.p0.tryalCards;
            client.dom.myRoleDisplay=document.getElementById('my-role-display');
            client.actions.updateWitchChatVisibility=()=>{};
            await import('/js/cards/life-selection.js');
            client.actions.updateTryalCardDisplay();
            await import('/js/players/board.js');
            client.actions.updatePlayersBoardGrid(window.previewState,'p0');
            const hand=document.getElementById('player-hand'); hand.replaceChildren();
            for(const c of client.state.myCurrentHand) {const face=document.createElement('div');face.className='card card-'+c.color.toLowerCase();face.appendChild(client.actions.createCardImage(c.name));hand.appendChild(face);}
            document.getElementById('hand-card-count').textContent=client.state.myCurrentHand.length;
            document.getElementById('game-view-description').textContent='มุมมอง 2D';
            for(const id of ['name-section','room-management-section']) document.getElementById(id).style.display='none';
        });
        await page.setViewportSize({width:1600,height:1000});
        await page.locator('#game-section').screenshot({path:path.join(output,'halloween-board-2d.png')});
        await page.locator('#my-tryal-cards-list').screenshot({path:path.join(output,'oct21-life-2d.png')});
        await page.goto('http://preview.test/patch-notes.html');
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:path.join(output,'oct21-patch-notes-mobile.png'),fullPage:true});
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
