import * as THREE from 'three';

export const lifeBorderColor = name => name === 'Witch' ? 0xff355b : name === 'Constable' ? 0x46aaff : name ? 0xb7b0a5 : 0xb29465;

// Mesh strips have real width on every WebGL device (lineWidth is usually
// limited to one pixel). Sit just above the face to avoid depth flicker.
export function addLifeCardFrame(face, color, { selected = false, inset = 0 } = {}) {
    const { width, height } = face.geometry.parameters;
    const thickness = width * (selected ? .035 : .045);
    const w = width - inset * 2, h = height - inset * 2;
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });
    for (const [bw, bh, x, y] of [
        [w, thickness, 0, (h - thickness) / 2], [w, thickness, 0, -(h - thickness) / 2],
        [thickness, h - thickness * 2, (w - thickness) / 2, 0], [thickness, h - thickness * 2, -(w - thickness) / 2, 0]
    ]) {
        const border = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), material);
        border.position.set(x, y, .004 + inset * .1); border.renderOrder = 1;
        face.add(border);
    }
}
