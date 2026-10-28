import { client } from '../core/client.js';

const defaults = { life: 100, hand: 100, status: 100 };
export function initializeCardSizes() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('table3DCardSizes') || '{}') || {}; } catch (_) {}
    client.state.table3DCardSizes = Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
        [key, Number.isFinite(saved[key]) ? Math.max(50, Math.min(200, saved[key])) : value]));
    const menu = document.getElementById('table3d-card-sizes');
    const panel = menu.querySelector('.card-size-panel');
    const inputs = [];
    let syncTimer;
    function save() {
        try { localStorage.setItem('table3DCardSizes', JSON.stringify(client.state.table3DCardSizes)); } catch (_) {}
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => client.actions.syncTable3D(), 80);
    }
    for (const [key, title] of [['life', 'การ์ดชีวิต'], ['hand', 'การ์ดในมือ'], ['status', 'การ์ดสถานะ']]) {
        const label = document.createElement('label'); label.textContent = title;
        const input = document.createElement('input'); input.type = 'range'; input.min = 50; input.max = 200; input.step = 5;
        input.value = client.state.table3DCardSizes[key];
        const value = document.createElement('output'); value.textContent = `${input.value}%`;
        input.oninput = () => { client.state.table3DCardSizes[key] = Number(input.value); value.textContent = `${input.value}%`; save(); };
        label.append(input, value); panel.append(label); inputs.push({ key, input, value });
    }
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'คืนขนาดเริ่มต้น';
    reset.onclick = () => {
        client.state.table3DCardSizes = { ...defaults };
        inputs.forEach(({ key, input, value }) => { input.value = defaults[key]; value.textContent = '100%'; }); save();
    };
    panel.append(reset);
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
    menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); } });
}
