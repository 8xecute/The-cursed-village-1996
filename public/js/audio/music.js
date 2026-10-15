import { client } from '../core/client.js';

client.actions.updateMusicUI = function updateMusicUI() {
    client.dom.musicVolumeLabel.textContent = `${Math.round(client.state.currentVolume * 100)}%`;
            client.dom.musicVolumeSlider.value = Math.round(client.state.currentVolume * 100); // default to 20
};

client.actions.setMusicVolume = function setMusicVolume(vol) {
    // vol is 0.0-1.0 from UI
    const scaledVol = Math.max(0, Math.min(1, vol)) * 0.3;
    client.state.currentVolume = Math.max(0, Math.min(1, vol)); // for UI only
    client.dom.backgroundMusic.volume = scaledVol;
    localStorage.setItem('musicVolume', String(client.state.currentVolume));
    client.actions.updateMusicUI();
};

client.actions.changePhaseMusic = function changePhaseMusic(phase) {
    if (phase === client.state.lastMusicPhase) return;
    client.state.lastMusicPhase = phase;
    const musicFile = client.state.phaseMusic[phase];
    if (musicFile) {
        const isSameSrc = client.dom.backgroundMusic.src && client.dom.backgroundMusic.src.includes(musicFile);
        const isActuallyPlaying = !client.dom.backgroundMusic.paused && !client.dom.backgroundMusic.ended && client.dom.backgroundMusic.currentTime > 0;
        if (!isSameSrc) {
            client.dom.backgroundMusic.src = musicFile;
        }
        // เฟสที่ต้องบังคับเปิดเพลง
        if (["DAY", "NIGHT", "PRE_DAWN"].includes(phase) && !client.state.userPausedMusic) {
            client.dom.backgroundMusic.play().then(() => {
                client.state.isMusicPlaying = true;
                client.actions.updateMusicUI();
            }).catch(()=>{});
        } else if (client.state.hasUserStartedMusic && !client.state.userPausedMusic) {
            if (!isActuallyPlaying) {
                client.dom.backgroundMusic.play().then(() => {
                    client.state.isMusicPlaying = true;
                    client.actions.updateMusicUI();
                }).catch(()=>{});
            }
        } else {
            client.state.isMusicPlaying = false;
            client.actions.updateMusicUI();
        }
    }
};

export function initialize() {
  client.dom.backgroundMusic = document.getElementById('background-music');

  client.dom.musicVolumeSlider = document.getElementById('music-volume-slider');

  client.dom.musicVolumeLabel = document.getElementById('music-volume-label');

  client.state.isMusicPlaying = false;

  client.state.savedMusicVolume = localStorage.getItem('musicVolume');

  client.state.currentVolume = client.state.savedMusicVolume === null
      ? 0.2
      : Math.max(0, Math.min(1, Number(client.state.savedMusicVolume) || 0));

  client.state.hasUserStartedMusic = false;

  if (localStorage.getItem('musicPaused') === 'true') client.state.currentVolume = 0;

  localStorage.removeItem('musicPaused');

  client.state.userPausedMusic = false;

  client.dom.musicVolumeSlider.addEventListener('input', (e) => {
      client.actions.setMusicVolume(e.target.value / 100);
      if (client.state.currentVolume > 0 && client.dom.backgroundMusic.paused) {
          client.dom.backgroundMusic.play().then(() => {
              client.state.isMusicPlaying = true;
              client.state.hasUserStartedMusic = true;
          }).catch(() => {});
      }
  });

  window.addEventListener('DOMContentLoaded', () => {
      // Restore saved volume and preserve an explicit pause across page loads.
      client.dom.musicVolumeSlider.value = Math.round(client.state.currentVolume * 100);
      client.actions.setMusicVolume(client.state.currentVolume);
      client.actions.changePhaseMusic('LOBBY');
      if (client.state.userPausedMusic) {
          client.state.isMusicPlaying = false;
          client.actions.updateMusicUI();
          return;
      }

      // Try to play music (may be blocked by browser autoplay policy).
      client.dom.backgroundMusic.play().then(() => {
          client.state.isMusicPlaying = true;
          client.state.hasUserStartedMusic = true;
          client.actions.updateMusicUI();
      }).catch(() => {
          // Autoplay blocked, wait for user interaction
          client.state.isMusicPlaying = false;
          client.actions.updateMusicUI();
      });
  });

  client.state.socket.on('room joined', (roomName) => {
      client.state.currentRoomName = roomName;
      if (client.dom.nameInputContainer) client.dom.nameInputContainer.style.display = 'none';
      client.dom.currentRoomDisplay.textContent = roomName || 'ไม่มี';
      client.dom.roomManagementSection.style.display = 'none';
      client.dom.roomLobbySection.style.display = 'block';
      client.dom.gameSection.style.display = 'none'; // Ensure game section is hidden initially
      client.dom.leaveRoomButton.style.display = 'block';
      // ไม่ต้องสั่งเปิดเพลงหรือเปลี่ยน src ที่นี่อีก ปล่อยให้ระบบเพลงจัดการเองตามเฟส
  });

  client.state.phaseMusic = {
      'LOBBY': 'audio/lobby-music.mp3',
      'DAY': 'audio/day-music.mp3', 
      'NIGHT': 'audio/night-music.mp3',
      'PRE_DAWN': 'audio/predawn-music.mp3',
      'GAME_OVER': 'audio/gameover-music.mp3'
  };

  client.state.lastMusicPhase = null;
}
