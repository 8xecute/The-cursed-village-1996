import * as THREE from 'three';

// A few flat meshes keep the stain inexpensive, including on low quality.
export function addBloodPool(parent, surfaceY, variant = 0) {
    const pool = new THREE.Group();
    pool.name = 'death-blood-pool';
    pool.position.set(0, surfaceY + .003, .85);
    pool.rotation.y = (variant % 7) * .37;
    parent.add(pool);
    const stain = (x, z, width, depth, color, phase) => {
        const shape = new THREE.Shape();
        for (let i = 0; i <= 40; i++) {
            const angle = i / 40 * Math.PI * 2;
            const radius = 1 + .08 * Math.sin(angle * 5 + phase) + .045 * Math.cos(angle * 9 - phase);
            const px = Math.cos(angle) * width * radius, py = Math.sin(angle) * depth * radius;
            if (!i) shape.moveTo(px, py); else shape.lineTo(px, py);
        }
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({
            color, roughness: .36, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
        }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        pool.add(mesh);
    };
    stain(0, 0, .62, .43, 0x681715, variant);
    stain(-.64, -.15, .065, .045, 0x571310, 1);
    stain(.58, .27, .045, .035, 0x681715, 3);
    stain(-.48, -.44, .035, .028, 0x571310, 2);
    return pool;
}
