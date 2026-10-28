// Render production models/pose code at authored animation times, without a server.
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1080}});
  page.on('pageerror',e=>console.error(e.message));
  await page.route('http://shotgun.test/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/')return route.fulfill({contentType:'text/html;charset=utf-8',body:'<meta charset="utf-8"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><style>@font-face{font-family:Thai;src:url(/public/fonts/Sarabun-Regular.ttf)}body{margin:0;padding:20px;background:#1b1511;color:#efdbb7;font-family:Thai}h1{font-size:24px}#stages{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}section{border:1px solid #765635;border-radius:12px;overflow:hidden;background:#30251c}canvas{width:100%;display:block}p{margin:10px}</style><h1>ลูกซอง · ลุกจากเก้าอี้ หยิบ เล็ง และยิง</h1><div id="stages"></div>'});
   const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({contentType:{'.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await page.goto('http://shotgun.test/'+(process.argv.includes('--blood')?'?blood':''));
  const diagnostics=await page.evaluate(async()=>{
   const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   const {prepareVillagerModels,instantiateVillager}=await import('/src/client/villager-models.mjs');
   const {createGunShot}=await import('/src/client/gun-shot.mjs'),{createShotgun}=await import('/src/client/shotgun-model.mjs');
   const models=prepareVillagerModels((await new GLTFLoader().loadAsync('/public/models/villagers-seated.glb')).scene);
   if (location.search.includes('blood')) {
    const {addBloodPool}=await import('/src/client/blood-pool.mjs');
    document.querySelector('h1').textContent='กองเลือดบริเวณผู้ตายที่ฟุบลงบนโต๊ะ';
    document.getElementById('stages').style.gridTemplateColumns='1fr';
    const scene=new T.Scene();scene.background=new T.Color('#211a15');scene.add(new T.HemisphereLight('#ffedda','#544737',2));
    const light=new T.DirectionalLight('#fff2de',3);light.position.set(-3,5,-4);scene.add(light);
    const pawn=new T.Group();pawn.scale.setScalar(1.4);pawn.position.y=-.05;scene.add(pawn);instantiateVillager(pawn,models,0x596b55,false,0);
    const table=new T.Mesh(new T.BoxGeometry(4,.35,3.4),new T.MeshStandardMaterial({color:0x503322,roughness:.82}));table.position.set(0,-.2,-2.2);scene.add(table);
    const seat=new T.Group();seat.position.z=-2.05;scene.add(seat);addBloodPool(seat,-.025,0);
    const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,760);renderer.toneMapping=T.ACESFilmicToneMapping;
    const camera=new T.PerspectiveCamera(40,1100/760,.01,30);camera.position.set(1.7,1.9,-3.8);camera.lookAt(0,.03,-.65);
    renderer.render(scene,camera);document.getElementById('stages').append(renderer.domElement);await document.fonts.ready;return [];
   }
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(470,460);renderer.toneMapping=T.ACESFilmicToneMapping;
   const diagnostics=[];
   for(const id of [1,0]){
    const scene=new T.Scene();scene.background=new T.Color('#30251c');scene.add(new T.HemisphereLight('#ffedda','#544737',2));
    const key=new T.DirectionalLight('#fff2de',3);key.position.set(-3,5,-4);scene.add(key);
    const pawn=new T.Group();pawn.scale.setScalar(1.4);pawn.position.y=-.1;scene.add(pawn);instantiateVillager(pawn,models,0x596b55,true,id);
    const skin=pawn.children.find(p=>/body\.body/.test(p.material.name));
    diagnostics.push({id,bands:Array.from({length:7},(_,i)=>{
     const points=[],p=skin.geometry.attributes.position;
     for(let j=0;j<p.count;j++)if(p.getX(j)>.14&&p.getY(j)>-.18&&p.getY(j)<.5&&p.getZ(j)<-.1*i&&p.getZ(j)>-.1*(i+1))points.push([p.getX(j),p.getY(j)]);
     return {z:-.1*i,count:points.length,x:points.reduce((a,p)=>a+p[0],0)/points.length,y:points.reduce((a,p)=>a+p[1],0)/points.length};
    })});
    const parked=createShotgun();parked.scale.setScalar(1.05);parked.position.set(.9,-.6,.25);parked.rotation.set(-1.35,0,-.15);scene.add(parked);
    const floor=new T.Mesh(new T.BoxGeometry(5,.05,5),new T.MeshStandardMaterial({color:0x3b2c20,roughness:1}));floor.position.y=-1.45;scene.add(floor);
    const camera=new T.PerspectiveCamera(42,470/460,.01,30);camera.position.set(2.8,1.3,-3.8);camera.lookAt(0,.35,0);
    const shot=createGunShot({scene,from:new T.Vector3(0,.9,0),to:new T.Vector3(-.5,1,-5),getPawn:()=>pawn,getParkedGun:()=>parked});
    const start=performance.now();
    for(const [time,title] of [[0,'ปืนข้างเก้าอี้'],[1100,'ลุกและเอื้อมหยิบ'],[2650,'ประทับเล็งสองมือ']]){
     shot.tick(start+time);renderer.render(scene,camera);
     const tile=document.createElement('section'),canvas=document.createElement('canvas');canvas.width=470;canvas.height=460;canvas.getContext('2d').drawImage(renderer.domElement,0,0);
     const text=document.createElement('p');text.textContent=(id?'คำปัน':'มาลี')+' · '+title;tile.append(canvas,text);document.getElementById('stages').append(tile);
    }
    shot.dispose();
   }
   await document.fonts.ready;
   return diagnostics;
  });
  if(process.argv.includes('--inspect'))console.log(JSON.stringify(diagnostics));
  await page.screenshot({path:path.join(output,process.argv.includes('--blood')?'death-blood-detail.png':'shotgun-standing-sequence.png'),fullPage:true});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
