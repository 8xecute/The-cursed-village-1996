import { client } from '../core/client.js';

function highlightOwnName(row) {
    const name = client.state.currentRoomState?.players?.[client.state.myUniqueId]?.name || client.state.myPlayerName;
    const escaped = name?.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentions = !!escaped && ([...row.querySelectorAll('b,strong')].some(element => element.textContent.trim() === name.trim()) ||
        new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'u').test(row.textContent));
    row.classList.toggle('is-self-event', mentions);
}

client.actions.addGameMessage = function addGameMessage(message, color, bold = false) {
    message = client.actions.replaceCardNamesInMessage(message);
    // กำหนดสีให้อ่านง่ายและเหมาะกับสถานการณ์ (สดและตัดกับพื้นหลัง)
    const colorMap = {
        red:      '#ef5350',   // สดขึ้น
        green:    '#66bb6a',   // สดขึ้น
        blue:     '#42a5f5',   // ฟ้าอ่อนสด
        gold:     '#ffb300',   // เหลืองทองเข้ม
        gray:     '#e0e0e0',   // เทาอ่อน
        orange:   '#ffb74d',   // ส้มสด
        purple:   '#ba68c8',   // ม่วงสด
        darkred:  '#c62828',   // แดงเข้ม
        darkblue: '#3949ab',   // น้ำเงินเข้ม
        black:    '#fff',      // ขาว
    };
    let useColor = colorMap[color] || colorMap.black;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'game-event-entry';
    if (bold) messageDiv.style.fontWeight = 'bold';
    messageDiv.style.color = useColor;
    messageDiv.innerHTML = message;
    highlightOwnName(messageDiv);
    const gameMessages = document.getElementById('game-messages');
    if (gameMessages) {
        const nearBottom = gameMessages.scrollHeight - gameMessages.scrollTop - gameMessages.clientHeight < 60;
        gameMessages.appendChild(messageDiv);
        if (nearBottom) gameMessages.scrollTop = gameMessages.scrollHeight;
    }
    if (client.state.currentMobileGameTab !== 'chat' && client.dom.tabChatBadge) {
        client.dom.tabChatBadge.style.display = 'inline-block';
    }
};

export function initialize() {
    let previousName = '';
    client.state.socket.on('room state update', state => {
        const name = state.players?.[client.state.myUniqueId]?.name || '';
        if (name === previousName) return;
        previousName = name;
        // Room state listeners may finish assigning the current state in this turn.
        queueMicrotask(() => document.querySelectorAll('#game-messages .game-event-entry').forEach(highlightOwnName));
    });
}
