// Visual presets are shared by renderer initialization and live quality changes.
export const QUALITY_PRESETS = Object.freeze({
    low: Object.freeze({ pixelRatio: 1, shadows: false, shadowSize: 1024, lightStride: 0 }),
    medium: Object.freeze({ pixelRatio: 1.5, shadows: true, shadowSize: 1024, lightStride: 2 }),
    high: Object.freeze({ pixelRatio: 2, shadows: true, shadowSize: 2048, lightStride: 1 })
});
export function normalizeQuality(level) { return Object.hasOwn(QUALITY_PRESETS, level) ? level : 'medium'; }
export function createGraphicsQuality({ renderer, scene, key, container, quality, requestRender, onChange }) {
    let qualityLevel = normalizeQuality(quality);
    const mobile = window.matchMedia('(max-width: 900px) and (pointer: coarse)').matches;
    function setQuality(level) {
        if (!Object.hasOwn(QUALITY_PRESETS, level)) return;
        const changed=qualityLevel!==level;
        qualityLevel=level;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,QUALITY_PRESETS[level].pixelRatio));
        renderer.setSize(container.clientWidth || 1,container.clientHeight || 1);
        renderer.shadowMap.enabled=QUALITY_PRESETS[level].shadows;
        const shadowSize=mobile ? Math.min(512, QUALITY_PRESETS[level].shadowSize) : QUALITY_PRESETS[level].shadowSize;
        if(key.shadow.mapSize.x!==shadowSize) {
            key.shadow.map?.dispose();key.shadow.map=null;
            key.shadow.mapPass?.dispose();key.shadow.mapPass=null;
            key.shadow.mapSize.set(shadowSize,shadowSize);
        }
        let lightIndex=0;
        scene.traverse(part=>{
            if(part.userData.qualityLight) {
                const stride = mobile && QUALITY_PRESETS[level].lightStride ? Math.max(2, QUALITY_PRESETS[level].lightStride) : QUALITY_PRESETS[level].lightStride;
                part.userData.qualityAllowed=stride > 0 && lightIndex % stride === 0;
                part.visible=part.userData.qualityAllowed && !part.userData.nightDisabled;lightIndex++;
            }
            if(changed && part.isMesh && part.material) part.material.needsUpdate=true;
        });
        if (changed) onChange?.();
        renderer.shadowMap.needsUpdate=true;requestRender();
    }
    return { setQuality, get lowPower() { return !QUALITY_PRESETS[qualityLevel].shadows; } };
}
