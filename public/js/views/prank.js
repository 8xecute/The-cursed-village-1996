import { client } from '../core/client.js';

export function initialize() {
    const story = document.createElement('section');
    story.id = 'shotgun-story';
    story.hidden = true;
    story.setAttribute('role', 'dialog');
    story.setAttribute('aria-modal', 'true');
    story.setAttribute('aria-labelledby', 'shotgun-story-title');
    story.innerHTML = '<div class="shotgun-story-panel"><h2 id="shotgun-story-title">ปืนเก่าบนฝาผนัง</h2><p>นานมาแล้ว มีคนในหมู่บ้านเสียสติและใช้ปืนกระบอกนี้กราดยิงผู้คน หลังจากวันนั้น ชาวบ้านจึงนำกระสุนออกจนหมด แล้วแขวนปืนไว้บนผนังเพื่อเตือนความทรงจำ</p><button type="button">ปิด</button></div>';
    const style = document.createElement('style');
    style.textContent = '#shotgun-story[hidden]{display:none!important}#shotgun-story{position:absolute;inset:0;z-index:9999;display:grid;place-items:center;background:#000b;padding:16px;box-sizing:border-box}#shotgun-story .shotgun-story-panel{width:min(420px,100%);box-sizing:border-box;background:#251b15;color:#f1dfbd;border:1px solid #ae8751;border-radius:12px;padding:22px;line-height:1.7;box-shadow:0 12px 32px #000b}#shotgun-story h2{margin:0;font-size:1.2rem}#shotgun-story button{min-height:44px;padding:8px 24px}';
    document.head.appendChild(style);
    let previousFocus;
    const close = () => { story.hidden = true; previousFocus?.focus?.(); };
    story.querySelector('button').onclick = close;
    story.onclick = event => { if (event.target === story) close(); };
    story.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    client.actions.pickupWallShotgun = () => {
        const mount = document.getElementById('table3d-section');
        if (!mount) return;
        if (story.parentElement !== mount) mount.appendChild(story);
        previousFocus = document.activeElement;
        story.hidden = false;
        story.querySelector('button').focus();
    };
    client.state.socket.on('room left', close);
}
