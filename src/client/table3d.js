import { QUALITY_PRESETS, normalizeQuality, createGraphicsQuality } from './graphics-quality.mjs';
import * as THREE from 'three';
import { addHourglass } from './hourglass.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareVillagerModels, instantiateVillager, disposeVillagerModels } from './villager-models.mjs';
import { createGunShot } from './gun-shot.mjs';
import { createShotgun } from './shotgun-model.mjs';
import { addBloodPool } from './blood-pool.mjs';
import { createHandMotion } from './hand-motion.mjs';
import { CARD_MOTION } from '../../public/js/core/card-motion.mjs';
import { addLifeCardFrame, lifeBorderColor } from './life-card-frame.mjs';
import { lifeSlots } from '../../public/js/cards/life-slots.mjs';
import { createCameraControls } from './camera-controls.mjs';
import { timberTexture, ceremonialCloth, buildCeremonialRoom, createRitualBust } from './ritual-scene.mjs';
import { createRoomReflection, createPaperEdges, addTableContact } from './scene-finishes.mjs';

// World heights match the tabletop and the ritual cloth geometry below.
const TABLE_TOP_Y = -.025;
const CLOTH_TOP_Y = .016;
const PAPER_FACE_OFFSET = .016; // .012-thick edge, plus a small anti-flicker gap.
const CARD_WIDTH = .44;
const CARD_HEIGHT = CARD_WIDTH * 1.48;
const CARD_SPACING = CARD_WIDTH + .02;
const flightLandingY = point => (Math.hypot(point.x,point.z)<2.35 ? CLOTH_TOP_Y : TABLE_TOP_Y) + PAPER_FACE_OFFSET + .004;
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

