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
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());if(url.hostname!=='preview.test')return route.abort();
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   const ext=path.extname(file),type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[ext]||'application/octet-stream';
   let data=fs.readFileSync(file);if(ext==='.html')data=data.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   return route.fulfill({contentType:type,body:data});
  });
  await page.goto('http://preview.test/');
  await page.screenshot({path:path.join(output,'modern-welcome-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'modern-welcome-mobile.png')});
  await page.evaluate(async()=>{
   document.getElementById('music-overlay').remove();
   const {client}=await import('/js/core/client.js');
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
  await page.screenshot({path:path.join(output,'modern-lobby-mobile.png'),fullPage:true});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
