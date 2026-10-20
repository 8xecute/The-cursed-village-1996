import * as THREE from 'three';

// Prepared CC0 MakeHuman/MPFB figures. Each figure already contains its own
// face, eyes, hair, clothes and hands; never add the old head/body underneath.
export function prepareVillagerModels(scene) {
    scene.updateMatrixWorld(true);
    return ['villager-0', 'villager-1'].map((name, index) => {
        const root = scene.getObjectByName(name);
        if (!root) throw new Error(`Missing ${name}`);
        const parts = [];
        const placement = new THREE.Matrix4().makeTranslation(0, -.95, 0)
            .multiply(new THREE.Matrix4().makeScale(1.3, 1.3, 1.3));
        root.traverse(mesh => {
            if (!mesh.isMesh) return;
            const geometry = mesh.geometry.clone().applyMatrix4(placement.clone().multiply(mesh.matrixWorld));
            const material = mesh.material.clone();
            const part = new THREE.Mesh(geometry, material);
            part.name = mesh.name;
            parts.push(part);
        });
        // A chair fitted to each figure's original seated pose.
        const seatY = (index ? .45 : .40) * 1.3 - .95;
        const wood = new THREE.MeshStandardMaterial({ color: 0x36291e, roughness: .92 });
        const chair = (size, position) => {
            const geometry = new THREE.BoxGeometry(...size); geometry.translate(...position);
            const mesh = new THREE.Mesh(geometry, wood); mesh.name = 'chair'; parts.push(mesh);
        };
        chair([.72, .07, .65], [0, seatY, .015]);
        const floorY = -.928;
        for (const x of [-.30, .30]) for (const z of [-.25, .30])
            chair([.055, seatY - floorY, .055], [x, (seatY + floorY) / 2, z]);
        for (const x of [-.30, .30]) chair([.055, .78, .055], [x, seatY + .39, .30]);
        chair([.65, .085, .07], [0, seatY + .75, .30]);
        for (const x of [-.16, 0, .16]) chair([.04, .58, .04], [x, seatY + .39, .30]);
        return parts;
    });
}

export function instantiateVillager(parent, models, color, alive, variant) {
    return models[variant % models.length].map(source => {
        const material = source.material.clone();
        // Tint cloth only. Preserve photographic skin and eye colors.
        if (/top|casualsuit|bottom/i.test(material.name))
            material.color.lerp(new THREE.Color(color), .3);
        if (!alive && source.name !== 'chair') material.color.multiplyScalar(.45);
        const part = new THREE.Mesh(source.geometry, material);
        part.castShadow = part.receiveShadow = true;
        parent.add(part);
        return part;
    });
}

export function disposeVillagerModels(models, disposeTextures = false) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    models.flat().forEach(part => {
        geometries.add(part.geometry); materials.add(part.material);
        if (disposeTextures) Object.values(part.material).forEach(value => { if (value?.isTexture) textures.add(value); });
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
}
