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
    const metal = new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: .75, roughness: .67 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x171a1c, metalness: .5, roughness: .52 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x62402a, roughness: .92 });
    function add(geometry, material, position, parent = gun) {
        const part = new THREE.Mesh(geometry, material); part.position.set(...position); parent.add(part); return part;
    }
    // An aged break-action double-barrel shotgun, with a walnut stock.
    add(new THREE.BoxGeometry(.17, .14, .23), metal, [0, .05, .05]);
    const stock = add(new THREE.BoxGeometry(.13, .22, .42, 2, 2, 4), grip, [0, -.045, -.29]);
    stock.rotation.x = -.16;
    add(new THREE.BoxGeometry(.14, .23, .025), dark, [0, -.075, -.50]);
    const handle = add(new THREE.BoxGeometry(.09, .17, .13), grip, [0, -.09, -.055]); handle.rotation.x = -.32;
    const forearm = add(new THREE.BoxGeometry(.15, .085, .37), grip, [0, -.025, .35]); forearm.rotation.x = -.025;
    for (const x of [-.047, .047]) {
        const barrel = add(new THREE.CylinderGeometry(.042, .048, .85, 18), metal, [x, .075, .52]); barrel.rotation.x = Math.PI / 2;
        add(new THREE.CircleGeometry(.031, 18), dark, [x, .075, .948]);
        for (const z of [.24, .62]) {
            const band = add(new THREE.TorusGeometry(.044, .005, 5, 18), dark, [x, .075, z]);
            band.rotation.z = Math.PI / 2;
        }
    }
    add(new THREE.BoxGeometry(.015, .014, .78), dark, [0, .108, .53]);
    add(new THREE.SphereGeometry(.012, 8, 6), metal, [0, .128, .90]);
    const guard = add(new THREE.TorusGeometry(.065, .009, 6, 14), dark, [0, -.065, .045]); guard.rotation.y = Math.PI / 2;
    const trigger = add(new THREE.BoxGeometry(.016, .065, .018), dark, [0, -.04, .03]); trigger.rotation.x = -.3;
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(.152, .004, .008), dark, [0, -.05, .22 + i * .055]);
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
            return elapsed < raiseDuration + bulletDuration;
        },
        dispose() {
            arm?.dispose(); scene.remove(group);
            const materials = new Set(), geometries = new Set(); group.traverse(part => { if (part.geometry) geometries.add(part.geometry); if (part.material) materials.add(part.material); }); geometries.forEach(geometry=>geometry.dispose()); materials.forEach(material => material.dispose());
        }
    };
}