function create({ container, onCard, onDraw, onPlayer, onLife, onEffect, onError, onInspect, onSeatFocus, onShotgun, onHourglass, quality = 'medium', cameraMode = 'rotate' }) {
    const qualityLevel = normalizeQuality(quality);
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'default' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[qualityLevel].pixelRatio));
    renderer.shadowMap.enabled = QUALITY_PRESETS[qualityLevel].shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'โต๊ะเกม 3D ลากเพื่อหมุน เลื่อนล้อเมาส์หรือใช้ปุ่มเพื่อซูม');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'โต๊ะ 3D ลากเมาส์ซ้ายหมุนรอบโต๊ะ ลากเมาส์ขวาขึ้นลงเพื่อเงยหรือก้ม จีบสองนิ้วเพื่อซูม');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151713);
    scene.fog = new THREE.Fog(0x151713, 17, 36);
    const reflection = createRoomReflection(renderer);
    scene.environment = reflection.texture;
    scene.environmentIntensity = .3;
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60);
    const cameraRig = createCameraControls({ camera, renderer, cameraMode, requestRender,
        isActive: () => active, isDisposed: () => disposed,
        getSeatPosition: id => seatPositions.get(id), onSeatFocus,
        onModeChange: () => { down = null; clearTimeout(holdTimer); }
    });
    const { controls, resetCamera } = cameraRig;

    const ambient = new THREE.HemisphereLight(0xa5bbc9, 0x342a26, .55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xb5c8d5, 1.05);
    key.position.set(-5, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(QUALITY_PRESETS[qualityLevel].shadowSize, QUALITY_PRESETS[qualityLevel].shadowSize);
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 3;
    scene.add(key);
    const candleLight = new THREE.PointLight(0xffbd7a, 10, 18, 2);
    candleLight.position.set(0, 1.2, 0);
    scene.add(candleLight);
    const moonFill = new THREE.DirectionalLight(0x829fb8, .45);
    moonFill.position.set(5, 6, -6);
    scene.add(moonFill);
    // Warm bounced candlelight keeps silhouettes readable after the house lamps
    // are extinguished. No extra shadow map or per-player light is required.
    const candleBounce = new THREE.HemisphereLight(0xa8784e, 0x2b1c14, 0);
    scene.add(candleBounce);
    key.shadow.bias = -0.0002;

    const wood = timberTexture();
    const cloth = ceremonialCloth();
    const paperEdges = createPaperEdges();
    const tableContact = addTableContact(scene);
    const back = canvasTexture(256, 384, (ctx, w, h) => {
        const patina=ctx.createRadialGradient(w/2,h/2,15,w/2,h/2,h*.65);
        patina.addColorStop(0,'#3b2b1e');patina.addColorStop(1,'#16130f');
        ctx.fillStyle=patina;ctx.fillRect(0,0,w,h);
        // Muted woven diamonds and corner flourishes match the aged card faces.
        ctx.strokeStyle='rgba(180,144,87,.09)';ctx.lineWidth=1;
        for(let y=-32;y<h+32;y+=32)for(let x=0;x<w;x+=32) {
            ctx.beginPath();ctx.moveTo(x,y-16);ctx.lineTo(x+16,y);ctx.lineTo(x,y+16);ctx.lineTo(x-16,y);ctx.closePath();ctx.stroke();
        }
        ctx.strokeStyle='#aa8c58';ctx.lineWidth=3;ctx.strokeRect(9,9,w-18,h-18);
        ctx.strokeStyle='#76613f';ctx.lineWidth=1;ctx.strokeRect(17,17,w-34,h-34);
        for(const [x,y,sx,sy] of [[23,23,1,1],[w-23,23,-1,1],[23,h-23,1,-1],[w-23,h-23,-1,-1]]) {
            ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.strokeStyle='#b69a64';
            ctx.beginPath();ctx.moveTo(0,34);ctx.quadraticCurveTo(0,0,34,0);ctx.moveTo(0,21);ctx.quadraticCurveTo(14,22,12,10);ctx.quadraticCurveTo(21,13,21,0);ctx.stroke();ctx.restore();
        }
        ctx.fillStyle='#291f16';ctx.beginPath();ctx.ellipse(w/2,h/2,81,56,0,0,Math.PI*2);ctx.fill();
        for(const radius of [75,81]) {
            ctx.strokeStyle='#9c8050';ctx.beginPath();ctx.ellipse(w/2,h/2,radius, radius*.64,0,0,Math.PI*2);ctx.stroke();
        }
        ctx.textAlign='center';ctx.fillStyle='#bc9f6a';
        ctx.font='500 17px "Village Sarabun", serif';ctx.fillText('หมู่บ้านต้องสาป',w/2,h/2-9);
        ctx.font='bold 29px serif';ctx.fillText('1996',w/2,h/2+25);
    });
    back.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());

    function mesh(geometry, material, parent, position) {
        const object = new THREE.Mesh(geometry, material);
        if (position) object.position.set(...position);
        object.castShadow = true;
        object.receiveShadow = true;
        parent.add(object);
        return object;
    }
    const roomLighting = buildCeremonialRoom(scene, wood);
    const tableMaterial = new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: .009, roughness: .56, color: 0xc7b49b, envMapIntensity: .65 });
    const apronMaterial = new THREE.MeshStandardMaterial({ map: wood, color: 0x66503b, roughness: .64, envMapIntensity: .4 });
    mesh(new THREE.CylinderGeometry(6.2, 6.16, .35, 96, 1, true), apronMaterial, scene, [0, -.2, 0]);
    mesh(new THREE.CircleGeometry(6.2, 96), tableMaterial, scene, [0, TABLE_TOP_Y, 0]).rotation.x = -Math.PI / 2;
    // A recessed inlay on the apron adds craftsmanship without a raised hand rail.
    mesh(new THREE.CylinderGeometry(6.187, 6.185, .016, 96, 1, true),
        new THREE.MeshStandardMaterial({color:0x8c7350,metalness:.45,roughness:.55}),scene,[0,-.15,0]);
    // Keep the tabletop flat through its outer edge so wrists cannot be
    // occluded by a raised decorative rail.
    mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.02, 64),
        new THREE.MeshStandardMaterial({ map: cloth, bumpMap: cloth, bumpScale: .003, roughness: .98, envMapIntensity: .1 }), scene, [0, 0.006, 0]);
    mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.11, 24),
        new THREE.MeshStandardMaterial({ color: 0xb69a60, metalness: .78, roughness: .34, envMapIntensity:.9 }), scene, [0, 0.08, 0]);
    const wax = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.65, 20),
        new THREE.MeshStandardMaterial({ color: 0xe0d5b8, emissive:0xf4b966, emissiveIntensity:.02, roughness: .78 }), scene, [0, 0.45, 0]);
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
    // The hand contact area stays flat, including the former thin trim rings.
    const waxMaterial = new THREE.MeshStandardMaterial({color:0xe0d5b8,roughness:.78});
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
    const playerLabels = [], labelPosition = new THREE.Vector3();
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
    const parkedGuns = new Map();
    let lastShotId = null;
    let feedbackImageFor;
    const flights = [];
    const handMotion = createHandMotion();
    const gunShots = [];
    function removeGunShot(shot) {
        shot.dispose();
    }
    const cardFlightDuration = CARD_MOTION.play;
    const cardArrivalPause = CARD_MOTION.pause;
    function stopFlight() {
        gunShots.forEach(removeGunShot); gunShots.length = 0;
        for (const flight of flights) { scene.remove(flight.mesh); flight.mesh.geometry.dispose(); flight.mesh.material.dispose(); }
        flights.length = 0;
    }
    function addFlight(from, to, texture = back, delay = 0, hold = 250) {
        if (!active || disposed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH,CARD_HEIGHT), new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
        face.quaternion.copy(camera.quaternion); face.position.copy(from); face.visible = false; scene.add(face);
        const heading = Math.atan2(to.x-from.x,to.z-from.z);
        const flight = {mesh:face,from:from.clone(),to:to.clone(),rotation:face.quaternion.clone(),
            resting:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,heading)),
            arc:Math.min(.3,from.distanceTo(to)*.025),started:performance.now()+delay,hold};
        flights.push(flight); requestRender(); return flight;
    }

    function requestRender() {
        if (!active || disposed || renderFrame) return;
        renderFrame = requestAnimationFrame(() => {
            renderFrame = 0;
            controls.update();
            const now = performance.now();
            cameraRig.moveCamera(now);
            cameraRig.constrainCamera();
            for (const name of playerLabels) {
                name.getWorldPosition(labelPosition);
                // The seat being viewed already has a HUD caption. Hide its near
                // world label so it cannot grow over the cards while circling.
                name.visible = name.userData.playerId !== lastSceneOptions?.me && camera.position.distanceTo(labelPosition) > 4.4;
            }
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
                flight.mesh.quaternion.slerpQuaternions(flight.rotation,flight.resting,eased);
                if (t === 1) flight.mesh.position.y += Math.sin(Math.max(0,Math.min(1,(elapsed-(flight.duration || cardFlightDuration))/120))*Math.PI)*.012;
                if (elapsed >= (flight.duration || cardFlightDuration)+flight.hold) { scene.remove(flight.mesh); flight.mesh.geometry.dispose(); flight.mesh.material.dispose(); flights.splice(index,1); }
            }
            for (let index = gunShots.length - 1; index >= 0; index--) {
                const shot = gunShots[index];
                if (!shot.tick(now)) { removeGunShot(shot); gunShots.splice(index, 1); }
            }
            const handMoving = handMotion.tick(now);
            renderer.render(scene, camera);
            if (flights.length || gunShots.length || handMoving || cameraRig.hasMovement || !reducedMotion.matches) requestRender();
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
            texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
            textures.set(url, texture);
        }
        return textures.get(url) || back;
    }

    function card(parent, position, rotation, texture, data) {
        const size = CARD_WIDTH;
        const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: .94, envMapIntensity: .15 });
        const face = mesh(new THREE.PlaneGeometry(size, size * 1.48), material, parent, position);
        face.rotation.set(...rotation);
        face.castShadow = face.receiveShadow = false;
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
        edge.castShadow = edge.receiveShadow = false;
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

    function label(parent, text, position, color = '#eddbb7', size = .23, glowing = false) {
        const font = '600 32px "Village Sarabun", sans-serif';
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = font;
        const width = Math.ceil(Math.min(420, Math.max(76, measure.measureText(text).width + 28)));
        const height = 62;
        const texture = canvasTexture(width, height, (ctx, w, h) => {
            ctx.fillStyle = 'rgba(19,15,12,.86)';
            ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, 12); ctx.fill();
            ctx.font = font; ctx.fillStyle = color;
            if (glowing) { ctx.shadowColor = '#ffad32'; ctx.shadowBlur = 14; }
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, w / 2, h / 2, w - 28);
        });
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false }));
        sprite.userData.disposableTexture = texture;
        sprite.position.set(...position);
        sprite.scale.set(width / height * size, size, 1);
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
        playerLabels.length = 0;
    }

    function update(options) {
        lastSceneOptions = options;
        const { state, me, hand, selected, selectedCards = [], imageFor, interaction = null, canDraw = false, drawConfirming = false, handLowered = false, artwork = 'new', reorderIndex = null, cardSizes = {} } = options;
        const sizeFor = key => Math.max(.5, Math.min(2, (Number(cardSizes[key]) || 100) / 100));
        if (!state) return;
        const nextSignature = JSON.stringify([state.actionTimer?.deadline, state.actionTimer?.available, state.currentPhase, state.gameOver, state.lifeSetup, state.awaitingLeftTryalSelections, state.playerForcedToRevealTryal, state.players, state.currentTurnPlayerUniqueId, state.deckCount, state.discardPileCount, state.witchNightState, state.prankGunHolderId, state.prankGunAvailable, state.prankShotActive, hand, selected, selectedCards, me, interaction, canDraw, drawConfirming, handLowered, artwork, reorderIndex, cardSizes]);
        if (signature === nextSignature) return;
        signature = nextSignature;
        lifeSetupStage = state.lifeSetup?.stage || null;
        lifeSetupPile = null;
        const night = ['NIGHT', 'PRE_DAWN'].includes(state.currentPhase);
        ritualActive = state.currentPhase === 'BLACKCAT_TRYAL' || !!state.awaitingLeftTryalSelections;
        const choosingLife = ritualActive || !!state.playerForcedToRevealTryal || state.currentPhase === 'PRE_DAWN' || interaction?.kind === 'life';
        roomLighting.setNight(night);
        ambient.intensity = night ? 0 : choosingLife ? .85 : .55;
        key.intensity = night ? 0 : choosingLife ? 1.5 : 1.05;
        moonFill.intensity = night ? 0 : .45;
        ambient.visible = key.visible = moonFill.visible = !night;
        candleBounce.intensity = night ? .45 : 0;
        scene.environmentIntensity = night ? 0 : .14;
        wax.material.emissiveIntensity = night ? .18 : .02;
        scene.background.set(night ? 0x080605 : 0x1d282f);
        scene.fog.color.copy(scene.background);
        candleLight.distance = night ? 22 : 12;
        candleBaseIntensity = night ? 42 : choosingLife ? 16 : 14;
        candleLight.intensity = candleBaseIntensity;
        outerFlame.material.color.set(0xff8b26);
        innerFlame.material.color.set(0xffe5a0);
        core.material.color.set(0xfff6da);
        glow.material.color.set(0xffffff);
        candleLight.color.set(0xffbd7a);
        handMotion.begin();
        clearDynamic();
        addHourglass(dynamic, targets, !!state.actionTimer?.available && !state.actionTimer?.seconds && !state.actionTimer?.deadline && !!state.players?.[me]?.alive && !state.isSpectator, !!state.actionTimer?.deadline);
        if (!state.prankShotActive && gunShots.length) {
            gunShots.forEach(removeGunShot); gunShots.length = 0;
        }
        seatPositions.clear(); actorPawns.clear(); parkedGuns.clear(); feedbackImageFor = imageFor;
        const players = Object.values(state.players || {});
        cameraRig.setSeats(players, me);
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
            if (!player.alive) addBloodPool(seat, TABLE_TOP_Y - seat.position.y, index);
            const pawn = new THREE.Group(); pawn.position.z = 2.05; pawn.position.y = -.1; seat.add(pawn);
            actorPawns.set(player.uniqueId, pawn);
            pawn.scale.setScalar(1.4);
            if (state.prankGunHolderId === player.uniqueId) {
                const parked = createShotgun(); parked.position.set(.9, -.6, 2.3); parked.rotation.set(-1.35, 0, -.15); parked.scale.setScalar(1.05);
                parked.visible = !state.prankShotActive; seat.add(parked); parkedGuns.set(player.uniqueId, parked);
            }
            // The model's dead pose folds the upper body; chair and legs stay seated.
            const characterId = Number.isInteger(player.characterId) && player.characterId >= 0 && player.characterId < 12 ? player.characterId : index % 12;
            const modelKey = `${characterId}:${player.alive}:${!!villagerModels}`;
            if (!characterCache.has(modelKey)) {
                const template = new THREE.Group();
                characterCache.set(modelKey, villagerModels
                    ? instantiateVillager(template, villagerModels, COLORS[characterId % COLORS.length], player.alive, characterId)
                    : createRitualBust(template, COLORS[characterId % COLORS.length], player.alive, characterId));
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
            const activeTurn = player.alive && !state.gameOver && state.currentPhase === 'DAY' && state.currentTurnPlayerUniqueId === player.uniqueId;
            const nameLabel = label(seat, `${selectedTarget ? '✓ ' : ''}${player.name}${player.uniqueId === me ? ' (คุณ)' : ''}${state.players?.[me]?.hasBeenWitch && player.hasBeenWitch ? ' · ทีมปอบ' : ''}${player.isReplacementBot ? ' · บอทเล่นแทน' : player.reconnectDeadline ? ' · รอเชื่อมต่อ' : ''}${!player.alive ? ' · เสียชีวิต' : ''}`, [0, 1.85, 2.65],
                activeTurn ? '#ffe9a8' : eligibleTarget ? selectedTarget ? '#ffe1a0' : '#a9e0c9' : player.alive ? '#eddbb7' : '#a39b91', activeTurn ? .28 : .23, activeTurn);
            // Our identity is already in the HUD; the nearby sprite covers raised cards.
            nameLabel.visible = player.uniqueId !== me;
            nameLabel.userData.playerId = player.uniqueId;
            nameLabel.material.depthTest = true;
            playerLabels.push(nameLabel);
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
            const revealed = player.revealedTryalCards || [];
            const slots = lifeSlots(player);
            const lifeTotal = slots.length, lifeScale = 1.25 * sizeFor('life');
            const sectorWidth = players.length > 2 ? 2 * 3.8 * Math.sin(Math.PI / players.length) - .12 : 5;
            const lifeColumns = Math.max(1, Math.min(lifeTotal || 1, Math.floor(sectorWidth / (CARD_WIDTH * lifeScale + .025))));
            const lifeRows = Math.ceil(lifeTotal / lifeColumns);
            const remainingSlots = slots.filter(slot=>!slot.opened), openedSlots = slots.filter(slot=>slot.opened);
            const lifePosition = index => {
                const row = Math.floor(index / lifeColumns), columns = Math.min(lifeColumns, lifeTotal - row * lifeColumns);
                return [(index % lifeColumns - (columns - 1) / 2) * (CARD_WIDTH * lifeScale + .025), .06, -.85 - row * (CARD_HEIGHT * lifeScale + .10)];
            };
            for (let life = 0; life < lives; life++) {
                const revealedName = player.tryalCards?.[life]?.name;
                const lifeCard = card(seat, lifePosition(remainingSlots[life].slot), [-Math.PI / 2, 0, 0],
                    revealedName ? cardTexture(imageFor(revealedName)) : back, { playerId: player.uniqueId, lifeIndex: life, resting: true });
                lifeCard.scale.setScalar(lifeScale);
                addLifeCardFrame(lifeCard, lifeBorderColor(revealedName));
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life))
                    addLifeCardFrame(lifeCard, interaction.selected?.includes(life) ? 0xffd359 : 0x6ee7d2, { selected: true, inset: .015 });
                if (interaction?.kind === 'life' && interaction.owner === player.uniqueId && interaction.eligible.includes(life)) {
                    const position = lifePosition(remainingSlots[life].slot);
                    label(seat, `${interaction.selected?.includes(life) ? '✓ ' : ''}${remainingSlots[life].slot + 1}`, [position[0], .24, position[2]], '#ffe2a0');
                }
            }
            const effects = player.inPlayCards || [];
            const publicCount = effects.length;
            const publicColumns = Math.max(1, Math.min(8, publicCount, Math.floor(sectorWidth / (CARD_SPACING * sizeFor('status')))));
            const publicRows = Math.ceil(publicCount / publicColumns);
            const publicScale = Math.min(1, 1.15 / Math.max(1, publicRows)) * sizeFor('status');
            const statusGap = .14;
            const statusStart = -.85 - Math.max(0, lifeRows - 1) * (CARD_HEIGHT * lifeScale + .10) - CARD_HEIGHT * lifeScale / 2 - statusGap - CARD_HEIGHT * publicScale / 2;
            // Bound the public-card area outside the central piles, even after many effects.
            function publicPosition(index) {
                const row = Math.floor(index / publicColumns);
                const columns = Math.min(publicColumns, publicCount - row * publicColumns);
                return [(index % publicColumns - (columns - 1) / 2) * CARD_SPACING * publicScale, .075,
                    statusStart - row * (CARD_HEIGHT + .04) * publicScale];
            }
            revealed.forEach((revealedCard, i) => {
                const face = card(seat, lifePosition(openedSlots.find(slot=>slot.revealedIndex===i).slot), [-Math.PI/2,0,0],
                    cardTexture(imageFor(revealedCard.name)), { playerId: player.uniqueId, revealedIndex: i, resting: true });
                face.scale.setScalar(lifeScale);
                addLifeCardFrame(face, lifeBorderColor(revealedCard.name));
                const length = Math.hypot(CARD_WIDTH, CARD_HEIGHT) * .86;
                for (const angle of [-1, 1]) {
                    const cross = new THREE.Mesh(new THREE.PlaneGeometry(length, .025), new THREE.MeshBasicMaterial({color:0xdb675b, transparent:true, opacity:.88, depthWrite:false, toneMapped:false}));
                    cross.rotation.z = angle * Math.atan2(CARD_HEIGHT, CARD_WIDTH);
                    cross.position.z = .012; face.add(cross);
                }
                const position = lifePosition(openedSlots.find(slot=>slot.revealedIndex===i).slot);
                label(seat, 'เปิดเผยแล้ว', [position[0], .045, position[2] + CARD_HEIGHT * lifeScale / 2 + .07], '#d9c7a5', .075);
            });
            const own = player.uniqueId === me;
            const count = state.currentPhase === 'SETUP' || interaction?.kind === 'life' ? 0 : own ? hand.length : Number(player.handSize) || 0;
            // Own hand uses separate rows so every title remains visible.
            const handSize = own ? sizeFor('hand') : 1;
            const seatColumns = Math.max(3, Math.floor((Math.PI * 2 * 4.7 / players.length - .3) / (CARD_SPACING * handSize)));
            const maxColumns = own && !handLowered && container.clientHeight > container.clientWidth ? 4 : Math.min(8, seatColumns);
            const columns = Math.ceil(count / Math.max(1, Math.ceil(count / maxColumns)));
            const spacing = CARD_SPACING * handSize;
            const handScale = Math.min(1, 2 / Math.max(1, Math.ceil(count / Math.max(1, columns))));
            for (let i = 0; i < count; i++) {
                const row = Math.floor(i / Math.max(1, columns));
                const rowCount = Math.min(columns, count - row * columns);
                const offset = i % columns - (rowCount - 1) / 2;
                const lowered = !own || handLowered;
                const handRowStep = (CARD_HEIGHT + .035) * handSize;
                const loweredStart = Math.max(.75, -.85 + CARD_HEIGHT * lifeScale / 2 + .14 + CARD_HEIGHT * handSize * handScale / 2 + Math.max(0, Math.ceil(count / Math.max(1, columns)) - 1) * handRowStep * handScale);
                const position = lowered ? [offset * spacing * handScale, .08, loweredStart - row * handRowStep * handScale]
                    : [offset * spacing, .72 + CARD_HEIGHT * handSize / 2 + row * handRowStep + (own && (selected === i || selectedCards.includes(i)) ? .16 : 0), -.1 + Math.abs(offset) * .025];
                const rotation = lowered ? [-Math.PI / 2, 0, 0] : [-.12, 0, own ? 0 : -offset * Math.min(.045, .35 / Math.max(1, count))];
                const face = card(seat, position, rotation,
                    own ? cardTexture(imageFor(hand[i].name)) : back,
                    own ? { cardIndex: i, category: hand[i].color, resting: lowered } : { playerId: player.uniqueId, resting: lowered });
                face.scale.setScalar(handSize * (lowered ? handScale : 1));
                if (own && !lowered) {
                    // Keep private card text readable without lighting the room.
                    face.material.emissiveMap=face.material.map;
                    face.material.emissive.setHex(night ? 0xffddb0 : 0xe0e7ed);
                    face.material.emissiveIntensity=night ? .5 : .18;
                }
                if (own && (selected === i || selectedCards.includes(i))) face.material.color.set(0xb9a687);
                if (own && reorderIndex === i) outline(face, 0xffdc73);
                if (own) handMotion.place(`${me}:${i}:${hand[i].name}`,face,!reducedMotion.matches);
            }
            // Effects begin beyond the innermost life row, with a size-aware gap.
            effects.forEach((effect, i) => {
                const effectCard = card(seat, publicPosition(i),
                    [-Math.PI / 2, 0, 0], cardTexture(imageFor(effect.name)), { playerId: player.uniqueId, effectIndex: i, category: effect.color, resting: true });
                effectCard.scale.setScalar(publicScale);
                if (interaction?.kind === 'effect' && interaction.owner === player.uniqueId && interaction.eligible.includes(i)) {
                    const picked = interaction.selected.includes(i);
                    outline(effectCard, picked ? 0xffd359 : 0xc2ab87);
                    if (picked) {
                        effectCard.material.color.setHex(0xffdf99);
                        effectCard.material.emissive.setHex(0x705018);
                        effectCard.material.emissiveIntensity = .35;
                    }
                    const position = publicPosition(i);
                    label(seat, `${picked ? '✓ ' : ''}${i + 1}`, [position[0], .23, position[2]], picked ? '#ffdf80' : '#e1d1b7');
                }
            });
        });
        handMotion.end();

        if (state.gameStarted && !state.gameOver && !state.prankGunHolderId && state.prankGunAvailable !== false) {
            const mount = new THREE.Group(); mount.position.set(-3.6, 2.1, -11.25); dynamic.add(mount);
            const wallAngle = -Math.max(0, ownIndex) * Math.PI * 2 / Math.max(1, players.length);
            mount.position.applyAxisAngle(new THREE.Vector3(0,1,0), wallAngle); mount.rotation.y = wallAngle;
            mesh(new THREE.BoxGeometry(2.35,.55,.10),new THREE.MeshStandardMaterial({color:0x3c2a1b,roughness:.95}),mount,[0,0,0]);
            for (const x of [-.65,.65]) mesh(new THREE.BoxGeometry(.05,.16,.22),new THREE.MeshStandardMaterial({color:0x6f614a,metalness:.55,roughness:.7}),mount,[x,-.14,.15]);
            const wallGun = createShotgun(); wallGun.position.set(-.25,0,.21); wallGun.rotation.y=Math.PI/2; wallGun.scale.setScalar(1.25); mount.add(wallGun);
            const pickup = mesh(new THREE.BoxGeometry(2.4,.65,.5),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),mount,[0,0,.22]);
            pickup.userData.shotgun = true;
            if (!state.isSpectator && state.players?.[me]?.alive && state.currentPhase === 'DAY' && !state.prankShotActive) targets.push(pickup);
        }
        if (state.prankShot && state.prankShot.startedAt !== lastShotId) animateShot(state.prankShot);

        if (state.currentPhase === 'SETUP' && lifeSetupStage !== 'arrange') {
            const stack = new THREE.Group(); dynamic.add(stack);
            stack.position.set(0, 1.45, 0);
            for (let i = 0; i < 4; i++) card(stack, [i * .025, i * .025, 0], [-Math.PI / 2, 0, i * .03], back, {});
            lifeSetupPile = stack;
        }

        function pile(x, count, title, clickable) {
            const height = Math.max(.04, Math.min(.52, count * .01));
            const box = mesh(new THREE.BoxGeometry(CARD_WIDTH, height, CARD_HEIGHT), new THREE.MeshStandardMaterial({ map:paperEdges,color:0xe2d2b4,roughness:.94,envMapIntensity:.1 }), dynamic, [x, CLOTH_TOP_Y + height / 2, 0]);
            box.castShadow = box.receiveShadow = false;
            const top = card(dynamic, [x, CLOTH_TOP_Y + height + PAPER_FACE_OFFSET, 0], [-Math.PI / 2, 0, 0], back, { draw: clickable });
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
        if (data.hourglass) onHourglass?.();
        else if (data.shotgun) onShotgun?.();
        else if (Number.isInteger(data.cardIndex)) onCard(data.cardIndex);
        else if (data.draw) onDraw?.();
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
        const layoutChanged = (width < height) !== (canvasWidth < canvasHeight);
        canvasWidth = width; canvasHeight = height;
        container.parentElement.style.setProperty('--table3d-canvas-height', `${height}px`);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        if (layoutChanged && lastSceneOptions) { signature = ''; update(lastSceneOptions); }
        requestRender();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    setQuality(qualityLevel);
    resetCamera();
    function animateShot(event) {
        if (!active || disposed || event.startedAt === lastShotId) return;
        const from = seatPositions.get(event.actorId)?.clone(), to = seatPositions.get(event.targetId)?.clone();
        if (!from || !to) return;
        lastShotId = event.startedAt;
        from.multiplyScalar(1.35).setY(.9); to.multiplyScalar(1.35).setY(.7);
        gunShots.push(createGunShot({ scene, from, to, getPawn: () => lastSceneOptions?.state.players?.[event.actorId]?.alive ? actorPawns.get(event.actorId) : null, getParkedGun: () => parkedGuns.get(event.actorId),
            startedAt: event.startedAt, raiseDuration: event.raiseDuration || 2800, speechStart:event.speechStart, speechDuration:event.speechDuration, speechText:event.speechText, bulletDuration: event.bulletDuration || 450, recoveryDuration: event.recoveryDuration || 900 }));
        requestRender();
    }
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
        animateShot,
        setKeyboardLocked: cameraRig.setKeyboardLocked,
        stepSeat: cameraRig.stepSeat,
        animateCard(event) {
            const actor = seatPositions.get(event.actorId), target = seatPositions.get(event.targetId);
            const from = actor?.clone().multiplyScalar(1.15).setY(1);
            const to = target ? target.clone().multiplyScalar(.7) : new THREE.Vector3();
            to.y = flightLandingY(to);
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
                    const to=seat.clone().multiplyScalar(.79);to.y=flightLandingY(to);
                    addFlight(new THREE.Vector3(0, .25, 0), to, back, 0, 0);
                    const flight = flights.at(-1);
                    flight.duration = CARD_MOTION.deal; flight.arc = .12;
                }
            } else if (event.kind === 'draw') {
                const to = seatPositions.get(event.targetId);
                if (to) { const flight=addFlight(new THREE.Vector3(-1.2,.18,0),to.clone().multiplyScalar(1.02).setY(.8),back,event.delay || 0); if(flight){flight.duration=CARD_MOTION.draw;flight.resting.copy(flight.rotation);} }
            } else if (event.kind === 'conspiracy') {
                for (const route of event.routes || []) {
                    const from = seatPositions.get(route.actorId), to = seatPositions.get(route.targetId);
                    if (from && to) { const source=from.clone().multiplyScalar(.79),target=to.clone().multiplyScalar(.79);source.y=flightLandingY(source)+.03;target.y=flightLandingY(target);addFlight(source,target,back); }
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
            resizeObserver.disconnect(); handMotion.clear(); clearDynamic();
            scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
            characterCache.forEach(parts => parts.forEach(part => { if (!villagerModels || part.userData.ownedGeometry) part.geometry.dispose(); part.material.dispose(); }));
            characterCache.clear();
            if (villagerModels) disposeVillagerModels(villagerModels, true);
            roomLighting.dispose();
            reflection.dispose();paperEdges.dispose();tableContact.dispose();
            flameGlowTexture.dispose(); wood.dispose(); cloth.dispose(); back.dispose(); textures.forEach(texture => texture.dispose());
            renderer.dispose(); renderer.domElement.remove();
        },
    };
}

window.VillageTable3D = { create };
