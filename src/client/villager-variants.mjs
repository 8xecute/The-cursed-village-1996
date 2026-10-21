import * as THREE from 'three';
import { VILLAGER_ROSTER } from './villager-roster.mjs';

function recolor(texture, color, cache, hair = false) {
    if (!texture) return null;
    const key = `${texture.uuid}:${color}:${hair}`;
    if (cache.has(key)) return cache.get(key);
    const image=texture.image, scale=Math.min(1,512/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation='color';ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);
    if (hair) {
        // Retain strand detail while making grey hair visible on a dark source map.
        ctx.globalCompositeOperation='screen';ctx.globalAlpha=.55;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=1;
    }
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const map=texture.clone();map.source=new THREE.Source(canvas);map.needsUpdate=true;
    cache.set(key,map);return map;
}
function morph(geometry, profile) {
    const positions=geometry.attributes.position, female=profile.base===0, pivot=female ? .59 : .72;
    for(let i=0;i<positions.count;i++) {
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
        const head=THREE.MathUtils.smoothstep(y,female ? .36 : .46,female ? .47 : .60);
        const torso=THREE.MathUtils.smoothstep(y,-.2,.13)*(1-THREE.MathUtils.smoothstep(y,.32,.48))*(1-THREE.MathUtils.smoothstep(-z,.10,.43));
        positions.setXYZ(i,x*(1+((profile.width||1)-1)*head+((profile.build||1)-1)*torso),
            y+(y-pivot)*((profile.height||1)-1)*head,z);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return geometry;
}
function accessories(profile) {
    const parts=[],female=profile.base===0, eye=female ? .584 : .716, front=female ? -.164 : -.211;
    const add=(geometry,material,name,position,scale,rotation)=>{
        const mesh=new THREE.Mesh(geometry,material);mesh.name=`head_accessory_${name}`;
        if(position)mesh.position.set(...position);if(scale)mesh.scale.set(...scale);if(rotation)mesh.rotation.set(...rotation);
        mesh.updateMatrix();geometry.applyMatrix4(mesh.matrix);mesh.position.set(0,0,0);mesh.scale.set(1,1,1);mesh.rotation.set(0,0,0);
        morph(geometry,profile);parts.push(mesh);return mesh;
    };
    if(profile.glasses) {
        const metal=new THREE.MeshStandardMaterial({color:profile.gold?0x9a7841:0x423a2e,metalness:.6,roughness:.45});
        for(const x of [-.046,.046])add(new THREE.TorusGeometry(.036,.0035,6,24),metal,'glasses',[x,eye,front],[1,.76,1]);
        add(new THREE.BoxGeometry(.025,.004,.004),metal,'glasses_bridge',[0,eye+.002,front]);
        for(const x of [-.086,.086])add(new THREE.BoxGeometry(.004,.004,.14),metal,'glasses_arm',[x,eye,front+.065]);
    }
    if(profile.moustache) {
        const hair=new THREE.MeshStandardMaterial({color:profile.moustache,roughness:.96});
        for(const side of [-1,1])add(new THREE.SphereGeometry(1,16,8),hair,'moustache',[side*.021,eye-.07,front-.008],[.029,.009,.012],[0,0,side*-.14]);
    }
    if(profile.bun) {
        const hair=new THREE.MeshStandardMaterial({color:profile.hair,roughness:.95});
        add(new THREE.SphereGeometry(1,20,14),hair,'hair_bun',[0,.66,.145],[.075,.07,.075]);
        const tie=new THREE.MeshStandardMaterial({color:0x8b4d3f,roughness:.95});
        add(new THREE.TorusGeometry(.049,.006,6,20),tie,'hair_tie',[0,.66,.13],null,[Math.PI/2,0,0]);
    }
    if(profile.hat) {
        const straw=new THREE.MeshStandardMaterial({color:0xa28a5e,roughness:.98});
        add(new THREE.CylinderGeometry(.205,.21,.014,32),straw,'straw_brim',[0,.858,-.015],[1,1,.9]);
        add(new THREE.CylinderGeometry(.10,.135,.105,24),straw,'straw_crown',[0,.913,-.015]);
        const band=new THREE.MeshStandardMaterial({color:0x665039,roughness:1});
        add(new THREE.CylinderGeometry(.132,.136,.022,24,1,true),band,'hat_band',[0,.873,-.015]);
    }
    if(profile.scarf) {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
        ctx.fillStyle=profile.scarf;ctx.fillRect(0,0,64,64);ctx.strokeStyle='#d8c49b';ctx.globalAlpha=.22;ctx.lineWidth=2;
        for(let i=0;i<64;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,64);ctx.moveTo(0,i);ctx.lineTo(64,i);ctx.stroke();}
        const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
        const cloth=new THREE.MeshStandardMaterial({map,roughness:1,side:THREE.DoubleSide});
        add(new THREE.SphereGeometry(.15,28,16,0,Math.PI*2,0,1.5),cloth,'scarf_cap',[0,.61,-.02],[.93,1,1]);
        add(new THREE.SphereGeometry(.15,28,16,0,Math.PI,1.2,1.4),cloth,'scarf_back',[0,.61,-.02],[.93,1.25,1]);
    }
    return parts;
}

export function createVillagerVariants(bases) {
    const textures=new Map();
    return VILLAGER_ROSTER.map((profile,id)=>{
        const parts=id<2?bases[profile.base]:bases[profile.base].filter(source=>
            !(profile.bald && /short01|hairline/i.test(source.name)) && !(profile.scarf && /bob01/i.test(source.name))).map(source=>{
            if(source.name==='chair')return source;
            const geometry=morph(source.geometry.clone(),profile),material=source.material.clone();
            if(/teal cotton|\| top\./i.test(material.name) && profile.shirt) {
                if(material.map) { material.map=recolor(material.map,profile.shirt,textures);material.color.setHex(0xffffff); }
                else material.color.set(profile.shirt);
            }
            if(/bob01|short01|eyebrow/i.test(source.name) && profile.hair) {
                if(material.map) { material.map=recolor(material.map,profile.hair,textures,true);material.color.setHex(0xffffff); }
                else material.color.set(profile.hair);
            }
            if(/bob01/i.test(source.name) && (profile.shortBob || profile.bun)) {
                const p=geometry.attributes.position;
                for(let i=0;i<p.count;i++)if(p.getY(i)<.64)p.setY(i,.64+(.64-p.getY(i))*(profile.bun?-.18:-.48));
                geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
            }
            const part=new THREE.Mesh(geometry,material);part.name=source.name;return part;
        });
        if(id>=2)parts.push(...accessories(profile));
        parts.characterId=id;parts.characterName=profile.name;return parts;
    });
}
