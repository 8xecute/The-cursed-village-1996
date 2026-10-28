// Offline asset preparation. Source and license: public/models/ATTRIBUTION.md.
// Usage: node scripts/prepare-villager-models.cjs SOURCE.glb
// Requires Playwright; set PLAYWRIGHT_MODULE and CHROME_PATH when not on PATH.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
        await page.route('http://assets.test/**', route => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>' });
            const file = pathname === '/source.glb' ? path.resolve(process.argv[2]) : path.resolve(root, pathname.startsWith('/models/') ? 'public' + pathname : '.' + pathname);
            if (pathname !== '/source.glb' && !file.startsWith(root + path.sep)) return route.abort();
            return route.fulfill({ contentType: pathname.endsWith('.js') ? 'text/javascript' : 'model/gltf-binary', body: fs.readFileSync(file) });
        });
        await page.goto('http://assets.test/');
        const result = await page.evaluate(async () => {
            const T = await import('three');
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
            const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js');
            const { mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');
            await MeshoptSimplifier.ready;
            const gltf = await new GLTFLoader().loadAsync('/source.glb');
            const scene = new T.Scene(); scene.background = new T.Color('#777777');
            const output = new T.Group(); const stats = [];
            for (const [i, name] of ['Riley', 'Sam'].entries()) {
                let source;
                gltf.scene.traverse(node => { if (node.userData.character === name) source = node; });
                if (!source) throw new Error('Missing character: ' + name);
                const group = source.clone(true); group.position.set(0, 0, 0);
                group.quaternion.identity(); // Both source figures face +Z in their own frame.
                group.rotation.y = Math.PI;
                group.name = 'villager-' + i;
                group.updateMatrixWorld(true);
                let triangles = 0;
                group.traverse(mesh => {
                    if (!mesh.isMesh) return;
                    mesh.geometry = mesh.geometry.clone();
                    // Keep the original texture seams and silhouette; simplify only with a small error.
                    const g = mesh.geometry;
                    if (g.index && g.index.count > 6000 && !/low-poly|eyebrow|eyelash|teeth|short01|bob01/i.test(mesh.name)) {
                        const [indices] = MeshoptSimplifier.simplify(new Uint32Array(g.index.array), g.attributes.position.array, 3, Math.floor(g.index.count * .45 / 3) * 3, .002, ['LockBorder']);
                        g.setIndex(new T.BufferAttribute(indices, 1));
                    }
                    triangles += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
                    mesh.geometry = mergeVertices(g, .00001);
                    g.dispose();
                    mesh.material = mesh.material.clone();
                    mesh.material.roughness = Math.max(.65, mesh.material.roughness);
                    mesh.material.metalness = 0;
                    for (const key of ['map', 'normalMap']) {
                        const texture = mesh.material[key];
                        if (!texture) continue;
                        // Keep alpha masks lossless; opaque skin/cloth can use JPEG.
                        if (key === 'map' && mesh.material.alphaTest === 0) texture.userData.mimeType = 'image/jpeg';
                        const image = texture.image;
                        const max = key === 'normalMap' ? 512 : 1024;
                        if (image.width <= max && image.height <= max) continue;
                        const ratio = Math.min(1, max / Math.max(image.width, image.height));
                        const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio);
                        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                        mesh.material[key] = texture.clone(); mesh.material[key].image = canvas; mesh.material[key].needsUpdate = true;
                    }
                });
                const bounds = new T.Box3().setFromObject(group);
                stats.push({ name, triangles, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } });
                output.add(group);
            }
            const data = await new GLTFExporter().parseAsync(output, { binary: true, maxTextureSize: 1024 });
            // Preview the actual prepared asset, including original eyes and clothing.
            output.children.forEach((group, i) => { group.position.x = i ? .65 : -.65; });
            scene.add(output); scene.add(new T.HemisphereLight(0xffffff, 0x665544, 2));
            const light = new T.DirectionalLight(0xffffff, 3); light.position.set(-2, 3, -4); scene.add(light);
            const camera = new T.PerspectiveCamera(35, 1100 / 850, .01, 100); camera.position.set(0, 1.1, -3.5); camera.lookAt(0, .8, 0);
            const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setSize(1100, 850); renderer.render(scene, camera); document.body.appendChild(renderer.domElement);
            return { base64: btoa(Array.from(new Uint8Array(data), b => String.fromCharCode(b)).join('')), stats };
        });
        fs.writeFileSync(path.join(root, 'public/models/villagers-seated.glb'), Buffer.from(result.base64, 'base64'));
        console.log(JSON.stringify(result.stats));
        await page.screenshot({ path: path.join(root, 'villagers-preview.png') });
        await page.addScriptTag({ url: '/public/table3d.bundle.js' });
        await page.evaluate(() => {
            document.body.replaceChildren(); document.body.style.margin = '0';
            const container = document.createElement('div'); container.style.cssText = 'width:1100px;height:850px'; document.body.appendChild(container);
            const engine = window.VillageTable3D.create({ container, quality: 'medium' });
            engine.setActive(true);
            const players = Object.fromEntries(Array.from({ length: 4 }, (_, i) => ['p' + i, { uniqueId: 'p' + i, name: 'Villager ' + (i + 1), alive: true, handSize: 3, tryalCards: Array.from({ length: 5 }, () => ({ revealed: false })) }]));
            engine.update({ state: { currentPhase: 'DAY', players, deckCount: 40, discardPileCount: 2 }, me: 'p0', hand: [], imageFor: () => null });
            engine.setCameraView('table');
        });
        await page.waitForResponse(response => response.url().endsWith('/models/villagers-seated.glb'));
        // Allow texture decode and the renderer's scheduled frame to finish.
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1200)));
        await page.screenshot({ path: path.join(root, 'villagers-table-preview.png') });
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
