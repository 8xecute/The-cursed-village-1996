import * as THREE from 'three';

const smooth = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// The downloaded figures have baked poses rather than skeletons. Deform only
// one arm's private geometry during the shot, then restore the shared model.
export function createShootingArm(pawn) {
    if (!pawn) return null;
    const pivot = new THREE.Vector3(.30, .61, -.015);
    const wrist = new THREE.Vector3(.29, .09, -.69);
    const shoulder = new THREE.Vector3(.30, .61, -.015), elbow = new THREE.Vector3(.40, .22, -.30);
    const lineDistance = (point, a, b) => {
        const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(point.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
        return point.distanceTo(a.clone().addScaledVector(ab, t));
    };
    const meshes = [];
    pawn.children.forEach(part => {
        if (!part.isMesh || part.name === 'chair') return;
        const positions = part.geometry.attributes.position;
        const selected = [];
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
            if (x > 0 && x < .65 && y > -.18 && y < .8 && z < .15) {
                const point = new THREE.Vector3(x, y, z);
                const distance = Math.min(lineDistance(point, shoulder, elbow), lineDistance(point, elbow, wrist));
                const hand = smooth((-z - .42) / .12) * smooth((y + .18) / .13);
                const arm = 1 - smooth((distance - .10) / .10);
                const aboveHip = smooth((y + .18) / .13);
                const skinArm = /body\.body/i.test(part.material.name) && z < -.25 && y < .35;
                const weight = skinArm ? 1 : Math.max(hand, smooth((x - .12) / .09) * aboveHip * arm) * (1 - smooth((z - .01) / .14));
                if (weight) selected.push([i, x, y, z, weight]);
            }
        }
        if (!selected.length) return;
        const original = part.geometry; part.geometry = original.clone();
        meshes.push({ part, original, selected });
    });
    const point = new THREE.Vector3(), axis = new THREE.Vector3(1, 0, 0), q = new THREE.Quaternion();
    let lastAmount = -1, lastRecoil = -1;
    return {
        pose(amount, recoil = 0) {
            q.setFromAxisAngle(axis, amount * .8 + recoil * .055);
            const changed = Math.abs(amount - lastAmount) + Math.abs(recoil - lastRecoil) > .0001;
            lastAmount = amount; lastRecoil = recoil;
            for (const { part, selected } of changed ? meshes : []) {
                const positions = part.geometry.attributes.position;
                for (const [i, x, y, z, weight] of selected) {
                    point.set(x, y, z);
                    point.sub(pivot).applyQuaternion(q).add(pivot);
                    positions.setXYZ(i, x + (point.x - x) * weight, y + (point.y - y) * weight, z + (point.z - z) * weight);
                }
                positions.needsUpdate = true;
                // Rebuild normals only while the pose changes, not throughout bullet travel.
                part.geometry.computeVertexNormals();
                part.frustumCulled = false;
            }
            pawn.updateWorldMatrix(true, false);
            return pawn.localToWorld(wrist.clone().sub(pivot).applyQuaternion(q).add(pivot));
        },
        dispose() { meshes.forEach(({ part, original }) => { part.geometry.dispose(); part.geometry = original; part.frustumCulled = true; }); }
    };
}

