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
            // Lift the forearms over the raised rim, tapering back down onto
            // the flat tabletop. Move the continuous skin/cloth, not just hands.
            const positions = geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
                if (Math.abs(x) < .17 || y < -.3 || y > .65 || z > -.10) continue;
                const armWeight = THREE.MathUtils.smoothstep(Math.abs(x), .17, .25);
                const heightWeight = THREE.MathUtils.smoothstep(y, -.3, -.15) * (1 - THREE.MathUtils.smoothstep(y, .4, .65));
                const ramp = THREE.MathUtils.smoothstep(-z, .12, .32);
                const rim = Math.exp(-(((z + .41) / .19) ** 2));
                positions.setY(i, y + armWeight * heightWeight * ramp * (.025 + .09 * rim));
            }
            geometry.computeVertexNormals();
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
        part.name = source.name;
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
