import { client } from '../core/client.js';

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

}
