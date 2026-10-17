import { client } from '../core/client.js';

client.actions.showAssignBlackCatPopup = function showAssignBlackCatPopup(potentialTargets) {
    if (!potentialTargets || potentialTargets.length === 0) return;
    const old = document.getElementById('assign-blackcat-popup');
    if (old) old.remove();
    const oldOverlay = document.getElementById('assign-blackcat-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'assign-blackcat-overlay';
    overlay.className = 'tryal-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '9998';
    overlay.style.background = 'rgba(10, 8, 8, 0.85)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.boxSizing = 'border-box';

    const container = document.createElement('div');
    container.id = 'assign-blackcat-popup';
    container.dataset.playerSelect = 'true';
    container.style.background = 'radial-gradient(circle at top, #2b1f1a 0%, #171210 60%, #0d0a09 100%)';
    container.style.border = '2px solid #8d6e63';
    container.style.borderRadius = '16px';
    container.style.padding = '24px 20px';
    container.style.maxWidth = '420px';
    container.style.width = '100%';
    container.style.boxShadow = '0 16px 40px rgba(0,0,0,0.85), 0 0 24px rgba(183,28,28,0.3)';
    container.style.textAlign = 'center';
    container.style.boxSizing = 'border-box';
    container.style.color = '#e0d7cd';

    const title = document.createElement('h3');
    title.innerHTML = '🕯️ ปอบเลือกผู้รับการ์ดเครื่องเซ่น';
    title.style.fontFamily = "'Creepster', 'Noto Serif Thai', serif";
    title.style.color = '#ffb74d';
    title.style.fontSize = '1.5em';
    title.style.margin = '0 0 8px 0';
    title.style.textShadow = '0 2px 10px rgba(0,0,0,0.8)';
    container.appendChild(title);

    // Witch team members info
    if (client.state.currentRoomState && client.state.currentRoomState.players) {
        const witchTeam = Object.values(client.state.currentRoomState.players).filter(p => p.hasBeenWitch || p.isWitch);
        if (witchTeam.length > 0) {
            const witchList = document.createElement('div');
            witchList.style.background = 'rgba(183, 28, 28, 0.2)';
            witchList.style.border = '1px solid rgba(229, 115, 115, 0.4)';
            witchList.style.color = '#ffcdd2';
            witchList.style.padding = '6px 12px';
            witchList.style.borderRadius = '8px';
            witchList.style.marginBottom = '14px';
            witchList.style.fontSize = '0.9em';
            witchList.style.fontWeight = '600';
            witchList.innerHTML = '👥 สมาชิกทีมปอบ: <span style="color:#fff;">' + witchTeam.map(p => p.name).join(', ') + '</span>';
            container.appendChild(witchList);
        }
    }

    const subtitle = document.createElement('p');
    subtitle.textContent = 'เลือกผู้เล่นที่จะเริ่มต้นเกมด้วยการ์ดเครื่องเซ่น:';
    subtitle.style.color = '#d7ccc8';
    subtitle.style.fontSize = '0.95em';
    subtitle.style.margin = '0 0 14px 0';
    container.appendChild(subtitle);

    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '12px 14px';
    select.style.fontSize = '1em';
    select.style.borderRadius = '8px';
    select.style.border = '1.5px solid #8d6e63';
    select.style.background = '#251e1c';
    select.style.color = '#fff';
    select.style.marginBottom = '18px';
    select.style.outline = 'none';
    select.style.boxSizing = 'border-box';
    select.innerHTML = '<option value="">-- แตะเพื่อเลือกผู้เล่น --</option>';

    potentialTargets.forEach(target => {
        const option = document.createElement('option');
        option.value = target.uniqueId;
        option.textContent = target.name;
        select.appendChild(option);
    });
    container.appendChild(select);

    const btn = document.createElement('button');
    btn.dataset.assignBlackcatConfirm = 'true';
    btn.innerHTML = '✅ ยืนยันการมอบการ์ดเครื่องเซ่น';
    btn.style.width = '100%';
    btn.style.padding = '12px 20px';
    btn.style.fontSize = '1.05em';
    btn.style.fontWeight = 'bold';
    btn.style.background = 'linear-gradient(135deg, #b71c1c 0%, #880e4f 100%)';
    btn.style.color = '#fff';
    btn.style.border = '1px solid #ef5350';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 14px rgba(183, 28, 28, 0.4)';
    btn.style.transition = 'all 0.2s ease';
    btn.style.boxSizing = 'border-box';

    btn.onclick = () => {
        if (select.value) {
            client.state.socket.emit('assign black cat', select.value);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        } else {
            alert('กรุณาเลือกผู้เล่นก่อนยืนยัน!');
        }
    };
    container.appendChild(btn);

    client.actions.addTryalPopupCollapseControl(container, overlay, title);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
};

client.actions.removeNightActionPopup = function removeNightActionPopup() {
    const existingPopup = document.getElementById('night-action-popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    const existingOverlay = document.getElementById('night-action-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
};

client.actions.createNightActionPopup = function createNightActionPopup(actionType, timer) {
    console.log('createNightActionPopup called with actionType:', actionType, 'timer:', timer);
    
    // Remove existing popup & overlay if any
    client.actions.removeNightActionPopup();
    client.state.nightActionState.actionType = actionType;
    client.state.nightActionState.selectedTargetId = actionType === 'witch'
        ? (client.state.currentRoomState?.witchNightState?.marks?.[client.state.myUniqueId] || null) : null;
    
    const overlay = document.createElement('div');
    overlay.id = 'night-action-overlay';
    overlay.className = 'night-action-overlay';

    const popup = document.createElement('div');
    popup.id = 'night-action-popup';
    popup.className = `night-action-modal ${actionType === 'witch' ? 'theme-witch-night' : 'theme-constable-night'}`;
    
    const icon = actionType === 'witch' ? '🩸' : '🛡️';
    const title = actionType === 'witch' ? 'ปอบ — เลือกเป้าหมายสังหาร' : 'หมอผี — เลือกผู้เล่นเพื่อปกป้อง';
    const subtitle = actionType === 'witch'
        ? 'แตะเพื่อมาร์คให้ทีมเห็น ยังไม่ฆ่าจริง · ปอบคนใดก็กดฆ่าแล้วคอนเฟิร์มอีกครั้งได้'
        : 'เลือกผู้เล่น 1 คนเพื่อคุ้มครองจากเงื้อมมือของปอบ';
    
    popup.innerHTML = `
        <div class="night-action-header">
            <div class="night-action-title-row">
                <h2 class="night-action-title">${icon} ${title}</h2>
                <button type="button" class="popup-collapse-toggle action-btn" aria-expanded="true" aria-label="ย่อหน้าต่าง">ย่อ</button>
            </div>
            <div class="night-action-subtitle">${subtitle}</div>
        </div>
        <div class="night-action-content">
            <div id="night-action-witch-team-container"></div>
            <div id="night-action-players-list" class="night-targets-scroll"></div>
            ${actionType === 'witch' ? `
            <div class="modal-witch-chat-section" id="modal-witch-chat-section">
                <div class="modal-witch-chat-header">
                    <span>💬 แชทปรึกษาทีมปอบ</span>
                    <span class="modal-witch-chat-sub">คุยสดกับเพื่อนปอบก่อนยืนยัน</span>
                </div>
                <div id="modal-witch-chat-messages" class="modal-witch-chat-messages"></div>
                <div class="modal-witch-chat-input-bar">
                    <input type="text" id="modal-witch-chat-input" placeholder="พิมพ์ข้อความปรึกษาเพื่อนปอบ..." maxlength="100">
                    <button type="button" id="modal-witch-chat-send" class="btn btn-sm btn-danger">ส่ง</button>
                </div>
            </div>
            ` : ''}
            <div class="night-action-footer">
                <button id="confirm-night-action" class="night-confirm-btn" style="display: none;">
                    ${actionType === 'witch' ? '🩸 ฆ่าเป้าหมายที่เลือก…' : 'ยืนยันการเลือก'}
                </button>
            </div>
        </div>
    `;

    const collapseButton = popup.querySelector('.popup-collapse-toggle');
    client.actions.wirePopupCollapseControl(collapseButton, popup, overlay);
    
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // แสดงรายชื่อทีมปอบ (ถ้ามี)
    if (actionType === 'witch' && client.state.currentRoomState && client.state.currentRoomState.players) {
        const witchTeam = Object.values(client.state.currentRoomState.players).filter(p => p.hasBeenWitch);
        if (witchTeam.length > 0) {
            const teamContainer = popup.querySelector('#night-action-witch-team-container');
            if (teamContainer) {
                const witchList = document.createElement('div');
                witchList.className = 'night-witch-team-box';
                witchList.innerHTML = '🤝 สมาชิกทีมปอบ: <strong>' + witchTeam.map(p => p.name).join(', ') + '</strong>';
                teamContainer.appendChild(witchList);
            }
        }

        // เชื่อมต่อแชทปอบในโมดอล
        const modalChatInput = popup.querySelector('#modal-witch-chat-input');
        const modalChatSend = popup.querySelector('#modal-witch-chat-send');
        const modalChatMessages = popup.querySelector('#modal-witch-chat-messages');

        if (modalChatMessages && client.dom.witchChatMessages) {
            modalChatMessages.innerHTML = client.dom.witchChatMessages.innerHTML;
            modalChatMessages.scrollTop = modalChatMessages.scrollHeight;
        }

        const sendFromModal = () => {
            if (!modalChatInput) return;
            const state = client.state.currentRoomState;
            const me = state?.players?.[client.state.myUniqueId];
            if (!client.state.socket.connected || state?.currentPhase !== 'NIGHT' || !me?.alive || !me.hasBeenWitch) return;
            const msg = modalChatInput.value.trim();
            if (msg && client.state.currentRoomName) {
                client.state.socket.emit('send witch chat message', client.state.currentRoomName, msg);
                modalChatInput.value = '';
            }
        };

        if (modalChatSend) modalChatSend.onclick = sendFromModal;
        if (modalChatInput) {
            modalChatInput.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    sendFromModal();
                }
            };
        }
    }

    // Populate players list
    console.log('Calling populateNightActionPlayersList');
    client.actions.populateNightActionPlayersList(actionType);
    client.actions.updateWitchNightMarks();
};

