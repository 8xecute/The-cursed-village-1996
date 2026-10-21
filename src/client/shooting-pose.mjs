import * as THREE from 'three';
import { createShootingArms } from './shooting-arms.mjs';

const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
const up = new THREE.Vector3(0, 1, 0);

// The seated CC0 figures have baked geometry. Each shooter gets private copies;
// shared roster geometry, the chair and all other players stay unchanged.
export function createStandingShooter(pawn) {
    if (!pawn) return null;
    const male = pawn.children.some(part => /Sam/i.test(part.name + (part.material?.name || '')));
    const shoulderY = male ? .46 : .32, shoulderX = male ? .31 : .26;
    const armRig = createShootingArms(pawn, male);
    const records = [];
    const sourceJoints = [-1, 1].map(side => [
        new THREE.Vector3(side * shoulderX, shoulderY, -.015),
        new THREE.Vector3(side * (male ? .34 : .29), male ? -.02 : .04, -.20),
        new THREE.Vector3(side * .20, .035, -.43)
    ]);
    for (const part of pawn.children) {
        if (!part.isMesh || part.name === 'chair' || part.userData.shootingArm) continue;
        const original = part.geometry, attribute = original.attributes.position;
        const base = Float32Array.from(attribute.array);
        part.geometry = original.clone(); part.frustumCulled = false;
        const side = part.material.side; part.material.side = THREE.DoubleSide;
        const legs = /bottom|anatomical body\.female_casualsuit|shoes/i.test(part.material.name);
        records.push({ part, original, base, legs, side });
    }
    const point = new THREE.Vector3(), aimPoint = new THREE.Vector3(.20, shoulderY + .01, -.48);
    let previous = '';
    return {
        pose(stand, pickup, aim, yaw, recoil = 0) {
            const key = [stand, pickup, aim, yaw, recoil].map(n => n.toFixed(3)).join(':');
            const lift = .58 * stand, turn = yaw * aim;
            const targets = [-1, 1].map((side, index) => {
                const joints = sourceJoints[index].map(p => p.clone());
                // Reach beside the chair, then bring both hands to the stock/fore-end.
                const reach = new THREE.Vector3(.64, -.24, .08);
                const grip = index ? new THREE.Vector3(.20, shoulderY - .06, -.43) : new THREE.Vector3(.18, shoulderY - .015, -.66);
                const elbow = index ? new THREE.Vector3(.32, shoulderY - .30, -.26) : new THREE.Vector3(-.10, shoulderY - .23, -.39);
                joints[1].lerp(new THREE.Vector3(side * .43, -.04, -.04), index ? pickup : 0).lerp(elbow, aim);
                joints[2].lerp(reach, index ? pickup : 0).lerp(grip, aim);
                return joints;
            });
            const mapped = new THREE.Vector3(), residual = new THREE.Vector3(), legPoint = new THREE.Vector3();
            const legSource = [new THREE.Vector3(0,-.23,.02),new THREE.Vector3(0,-.40,-.51),new THREE.Vector3(0,-.87,-.58)];
            const legTarget = [new THREE.Vector3(0,-.23,.02),new THREE.Vector3(0,-.83,-.03),new THREE.Vector3(0,-1.42,-.05)];
            const legFrames = [0,1].map(segment => {
                const axis=legSource[segment+1].clone().sub(legSource[segment]), next=legTarget[segment+1].clone().sub(legTarget[segment]);
                return {axis,next,lengthSq:axis.lengthSq(),q:new THREE.Quaternion().setFromUnitVectors(axis.clone().normalize(),next.clone().normalize())};
            });
            function mapLeg(original, segment, output) {
                const frame=legFrames[segment];residual.copy(original).sub(legSource[segment]);
                const t=residual.dot(frame.axis)/frame.lengthSq;
                residual.addScaledVector(frame.axis,-t).applyQuaternion(frame.q);
                return output.copy(legTarget[segment]).addScaledVector(frame.next,t).add(residual);
            }
            if (key !== previous) for (const { part, base, legs } of records) {
                const positions = part.geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
                    point.set(x, y, z);
                    if (legs || (y < -.18 && /body\.body/i.test(part.material.name))) {
                        const weight = (legs ? 1 : smooth(-y, .18, .32)) * stand;
                        const originalPoint = legPoint.copy(point);
                        mapLeg(originalPoint,0,point);mapLeg(originalPoint,1,mapped);
                        point.lerp(mapped,smooth(-y,.30,.55));point.lerp(originalPoint,1-weight);
                    }
                    point.y += lift;point.z -= .35*stand;
                    point.applyAxisAngle(up, turn);
                    positions.setXYZ(i, point.x, point.y, point.z);
                }
                positions.needsUpdate = true; part.geometry.computeVertexNormals();
            }
            armRig.pose({sourceJoints,targets,lift,turn,stand,aim});
            previous = key;
            pawn.updateWorldMatrix(true, false);
            point.copy(aimPoint).add(new THREE.Vector3(0, lift, -.35*stand)).applyAxisAngle(up, turn);
            return pawn.localToWorld(point.clone());
        },
        dispose() {
            for (const { part, original, side } of records) { part.geometry.dispose(); part.geometry = original; part.frustumCulled = true; part.material.side = side; }
            armRig.dispose();
        }
    };
}
