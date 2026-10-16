import { client } from '../core/client.js';

export function initialize() {
    const source = document.getElementById('game-messages');
    const panel = document.getElementById('table3d-log');
    const messages = document.getElementById('table3d-log-messages');
    const badge = document.getElementById('table3d-log-unread');
    let unread = 0, added = 0, frame = 0;
    function updateBadge() {
        badge.hidden = !unread;
        badge.textContent = unread > 99 ? '99+' : String(unread);
    }
    function refresh() {
        frame = 0;
        const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 30;
        const fragment = document.createDocumentFragment();
        const rows = [...source.children].filter(node => node.tagName === 'DIV').slice(-80);
        for (const row of rows) fragment.appendChild(row.cloneNode(true));
        if (!rows.length) {
            const empty = document.createElement('p'); empty.textContent = 'ยังไม่มีเหตุการณ์'; fragment.appendChild(empty);
        }
        messages.replaceChildren(fragment);
        if (panel.open && atBottom) { messages.scrollTop = messages.scrollHeight; unread = 0; }
        else unread += added;
        added = 0; updateBadge();
    }
    new MutationObserver(records => {
        added += records.reduce((sum, record) => sum + [...record.addedNodes].filter(node => node.nodeType === 1 && node.tagName === 'DIV').length, 0);
        if (!frame) frame = requestAnimationFrame(refresh);
    }).observe(source, { childList: true });
    panel.addEventListener('toggle', () => {
        if (panel.open) { unread = 0; updateBadge(); messages.scrollTop = messages.scrollHeight; }
    });
    client.state.socket.on('room left', () => {
        cancelAnimationFrame(frame); frame = 0; panel.open = false;
        unread = added = 0; messages.replaceChildren(); updateBadge();
    });
    refresh();
}
