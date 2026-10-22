import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Deterministic, locally generated materials: no external model or texture downloads.
export function timberTexture() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    let seed = 1996;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.fillStyle = '#715038'; ctx.fillRect(0, 0, 1024, 1024);
    for (let plank = 0; plank < 12; plank++) {
        const y = plank * 1024 / 12, height = 1024 / 12;
        const shade = Math.round(100 + random() * 24);
        ctx.fillStyle = `rgba(${shade},${Math.round(shade*.69)},${Math.round(shade*.46)},.32)`;
        ctx.fillRect(0,y,1024,height);
        const knotX = random()*800+100, knotY = y + height*.45;
        for (let line = 0; line < 100; line++) {
            const origin = y + random() * height, phase = random()*6;
            ctx.strokeStyle = line % 4 ? `rgba(33,20,12,${.045+random()*.09})` : 'rgba(211,166,111,.12)';
            ctx.lineWidth = .35 + random()*.7; ctx.beginPath();
            for (let x = 0; x <= 1024; x += 4) {
                const knot = Math.exp(-(((x-knotX)/75)**2)) * Math.sin((origin-knotY)/height*Math.PI)*7;
                const grain = origin + Math.sin(x * .009 + phase)*1.5 + Math.sin(x*.026+phase)*.6 + knot;
                if (!x) ctx.moveTo(x,grain); else ctx.lineTo(x,grain);
            }
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(28,17,10,.38)'; ctx.fillRect(0,y,1024,1.5);
        ctx.fillStyle = 'rgba(199,154,99,.14)'; ctx.fillRect(0,y+1.5,1024,.7);
        if (plank%3===1) for(let ring=0;ring<4;ring++) {
            ctx.strokeStyle='rgba(44,26,15,.15)';ctx.lineWidth=.65;
            ctx.beginPath();ctx.ellipse(knotX,knotY,5+ring*7,1+ring*1.2,0,0,Math.PI*2);ctx.stroke();
        }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

export function ceremonialCloth() {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#443c31';ctx.fillRect(0,0,512,512);
    for(let i=0;i<512;i+=2) { ctx.fillStyle=i%4?'rgba(12,9,6,.07)':'rgba(171,146,104,.07)';ctx.fillRect(i,0,1,512);ctx.fillRect(0,i,512,1); }
    for(const radius of [224,230,239,244]) { ctx.strokeStyle='rgba(180,151,96,.45)';ctx.lineWidth=radius===230?2:1;ctx.beginPath();ctx.arc(256,256,radius,0,Math.PI*2);ctx.stroke(); }
    for(let i=0;i<48;i++) {
        const a=i*Math.PI/24;ctx.save();ctx.translate(256+Math.sin(a)*213,256+Math.cos(a)*213);ctx.rotate(-a);
        ctx.strokeStyle='rgba(180,151,96,.38)';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,0);ctx.lineTo(0,6);ctx.lineTo(-4,0);ctx.closePath();ctx.stroke();ctx.restore();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function buildCeremonialRoom(scene, wood, lowPower = false) {
    // Separate UV repeats prevent metre-wide grain on the floor and walls.
    const floorMap=wood.clone(), wallMap=wood.clone();
    for(const map of [floorMap,wallMap]) { map.wrapS=map.wrapT=THREE.RepeatWrapping;map.needsUpdate=true; }
    floorMap.repeat.set(4,4);wallMap.repeat.set(2,1.5);
    const material = new THREE.MeshStandardMaterial({map:wallMap,bumpMap:wallMap,bumpScale:.009,color:0x9a8270,roughness:.88,envMapIntensity:.2});
    const floorMaterial = new THREE.MeshStandardMaterial({map:floorMap,bumpMap:floorMap,bumpScale:.008,color:0xa18a74,roughness:.78,envMapIntensity:.2});
    const dark = new THREE.MeshStandardMaterial({map:wallMap,color:0x564538,roughness:.8});
    const bronze = new THREE.MeshStandardMaterial({color:0x77603b,roughness:.6,metalness:.65});
    const add=(geometry,mat,position)=>{const part=new THREE.Mesh(geometry,mat);part.position.set(...position);part.receiveShadow=true;scene.add(part);return part;};
    const beam=(size,position)=>add(new THREE.BoxGeometry(...size),dark,position);
    add(new THREE.PlaneGeometry(48,48),floorMaterial,[0,-1.35,0]).rotation.x=-Math.PI/2;
    // Repeat the same inward-facing room wall on all four sides. Leaving the
    // ceiling open preserves overhead play; walls disappear when viewed outside.
    const pottery=new THREE.MeshStandardMaterial({color:0x514a3c,roughness:.58,envMapIntensity:.4});
    const outside=document.createElement('canvas');outside.width=256;outside.height=256;
    const sky=outside.getContext('2d');
    const haze=sky.createLinearGradient(0,0,0,256);haze.addColorStop(0,'#9ba7ac');haze.addColorStop(.6,'#75888b');haze.addColorStop(1,'#41575a');
    sky.fillStyle=haze;sky.fillRect(0,0,256,256);
    // Soft cloud bands and distant trees, without additional geometry or lights.
    for(let i=0;i<9;i++) {
        sky.fillStyle=`rgba(205,214,214,${.06+(i%3)*.025})`;sky.beginPath();sky.ellipse((i*83)%300-20,30+i*19,95,14,0,0,Math.PI*2);sky.fill();
    }
    for(let i=0;i<15;i++) {
        const x=i*20-8,top=125+(i*29)%65;
        sky.fillStyle='rgba(35,60,58,.35)';sky.fillRect(x,top,3,256-top);
        sky.beginPath();sky.moveTo(x-17,top+67);sky.lineTo(x+2,top-12);sky.lineTo(x+21,top+67);sky.fill();
    }
    const outsideMap=new THREE.CanvasTexture(outside);outsideMap.colorSpace=THREE.SRGBColorSpace;
    const windowMaterial=new THREE.MeshBasicMaterial({map:outsideMap,color:0xc7d2d4});
    const paper=new THREE.MeshStandardMaterial({color:0xbca16e,emissive:0xffbb6f,emissiveIntensity:.45,roughness:.94});
    const roomLights=[];
    for(let side=0;side<4;side++) {
        const angle=side*Math.PI/2;
        const group=new THREE.Group();group.rotation.y=angle;scene.add(group);
        const wallAdd=(geometry,mat,position)=>{
            const part=new THREE.Mesh(geometry,mat);part.position.set(...position);part.receiveShadow=true;group.add(part);return part;
        };
        const wallBeam=(size,position)=>wallAdd(new THREE.BoxGeometry(...size),dark,position);
        wallAdd(new THREE.PlaneGeometry(24,12),material,[0,4.65,-12]);
        for(const x of [-11.8,-7.8,-3.9,3.9,7.8,11.8]) wallBeam([.22,10,.28],[x,3.5,-11.85]);
        wallBeam([24,.3,.4],[0,6.1,-11.8]);wallBeam([24,.18,.22],[0,.6,-11.8]);
        for(const x of [-5.9,5.9]) {
            wallBeam([2.7,.18,.18],[x,3.8,-11.55]);wallBeam([2.7,.18,.18],[x,1.1,-11.55]);
            for(let i=0;i<7;i++)wallBeam([.12,2.7,.16],[x-1.2+i*.4,2.45,-11.55]);
            wallAdd(new THREE.PlaneGeometry(2.5,2.55),windowMaterial,[x,2.45,-11.65]);
        }
        wallBeam([3,.15,.9],[0,.1,-11.1]);
        for(const x of [-1.2,1.2])wallBeam([.12,1.4,.12],[x,-.65,-11.1]);
        for(const [x,size] of [[-.8,.25],[.8,.32]]) {
            const profile=[[0,0],[size*.65,0],[size,.18],[size*.8,.42],[size*.38,.5],[size*.4,.6]].map(([r,y])=>new THREE.Vector2(r,y));
            wallAdd(new THREE.LatheGeometry(profile,16),pottery,[x,.17,-11.1]);
        }
        for(const x of [-8,8]) {
            // Emissive lanterns everywhere, one restrained light per wall for mobile.
            wallAdd(new THREE.CylinderGeometry(.25,.21,.58,8),paper,[x,2.3,-11.3]);
            for(let i=0;i<6;i++){const a=i*Math.PI/3;wallBeam([.025,.7,.025],[x+Math.sin(a)*.25,2.3,-11.3+Math.cos(a)*.25]);}
            wallAdd(new THREE.CylinderGeometry(.3,.3,.06,12),bronze,[x,2.64,-11.3]);wallBeam([.025,3.1,.025],[x,4.2,-11.3]);
        }
        const light=new THREE.PointLight(0xdf9e59,7,10,2);light.position.set(0,3,-10.4);light.userData.qualityLight=true;group.add(light);
        roomLights.push(light);
    }
    // Table legs and cross braces visible when looking across the table.
    for(const x of [-3.3,3.3]) for(const z of [-3.3,3.3]) {
        const leg=add(new THREE.CylinderGeometry(.19,.25,1,12),material,[x,-.85,z]);leg.castShadow=true;
    }
    beam([7,.15,.18],[0,-1.02,0]);beam([.18,.15,7],[0,-1.02,0]);
    return {
        setNight(night) {
            windowMaterial.color.setHex(night?0x020304:0xc7d2d4);
            paper.emissiveIntensity=night?0:.45;
            paper.color.setHex(night?0x32291e:0xbca16e);
            roomLights.forEach(light=>{light.intensity=night?0:7;light.userData.nightDisabled=night;light.visible=!night && light.userData.qualityAllowed!==false;});
        },
        dispose() { outsideMap.dispose();floorMap.dispose();wallMap.dispose(); }
    };
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
        const part=add(new THREE.CapsuleGeometry(radius,Math.max(.001,delta.length()-radius*1.3),3,10),material,start.clone().add(end).multiplyScalar(.5).toArray());
        part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return part;
    };
    // Anatomical torso and short-sleeved shirt, joined under the collar.
    const width=1+(variant%3-1)*.055;
    const torso=[[0,0],[.21,0],[.24,.06],[.25,.28],[.29,.47],[.285,.53],[.2,.58],[.105,.62],[.085,.65]].map(([r,y])=>new THREE.Vector2(r,y));
    const shirt=add(new THREE.LatheGeometry(torso,28),body,[0,0,.025],[width,1,.65]);
    // Subtle tailoring follows the torso rather than separate cylinder arms.
    for(const side of [-1,1]) {
        segment([side*.235*width,.49,.015],[side*.29*width,.36,-.015],.082,body);
        segment([side*.29*width,.37,-.015],[side*.34*width,.18,-.24],.068,skin);
        segment([side*.34*width,.18,-.24],[side*.26*width,.05,-.74],.052,skin);
        const palm=add(new THREE.SphereGeometry(.065,16,10),skin,[side*.26*width,.044,-.77],[.8,.36,1.16]);palm.rotation.y=side*.13;
        // Four fingers plus an opposed thumb resting on the table edge.
        for(let finger=0;finger<4;finger++) {
            const x=side*.26*width+(finger-1.5)*.023;
            const length=[.083,.104,.096,.073][finger];
            segment([x,.044,-.8],[x,.04,-.8-length],.012,skin);
            segment([x,.04,-.8-length],[x,.035,-.822-length],.010,skin);
        }
        segment([side*.215*width,.045,-.75],[side*.183*width,.035,-.83],.018,skin);
        // Folded collar panels in the same subdued cloth palette.
        const collar=new THREE.Shape();
        collar.moveTo(side*.018,.628);collar.lineTo(side*.105,.593);collar.lineTo(side*.065,.545);collar.lineTo(side*.008,.581);collar.closePath();
        add(new THREE.ExtrudeGeometry(collar,{depth:.012,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.004,bevelThickness:.003}),body,[0,0,-.118]);
    }
    add(new THREE.CylinderGeometry(.064,.082,.12,20),skin,[0,.65,.008]);
    for(let button=0;button<4;button++) add(new THREE.SphereGeometry(.009,8,6),recess,[0,.44-button*.09,-.145],[1,1,.45]);
    // A scanned head provides coherent facial anatomy instead of separate primitive features.
    if (headGeometry) {
        const head=headGeometry.clone();
        // Retain the scan's continuous facial surface. Thin eye insets follow
        // the surface rather than projecting separate eyeballs out of the face.
        const vertices = head.attributes.position;
        const surfaceAt = (x, y) => {
            let nearest = Infinity, z = -.11;
            for (let i = 0; i < vertices.count; i++) {
                if (vertices.getZ(i) > 0) continue;
                const distance = (vertices.getX(i) - x) ** 2 + (vertices.getY(i) - y) ** 2;
                if (distance < nearest) { nearest = distance; z = vertices.getZ(i); }
            }
            return z;
        };
        add(head,skin,[0,.66,0],[.82,.82,.82]);
        if (alive) {
            const sclera = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: .95 });
            const iris = new THREE.MeshStandardMaterial({ color: 0x322a21, roughness: .9 });
            for (const side of [-1, 1]) {
                const localX = side * .061, localY = .231;
                const x = localX * .82, y = .66 + localY * .82;
                const z = surfaceAt(localX, localY) * .82;
                add(new THREE.SphereGeometry(.018,16,10),sclera,[x,y,z-.001],[1,.25,.09]);
                add(new THREE.SphereGeometry(.0065,12,8),iris,[x,y,z-.0025],[1,.65,.09]);
                add(new THREE.SphereGeometry(.003,10,6),recess,[x,y,z-.003],[1,.8,.1]);
            }
            sclera.dispose(); iris.dispose();
        }
        // A close-fitting hair shell uses the same scanned skull, with a
        // modest hairline and different heights for each villager.
        if (head.index) {
            const hair = headGeometry.clone(), kept = [], indices = hair.index.array;
            const line = [.335,.315,.35,.325][variant % 4];
            const covered = i => vertices.getY(i) > line ||
                (vertices.getY(i) > .21 && vertices.getZ(i) > -.015);
            for (let i = 0; i < indices.length; i += 3) {
                if (covered(indices[i]) && covered(indices[i+1]) && covered(indices[i+2])) kept.push(indices[i],indices[i+1],indices[i+2]);
            }
            hair.setIndex(kept);
            add(hair,hairMaterial,[0,.661,.001],[.827,.827,.827]);
        }
    }
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
