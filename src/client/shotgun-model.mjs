import * as THREE from 'three';

// Shared appearance for the wall, chair and shooting animation.
export function createShotgun() {
    const gun = new THREE.Group();
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
    return gun;
}
