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
    // Muted semantic colors stay legible on the dark wood log surface.
    const colorMap = {
        red:      '#e2aaa1',
        green:    '#acc6a7',
        blue:     '#aec5d6',
        gold:     '#ddc08c',
        gray:     '#c7bbae',
        grey:     '#c7bbae',
        orange:   '#dfb68f',
        purple:   '#c7b4d6',
        darkred:  '#e5a39b',
        darkblue: '#a9b8d7',
        black:    '#eadfcd',
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
