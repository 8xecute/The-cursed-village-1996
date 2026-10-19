import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Deterministic, locally generated materials: no external model or texture downloads.
export function timberTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    let seed = 1996;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.fillStyle = '#39271e'; ctx.fillRect(0, 0, 512, 512);
    for (let plank = 0; plank < 8; plank++) {
        const y = plank * 64;
        ctx.fillStyle = `rgba(${random() > .5 ? '109,78,48' : '9,7,5'},.14)`; ctx.fillRect(0,y,512,64);
        for (let line = 0; line < 58; line++) {
            const origin = y + random() * 64;
            ctx.strokeStyle = line % 3 ? 'rgba(12,8,5,.22)' : 'rgba(182,140,94,.15)';
            ctx.lineWidth = .4 + random(); ctx.beginPath();
            for (let x = 0; x <= 512; x += 8) {
                const grain = origin + Math.sin(x * .018 + line) * 1.8 + Math.sin(x*.049+plank)*.5;
                if (!x) ctx.moveTo(x,grain); else ctx.lineTo(x,grain);
            }
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(7,5,4,.65)'; ctx.fillRect(0,y,512,2);
        ctx.fillStyle = 'rgba(163,121,77,.24)'; ctx.fillRect(0,y+2,512,1);
        for (const x of [14,498]) { ctx.fillStyle='#15110d'; ctx.beginPath(); ctx.arc(x,y+12,1.4,0,Math.PI*2); ctx.fill(); }
        const knotX = random()*420+40;
        for(let ring=0;ring<5;ring++) { ctx.strokeStyle='rgba(10,7,5,.22)';ctx.beginPath();ctx.ellipse(knotX,y+34,8+ring*5,1.8+ring*1.5,0,0,Math.PI*2);ctx.stroke(); }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

export function ceremonialCloth() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#302821';ctx.fillRect(0,0,512,512);
    for(let i=0;i<512;i+=3) { ctx.fillStyle=i%2?'rgba(9,6,4,.17)':'rgba(157,131,93,.11)';ctx.fillRect(i,0,1,512);ctx.fillRect(0,i,512,1); }
    for(const radius of [226,232,241]) { ctx.strokeStyle='rgba(163,132,78,.40)';ctx.lineWidth=radius===232?3:1;ctx.beginPath();ctx.arc(256,256,radius,0,Math.PI*2);ctx.stroke(); }
    for(let i=0;i<32;i++) { const a=i*Math.PI/16;ctx.save();ctx.translate(256+Math.sin(a)*211,256+Math.cos(a)*211);ctx.rotate(-a);ctx.strokeStyle='rgba(164,133,83,.34)';ctx.strokeRect(-3,-5,6,10);ctx.restore(); }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function buildCeremonialRoom(scene, wood) {
    const material = new THREE.MeshStandardMaterial({map:wood,bumpMap:wood,bumpScale:.025,color:0x938574,roughness:.96});
    const dark = new THREE.MeshStandardMaterial({color:0x201a15,roughness:.92});
    const bronze = new THREE.MeshStandardMaterial({color:0x77603b,roughness:.6,metalness:.65});
    const add=(geometry,mat,position)=>{const part=new THREE.Mesh(geometry,mat);part.position.set(...position);part.receiveShadow=true;scene.add(part);return part;};
    const beam=(size,position)=>add(new THREE.BoxGeometry(...size),dark,position);
    // No front wall or ceiling: cards stay visible from the overhead camera.
    add(new THREE.PlaneGeometry(38,38),material,[0,-1.35,0]).rotation.x=-Math.PI/2;
    add(new THREE.PlaneGeometry(25,9),material,[0,3,-11.5]);
    const left=add(new THREE.PlaneGeometry(23,9),material,[-12.5,3,0]);left.rotation.y=Math.PI/2;
    const right=add(new THREE.PlaneGeometry(23,9),material,[12.5,3,0]);right.rotation.y=-Math.PI/2;
    for(const x of [-11.5,-7.5,-3.8,3.8,7.5,11.5]) {
        beam([.22,7,.28],[x,2,-11.25]);
        beam([.3,.22,.35],[x,5.45,-11.15]);
    }
    beam([25,.3,.4],[0,5.6,-11.25]);beam([25,.18,.22],[0,.6,-11.25]);
    for(const x of [-10.8,10.8]) {
        beam([.34,6,.34],[x,1.65,-5]);
        // Carved window frames and thin moonlit slats.
        beam([2.7,.18,.18],[x,3.8,-11.03]);beam([2.7,.18,.18],[x,1.1,-11.03]);
        for(let i=0;i<7;i++) beam([.15,2.7,.16],[x-1.2+i*.4,2.45,-11.03]);
        add(new THREE.PlaneGeometry(2.5,2.55),new THREE.MeshBasicMaterial({color:0x151e25}),[x,2.45,-11.12]);
    }
    // Low shelves, ceramic vessels, and a hanging lantern behind the play area.
    beam([3,.15,1.1],[0,.1,-10.4]);
    for(const x of [-1.2,1.2]) beam([.12,1.4,.12],[x,-.65,-10.4]);
    const pottery=new THREE.MeshStandardMaterial({color:0x3b3930,roughness:.98});
    for(const [x,size] of [[-1,.25],[.8,.34]]) {
        const profile=[[0,0],[size*.65,0],[size,.18],[size*.8,.42],[size*.38,.5],[size*.4,.6]].map(([r,y])=>new THREE.Vector2(r,y));
        add(new THREE.LatheGeometry(profile,16),pottery,[x,.17,-10.4]);
    }
    for(const x of [-7.5,7.5]) {
        const light=new THREE.PointLight(0xdf9e59,9,8,2);light.position.set(x,2.3,-10.1);scene.add(light);
        const lantern=add(new THREE.CylinderGeometry(.25,.21,.58,8),new THREE.MeshStandardMaterial({color:0x9c733e,emissive:0xffa345,emissiveIntensity:.8,roughness:.8}),[x,2.3,-10.3]);
        lantern.castShadow=false;
        for(let i=0;i<6;i++) {const a=i*Math.PI/3;beam([.025,.7,.025],[x+Math.sin(a)*.25,2.3,-10.3+Math.cos(a)*.25]);}
        add(new THREE.CylinderGeometry(.3,.3,.06,12),bronze,[x,2.64,-10.3]);
        beam([.025,2.6,.025],[x,4,-10.3]);
    }
    // Table legs and cross braces visible when looking across the table.
    for(const x of [-3.3,3.3]) for(const z of [-3.3,3.3]) {
        const leg=add(new THREE.CylinderGeometry(.19,.25,1,12),material,[x,-.85,z]);leg.castShadow=true;
    }
    beam([7,.15,.18],[0,-1.02,0]);beam([.18,.15,7],[0,-1.02,0]);
}

export function createRitualBust(parent, color, alive, variant = 0, headGeometry = null) {
    const body = new THREE.MeshStandardMaterial({color:alive?new THREE.Color(color).multiplyScalar(.65):0x292725,roughness:.94});
    const skin = new THREE.MeshStandardMaterial({color:alive?[0x766350,0x806953,0x685b4f,0x8a7360][variant%4]:0x45403a,roughness:.86});
    const recess = new THREE.MeshStandardMaterial({color:0x292620,roughness:.96});
    const hairMaterial = new THREE.MeshStandardMaterial({color:[0x272722,0x41403a,0x39332b,0x5b554b][variant%4],roughness:1});
    const parts=[];
    const add=(geometry,material,position,scale)=>{const part=new THREE.Mesh(geometry,material.clone());part.position.set(...position);if(scale)part.scale.set(...scale);part.castShadow=part.receiveShadow=true;parent.add(part);parts.push(part);return part;};
    const segment=(from,to,radius,material)=>{
        const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to);
        const delta=end.clone().sub(start);
        const part=add(new THREE.CapsuleGeometry(radius,Math.max(.001,delta.length()),3,10),material,start.clone().add(end).multiplyScalar(.5).toArray());
        part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return part;
    };
    // Anatomical torso and short-sleeved shirt, joined under the collar.
    const width=1+(variant%3-1)*.055;
    const torso=[[0,0],[.21,0],[.24,.06],[.25,.28],[.29,.47],[.285,.53],[.2,.58],[.105,.62],[.085,.65]].map(([r,y])=>new THREE.Vector2(r,y));
    const shirt=add(new THREE.LatheGeometry(torso,28),body,[0,0,.025],[width,1,.65]);
    // Subtle tailoring follows the torso rather than separate cylinder arms.
    for(const side of [-1,1]) {
        segment([side*.235*width,.49,.015],[side*.29*width,.36,-.015],.082,body);
        segment([side*.29*width,.37,-.015],[side*.34*width,.18,-.13],.068,skin);
        segment([side*.34*width,.18,-.13],[side*.27*width,.065,-.43],.052,skin);
        const palm=add(new THREE.SphereGeometry(.065,16,10),skin,[side*.26*width,.055,-.46],[.8,.39,1.16]);palm.rotation.y=side*.13;
        // Four fingers plus an opposed thumb resting on the table edge.
        for(let finger=0;finger<4;finger++) {
            const x=side*.26*width+(finger-1.5)*.023;
            const length=[.083,.104,.096,.073][finger];
            segment([x,.055,-.49],[x,.045,-.49-length],.012,skin);
            segment([x,.045,-.49-length],[x,.035,-.512-length],.010,skin);
        }
        segment([side*.215*width,.06,-.45],[side*.183*width,.04,-.514],.018,skin);
        // Folded collar panels in the same subdued cloth palette.
        const collar=new THREE.Shape();
        collar.moveTo(side*.018,.635);collar.lineTo(side*.12,.585);collar.lineTo(side*.075,.49);collar.lineTo(side*.005,.568);collar.closePath();
        add(new THREE.ExtrudeGeometry(collar,{depth:.012,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.004,bevelThickness:.003}),body,[0,0,-.118]);
    }
    add(new THREE.CylinderGeometry(.073,.086,.17,20),skin,[0,.688,.008]);
    for(let button=0;button<4;button++) add(new THREE.SphereGeometry(.009,8,6),recess,[0,.44-button*.09,-.145],[1,1,.45]);
    for(let i=-2;i<=2;i++) {
        const fold=segment([i*.055,.07,-.13],[i*.067,.3,-.146],.006,body);
        fold.rotation.z+=i*.035;
    }
    // A scanned head provides coherent facial anatomy instead of separate primitive features.
    if (headGeometry) add(headGeometry.clone(),skin,[0,.67,0]);
    else add(new THREE.SphereGeometry(.145,24,18),skin,[0,.88,0],[.93,1.4,1]);
    // Full seated body. Hips, knees and feet remain present when orbiting behind.
    const trousers = new THREE.MeshStandardMaterial({color:alive?0x302f2b:0x292826,roughness:.98});
    const shoes = new THREE.MeshStandardMaterial({color:0x201f1d,roughness:.86});
    add(new THREE.SphereGeometry(.23,20,12),trousers,[0,-.075,.015],[1,.64,.75]);
    for(const side of [-1,1]) {
        segment([side*.13,-.09,-.01],[side*.15,-.35,-.39],.105,trousers);
        segment([side*.15,-.35,-.39],[side*.15,-.82,-.42],.073,trousers);
        add(new THREE.SphereGeometry(.085,16,10),shoes,[side*.15,-.86,-.48],[.83,.5,1.6]);
    }
    // A simple wooden chair grounds the seated silhouette.
    const chair = new THREE.MeshStandardMaterial({color:0x36291e,roughness:.92});
    add(new THREE.BoxGeometry(.65,.07,.63),chair,[0,-.23,.035]);
    for(const x of [-.28,.28]) for(const z of [-.23,.3]) {
        add(new THREE.BoxGeometry(.055,.65,.055),chair,[x,-.58,z]);
    }
    for(const x of [-.28,.28]) add(new THREE.BoxGeometry(.055,.75,.055),chair,[x,.14,.3]);
    add(new THREE.BoxGeometry(.62,.075,.07),chair,[0,.5,.3]);
    for(const x of [-.15,0,.15]) add(new THREE.BoxGeometry(.045,.46,.04),chair,[x,.22,.3]);
    trousers.dispose();shoes.dispose();chair.dispose();
    // Merge by material so twelve detailed busts do not multiply draw calls.
    const batches = new Map();
    for (const part of parts) {
        part.updateMatrix();
        const key = part.material.color.getHexString();
        if (!batches.has(key)) batches.set(key, { material: part.material.clone(), geometries: [] });
        const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone(); geometry.applyMatrix4(part.matrix);
        batches.get(key).geometries.push(geometry);
        parent.remove(part); part.geometry.dispose(); part.material.dispose();
    }
    const mergedParts = [];
    for (const batch of batches.values()) {
        const geometry = mergeGeometries(batch.geometries, false);
        batch.geometries.forEach(item => item.dispose());
        const merged = new THREE.Mesh(geometry, batch.material);
        merged.castShadow = merged.receiveShadow = true; parent.add(merged); mergedParts.push(merged);
    }
    body.dispose();skin.dispose();recess.dispose();hairMaterial.dispose();
    return mergedParts;
}
