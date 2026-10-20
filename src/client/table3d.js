import { QUALITY_PRESETS, normalizeQuality, createGraphicsQuality } from './graphics-quality.mjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareVillagerModels, instantiateVillager, disposeVillagerModels } from './villager-models.mjs';
import { createGunShot } from './gun-shot.mjs';
import { createCameraControls } from './camera-controls.mjs';
import { timberTexture, ceremonialCloth, buildCeremonialRoom, createRitualBust } from './ritual-scene.mjs';

// World heights match the tabletop and the ritual cloth geometry below.
const TABLE_TOP_Y = -.025;
const CLOTH_TOP_Y = .016;
const PAPER_FACE_OFFSET = .016; // .012-thick edge, plus a small anti-flicker gap.
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

function create({ container, onCard, onDraw, onPlayer, onLife, onEffect, onError, onInspect, onSeatFocus, quality = 'medium', cameraMode = 'rotate' }) {
    const qualityLevel = normalizeQuality(quality);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'default' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[qualityLevel].pixelRatio));
    renderer.shadowMap.enabled = QUALITY_PRESETS[qualityLevel].shadows;
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
    scene.background = new THREE.Color(0x151713);
    scene.fog = new THREE.Fog(0x151713, 17, 36);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
    const cameraRig = createCameraControls({ camera, renderer, cameraMode, requestRender,
        isActive: () => active, isDisposed: () => disposed,
        getSeatPosition: id => seatPositions.get(id), onSeatFocus,
        onModeChange: () => { down = null; clearTimeout(holdTimer); }
    });
    const { controls, resetCamera } = cameraRig;

    const ambient = new THREE.HemisphereLight(0xc0ceda, 0x302016, 1.25);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffd9b0, 2.4);
    key.position.set(-4, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(QUALITY_PRESETS[qualityLevel].shadowSize, QUALITY_PRESETS[qualityLevel].shadowSize);
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

    const wood = timberTexture();
    const cloth = ceremonialCloth();
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
    buildCeremonialRoom(scene, wood);
    const tableMaterial = new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: .035, roughness: .78, color: 0xb4a38b });
    mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.35, 80), tableMaterial, scene, [0, -0.2, 0]);
    // Keep the tabletop flat through its outer edge so wrists cannot be
    // occluded by a raised decorative rail.
    mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.02, 64),
        new THREE.MeshStandardMaterial({ map: cloth, bumpMap: cloth, bumpScale: .008, roughness: 1 }), scene, [0, 0.006, 0]);
    mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.11, 24),
        new THREE.MeshStandardMaterial({ color: 0x8d7446, metalness: 0.72, roughness: 0.52 }), scene, [0, 0.08, 0]);
    mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.65, 20),
        new THREE.MeshStandardMaterial({ color: 0xc4b58d, roughness: 0.96 }), scene, [0, 0.45, 0]);
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
    // Aged bronze rims and pooled wax catch the candlelight.
    for (const radius of [5.98, 6.18]) {
        const ring = mesh(new THREE.TorusGeometry(radius,.018,5,96),new THREE.MeshStandardMaterial({color:0x685432,metalness:.7,roughness:.65}),scene,[0,.015,0]);
        ring.rotation.x = Math.PI/2;
    }
    const waxMaterial = new THREE.MeshStandardMaterial({color:0xc4b58d,roughness:.96});
    for(let i=0;i<7;i++) {
        const angle=i*2.4;
        const drip=mesh(new THREE.SphereGeometry(.025,8,6),waxMaterial,scene,[Math.sin(angle)*.175,.37+(i%3)*.12,Math.cos(angle)*.175]);
        drip.scale.set(.8,2.4,.7);
    }
    const pool=mesh(new THREE.SphereGeometry(.24,16,8),waxMaterial,scene,[0,.15,0]);pool.scale.y=.08;
    const bowlMaterial=new THREE.MeshStandardMaterial({color:0x78613a,metalness:.7,roughness:.58});
    const incenseBowl=mesh(new THREE.CylinderGeometry(.16,.12,.09,20),bowlMaterial,scene,[0,.08,-.85]);
    mesh(new THREE.CylinderGeometry(.145,.145,.008,20),new THREE.MeshStandardMaterial({color:0x50473b,roughness:1}),scene,[0,.13,-.85]);
    for(let i=-1;i<=1;i++) {
        const stick=mesh(new THREE.CylinderGeometry(.006,.006,.3,5),new THREE.MeshStandardMaterial({color:0x63503a,roughness:1}),scene,[i*.035,.28,-.85]);
        stick.rotation.z=i*.1;
        mesh(new THREE.SphereGeometry(.009,6,5),new THREE.MeshBasicMaterial({color:0xc15c29,toneMapped:false}),scene,[i*.05,.43,-.85]);
    }

    const dynamic = new THREE.Group();
    scene.add(dynamic);
    const textures = new Map();
    const loader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let targets = [];
    let signature = '';
    let villagerModels = null;
    let lastSceneOptions = null;
    let active = false;
    let disposed = false;
    let renderFrame = 0;
    const characterCache = new Map();
    let flameTimer;
    let ritualActive = false;
    let lifeSetupStage = null, lifeSetupPile = null;
    let candleBaseIntensity = 10;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function tickFlame() {
        if (!active || disposed || reducedMotion.matches) return;
        requestRender();
    }
    let down = null;
    let moved = false;
    let holdTimer;
    let inspected = false;
    const seatPositions = new Map();
    const actorPawns = new Map();
    let feedbackImageFor;
    const flights = [];
    const gunShots = [];
    function removeGunShot(shot) {
        shot.dispose();
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
            cameraRig.moveCamera(now);
            cameraRig.constrainCamera();
            if (!reducedMotion.matches) {
                const time = now * .001;
                if (lifeSetupPile && lifeSetupStage === 'shuffle') {
                    lifeSetupPile.rotation.z = Math.sin(time * 14) * .18;
                    lifeSetupPile.position.x = Math.sin(time * 11) * .22;
                }
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
                if (!shot.tick(now)) { removeGunShot(shot); gunShots.splice(index, 1); }
            }
            renderer.render(scene, camera);
            if (flights.length || gunShots.length || cameraRig.hasMovement || !reducedMotion.matches) requestRender();
        });
    }
    const graphics = createGraphicsQuality({ renderer, scene, key, container, quality: qualityLevel, requestRender,
        onChange: () => { if (lastSceneOptions) { signature = ''; update(lastSceneOptions); } }
    });
    const { setQuality } = graphics;

    new GLTFLoader().load('models/villagers-seated.glb', gltf => {
        const loaded = prepareVillagerModels(gltf.scene);
        gltf.scene.traverse(part => { part.geometry?.dispose(); part.material?.dispose(); });
        if (disposed) { disposeVillagerModels(loaded, true); return; }
        villagerModels = loaded;
        characterCache.forEach(parts => parts.forEach(part => { part.geometry.dispose(); part.material.dispose(); }));
        characterCache.clear();
        if (lastSceneOptions) { signature = ''; update(lastSceneOptions); }
        requestRender();
    }, undefined, () => { /* Keep the complete seated fallback if loading fails. */ });

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
        if (data.resting) {
            // Seat-local card heights must account for the seat's own translation.
            parent.updateWorldMatrix(true, false);
            const world = parent.localToWorld(face.position.clone());
            const surface = Math.hypot(world.x, world.z) <= 2.35 ? CLOTH_TOP_Y : TABLE_TOP_Y;
            world.y = surface + PAPER_FACE_OFFSET;
            face.position.copy(parent.worldToLocal(world));
        }
        face.userData = data;
        // A thin paper edge adds depth without changing the clickable face.
        const edge = mesh(new THREE.BoxGeometry(size, size * 1.48, .012),
            new THREE.MeshStandardMaterial({color:0x574533,roughness:.95}), face, [0,0,-.009]);
        edge.castShadow = false;
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

    function update(options) {
        lastSceneOptions = options;
        const { state, me, hand, selected, selectedCards = [], imageFor, interaction = null, canDraw = false, drawConfirming = false, handLowered = true, artwork = 'new', reorderIndex = null } = options;
        if (!state) return;
        const nextSignature = JSON.stringify([state.currentPhase, state.awaitingLeftTryalSelections, state.playerForcedToRevealTryal, state.players, state.currentTurnPlayerUniqueId, state.deckCount, state.discardPileCount, state.witchNightState, hand, selected, selectedCards, me, interaction, canDraw, drawConfirming, handLowered, artwork, reorderIndex]);
        if (signature === nextSignature) return;
        signature = nextSignature;
        lifeSetupStage = state.lifeSetup?.stage || null;
        lifeSetupPile = null;
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
        seatPositions.clear(); actorPawns.clear(); feedbackImageFor = imageFor;
        const players = Object.values(state.players || {});
        cameraRig.setSeats(players, me);
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
            const pawn = new THREE.Group(); pawn.position.z = 2.05; pawn.position.y = -.1; seat.add(pawn);
            actorPawns.set(player.uniqueId, pawn);
            pawn.scale.setScalar(1.4);
            // The model's dead pose folds the upper body; chair and legs stay seated.
            const modelKey = `${index}:${player.alive}:${!!villagerModels}`;
            if (!characterCache.has(modelKey)) {
                const template = new THREE.Group();
                characterCache.set(modelKey, villagerModels
                    ? instantiateVillager(template, villagerModels, COLORS[index % COLORS.length], player.alive, index)
                    : createRitualBust(template, COLORS[index % COLORS.length], player.alive, index));
            }
            const parts = characterCache.get(modelKey).map(source => {
                const part = new THREE.Mesh(source.geometry, source.material.clone());
                part.name = source.name;
                part.userData.sharedGeometry = true;
                part.castShadow = part.receiveShadow = !graphics.lowPower;
                pawn.add(part); return part;
            });
            parts.forEach(part => { part.userData = { ...part.userData, playerId: player.uniqueId }; targets.push(part); });
            const eligibleTarget = interaction?.kind === 'player' && interaction.eligible.includes(player.uniqueId);
            const selectedTarget = eligibleTarget && interaction.selected.includes(player.uniqueId);
            if (eligibleTarget) parts.forEach(part => {
                part.material.emissive.set(selectedTarget ? 0xb47e34 : 0x597b70);
                part.material.emissiveIntensity = selectedTarget ? .9 : .55;
            });
            const nameLabel = label(seat, `${selectedTarget ? '✓ ' : ''}${player.name}${player.uniqueId === me ? ' (คุณ)' : ''}${state.players?.[me]?.hasBeenWitch && player.hasBeenWitch ? ' · ทีมปอบ' : ''}${player.isReplacementBot ? ' · บอทเล่นแทน' : player.reconnectDeadline ? ' · รอเชื่อมต่อ' : ''}${!player.alive ? ' · เสียชีวิต' : ''}`, [0, 1.55, 2.05],
                eligibleTarget ? selectedTarget ? '#ffe1a0' : '#a9e0c9' : player.alive ? '#eddbb7' : '#a39b91');
            // Our identity is already in the HUD; the nearby sprite covers raised cards.
            nameLabel.visible = player.uniqueId !== me;
            nameLabel.userData.playerId = player.uniqueId;
            if (player.uniqueId !== me) targets.push(nameLabel);
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
                    revealedName ? cardTexture(imageFor(revealedName)) : back, { playerId: player.uniqueId, lifeIndex: life, resting: true }, .38);
                outline(lifeCard, revealedName ? lifeBorder(revealedName) : 0x8d7658);
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) outline(lifeCard, interaction.selected?.includes(life) ? 0xffd359 : 0xc2ab87);
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) {
                    label(seat, `${interaction.selected?.includes(life) ? '✓ ' : ''}${life + 1}`, [(life - (lives - 1) / 2) * .42, .24, -.98], '#ffe2a0');
                }
            }
            const revealed = player.revealedTryalCards || [];
            revealed.forEach((revealedCard, i) => {
                const face = card(seat, [(i-(revealed.length-1)/2)*.42, .075, -.38], [-Math.PI/2,0,0],
                    cardTexture(imageFor(revealedCard.name)), { playerId: player.uniqueId, revealedIndex: i, resting: true }, .38);
                outline(face,lifeBorder(revealedCard.name));
            });
            if (revealed.length) label(seat, 'เปิดแล้ว', [0,.3,-.38], '#cbb58b');
            const own = player.uniqueId === me;
            const count = state.currentPhase === 'SETUP' || interaction?.kind === 'life' ? 0 : own ? hand.length : Number(player.handSize) || 0;
            // Own hand uses separate rows so every title remains visible.
            const columns = own ? Math.min(6, count) : count;
            const spacing = own ? .61 : Math.min(.43, 2.4 / Math.max(1, count));
            for (let i = 0; i < count; i++) {
                const row = own ? Math.floor(i / Math.max(1, columns)) : 0;
                const rowCount = Math.min(columns, count - row * columns);
                const offset = (own ? i % columns : i) - (rowCount - 1) / 2;
                const lowered = !own || handLowered;
                const position = lowered ? [offset * spacing, .08 + (own && (selected === i || selectedCards.includes(i)) ? .12 : 0), .38 - row * .88 + Math.abs(offset) * .025]
                    : [offset * spacing, 1 + row * .98 + (own && (selected === i || selectedCards.includes(i)) ? .16 : 0), .7 + Math.abs(offset) * .025];
                const rotation = lowered ? [-Math.PI / 2, 0, 0] : [-.12, 0, own ? 0 : -offset * Math.min(.045, .35 / Math.max(1, count))];
                const face = card(seat, position, rotation,
                    own ? cardTexture(imageFor(hand[i].name)) : back,
                    own ? { cardIndex: i, category: hand[i].color, resting: lowered } : { playerId: player.uniqueId, resting: lowered }, own ? .56 : .47);
                if (own && (selected === i || selectedCards.includes(i))) face.material.color.set(0xb9a687);
                if (own && reorderIndex === i) outline(face, 0xffdc73);
            }
            // Public effects form a row toward the table centre, above life cards.
            const effects = player.inPlayCards || [];
            const effectSpacing = Math.min(.43, 2.1 / Math.max(1, effects.length));
            effects.forEach((effect, i) => {
                const effectCard = card(seat, [(i - (effects.length - 1) / 2) * effectSpacing, .08 + i * .002, -1.75],
                    [-Math.PI / 2, 0, 0], cardTexture(imageFor(effect.name)), { playerId: player.uniqueId, effectIndex: i, category: effect.color, resting: true }, .4);
                if (interaction?.kind === 'effect' && interaction.owner === player.uniqueId && interaction.eligible.includes(i)) outline(effectCard, interaction.selected.includes(i) ? 0x879277 : 0xc2ab87);
            });
        });

        if (state.currentPhase === 'SETUP' && lifeSetupStage !== 'arrange') {
            const stack = new THREE.Group(); dynamic.add(stack);
            stack.position.set(0, 1.45, 0);
            for (let i = 0; i < 4; i++) card(stack, [i * .025, i * .025, 0], [-Math.PI / 2, 0, i * .03], back, {}, .72);
            lifeSetupPile = stack;
        }

        function pile(x, count, title, clickable) {
            const height = Math.max(.04, Math.min(.52, count * .01));
            const box = mesh(new THREE.BoxGeometry(.75, height, 1.1), new THREE.MeshStandardMaterial({ color: 0x9e8764 }), dynamic, [x, CLOTH_TOP_Y + height / 2, 0]);
            const top = card(dynamic, [x, CLOTH_TOP_Y + height + PAPER_FACE_OFFSET, 0], [-Math.PI / 2, 0, 0], back, { draw: clickable }, .74);
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
    setQuality(qualityLevel);
    resetCamera();
    return {
        update,
        setActive(value) {
            if (active === value) return;
            active = value; controls.enabled = value;
            if (value) { resize(); requestRender(); clearTimeout(flameTimer); tickFlame(); }
            else { cameraRig.stopMovement(); clearTimeout(flameTimer); cancelAnimationFrame(renderFrame); renderFrame = 0; }
        },
        resetCamera,
        setQuality,
        setCameraMode: cameraRig.setCameraMode,
        stopMovement: cameraRig.stopMovement,
        setMovement: cameraRig.setMovement,
        animateShot(event) {
            if (!active || disposed || reducedMotion.matches) return;
            const from = seatPositions.get(event.actorId)?.clone();
            const to = seatPositions.get(event.targetId)?.clone();
            if (!from || !to) return;
            from.multiplyScalar(1.35).setY(.9); to.multiplyScalar(1.35).setY(.7);
            gunShots.push(createGunShot({ scene, from, to, getPawn: () => actorPawns.get(event.actorId),
                raiseDuration: event.raiseDuration || 900, bulletDuration: event.bulletDuration || 4200 }));
            requestRender();
        },
        setKeyboardLocked: cameraRig.setKeyboardLocked,
        stepSeat: cameraRig.stepSeat,
        animateCard(event) {
            const actor = seatPositions.get(event.actorId), target = seatPositions.get(event.targetId);
            const from = actor?.clone().multiplyScalar(1.15).setY(1);
            const to = target ? target.clone().multiplyScalar(.63).setY(.18) : new THREE.Vector3(0,1.1,0);
            if (!from || !feedbackImageFor) return;
            const texture = cardTexture(feedbackImageFor(event.cardName));
            addFlight(from,to,texture,event.delay || 0,cardArrivalPause);
            if (event.discard) addFlight(to,new THREE.Vector3(1.2,.3,0),texture,cardFlightDuration+cardArrivalPause);
        },
        animateMovement(event) {
            if (event.kind === 'life-deal') {
                if (!active || disposed || reducedMotion.matches) return;
                const seat = seatPositions.get(event.targetId);
                if (seat) {
                    addFlight(new THREE.Vector3(0, 1.6, 0), seat.clone().multiplyScalar(.79).setY(.18), back, 0, 0);
                    const flight = flights.at(-1);
                    flight.duration = 650; flight.arc = .5;
                }
            } else if (event.kind === 'draw') {
                const to = seatPositions.get(event.targetId);
                if (to) addFlight(new THREE.Vector3(-1.2,.4,0),to.clone().multiplyScalar(1.15).setY(1),back,event.delay || 0);
            } else if (event.kind === 'conspiracy') {
                for (const route of event.routes || []) {
                    const from = seatPositions.get(route.actorId), to = seatPositions.get(route.targetId);
                    if (from && to) addFlight(from.clone().multiplyScalar(.79).setY(.18),to.clone().multiplyScalar(.79).setY(.18),back);
                }
            }
        },
        setCameraView: cameraRig.setCameraView,
        zoom: cameraRig.zoom,
        dispose() {
            cameraRig.stopMovement();
            cameraRig.dispose();
            disposed = true; clearTimeout(holdTimer); clearTimeout(flameTimer); stopFlight();
            cancelAnimationFrame(renderFrame);
            resizeObserver.disconnect(); clearDynamic();
            scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
            characterCache.forEach(parts => parts.forEach(part => { if (!villagerModels || part.userData.ownedGeometry) part.geometry.dispose(); part.material.dispose(); }));
            characterCache.clear();
            if (villagerModels) disposeVillagerModels(villagerModels, true);
            flameGlowTexture.dispose(); wood.dispose(); cloth.dispose(); back.dispose(); textures.forEach(texture => texture.dispose());
            renderer.dispose(); renderer.domElement.remove();
        },
    };
}

window.VillageTable3D = { create };
