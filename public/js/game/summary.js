import { client } from '../core/client.js';

client.actions.resetGameOverSummary = function resetGameOverSummary() {
    client.state.latestGameOverSummary = null;
    client.state.gameOverSummaryDismissed = false;
    if (client.dom.reopenGameSummaryButton) client.dom.reopenGameSummaryButton.style.display = 'none';
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.style.display = 'none';
};

client.actions.showGameOverModal = function showGameOverModal(data) {
    if (!data) return;
    client.actions.changePhaseMusic?.('GAME_OVER');
    const summary = data.gameSummary || data;
    client.state.latestGameOverSummary = summary;
    if (client.state.gameOverSummaryDismissed) return;
    const modal = document.getElementById('game-over-modal');
    if (!modal) return;

    // ลบ popup เดิมถ้ามี
    const oldPopup = document.getElementById('game-over-popup');
    if (oldPopup) oldPopup.remove();

    const victoryBadge = document.getElementById('victory-badge');
    const victoryTitle = document.getElementById('victory-title');
    const victoryMessage = document.getElementById('victory-message');
    const rolesRevealTbody = document.getElementById('roles-reveal-tbody');
    const rematchBtn = document.getElementById('rematch-btn');
    const closeBtn = document.getElementById('close-victory-modal-btn');

    const winner = summary.winner || '';
    const isWitchWin = winner.toLowerCase().includes('witch') || winner.includes('ปอบ');
    const isTownWin = winner.toLowerCase().includes('town') || winner.includes('ชาวบ้าน');

    if (isWitchWin) {
        if (victoryBadge) victoryBadge.textContent = '🧙‍♀️ ฝ่ายปอบเป็นผู้ชนะ!';
        if (victoryTitle) {
            victoryTitle.className = 'victory-title witch-win';
            victoryTitle.textContent = 'เหล่าปอบยึดครองหมู่บ้านสำเร็จ!';
        }
    } else if (isTownWin) {
        if (victoryBadge) victoryBadge.textContent = '🏆 ฝ่ายชาวบ้านเป็นผู้ชนะ!';
        if (victoryTitle) {
            victoryTitle.className = 'victory-title townsfolk-win';
            victoryTitle.textContent = 'ชาวบ้านกำจัดปอบได้สำเร็จ!';
        }
    } else {
        if (victoryBadge) victoryBadge.textContent = '⚖️ สรุปผลการเล่น';
        if (victoryTitle) {
            victoryTitle.className = 'victory-title';
            victoryTitle.textContent = winner || 'เกมสิ้นสุดลงแล้ว';
        }
    }

    if (victoryMessage) {
        victoryMessage.innerHTML = summary.message || 'การต่อสู้อันดุเดือดระหว่างชาวบ้านและปอบได้จบลงแล้ว';
    }

    // Render Roles Reveal Table
    if (rolesRevealTbody) {
        let rowsHtml = '';
        const rawPlayers = summary.players || {};
        const playerList = Array.isArray(rawPlayers) ? rawPlayers : Object.values(rawPlayers);
        const sortedPlayers = [...playerList].sort((a, b) => a.name.localeCompare(b.name));

        sortedPlayers.forEach(p => {
            let roleBadge = '';
            if (p.hasBeenWitch || p.role === 'Witch' || p.isWitch) {
                roleBadge = '<span class="role-tag witch">ปอบ 🧙‍♀️</span>';
            } else {
                roleBadge = '<span class="role-tag town">ชาวบ้าน 🌾</span>';
            }

            const statusText = p.alive
                ? '<span style="color:#81c784;font-weight:600;">รอดชีวิต</span>'
                : '<span style="color:#e57373;font-weight:600;">เสียชีวิต</span>';

            const tryalCards = Array.isArray(p.tryalCards) ? p.tryalCards : [];
            const opened = Array.isArray(p.revealedTryalCards) ? p.revealedTryalCards : [];
            const allCards = [...tryalCards.map(card => ({ card, opened: false })), ...opened.map(card => ({ card, opened: true }))];
            const tryalPills = allCards.map(({ card: tc, opened }) => {
                const cardName = typeof tc === 'string' ? tc : tc.name;
                let pillClass = 'not-witch';
                let cardTh = client.actions.displayCardName(cardName);
                if (cardName === 'Witch') {
                    pillClass = 'witch';
                    cardTh = 'ปอบ';
                } else if (cardName === 'Constable') {
                    pillClass = 'constable';
                    cardTh = 'หมอผี';
                }
                return `<span class="tryal-pill ${pillClass}${opened ? ' opened-tryal' : ''}" title="${opened ? 'เปิดระหว่างเกม' : 'ไพ่ที่เหลือตอนจบเกม'}">${cardTh}${opened ? ' · เปิดแล้ว' : ''}</span>`;
            }).join('');

            rowsHtml += `
                <tr>
                    <td style="font-weight:600;">${p.name}</td>
                    <td>${roleBadge}</td>
                    <td>${statusText}</td>
                    <td><div class="tryal-pill-container">${tryalPills || '-'}</div></td>
                </tr>
            `;
        });
        rolesRevealTbody.innerHTML = rowsHtml;
        let countNote = document.getElementById('summary-witch-card-count');
        if (!countNote) { countNote = document.createElement('p'); countNote.id = 'summary-witch-card-count'; rolesRevealTbody.closest('table')?.before(countNote); }
        const cardName = card => typeof card === 'string' ? card : card.name;
        const remaining = playerList.reduce((n,p) => n+(p.tryalCards || []).filter(c=>cardName(c)==='Witch').length,0);
        const opened = playerList.reduce((n,p) => n+(p.revealedTryalCards || []).filter(c=>cardName(c)==='Witch').length,0);
        countNote.textContent = `${summary.initialWitchCardCount != null ? `ปอบเริ่มต้น ${summary.initialWitchCardCount} ใบ · ` : ''}เปิดระหว่างเกม ${opened} ใบ · อยู่ในไพ่ที่เหลือตอนจบ ${remaining} ใบ`;

    }

    let infections = document.getElementById('summary-infections');
    if (!infections) {
        infections = document.createElement('section'); infections.id='summary-infections';
        rolesRevealTbody?.closest('table')?.after(infections);
    }
    infections.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='เส้นทางแพร่เชื้อปอบ';infections.append(heading);
    const log=summary.infectionLog || data.infectionLog || [];
    if(log.length) {
        const list=document.createElement('ol');
        for(const event of log) {
            const item=document.createElement('li');
            item.textContent=`วันที่ ${event.day ?? '?'} · ${event.from} → ${event.to}`;
            list.append(item);
        }
        infections.append(list);
        const note=document.createElement('p');note.textContent='ลูกศรแสดงผู้ส่ง → ผู้รับการ์ดปอบจากพิธีเซ่นไหว้ ตามลำดับเหตุการณ์';infections.append(note);
    } else {
        const empty=document.createElement('p');empty.textContent='ไม่มีการส่งต่อการ์ดปอบจากพิธีเซ่นไหว้ในเกมนี้';infections.append(empty);
    }

    // Rematch Actions
    const isMeHost = (client.state.currentRoomState && client.state.currentRoomState.hostUniqueId === client.state.myUniqueId);
    if (rematchBtn) {
        if (isMeHost) {
            rematchBtn.style.display = 'inline-block';
            rematchBtn.onclick = () => {
                if (client.state.currentRoomName) {
                    client.state.socket.emit('restart game', client.state.currentRoomName);
                }
                modal.style.display = 'none';
            };
        } else {
            rematchBtn.style.display = 'none';
        }
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            client.state.gameOverSummaryDismissed = true;
            if (client.dom.reopenGameSummaryButton) client.dom.reopenGameSummaryButton.style.display = 'inline-flex';
        };
    }

    if (client.dom.reopenGameSummaryButton) client.dom.reopenGameSummaryButton.style.display = 'none';
    modal.style.display = 'flex';
};

