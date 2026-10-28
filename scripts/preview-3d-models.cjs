// Render current character and life-card assets without connecting to a game.
// node scripts/preview-3d-models.cjs OUTPUT_DIRECTORY
// PLAYWRIGHT_MODULE / CHROME_PATH can point to the local browser runtime.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
    const output = path.resolve(process.argv[2]);
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
        await page.route('http://preview.test/**', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>' });
            const file = path.resolve(root, '.' + pathname);
            if (!file.startsWith(root + path.sep)) return route.abort();
            const contentType = pathname.endsWith('.glb') ? 'model/gltf-binary' : pathname.endsWith('.png') ? 'image/png' : 'text/javascript';
            return route.fulfill({ contentType, body: fs.readFileSync(file) });
        });
        await page.goto('http://preview.test/');
        await page.evaluate(async () => {
            const T = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const { prepareVillagerModels, instantiateVillager } = await import('/src/client/villager-models.mjs');
            const { addLifeCardFrame, lifeBorderColor } = await import('/src/client/life-card-frame.mjs');
            const asset = await new GLTFLoader().loadAsync('/public/models/villagers-seated.glb');
            const models = prepareVillagerModels(asset.scene);
            const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1000, 800);
            renderer.toneMapping = T.ACESFilmicToneMapping;
            document.body.style.margin = '0'; document.body.appendChild(renderer.domElement);
            function sceneBase() {
                const scene = new T.Scene(); scene.background = new T.Color(0x37332e);
                scene.add(new T.HemisphereLight(0xffffff, 0x555555, 2));
                const light = new T.DirectionalLight(0xffffff, 3); light.position.set(-4, 10, -3); scene.add(light);
                return scene;
            }
            const camera = new T.PerspectiveCamera(38, 1.25, .01, 100);
            const scene = sceneBase();
            const pawn = new T.Group(); pawn.scale.setScalar(1.4); pawn.position.y = -.05; scene.add(pawn);
            instantiateVillager(pawn, models, 0x596b55, false, 1);
            const wood = new T.MeshStandardMaterial({ color: 0x573721, roughness: .8 });
            const table = new T.Mesh(new T.CylinderGeometry(6.2, 6.2, .35, 80), wood); table.position.set(0, -.2, -6.7); scene.add(table);
            camera.position.set(1.9, 1.5, -2.6); camera.lookAt(0, .15, -.5);
            renderer.render(scene, camera);
            window.renderLifePreview = async () => {
                const cards = sceneBase();
                const tabletop = new T.Mesh(new T.BoxGeometry(5, .1, 3), wood); tabletop.position.y = -.06; cards.add(tabletop);
                for (const [i, [name, file]] of [['Witch', 'witch'], ['Constable', 'constable'], ['Not A Witch', 'notawitch']].entries()) {
                    const texture = await new T.TextureLoader().loadAsync('/public/cards/' + file + '.png'); texture.colorSpace = T.SRGBColorSpace;
                    const face = new T.Mesh(new T.PlaneGeometry(.72, .72 * 1.48), new T.MeshStandardMaterial({ map: texture, roughness: .86, side: T.DoubleSide }));
                    face.position.set((i - 1) * .9, .006, 0); face.rotation.x = -Math.PI / 2; cards.add(face);
                    addLifeCardFrame(face, lifeBorderColor(name));
                }
                camera.position.set(.5, 3.2, 2.5); camera.lookAt(0, 0, 0);
                renderer.render(cards, camera);
            };
        });
        await page.screenshot({ path: path.join(output, 'dead-character-current.png') });
        await page.evaluate(() => window.renderLifePreview());
        await page.screenshot({ path: path.join(output, 'life-card-borders-current.png') });
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
