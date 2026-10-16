import { client } from '../core/client.js';
import { lessons, cardNames, createScene, applyTrainingCard } from './lessons.js';

const storageKey = 'village-training-v1';
const actionLabels = {
    'เล่นการ์ด': 'play', 'ยืนยันนำการ์ดออก': 'effects-confirm',
    '🂠 จั่ว 2 ใบ': 'draw', 'ยืนยันจั่ว 2 ใบ': 'draw',
    'จบเทิร์น': 'end', 'ยืนยันจบเทิร์น': 'end',
    '🂠 จั่วพิธีเซ่นไหว้': 'infection', '🂠 จั่วยามวิกาล': 'night',
    '🩸 ฆ่าเป้าหมายที่เลือก…': 'kill', 'ยืนยันฆ่าคำปันจริง': 'kill-confirm',
    'ยืนยันปกป้องคำปัน': 'heal-confirm', 'ลองสารภาพแทน': 'retry',
    'เริ่มวันใหม่': 'dawn', 'เลือกเปิดการ์ดชีวิตมาลี': 'reveal',
    'ฝึกต่อจากครั้งก่อน': 'resume', 'เริ่มฝึกตั้งแต่ต้น': 'start', 'เริ่มฝึกใหม่': 'restart',
};

export function initialize() {
    const dialog = document.getElementById('training-dialog');
    const body = document.getElementById('training-body');
    const close = document.getElementById('training-close');
    let index = 0;
    let completed = new Set();
    let scene, step, targets, selectedCards, finished, selected, taps;
    let message = '';
    let opener;
    let triedProtection = false;
    let waitingToLeave = false;

    function node(tag, text, className) {
        const element = document.createElement(tag);
        if (text) element.textContent = text;
        if (className) element.className = className;
        return element;
    }
    function button(text, action, parent, disabled = false, actionKey = '') {
        const element = node('button', text, 'training-button');
        element.type = 'button';
        element.disabled = disabled;
        if (actionKey || actionLabels[text]) element.dataset.trainingAction = actionKey || actionLabels[text];
        element.addEventListener('click', action);
        parent.appendChild(element);
        return element;
    }
    function save() {
        try { localStorage.setItem(storageKey, JSON.stringify({ index, completed: [...completed] })); } catch (_) {}
    }
    function restore() {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            index = Number.isInteger(saved?.index) ? Math.max(0, Math.min(lessons.length, saved.index)) : 0;
            completed = new Set(Array.isArray(saved?.completed) ? saved.completed.filter(id => lessons.some(lesson => lesson.id === id)) : []);
        } catch (_) { index = 0; completed = new Set(); }
    }
    function startLesson(nextIndex) {
        index = nextIndex;
        if (index >= lessons.length) { save(); summary(); return; }
        scene = createScene(lessons[index]);
        step = 'start'; targets = []; selectedCards = []; finished = false; selected = false; taps = 0; message = '';
        triedProtection = false;
        save(); render();
    }
    function complete() {
        finished = true;
        completed.add(lessons[index].id);
        message = lessons[index].result;
        save(); render();
    }
    function hint(text) {
        message = text;
        const feedback = body.querySelector('.training-feedback');
        if (feedback) feedback.textContent = text;
        updateCoach();
    }
    function cardButton(name, onClick, parent, label) {
        const element = button('', onClick, parent);
        element.classList.add('training-card');
        element.dataset.trainingAction = 'card';
        const image = client.actions.createCardImage(name);
        image.removeAttribute('title');
        image.alt = cardNames[name];
        element.append(image, node('span', label || cardNames[name]));
        return element;
    }
    function showLife(parent, owner, reveal, name) {
        parent.appendChild(node('p', `${owner.name} · เลือกการ์ดชีวิต 1 ใบ`));
        const row = node('div', '', 'training-card-row');
        for (let i = 0; i < owner.life; i++) {
            button(`🎴 ใบที่ ${i + 1}`, () => {
                reveal(name);
            }, row, false, i === 0 ? 'life' : '');
        }
        parent.appendChild(row);
    }
    function expectedTargets(lesson) {
        if (lesson.match || lesson.protection) return [2];
        return lesson.targets === 2 ? [1, 2] : [1];
    }
    function nextAction() {
        const lesson = lessons[index];
        if (!lesson) return '';
        if (finished) return 'next';
        if (lesson.kind === 'card') {
            if (step === 'witness-life') return 'life';
            if (step === 'pick-effect') return selectedCards.length ? 'effects-confirm' : 'effect-0';
            if (!selected) return 'card';
            if (lesson.protection && !triedProtection) return 'target-1';
            const expected = expectedTargets(lesson);
            if (targets.length < (lesson.targets ?? 1)) return `target-${expected[targets.length]}`;
            return 'play';
        }
        if (lesson.kind === 'infection') return step === 'start' ? 'infection' : 'life';
        if (lesson.kind === 'witch') return !targets.length ? 'target-2' : step === 'confirm' ? 'kill-confirm' : 'kill';
        if (lesson.kind === 'healer') return targets.length ? 'heal-confirm' : 'target-2';
        if (lesson.kind === 'confess') return step === 'retry' ? 'retry' : 'life';
        if (lesson.kind === 'reveal') return step === 'reveal' ? 'life' : 'target-1';
        return { life: 'card', draw: 'draw', end: 'end', night: 'night', dawn: 'dawn' }[lesson.kind] || '';
    }
    function updateCoach(override) {
        body.querySelectorAll('[data-training-next]').forEach(element => element.removeAttribute('data-training-next'));
        const key = override || nextAction();
        const element = [...body.querySelectorAll('[data-training-action]')].find(button => button.dataset.trainingAction === key && !button.disabled);
        if (!element) return;
        element.dataset.trainingNext = 'true';
        const coach = body.querySelector('.training-coach');
        const label = element.querySelector('strong')?.textContent || element.textContent;
        if (coach) coach.textContent = `👇 กดตรงที่มีกรอบเรืองแสง: ${label.trim()}`;
        if (!dialog.open) return;
        element.focus({ preventScroll: true });
        const bounds = element.getBoundingClientRect();
        const visible = dialog.getBoundingClientRect();
        const headerHeight = dialog.querySelector('header')?.offsetHeight || 0;
        if (bounds.bottom > visible.bottom - 16 || bounds.top < visible.top + headerHeight + 12) {
            element.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    }
    function chooseTarget(id) {
        const lesson = lessons[index];
        if (finished) return;
        if (lesson.kind === 'card') {
            if (!selected) { hint('แตะการ์ดในมือก่อน แล้วค่อยเลือกผู้เล่น'); return; }
            if (scene.players[id].effects.includes('Piety') && ['Accusation', 'Evidence', 'Witness'].includes(lesson.card)) {
                triedProtection = true;
                hint('🛡️ มาลีมีพลังศรัทธา ใช้การ์ดแดงใส่ไม่ได้ · ลองเลือกคำปันแทน'); return;
            }
            const expected = expectedTargets(lesson);
            if (targets.length >= expected.length) { hint('เลือกเป้าหมายครบแล้ว · กดเล่นการ์ดด้านล่าง'); return; }
            if (id !== expected[targets.length]) { hint(`ฉากนี้ให้เลือก ${scene.players[expected[targets.length]].name}${targets.length ? ' เป็นผู้รับ' : ''}`); return; }
            if (lesson.protection) triedProtection = true;
            targets.push(id); render();
        } else if (lesson.kind === 'witch' || lesson.kind === 'healer') {
            if (id !== 2) { hint('ฉากนี้ลองเลือกคำปัน เพื่อดูผลของการโจมตีและป้องกัน'); return; }
            targets = [id]; step = 'marked'; message = lesson.kind === 'witch' ? '📍 มาร์คคำปันแล้ว ทีมปอบเห็นมาร์คนี้ · ยังไม่มีใครตาย' : 'เลือกคำปันแล้ว · กดยืนยันการป้องกัน'; render();
        } else if (lesson.kind === 'reveal' && id === 1) { step = 'reveal'; render(); }
    }
    function playCard() {
        const lesson = lessons[index];
        if (lesson.card === 'Curse' || lesson.card === 'Alibi') { step = 'pick-effect'; render(); return; }
        if (!applyTrainingCard(scene, lesson.card, targets)) { hint('เป้าหมายนี้รับการ์ดไม่ได้ เลือกใหม่อีกครั้ง'); return; }
        if (lesson.card === 'Witness') { step = 'witness-life'; message = 'ข้อกล่าวหาถึง 7 แต้มแล้ว · เลือกเปิดการ์ดชีวิตของมาลี'; render(); }
        else complete();
    }
    function renderActions(parent, lesson) {
        if (finished) {
            const revealed = lesson.kind === 'infection' || lesson.kind === 'reveal' ? ['Witch'] : lesson.kind === 'draw' ? ['Accusation', 'Evidence'] : [];
            if (revealed.length) {
                const row = node('div', '', 'training-card-row');
                revealed.forEach(name => { cardButton(name, () => {}, row).disabled = true; });
                parent.appendChild(row);
            }
            return;
        }
        if (lesson.kind === 'card') {
            if (step === 'witness-life') {
                showLife(parent, scene.players[1], () => { scene.players[1].life--; complete(); }, 'Not A Witch'); return;
            }
            if (step === 'pick-effect') {
                const options = lesson.card === 'Curse' ? scene.players[1].effects : scene.players[1].accusations;
                const limit = lesson.card === 'Curse' ? 1 : 3;
                parent.appendChild(node('p', `เลือกการ์ดที่จะนำออก ${limit === 1 ? '1 ใบ' : 'ได้สูงสุด 3 ใบ'}`));
                const row = node('div', '', 'training-card-row');
                options.forEach((name, optionIndex) => {
                    const choice = cardButton(name, () => {
                        selectedCards = selectedCards.includes(optionIndex)
                            ? selectedCards.filter(value => value !== optionIndex)
                            : selectedCards.length < limit ? [...selectedCards, optionIndex] : selectedCards;
                        render();
                    }, row);
                    choice.setAttribute('aria-pressed', String(selectedCards.includes(optionIndex)));
                    choice.dataset.trainingAction = `effect-${optionIndex}`;
                });
                parent.appendChild(row);
                button('ยืนยันนำการ์ดออก', () => { applyTrainingCard(scene, lesson.card, targets, selectedCards); complete(); }, parent, !selectedCards.length);
                return;
            }
            parent.appendChild(node('p', 'การ์ดที่ใช้ฝึกในบทนี้'));
            const row = node('div', '', 'training-card-row');
            const choice = cardButton(lesson.card, () => { selected = true; message = lesson.targets === 0 ? 'เครื่องเซ่นวางหน้าตัวเองได้' : 'เลือกผู้เล่นบนกระดานด้านบน'; render(); }, row);
            choice.setAttribute('aria-pressed', String(selected));
            parent.appendChild(row);
            const count = lesson.targets ?? 1;
            button('เล่นการ์ด', playCard, parent, !selected || targets.length !== count);
            return;
        }
        switch (lesson.kind) {
        case 'life':
            cardButton('Not A Witch', complete, parent, 'ดูการ์ดชีวิตของฉัน'); break;
        case 'draw':
            button(taps ? 'ยืนยันจั่ว 2 ใบ' : '🂠 จั่ว 2 ใบ', () => {
                if (!taps++) { render(); return; }
                scene.deck -= 2; scene.players[0].hand += 2; complete();
            }, parent); break;
        case 'end':
            button(taps ? 'ยืนยันจบเทิร์น' : 'จบเทิร์น', () => { if (!taps++) render(); else complete(); }, parent); break;
        case 'infection':
            if (step === 'start') button('🂠 จั่วพิธีเซ่นไหว้', () => { step = 'holder'; scene.players[1].effects.push('Black Cat'); message = 'มาลีถือเครื่องเซ่น · เลือกเปิดการ์ดชีวิตของเธอ'; render(); }, parent);
            else if (step === 'holder') showLife(parent, scene.players[1], () => { scene.players[1].life--; step = 'left'; message = 'ต่อไป หยิบการ์ดชีวิตจากมาลีซึ่งอยู่ทางซ้ายมือคุณ'; render(); }, 'Not A Witch');
            else showLife(parent, scene.players[1], () => { scene.role = 'ปอบ'; scene.knownWitches = [1]; complete(); }, 'Witch');
            break;
        case 'night':
            button('🂠 จั่วยามวิกาล', () => { scene.phase = 'กลางคืน'; scene.knownWitches = [1, 3]; complete(); }, parent); break;
        case 'witch':
            if (step === 'confirm') {
                button('ยืนยันฆ่าคำปันจริง', complete, parent);
                button('กลับไปปรึกษาทีม', () => { step = 'marked'; render(); }, parent);
            } else button('🩸 ฆ่าเป้าหมายที่เลือก…', () => { step = 'confirm'; message = 'ยืนยันอีกครั้ง: เลือกคำปันเป็นเป้าหมายคืนนี้?'; render(); }, parent, !targets.length);
            break;
        case 'healer':
            cardButton('Constable', () => hint('หมอผีมีความสามารถป้องกัน แต่ยังอยู่ทีมชาวบ้านในฉากนี้'), parent);
            button('ยืนยันปกป้องคำปัน', () => { scene.players[2].effects.push('constable-protected'); complete(); }, parent, !targets.length); break;
        case 'confess':
            if (step !== 'retry') showLife(parent, scene.players[0], () => { scene.players[0].life--; complete(); }, 'Not A Witch');
            button('ลองข้ามการสารภาพ', () => { scene.players[0].alive = false; step = 'retry'; message = 'ฉากนี้ไม่มีการป้องกันอื่น คุณจึงถูกฆ่า · ลองสารภาพเพื่อดูอีกผลลัพธ์'; render(); }, parent, step === 'retry');
            if (step === 'retry') button('ลองสารภาพแทน', () => { scene.players[0].alive = true; step = 'start'; message = ''; render(); }, parent);
            break;
        case 'dawn':
            button('เริ่มวันใหม่', () => { scene.deck += scene.discard; scene.discard = 0; scene.phase = 'กลางวัน'; complete(); }, parent); break;
        case 'reveal':
            if (step === 'reveal') showLife(parent, scene.players[1], () => { scene.players[1].alive = false; scene.phase = 'จบเกม'; complete(); }, 'Witch');
            else button('เลือกเปิดการ์ดชีวิตมาลี', () => { step = 'reveal'; render(); }, parent);
            break;
        }
    }
    function render() {
        const lesson = lessons[index];
        body.replaceChildren();
        body.appendChild(node('p', `${lesson.chapter} · บท ${index + 1}/${lessons.length}`, 'training-eyebrow'));
        const progress = node('progress'); progress.max = lessons.length; progress.value = index; progress.setAttribute('aria-label', 'ความคืบหน้าบทฝึก'); body.appendChild(progress);
        const heading = node('h3', lesson.title); heading.tabIndex = -1; body.appendChild(heading);
        body.appendChild(node('p', `คุณเป็น: ${scene.role} · ช่วง: ${scene.phase} · จั่ว ${scene.deck} / ทิ้ง ${scene.discard}`, 'training-meta'));
        body.appendChild(node('p', finished ? '✓ ทำสำเร็จแล้ว' : lesson.prompt, 'training-instruction'));
        const coach = node('p', '', 'training-coach'); coach.setAttribute('role', 'status'); body.appendChild(coach);
        const board = node('div', '', 'training-board');
        scene.players.forEach(player => {
            const interactive = (lesson.kind === 'card' && lesson.targets !== 0 && step === 'start') ||
                ['witch', 'healer'].includes(lesson.kind) || (lesson.kind === 'reveal' && player.id === 1);
            const tile = button('', () => chooseTarget(player.id), board, finished || !player.alive || !interactive);
            tile.classList.add('training-player');
            tile.dataset.trainingAction = `target-${player.id}`;
            tile.setAttribute('aria-pressed', String(targets.includes(player.id)));
            const points = player.accusations.reduce((sum, name) => sum + ({ Accusation: 1, Evidence: 3, Witness: 7 }[name] || 0), 0);
            tile.append(node('strong', player.name), node('span', player.alive ? `ชีวิต ${player.life} · ในมือ ${player.hand} · กล่าวหา ${points}` : '💀 เสียชีวิตแล้ว'));
            if (player.effects.length) tile.appendChild(node('small', player.effects.map(name => name === 'constable-protected' ? 'หมอผีปกป้อง' : cardNames[name]).join(' · ')));
            if (scene.knownWitches?.includes(player.id)) tile.appendChild(node('small', '👹 ทีมปอบที่คุณรู้จัก'));
            if (targets.includes(player.id)) tile.appendChild(node('small', `${lesson.kind === 'witch' ? '📍 มาร์คของคุณ' : '✓ เลือกแล้ว'}${lesson.targets === 2 ? ` (${targets.indexOf(player.id) ? 'ผู้รับ' : 'ต้นทาง'})` : ''}`));
        });
        body.appendChild(board);
        const actions = node('div', '', 'training-actions'); renderActions(actions, lesson); body.appendChild(actions);
        const feedback = node('p', message, 'training-feedback'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); body.appendChild(feedback);
        const footer = node('div', '', 'training-footer');
        button('← บทก่อน', () => startLesson(index - 1), footer, index === 0);
        button(finished ? (index === lessons.length - 1 ? 'ดูสรุปการฝึก' : 'บทถัดไป →') : 'ข้ามบทนี้ →', () => startLesson(index + 1), footer, false, 'next');
        body.appendChild(footer);
        updateCoach();
    }
    function summary() {
        body.replaceChildren();
        const practiced = new Set(lessons.filter(lesson => completed.has(lesson.id)).map(lesson => lesson.card).filter(Boolean));
        body.append(node('h3', 'สรุปการฝึก'), node('p', `ทำสำเร็จ ${completed.size}/${lessons.length} บท · ลองการ์ด ${practiced.size}/${Object.keys(cardNames).length} ชนิด`, 'training-instruction'));
        body.appendChild(node('p', 'บทฝึกครอบคลุมชาวบ้าน ปอบ หมอผี และลำดับกลางวัน → กลางคืน → ก่อนรุ่งสาง → วันใหม่ → จบเกม'));
        const remaining = lessons.filter(lesson => !completed.has(lesson.id));
        if (remaining.length) {
            body.appendChild(node('p', 'บทที่ยังไม่ได้ทำสำเร็จ · แตะเพื่อกลับไปลอง'));
            remaining.forEach(lesson => button(lesson.title, () => startLesson(lessons.indexOf(lesson)), body, false, `review-${lesson.id}`));
        } else body.appendChild(node('p', '✓ ทำครบทุกบทและการ์ดทั้ง 18 ชนิดแล้ว พร้อมลองห้องจริงได้เลย'));
        button('เริ่มฝึกใหม่', () => { completed.clear(); startLesson(0); }, body);
        button('กลับหน้าแรก', () => dialog.close(), body);
        updateCoach(remaining.length ? `review-${remaining[0].id}` : 'restart');
    }
    function showRoomBlock() {
        dialog.dataset.trainingBlocked = 'true';
        body.replaceChildren();
        body.append(node('h3', 'คุณยังอยู่ในห้องจริง'), node('p', 'ออกจากห้องก่อนเริ่มฝึก เพื่อไม่ให้พลาดเทิร์นของคุณ'));
        button('ออกจากห้องแล้วฝึก', event => {
            waitingToLeave = true;
            event.currentTarget.disabled = true;
            event.currentTarget.textContent = 'กำลังออกจากห้อง…';
            client.state.socket.emit('leave room');
        }, body, !client.state.socket.connected, 'leave-to-train');
        button('กลับไปที่ห้อง', () => dialog.close(), body);
        updateCoach('leave-to-train');
    }
    function showIntro() {
        dialog.dataset.trainingBlocked = 'false';
        waitingToLeave = false;
        body.replaceChildren();
        restore();
        body.append(node('h3', 'ฝึกเล่นแบบลงมือทำ'), node('p', 'ประมาณ 3–5 นาที · ชาวบ้าน ปอบ หมอผี · การ์ดครบ 18 ชนิด', 'training-instruction'),
            node('p', 'แต่ละบทเป็นฉากจำลองสั้น ๆ ที่เตรียมไว้ ให้ลองกดเลือกการ์ด เลือกเป้าหมาย และเห็นผลทันที ไม่ต้องสร้างห้องหรือรอคนอื่น'));
        if (completed.size || index) button('ฝึกต่อจากครั้งก่อน', () => startLesson(index), body);
        button('เริ่มฝึกตั้งแต่ต้น', () => { completed.clear(); startLesson(0); }, body);
        updateCoach(completed.size || index ? 'resume' : 'start');
    }
    function open(event) {
        opener = event.currentTarget;
        dialog.showModal();
        // A saved room name is only a reconnect hint, not proof of membership.
        const room = client.state.currentRoomState;
        if (room && (room.players?.[client.state.myUniqueId] || room.isSpectator)) showRoomBlock();
        else showIntro();
    }
    document.getElementById('show-training-btn').addEventListener('click', open);
    document.getElementById('intro-training-btn').addEventListener('click', open);
    close.addEventListener('click', () => dialog.close());
    client.state.socket.on('room left', () => {
        if (dialog.open && (waitingToLeave || dialog.dataset.trainingBlocked === 'true')) showIntro();
    });
    client.state.socket.on('room joined', () => {
        // Reconnecting can restore a real room after the training dialog opens.
        if (dialog.open) showRoomBlock();
    });
    client.state.socket.on('connect', () => {
        if (dialog.open && dialog.dataset.trainingBlocked === 'true') showRoomBlock();
    });
    client.state.socket.on('disconnect', () => {
        if (dialog.open && dialog.dataset.trainingBlocked === 'true') {
            waitingToLeave = false;
            showRoomBlock();
        }
    });
    dialog.addEventListener('close', () => { waitingToLeave = false; opener?.focus(); });
}
