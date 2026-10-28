// Exercise the isolated tutorial with the real DOM and 3D renderer, without a server.
// PLAYWRIGHT_MODULE and CHROME_PATH may point to an existing browser runtime.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../public');
(async () => {
    const output = path.resolve(process.argv[2]);
    fs.mkdirSync(output, {recursive:true});
    const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH});
    const errors = [];
    try {
        for (const mode of ['2d','3d']) for (const course of ['quick','full']) {
            const page = await browser.newPage({viewport:{width:390,height:844}});
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                const url = new URL(route.request().url());
                if(url.hostname !== 'training.test')return route.abort();
                const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
                if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
                const ext=path.extname(file);
                const contentType={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'}[ext]||'application/octet-stream';
                let body=fs.readFileSync(file);
                if(ext==='.html')body=body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
                return route.fulfill({contentType,body});
            });
            await page.goto('http://training.test/');
            await page.evaluate(async ({mode,course})=>{
                localStorage.setItem('villageTrainingView',mode);
                localStorage.setItem('villageTrainingCourse',course);
                const {client}=await import('/js/core/client.js');
                window.trainingEmits=[];
                client.state.socket={connected:true,on(){},emit(...args){window.trainingEmits.push(args);}};
                client.state.currentRoomState=null;
                await import('/js/cards/translations.js');
                await import('/js/cards/hand.js');
                // Capture renderer callbacks to check that canvas interactions use the same lesson actions.
                const script=document.createElement('script');script.src='/table3d.bundle.js';document.head.append(script);
                await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;});
                const create=window.VillageTable3D.create;
                window.VillageTable3D.create=options=>{window.trainingCanvasActions=options;return create(options);};
                (await import('/js/training/tutorial.js')).initialize();
                document.getElementById('music-overlay')?.remove();
                document.getElementById('show-training-btn').click();
            },{mode,course});
            await page.locator('[data-training-action="start"]').click();
            let completed=0;
            for(let iteration=0;iteration<240;iteration++) {
                const current=await page.evaluate(()=>({title:document.querySelector('#training-body h3')?.textContent,eyebrow:document.querySelector('.training-eyebrow')?.textContent,action:document.querySelector('[data-training-next="true"]')?.dataset.trainingAction,view:document.querySelector('#training-dialog').dataset.trainingView,instruction:document.querySelector('.training-instruction')?.textContent}));
                if(!current.eyebrow) {
                    assert.match(current.instruction,new RegExp(`ทำสำเร็จ ${course==='quick'?10:24}/${course==='quick'?10:24} บท`));
                    if(course==='full')assert.match(current.instruction,/ลองการ์ด 18\/18 ชนิด/);
                    break;
                }
                assert.equal(current.view,mode,`Unexpected fallback in ${current.title}`);
                assert.ok(current.action,`No action in ${current.title}`);
                const keyScene=iteration===0 || (current.title==='ข้อกล่าวหา' && current.action==='card');
                const specialScene=mode==='3d' && course==='full' && ['life','effect-0','heal-confirm','kill-confirm'].includes(current.action);
                if(keyScene || specialScene) {
                    await page.waitForTimeout(mode==='3d'?1400:50);
                    for(const [width,height] of [[390,844],[320,740],[844,390],[1440,900]]) {
                        await page.setViewportSize({width,height});
                        await page.waitForTimeout(180);
                        const overflow=await page.evaluate(()=>{
                            const dialog=document.querySelector('#training-dialog');
                            const heading=dialog.querySelector('header h2').getBoundingClientRect();
                            const close=document.querySelector('#training-close').getBoundingClientRect();
                            return {width:dialog.clientWidth,scroll:dialog.scrollWidth,headerOverlap:heading.right>close.left};
                        });
                        assert.ok(overflow.scroll<=overflow.width+1,`Dialog overflow at ${width}: ${JSON.stringify(overflow)}`);
                        assert.ok(!overflow.headerOverlap,`Header overlap at ${width}`);
                        if(mode==='3d') {
                            const layout=await page.evaluate(()=>{
                                const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
                                return {coach:rect('.training-3d-coach'),actions:rect('.training-3d-actions'),canvas:rect('.training-table-canvas'),controls:rect('.training-table-controls'),picker:rect('.training-view-picker'),close:rect('#training-close'),scroll:document.documentElement.scrollWidth,viewport:innerWidth};
                            });
                            const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)+1 && Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1;
                            for(const pair of [['coach','actions'],['coach','controls'],['actions','controls'],['picker','close']])assert.ok(!overlaps(layout[pair[0]],layout[pair[1]]),`${width} ${pair} overlap: ${JSON.stringify(layout)}`);
                            assert.ok(layout.canvas.height>=100,`Canvas too small: ${JSON.stringify(layout)}`);
                            assert.ok(layout.scroll<=layout.viewport,`Horizontal overflow at ${width}`);
                        }
                        if(course==='quick')await page.screenshot({path:path.join(output,`${mode}-${current.action==='card'&&current.title==='ข้อกล่าวหา'?'play':'life'}-${width}.png`)});
                        else if(specialScene && width===390)await page.screenshot({path:path.join(output,`3d-special-${iteration}.png`)});
                    }
                    await page.setViewportSize({width:390,height:844});
                }
                if(iteration===0 && mode==='3d') {
                    await page.waitForTimeout(180);
                    const canvas=await page.locator('.training-table-canvas canvas').boundingBox();
                    let picked=false;
                    for(const fraction of [.42,.46,.50,.54,.58,.62,.66,.70]) {
                        await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height*fraction);
                        if(await page.locator('[data-training-next="true"]').getAttribute('data-training-action')==='next'){picked=true;break;}
                    }
                    assert.ok(picked,'A real canvas pointer must be able to pick the own life card');
                    continue;
                }
                if(current.action==='next')completed++;
                await page.evaluate(({action,mode})=>{
                    const button=document.querySelector('[data-training-next="true"]');
                    const canvas=window.trainingCanvasActions;
                    if(mode==='3d' && canvas) {
                        if(action==='card') {if(document.querySelector('#training-body h3').textContent==='การ์ดชีวิตของคุณ')canvas.onLife('0',0);else canvas.onCard(0);return;}
                        if(['draw','infection','night'].includes(action)){canvas.onDraw();return;}
                        if(action.startsWith('target-')){canvas.onPlayer(action.slice(7));return;}
                        if(action==='heal-confirm'){canvas.onPlayer('2');return;}
                        if(action==='life'||action.startsWith('life-')){const life=button;canvas.onLife(life.dataset.trainingLifeOwner,Number(life.dataset.trainingLife));return;}
                        if(action==='play'){const selected=[...document.querySelectorAll('.training-player[aria-pressed="true"]')].at(-1);canvas.onPlayer(selected.dataset.trainingAction.slice(7));return;}
                        if(action.startsWith('effect-')){canvas.onEffect('1',Number(action.slice(7)));return;}
                    }
                    button.click();
                },{action:current.action,mode});
                // Let async renderer updates install the next scene/callback snapshot.
                await page.waitForTimeout(mode==='3d'?35:5);
                if(iteration===239)throw new Error(`Tutorial stalled at ${JSON.stringify(current)}`);
            }
            assert.equal(completed,course==='quick'?10:24);
            assert.deepEqual(await page.evaluate(()=>window.trainingEmits),[],'Tutorial must not emit live gameplay events');
            console.log(`${mode}/${course}: ${completed} lessons completed; responsive bounds checked`);
            await page.close();
        }
        assert.deepEqual(errors,[]);
        console.log('No browser errors or gameplay socket events.');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
