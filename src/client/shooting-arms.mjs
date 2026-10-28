import * as THREE from 'three';

const up = new THREE.Vector3(0,1,0), forward = new THREE.Vector3(0,0,-1);
const smooth = THREE.MathUtils.smoothstep;

// Keep the photographed hands, but give the baked seated arms explicit joints.
// This avoids stretching sleeve/torso triangles across the chest when aiming.
export function createShootingArms(pawn, male) {
    const originals=[], parts=[], hands=[], segments=[];
    const skinSource=pawn.children.find(p=>/body\.body/i.test(p.material?.name||''));
    const shirt=pawn.children.find(p=>/T-shirt|\| top\./i.test(p.material?.name||''));
    if(!skinSource||!shirt)return { pose(){},dispose(){} };
    function flatMaterial(source, skin=false) {
        const color=source.color.clone();
        if(source.map){
            const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(source.map.image,0,0,1,1);
            const rgb=ctx.getImageData(0,0,1,1).data;color.multiply(new THREE.Color().setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255,THREE.SRGBColorSpace));
        }
        if(skin)color.set(0xc5a083);
        return new THREE.MeshStandardMaterial({color,roughness:.93});
    }
    const cloth=flatMaterial(shirt.material),skin=flatMaterial(skinSource.material,true);
    function add(geometry,material){
        const mesh=new THREE.Mesh(geometry,material);mesh.userData.shootingArm=true;mesh.userData.sharedGeometry=true;mesh.frustumCulled=false;
        pawn.add(mesh);parts.push(mesh);return mesh;
    }
    function filtered(geometry,predicate){
        const indices=[],position=geometry.attributes.position,source=geometry.index?.array||Array.from({length:position.count},(_,i)=>i);
        for(let i=0;i<source.length;i+=3){const a=source[i],b=source[i+1],c=source[i+2];if(predicate(a,b,c,position))indices.push(a,b,c);}
        const result=geometry.clone();result.setIndex(indices);return result;
    }
    const sourceSkin=skinSource.geometry;
    for(const side of [-1,1]){
        const geometry=filtered(sourceSkin,(a,b,c,p)=>[a,b,c].every(i=>p.getX(i)*side>.08&&p.getZ(i)<-.425&&p.getY(i)>-.12&&p.getY(i)<.18));
        const wrist=new THREE.Vector3(side*.20,.035,-.43);geometry.translate(-wrist.x,-wrist.y,-wrist.z);geometry.scale(.82,.82,.82);
        const mesh=add(geometry,skinSource.material.clone());mesh.material.side=THREE.DoubleSide;
        hands.push({mesh,base:Float32Array.from(geometry.attributes.position.array)});
        const chain=[];
        for(let i=0;i<3;i++)chain.push(add(new THREE.CylinderGeometry(.78,1,1,16,4),male||i===0?cloth:skin));
        const elbow=add(new THREE.SphereGeometry(1,16,10),male?cloth:skin);
        const shoulder=add(new THREE.SphereGeometry(1,16,10),cloth);
        segments.push({chain,elbow,shoulder});
    }
    for(const part of pawn.children.slice()){
        if(part.userData.shootingArm||!part.isMesh||!/body\.body|T-shirt|\| top\./i.test(part.material.name))continue;
        const original=part.geometry;
        const cropped=filtered(original,(a,b,c,p)=>{
            const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,y=(p.getY(a)+p.getY(b)+p.getY(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
            if(y<-.12||y>(male?.53:.37))return true;
            const isSkin=/body\.body/i.test(part.material.name);
            const arm=Math.abs(x)>(male ? .29 : .24)&&z<.09&&y>(male ? -.10 : .15);
            const forearm=z<(isSkin ? -.18 : -.30)&&Math.abs(x)>(isSkin ? .06 : .14)&&y<.26;
            return !(arm||forearm);
        });
        originals.push({part,original,cropped});part.geometry=cropped;
    }
    // Inset lining closes the baked sleeve cutouts while retaining the original
    // outer shirt, neckline and texture. It exists only during this animation.
    const lining=add(new THREE.CylinderGeometry(.92,1,1,24,6),cloth);
    lining.scale.set(male ? .25 : .215,male ? .70 : .60,male ? .155 : .145);
    const point=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),delta=new THREE.Vector3();
    function transformed(p,lift,stand,turn){return p.clone().add(new THREE.Vector3(0,lift,-.35*stand)).applyAxisAngle(up,turn);}
    function bone(mesh,from,to,radius){
        delta.copy(to).sub(from);mesh.position.copy(from).add(to).multiplyScalar(.5);
        mesh.quaternion.setFromUnitVectors(up,delta.clone().normalize());mesh.scale.set(radius,delta.length(),radius);
    }
    return {
        pose({sourceJoints,targets,lift,turn,stand,aim}) {
            lining.position.copy(transformed(new THREE.Vector3(0,.08,0),lift,stand,turn));lining.rotation.y=turn;
            for(let side=0;side<2;side++){
                const joints=targets[side].map(p=>transformed(p,lift,stand,turn));
                const {chain,elbow,shoulder}=segments[side];const sleeveEnd=joints[0].clone().lerp(joints[1],male ? .5 : .42);
                shoulder.position.copy(joints[0]);shoulder.scale.setScalar(male ? .083 : .066);
                bone(chain[0],joints[0],sleeveEnd,male?.086:.069);
                bone(chain[1],sleeveEnd,joints[1],male?.078:.050);
                bone(chain[2],joints[1],joints[2],male?.063:.043);
                elbow.position.copy(joints[1]);elbow.scale.setScalar(male?.068:.048);
                const hand=hands[side],p=hand.mesh.geometry.attributes.position;
                for(let i=0;i<p.count;i++){
                    point.fromArray(hand.base,i*3);
                    if(point.z<-.07){const curl=aim*smooth(-point.z,.07,.20);point.z=-.07+(point.z+.07)*Math.cos(curl*1.5);point.y-=Math.sin(curl*1.5)*.085;}
                    p.setXYZ(i,point.x,point.y,point.z);
                }
                p.needsUpdate=true;hand.mesh.geometry.computeVertexNormals();hand.mesh.position.copy(joints[2]);
                a.copy(sourceJoints[side][2]).sub(sourceJoints[side][1]).normalize();
                b.copy(targets[side][2]).sub(targets[side][1]).normalize();
                hand.mesh.quaternion.setFromUnitVectors(a,b).premultiply(new THREE.Quaternion().setFromAxisAngle(up,turn));
            }
        },
        dispose(){
            for(const {part,original,cropped} of originals){part.geometry=original;cropped.dispose();}
            const materials=new Set();for(const part of parts){pawn.remove(part);part.geometry.dispose();materials.add(part.material);}materials.forEach(m=>m.dispose());
        }
    };
}
