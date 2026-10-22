import { client } from '../core/client.js';

export function initialize() {
    const bar = document.createElement('div'); bar.id = 'prank-controls'; bar.hidden = true;
    const gun = document.createElement('button'); gun.type = 'button'; gun.textContent = '🔫 เล็งลูกซอง';
    bar.append(gun); document.body.appendChild(bar);
    const cue = document.createElement('div'); cue.id = 'prank-shot-cue'; cue.hidden = true; cue.setAttribute('role', 'status'); document.body.appendChild(cue);
    // Keep the overlays attached to the scene, above its separate mobile controls.
    function placeOverlays() {
        const scene = document.body.classList.contains('game-view-3d') && document.getElementById('table3d-canvas');
        const parent = scene || document.body;
        for (const overlay of [bar, cue]) if (overlay.parentElement !== parent) parent.appendChild(overlay);
    }
    placeOverlays();
    new MutationObserver(placeOverlays).observe(document.body, {attributes:true, attributeFilter:['class']});
    let selecting = false, selected = null, cueTimer, pickupTap = 0;
    let speechTimer, speechStopTimer, ownSpeech;
    window.speechSynthesis?.getVoices();
    function stopSpeech() {
        clearTimeout(speechTimer);clearTimeout(speechStopTimer);
        if(ownSpeech)window.speechSynthesis?.cancel();ownSpeech=null;
    }
    client.state.socket.on('disconnect',stopSpeech);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();});
    client.actions.pickupWallShotgun = () => {
        const state = client.state.currentRoomState;
        if (!state?.gameStarted || state.gameOver || state.isSpectator || !state.players?.[client.state.myUniqueId]?.alive || state.prankGunHolderId || state.prankShotActive || state.currentPhase !== 'DAY') return;
        const now = performance.now();
        if (pickupTap && now - pickupTap < 2500) {
            pickupTap = 0; cue.hidden = true; clearTimeout(cueTimer);
            client.state.socket.emit('prank gun pickup');
        } else {
            pickupTap = now; cue.textContent = 'แตะลูกซองอีกครั้งเพื่อหยิบ'; cue.hidden = false; cue.classList.add('is-pickup');
            clearTimeout(cueTimer); cueTimer = setTimeout(() => { cue.hidden = true; pickupTap = 0; }, 2500);
        }
    };
    const originalInteraction = client.actions.getTable3DInteraction;
    const originalPlayer = client.actions.handleTable3DPlayer;
    function clearSelection() { selecting = false; selected = null; gun.textContent = '🔫 เล็งลูกซอง'; }
    function shoot(id) {
        client.state.socket.emit('prank gun shoot', id);
        clearSelection(); client.actions.syncTable3D();
    }
    client.actions.getTable3DInteraction = () => selecting ? {
        kind: 'player', eligible: Object.values(client.state.currentRoomState?.players || {}).filter(p => p.alive && p.uniqueId !== client.state.myUniqueId).map(p => p.uniqueId),
        selected: selected ? [selected] : [], blocked: {}, outcomes: {}
    } : originalInteraction();
    client.actions.handleTable3DPlayer = id => {
        if (!selecting) return originalPlayer(id);
        if (!client.actions.getTable3DInteraction().eligible.includes(id)) return;
        if (selected === id) shoot(id);
        else { selected = id; client.actions.syncTable3D(); }
    };
    gun.onclick = () => {
        if (selecting) { clearSelection(); client.actions.syncTable3D(); return; }
        if (originalInteraction() || client.state.currentRoomState?.currentPhase !== 'DAY') {
            client.actions.addGameMessage('ใช้ปืนได้ช่วงกลางวัน เมื่อไม่มีแอ็กชันการ์ดค้างอยู่', 'orange'); return;
        }
        if (document.body.classList.contains('game-view-3d')) {
            selecting = true; gun.textContent = 'ยกเลิกยิง · แตะเป้าหมาย 2 ครั้ง'; client.actions.syncTable3D();
        } else {
            const targets = Object.values(client.state.currentRoomState.players).filter(p => p.alive && p.uniqueId !== client.state.myUniqueId);
            client.actions.showSelectPlayerPopup('🔫 เลือกเป้าหมายยิงลูกซอง', targets, shoot);
        }
    };
    client.state.socket.on('room state update', state => {
        const available = state.gameStarted && !state.gameOver && !state.isSpectator;
        gun.hidden = !available || !state.prankGun;
        gun.disabled = !state.players?.[client.state.myUniqueId]?.alive || state.prankShotActive || state.currentPhase !== 'DAY';
        bar.hidden = gun.hidden;
        if (gun.hidden || gun.disabled) clearSelection();
        if (state.prankGunHolderId && pickupTap) { pickupTap = 0; cue.hidden = true; clearTimeout(cueTimer); }
    });
    client.state.socket.on('prank gun shot', event => {
        stopSpeech();
        if(event.speechText && window.speechSynthesis) {
            const elapsed=Math.max(0,Date.now()-event.startedAt);
            const delay=Math.max(0,(event.speechStart||0)-elapsed);
            if(elapsed<(event.speechStart||0)+event.speechDuration)speechTimer=setTimeout(()=>{
                if(document.hidden)return;
                const voice=window.speechSynthesis.getVoices().find(voice=>voice.lang.toLowerCase().startsWith('th'));
                // Without a Thai voice, keep the bubble/mouth rather than mispronouncing it.
                if(!voice)return;
                ownSpeech=new SpeechSynthesisUtterance(event.speechText);ownSpeech.voice=voice;ownSpeech.lang='th-TH';
                try{const volume=Number(localStorage.getItem('villageSfxVolume')??.5);ownSpeech.volume=Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):.5;}catch(_){ownSpeech.volume=.5;}
                window.speechSynthesis.speak(ownSpeech);
                speechStopTimer=setTimeout(stopSpeech,Math.max(0,(event.speechStart||0)+event.speechDuration-Math.max(0,Date.now()-event.startedAt)));
            },delay);
        }
        clearSelection(); clearTimeout(cueTimer);
        cue.classList.remove('is-pickup');
        cue.textContent = `🔫 ${event.actorName} → ${event.targetName} 💥`; cue.hidden = false;
        cue.style.setProperty('--shot-duration', `${event.duration}ms`);
        if (document.body.classList.contains('game-view-3d')) client.state.table3D?.animateShot?.(event);
        cueTimer = setTimeout(() => { cue.hidden = true; }, event.duration + 500);
    });
    client.state.socket.on('room left', () => { stopSpeech();clearSelection(); pickupTap = 0; bar.hidden = true; cue.hidden = true; clearTimeout(cueTimer); });
}
