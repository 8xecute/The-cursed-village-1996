// Render the website with sample room data; no game server is required.
const fs=require('fs');
const path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
 const root=path.resolve(__dirname,'../public');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>console.error(e.message));
  async function inspectMobile(label) {
   for(const viewport of [{width:320,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(230);
    const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,
     small:[...document.querySelectorAll('button,summary,a.top-nav-btn,select,input[type="text"]')].filter(e=>{
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);
      const hit=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)));
      return r.width>0 && r.height>0 && r.top<innerHeight && r.bottom>0 && s.visibility!=='hidden' && (e===hit || e.contains(hit)) && !e.disabled && (r.height<43 || r.width<43);
     }).map(e=>({id:e.id||e.className,text:e.textContent.trim().slice(0,24),width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height)}))}));
    console.log(JSON.stringify({screen:label,...viewport,...result}));
   }
   await page.setViewportSize({width:390,height:844});
  }
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='preview.test')return route.abort();
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   const ext=path.extname(file),type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf'}[ext]||'application/octet-stream';
   let data=fs.readFileSync(file);if(ext==='.html')data=data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   return route.fulfill({contentType:type,body:data});
  });
  await page.goto('http://preview.test/');
  await page.evaluate(()=>document.fonts.ready);
  await inspectMobile('welcome');
  await page.setViewportSize({width:1440,height:1100});
  await page.screenshot({path:path.join(output,'modern-welcome-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'modern-welcome-mobile.png')});
  await page.evaluate(async()=>{
   document.getElementById('music-overlay').style.display='none';
   const {client}=await import('/js/core/client.js');
   client.state.socket={on(){},emit(){},connected:true};
   (await import('/js/views/play-experience.js')).initialize();
   client.dom.activeRoomsList=document.getElementById('active-rooms-list');
   await import('/js/events/room.js');
   client.actions.renderActiveRooms([
    {name:'คืนนี้ใครเป็นปอบ',hostName:'Frank',playerCount:5,maxPlayers:8,gameStarted:false},
    {name:'หมู่บ้านสายดึก',hostName:'มาลี',playerCount:8,maxPlayers:12,gameStarted:true}
   ]);
   document.getElementById('player-name-display').textContent='Frank';
   document.getElementById('player-unique-id-display').textContent='a4f9c2';
   document.getElementById('name-input').value='Frank';
  });
  await inspectMobile('home');
  await page.evaluate(()=>document.getElementById('game-preferences').open=true);
  await inspectMobile('settings');
  await page.screenshot({path:path.join(output,'thai-settings-mobile.png')});
  await page.evaluate(()=>document.getElementById('game-preferences').open=false);
  await page.screenshot({path:path.join(output,'modern-home-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1100});
  await page.screenshot({path:path.join(output,'modern-home-desktop.png'),fullPage:true});
  await page.evaluate(()=>{
   document.getElementById('room-management-section').style.display='none';
   document.getElementById('room-lobby-section').style.display='block';
   document.getElementById('lobby-room-name').textContent='คืนนี้ใครเป็นปอบ';
   document.getElementById('lobby-player-count').textContent='5';document.getElementById('lobby-max-players').textContent='8';
   document.getElementById('current-room-display').textContent='คืนนี้ใครเป็นปอบ';
   const list=document.getElementById('player-list');
   for(const name of ['Frank · โฮสต์','มาลี · พร้อม','คำปัน · พร้อม','แก้ว · พร้อม','บัว · รอพร้อม']) {
    const tile=document.createElement('div');tile.className='player-item alive';tile.textContent=name;list.appendChild(tile);
   }
  });
  await page.screenshot({path:path.join(output,'modern-lobby-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await inspectMobile('lobby');
  await page.screenshot({path:path.join(output,'modern-lobby-mobile.png'),fullPage:true});
  await page.evaluate(async()=>{
   const {client}=await import('/js/core/client.js');
   (await import('/js/core/elements.js')).initialize();
   (await import('/js/views/help.js')).initialize();
   client.state.socket={on(){},emit(){},connected:true};
   (await import('/js/training/tutorial.js')).initialize();
   document.getElementById('show-guide-picker-btn').click();
  });
  await page.screenshot({path:path.join(output,'thai-guide-mobile.png')});
  await page.evaluate(()=>document.getElementById('show-rules-btn').click());
  await inspectMobile('rules');
  await page.screenshot({path:path.join(output,'thai-rules-mobile.png')});
  await page.evaluate(()=>{document.getElementById('game-rules-modal').style.display='none';document.getElementById('show-cards-btn').click();});
  await page.waitForTimeout(250);
  await inspectMobile('cards');
  await page.screenshot({path:path.join(output,'thai-cards-mobile.png')});
  await page.evaluate(()=>{document.getElementById('card-explain-modal').style.display='none';document.getElementById('show-training-btn').click();});
  await inspectMobile('training');
  await page.screenshot({path:path.join(output,'thai-teach-mobile.png')});
  await page.goto('http://preview.test/patch-notes.html');
  await page.evaluate(()=>document.fonts.ready);
  await inspectMobile('updates');
  await page.screenshot({path:path.join(output,'thai-updates-mobile.png')});
  await page.setViewportSize({width:1440,height:1100});
  await page.screenshot({path:path.join(output,'thai-updates-desktop.png')});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
