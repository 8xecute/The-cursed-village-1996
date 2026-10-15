import { client } from '../core/client.js';

client.actions.clearCardSelection = function clearCardSelection() {
    client.state.selectedCard = null;
    if (client.dom.playerHandDiv) {
        client.dom.playerHandDiv.querySelectorAll('.card').forEach(card => {
            card.classList.remove('selected');
        });
    }
    if (client.dom.cardTargetSelect) {
        client.dom.cardTargetSelect.style.display = 'none';
        client.dom.cardTargetSelect.value = '';
    }
    if (client.dom.cardSecondTargetSelect) {
        client.dom.cardSecondTargetSelect.style.display = 'none';
        client.dom.cardSecondTargetSelect.value = '';
    }
    if (client.dom.playCardButton) {
        client.dom.playCardButton.classList.remove('can-play');
        client.dom.playCardButton.innerHTML = '⚡ เล่นการ์ดที่เลือก';
    }
    client.actions.resetEndTurnButton();
    client.actions.resetDrawCardButton();
};

client.actions.showCardDescription = function showCardDescription(card, cardElement) {
    // Show card description on hover
    cardElement.addEventListener('mouseover', () => {
            if (card.description && client.dom.cardDescriptionPopup) {
                client.dom.cardDescriptionPopup.textContent = card.description;
                client.dom.cardDescriptionPopup.classList.add('show');
            }
        });
    cardElement.addEventListener('mousemove', (event) => {
            if (client.dom.cardDescriptionPopup) {
                client.dom.cardDescriptionPopup.style.left = `${event.pageX + 15}px`;
                client.dom.cardDescriptionPopup.style.top = `${event.pageY + 15}px`;
            }
        });
    cardElement.addEventListener('mouseout', () => {
            if (client.dom.cardDescriptionPopup) {
                client.dom.cardDescriptionPopup.classList.remove('show');
            }
        });
};

client.actions.updateHandDisplay = function updateHandDisplay(hand) {
    // เก็บข้อมูลการ์ดที่เลือกไว้
    let selectedCardData = null;
    if (client.state.selectedCard !== null && client.state.myCurrentHand[client.state.selectedCard]) {
        selectedCardData = client.state.myCurrentHand[client.state.selectedCard];
    }
    
    client.state.myCurrentHand = hand;
    client.dom.playerHandDiv.innerHTML = '';
    client.dom.handCardCount.textContent = hand.length;

    hand.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = `card card-${card.color.toLowerCase()}`;
        
        // แสดงรูปการ์ดแทนข้อความ
        const cardImage = client.actions.createCardImage(card.name);
        cardImage.style.width = '100%';
        cardImage.style.height = '100%';
        cardImage.style.objectFit = 'cover';
        cardImage.style.borderRadius = '4px';
        cardElement.appendChild(cardImage);
        
        cardElement.dataset.index = index;
        
        // --- Drag & Drop ---
        cardElement.draggable = true;
        cardElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            cardElement.classList.add('dragging');
        });
        cardElement.addEventListener('dragend', (e) => {
            cardElement.classList.remove('dragging');
        });
        cardElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            cardElement.classList.add('drag-over');
        });
        cardElement.addEventListener('dragleave', (e) => {
            cardElement.classList.remove('drag-over');
        });
        cardElement.addEventListener('drop', (e) => {
            e.preventDefault();
            cardElement.classList.remove('drag-over');
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const toIdx = index;
            if (fromIdx !== toIdx) {
                // Swap cards in hand
                const temp = client.state.myCurrentHand[fromIdx];
                client.state.myCurrentHand[fromIdx] = client.state.myCurrentHand[toIdx];
                client.state.myCurrentHand[toIdx] = temp;
                
                // ส่งข้อมูลการสลับตำแหน่งไปยัง server
                client.state.socket.emit('swap hand cards', fromIdx, toIdx);
                
                // ปรับ selectedCard index ถ้าจำเป็น
                if (client.state.selectedCard === fromIdx) {
                    client.state.selectedCard = toIdx;
                } else if (client.state.selectedCard === toIdx) {
                    client.state.selectedCard = fromIdx;
                }
                
                client.actions.updateHandDisplay(client.state.myCurrentHand);
            }
        });
        
        // --- Tooltip ---
        cardElement.setAttribute('title', client.actions.displayCardDescription(card.name));
        
        // --- Click to select ---
        cardElement.addEventListener('click', () => {
            if (!client.state.isMyTurn) {
                client.actions.addGameMessage('ไม่ใช่ตาของคุณ.', 'red');
                return;
            }
            if (client.state.selectedCard === index) {
                // แตะซ้ำที่การ์ดเดิมเพื่อยกเลิกการเลือก
                client.actions.clearCardSelection();
                return;
            }
            client.actions.clearCardSelection();
            client.state.selectedCard = index;
            cardElement.classList.add('selected');
            client.dom.cardTargetSelect.style.display = 'none';
            client.dom.cardTargetSelect.value = '';
            client.dom.cardSecondTargetSelect.style.display = 'none';
            client.dom.cardSecondTargetSelect.value = '';

            // ไฮไลต์ปุ่มเล่นการ์ดและแสดงชื่อการ์ดที่เลือก
            if (client.dom.playCardButton) {
                client.dom.playCardButton.classList.add('can-play');
                const cardNameTH = (typeof client.actions.displayCardName === 'function') ? client.actions.displayCardName(card.name) : card.name;
                client.dom.playCardButton.innerHTML = `⚡ เล่น: <b>${cardNameTH}</b>`;
            }
        });
        
        // ถ้าการ์ดนี้เป็นการ์ดที่เลือกไว้ ให้เพิ่ม selected class
        if (selectedCardData && card.name === selectedCardData.name && 
            card.color === selectedCardData.color) {
            cardElement.classList.add('selected');
            client.state.selectedCard = index;
        }
        
        client.dom.playerHandDiv.appendChild(cardElement);
    });
};

