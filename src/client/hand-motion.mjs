import * as THREE from 'three';
import { CARD_MOTION } from '../../public/js/core/card-motion.mjs';

export function createHandMotion() {
    const poses = new Map();
    const pose = mesh => ({ position:mesh.position.clone(), rotation:mesh.quaternion.clone(), scale:mesh.scale.clone() });
    return {
        begin() { for (const entry of poses.values()) { entry.previous = pose(entry.mesh); entry.seen = false; } },
        place(key, mesh, animate) {
            const previous = poses.get(key)?.previous, target = pose(mesh);
            const changed = previous && (previous.position.distanceToSquared(target.position) > .00001 ||
                previous.rotation.angleTo(target.rotation) > .001 || previous.scale.distanceToSquared(target.scale) > .00001);
            const entry = { mesh, target, previous, seen:true, started:performance.now(), moving:!!animate && !!changed };
            if (entry.moving) { mesh.position.copy(previous.position); mesh.quaternion.copy(previous.rotation); mesh.scale.copy(previous.scale); }
            poses.set(key, entry);
        },
        end() { for (const [key, entry] of poses) if (!entry.seen) poses.delete(key); },
        tick(now) {
            let moving = false;
            for (const entry of poses.values()) {
                if (!entry.moving) continue;
                const t = THREE.MathUtils.clamp((now-entry.started)/CARD_MOTION.hand,0,1), eased=t*t*(3-2*t);
                entry.mesh.position.lerpVectors(entry.previous.position,entry.target.position,eased);
                entry.mesh.position.y += Math.sin(t*Math.PI)*.045;
                entry.mesh.quaternion.slerpQuaternions(entry.previous.rotation,entry.target.rotation,eased);
                entry.mesh.scale.lerpVectors(entry.previous.scale,entry.target.scale,eased);
                entry.moving = t < 1; moving ||= entry.moving;
            }
            return moving;
        },
        clear() { poses.clear(); }
    };
}
