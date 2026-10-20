import { client } from '../core/client.js';

client.actions.showSelectPlayerPopup = function showSelectPlayerPopup(title, playerList, callback, cardObj = null, actionType = null) {
    // Remove existing modal if any
    const oldModal = document.querySelector('.modal.select-player-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal select-player-modal';
    if (document.body.classList.contains('game-view-3d') && !document.body.classList.contains('table3d-unavailable')) modal.classList.add('table3d-direct-target');
    const targetThemes = {
        Red: { accent: '#f87171', rgb: '248, 113, 113' },
        Green: { accent: '#86efac', rgb: '134, 239, 172' },
        Blue: { accent: '#7dd3fc', rgb: '125, 211, 252' },
    };
    const theme = actionType === 'witch'
        ? targetThemes.Red
        : actionType === 'constable'
            ? targetThemes.Blue
            : (targetThemes[cardObj?.color] || { accent: '#c1a37b', rgb: '193, 163, 123' });
    modal.style.setProperty('--target-accent', theme.accent);
    modal.style.setProperty('--target-accent-rgb', theme.rgb);
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.65)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    // Close on click outside
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    // Close on ESC
    function escListener(e) {
        if (e.key === 'Escape') {
            if (document.body.contains(modal)) document.body.removeChild(modal);
            document.removeEventListener('keydown', escListener);
        }
    }
    document.addEventListener('keydown', escListener);
    const removalObserver = new MutationObserver(() => {
        if (!modal.isConnected) {
            document.removeEventListener('keydown', escListener);
            removalObserver.disconnect();
        }
    });
    removalObserver.observe(document.body, { childList: true });

    const content = document.createElement('div');
    content.className = 'select-player-modal-content';
    content.style.background = 'linear-gradient(160deg, #292522 0%, #171513 100%)';
    content.style.color = '#f5eee4';
    content.style.padding = '14px 10px';
    content.style.borderRadius = '12px';
    content.style.boxShadow = `0 16px 48px rgba(0,0,0,.75), 0 0 22px rgba(${theme.rgb},.18)`;
    content.style.textAlign = 'center';
    content.style.minWidth = '0';
    content.style.maxWidth = '240px';
    content.style.width = '100%';
    content.style.maxHeight = '75vh';
    content.style.overflowY = 'auto';
    content.style.position = 'relative';
    content.style.border = `2px solid ${theme.accent}`;
    content.style.fontSize = '0.9em';

    const titleElem = document.createElement('h3');
    titleElem.textContent = title;
    titleElem.style.color = theme.accent;
    titleElem.style.fontWeight = 'bold';
    titleElem.style.marginBottom = '10px';
    titleElem.style.fontSize = '1.02em'; // เดิม 1.13em ลดลง 10%
    content.appendChild(titleElem);
    if (cardObj) {
        const overview = document.createElement('div');
        overview.className = 'target-card-overview';
        const name = document.createElement('strong');
        name.textContent = client.actions.displayCardName(cardObj.name);
        const description = document.createElement('p');
        description.textContent = client.actions.displayCardDescription(cardObj.name);
        overview.append(name, description);
        content.appendChild(overview);
    }

    const listDiv = document.createElement('div');
    listDiv.style.display = 'flex';
    listDiv.style.flexDirection = 'column';
    listDiv.style.justifyContent = 'center';
    listDiv.style.gap = '8px';
    listDiv.style.marginBottom = '14px';

    // กรองเฉพาะผู้เล่นที่ alive
    let alivePlayers = playerList.filter(p => p.alive);
    if (cardObj && cardObj.color === 'Blue') {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== client.state.myUniqueId);
    } else if (cardObj && ['Red','Green','Blue'].includes(cardObj.color)) {
        alivePlayers = alivePlayers.filter(p => p.uniqueId !== client.state.myUniqueId);
    }
    if (actionType === 'constable') {
        alivePlayers = alivePlayers.filter(p => !p.inPlayCards || !p.inPlayCards.some(card => card === 'Asylum' || card.name === 'Asylum'));
    }


    let selectedId = null;
    const isRedCard = cardObj && (cardObj.color === 'Red' || ['Accusation', 'Evidence', 'Witness'].includes(cardObj.name));
    const blockedReason = player => {
        if(!isRedCard || !player) return '';
        if(player.inPlayCards?.some(card=>(card.name || card)==='Piety')) return 'พลังศรัทธา · กันการ์ดแดง';
        return '';
    };
    const isProtected = player => !!blockedReason(player);
    const targetHint = document.createElement('p');
    targetHint.style.color = '#fcd34d';
    targetHint.style.fontSize = '0.9em';
    targetHint.setAttribute('role', 'status');
    if (alivePlayers.some(isProtected)) {
        targetHint.textContent = alivePlayers.every(isProtected)
            ? 'ไม่มีเป้าหมายที่ใช้ชุดนี้ได้ · ผู้เล่นได้รับการป้องกัน'
            : 'เลือกเป้าหมายที่ไม่ถูกป้องกัน · ครบหรือเกิน 7 แต้มเปิดการ์ดชีวิต 1 ใบ';
    }
    content.appendChild(targetHint);
    alivePlayers.forEach(player => {
        const protectedTarget = isProtected(player);
        const btn = document.createElement('div');
        btn.className = 'player-select-card';
        btn.dataset.uniqueId = player.uniqueId;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-disabled', String(!!protectedTarget));
        btn.tabIndex = protectedTarget ? -1 : 0;
        btn.style.background = `linear-gradient(135deg, rgba(${theme.rgb},.16), #28231f)`;
        btn.style.color = '#f5eee4';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1.02em';
        btn.style.padding = '8px 8px 6px 8px';
        btn.style.borderRadius = '9px';
        btn.style.margin = '0 auto';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 3px 12px rgba(0,0,0,.28)';
        btn.style.transition = 'all 0.13s';
        btn.style.minWidth = '0';
        btn.style.maxWidth = '210px';
        btn.style.width = '100%';
        btn.style.height = '57px';
        btn.style.display = 'flex';
        btn.style.flexDirection = 'row';
        btn.style.alignItems = 'center';
        btn.style.position = 'relative';
        btn.style.border = `1px solid rgba(${theme.rgb},.55)`;
        // Highlight current turn
        if (client.state.currentRoomState && client.state.currentRoomState.currentTurnPlayerUniqueId === player.uniqueId) {
            btn.innerHTML += `<span style="color:${theme.accent};font-size:1.08em;position:absolute;top:6px;right:10px;">🔥</span>`;
        }
        // Icon (profile or emoji)
        btn.innerHTML += `<div style=\"font-size:1.3em;margin-right:10px;\">👤</div>`;
        // Name + status
        let info = `<div style=\"display:flex;flex-direction:column;align-items:flex-start;justify-content:center;\">`;
        info += `<span style=\"font-weight:bold;font-size:0.97em;color:${theme.accent};\">${player.name}</span>`;
        info += `<span style=\"font-size:0.88em;color:#fff;opacity:0.95;\">การ์ด: ${player.handSize} | ชีวิต: ${player.tryalCardCount}`;
        // คำนวณคะแนนข้อกล่าวหา
        if (player.inPlayCards && player.inPlayCards.length > 0) {
            let accusationPoints = 0;
            player.inPlayCards.forEach(c => {
                if (c.name === 'Accusation' || c === 'Accusation') accusationPoints += 1;
                if (c.name === 'Evidence' || c === 'Evidence') accusationPoints += 3;
            });
            if (accusationPoints > 0) {
                info += ` | กล่าวหา: ${accusationPoints}`;
            }
        }
        info += `</span>`;
        if (player.inPlayCards && player.inPlayCards.length > 0) {
            // แสดงชื่อการ์ดอื่นๆ (ยกเว้น Accusation/Evidence)
            const statusText = player.inPlayCards.map(c => {
                if (c.name === 'Accusation' || c === 'Accusation') {
                    return null;
                } else if (c.name === 'Evidence' || c === 'Evidence') {
                    return null;
                } else {
                    return client.actions.getCardNameTH(c);
                }
            }).filter(Boolean).join(', ');
            if (statusText) {
                info += `<span style='font-size:0.84em;color:#fcd34d;'>${statusText}</span>`;
            }
        }
        info += `</div>`;
        btn.innerHTML += info;
        if (protectedTarget) {
            const reason = document.createElement('span');
            reason.textContent = blockedReason(player);
            reason.style.cssText = 'display:block;color:#ffd57c;font-size:.84em;font-weight:bold;';
            btn.lastElementChild?.appendChild(reason);
            btn.style.cursor = 'not-allowed';
            btn.style.background = '#24211e';
            btn.style.borderColor = '#81705a';
            btn.style.height = 'auto';
            btn.style.minHeight = '65px';
        }
        btn.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); btn.click(); }
        });
        btn.addEventListener('mouseover', () => {
            // ไม่เปลี่ยนสีหรือขอบเมื่อ hover
        });
        btn.addEventListener('mouseout', () => {
            // ไม่เปลี่ยนสีหรือขอบเมื่อ mouseout
        });
        btn.addEventListener('click', () => {
            if (protectedTarget || isProtected(client.state.currentRoomState?.players?.[player.uniqueId] || player)) {
                targetHint.textContent = blockedReason(client.state.currentRoomState?.players?.[player.uniqueId] || player);
                return;
            }
            // Remove highlight from all
            listDiv.querySelectorAll('.player-select-card').forEach(el => {
                el.style.transform = '';
                el.classList.remove('selected');
            });
            btn.style.transform = 'scale(1.02)';
            btn.classList.add('selected');
            selectedId = player.uniqueId;
            confirmBtn.disabled = false;
            targetHint.textContent = `เลือก: ${player.name} · ${client.actions.cardOutcomePreview?.(cardObj, player) || ''}`;
            confirmBtn.textContent = title.startsWith('1/2') ? 'เลือกต้นทางนี้ →'
                : title.startsWith('2/2') ? `ยืนยันผู้รับ: ${player.name}`
                : cardObj ? `ใช้${client.actions.displayCardName(cardObj.name)}กับ ${player.name}` : 'ยืนยันเป้าหมาย';
        });
        listDiv.appendChild(btn);
    });
    content.appendChild(listDiv);

    // Confirm button
    const footer = document.createElement('div');
    footer.className = 'target-selection-footer';
    footer.setAttribute('role', 'group');
    footer.setAttribute('aria-label', 'ยืนยันการเลือกเป้าหมาย');
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'target-confirm-btn';
    confirmBtn.textContent = 'ยืนยันเป้าหมาย';
    confirmBtn.style.background = `linear-gradient(90deg, ${theme.accent}, rgba(${theme.rgb},.72))`;
    confirmBtn.style.color = '#201812';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.fontSize = '0.97em'; // เดิม 1.08em
    confirmBtn.style.padding = '8px 20px';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '7px';
    confirmBtn.style.boxShadow = `0 4px 14px rgba(${theme.rgb},.24)`;
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.marginTop = '6px';
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => {
        if (isProtected(client.state.currentRoomState?.players?.[selectedId])) {
            targetHint.textContent = blockedReason(client.state.currentRoomState?.players?.[selectedId]);
            selectedId = null;
            confirmBtn.disabled = true;
            return;
        }
        if (selectedId) {
            if (document.body.contains(modal)) document.body.removeChild(modal);
            callback(selectedId);
        }
    });
    footer.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'target-cancel-btn';
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.marginTop = '6px';
    cancelBtn.style.background = '#616161';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '0.97em'; // เดิม 1.08em
    cancelBtn.style.padding = '8px 20px';
    cancelBtn.style.borderRadius = '7px';
    cancelBtn.style.border = 'none';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', () => {
        if (document.body.contains(modal)) document.body.removeChild(modal);
    });
    footer.appendChild(cancelBtn);
    content.appendChild(footer);

    modal.appendChild(content);
    document.body.appendChild(modal);
};

export function initialize() {

}