export function createGunShot({ scene, from, to, getPawn, raiseDuration = 900, bulletDuration = 4200 }) {
    const group = new THREE.Group(), gun = new THREE.Group(); scene.add(group); group.add(gun);
    gun.scale.setScalar(.7);
    const metal = new THREE.MeshStandardMaterial({ color: 0x383e42, metalness: .88, roughness: .28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x171a1c, metalness: .5, roughness: .52 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x30271f, roughness: .82 });
    function add(geometry, material, position, parent = gun) {
        const part = new THREE.Mesh(geometry, material); part.position.set(...position); parent.add(part); return part;
    }
    // Barrel, slide, recessed bore, grip, trigger guard and sights.
    const slide = add(new THREE.BoxGeometry(.105, .105, .40), metal, [0, .075, .12]);
    const barrel = add(new THREE.CylinderGeometry(.032, .032, .40, 16), metal, [0, .055, .13]); barrel.rotation.x = Math.PI / 2;
    const bore = add(new THREE.CircleGeometry(.022, 16), dark, [0, .055, .333]);
    const handle = add(new THREE.BoxGeometry(.085, .23, .12), grip, [0, -.09, -.015]); handle.rotation.x = -.2;
    const guard = add(new THREE.TorusGeometry(.065, .009, 6, 14), dark, [0, -.06, .11]); guard.rotation.y = Math.PI / 2;
    for (const z of [-.025, .285]) add(new THREE.BoxGeometry(.018, .025, .025), dark, [0, .14, z]);
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(.108, .055, .006), dark, [0, .08, -.025 + i * .013]);
    const flash = add(new THREE.ConeGeometry(.08, .28, 7), new THREE.MeshBasicMaterial({ color: 0xffe5af, transparent: true, toneMapped: false }), [0, .055, .46]); flash.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0xffb966, 0, 3); light.position.set(0, .055, .38); gun.add(light);
    const bullet = new THREE.Group(); group.add(bullet);
    const copper = new THREE.MeshStandardMaterial({ color: 0xb87536, metalness: .85, roughness: .24 });
    const body = add(new THREE.CylinderGeometry(.026, .026, .09, 12), copper, [0, 0, 0], bullet); body.rotation.x = Math.PI / 2;
    const tip = add(new THREE.SphereGeometry(.026, 12, 8), copper, [0, 0, .045], bullet); tip.scale.set(1, 1, 1.8);
    const trail = add(new THREE.CylinderGeometry(.004, .015, .45, 8), new THREE.MeshBasicMaterial({ color: 0xd8b47b, transparent: true, opacity: .25, depthWrite: false }), [0, 0, -.24], bullet); trail.rotation.x = Math.PI / 2;
    const shell = add(new THREE.CylinderGeometry(.025, .025, .09, 10), new THREE.MeshStandardMaterial({ color: 0xc8a555, metalness: .8, roughness: .3 }), [0, 0, 0], group);
    const smoke = add(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xaaaaa3, transparent: true, opacity: .1, depthWrite: false }), [0, 0, 0], group);
    let pawn = null, arm = null;
    const direction = to.clone().sub(from).normalize();
    const start = performance.now(), muzzle = new THREE.Vector3(), eject = new THREE.Vector3();
    let fired = false;
    return {
        tick(now) {
            const currentPawn = getPawn();
            if (pawn !== currentPawn) { arm?.dispose(); pawn = currentPawn; arm = createShootingArm(pawn); }
            const elapsed = now - start, firedAt = raiseDuration;
            // First 65% picks up and raises; the remainder is a steady aiming beat.
            const lift = smooth(elapsed / (raiseDuration * .65));
            const after = elapsed - firedAt, recoil = after >= 0 ? Math.exp(-after / 100) : 0;
            const hand = arm?.pose(lift, recoil);
            gun.position.copy(hand || from.clone().add(new THREE.Vector3(0, -.45 * (1 - lift), 0)));
            gun.position.y += .065;
            gun.lookAt(to); gun.rotateX((1 - lift) * .95); gun.translateZ(-.055 * recoil);
            slide.position.z = .12 - .065 * recoil;
            gun.updateWorldMatrix(true, true);
            if (after >= 0 && !fired) { fired = true; muzzle.copy(gun.localToWorld(new THREE.Vector3(0, .055, .34))); eject.copy(gun.position); }
            flash.visible = after >= 0 && after < 65; light.intensity = flash.visible ? 7 : 0;
            bullet.visible = after >= 0 && after < bulletDuration;
            bullet.position.lerpVectors(muzzle, to, THREE.MathUtils.clamp(after / bulletDuration, 0, 1)); bullet.lookAt(to.clone().add(direction));
            shell.visible = after >= 0 && after < 750;
            if (shell.visible) { const t = after / 1000; shell.position.copy(eject).add(new THREE.Vector3(t * 1.1, .2 + t * 1.8 - t * t * 4, t * .4)); shell.rotation.set(t * 14, t * 9, t * 5); }
            smoke.visible = after >= 0 && after < 650;
            smoke.position.copy(muzzle).addScaledVector(direction, .12).add(new THREE.Vector3(0, Math.max(0, after) * .0002, 0)); smoke.scale.setScalar(1 + Math.max(0, after) / 180); smoke.material.opacity = .1 * Math.max(0, 1 - after / 650);
            return elapsed < raiseDuration + bulletDuration;
        },
        dispose() {
            arm?.dispose(); scene.remove(group);
            const materials = new Set(); group.traverse(part => { part.geometry?.dispose(); if (part.material) materials.add(part.material); }); materials.forEach(material => material.dispose());
        }
    };
}
