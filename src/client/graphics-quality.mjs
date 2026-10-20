// Visual presets are shared by renderer initialization and live quality changes.
export const QUALITY_PRESETS = Object.freeze({
    low: Object.freeze({ pixelRatio: 1, shadows: false, shadowSize: 1024, lightStride: 0 }),
    medium: Object.freeze({ pixelRatio: 1.5, shadows: true, shadowSize: 1024, lightStride: 2 }),
    high: Object.freeze({ pixelRatio: 2, shadows: true, shadowSize: 2048, lightStride: 1 })
});
export function normalizeQuality(level) { return Object.hasOwn(QUALITY_PRESETS, level) ? level : 'medium'; }
export function createGraphicsQuality({ renderer, scene, key, container, quality, requestRender, onChange }) {
    let qualityLevel = normalizeQuality(quality);
    function setQuality(level) {
        if (!Object.hasOwn(QUALITY_PRESETS, level)) return;
        const changed=qualityLevel!==level;
        qualityLevel=level;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,QUALITY_PRESETS[level].pixelRatio));
        renderer.setSize(container.clientWidth || 1,container.clientHeight || 1);
        renderer.shadowMap.enabled=QUALITY_PRESETS[level].shadows;
        const shadowSize=QUALITY_PRESETS[level].shadowSize;
        if(key.shadow.mapSize.x!==shadowSize) {
            key.shadow.map?.dispose();key.shadow.map=null;
            key.shadow.mapPass?.dispose();key.shadow.mapPass=null;
            key.shadow.mapSize.set(shadowSize,shadowSize);
        }
        let lightIndex=0;
        scene.traverse(part=>{
            if(part.userData.qualityLight) {part.visible=QUALITY_PRESETS[level].lightStride > 0 && lightIndex % QUALITY_PRESETS[level].lightStride === 0;lightIndex++;}
            if(changed && part.isMesh && part.material) part.material.needsUpdate=true;
        });
        if (changed) onChange?.();
        renderer.shadowMap.needsUpdate=true;requestRender();
    }
    return { setQuality, get lowPower() { return !QUALITY_PRESETS[qualityLevel].shadows; } };
}
