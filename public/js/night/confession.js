import { registerLifeInteraction } from '../core/interaction.js';
import { client } from '../core/client.js';

client.actions.showConfessPopup = function showConfessPopup(tryalCards) {
    // Remove any existing popups to prevent overlapping
    const existing = document.getElementById('confess-popup');
    if (existing) existing.remove();
    const existingOverlay = document.getElementById('confess-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    if (!tryalCards || tryalCards.length === 0 || client.state.currentRoomState?.confessionExempt) return;

    // Confession starts a new life-selection step; previous reveal/pick dialogs
    // must not survive and become actionable again after confession closes.
    document.querySelectorAll('[data-life-owner]').forEach(popup => {
        (popup.closest('.tryal-modal-overlay') || popup).remove();
    });
    client.state.table3DLifeChoice = null;

    const overlay = document.createElement('div');
    overlay.id = 'confess-overlay';
    overlay.className = 'tryal-modal-overlay';

    const popup = document.createElement('div');
    popup.id = 'confess-popup';
    popup.dataset.lifeOwner = client.state.myUniqueId;
    popup.className = 'tryal-selection-popup';

    const title = document.createElement('h3');
    title.textContent = 'คืนนี้จะสารภาพหรือข้าม?';
    popup.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = tryalCards.length === 1
        ? 'สารภาพได้แม้เหลือ 1 ใบ แต่การเปิดใบสุดท้ายจะทำให้คุณเสียชีวิต · เลือกเปิดหรือข้ามได้'
        : 'เลือกการ์ดชีวิต 1 ใบหรือข้าม ระบบจะรอทุกคนตัดสินใจครบ แล้วจึงเปิดการ์ดและเฉลยผลกลางคืน';
    subtitle.style = 'color: #d7ccc8; font-size: 0.95em; margin-top: -6px; margin-bottom: 16px;';
    popup.appendChild(subtitle);
    const protections = client.state.currentRoomState?.confessionProtections || [];
    if (protections.length) {
        const announcement = document.createElement('p'); announcement.className = 'confession-protection-list';
        announcement.textContent = 'ไม่ต้องสารภาพคืนนี้: ' + protections.map(p => `${p.name} (${p.reasons.join(' และ ')})`).join(' · ');
        popup.appendChild(announcement);
    }

    const guide=document.createElement('div');guide.className='confession-options-guide';
    guide.textContent='สารภาพ: เปิดชีวิต 1 ใบเพื่อกันการฆ่าคืนนี้ · ข้าม: เก็บชีวิตไว้ แต่เสี่ยงถูกฆ่า';popup.append(guide);
    const lifeCommands = new Map();
    let selectedIndex = null;
    const confirm=document.createElement('button');confirm.type='button';confirm.className='confession-confirm';confirm.disabled=true;confirm.textContent='เลือกการ์ดชีวิตก่อน';
    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards-container';

    tryalCards.forEach((card, i) => {
        const btn = document.createElement('button');
        btn.className = 'tryal-card-btn';
        btn.dataset.lifeIndex = i;
        btn.innerHTML = `<span style="font-size:1.4em;margin-bottom:6px;">🎴</span><span>ใบที่ ${i+1}</span>`;
        const submit = () => {
            client.state.socket.emit('confess tryal card', i);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
        };
        btn.setAttribute('aria-pressed','false');
        btn.onclick = () => {
            selectedIndex = i;
            cardsDiv.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.lifeIndex)===i)));
            confirm.disabled=false;confirm.textContent=`ยืนยันสารภาพ · เปิดใบที่ ${i+1}`;
        };
        lifeCommands.set(i, submit);
        cardsDiv.appendChild(btn);
    });
    popup.appendChild(cardsDiv);
    confirm.onclick=()=>{if(selectedIndex!==null)lifeCommands.get(selectedIndex)?.();};
    popup.append(confirm);

    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.id = 'skip-confess-button';
    skipBtn.className = 'tryal-popup-action-btn action-btn';
    skipBtn.textContent = 'ข้าม · ไม่เปิดการ์ดชีวิต';
    skipBtn.onclick = () => {
        client.state.socket.emit('skip confession');
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    };
    popup.appendChild(skipBtn);

    client.actions.addTryalPopupCollapseControl(popup, overlay, title);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    registerLifeInteraction(popup, client.state.myUniqueId, lifeCommands, skipBtn.onclick);
};

export function initialize() {

}