client.actions.createCardImage = function createCardImage(cardName) {
    const img = document.createElement('img');
    
    // แมปชื่อการ์ดกับชื่อไฟล์
    const cardImageMap = {
        'Accusation': 'accusation.png',
        'Evidence': 'evidence.png',
        'Witness': 'witness.png',
        'Scapegoat': 'scapegoat.png',
        'Curse': 'curse.png',
        'Alibi': 'alibi.png',
        'Robbery': 'robbery.png',
        'Stocks': 'stocks.png',
        'Arson': 'arson.png',
        'Black Cat': 'blackcat.png',
        'Asylum': 'asylum.png',
        'Piety': 'piety.png',
        'Matchmaker': 'matchmaker.png',
        'Conspiracy': 'conspiracy.png',
        'Night': 'night.png',
        'Witch': 'witch.png',
        'Not A Witch': 'notawitch.png',
        'Constable': 'constable.png'
    };
    
    const imageFileName = cardImageMap[cardName] || 'accusation.png'; // fallback
    img.src = `cards/${imageFileName}`;
    img.alt = client.actions.displayCardName(cardName);
    img.title = client.actions.displayCardDescription(cardName);
    
    // ตั้งค่าสไตล์ของรูป
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '8px';
    
    return img;
};

client.actions.populateCardTargetSelect = function populateCardTargetSelect(playersData, myUniqueId, selectedCardObj = null) {
    client.dom.cardTargetSelect.innerHTML = '<option value="">Select Target</option>';
    client.dom.cardSecondTargetSelect.innerHTML = '<option value="">Select Second Target</option>';
    
    // Check if card needs 2 targets
    const needsTwoTargets = selectedCardObj && client.state.CARDS_NEED_TWO_TARGETS.includes(selectedCardObj.name);
    const SALEM_COLORS = ['Red', 'Green', 'Blue'];
    if (needsTwoTargets) {
        // For cards that need 2 targets, show all players except self for Salem cards
        for (const uniqueId in playersData) {
            const player = playersData[uniqueId];
            let allow = true;
            if (
                selectedCardObj &&
                selectedCardObj.color && SALEM_COLORS.includes(selectedCardObj.color) &&
                player.uniqueId === myUniqueId
            ) {
                allow = false;
            }
            if (player.alive && allow) {
                const option1 = document.createElement('option');
                option1.value = player.uniqueId;
                option1.textContent = player.name;
                client.dom.cardTargetSelect.appendChild(option1);
                const option2 = document.createElement('option');
                option2.value = player.uniqueId;
                option2.textContent = player.name;
                client.dom.cardSecondTargetSelect.appendChild(option2);
            }
        }
        client.dom.cardSecondTargetSelect.style.display = 'inline-block';
    } else {
        // For single target cards
        for (const uniqueId in playersData) {
            const player = playersData[uniqueId];
            let allow = true;
            if (
                selectedCardObj &&
                selectedCardObj.color && SALEM_COLORS.includes(selectedCardObj.color) &&
                player.uniqueId === myUniqueId
            ) {
                allow = false;
            } else if (!player.alive) {
                allow = false;
            }
            if (allow) {
                const option = document.createElement('option');
                option.value = player.uniqueId;
                option.textContent = player.name;
                client.dom.cardTargetSelect.appendChild(option);
            }
        }
        client.dom.cardSecondTargetSelect.style.display = 'none';
    }
};

export function initialize() {

}
