// Render the real runtime character roster without a game server.
const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1450}});
  page.on('pageerror',e=>console.error(e.message));
  await page.route('http://roster.test/**',route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><style>@font-face{font-family:Thai;src:url(/public/fonts/Sarabun-Regular.ttf)}body{margin:0;padding:24px;background:#1b1511;color:#f0dfbf;font-family:Thai,sans-serif}h1{font-size:28px;margin:0 0 8px}p{color:#bca582}#roster{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.figure{overflow:hidden;border:1px solid #715236;border-radius:14px;background:#30251c}canvas{display:block;width:100%}.name{padding:10px 14px;font-size:18px}</style><h1>ชาวบ้านทั้ง 12 แบบ</h1><p>โมเดลจริงในเกม · ท่านั่ง มือ และการแสดงผลชุดเดียวกับโต๊ะ 3D</p><div id="roster"></div>'});
   const file=path.resolve(root,'.'+pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   const ext=path.extname(file),type={'.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.ttf':'font/ttf'}[ext]||'application/octet-stream';
   return route.fulfill({contentType:type,body:fs.readFileSync(file)});
  });
  await page.goto('http://roster.test/');
  const result=await page.evaluate(async()=>{
   const T=await import('three');const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   const {prepareVillagerModels,instantiateVillager}=await import('/src/client/villager-models.mjs');
   const asset=await new GLTFLoader().loadAsync('/public/models/villagers-seated.glb');
   const models=prepareVillagerModels(asset.scene);window.rosterModels=models;
   const stats=models.slice(0,2).map(parts=>parts.filter(p=>p.name!=='chair').map(p=>{
    p.geometry.computeBoundingBox();return {name:p.name,material:p.material.name,min:p.geometry.boundingBox.min.toArray(),max:p.geometry.boundingBox.max.toArray()};
   }));
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(374,360);
   renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;
   window.renderRoster=async(dead=false)=>{
    document.getElementById('roster').replaceChildren();
    for(let i=0;i<models.length;i++){
     const scene=new T.Scene();scene.background=new T.Color('#30251c');scene.add(new T.HemisphereLight('#fff0da','#66574b',2));
     const light=new T.DirectionalLight('#ffeddb',2.7);light.position.set(-2,4,-3);scene.add(light);
     const group=new T.Group();scene.add(group);instantiateVillager(group,models,0x596b55,!dead,i);
     const camera=new T.PerspectiveCamera(38,374/360,.01,30);camera.position.set(.95,.75,-2.7);camera.lookAt(0,.27,0);
     renderer.render(scene,camera);
     const tile=document.createElement('section');tile.className='figure';
     const canvas=document.createElement('canvas');canvas.width=374;canvas.height=360;canvas.getContext('2d').drawImage(renderer.domElement,0,0);
     const name=document.createElement('div');name.className='name';name.textContent=`${String(i+1).padStart(2,'0')} · ${models[i].characterName||'ชาวบ้าน'}`;
     tile.append(canvas,name);document.getElementById('roster').appendChild(tile);
    }
   };
   await window.renderRoster();await document.fonts.ready;return stats;
  });
  if(process.argv.includes('--inspect'))console.log(JSON.stringify(result,null,2));
  await page.screenshot({path:path.join(output,'villager-roster-12.png'),fullPage:true});
  await page.evaluate(()=>window.renderRoster(true));
  await page.screenshot({path:path.join(output,'villager-roster-dead.png'),fullPage:true});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