client.actions.updateWitchNightMarks = function updateWitchNightMarks() {
    const state = client.state.currentRoomState?.witchNightState;
    const popup = document.getElementById('night-action-popup');
    if (!state || !popup || client.state.nightActionState.actionType !== 'witch') return;
    const members = new Map((state.members || []).map(member => [member.uniqueId, member.name]));
    popup.querySelectorAll('.night-target-row').forEach(row => {
        let marks = row.querySelector('.night-target-marks');
        if (!marks) {
            marks = document.createElement('div');
            marks.className = 'night-target-marks';
            row.querySelector('.night-target-info')?.appendChild(marks);
        }
        const names = Object.entries(state.marks || {})
            .filter(([id, target]) => target === row.dataset.uniqueId && members.has(id))
            .map(([id]) => `${members.get(id)}${id === client.state.myUniqueId ? ' (คุณ)' : ''}`);
        marks.textContent = names.length ? `🎯 มาร์คโดย: ${names.join(', ')}` : '';
        row.classList.toggle('team-marked', names.length > 0);
        row.classList.toggle('selected', row.dataset.uniqueId === client.state.nightActionState.selectedTargetId);
        const badge = row.querySelector('.night-target-badge');
        if (badge) badge.textContent = row.dataset.uniqueId === client.state.nightActionState.selectedTargetId ? '✓ มาร์คของคุณ' : 'แตะมาร์ค';
    });
    const confirmBtn = popup.querySelector('#confirm-night-action');
    if (confirmBtn) confirmBtn.style.display = client.state.nightActionState.selectedTargetId ? 'inline-block' : 'none';
};

