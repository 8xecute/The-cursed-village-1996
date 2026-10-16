import { client } from '../core/client.js';

export function initialize() {
    const select = document.getElementById('lobby-witch-count');
    const help = document.getElementById('lobby-witch-count-help');
    let signature = '';
    client.state.socket.on('room state update', state => {
        const host = !!state.players?.[client.state.myUniqueId]?.isHost && !state.isSpectator;
        const max = Math.max(1, state.playerCount - 1);
        const custom = state.customWitchCardCount;
        const next = JSON.stringify([max,custom,host,state.gameStarted]);
        if (next === signature) return; signature = next;
        select.replaceChildren(new Option('อัตโนมัติ','auto'));
        for (let count=1; count<=max; count++) select.add(new Option(`${count} ใบ`,String(count)));
        if (custom != null && custom > max) {
            const invalid = new Option(`${custom} ใบ · เกินจำนวนที่ตั้งได้`,String(custom)); invalid.disabled = true; select.add(invalid);
        }
        select.value = custom == null ? 'auto' : String(custom);
        select.disabled = !host || state.gameStarted;
        const auto = state.playerCount <= 5 ? 1 : state.playerCount <= 9 ? 2 : 3;
        help.textContent = custom != null && custom > max ? 'ผู้เล่นลดลง · หัวห้องต้องเลือกจำนวนปอบใหม่ก่อนเริ่ม'
            : `${custom == null ? `อัตโนมัติ: ${auto} ใบ` : `กำหนดเอง: ${custom} ใบ`} · เป็นจำนวนไพ่ ไม่ใช่จำนวนคน · ไพ่ปอบอาจอยู่กับคนเดียวกัน`;
    });
    select.addEventListener('change', () => {
        if (!select.disabled) client.state.socket.emit('set witch card count',select.value === 'auto' ? null : Number(select.value));
    });
    client.state.socket.on('room left', () => { signature = ''; select.disabled = true; });
}
