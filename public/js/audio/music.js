import { client } from '../core/client.js';
import { createBackgroundPlayer } from './background-player.js';

let player;
let revealDucking = false;
client.actions.setRevealMusicDucking = value => {
    revealDucking = !!value;
    player?.setVolume(client.state.currentVolume * .3 * (revealDucking ? .25 : 1));
};
client.actions.updateMusicUI = () => {
    const percent = Math.round(client.state.currentVolume * 100);
    client.dom.musicVolumeLabel.textContent = `${percent}%`;
    client.dom.musicVolumeSlider.value = percent;
};
client.actions.setMusicVolume = value => {
    client.state.currentVolume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    client.state.userPausedMusic = client.state.currentVolume === 0;
    player?.setVolume(client.state.currentVolume * .3 * (revealDucking ? .25 : 1));
    try { localStorage.setItem('musicVolume', String(client.state.currentVolume)); } catch (_) {}
    client.actions.updateMusicUI();
};
client.actions.startMusic = () => {
    client.state.hasUserStartedMusic = true;
    player?.unlock();
};
client.actions.changePhaseMusic = (phase, roomState = client.state.currentRoomState) => {
    client.state.lastMusicPhase = phase;
    const track = phase === 'SETUP' || phase === 'GAME_OVER' || roomState?.gameOver ? '' : roomState?.isAssigningBlackCat
        ? client.state.phaseMusic?.OFFERING : client.state.phaseMusic?.[phase] || client.state.phaseMusic?.LOBBY;
    player?.setTrack(track || '');
};

export function initialize() {
    client.dom.musicVolumeSlider = document.getElementById('music-volume-slider');
    client.dom.musicVolumeLabel = document.getElementById('music-volume-label');
    client.state.isMusicPlaying = false;
    client.state.hasUserStartedMusic = false;
    client.state.phaseMusic = {
        LOBBY: 'audio/lobby-music.mp3', SETUP: '', OFFERING: 'audio/night-music.mp3',
        DAY: 'audio/day-music.mp3', NIGHT: 'audio/night-music.mp3',
        PRE_DAWN: 'audio/predawn-music.mp3', GAME_OVER: ''
    };
    player = createBackgroundPlayer(playing => { client.state.isMusicPlaying = playing; });
    let saved = null, legacyPaused = false;
    try {
        saved = localStorage.getItem('musicVolume');
        legacyPaused = localStorage.getItem('musicPaused') === 'true';
        localStorage.removeItem('musicPaused');
    } catch (_) {}
    client.actions.setMusicVolume(legacyPaused ? 0 : saved === null ? .2 : Number(saved));
    client.actions.changePhaseMusic('LOBBY');
    client.dom.musicVolumeSlider.addEventListener('input', event => {
        client.actions.setMusicVolume(Number(event.target.value) / 100);
        client.actions.startMusic();
    });
    // Room updates never unlock audio: a real interaction must come first.
    document.addEventListener('pointerdown', client.actions.startMusic, { capture:true, passive:true });
    document.addEventListener('keydown', event => {
        if (!event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) client.actions.startMusic();
    });
    let pageActive = true;
    const updateVisibility = () => player.setActive(pageActive && !document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', () => { pageActive = false; updateVisibility(); });
    window.addEventListener('pageshow', () => { pageActive = true; updateVisibility(); });
    document.addEventListener('freeze', () => { pageActive = false; updateVisibility(); });
    document.addEventListener('resume', () => { pageActive = true; updateVisibility(); });
    client.state.socket.on('room left', () => client.actions.changePhaseMusic('LOBBY', null));
}
