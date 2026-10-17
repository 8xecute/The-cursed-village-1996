import { client } from '../core/client.js';

client.actions.showCurseTargetSelection = function showCurseTargetSelection(targetUniqueId, blueCards) {
    document.querySelectorAll('.curse-target-modal').forEach(element => element.remove());
    const modal = document.createElement('div');
    modal.className = 'modal curse-target-modal';
    modal.dataset.effectOwner = targetUniqueId;
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    const content = document.createElement('div');
    content.style.background = 'rgba(34,34,34,0.97)';
    content.style.color = '#fff';
    content.style.padding = '32px';
    content.style.borderRadius = '12px';
    content.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)';
    content.style.textAlign = 'center';

    const titleElem = document.createElement('h3');
    titleElem.textContent = 'เลือกการ์ดสีน้ำเงินที่จะทำลาย';
    titleElem.style.color = '#fff';
    titleElem.style.fontWeight = 'bold';
    titleElem.style.marginBottom = '18px';
    content.appendChild(titleElem);

    const cardList = document.createElement('div');
    cardList.style.display = 'flex';
    cardList.style.justifyContent = 'center';
    cardList.style.gap = '18px';
    cardList.style.flexWrap = 'wrap';

    blueCards.forEach((card, idx) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card blue-card';
        cardDiv.style.border = '2.5px solid #1565c0';
        cardDiv.style.background = 'linear-gradient(135deg, #1e1e5a 70%, #29b6f6 100%)';
        cardDiv.style.color = '#fff';
        cardDiv.style.fontWeight = 'bold';
        cardDiv.style.fontSize = '1.15em';
        cardDiv.style.textShadow = '1px 1px 4px #000a';
        cardDiv.style.padding = '12px';
        cardDiv.style.minWidth = '120px';
        cardDiv.style.minHeight = '160px';
        cardDiv.style.display = 'flex';
        cardDiv.style.alignItems = 'center';
        cardDiv.style.justifyContent = 'center';
        cardDiv.style.cursor = 'grab';
        cardDiv.style.transition = 'transform 0.18s, border-color 0.18s';
        cardDiv.setAttribute('title', client.actions.displayCardDescription(card.name)); // <-- Add tooltip for tryal cards
        
        // แสดงรูปการ์ดแทนข้อความ
        const cardImage = client.actions.createCardImage(card.name);
        cardImage.style.width = '100%';
        cardImage.style.height = '100%';
        cardImage.style.objectFit = 'cover';
        cardImage.style.borderRadius = '6px';
        cardDiv.appendChild(cardImage);
        
        cardDiv.dataset.effectOrdinal = idx;
        cardDiv.addEventListener('mouseover', () => {
            cardDiv.style.transform = 'scale(1.08)';
            cardDiv.style.borderColor = '#ffd700';
        });
        cardDiv.addEventListener('mouseout', () => {
            cardDiv.style.transform = '';
            cardDiv.style.borderColor = '#1565c0';
        });
        cardDiv.addEventListener('click', () => {
            client.state.socket.emit('select curse target', targetUniqueId, idx);
            modal.remove();
        });
        cardList.appendChild(cardDiv);
    });
    content.appendChild(cardList);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'ข้ามการทำลาย (ใช้คำสาปแล้ว)';
    cancelBtn.style.marginTop = '24px';
    cancelBtn.style.background = '#ff4500';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.fontWeight = 'bold';
    cancelBtn.style.fontSize = '1.1em';
    cancelBtn.style.padding = '10px 28px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.addEventListener('click', () => {
        client.state.socket.emit('cancel curse selection');
        modal.remove();
    });
    content.appendChild(cancelBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);
};

export function initialize() {

}