client.actions.showGameOverStats = function showGameOverStats(roomState) {
    client.actions.showGameOverModal(roomState.gameSummary || roomState);
};

client.actions.returnToLobby = function returnToLobby() {
    // ลบ popup สถิติ
    const statsPopup = document.querySelector('.stats-popup');
    if (statsPopup) {
        statsPopup.remove();
    }
    
    // ออกจากห้องปัจจุบัน
    if (client.state.currentRoomName) {
        client.state.socket.emit('leave room');
    }
    
    // แสดงหน้า Lobby
    client.dom.roomLobbySection.style.display = 'block';
    client.dom.gameSection.style.display = 'none';
    
    // รีเซ็ตสถานะเกม
    client.state.currentRoomName = null;
    try { sessionStorage.removeItem('currentRoomName'); } catch (e) {}
    client.state.myPlayerName = null;
    client.state.isMyTurn = false;
    client.state.selectedCard = null;
    client.state.myCurrentHand = [];
    client.state.myTryalCards = [];
    client.state.myRevealedTryalCardIndexes = [];
    
    // ล้างข้อความเกม
    client.dom.gameMessagesDiv.innerHTML = '';
    
    client.actions.addGameMessage('กลับไปหน้า Lobby แล้ว', 'blue');
};

client.actions.goToNameSetup = function goToNameSetup() {
    // ลบ popup สถิติ
    const statsPopup = document.querySelector('.stats-popup');
    if (statsPopup) {
        statsPopup.remove();
    }
    
    // ออกจากห้องปัจจุบัน
    if (client.state.currentRoomName) {
        client.state.socket.emit('leave room');
    }
    
    // แสดงหน้าตั้งชื่อ
    client.dom.roomManagementSection.style.display = 'block';
    client.dom.roomLobbySection.style.display = 'none';
    client.dom.gameSection.style.display = 'none';
    
    // รีเซ็ตชื่อผู้เล่น
    client.state.myPlayerName = null;
    client.dom.nameInput.value = '';
    client.dom.nameInputContainer.style.display = 'flex';
    
    // รีเซ็ตสถานะเกม
    client.state.currentRoomName = null;
    try { sessionStorage.removeItem('currentRoomName'); } catch (e) {}
    client.state.isMyTurn = false;
    client.state.selectedCard = null;
    client.state.myCurrentHand = [];
    client.state.myTryalCards = [];
    client.state.myRevealedTryalCardIndexes = [];
    
    // ล้างข้อความเกม
    client.dom.gameMessagesDiv.innerHTML = '';
    
    client.actions.addGameMessage('ไปหน้าตั้งชื่อใหม่แล้ว', 'blue');
};

