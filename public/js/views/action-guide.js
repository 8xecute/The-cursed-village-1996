import { client } from '../core/client.js';

// Read only the sanitized room state and this browser's own UI.
function getGuide(state) {
    const me = state.players?.[client.state.myUniqueId];
    const guide = (title, detail, active = false, cards = false) => ({ title, detail, active, cards });
    if (!client.state.socket.connected) return guide('กำลังเชื่อมต่อใหม่', 'รอเชื่อมต่อสำเร็จก่อนทำแอ็กชัน');
    if (state.gameOver) return guide('จบเกมแล้ว', 'ดูผลการเล่นได้จากปุ่มสรุปเกม');
    if (state.isSpectator || !me) return guide('คุณกำลังดูเกม', 'ติดตามกระดานและข้อความได้ โดยไม่ต้องทำแอ็กชัน');
    if (!me.alive) return guide('คุณเสียชีวิตแล้ว', 'ดูเกมต่อได้ แต่ไม่สามารถเล่นการ์ดหรือทำแอ็กชัน');
    if (state.playerForcedToRevealTryal === me.uniqueId) return guide('คุณต้องเปิดการ์ดชีวิต', 'เลือกการ์ด 1 ใบในหน้าต่างที่เปิดอยู่', true);
    if (state.isAssigningBlackCat) return me.hasBeenWitch || me.isWitch
        ? guide('เลือกผู้ถือเครื่องเซ่น', 'เลือกผู้เล่นในหน้าต่าง แล้วกดยืนยัน', true)
        : guide('รอเลือกผู้ถือเครื่องเซ่น', 'ยังไม่ต้องทำอะไร');
    if (state.awaitingLeftTryalSelections) return document.getElementById('select-left-tryal-popup')
        ? guide('เลือกการ์ดชีวิตจากคนซ้ายมือ', 'แตะการ์ด 1 ใบในหน้าต่างพิธีเซ่นไหว้', true)
        : guide('รอคนอื่นเลือกการ์ด', `เลือกแล้ว ${state.leftTryalSelectedCount || 0}/${state.leftTryalTotalCount || 0} คน`);
    if (document.getElementById('accused-tryal-select-overlay')) return guide('เลือกการ์ดชีวิตที่จะเปิด', 'แตะการ์ดของผู้ถูกกล่าวหา 1 ใบ', true);
    if (document.getElementById('blackcat-tryal-overlay')) return guide('เปิดการ์ดของผู้ถือเครื่องเซ่น', 'เลือกการ์ดชีวิต 1 ใบในหน้าต่าง', true);
    if (document.getElementById('alibi-redcard-select-popup')) return guide('เลือกข้อกล่าวหาที่จะนำออก', 'เลือกได้สูงสุด 3 ใบ แล้วกดยืนยัน', true);
    if (document.querySelector('.curse-target-modal')) return guide('เลือกการ์ดที่จะทำลาย', 'แตะการ์ดสีน้ำเงิน 1 ใบในหน้าต่างคำสาป', true);
    if (document.querySelector('.select-player-modal')) return guide('เลือกเป้าหมายของการ์ด', 'เลือกผู้เล่นตามคำแนะนำในหน้าต่าง', true);
    if (document.getElementById('must-play-night-popup')) return guide('เล่นการ์ดยามวิกาล', 'กดยืนยันในหน้าต่างเพื่อเข้าสู่กลางคืน', true);
    if (state.currentPhase === 'NIGHT') {
        if (state.witchNightState && !state.witchNightState.committed) return guide('เลือกเป้าหมายของทีมปอบ', 'แตะมาร์คเพื่อปรึกษาทีม → กดฆ่า → ยืนยันอีกครั้ง', true);
        if (me.isConstable && document.getElementById('night-action-popup')) return guide('เลือกคนที่จะปกป้อง', 'เลือกผู้เล่นในหน้าต่าง แล้วกดยืนยัน', true);
        return guide('รอสรุปการเลือกกลางคืน', 'ยังไม่ต้องทำอะไร');
    }
    if (state.currentPhase === 'PRE_DAWN') {
        const id = state.confessionOrder?.[state.currentConfessionIndex];
        if (id === me.uniqueId && !state.confessionActions?.includes(id)) return guide('เลือกสารภาพหรือข้าม', 'สารภาพ: เปิดการ์ดชีวิต 1 ใบ · ข้าม: ไม่เปิดการ์ด', true);
        return guide('รอช่วงสารภาพจบ', 'คุณยังไม่ต้องทำอะไร');
    }
    if (state.currentPhase !== 'DAY') return guide('กำลังเตรียมเกม', 'รอระบบเริ่มช่วงถัดไป');
    if (state.playerForcedToRevealTryal) return guide('รอเปิดการ์ดชีวิต', 'รอผู้เล่นเลือกการ์ดก่อนเล่นต่อ');
    if (state.currentTurnPlayerUniqueId !== me.uniqueId) return guide(`ตาของ ${state.currentTurnPlayerName || 'ผู้เล่นอื่น'}`, 'รอเทิร์นของคุณ · ดูกระดานหรือข้อความได้');
    const card = client.state.myCurrentHand?.[client.state.selectedCard];
    if (card) return guide('เลือกเป้าหมายแล้วเล่นการ์ด', 'กดปุ่มเล่นใต้การ์ด → เลือกเป้าหมายตามที่หน้าต่างบอก', true, true);
    if (me.hasPlayedCardsThisTurn) return guide('เล่นแล้ว · จบเทิร์นได้', 'เล่นการ์ดต่อได้ หรือแตะจบเทิร์น 2 ครั้ง', true, true);
    return guide('ถึงตาคุณแล้ว', 'เลือกอย่างใดอย่างหนึ่ง: จั่ว 2 ใบ หรือเลือกการ์ดเพื่อเล่น', true, true);
}