client.actions.showWitchKillConfirmation = function showWitchKillConfirmation(targetId) {
    const state = client.state.currentRoomState?.witchNightState;
    const target = client.state.currentRoomState?.players?.[targetId];
    if (!state || state.committed || (targetId !== null && !target?.alive)) return;
    if (targetId === null && !Object.prototype.hasOwnProperty.call(state.marks || {}, client.state.myUniqueId)) {
        client.state.socket.emit('witch mark target', null, state.nightId);
    } else if (state.marks?.[client.state.myUniqueId] !== targetId) {
        client.actions.addGameMessage('กรุณารอให้มาร์คเป้าหมายส่งถึงทีมก่อน แล้วกดฆ่าอีกครั้ง', 'orange');
        return;
    }
    const popup = document.getElementById('night-action-popup');
    if (!popup) { client.actions.createNightActionPopup('witch'); return client.actions.showWitchKillConfirmation(targetId); }
    document.getElementById('witch-kill-confirm-panel')?.remove();
    const panel = document.createElement('div');
    panel.id = 'witch-kill-confirm-panel';
    panel.className = 'witch-kill-confirm-panel';
    const text = document.createElement('p');
    text.textContent = targetId === null ? 'ยืนยันไม่สังหารใครคืนนี้?' : `ยืนยันสังหาร ${target.name} คืนนี้?`;
    const warning = document.createElement('small');
    warning.textContent = 'การยืนยันนี้เป็นคำตัดสินของทั้งทีม และเปลี่ยนไม่ได้';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'night-confirm-btn';
    confirm.textContent = targetId === null ? 'ยืนยันไม่สังหาร' : 'ยืนยันฆ่าจริง';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'witch-kill-cancel-btn';
    cancel.textContent = 'กลับไปเลือกเป้าหมาย';
    cancel.onclick = () => { popup.classList.remove('confirming-kill'); panel.remove(); popup.querySelector('#confirm-night-action')?.focus(); };
    const nightId = state.nightId;
    confirm.onclick = () => {
        const latest = client.state.currentRoomState?.witchNightState;
        if (!latest || latest.nightId !== nightId || latest.committed || latest.marks?.[client.state.myUniqueId] !== targetId) {
            panel.remove();
            client.actions.addGameMessage('เป้าหมายหรือช่วงกลางคืนเปลี่ยนแล้ว กรุณาเลือกใหม่', 'orange');
            return;
        }
        confirm.disabled = true;
        confirm.textContent = 'กำลังยืนยัน…';
        client.state.socket.emit('witch kill target', targetId, { confirmed: true, nightId });
    };
    panel.append(text, warning, confirm, cancel);
    popup.classList.add('confirming-kill');
    popup.querySelector('.night-action-content').prepend(panel);
    confirm.focus();
};