export function initialize() {
  client.state.latestGameOverSummary = null;

  client.state.gameOverSummaryDismissed = false;

  client.dom.reopenGameSummaryButton = document.getElementById('reopen-game-summary-btn');

  client.dom.reopenGameSummaryButton?.addEventListener('click', () => {
      client.state.gameOverSummaryDismissed = false;
      client.actions.showGameOverModal(client.state.latestGameOverSummary);
  });

  client.state.socket.on('room left', client.actions.resetGameOverSummary);

  client.state.socket.on('game over summary', (summary) => {
      client.actions.showGameOverModal(summary);
  });

  client.state.socket.on('game restarted', () => {
      client.actions.resetGameOverSummary();
      const modal = document.getElementById('game-over-modal');
      if (modal) modal.style.display = 'none';
      const oldPopup = document.getElementById('game-over-popup');
      if (oldPopup) oldPopup.remove();

      document.body.classList.remove('in-game');
      if (client.dom.gameSection) client.dom.gameSection.style.display = 'none';
      if (client.dom.roomLobbySection) client.dom.roomLobbySection.style.display = 'block';
      client.actions.addGameMessage('หัวห้องได้เริ่มรอบใหม่แล้ว! กลับสู่หน้าล็อบบี้', 'green', true);
  });
}
