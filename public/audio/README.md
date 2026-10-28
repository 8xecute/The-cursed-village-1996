# Background music

The game uses Web Audio (`public/js/audio/background-player.js`) rather than an
HTML audio player. Background music is separate from the sound effects volume.

## Tracks

- `lobby-music.mp3`: home, lobby and game over.
- `day-music.mp3`: daytime.
- `night-music.mp3`: nighttime and the initial offering selection.
- `predawn-music.mp3`: pre-dawn.

Life setup (shuffling, dealing and arranging lives) stops background music.
Music resumes when the witches begin choosing the offering recipient; card
handling effects continue independently during the quiet setup.

Track selection is configured in `public/js/audio/music.js`. There is no reference
to a missing game-over track.

## Playback lifecycle

- No autoplay or music download before a player interacts with the page.
- Initial music volume is 20% in the UI, scaled to 30% of that for background use.
- The slider saves the preferred volume; zero also stops playback.
- Phase changes crossfade for 450 ms; identical tracks continue without restarting.
- Hiding the tab, locking the screen or leaving the page stops voices, cancels
  pending fetches and suspends the music context.
- Returning resumes the current phase from the saved position where possible.
  If the browser blocks resuming, the next tap or key press retries it.
- A single decoded track is retained, resampled to 22,050 Hz mono where the
  browser supports OfflineAudioContext, to limit mobile memory usage.
- Missing or undecodable files remain silent and can retry on another interaction.

Existing MP3 assets remain unchanged. Source code does not register a media-player
session or create an HTML audio/video element for background music.
