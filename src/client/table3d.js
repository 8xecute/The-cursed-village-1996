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

function create({ container, onCard, onDraw, onPlayer, onLife, onEffect, onError, onInspect }) {
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
        controls.enableRotate = false; controls.enablePan = false;
        controls.target.set(seat.x*.68,.1,seat.z*.68);
        camera.position.set(controls.target.x+seat.x*.5,9.5,controls.target.z+seat.z*.5);
        controls.update(); requestRender();
        onSeatFocus?.(seatOrder.find(player => player.uniqueId === id)?.name || 'ผู้เล่น');
    }
    function resetCamera() {
        focusedSeatId = null;
        controls.enableRotate = true; controls.enablePan = true;
        onSeatFocus?.('มุมของคุณ');
        camera.position.set(0, 11, 14.5);
        controls.target.set(0, 0.35, 0);
        controls.update();
        requestRender();
    }

    scene.add(new THREE.HemisphereLight(0xc0ceda, 0x302016, 1.25));
    const key = new THREE.DirectionalLight(0xffd9b0, 2.4);
    key.position.set(-4, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    key.shadow.normalBias = 0.035;
    scene.add(key);
    const candleLight = new THREE.PointLight(0xff8f32, 15, 9, 2);
    candleLight.position.set(0, 1.6, 0);
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
    const flame = mesh(new THREE.SphereGeometry(0.13, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc34b }), scene, [0, 0.92, 0]);
    flame.scale.set(0.7, 1.9, 0.7);
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
    function stopFlight() {
        for (const flight of flights) { scene.remove(flight.mesh); flight.mesh.geometry.dispose(); flight.mesh.material.dispose(); }
        flights.length = 0;
    }
    function addFlight(from, to, texture = back, delay = 0) {
        if (!active || disposed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(.65,.95), new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
        face.quaternion.copy(camera.quaternion); face.position.copy(from); face.visible = false; scene.add(face);
        flights.push({mesh:face,from:from.clone(),to:to.clone(),started:performance.now()+delay}); requestRender();
    }

    function requestRender() {
        if (!active || disposed || renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
            renderFrame = 0;
            controls.update();
            const now = performance.now();
            if (!reducedMotion.matches) {
                const time = now * .001;
                flame.scale.set(.7 + Math.sin(time*5)*.035, 1.9 + Math.sin(time*7)*.12, .7);
                flame.position.x = Math.sin(time*4)*.018;
                candleLight.intensity = 15 + Math.sin(time*6)*.65;
            }
            for (let index=flights.length-1;index>=0;index--) {
                const flight = flights[index];
                if (now < flight.started) continue;
                const t = Math.min(1,(now-flight.started)/650);
                flight.mesh.visible = true;
                flight.mesh.position.lerpVectors(flight.from,flight.to,t);
                flight.mesh.position.y += Math.sin(Math.PI*t)*1.2;
                if (t === 1) { scene.remove(flight.mesh); flight.mesh.geometry.dispose(); flight.mesh.material.dispose(); flights.splice(index,1); }
            }
            renderer.render(scene, camera);
            if (flights.length) requestRender();
        });
    }
    controls.addEventListener('change', requestRender);

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
    }

    function clearDynamic() {
        dynamic.traverse(object => {
            object.geometry?.dispose();
            if (object.material) object.material.dispose();
            object.userData.disposableTexture?.dispose();
        });
        dynamic.clear();
        targets = [];
    }

    function update({ state, me, hand, selected, imageFor, interaction = null, canDraw = false, drawConfirming = false, handLowered = false, artwork = 'new' }) {
        if (!state) return;
        const nextSignature = JSON.stringify([state.players, state.currentTurnPlayerUniqueId, state.deckCount, state.discardPileCount, state.witchNightState, hand, selected, me, interaction, canDraw, drawConfirming, handLowered, artwork]);
        if (signature === nextSignature) return;
        signature = nextSignature;
        clearDynamic();
        seatPositions.clear(); feedbackImageFor = imageFor;
        const players = Object.values(state.players || {});
        seatOrder = players; ownSeatId = me;
        const ownIndex = players.findIndex(player => player.uniqueId === me);
        function outline(face, color = 0xc2ab87) {
            const edge = new THREE.LineSegments(new THREE.EdgesGeometry(face.geometry), new THREE.LineBasicMaterial({ color }));
            face.add(edge);
        }
        players.forEach((player, index) => {
            const angle = (index - Math.max(0, ownIndex)) * Math.PI * 2 / Math.max(1, players.length);
            const seat = new THREE.Group();
            seat.position.set(Math.sin(angle) * 4.65, 0.05, Math.cos(angle) * 4.65);
            seat.rotation.y = angle;
            seatPositions.set(player.uniqueId, seat.position.clone().setY(1.3));
            dynamic.add(seat);
            const material = new THREE.MeshStandardMaterial({ color: player.alive ? COLORS[index % COLORS.length] : 0x48423c, roughness: 0.6 });
            const pawn = new THREE.Group(); pawn.position.z = 2.05; pawn.position.y = -.1; seat.add(pawn);
            if (!player.alive) { pawn.rotation.z = Math.PI / 2; pawn.position.y = 0.2; }
            const parts = [
                mesh(new THREE.CylinderGeometry(.20,.25,.42,16),material.clone(),pawn,[0,.25,0]),
                mesh(new THREE.SphereGeometry(.18,16,12),material.clone(),pawn,[0,.63,0]),
                mesh(new THREE.CapsuleGeometry(.075,.28,4,10),material.clone(),pawn,[-.29,.25,0]),
                mesh(new THREE.CapsuleGeometry(.075,.28,4,10),material.clone(),pawn,[.29,.25,0]),
            ];
            parts.forEach(part => { part.userData = { playerId: player.uniqueId }; targets.push(part); });
            if (state.currentTurnPlayerUniqueId === player.uniqueId && player.alive) {
                const ring = mesh(new THREE.TorusGeometry(.52, .045, 8, 40),
                    new THREE.MeshBasicMaterial({ color: 0xffd359 }), seat, [0, .07, 0]);
                ring.rotation.x = Math.PI / 2;
            }
            label(seat, `${player.name}${player.uniqueId === me ? ' (คุณ)' : ''}${state.players?.[me]?.hasBeenWitch && player.hasBeenWitch ? ' · ทีมปอบ' : ''}${!player.alive ? ' · เสียชีวิต' : ''}`, [0, 1.45, 0],
                player.alive ? '#eddbb7' : '#a39b91');
            if (interaction?.kind === 'player') {
                const eligible = interaction.eligible.includes(player.uniqueId);
                const picked = interaction.selected.includes(player.uniqueId);
                label(seat, picked ? '✓ เลือกแล้ว' : eligible ? interaction.outcomes?.[player.uniqueId] || 'แตะเพื่อเลือก' : interaction.blocked?.[player.uniqueId] || 'เลือกไม่ได้', [0, 2.15, 0], eligible ? '#d8c4a0' : '#ad9c8c');
                if (eligible) {
                    const marker = mesh(new THREE.TorusGeometry(.58, .025, 6, 32), new THREE.MeshBasicMaterial({ color: picked ? 0xc2ab87 : 0x879277 }), seat, [0, .09, 0]);
                    marker.rotation.x = Math.PI / 2;
                }
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
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) outline(lifeCard, interaction.selected?.includes(life) ? 0xffd359 : 0xc2ab87);
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) {
                    label(seat, `${interaction.selected?.includes(life) ? '✓ ' : ''}${life + 1}`, [(life - (lives - 1) / 2) * .42, .24, -.98], '#ffe2a0');
                }
            }
            const revealed = player.revealedTryalCards || [];
            revealed.forEach((revealedCard, i) => {
                const face = card(seat, [(i-(revealed.length-1)/2)*.42, .075, -.38], [-Math.PI/2,0,0],
                    cardTexture(imageFor(revealedCard.name)), { playerId: player.uniqueId, revealedIndex: i }, .38);
                outline(face,0xb69a6b);
            });
            if (revealed.length) label(seat, 'เปิดแล้ว', [0,.3,-.38], '#cbb58b');
            const own = player.uniqueId === me;
            const count = own ? hand.length : Number(player.handSize) || 0;
            // All cards stay selectable; compress the fan for larger hands.
            const spacing = Math.min(.43, 2.4 / Math.max(1, count));
            for (let i = 0; i < count; i++) {
                const offset = i - (count - 1) / 2;
                const lowered = handLowered;
                const position = lowered ? [offset * spacing, .08 + (own && selected === i ? .12 : 0), 1.35 + Math.abs(offset) * .025]
                    : [offset * spacing, 1 + (own && selected === i ? .24 : 0), .7 + Math.abs(offset) * .025];
                const rotation = lowered ? [-Math.PI / 2, 0, 0] : [-.12, 0, -offset * Math.min(.045, .35 / Math.max(1, count))];
                const face = card(seat, position, rotation,
                    own ? cardTexture(imageFor(hand[i].name)) : back,
                    own ? { cardIndex: i, category: hand[i].color } : { playerId: player.uniqueId }, own ? (lowered ? .52 : .68) : .47);
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
            else { clearTimeout(flameTimer); cancelAnimationFrame(renderFrame); renderFrame = 0; }
        },
        resetCamera,
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
            addFlight(from,to,texture);
            if (event.discard) addFlight(to,new THREE.Vector3(1.2,.3,0),texture,650);
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
            disposed = true; clearTimeout(holdTimer); clearTimeout(flameTimer); stopFlight();
            cancelAnimationFrame(renderFrame);
            resizeObserver.disconnect(); controls.dispose(); clearDynamic();
            scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
            wood.dispose(); back.dispose(); textures.forEach(texture => texture.dispose());
            renderer.dispose(); renderer.domElement.remove();
        },
    };
}

window.VillageTable3D = { create };
