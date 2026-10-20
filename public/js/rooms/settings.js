import { client } from '../core/client.js';

export function initialize() {
    const select = document.getElementById('lobby-witch-count');
    const help = document.getElementById('lobby-witch-count-help');
    const lifeSelect = document.getElementById('lobby-life-count');
    const lifeHelp = document.getElementById('lobby-life-count-help');
    let signature = '';
    client.state.socket.on('room state update', state => {
        const host = !!state.players?.[client.state.myUniqueId]?.isHost && !state.isSpectator;
        const max = Math.min(4, Math.max(1, state.playerCount - 1));
        const custom = state.customWitchCardCount;
        const next = JSON.stringify([max,custom,state.customLifeCardCount,host,state.gameStarted]);
        if (next === signature) return; signature = next;
        select.replaceChildren(new Option('อัตโนมัติ','auto'));
        for (let count=1; count<=max; count++) select.add(new Option(`${count} ใบ`,String(count)));
        if (custom != null && custom > max) {
            const invalid = new Option(`${custom} ใบ · เกินจำนวนที่ตั้งได้`,String(custom)); invalid.disabled = true; select.add(invalid);
        }
        select.value = custom == null ? 'auto' : String(custom);
        select.disabled = !host || state.gameStarted;
        const auto = state.playerCount <= 5 ? 1 : 2;
        const automaticLives = state.playerCount <= 7 ? 5 : state.playerCount <= 9 ? 4 : 3;
        const lives = state.customLifeCardCount ?? automaticLives;
        lifeSelect.value = state.customLifeCardCount == null ? 'auto' : String(state.customLifeCardCount);
        lifeSelect.disabled = !host || state.gameStarted;
        lifeHelp.textContent = `${state.customLifeCardCount == null ? 'อัตโนมัติ' : 'กำหนดเอง'}: ชีวิตคนละ ${lives} ใบ · ค่าเริ่มต้น 4–7 คน 5 ใบ / 8–9 คน 4 ใบ / 10–12 คน 3 ใบ · จำนวนปอบและหมอผียังใช้ค่าที่ตั้งไว้`;
        help.textContent = custom != null && custom > max ? 'ผู้เล่นลดลง · หัวห้องต้องเลือกจำนวนปอบใหม่ก่อนเริ่ม'
            : `${custom == null ? `อัตโนมัติ: ${auto} ใบ (1–5 คน 1 ใบ / ตั้งแต่ 6 คน 2 ใบ)` : `กำหนดเอง: ${custom} ใบ`} · ชีวิตคนละ ${lives} ใบ · หมอผี 1 ใบ · เป็นจำนวนไพ่ ไม่ใช่จำนวนคน · ไพ่ปอบอาจอยู่กับคนเดียวกัน`;
    });
    select.addEventListener('change', () => {
        if (!select.disabled) client.state.socket.emit('set witch card count',select.value === 'auto' ? null : Number(select.value));
    });
    lifeSelect.addEventListener('change', () => {
        if (!lifeSelect.disabled) client.state.socket.emit('set life card count', lifeSelect.value === 'auto' ? null : Number(lifeSelect.value));
    });
    client.state.socket.on('room left', () => { signature = ''; select.disabled = true; lifeSelect.disabled = true; });
}
