import * as THREE from 'three';
import { createShotgun } from './shotgun-model.mjs';
import { createStandingShooter } from './shooting-pose.mjs';

const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function createGunShot({ scene, from, to, getPawn, getParkedGun = () => null, startedAt = Date.now(), raiseDuration = 2800, speechStart = 900, speechDuration = 0, speechText = '', bulletDuration = 3400, recoveryDuration = 900 }) {
    const group = new THREE.Group(), gun = createShotgun(); scene.add(group); group.add(gun);
    gun.scale.setScalar(1.05);
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=220;
    const context=canvas.getContext('2d');context.fillStyle='#f2e5cf';context.beginPath();context.roundRect(4,4,760,188,24);context.fill();
    context.beginPath();context.moveTo(360,187);context.lineTo(382,217);context.lineTo(404,187);context.fill();
    context.fillStyle='#302318';context.textAlign='center';context.font='600 48px "Village Sarabun", sans-serif';
    context.fillText('ประตูมีกลอน',384,80);context.fillText('คนคอนมีปืน',384,146);
    const speechTexture=new THREE.CanvasTexture(canvas);
    speechTexture.colorSpace=THREE.SRGBColorSpace;
    const bubble=new THREE.Sprite(new THREE.SpriteMaterial({map:speechTexture,depthTest:false,toneMapped:false}));
    bubble.scale.set(2.9,.83,1);bubble.renderOrder=100;group.add(bubble);bubble.visible=false;
    function add(geometry, material, position, parent = gun) {
        const part = new THREE.Mesh(geometry, material); part.position.set(...position); parent.add(part); return part;
    }
    const flash = add(new THREE.ConeGeometry(.15, .38, 9), new THREE.MeshBasicMaterial({ color: 0xffddb2, transparent: true, toneMapped: false }), [0, .075, 1.13]); flash.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0xffb966, 0, 4); light.position.set(0, .075, .98); gun.add(light);
    const bullet = new THREE.Group(); group.add(bullet);
    const lead = new THREE.MeshStandardMaterial({color:0xc2b7a1, metalness:.82, roughness:.36});
    const pellets = [];
    for (let i = 0; i < 12; i++) {
        const angle = i * 2.39996, radius = i ? Math.sqrt(i / 11) : 0;
        const pellet = add(new THREE.SphereGeometry(.028, 8, 6), lead, [0, 0, 0], bullet);
        pellet.userData.spread = [Math.cos(angle) * radius, Math.sin(angle) * radius];
        pellets.push(pellet);
    }
    const shell = new THREE.Group(); group.add(shell);
    const caseMaterial = new THREE.MeshStandardMaterial({color:0x83382a, roughness:.8});
    add(new THREE.CylinderGeometry(.037, .037, .14, 12), caseMaterial, [0,0,0], shell);
    add(new THREE.CylinderGeometry(.04, .04, .03, 12), new THREE.MeshStandardMaterial({color:0xb89b52, metalness:.8, roughness:.4}), [0,-.07,0], shell);
    const smoke = add(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xaaaaa3, transparent: true, opacity: .1, depthWrite: false }), [0, 0, 0], group);
    let pawn = null, arm = null;
    const direction = to.clone().sub(from).normalize();
    const start = performance.now() - Math.max(0, Date.now() - startedAt), muzzle = new THREE.Vector3(), eject = new THREE.Vector3();
    const parkedPosition = from.clone(), parkedRotation = new THREE.Quaternion();
    let parkedCaptured = false;
    let fired = false;
    return {
        tick(now) {
            const currentPawn = getPawn();
            if (pawn !== currentPawn) { arm?.dispose(); pawn = currentPawn; arm = createStandingShooter(pawn); }
            const parked = getParkedGun();
            if (parked) {
                if (!parkedCaptured) { parked.updateWorldMatrix(true, false); parked.getWorldPosition(parkedPosition); parked.getWorldQuaternion(parkedRotation); parkedCaptured = true; }
                parked.visible = false;
            }
            const elapsed = now - start, firedAt = raiseDuration;
            const speaking=!!speechText && speechDuration>0 && elapsed>=speechStart && elapsed<speechStart+speechDuration;
            bubble.visible=speaking && !!pawn;
            if(pawn)bubble.position.copy(pawn.localToWorld(new THREE.Vector3(0,1.68,-.35)));
            const poseElapsed=elapsed-Math.min(speechDuration,Math.max(0,elapsed-speechStart));
            const baseRaise=raiseDuration-speechDuration;
            const settle = 1 - smooth((elapsed - raiseDuration - bulletDuration) / recoveryDuration);
            const stand = smooth(poseElapsed / (baseRaise * .30)) * settle;
            const pickup = smooth((poseElapsed - baseRaise * .22) / (baseRaise * .24)) * settle;
            const lift = smooth((poseElapsed - baseRaise * .48) / (baseRaise * .32)) * settle;
            const after = elapsed - firedAt, recoil = after >= 0 ? Math.exp(-after / 100) : 0;
            const localTarget = pawn ? pawn.worldToLocal(to.clone()) : new THREE.Vector3(0, 0, -1);
            const yaw = Math.atan2(-localTarget.x, -localTarget.z);
            const mouth=speaking ? Math.max(0,Math.sin((elapsed-speechStart)*.019))*(.65+.35*Math.sin(elapsed*.007)**2) : 0;
            const hand = arm?.pose(stand, pickup, lift, yaw, recoil, mouth) || from;
            gun.position.copy(parkedPosition).lerp(hand, lift);
            gun.lookAt(to); const aimingRotation = gun.quaternion.clone();
            gun.quaternion.copy(parkedRotation).slerp(aimingRotation, lift);
            gun.translateZ(-.055 * recoil);
            gun.updateWorldMatrix(true, true);
            if (after >= 0 && !fired) { fired = true; muzzle.copy(gun.localToWorld(new THREE.Vector3(0, .075, .96))); eject.copy(gun.position); }
            flash.visible = after >= 0 && after < 65; light.intensity = flash.visible ? 7 : 0;
            bullet.visible = after >= 0 && after < bulletDuration;
            const travel = THREE.MathUtils.clamp(after / bulletDuration, 0, 1);
            bullet.position.lerpVectors(muzzle, to, travel); bullet.lookAt(to.clone().add(direction));
            const spread = Math.min(.55, muzzle.distanceTo(to) * .04) * travel;
            for (const pellet of pellets) pellet.position.set(pellet.userData.spread[0] * spread, pellet.userData.spread[1] * spread, 0);
            shell.visible = after >= 0 && after < 750;
            if (shell.visible) { const t = after / 1000; shell.position.copy(eject).add(new THREE.Vector3(t * 1.1, .2 + t * 1.8 - t * t * 4, t * .4)); shell.rotation.set(t * 14, t * 9, t * 5); }
            smoke.visible = after >= 0 && after < 650;
            smoke.position.copy(muzzle).addScaledVector(direction, .12).add(new THREE.Vector3(0, Math.max(0, after) * .0002, 0)); smoke.scale.setScalar(1 + Math.max(0, after) / 180); smoke.material.opacity = .1 * Math.max(0, 1 - after / 650);
            return elapsed < raiseDuration + bulletDuration + recoveryDuration;
        },
        dispose() {
            arm?.dispose(); scene.remove(group);speechTexture.dispose();
            const parked = getParkedGun(); if (parked) parked.visible = true;
            const materials = new Set(), geometries = new Set(); group.traverse(part => { if (part.geometry) geometries.add(part.geometry); if (part.material) materials.add(part.material); }); geometries.forEach(geometry=>geometry.dispose()); materials.forEach(material => material.dispose());
        }
    };
}
