import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Owns camera navigation and input listeners; the scene owns rendering and picking.
export function createCameraControls({ camera, renderer, cameraMode, requestRender,
    isActive, isDisposed, getSeatPosition, onSeatFocus, onModeChange }) {
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.panSpeed = .9;
    controls.rotateSpeed = .65;
    // Rotation is a turntable around the table's world centre, not a free orbit
    // around the off-centre seat target. Vertical drags must not tilt the view.
    controls.enableRotate = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: null };
    controls.touches = { ONE: cameraMode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: null };
    if (cameraMode === 'pan') controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    renderer.domElement.style.touchAction = 'none';
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 3;
    controls.maxDistance = 24;
    controls.minPolarAngle = .05;
    controls.maxPolarAngle = Math.PI - .1;
    // Walking translates camera + target. Zoom changes only the lens, so it
    // cannot dolly the camera through the same space as W/S movement.
    controls.enableZoom = false;
    function lensZoom(fov) {
        camera.fov = THREE.MathUtils.clamp(fov, 28, 70);
        camera.updateProjectionMatrix(); requestRender();
    }
    function wheelZoom(event) {
        if (!isActive() || isDisposed()) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 200 : 1);
        lensZoom(camera.fov * Math.exp(THREE.MathUtils.clamp(delta, -120, 120) * .0015));
    }
    const touches = new Map();
    let tableDrag = null, panMode = cameraMode === 'pan';
    const tableAxis = new THREE.Vector3(0, 1, 0);
    let pinchDistance = 0, pinchFov = 43, pinching = false;
    function touchDown(event) {
        if (event.pointerType !== 'touch') return;
        touches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
        if (touches.size === 2) {
            const [a, b] = [...touches.values()]; pinchDistance = a.distanceTo(b); pinchFov = camera.fov;
            pinching = true; tableDrag = null; controls.enablePan = false;
        }
    }
    function touchMove(event) {
        if (!touches.has(event.pointerId) || !isActive() || isDisposed()) return;
        touches.get(event.pointerId).set(event.clientX, event.clientY);
        if (touches.size === 2 && pinchDistance > 0) {
            const [a, b] = [...touches.values()]; lensZoom(pinchFov * pinchDistance / Math.max(1, a.distanceTo(b)));
        }
    }
    function touchEnd(event) {
        touches.delete(event.pointerId); if (touches.size !== 2) pinchDistance = 0;
        // Do not reinterpret the remaining finger as a new pan/rotation gesture.
        if (!touches.size) { pinching = false; controls.enablePan = true; }
    }
    function nearestSeat() {
        const angle = Math.atan2(camera.position.x, camera.position.z);
        let nearest = null, distance = Infinity;
        for (const player of seatOrder) {
            const seat = getSeatPosition(player.uniqueId);
            if (!seat) continue;
            const difference = angle - Math.atan2(seat.x, seat.z);
            const delta = Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference)));
            if (delta < distance) { distance = delta; nearest = player; }
        }
        if (nearest && focusedSeatId !== nearest.uniqueId) {
            focusedSeatId = nearest.uniqueId;
            onSeatFocus?.(focusedSeatId === ownSeatId ? 'มุมของคุณ' : nearest.name);
        }
    }
    function tableDown(event) {
        if (pinching || touches.size > 1) { tableDrag = null; return; }
        const looking = event.button === 2 && event.pointerType === 'mouse';
        if ((!looking && (panMode || event.button !== 0)) || event.shiftKey || event.ctrlKey || event.metaKey ||
            !isActive() || isDisposed() || !controls.enabled) return;
        // Flush leftover pan damping before taking over the camera position.
        controls.enableDamping = false; controls.update(); controls.enableDamping = true;
        tableDrag = { id:event.pointerId, x:event.clientX, y:event.clientY, lastX:event.clientX,
            lastY:event.clientY, looking, depth:camera.position.distanceTo(controls.target), moving:false };
    }
    function tableMove(event) {
        if (!tableDrag || event.pointerId !== tableDrag.id || !isActive() || isDisposed() || !controls.enabled) return;
        if (pinching || touches.size > 1) { tableDrag = null; return; }
        if (!tableDrag.moving && Math.hypot(event.clientX-tableDrag.x,event.clientY-tableDrag.y) <= 7) return;
        tableDrag.moving = true;
        if (tableDrag.looking) {
            // Pitch the view at a fixed camera position; horizontal right-drag
            // does not turn the table or move the camera sideways.
            controls.target.y = THREE.MathUtils.clamp(controls.target.y -
                (event.clientY-tableDrag.lastY) * tableDrag.depth * 2 / Math.max(1,canvas.clientHeight), -8, 12);
            tableDrag.lastY = event.clientY;
            controls.update(); requestRender(); return;
        }
        const angle = -(event.clientX-tableDrag.lastX) * Math.PI * 2 / Math.max(1,canvas.clientWidth);
        tableDrag.lastX = event.clientX;
        camera.position.applyAxisAngle(tableAxis, angle);
        controls.target.applyAxisAngle(tableAxis, angle);
        controls.update(); nearestSeat(); requestRender();
    }
    function tableEnd(event) { if (tableDrag?.id === event.pointerId) tableDrag = null; }
    const canvas = renderer.domElement;
    canvas.addEventListener('wheel', wheelZoom, { capture: true, passive: false });
    canvas.addEventListener('pointerdown', touchDown);
    canvas.addEventListener('pointermove', touchMove);
    canvas.addEventListener('pointerup', touchEnd);
    canvas.addEventListener('pointercancel', touchEnd);
    canvas.addEventListener('lostpointercapture', touchEnd);
    canvas.addEventListener('pointerdown', tableDown);
    canvas.addEventListener('pointermove', tableMove);
    canvas.addEventListener('pointerup', tableEnd);
    canvas.addEventListener('pointercancel', tableEnd);
    canvas.addEventListener('lostpointercapture', tableEnd);

    controls.addEventListener('change', requestRender);
    let seatOrder = [];
    let ownSeatId = null;
    let focusedSeatId = null;
    function placeAtSeat(seat) {
        const direction = new THREE.Vector3(seat?.x || 0, 0, seat?.z || 1).normalize();
        const surface = renderer.domElement.parentElement || renderer.domElement;
        const portrait = surface.clientHeight > surface.clientWidth;
        lensZoom(portrait ? 58 : 43);
        const radius = portrait ? 11.3 : 9.8;
        controls.target.set(direction.x * 2.4, .35, direction.z * 2.4);
        camera.position.set(direction.x * radius, portrait ? 4.1 : 3.7, direction.z * radius);
        controls.enableRotate = false; controls.enablePan = true;
        controls.update(); requestRender();
    }
    function focusSeat(id) {
        const seat = getSeatPosition(id);
        if (!seat) return;
        focusedSeatId = id;
        placeAtSeat(seat);
        onSeatFocus?.(seatOrder.find(player => player.uniqueId === id)?.name || 'ผู้เล่น');
    }
    function resetCamera() {
        focusedSeatId = ownSeatId;
        onSeatFocus?.('มุมของคุณ');
        placeAtSeat(getSeatPosition(ownSeatId));
    }

    const pressedKeys = new Set();
    const movementKeys = new Set(['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','ControlLeft','ControlRight']);
    let keyboardLocked = false;
    let previousMovementTime = 0;
    function clearMovement() { pressedKeys.clear(); touches.clear(); tableDrag = null; pinchDistance = 0; pinching = false; controls.enablePan = true; previousMovementTime = 0; }
    function typing(target) { return !!target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'); }
    function keyDown(event) {
        const ctrlEnabled = keyboardLocked && !!document.fullscreenElement;
        if ((event.ctrlKey && !ctrlEnabled) || event.altKey || event.metaKey) { clearMovement(); return; }
        if (event.code.startsWith('Control') && !ctrlEnabled) return;
        if (!isActive() || isDisposed() || document.hidden || !movementKeys.has(event.code) || typing(event.target)) return;
        if (document.querySelector('#card-inspect-overlay:not([hidden])')) return;
        if (event.code === 'Space' && event.target?.closest?.('button, summary, a')) return;
        event.preventDefault();
        if (!pressedKeys.size) previousMovementTime = performance.now();
        pressedKeys.add(event.code); requestRender();
    }
    function keyUp(event) { pressedKeys.delete(event.code); if (!pressedKeys.size) previousMovementTime = 0; }
    function focusChanged(event) { if (typing(event.target) || document.querySelector('#card-inspect-overlay:not([hidden])')) clearMovement(); }
    function visibilityChanged() { if (document.hidden) clearMovement(); }
    function constrainCamera() {
        const target=controls.target.clone();
        controls.target.x=THREE.MathUtils.clamp(controls.target.x,-8,8);
        controls.target.z=THREE.MathUtils.clamp(controls.target.z,-8,8);
        controls.target.y=THREE.MathUtils.clamp(controls.target.y,-8,12);
        camera.position.add(controls.target.clone().sub(target));
        camera.position.y=THREE.MathUtils.clamp(camera.position.y,.35,28);
    }
    function moveCamera(now) {
        if (!pressedKeys.size) return;
        const dt = Math.min(.05, Math.max(0,(now-previousMovementTime)/1000)); previousMovementTime = now;
        const forward = camera.getWorldDirection(new THREE.Vector3()); forward.y = 0;
        if (forward.lengthSq() < .001) forward.set(0,0,-1); else forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward,camera.up).normalize();
        const delta = new THREE.Vector3();
        if (pressedKeys.has('KeyW')) delta.add(forward);
        if (pressedKeys.has('KeyS')) delta.sub(forward);
        if (pressedKeys.has('KeyD')) delta.add(right);
        if (pressedKeys.has('KeyA')) delta.sub(right);
        if (pressedKeys.has('Space')) delta.y += 1;
        if (pressedKeys.has('KeyQ')) delta.y -= 1;
        if (keyboardLocked && document.fullscreenElement && (pressedKeys.has('ControlLeft') || pressedKeys.has('ControlRight'))) delta.y -= 1;
        if (delta.lengthSq()) { delta.normalize().multiplyScalar(4*dt); camera.position.add(delta); controls.target.add(delta); }
    }
    document.addEventListener('keydown',keyDown);
    document.addEventListener('keyup',keyUp);
    document.addEventListener('focusin',focusChanged);
    document.addEventListener('visibilitychange',visibilityChanged);
    window.addEventListener('blur',clearMovement);


    return {
        controls, focusSeat, resetCamera, moveCamera, constrainCamera,
        get hasMovement() { return pressedKeys.size > 0; },
        setSeats(players, me) { seatOrder = players; ownSeatId = me; },
        setCameraMode(mode) {
            const pan=mode==='pan';
            panMode = pan; tableDrag = null;
            controls.mouseButtons.LEFT=pan?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
            controls.touches.ONE=pan?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
            controls.touches.TWO=null;
            onModeChange?.();
        },
        stopMovement: clearMovement,
        setMovement(code, held) {
            if(!isActive() || isDisposed() || !movementKeys.has(code)) return;
            if(held) {if(!pressedKeys.size)previousMovementTime=performance.now();pressedKeys.add(code);requestRender();}
            else {pressedKeys.delete(code);if(!pressedKeys.size)previousMovementTime=0;}
        },
        setKeyboardLocked(locked) { keyboardLocked = !!locked; clearMovement(); },
        stepSeat(direction) {
            if (!seatOrder.length) return;
            const current = seatOrder.findIndex(player => player.uniqueId === (focusedSeatId || ownSeatId));
            const index = (Math.max(0,current)+direction+seatOrder.length)%seatOrder.length;
            focusSeat(seatOrder[index].uniqueId);
        },
        setCameraView(view) {
            lensZoom(43);
            const offset = camera.position.clone().sub(controls.target);
            const azimuth = Math.atan2(offset.x, offset.z);
            const distance = view === 'top' ? 17 : 18;
            const polar = view === 'top' ? .22 : .68;
            controls.target.set(0, .2, 0);
            camera.position.set(Math.sin(azimuth) * Math.sin(polar) * distance,
                .2 + Math.cos(polar) * distance, Math.cos(azimuth) * Math.sin(polar) * distance);
            controls.update(); requestRender();
        },
        zoom(direction) {
            lensZoom(camera.fov * (direction === 'in' ? .86 : 1.16));
        },
        dispose() {
            clearMovement();
            document.removeEventListener('keydown',keyDown);
            document.removeEventListener('keyup',keyUp);
            document.removeEventListener('focusin',focusChanged);
            document.removeEventListener('visibilitychange',visibilityChanged);
            window.removeEventListener('blur',clearMovement);
            canvas.removeEventListener('wheel', wheelZoom, true);
            canvas.removeEventListener('pointerdown', touchDown);
            canvas.removeEventListener('pointermove', touchMove);
            canvas.removeEventListener('pointerup', touchEnd);
            canvas.removeEventListener('pointercancel', touchEnd);
            canvas.removeEventListener('lostpointercapture', touchEnd);
            canvas.removeEventListener('pointerdown', tableDown);
            canvas.removeEventListener('pointermove', tableMove);
            canvas.removeEventListener('pointerup', tableEnd);
            canvas.removeEventListener('pointercancel', tableEnd);
            canvas.removeEventListener('lostpointercapture', tableEnd);
            controls.dispose();
        }
    };
}