export function initialize() {
    const banner = document.getElementById('waiting-status-banner');
    const title = document.getElementById('action-guide-title');
    const detail = document.getElementById('action-guide-detail');
    const button = document.getElementById('action-guide-button');
    const notice = document.getElementById('turn-notice');
    const originalTitle = document.title;
    let previousGuide = '';
    let previousTurn = false;
    let noticeTimer;
    let queued = false;

    function update() {
        queued = false;
        const state = client.state.currentRoomState;
        const visible = !!state?.gameStarted;
        banner.hidden = !visible;
        const me = state?.players?.[client.state.myUniqueId];
        const myTurn = visible && client.state.socket.connected && !state.gameOver && !state.isSpectator && !!me?.alive &&
            state.currentPhase === 'DAY' && state.currentTurnPlayerUniqueId === me.uniqueId;
        if (myTurn && !previousTurn) {
            clearTimeout(noticeTimer);
            notice.hidden = false;
            noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
        } else if (!myTurn) {
            clearTimeout(noticeTimer);
            notice.hidden = true;
        }
        previousTurn = myTurn;
        document.title = myTurn ? `ถึงตาคุณแล้ว • ${originalTitle}` : originalTitle;
        if (!visible) { previousGuide = ''; return; }
        const guide = getGuide(state);
        const signature = JSON.stringify(guide);
        if (signature === previousGuide) return;
        previousGuide = signature;
        title.textContent = guide.title;
        detail.textContent = guide.detail;
        banner.classList.toggle('needs-action', guide.active);
        button.hidden = !guide.cards;
    }
    function schedule() {
        if (queued) return;
        queued = true;
        queueMicrotask(update);
    }
    button.addEventListener('click', () => {
        client.actions.switchMobileGameTab('hand');
        client.dom.playerHandDiv?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });
    client.state.socket.on('room state update', schedule);
    client.state.socket.on('update hand', schedule);
    client.state.socket.on('connect', schedule);
    client.state.socket.on('disconnect', schedule);
    client.state.socket.on('room left', () => {
        clearTimeout(noticeTimer);
        previousTurn = false;
        banner.hidden = notice.hidden = true;
        document.title = originalTitle;
    });
    document.addEventListener('click', schedule);
    // Refresh when an action popup is added/removed, including automatic closure.
    new MutationObserver(records => {
        if (records.some(record => !banner.contains(record.target) && record.target !== notice)) schedule();
    }).observe(document.body, { childList: true, subtree: true });
    update();
}
