import * as THREE from 'three';

// Small, static reflection source. Filter once at creation, never during a frame.
// The background remains the playable room; this only softens material highlights.
export function createRoomReflection(renderer) {
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const ctx=canvas.getContext('2d'), fill=ctx.createLinearGradient(0,0,0,256);
    fill.addColorStop(0,'#8c9599');fill.addColorStop(.32,'#655f56');
    fill.addColorStop(.6,'#30251c');fill.addColorStop(1,'#17120e');
    ctx.fillStyle=fill;ctx.fillRect(0,0,512,256);
    for(const x of [55,185,315,445]) {
        const light=ctx.createRadialGradient(x,88,2,x,88,52);
        light.addColorStop(0,'rgba(218,226,223,.8)');light.addColorStop(.5,'rgba(191,203,201,.25)');light.addColorStop(1,'rgba(191,203,201,0)');
        ctx.fillStyle=light;ctx.fillRect(x-52,36,104,104);
    }
    const source=new THREE.CanvasTexture(canvas);source.colorSpace=THREE.SRGBColorSpace;
    source.mapping=THREE.EquirectangularReflectionMapping;
    const generator=new THREE.PMREMGenerator(renderer), target=generator.fromEquirectangular(source);
    generator.dispose();source.dispose();
    return target;
}

export function createPaperEdges() {
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#b7a88e';ctx.fillRect(0,0,128,256);
    for(let y=0;y<256;y+=4) {
        ctx.fillStyle=y%12?'rgba(58,42,28,.23)':'rgba(246,231,199,.35)';
        ctx.fillRect(0,y,128,1);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;return texture;
}

export function addTableContact(scene) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d'), gradient=ctx.createRadialGradient(64,64,25,64,64,64);
    gradient.addColorStop(0,'rgba(0,0,0,.38)');gradient.addColorStop(.72,'rgba(0,0,0,.24)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const map=new THREE.CanvasTexture(canvas);
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(15,15),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false}));
    contact.position.y=-1.342;contact.rotation.x=-Math.PI/2;scene.add(contact);
    return map;
}