client.actions.autoSubmitNightAction = function autoSubmitNightAction(actionType) {
    // ส่ง action แบบ skip (ไม่เลือกเป้าหมาย)
    if (actionType === 'witch') {
        // Skipping also requires an explicit confirmation from a player.
        client.actions.showWitchKillConfirmation(null);
        return;
    } else if (actionType === 'constable') {
        client.state.socket.emit('constable action', null); // null = ไม่เลือก
    }
    // ปิด popup
    client.actions.removeNightActionPopup();
    client.state.nightActionState.selectedTargetId = null;
    client.actions.disableNightTargetSelection();
};

client.actions.submitNightAction = function submitNightAction(actionType) {
    console.log('submitNightAction called with actionType:', actionType);
    console.log('nightActionState:', client.state.nightActionState);
    
    if (!client.state.nightActionState.selectedTargetId) {
        console.log('No target selected');
        client.actions.addGameMessage('กรุณาเลือกเป้าหมายก่อน', 'red');
        return;
    }
    
    console.log('Submitting night action:', actionType, 'target:', client.state.nightActionState.selectedTargetId);
    
    if (actionType === 'witch') {
        client.actions.showWitchKillConfirmation(client.state.nightActionState.selectedTargetId);
        return;
    } else if (actionType === 'constable') {
        client.state.socket.emit('constable action', client.state.nightActionState.selectedTargetId);
        client.actions.addGameMessage('คุณได้เลือกที่จะปกป้องเป้าหมายแล้ว', 'green');
        client.actions.removeNightActionPopup();
    }
    
    // Hide UI and reset state after confirming
    client.actions.disableNightTargetSelection();
};

export function initialize() {
  client.state.socket.on('must play night card', () => {
      client.dom.drawCardButton.disabled = true;
      client.dom.endTurnButton.disabled = true;
      // Popup แจ้งเตือน
      if (!document.getElementById('must-play-night-popup')) {
          const popup = document.createElement('div');
          popup.id = 'must-play-night-popup';
          popup.style.position = 'fixed';
          popup.style.top = '50%';
          popup.style.left = '50%';
          popup.style.transform = 'translate(-50%, -50%)';
          popup.style.background = '#222';
          popup.style.padding = '30px';
          popup.style.borderRadius = '10px';
          popup.style.zIndex = 9999;
          popup.style.boxShadow = '0 0 20px #000';
          popup.style.textAlign = 'center';
          popup.innerHTML = '<h3 style="color:#ffd700;">คุณต้องเล่นการ์ด Night ก่อนจบเทิร์น!</h3>';
          document.body.appendChild(popup);
      }
  });

  client.state.socket.on('popup assign black cat', (potentialTargets) => {
      client.actions.showAssignBlackCatPopup(potentialTargets);
  });
}
