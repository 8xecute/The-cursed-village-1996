import * as THREE from 'three';
import { createVillagerVariants } from './villager-variants.mjs';

const greyMaps = new WeakMap();
function greyMap(texture) {
    if (!texture) return null;
    if (!greyMaps.has(texture)) {
        const image = texture.image, canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'), supportsFilter = 'filter' in ctx;
        if (supportsFilter) ctx.filter = 'grayscale(1)';
        ctx.drawImage(image, 0, 0);
        if (!supportsFilter) {
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), data = pixels.data;
            for (let i = 0; i < data.length; i += 4) {
                const value = .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
                data[i] = data[i + 1] = data[i + 2] = value;
            }
            ctx.putImageData(pixels, 0, 0);
        }
        // Texture.clone shares its Source with the original. Give the grey
        // variant its own Source so dead players cannot recolor living ones.
        const grey = texture.clone(); grey.source = new THREE.Source(canvas); grey.needsUpdate = true;
        greyMaps.set(texture, grey);
    }
    return greyMaps.get(texture);
}

// Prepared CC0 MakeHuman/MPFB figures. Each figure already contains its own
// face, eyes, hair, clothes and hands; never add the old head/body underneath.
export function prepareVillagerModels(scene) {
    scene.updateMatrixWorld(true);
    const bases = ['villager-0', 'villager-1'].map((name, index) => {
        const root = scene.getObjectByName(name);
        if (!root) throw new Error(`Missing ${name}`);
        const parts = [];
        const placement = new THREE.Matrix4().makeTranslation(0, -.95, 0)
            .multiply(new THREE.Matrix4().makeScale(1.3, 1.3, 1.3));
        root.traverse(mesh => {
            if (!mesh.isMesh) return;
            const geometry = mesh.geometry.clone().applyMatrix4(placement.clone().multiply(mesh.matrixWorld));
            // Preserve the authored wrists and sleeves. The table no longer
            // has a raised rim, so no local arm deformation is necessary.
            const material = mesh.material.clone();
            // Skin, cotton and eyes should not all share the same plastic sheen.
            const surface = `${mesh.name} ${material.name}`;
            material.envMapIntensity = .35;
            if (/cotton|casualsuit|\| top\.|\| bottom\./i.test(surface)) {
                material.roughness = .94;material.envMapIntensity = .2;
            } else if (/low-poly/i.test(surface)) {
                material.roughness = .28;material.envMapIntensity = .8;
            } else if (/body\.\d/i.test(material.name)) {
                material.roughness = .66;material.envMapIntensity = .5;
            } else if (/bob01|short01|hair|eyebrow|eyelash/i.test(surface)) {
                material.roughness = .82;
            }
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
    return createVillagerVariants(bases);
}

export function instantiateVillager(parent, models, color, alive, variant) {
    return models[variant % models.length].filter(source => alive || !/teeth|tongue/i.test(source.name + source.material.name)).map(source => {
        const material = source.material.clone();
        // Tint cloth only. Preserve photographic skin and eye colors.
        if (models[variant % models.length].characterId == null && /top|casualsuit|bottom/i.test(material.name))
            material.color.lerp(new THREE.Color(color), .3);
        if (!alive && source.name !== 'chair') {
            material.color.setHex(0xaaaaaa);
            material.map = greyMap(material.map);
            material.roughness = 1;
        }
        const ownedGeometry = !alive && source.name !== 'chair';
        const headPart = /head_accessory|eyebrow|eyelash|low-poly|short01|bob01|scalp|hair/i.test(source.name);
        const geometry = ownedGeometry ? slumpedGeometry(source.geometry, headPart) : source.geometry;
        const part = new THREE.Mesh(geometry, material);
        part.userData.ownedGeometry = ownedGeometry;
        part.name = source.name;
        part.castShadow = part.receiveShadow = true;
        parent.add(part);
        return part;
    });
}

function slumpedGeometry(source, headPart = false) {
    const geometry = source.clone(), positions = geometry.attributes.position;
    const pivot = new THREE.Vector3(0, .05, .015);
    const point = new THREE.Vector3(), rotation = new THREE.Quaternion();
    const axis = new THREE.Vector3(1, 0, 0);
    // Bend at the hips toward the centre of the table. A smooth transition
    // leaves the thighs/feet in their seated pose and keeps the chair upright.
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
        let weight = THREE.MathUtils.smoothstep(y, -.37, -.06);
        // Leave hands/forearms on the table instead of folding them through
        // it together with the chest. Blend the upper arms at the shoulders.
        if (!headPart && y < .48) weight *= 1 - THREE.MathUtils.smoothstep(-z, .10, .35);
        if (!weight) continue;
        rotation.setFromAxisAngle(axis, -1.30 * weight);
        point.set(x, y, z).sub(pivot).applyQuaternion(rotation).add(pivot);
        // The tabletop in pawn coordinates is y=.018. Keep the face, hair
        // and arms resting just above it, including at the outer edge.
        if ((headPart || y > .48) && point.z < -.36) point.y = Math.max(.037, point.y);
        positions.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

export function disposeVillagerModels(models, disposeTextures = false) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    models.flat().forEach(part => {
        geometries.add(part.geometry); materials.add(part.material);
        if (disposeTextures) Object.values(part.material).forEach(value => {
            if (!value?.isTexture) return;
            textures.add(value);
            const grey = greyMaps.get(value); if (grey) { textures.add(grey); greyMaps.delete(value); }
        });
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
}
