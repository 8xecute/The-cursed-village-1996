import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = [0x357a9b, 0xb94742, 0xd39430, 0x46804b, 0x865a9e, 0xb0a17d,
    0xa26336, 0x607a91, 0xa34670, 0x798448, 0x508b85, 0x7b6b60];

function canvasTexture(width, height, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function create({ container, onCard, onDraw, onPlayer, onError }) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'โต๊ะเกม 3D ลากเพื่อหมุน เลื่อนล้อเมาส์หรือใช้ปุ่มเพื่อซูม');
    renderer.domElement.setAttribute('role', 'img');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x110d0a);
    scene.fog = new THREE.Fog(0x110d0a, 20, 42);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 7;
    controls.maxDistance = 23;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.8;

    function resetCamera() {
        camera.position.set(0, 9.5, 12.8);
        controls.target.set(0, 0.35, 0);
        controls.update();
        requestRender();
    }

    scene.add(new THREE.HemisphereLight(0xe7c5a3, 0x261811, 2.1));
    const key = new THREE.DirectionalLight(0xffd2a1, 3.4);
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
    mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x160f0b, roughness: 1 }),
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
    let down = null;
    let moved = false;

    function requestRender() {
        if (!active || disposed || renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
            renderFrame = 0;
            controls.update();
            renderer.render(scene, camera);
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

    function update({ state, me, hand, selected, imageFor }) {
        if (!state) return;
        const nextSignature = JSON.stringify([state.players, state.currentTurnPlayerUniqueId, state.deckCount, state.discardPileCount, state.witchNightState, hand, selected, me]);
        if (signature === nextSignature) return;
        signature = nextSignature;
        clearDynamic();
        const players = Object.values(state.players || {});
        const ownIndex = players.findIndex(player => player.uniqueId === me);
        players.forEach((player, index) => {
            const angle = (index - Math.max(0, ownIndex)) * Math.PI * 2 / Math.max(1, players.length);
            const seat = new THREE.Group();
            seat.position.set(Math.sin(angle) * 4.65, 0.05, Math.cos(angle) * 4.65);
            seat.rotation.y = angle;
            dynamic.add(seat);
            const material = new THREE.MeshStandardMaterial({ color: player.alive ? COLORS[index % COLORS.length] : 0x48423c, roughness: 0.6 });
            const pawn = new THREE.Group(); seat.add(pawn);
            if (!player.alive) { pawn.rotation.z = Math.PI / 2; pawn.position.y = 0.2; }
            const parts = [
                mesh(new THREE.CylinderGeometry(.29, .38, .14, 24), material, pawn, [0, .08, 0]),
                mesh(new THREE.CylinderGeometry(.12, .29, .55, 24), material.clone(), pawn, [0, .41, 0]),
                mesh(new THREE.SphereGeometry(.2, 20, 16), material.clone(), pawn, [0, .82, 0]),
            ];
            parts.forEach(part => { part.userData = { playerId: player.uniqueId }; targets.push(part); });
            if (state.currentTurnPlayerUniqueId === player.uniqueId && player.alive) {
                const ring = mesh(new THREE.TorusGeometry(.52, .045, 8, 40),
                    new THREE.MeshBasicMaterial({ color: 0xffd359 }), seat, [0, .07, 0]);
                ring.rotation.x = Math.PI / 2;
            }
            label(seat, `${player.name}${player.uniqueId === me ? ' (คุณ)' : ''}${!player.alive ? ' · เสียชีวิต' : ''}`, [0, 1.45, 0],
                player.alive ? '#eddbb7' : '#a39b91');
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
            for (let life = 0; life < lives; life++) {
                const revealedName = player.tryalCards?.[life]?.name;
                card(seat, [(life - (lives - 1) / 2) * .42, .06, -.98], [-Math.PI / 2, 0, 0],
                    revealedName ? cardTexture(imageFor(revealedName)) : back, { playerId: player.uniqueId }, .38);
            }
            const own = player.uniqueId === me;
            const count = own ? hand.length : Number(player.handSize) || 0;
            // All cards stay selectable; compress the fan for larger hands.
            const spacing = Math.min(.43, 2.4 / Math.max(1, count));
            for (let i = 0; i < count; i++) {
                const offset = i - (count - 1) / 2;
                const face = card(seat, [offset * spacing, 1 + (own && selected === i ? .24 : 0), .7 + Math.abs(offset) * .025],
                    [-.12, 0, -offset * Math.min(.045, .35 / Math.max(1, count))],
                    own ? cardTexture(imageFor(hand[i].name)) : back,
                    own ? { cardIndex: i } : { playerId: player.uniqueId }, own ? .68 : .47);
                if (own && selected === i) face.material.emissive.set(0x4b330c);
            }
            // Public effects form a row toward the table centre, above life cards.
            const effects = player.inPlayCards || [];
            const effectSpacing = Math.min(.43, 2.1 / Math.max(1, effects.length));
            effects.forEach((effect, i) => {
                card(seat, [(i - (effects.length - 1) / 2) * effectSpacing, .08 + i * .002, -1.75],
                    [-Math.PI / 2, 0, 0], cardTexture(imageFor(effect.name)), { playerId: player.uniqueId }, .4);
            });
        });

        function pile(x, count, title, clickable) {
            const height = Math.max(.04, Math.min(.52, count * .01));
            const box = mesh(new THREE.BoxGeometry(.75, height, 1.1), new THREE.MeshStandardMaterial({ color: 0x9e8764 }), dynamic, [x, height / 2 + .04, 0]);
            const top = card(dynamic, [x, height + .045, 0], [-Math.PI / 2, 0, 0], back, { draw: clickable }, .74);
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
        down = { x: event.clientX, y: event.clientY, id: event.pointerId }; moved = false;
    }
    function pointerMove(event) { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) moved = true; }
    function pointerUp(event) {
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
        else if (data.playerId) onPlayer(data.playerId);
    }
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', () => { down = null; });
    renderer.domElement.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        onError('อุปกรณ์หยุดแสดงภาพ 3D กรุณาสลับกลับ 2D');
    });

    function resize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) return;
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
        setActive(value) { active = value; controls.enabled = value; if (value) { resize(); requestRender(); } },
        resetCamera,
        zoom(direction) {
            const offset = camera.position.clone().sub(controls.target);
            offset.multiplyScalar(direction === 'in' ? .86 : 1.16);
            offset.setLength(THREE.MathUtils.clamp(offset.length(), controls.minDistance, controls.maxDistance));
            camera.position.copy(controls.target).add(offset);
            controls.update(); requestRender();
        },
        dispose() {
            disposed = true;
            cancelAnimationFrame(renderFrame);
            resizeObserver.disconnect(); controls.dispose(); clearDynamic();
            scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
            wood.dispose(); back.dispose(); textures.forEach(texture => texture.dispose());
            renderer.dispose(); renderer.domElement.remove();
        },
    };
}

window.VillageTable3D = { create };
