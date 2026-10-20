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
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: cameraMode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: cameraMode === 'pan' ? THREE.TOUCH.DOLLY_ROTATE : THREE.TOUCH.DOLLY_PAN };
    if (cameraMode === 'pan') controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    renderer.domElement.style.touchAction = 'none';
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 3;
    controls.maxDistance = 24;
    controls.minPolarAngle = .05;
    controls.maxPolarAngle = Math.PI / 2.05;
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
    let pinchDistance = 0, pinchFov = 43;
    function touchDown(event) {
        if (event.pointerType !== 'touch') return;
        touches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
        if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchDistance = a.distanceTo(b); pinchFov = camera.fov; }
    }
    function touchMove(event) {
        if (!touches.has(event.pointerId) || !isActive() || isDisposed()) return;
        touches.get(event.pointerId).set(event.clientX, event.clientY);
        if (touches.size === 2 && pinchDistance > 0) {
            const [a, b] = [...touches.values()]; lensZoom(pinchFov * pinchDistance / Math.max(1, a.distanceTo(b)));
        }
    }
    function touchEnd(event) { touches.delete(event.pointerId); if (touches.size !== 2) pinchDistance = 0; }
    const canvas = renderer.domElement;
    canvas.addEventListener('wheel', wheelZoom, { capture: true, passive: false });
    canvas.addEventListener('pointerdown', touchDown);
    canvas.addEventListener('pointermove', touchMove);
    canvas.addEventListener('pointerup', touchEnd);
    canvas.addEventListener('pointercancel', touchEnd);
    canvas.addEventListener('lostpointercapture', touchEnd);

    controls.addEventListener('change', requestRender);
    let seatOrder = [];
    let ownSeatId = null;
    let focusedSeatId = null;
    function focusSeat(id) {
        const seat = getSeatPosition(id);
        if (!seat) return;
        focusedSeatId = id;
        controls.enableRotate = true; controls.enablePan = true;
        controls.target.set(seat.x*.68,.1,seat.z*.68);
        camera.position.set(controls.target.x+seat.x*.5,9.5,controls.target.z+seat.z*.5);
        controls.update(); requestRender();
        onSeatFocus?.(seatOrder.find(player => player.uniqueId === id)?.name || 'ผู้เล่น');
    }
    function resetCamera() {
        lensZoom(43);
        focusedSeatId = null;
        controls.enableRotate = true; controls.enablePan = true;
        onSeatFocus?.('มุมของคุณ');
        camera.position.set(0, 17, 5.5);
        controls.target.set(0, 0.35, 0);
        controls.update();
        requestRender();
    }

    const pressedKeys = new Set();
    const movementKeys = new Set(['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','ControlLeft','ControlRight']);
    let keyboardLocked = false;
    let previousMovementTime = 0;
    function clearMovement() { pressedKeys.clear(); touches.clear(); pinchDistance = 0; previousMovementTime = 0; }
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
        controls.target.y=THREE.MathUtils.clamp(controls.target.y,-.4,8);
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
            controls.mouseButtons.LEFT=pan?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
            controls.touches.ONE=pan?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
            controls.touches.TWO=pan?THREE.TOUCH.DOLLY_ROTATE:THREE.TOUCH.DOLLY_PAN;
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
            controls.dispose();
        }
    };
}
