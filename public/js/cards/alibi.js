import { registerInteraction, selectionChanged } from '../core/interaction.js';
import { client } from '../core/client.js';

client.actions.showAlibiRedCardSelectionPopup = function showAlibiRedCardSelectionPopup(targetUniqueId, redCards) {
    document.getElementById('alibi-redcard-select-popup')?.remove();
    const container = document.createElement('div');
    container.id = 'alibi-redcard-select-popup';
    container.dataset.effectOwner = targetUniqueId;
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.background = '#222';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 0 30px #000a';
    container.style.padding = '28px 24px 18px 24px';
    container.style.zIndex = '9999';
    container.style.textAlign = 'center';
    
    const title = document.createElement('div');
    title.textContent = 'เลือกการ์ดข้อกล่าวหาที่จะลบ (เลือกได้ชนิดเดียว, แต้มรวมไม่เกิน 3)';
    title.style.color = '#ffe799';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '1.18em';
    title.style.marginBottom = '18px';
    container.appendChild(title);

    // Group red cards by type
    const accCards = redCards.filter(c => c.name === 'Accusation');
    const evidenceCards = redCards.filter(c => c.name === 'Evidence');
    // (ถ้ามี Witness ก็เพิ่มได้)
    // const witnessCards = redCards.filter(c => c.name === 'Witness');

    // State
    let selectedType = null; // 'Accusation' หรือ 'Evidence'
    let selectedIndexes = [];

    // Card list section
    const cardListDiv = document.createElement('div');
    cardListDiv.style.display = 'flex';
    cardListDiv.style.flexWrap = 'wrap';
    cardListDiv.style.justifyContent = 'center';
    cardListDiv.style.gap = '18px';
    cardListDiv.style.margin = '18px 0';

    function selectEffect(index) {
        const card = redCards.find(card => card.index === index);
        if (!card || !['Accusation', 'Evidence'].includes(card.name)) return;
        if (selectedType !== card.name) {
            selectedType = card.name;
            selectedIndexes = [];
            accBtn.style.background = selectedType === 'Accusation' ? '#b71c1c' : '#444';
            evidenceBtn.style.background = selectedType === 'Evidence' ? '#6d4c41' : '#444';
        }
        if (selectedIndexes.includes(index)) selectedIndexes = selectedIndexes.filter(i => i !== index);
        else if (selectedType === 'Accusation' && selectedIndexes.length < 3) selectedIndexes.push(index);
        else if (selectedType === 'Evidence' && selectedIndexes.length === 0) selectedIndexes = [index];
        renderCardButtons();
        updateConfirmBtn();
    }

    // Helper: render card buttons
    function renderCardButtons() {
        cardListDiv.innerHTML = '';
        // Show only one type at a time
        let cardsToShow = [];
        if (selectedType === 'Accusation') cardsToShow = accCards;
        else if (selectedType === 'Evidence') cardsToShow = evidenceCards;
        // else if (selectedType === 'Witness') cardsToShow = witnessCards;
        cardsToShow.forEach((card, idx) => {
            const cardBtn = document.createElement('button');
            cardBtn.dataset.effectIndex = card.index;
            cardBtn.setAttribute('aria-pressed', String(selectedIndexes.includes(card.index)));
            cardBtn.textContent = `${client.actions.displayCardName(card.name)} (+${card.value})`;
            cardBtn.style.width = '90px';
            cardBtn.style.height = '120px';
            cardBtn.style.fontSize = '1.08em';
            cardBtn.style.fontWeight = 'bold';
            cardBtn.style.background = card.name === 'Accusation' ? '#b71c1c' : '#6d4c41';
            cardBtn.style.color = '#fff';
            cardBtn.style.borderRadius = '10px';
            cardBtn.style.boxShadow = '0 4px 18px #a97c5088';
            cardBtn.style.cursor = 'pointer';
            cardBtn.style.margin = '0 6px';
            cardBtn.style.opacity = selectedIndexes.includes(card.index) ? '1' : '0.7';
            cardBtn.onclick = () => selectEffect(card.index);
            if (selectedType === 'Accusation' && selectedIndexes.length >= 3 && !selectedIndexes.includes(card.index)) {
                cardBtn.disabled = true;
                cardBtn.style.opacity = '0.4';
            }
            if (selectedType === 'Evidence' && selectedIndexes.length >= 1 && !selectedIndexes.includes(card.index)) {
                cardBtn.disabled = true;
                cardBtn.style.opacity = '0.4';
            }
            cardListDiv.appendChild(cardBtn);
        });
    }

    // Type selector
    const typeSelectorDiv = document.createElement('div');
    typeSelectorDiv.style.display = 'flex';
    typeSelectorDiv.style.flexWrap = 'wrap';
    typeSelectorDiv.style.justifyContent = 'center';
    typeSelectorDiv.style.gap = '24px';
    typeSelectorDiv.style.marginBottom = '10px';
    // Accusation
    const accBtn = document.createElement('button');
    accBtn.textContent = `ข้อกล่าวหา (+1) x${accCards.length}`;
    accBtn.style.background = selectedType === 'Accusation' ? '#b71c1c' : '#444';
    accBtn.style.color = '#fff';
    accBtn.style.fontWeight = 'bold';
    accBtn.style.borderRadius = '8px';
    accBtn.style.padding = '8px 18px';
    accBtn.dataset.effectType = 'Accusation';
    accBtn.onclick = () => {
        selectedType = 'Accusation';
        selectedIndexes = [];
        accBtn.style.background = '#b71c1c';
        evidenceBtn.style.background = '#444';
        renderCardButtons();
        updateConfirmBtn();
    };
    typeSelectorDiv.appendChild(accBtn);
    // Evidence
    const evidenceBtn = document.createElement('button');
    evidenceBtn.textContent = `หลักฐาน (+3) x${evidenceCards.length}`;
    evidenceBtn.style.background = selectedType === 'Evidence' ? '#6d4c41' : '#444';
    evidenceBtn.style.color = '#fff';
    evidenceBtn.style.fontWeight = 'bold';
    evidenceBtn.style.borderRadius = '8px';
    evidenceBtn.style.padding = '8px 18px';
    evidenceBtn.dataset.effectType = 'Evidence';
    evidenceBtn.onclick = () => {
        selectedType = 'Evidence';
        selectedIndexes = [];
        accBtn.style.background = '#444';
        evidenceBtn.style.background = '#6d4c41';
        renderCardButtons();
        updateConfirmBtn();
    };
    typeSelectorDiv.appendChild(evidenceBtn);
    container.appendChild(typeSelectorDiv);
    container.appendChild(cardListDiv);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.dataset.alibiAction = 'confirm';
    confirmBtn.textContent = 'ยืนยันการลบ';
    confirmBtn.style.background = '#ff9800';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.fontSize = '1.1em';
    confirmBtn.style.borderRadius = '8px';
    confirmBtn.style.marginTop = '18px';
    confirmBtn.style.padding = '10px 28px';
    confirmBtn.disabled = true;
    confirmBtn.onclick = () => {
        if (selectedIndexes.length > 0) {
            client.state.socket.emit('select alibi removal', { targetUniqueId, selectedIndexes });
            container.remove();
        }
    };
    container.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.dataset.alibiAction = 'cancel';
    cancelBtn.textContent = 'ยกเลิก';
    cancelBtn.style.background = '#888';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '1.1em';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.marginLeft = '16px';
    cancelBtn.style.marginTop = '18px';
    cancelBtn.style.padding = '10px 28px';
    cancelBtn.onclick = () => {
        // ส่ง event ยกเลิกไปยัง server
        client.state.socket.emit('cancel alibi selection');
        container.remove();
    };
    container.appendChild(cancelBtn);

    // Helper: update confirm button state
    function updateConfirmBtn() {
        selectionChanged();
        if (selectedType === 'Accusation') {
            confirmBtn.disabled = selectedIndexes.length === 0 || selectedIndexes.length > 3;
        } else if (selectedType === 'Evidence') {
            confirmBtn.disabled = selectedIndexes.length !== 1;
        } else {
            confirmBtn.disabled = true;
        }
    }

    document.body.appendChild(container);
    registerInteraction(container, { kind: 'effect', owner: targetUniqueId,
        read: () => ({ eligible: redCards.filter(card => ['Accusation','Evidence'].includes(card.name)).map(card => card.index), selected: selectedIndexes }),
        choose: selectEffect,
        confirm: () => { if (!confirmBtn.disabled) confirmBtn.onclick(); },
        cancel: cancelBtn.onclick
    });
};

export function initialize() {
  client.state.socket.on('prompt select alibi removal', ({ targetUniqueId, redCards }) => {
      client.actions.showAlibiRedCardSelectionPopup(targetUniqueId, redCards);
  });
}
