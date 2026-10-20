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
            const type = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8', '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary'}[extension] || 'application/octet-stream';
            let body = fs.readFileSync(file);
            if (extension === '.html') body = body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
            return route.fulfill({contentType:type,body});
        });
        await page.goto('http://preview.test/');
        await page.addScriptTag({url:'/table3d.bundle.js'});
        await page.evaluate(async () => {
            const {client} = await import('/js/core/client.js'); window.previewClient = client;
            const handlers = new Map();
            client.state.socket = {connected:true, on(name, handler) { if (!handlers.has(name)) handlers.set(name,[]); handlers.get(name).push(handler); }, emit() {}};
            window.previewEvent = (name, data) => handlers.get(name)?.forEach(handler=>handler(data));
            client.state.myUniqueId='p0'; client.state.myPlayerName='คุณ';
            client.state.cardNameMap={};
            await import('/js/cards/translations.js'); await import('/js/cards/hand.js');
            client.actions.getTable3DInteraction=()=>null; client.actions.handleTable3DPlayer=()=>{};
            const hand=['Accusation','Evidence','Stocks','Accusation','Alibi','Scapegoat','Matchmaker','Arson','Piety','Curse','Accusation','Robbery'].map(name=>({name,color:['Accusation','Evidence'].includes(name)?'Red':['Matchmaker','Piety'].includes(name)?'Blue':'Green'}));
            const players=Object.fromEntries(Array.from({length:4},(_,i)=>['p'+i,{
                uniqueId:'p'+i,name:['คุณ','คำปัน','มาลี','แก้ว'][i],alive:true,handSize:i?5:hand.length,tryalCardCount:5,
                tryalCards:['Witch','Constable','Not A Witch','Not A Witch','Not A Witch'].map(name=>({name:i?null:name})),
                inPlayCards:i===1?[{name:'Evidence',color:'Red'},{name:'Piety',color:'Blue'},{name:'Stocks',color:'Green'}]:[],revealedTryalCards:[]
            }]));
            const state={gameStarted:true,currentPhase:'DAY',players,hostUniqueId:'p0',currentTurnPlayerUniqueId:'p0',playerCount:4,maxPlayers:12,deckCount:16,discardPileCount:9,
                prankGunAdmin:Object.values(players).map(p=>({id:p.uniqueId,name:p.name,armed:false}))};
            client.state.currentRoomState=state;
            for (const name of ['messages','table3d-log','play-experience','prank']) (await import('/js/views/'+name+'.js')).initialize();
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
            const engine=window.VillageTable3D.create({container:document.getElementById('table3d-canvas'),quality:'high',
                onCandleAnchor:({x,y,visible})=>{end.style.setProperty('--candle-x',`${x}%`);end.style.setProperty('--candle-y',`${y}%`);end.hidden=!visible;}});
            const options={state,me:'p0',hand,handLowered:true,canEndTurn:true,imageFor:name=>client.actions.createCardImage(name).src};
            client.state.table3D=engine; client.actions.syncTable3D=()=>engine.update(options);
            window.previewEngine=engine; engine.setActive(true); engine.update(options);
            previewEvent('room state update',state);
            client.actions.addGameMessage('คำปัน เล่นหลักฐานใส่ คุณ · ข้อกล่าวหา +3 แต้ม','orange');
            client.actions.addGameMessage('มาลี จั่วการ์ด 2 ใบ','blue');
            client.actions.addGameMessage('คุณ ใช้พันธนาการใส่ แก้ว','green');
            document.getElementById('table3d-log').open=true;
            previewEvent('card action feedback',{actorName:'คำปัน',targetName:'คุณ',cardName:'Evidence',result:'ข้อกล่าวหา +3 แต้ม'});
        });
        await page.waitForTimeout(1300);
        await page.screenshot({path:path.join(output,'oct20-table-desktop.png')});
        await page.evaluate(()=>{document.getElementById('table3d-log').open=false;window.previewEngine.stepSeat(2);});
        await page.waitForTimeout(200);
        await page.screenshot({path:path.join(output,'oct20-female-hands.png')});
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>window.previewEngine.resetCamera());
        await page.waitForTimeout(250);
        await page.screenshot({path:path.join(output,'oct20-table-mobile.png')});
        await page.setViewportSize({width:1100,height:900});
        await page.evaluate(()=>{
            const client=window.previewClient;
            client.actions.showGameOverModal({winner:'ชาวบ้าน',message:'ชาวบ้านกำจัดปอบได้สำเร็จ',initialWitchCardCount:1,
                players:Object.values(client.state.currentRoomState.players).map((p,i)=>({...p,hasBeenWitch:i===0,tryalCards:p.tryalCards.map(c=>({name:c.name||'Not A Witch'}))}))});
        });
        await page.waitForTimeout(450);
        await page.screenshot({path:path.join(output,'oct20-game-summary.png')});
        await page.evaluate(()=>{
            document.getElementById('game-over-modal').style.display='none'; window.previewEngine.setActive(false);
            document.body.classList.remove('in-game','game-view-3d','table3d-fullscreen');
            document.getElementById('table3d-section').hidden=true;
            window.previewClient.state.currentRoomState=null;
            document.getElementById('show-training-btn').click();
        });
        await page.getByRole('button',{name:'ฝึก 3D',exact:true}).click();
        await page.locator('[data-training-action="start"]').click();
        await page.waitForTimeout(1200);
        await page.screenshot({path:path.join(output,'oct20-training-3d.png')});
        await page.goto('http://preview.test/patch-notes.html');
        await page.setViewportSize({width:390,height:844});
        await page.screenshot({path:path.join(output,'oct20-patch-notes-mobile.png'),fullPage:true});
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
