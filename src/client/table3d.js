import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = [0x526774, 0x795551, 0x88744e, 0x596b55, 0x716275, 0x8a806b,
    0x7e634e, 0x5c6974, 0x785d69, 0x727354, 0x56716d, 0x72675e];

function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function create({ container, onCard, onDraw, onPlayer, onLife, onEffect, onError, onInspect, onSeatFocus }) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'โต๊ะเกม 3D ลากเพื่อหมุน เลื่อนล้อเมาส์หรือใช้ปุ่มเพื่อซูม');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'โต๊ะ 3D ลากหมุน ลากสองนิ้วเพื่อเลื่อน WASD เคลื่อนกล้อง Space ขึ้น Q ลง');

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x110d0a, 20, 42);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = .65;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    controls.minPolarAngle = .05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;

    let seatOrder = [];
    let ownSeatId = null;
    let focusedSeatId = null;
    function focusSeat(id) {
        const seat = seatPositions.get(id);
        if (!seat) return;
        focusedSeatId = id;
        controls.enableRotate = true; controls.enablePan = true;
        controls.target.set(seat.x*.68,.1,seat.z*.68);
        camera.position.set(controls.target.x+seat.x*.5,9.5,controls.target.z+seat.z*.5);
        controls.update(); requestRender();
        onSeatFocus?.(seatOrder.find(player => player.uniqueId === id)?.name || 'ผู้เล่น');
    }
    function resetCamera() {
        focusedSeatId = null;
        controls.enableRotate = true; controls.enablePan = true;
        onSeatFocus?.('มุมของคุณ');
        camera.position.set(0, 17, 5.5);
        controls.target.set(0, 0.35, 0);
        controls.update();
        requestRender();
    }

    const ambient = new THREE.HemisphereLight(0xc0ceda, 0x302016, 1.25);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd9b0, 2.4);
    key.position.set(-4, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    key.shadow.normalBias = 0.035;
    scene.add(key);
    const candleLight = new THREE.PointLight(0xffa04c, 10, 9, 2);
    candleLight.position.set(0, 1.1, 0);
    scene.add(candleLight);
    const moonFill = new THREE.DirectionalLight(0x9bb8d4, 0.85);
    moonFill.position.set(5, 6, -6);
    scene.add(moonFill);
    key.shadow.bias = -0.0002;

    const wood = canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#593017'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 150; i++) {
            ctx.strokeStyle = i % 3 ? 'rgba(19,9,3,.12)' : 'rgba(205,127,62,.12)';
            ctx.lineWidth = 1 + i % 3;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 8) {
                const y = i * h / 150 + Math.sin(x * .025 + i) * 2;
                if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    });
    const back = canvasTexture(192, 288, (ctx, w, h) => {
        ctx.fillStyle = '#29170e'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#b87736'; ctx.lineWidth = 5; ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.lineWidth = 1; ctx.strokeRect(17, 17, w - 34, h - 34);
        ctx.strokeStyle = '#a3612e'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 38, 0, Math.PI * 2); ctx.stroke();
        ctx.font = 'bold 25px serif'; ctx.fillStyle = '#ce9956'; ctx.textAlign = 'center'; ctx.fillText('1996', w / 2, h / 2 + 9);
    });

    function mesh(geometry, material, parent, position) {
        const object = new THREE.Mesh(geometry, material);
        if (position) object.position.set(...position);
        object.castShadow = true;
        object.receiveShadow = true;
        parent.add(object);
        return object;
    }
    const tableMaterial = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.88 });
    mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.35, 80), tableMaterial, scene, [0, -0.2, 0]);
    const rim = mesh(new THREE.TorusGeometry(6.12, 0.12, 8, 96),
        new THREE.MeshStandardMaterial({ color: 0x331b0c, roughness: 0.7 }), scene, [0, 0.01, 0]);
    rim.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.02, 64),
        new THREE.MeshStandardMaterial({ color: 0x73401e, roughness: 1 }), scene, [0, 0.006, 0]);
    mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.11, 24),
        new THREE.MeshStandardMaterial({ color: 0xb17b27, metalness: 0.6, roughness: 0.4 }), scene, [0, 0.08, 0]);
    mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.65, 20),
        new THREE.MeshStandardMaterial({ color: 0xffe0a1, roughness: 0.9 }), scene, [0, 0.45, 0]);
    const flame = new THREE.Group(); flame.position.set(0,.79,0); scene.add(flame);
    const profile = [[0,0],[.032,.02],[.065,.09],[.047,.18],[.015,.27],[0,.34]].map(([r,y]) => new THREE.Vector2(r,y));
    const outerFlame = mesh(new THREE.LatheGeometry(profile,20),new THREE.MeshBasicMaterial({color:0xff8b26,transparent:true,opacity:.72,depthWrite:false,toneMapped:false}),flame,[0,0,0]);
    outerFlame.castShadow = outerFlame.receiveShadow = false;
    const innerFlame = mesh(new THREE.LatheGeometry(profile,16),new THREE.MeshBasicMaterial({color:0xffe5a0,toneMapped:false}),flame,[0,.008,0]);
    innerFlame.scale.set(.57,.72,.57); innerFlame.castShadow = innerFlame.receiveShadow = false;
    const core = mesh(new THREE.LatheGeometry(profile,12),new THREE.MeshBasicMaterial({color:0xfff6da,toneMapped:false}),flame,[0,.018,0]);
    core.scale.set(.3,.4,.3); core.castShadow = core.receiveShadow = false;
    mesh(new THREE.CylinderGeometry(.009,.012,.03,8),new THREE.MeshBasicMaterial({color:0x292019}),scene,[0,.787,0]);
    const flameGlowTexture = canvasTexture(64,96,(ctx,w,h) => {
        const glow = ctx.createRadialGradient(w/2,h/2,1,w/2,h/2,h/2);
        glow.addColorStop(0,'rgba(255,184,79,.35)'); glow.addColorStop(.4,'rgba(255,137,42,.12)'); glow.addColorStop(1,'rgba(255,137,42,0)');
        ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
    });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:flameGlowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    glow.position.set(0,.15,0); glow.scale.set(.33,.52,1); flame.add(glow);
    mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .22 }),
        scene, [0, -0.4, 0]).rotation.x = -Math.PI / 2;

    const dynamic = new THREE.Group();
    scene.add(dynamic);
    const textures = new Map();
    const loader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let targets = [];
    let signature = '';
    let active = false;
    let disposed = false;
    let renderFrame = 0;
    let flameTimer;
    let ritualActive = false;
    let candleBaseIntensity = 10;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function tickFlame() {
        if (!active || disposed || reducedMotion.matches) return;
        requestRender(); flameTimer = setTimeout(tickFlame, 65);
    }
    let down = null;
    let moved = false;
    let holdTimer;
    let inspected = false;
    const seatPositions = new Map();
    let feedbackImageFor;
    const flights = [];
    const gunShots = [];
    function removeGunShot(shot) {
        scene.remove(shot.group);
        shot.group.traverse(part => { part.geometry?.dispose(); part.material?.dispose(); });
    }
    const cardFlightDuration = 1400;
    const cardArrivalPause = 550;
    function stopFlight() {
        gunShots.forEach(removeGunShot); gunShots.length = 0;
        for (const flight of flights) { scene.remove(flight.mesh); flight.mesh.geometry.dispose(); flight.mesh.material.dispose(); }
        flights.length = 0;
    }
    function addFlight(from, to, texture = back, delay = 0, hold = 250) {
        if (!active || disposed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(.65,.95), new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
        face.quaternion.copy(camera.quaternion); face.position.copy(from); face.visible = false; scene.add(face);
        flights.push({mesh:face,from:from.clone(),to:to.clone(),started:performance.now()+delay,hold}); requestRender();
    }

    function requestRender() {
        if (!active || disposed || renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
            renderFrame = 0;
            controls.update();
            const now = performance.now();
            moveCamera(now);
            if (!reducedMotion.matches) {
                const time = now * .001;
                flame.scale.set(1+Math.sin(time*5)*.04,1+Math.sin(time*7)*.07,1);
                flame.rotation.z = Math.sin(time*4)*.045;
                flame.position.x = Math.sin(time*4)*.018;
                const ritualPulse = ritualActive ? (Math.sin(time * Math.PI * 2) + 1) * 2 : 0;
                candleLight.intensity = candleBaseIntensity + Math.sin(time*6)*.45 + ritualPulse;
                if (ritualActive) flame.scale.multiplyScalar(1 + ritualPulse * .035);
            }
            for (let index=flights.length-1;index>=0;index--) {
                const flight = flights[index];
                if (now < flight.started) continue;
                const elapsed = now-flight.started;
                const t = Math.min(1,elapsed/(flight.duration || cardFlightDuration));
                const eased = t*t*(3-2*t);
                flight.mesh.visible = true;
                flight.mesh.position.lerpVectors(flight.from,flight.to,eased);
                flight.mesh.position.y += Math.sin(Math.PI*t)*(flight.arc ?? 1.2);
                if (elapsed >= (flight.duration || cardFlightDuration)+flight.hold) { scene.remove(flight.mesh); flight.mesh.geometry.dispose(); flight.mesh.material.dispose(); flights.splice(index,1); }
            }
            for (let index = gunShots.length - 1; index >= 0; index--) {
                const shot = gunShots[index];
                const elapsed = now - shot.started;
                const lift = Math.min(1, elapsed / shot.raiseDuration);
                shot.gun.position.copy(shot.from);
                shot.gun.position.y += -.45 + .45 * lift * lift * (3 - 2 * lift);
                shot.gun.lookAt(shot.to);
                shot.gun.rotateX((1 - lift) * .8);
                const travel = Math.max(0, Math.min(1, (elapsed - shot.raiseDuration) / shot.bulletDuration));
                shot.bullet.visible = elapsed >= shot.raiseDuration;
                shot.bullet.position.lerpVectors(shot.muzzle, shot.to, travel);
                shot.flash.visible = elapsed >= shot.raiseDuration && elapsed < shot.raiseDuration + 130;
                if (elapsed >= shot.raiseDuration) {
                    const recoil = Math.max(0, 1 - (elapsed - shot.raiseDuration) / 260);
                    shot.gun.translateZ(-recoil * .12);
                }
                if (elapsed >= shot.raiseDuration + shot.bulletDuration) { removeGunShot(shot); gunShots.splice(index, 1); }
            }
            renderer.render(scene, camera);
            if (flights.length || gunShots.length || pressedKeys.size) requestRender();
        });
    }
    controls.addEventListener('change', requestRender);
    const pressedKeys = new Set();
    const movementKeys = new Set(['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','ControlLeft','ControlRight']);
    let keyboardLocked = false;
    let previousMovementTime = 0;
    function clearMovement() { pressedKeys.clear(); previousMovementTime = 0; }
    function typing(target) { return !!target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'); }
    function keyDown(event) {
        const ctrlEnabled = keyboardLocked && !!document.fullscreenElement;
        if ((event.ctrlKey && !ctrlEnabled) || event.altKey || event.metaKey) { clearMovement(); return; }
        if (event.code.startsWith('Control') && !ctrlEnabled) return;
        if (!active || disposed || document.hidden || !movementKeys.has(event.code) || typing(event.target)) return;
        if (document.querySelector('#card-inspect-overlay:not([hidden])')) return;
        if (event.code === 'Space' && event.target?.closest?.('button, summary, a')) return;
        event.preventDefault();
        if (!pressedKeys.size) previousMovementTime = performance.now();
        pressedKeys.add(event.code); requestRender();
    }
    function keyUp(event) { pressedKeys.delete(event.code); if (!pressedKeys.size) previousMovementTime = 0; }
    function focusChanged(event) { if (typing(event.target) || document.querySelector('#card-inspect-overlay:not([hidden])')) clearMovement(); }
    function visibilityChanged() { if (document.hidden) clearMovement(); }
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

    function cardTexture(url) {
        if (!url) return back;
        if (!textures.has(url)) {
            const texture = loader.load(url, requestRender, undefined, () => { textures.delete(url); });
            texture.colorSpace = THREE.SRGBColorSpace;
            textures.set(url, texture);
        }
        return textures.get(url) || back;
    }

    function card(parent, position, rotation, texture, data, size = 0.58) {
        const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.86 });
        const face = mesh(new THREE.PlaneGeometry(size, size * 1.48), material, parent, position);
        face.rotation.set(...rotation);
        face.userData = data;
        targets.push(face);
        const categoryColor = { Red: 0xc94d45, Green: 0x549560, Blue: 0x4a8dc0, Black: 0x77716b }[data.category];
        if (categoryColor !== undefined) {
            const border = new THREE.LineSegments(new THREE.EdgesGeometry(face.geometry),
                new THREE.LineBasicMaterial({ color: categoryColor, toneMapped: false }));
            border.position.z = 0.002;
            face.add(border);
        }
        return face;
    }

    function label(parent, text, position, color = '#eddbb7') {
        const font = 'bold 32px "Noto Serif Thai", sans-serif';
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = font;
        const width = Math.ceil(Math.min(420, Math.max(76, measure.measureText(text).width + 28)));
        const height = 62;
        const texture = canvasTexture(width, height, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(19,15,12,.86)';
            ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 12); ctx.fill();
            ctx.font = font; ctx.fillStyle = color;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, w / 2, h / 2, w - 28);
        });
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
        sprite.userData.disposableTexture = texture;
        sprite.position.set(...position);
        sprite.scale.set(width / height * 0.23, 0.23, 1);
        parent.add(sprite);
        return sprite;
    }

    function clearDynamic() {
        dynamic.traverse(object => {
            if (!object.userData.sharedGeometry) object.geometry?.dispose();
            if (object.material) object.material.dispose();
            object.userData.disposableTexture?.dispose();
        });
        dynamic.clear();
        targets = [];
    }

    function update({ state, me, hand, selected, imageFor, interaction = null, canDraw = false, drawConfirming = false, handLowered = false, artwork = 'new' }) {
        if (!state) return;
        const nextSignature = JSON.stringify([state.currentPhase, state.awaitingLeftTryalSelections, state.playerForcedToRevealTryal, state.players, state.currentTurnPlayerUniqueId, state.deckCount, state.discardPileCount, state.witchNightState, hand, selected, me, interaction, canDraw, drawConfirming, handLowered, artwork]);
        if (signature === nextSignature) return;
        signature = nextSignature;
        const night = state.currentPhase === 'NIGHT';
        ritualActive = state.currentPhase === 'BLACKCAT_TRYAL' || !!state.awaitingLeftTryalSelections;
        const choosingLife = ritualActive || !!state.playerForcedToRevealTryal || state.currentPhase === 'PRE_DAWN' || interaction?.kind === 'life';
        ambient.intensity = choosingLife ? 1.8 : 1.25;
        key.intensity = choosingLife ? 3 : 2.4;
        candleBaseIntensity = choosingLife ? 12 : 10;
        candleLight.intensity = candleBaseIntensity;
        outerFlame.material.color.set(night ? 0xe82028 : 0xff8b26);
        innerFlame.material.color.set(night ? 0xff5750 : 0xffe5a0);
        core.material.color.set(night ? 0xffb5a3 : 0xfff6da);
        glow.material.color.set(night ? 0xff3028 : 0xffffff);
        candleLight.color.set(night ? 0xff3038 : 0xffa04c);
        clearDynamic();
        seatPositions.clear(); feedbackImageFor = imageFor;
        const players = Object.values(state.players || {});
        seatOrder = players; ownSeatId = me;
        const ownIndex = players.findIndex(player => player.uniqueId === me);
        function outline(face, color = 0xc2ab87) {
            const edge = new THREE.LineSegments(new THREE.EdgesGeometry(face.geometry), new THREE.LineBasicMaterial({ color }));
            face.add(edge);
        }
        const lifeBorder = name => name === 'Witch' ? 0xffe066 : name === 'Constable' ? 0xe0e0e0 : 0x666666;
        players.forEach((player, index) => {
            const angle = (index - Math.max(0, ownIndex)) * Math.PI * 2 / Math.max(1, players.length);
            const seat = new THREE.Group();
            seat.position.set(Math.sin(angle) * 4.65, 0.05, Math.cos(angle) * 4.65);
            seat.rotation.y = angle;
            seatPositions.set(player.uniqueId, seat.position.clone().setY(1.3));
            dynamic.add(seat);
            const material = new THREE.MeshStandardMaterial({ color: player.alive ? new THREE.Color(COLORS[index % COLORS.length]).multiplyScalar(.55) : 0x302d29, roughness: 0.6 });
            const pawn = new THREE.Group(); pawn.position.z = 2.05; pawn.position.y = -.1; seat.add(pawn);
            pawn.scale.setScalar(1.4);
            if (!player.alive) { pawn.rotation.z = Math.PI / 2; pawn.position.y = 0.2; }
            const parts = [
                mesh(new THREE.CylinderGeometry(.20,.25,.42,16),material.clone(),pawn,[0,.25,0]),
                mesh(new THREE.SphereGeometry(.17,16,12),material.clone(),pawn,[0,.63,0]),
                mesh(new THREE.CapsuleGeometry(.075,.28,4,10),material.clone(),pawn,[-.29,.25,0]),
                mesh(new THREE.CapsuleGeometry(.075,.28,4,10),material.clone(),pawn,[.29,.25,0]),
            ];
            parts.forEach(part => { part.userData = { ...part.userData, playerId: player.uniqueId }; targets.push(part); });
            const eligibleTarget = interaction?.kind === 'player' && interaction.eligible.includes(player.uniqueId);
            const selectedTarget = eligibleTarget && interaction.selected.includes(player.uniqueId);
            if (eligibleTarget) parts.forEach(part => {
                part.material.emissive.set(selectedTarget ? 0xb47e34 : 0x597b70);
                part.material.emissiveIntensity = selectedTarget ? .9 : .55;
            });
            const nameLabel = label(seat, `${selectedTarget ? '✓ ' : ''}${player.name}${player.uniqueId === me ? ' (คุณ)' : ''}${state.players?.[me]?.hasBeenWitch && player.hasBeenWitch ? ' · ทีมปอบ' : ''}${!player.alive ? ' · เสียชีวิต' : ''}`, [0, 1.3, 2.05],
                eligibleTarget ? selectedTarget ? '#ffe1a0' : '#a9e0c9' : player.alive ? '#eddbb7' : '#a39b91');
            nameLabel.userData.playerId = player.uniqueId;
            targets.push(nameLabel);
            if (interaction?.kind === 'player') {
                const eligible = interaction.eligible.includes(player.uniqueId);
                const picked = interaction.selected.includes(player.uniqueId);
                label(seat, picked ? '✓ เลือกแล้ว' : eligible ? interaction.outcomes?.[player.uniqueId] || 'แตะเพื่อเลือก' : interaction.blocked?.[player.uniqueId] || 'เลือกไม่ได้', [0, 2.15, 0], eligible ? '#d8c4a0' : '#ad9c8c');
            }
            const witchNight = state.witchNightState;
            if (witchNight && !witchNight.committed) {
                const memberNames = new Map((witchNight.members || []).map(member => [member.uniqueId, member.name]));
                const markedBy = Object.entries(witchNight.marks || {})
                    .filter(([id, target]) => target === player.uniqueId && memberNames.has(id))
                    .map(([id]) => memberNames.get(id));
                if (markedBy.length) {
                    label(seat, `มาร์ค: ${markedBy.join(', ')}`, [0, 1.85, 0], '#ff9999');
                }
            }
            const lives = Number(player.tryalCardCount) || 0;
            if (interaction?.owner === player.uniqueId) {
                label(seat, interaction.kind === 'life' ? 'เลือกการ์ดชีวิต 1 ใบ' : 'เลือกการ์ดที่วางอยู่', [0, 2.15, 0], '#d8c4a0');
            }
            for (let life = 0; life < lives; life++) {
                const revealedName = player.tryalCards?.[life]?.name;
                const lifeCard = card(seat, [(life - (lives - 1) / 2) * .42, .06, -.98], [-Math.PI / 2, 0, 0],
                    revealedName ? cardTexture(imageFor(revealedName)) : back, { playerId: player.uniqueId, lifeIndex: life }, .38);
                outline(lifeCard, revealedName ? lifeBorder(revealedName) : 0x8d7658);
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) outline(lifeCard, interaction.selected?.includes(life) ? 0xffd359 : 0xc2ab87);
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) {
                    label(seat, `${interaction.selected?.includes(life) ? '✓ ' : ''}${life + 1}`, [(life - (lives - 1) / 2) * .42, .24, -.98], '#ffe2a0');
                }
            }
            const revealed = player.revealedTryalCards || [];
            revealed.forEach((revealedCard, i) => {
                const face = card(seat, [(i-(revealed.length-1)/2)*.42, .075, -.38], [-Math.PI/2,0,0],
                    cardTexture(imageFor(revealedCard.name)), { playerId: player.uniqueId, revealedIndex: i }, .38);
                outline(face,lifeBorder(revealedCard.name));
            });
            if (revealed.length) label(seat, 'เปิดแล้ว', [0,.3,-.38], '#cbb58b');
            const own = player.uniqueId === me;
            const count = interaction?.kind === 'life' ? 0 : own ? hand.length : Number(player.handSize) || 0;
            // Own hand uses separate rows so every title remains visible.
            const columns = own ? Math.min(6, count) : count;
            const spacing = own ? .61 : Math.min(.43, 2.4 / Math.max(1, count));
            for (let i = 0; i < count; i++) {
                const row = own ? Math.floor(i / Math.max(1, columns)) : 0;
                const rowCount = Math.min(columns, count - row * columns);
                const offset = (own ? i % columns : i) - (rowCount - 1) / 2;
                const lowered = handLowered;
                const position = lowered ? [offset * spacing, .08 + (own && selected === i ? .12 : 0), .38 + row * .88 + Math.abs(offset) * .025]
                    : [offset * spacing, 1 + row * .98 + (own && selected === i ? .16 : 0), .7 + Math.abs(offset) * .025];
                const rotation = lowered ? [-Math.PI / 2, 0, 0] : [-.12, 0, own ? 0 : -offset * Math.min(.045, .35 / Math.max(1, count))];
                const face = card(seat, position, rotation,
                    own ? cardTexture(imageFor(hand[i].name)) : back,
                    own ? { cardIndex: i, category: hand[i].color } : { playerId: player.uniqueId }, own ? .56 : .47);
                if (own && selected === i) face.material.color.set(0xb9a687);
            }
            // Public effects form a row toward the table centre, above life cards.
            const effects = player.inPlayCards || [];
            const effectSpacing = Math.min(.43, 2.1 / Math.max(1, effects.length));
            effects.forEach((effect, i) => {
                const effectCard = card(seat, [(i - (effects.length - 1) / 2) * effectSpacing, .08 + i * .002, -1.75],
                    [-Math.PI / 2, 0, 0], cardTexture(imageFor(effect.name)), { playerId: player.uniqueId, effectIndex: i, category: effect.color }, .4);
                if (interaction?.kind === 'effect' && interaction.owner === player.uniqueId && interaction.eligible.includes(i)) outline(effectCard, interaction.selected.includes(i) ? 0x879277 : 0xc2ab87);
            });
        });

        function pile(x, count, title, clickable) {
            const height = Math.max(.04, Math.min(.52, count * .01));
            const box = mesh(new THREE.BoxGeometry(.75, height, 1.1), new THREE.MeshStandardMaterial({ color: 0x9e8764 }), dynamic, [x, height / 2 + .04, 0]);
            const top = card(dynamic, [x, height + .045, 0], [-Math.PI / 2, 0, 0], back, { draw: clickable }, .74);
            if (clickable && canDraw) {
                box.material.emissive.set(0xe9a63b);
                box.material.emissiveIntensity = 0.65;
                top.material.emissive.set(0xe9a63b);
                top.material.emissiveIntensity = 0.35;
                const halo = mesh(new THREE.RingGeometry(.66, .78, 48),
                    new THREE.MeshBasicMaterial({ color: 0xffcf72, transparent: true, opacity: .65, side: THREE.DoubleSide }), dynamic, [x, .035, 0]);
                halo.rotation.x = -Math.PI / 2;
                label(dynamic, drawConfirming ? 'แตะอีกครั้งเพื่อจั่ว' : 'แตะเพื่อจั่ว 2 ใบ', [x, 1.05, 0], '#ffdd95');
            }
            box.userData = top.userData;
            if (clickable) targets.push(box);
            label(dynamic, `${title} ${count}`, [x, .65, -.7]);
        }
        pile(-1.2, state.deckCount || 0, 'จั่ว', true);
        pile(1.2, state.discardPileCount || 0, 'ทิ้ง', false);
        requestRender();
    }

    function pointerDown(event) {
        if (event.button === 0) renderer.domElement.focus({ preventScroll: true });
        if (!event.isPrimary) { down = null; return; }
        down = { x: event.clientX, y: event.clientY, id: event.pointerId }; moved = false; inspected = false;
        clearTimeout(holdTimer);
        if (event.button === 0 && event.pointerType !== 'mouse') holdTimer = setTimeout(() => {
            if (down && !moved) { inspected = true; inspectAt(event.clientX, event.clientY); }
        }, 550);
    }
    function pointerMove(event) { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) { moved = true; clearTimeout(holdTimer); } }
    function pointerUp(event) {
        clearTimeout(holdTimer);
        if (inspected || event.button !== 0) { down = null; return; }
        if (!down || moved || event.pointerId !== down.id) { down = null; return; }
        down = null;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(targets, false)[0];
        if (!hit) return;
        const data = hit.object.userData;
        if (Number.isInteger(data.cardIndex)) onCard(data.cardIndex);
        else if (data.draw) onDraw();
        else if (Number.isInteger(data.revealedIndex)) onInspect?.(data);
        else if (Number.isInteger(data.lifeIndex) && onLife) onLife(data.playerId, data.lifeIndex);
        else if (Number.isInteger(data.effectIndex) && onEffect) onEffect(data.playerId, data.effectIndex);
        else if (data.playerId) onPlayer(data.playerId);
    }
    function inspectAt(x, y) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set((x-rect.left)/rect.width*2-1, -(y-rect.top)/rect.height*2+1);
        raycaster.setFromCamera(pointer,camera);
        const hit = raycaster.intersectObjects(targets,false)[0];
        if (hit) onInspect?.(hit.object.userData);
    }
    renderer.domElement.addEventListener('contextmenu', event => { event.preventDefault(); inspectAt(event.clientX,event.clientY); });
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', () => { down = null; clearTimeout(holdTimer); });
    renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        onError('อุปกรณ์หยุดแสดงภาพ 3D กรุณาสลับกลับ 2D');
    });

    let canvasWidth = 0, canvasHeight = 0;
    function resize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height || (width === canvasWidth && height === canvasHeight)) return;
        canvasWidth = width; canvasHeight = height;
        container.parentElement.style.setProperty('--table3d-canvas-height', `${height}px`);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        requestRender();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resetCamera();
    return {
        update,
        setActive(value) {
            if (active === value) return;
            active = value; controls.enabled = value;
            if (value) { resize(); requestRender(); clearTimeout(flameTimer); tickFlame(); }
            else { clearMovement(); clearTimeout(flameTimer); cancelAnimationFrame(renderFrame); renderFrame = 0; }
        },
        resetCamera,
        animateShot(event) {
            if (!active || disposed || reducedMotion.matches) return;
            const from = seatPositions.get(event.actorId)?.clone();
            const to = seatPositions.get(event.targetId)?.clone();
            if (!from || !to) return;
            from.multiplyScalar(1.35).setY(.9); to.multiplyScalar(1.35).setY(.7);
            const direction = to.clone().sub(from).normalize();
            const side = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0,1,0)).normalize();
            from.addScaledVector(side, .32);
            const group = new THREE.Group(); scene.add(group);
            const gun = new THREE.Group(); group.add(gun); gun.position.copy(from); gun.lookAt(to);
            mesh(new THREE.BoxGeometry(.14,.17,.4), new THREE.MeshStandardMaterial({color:0x302b25,metalness:.8,roughness:.3}),gun,[0,0,.12]);
            mesh(new THREE.BoxGeometry(.09,.09,.38), new THREE.MeshStandardMaterial({color:0xb99346,metalness:.85,roughness:.25}),gun,[0,.025,.43]);
            mesh(new THREE.BoxGeometry(.1,.26,.14), new THREE.MeshStandardMaterial({color:0x211913,roughness:.8}),gun,[0,-.17,.02]);
            const flash = mesh(new THREE.SphereGeometry(.16,8,6), new THREE.MeshBasicMaterial({color:0xffe6a1,toneMapped:false}),gun,[0,.025,.66]);
            flash.visible = false;
            const muzzle = new THREE.Vector3(0,.025,.66).applyQuaternion(gun.quaternion).add(from);
            const bullet = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }));
            bullet.visible = false; group.add(bullet);
            gunShots.push({ group, gun, flash, bullet, from, to, muzzle, started: performance.now(), raiseDuration: event.raiseDuration || 900, bulletDuration: event.bulletDuration || 4200 });
            requestRender();
        },
        setKeyboardLocked(locked) { keyboardLocked = !!locked; clearMovement(); },
        stepSeat(direction) {
            if (!seatOrder.length) return;
            const current = seatOrder.findIndex(player => player.uniqueId === (focusedSeatId || ownSeatId));
            const index = (Math.max(0,current)+direction+seatOrder.length)%seatOrder.length;
            focusSeat(seatOrder[index].uniqueId);
        },
        animateCard(event) {
            const actor = seatPositions.get(event.actorId), target = seatPositions.get(event.targetId);
            const from = actor?.clone().multiplyScalar(1.15).setY(1);
            const to = target ? target.clone().multiplyScalar(.63).setY(.18) : new THREE.Vector3(0,1.1,0);
            if (!from || !feedbackImageFor) return;
            const texture = cardTexture(feedbackImageFor(event.cardName));
            addFlight(from,to,texture,0,cardArrivalPause);
            if (event.discard) addFlight(to,new THREE.Vector3(1.2,.3,0),texture,cardFlightDuration+cardArrivalPause);
        },
        animateMovement(event) {
            if (event.kind === 'draw') {
                const to = seatPositions.get(event.targetId);
                if (to) addFlight(new THREE.Vector3(-1.2,.4,0),to.clone().multiplyScalar(1.15).setY(1),back,event.delay || 0);
            } else if (event.kind === 'conspiracy') {
                for (const route of event.routes || []) {
                    const from = seatPositions.get(route.actorId), to = seatPositions.get(route.targetId);
                    if (from && to) addFlight(from.clone().multiplyScalar(.79).setY(.18),to.clone().multiplyScalar(.79).setY(.18),back);
                }
            }
        },
        setCameraView(view) {
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
            const offset = camera.position.clone().sub(controls.target);
            offset.multiplyScalar(direction === 'in' ? .86 : 1.16);
            offset.setLength(THREE.MathUtils.clamp(offset.length(), controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset);
            controls.update(); requestRender();
        },
        dispose() {
            clearMovement();
            document.removeEventListener('keydown',keyDown);
            document.removeEventListener('keyup',keyUp);
            document.removeEventListener('focusin',focusChanged);
            document.removeEventListener('visibilitychange',visibilityChanged);
            window.removeEventListener('blur',clearMovement);
            disposed = true; clearTimeout(holdTimer); clearTimeout(flameTimer); stopFlight();
            cancelAnimationFrame(renderFrame);
            resizeObserver.disconnect(); controls.dispose(); clearDynamic();
            scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
            flameGlowTexture.dispose(); wood.dispose(); back.dispose(); textures.forEach(texture => texture.dispose());
            renderer.dispose(); renderer.domElement.remove();
        },
    };
}

window.VillageTable3D = { create };
