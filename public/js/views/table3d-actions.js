import { client } from '../core/client.js';

const dockSelector = '.select-player-modal:not(.table3d-confirm), #night-action-popup, #assign-blackcat-overlay, .tryal-modal-overlay, .curse-target-modal, #alibi-redcard-select-popup, #must-play-night-popup';
const last = selector => [...document.querySelectorAll(selector)].at(-1);
function picker() {
    const modal = document.querySelector('.select-player-modal');
    if (modal) return { root: modal, rows: [...modal.querySelectorAll('.player-select-card[data-unique-id]')] };
    const night = document.getElementById('night-action-popup');
    if (night) return { root: night, rows: [...night.querySelectorAll('.night-target-row[data-unique-id]')] };
    const assign = document.querySelector('[data-player-select]');
    if (assign) return { root: assign, select: assign.querySelector('select'), rows: [] };
    return null;
}
function canAct() {
    const state = client.state.currentRoomState;
    return !!client.state.socket?.connected && !!state?.players?.[client.state.myUniqueId]?.alive && !state.gameOver && !state.isSpectator;
}
client.actions.canUseTable3DHand = function canUseTable3DHand() {
    const state = client.state.currentRoomState;
    return canAct() && client.state.isMyTurn && state.currentPhase === 'DAY' &&
        !state.awaitingLeftTryalSelections && !state.playerForcedToRevealTryal && !state.isAssigningBlackCat &&
        (!client.actions.getTable3DInteraction() || client.actions.getTable3DInteraction().preview);
};
client.actions.getTable3DInteraction = function getTable3DInteraction() {
    if (!canAct()) return null;
    const life = last('[data-life-owner]');
    if (life) return { kind: 'life', owner: life.dataset.lifeOwner,
        selected: client.state.table3DLifeChoice?.root === life ? [client.state.table3DLifeChoice.index] : [],
        eligible: [...life.querySelectorAll('[data-life-index]')].filter(button => !button.disabled).map(button => Number(button.dataset.lifeIndex)) };
    const effect = last('[data-effect-owner]');
    if (effect) {
        const owner = effect.dataset.effectOwner;
        const cards = client.state.currentRoomState.players[owner]?.inPlayCards || [];
        return { kind: 'effect', owner, eligible: cards.flatMap((card, index) =>
            effect.classList.contains('curse-target-modal') ? card.color === 'Blue' ? [index] : []
                : ['Accusation', 'Evidence'].includes(card.name) ? [index] : []),
            selected: [...effect.querySelectorAll('[data-effect-index][aria-pressed="true"]')].map(button => Number(button.dataset.effectIndex)) };
    }
    if (document.getElementById('must-play-night-popup')) return { kind: 'event', event: 'night' };
    const choice = picker();
    if (!choice) {
        const card = client.state.myCurrentHand?.[client.state.selectedCard];
        const state = client.state.currentRoomState;
        if (!client.state.isMyTurn || state.currentPhase !== 'DAY' || state.awaitingLeftTryalSelections ||
            state.playerForcedToRevealTryal || state.isAssigningBlackCat || !card ||
            ![...client.state.CARDS_NEED_TARGET, ...client.state.CARDS_NEED_TWO_TARGETS].includes(card.name)) return null;
        const batchPoints = card.color === 'Red' ? client.actions.selectedRedPoints?.() || 0 : 0;
        const eligible = [], blocked = {}, outcomes = {};
        for (const player of Object.values(state.players)) {
            const protectedTarget = (card.color === 'Red' || ['Accusation', 'Evidence', 'Witness'].includes(card.name)) &&
                player.inPlayCards?.some(effect => (effect.name || effect) === 'Piety');
            const reason = !player.alive ? 'เสียชีวิตแล้ว' : player.uniqueId === client.state.myUniqueId ? 'เลือกตัวเองไม่ได้'
                : protectedTarget ? 'พลังศรัทธา · กันการ์ดแดง' : null;
            if (reason) blocked[player.uniqueId] = reason; else { eligible.push(player.uniqueId); outcomes[player.uniqueId] = client.actions.cardOutcomePreview?.(batchPoints ? {...card,batchPoints} : card, player) || 'แตะเพื่อเลือก'; }
        }
        return { kind: 'player', preview: true, eligible, selected: [], blocked, outcomes };
    }
    const eligible = choice.select ? [...choice.select.options].filter(option => option.value && !option.disabled).map(option => option.value)
        : choice.rows.filter(row => row.getAttribute('aria-disabled') !== 'true').map(row => row.dataset.uniqueId);
    const selected = choice.select ? [choice.select.value].filter(Boolean)
        : choice.rows.filter(row => row.classList.contains('selected')).map(row => row.dataset.uniqueId);
    const blocked = {};
    for (const player of Object.values(client.state.currentRoomState.players)) {
        if (eligible.includes(player.uniqueId)) continue;
        blocked[player.uniqueId] = !player.alive ? 'เสียชีวิตแล้ว' : player.uniqueId === client.state.myUniqueId ? 'เลือกตัวเองไม่ได้'
            : player.inPlayCards?.some(card => card.name === 'Piety') && choice.root.classList.contains('select-player-modal') ? 'พลังศรัทธา · กันการ์ดแดง'
                : player.inPlayCards?.some(card => card.name === 'Asylum') ? 'ที่หลบภัย · ป้องกันคืนนี้' : 'เลือกไม่ได้';
    }
    return { kind: 'player', eligible, selected, blocked };
};
client.actions.handleTable3DPlayer = function handleTable3DPlayer(id) {
    if (!client.state.myCurrentHand?.[client.state.selectedCard] && !client.actions.getTable3DInteraction()) {
        client.actions.showTable3DPlayerStatus?.(id);
        return;
    }
    if (!canAct()) return;
    let choice = picker();
    if (!choice) {
        const preview = client.actions.getTable3DInteraction();
        if (!preview?.preview || !preview.eligible.includes(id)) return;
        const play = document.getElementById('play-card-button');
        if (!play || play.disabled) return;
        play.click();
        choice = picker();
    }
    if (choice?.select) {
        if (![...choice.select.options].some(option => option.value === id && !option.disabled)) return;
        if (choice.select.value === id) {
            const confirm = choice.root.querySelector('[data-assign-blackcat-confirm]');
            if (confirm && !confirm.disabled) confirm.click();
            return;
        }
        choice.select.value = id;
        choice.select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        const row = choice?.rows.find(row => row.dataset.uniqueId === id);
        if (!row || row.getAttribute('aria-disabled') === 'true') return;
        if (choice.root.id === 'night-action-popup' && client.state.currentRoomState?.currentPhase === 'NIGHT' &&
            client.state.nightActionState?.actionType === 'constable' &&
            client.state.nightActionState.selectedTargetId === id && row.classList.contains('selected')) {
            client.actions.submitNightAction('constable');
            return;
        }
        if (choice.root.classList.contains('select-player-modal') && row.classList.contains('selected')) {
            const confirm = choice.root.querySelector('.target-confirm-btn');
            if (confirm && !confirm.disabled) confirm.click();
            return;
        }
        row.click();
    }
};
client.actions.handleTable3DLife = function handleTable3DLife(id, index) {
    if (!canAct()) return;
    const root = last('[data-life-owner]');
    if (root?.dataset.lifeOwner === id) {
        const button = [...root.querySelectorAll('[data-life-index]')].find(button => Number(button.dataset.lifeIndex) === index);
        if (button && !button.disabled) {
            const previous = client.state.table3DLifeChoice;
            if (previous?.root === root && previous.index === index && previous.button === button) {
                client.state.table3DLifeChoice = null;
                button.click();
            } else client.state.table3DLifeChoice = { root, index, button };
            document.dispatchEvent(new Event('table3d selection'));
        }
    } else client.actions.handleTable3DPlayer(id);
};
client.actions.handleTable3DEffect = function handleTable3DEffect(id, index) {
    if (!canAct()) return;
    const root = last('[data-effect-owner]');
    if (root?.dataset.effectOwner !== id) { client.actions.handleTable3DPlayer(id); return; }
    if (root.classList.contains('curse-target-modal')) {
        const cards = client.state.currentRoomState.players[id]?.inPlayCards || [];
        const ordinal = cards.flatMap((card, i) => card.color === 'Blue' ? [i] : []).indexOf(index);
        if (ordinal >= 0) root.querySelector(`[data-effect-ordinal="${ordinal}"]`)?.click();
    } else {
        const effect = client.state.currentRoomState.players[id]?.inPlayCards?.[index];
        if (!effect) return;
        let button = root.querySelector(`[data-effect-index="${index}"]`);
        if (!button) { root.querySelector(`[data-effect-type="${effect.name}"]`)?.click(); button = root.querySelector(`[data-effect-index="${index}"]`); }
        if (button && !button.disabled) button.click();
    }
};

client.actions.restoreTable3DDialogs = function restoreTable3DDialogs() {
    document.querySelectorAll('.table3d-confirm, .table3d-direct-target').forEach(modal => {
        modal.classList.remove('table3d-confirm', 'table3d-direct-target');
        const title = modal.querySelector('h3');
        if (title && modal.dataset.originalTargetTitle) title.textContent = modal.dataset.originalTargetTitle;
        delete modal.dataset.originalTargetTitle;
        modal.querySelectorAll('[data-table3d-original-display]').forEach(row => {
            row.style.display = row.dataset.table3dOriginalDisplay;
            row.hidden = row.dataset.table3dOriginalHidden === 'true';
            delete row.dataset.table3dOriginalDisplay; delete row.dataset.table3dOriginalHidden;
        });
    });
    document.querySelectorAll('.table3d-docked, .table3d-phase-source, .table3d-panel-minimized').forEach(root => {
        root.classList.remove('table3d-docked', 'table3d-phase-source', 'table3d-panel-minimized');
        root.querySelectorAll('.table3d-panel-toggle').forEach(toggle => toggle.remove());
    });
    document.body.classList.remove('table3d-phase-details', 'table3d-show-details');
    client.state.table3DLifeChoice = null;
};

export function initialize() {
    const panel = document.getElementById('table3d-play-panel');
    const hint = document.getElementById('table3d-action-hint');
    const description = document.getElementById('table3d-card-description');
    const statusBar = document.querySelector('#table3d-section .table3d-instructions');
    statusBar.replaceChildren(hint);
    const statusPanel = document.createElement('aside');
    statusPanel.id = 'table3d-player-info'; statusPanel.hidden = true;
    const statusClose = document.createElement('button');
    statusClose.type = 'button'; statusClose.textContent = '×'; statusClose.setAttribute('aria-label', 'ปิดสถานะผู้เล่น');
    statusClose.onclick = () => { statusPanel.hidden = true; statusPlayerId = null; };
    const statusText = document.createElement('div');
    statusPanel.append(statusClose, statusText);
    document.getElementById('table3d-section').appendChild(statusPanel);
    let statusPlayerId = null;
    function renderPlayerStatus() {
        const player = client.state.currentRoomState?.players?.[statusPlayerId];
        if (!player) { statusPanel.hidden = true; return; }
        const name = document.createElement('strong'); name.textContent = player.name;
        const points = document.createElement('p'); points.textContent = `ข้อกล่าวหา ${player.accusationPoints || 0}/7 · ${player.alive ? 'ยังมีชีวิต' : 'เสียชีวิตแล้ว'}`;
        const effects = document.createElement('p'); effects.textContent = player.inPlayCards?.length
            ? `การ์ดที่ได้รับ: ${player.inPlayCards.map(card => client.actions.displayCardName(card.name || card)).join(' · ')}` : 'ไม่มีการ์ดสถานะ';
        statusText.replaceChildren(name, points, effects);
    }
    client.actions.showTable3DPlayerStatus = id => {
        statusPlayerId = id; renderPlayerStatus();
        statusPanel.hidden = !client.state.currentRoomState?.players?.[id];
    };
    let scheduled = false;
    const phasePanel = document.getElementById('table3d-phase-panel');
    let phaseSignature = '';
    let phaseRoot = null;
    let phaseCollapsed = false;
    function updatePhasePanel(enabled, request) {
        const life = last('[data-life-owner]');
        const night = document.getElementById('night-action-popup');
        const assign = document.querySelector('[data-player-select]');
        const event = document.getElementById('must-play-night-popup');
        const target = document.querySelector('.select-player-modal');
        const alibi = document.getElementById('alibi-redcard-select-popup');
        const root = life || night || assign || event || target || alibi;
        const sources = new Set([
            ...[...document.querySelectorAll('[data-life-owner]')].map(element => element.closest('.tryal-modal-overlay')),
            night, assign?.closest('.tryal-modal-overlay'), event, target, alibi
        ].filter(Boolean));
        document.querySelectorAll('.table3d-phase-source').forEach(element => {
            if (!enabled || !sources.has(element)) element.classList.remove('table3d-phase-source');
        });
        if (enabled) sources.forEach(element => {
            if (!element.classList.contains('table3d-phase-source')) element.classList.add('table3d-phase-source');
        });
        if (root !== phaseRoot) {
            phaseRoot = root; phaseSignature = ''; phaseCollapsed = false;
            phasePanel.classList.remove('is-minimized');
            client.state.table3DLifeChoice = null;
            document.body.classList.remove('table3d-phase-details');
        }
        const source = life?.closest('.tryal-modal-overlay') || night || assign?.closest('.tryal-modal-overlay') || event || target || alibi;
        source?.querySelectorAll('.table3d-panel-toggle').forEach(toggle => toggle.remove());
        if (enabled && source) {
            for (const element of [source, root]) {
                if (element.classList.contains('is-collapsed')) element.classList.remove('is-collapsed');
            }
            const toggle = root.querySelector('.popup-collapse-toggle');
            if (toggle && toggle.getAttribute('aria-expanded') !== 'true') {
                toggle.textContent = 'ย่อ'; toggle.setAttribute('aria-expanded', 'true');
            }
        }
        if (source && source.classList.contains('table3d-phase-source') !== enabled) source.classList.toggle('table3d-phase-source', enabled);
        phasePanel.classList.toggle('is-direct-target', !!target);
        const show = enabled && canAct() && !!root;
        if (phasePanel.hidden !== !show) phasePanel.hidden = !show;
        if (!show) { phaseSignature = ''; return; }
        const kill = document.getElementById('witch-kill-confirm-panel');
        const selectedId = client.state.nightActionState?.selectedTargetId;
        const choice = client.state.table3DLifeChoice;
        const signature = JSON.stringify([request, selectedId, !!kill, kill?.textContent, kill?.querySelector('.night-confirm-btn')?.disabled, phaseCollapsed, assign?.querySelector('select')?.value]);
        if (signature === phaseSignature) return;
        phaseSignature = signature;
        phasePanel.replaceChildren();
        const heading = document.createElement('strong');
        heading.textContent = life ? life.querySelector('h3')?.textContent || 'เลือกการ์ดชีวิต'
            : night ? (client.state.nightActionState.actionType === 'witch' ? 'ปอบ · แตะผู้เล่นเพื่อมาร์ค' : 'หมอผี · แตะผู้เล่นเพื่อปกป้อง') : assign ? 'แตะผู้เล่นเพื่อมอบเครื่องเซ่น' : target ? target.querySelector('h3')?.textContent : alibi ? 'ข้อแก้ต่าง · เลือกการ์ดแดงบนโต๊ะ' : 'เล่นยามวิกาลเพื่อเข้าสู่กลางคืน';
        const header = document.createElement('div');
        header.className = 'table3d-phase-header';
        header.append(heading);
        phasePanel.appendChild(header);
        const note = document.createElement('p');
        note.textContent = life ? choice?.root === life ? `เลือกใบที่ ${choice.index + 1} แล้ว · แตะใบเดิมอีกครั้งเพื่อยืนยัน` : 'แตะการ์ดชีวิตที่มีกรอบบนโต๊ะ'
            : assign ? request?.selected?.length ? `เลือก: ${client.state.currentRoomState.players[request.selected[0]]?.name || ''} · แตะคนเดิมอีกครั้งเพื่อมอบเครื่องเซ่น` : 'แตะผู้เล่นเพื่อเลือก แล้วแตะคนเดิมอีกครั้งเพื่อมอบเครื่องเซ่น'
            : selectedId && night ? `เป้าหมาย: ${client.state.currentRoomState.players[selectedId]?.name || ''}${client.state.nightActionState.actionType === 'constable' ? ' · แตะคนเดิมอีกครั้งเพื่อปกป้อง' : ''}` : target ? request?.selected?.length ? `เลือก: ${client.state.currentRoomState.players[request.selected[0]]?.name || ''} · แตะคนเดิมอีกครั้งเพื่อยืนยัน` : 'แตะผู้เล่นเพื่อเลือก แล้วแตะคนเดิมอีกครั้งเพื่อยืนยัน' : alibi ? `เลือกแล้ว ${request?.selected?.length || 0} ใบ · เลือกชนิดเดียว แต้มรวมไม่เกิน 3` : 'เลือกเป้าหมายบนโต๊ะ แล้วกดยืนยัน';
        phasePanel.appendChild(note);
        function action(label, handler, disabled = false) {
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = label; button.disabled = disabled;
            button.onclick = () => { if (canAct() && root.isConnected) { handler(); schedule(); } };
            phasePanel.appendChild(button);
            return button;
        }
        if (alibi) {
            const confirm = alibi.querySelector('[data-alibi-action=confirm]');
            action('ยืนยันลบการ์ดที่เลือก', () => confirm?.click(), !confirm || confirm.disabled);
            action('ยกเลิก', () => alibi.querySelector('[data-alibi-action=cancel]')?.click());
        }
        if (target) action('ยกเลิกการเล่น', () => target.querySelector('.target-cancel-btn')?.click());
        if (life) {
            const skip = life.querySelector('#skip-confess-button');
            if (skip) action('ข้ามการสารภาพ', () => skip.click(), skip.disabled);
        } else if (night) {
            if (kill) {
                const text = document.createElement('p'); text.textContent = kill.querySelector('p')?.textContent;
                phasePanel.appendChild(text);
                const confirm = kill.querySelector('.night-confirm-btn');
                action(confirm?.textContent || 'ยืนยันฆ่าจริง', () => { confirm?.click(); phaseSignature = ''; }, !!confirm?.disabled).className = 'table3d-kill-confirm';
                const warning = document.createElement('small');
                warning.textContent = 'ยืนยันแทนทั้งทีม · เปลี่ยนไม่ได้';
                phasePanel.appendChild(warning);
                action('กลับไปเลือก', () => kill.querySelector('.witch-kill-cancel-btn')?.click());
            } else {
                const witch = client.state.nightActionState.actionType === 'witch';
                if (witch) action('เลือกฆ่าคนนี้ →', () => client.actions.submitNightAction('witch'), !selectedId || !!client.state.currentRoomState?.witchNightState?.committed).className = 'table3d-kill-select';
                if (witch && !request?.eligible?.length) action('ไม่สังหารคืนนี้…', () => client.actions.showWitchKillConfirmation(null));
            }
        } else if (event) {
            action('เล่นยามวิกาล', () => {
                const index = client.state.myCurrentHand?.findIndex(card => card.name === 'Night');
                if (index === undefined || index < 0 || !client.state.isMyTurn) return;
                if (client.state.selectedCard !== index) document.querySelectorAll('#player-hand > .card')[index]?.click();
                const play = document.getElementById('play-card-button');
                if (play && !play.disabled) play.click();
            });
        } else if (assign) {
            action('ยืนยันมอบเครื่องเซ่น', () => assign.querySelector('[data-assign-blackcat-confirm]')?.click(), !assign.querySelector('select')?.value);
        }
        if (night && client.state.nightActionState.actionType === 'witch') action('แชททีม', () => document.body.classList.toggle('table3d-phase-details'));
        if (life) phasePanel.classList.add('table3d-direct-action'); else phasePanel.classList.remove('table3d-direct-action');
    }
    function refresh() {
        scheduled = false;
        const enabled = document.body.classList.contains('game-view-3d') && !document.body.classList.contains('table3d-unavailable') && !!client.state.currentRoomState?.gameStarted;
        if (!enabled && document.querySelector('.table3d-docked, .table3d-confirm, .table3d-panel-toggle, .table3d-phase-source')) {
            client.actions.restoreTable3DDialogs();
        }
        const layout = document.querySelector('.game-layout');
        const targetOpen = !!document.querySelector('.select-player-modal');
        if (layout && layout.inert !== (!enabled && targetOpen)) layout.inert = !enabled && targetOpen;
        const request = client.actions.getTable3DInteraction();
        if (!enabled || request || client.state.myCurrentHand?.[client.state.selectedCard]) {
            statusPanel.hidden = true; statusPlayerId = null;
        } else if (statusPlayerId) renderPlayerStatus();
        updatePhasePanel(enabled, request);
        document.querySelectorAll(dockSelector).forEach(root => {
            if (root.classList.contains('table3d-docked') !== enabled) root.classList.toggle('table3d-docked', enabled);
            if (enabled && !root.classList.contains('table3d-phase-source') && !root.querySelector('.popup-collapse-toggle, .table3d-panel-toggle')) {
                const toggle = document.createElement('button');
                toggle.type = 'button'; toggle.className = 'table3d-panel-toggle';
                toggle.textContent = 'ย่อแผง'; toggle.setAttribute('aria-expanded', 'true');
                toggle.onclick = () => {
                    const minimized = root.classList.toggle('table3d-panel-minimized');
                    toggle.textContent = minimized ? 'เปิดแผง' : 'ย่อแผง';
                    toggle.setAttribute('aria-expanded', String(!minimized));
                };
                root.appendChild(toggle);
            }
        });
        if (panel.hidden !== !enabled) panel.hidden = !enabled;
        if (!enabled) return;
        const state = client.state.currentRoomState;
        const summary = document.getElementById('table3d-summary');
        if (summary.hidden === !!state.gameOver) summary.hidden = !state.gameOver;
        const title = state.gameOver ? 'จบเกม · เปิดเผยการ์ดชีวิตบนโต๊ะแล้ว'
            : !canAct() ? 'ดูเกมต่อได้ · ไม่สามารถทำแอ็กชัน'
                : request?.kind === 'life' ? 'แตะการ์ดชีวิตที่มีกรอบ → แตะใบเดิมอีกครั้งเพื่อยืนยัน'
                    : request?.kind === 'effect' ? 'แตะการ์ดที่วางหน้าผู้เล่นเพื่อเลือก · ยืนยันในแผงข้างโต๊ะ'
                        : request?.kind === 'event' ? 'ยืนยันเล่นยามวิกาลในแผงข้างโต๊ะ'
                        : request?.kind === 'player' ? 'แตะผู้เล่นเพื่อเลือก → แตะคนเดิมอีกครั้งเพื่อใช้การ์ด'
                            : document.getElementById('action-guide-title')?.textContent || 'เลือกการ์ดจากมือเพื่อเริ่ม';
        if (hint.textContent !== title) hint.textContent = title;
        statusBar.classList.toggle('is-your-turn', canAct() && client.state.isMyTurn && !request);
        const selected = client.state.myCurrentHand?.[client.state.selectedCard];
        panel.classList.toggle('has-selected-card', !!selected);
        panel.classList.toggle('has-phase-action', !!request && !request.preview);
        const batchPoints = client.actions.selectedRedPoints?.() || 0;
        const text = batchPoints ? `การ์ดแดง ${client.actions.selectedRedBatch().length} ใบ · ${batchPoints}/7 แต้ม · แตะการ์ดแดงเพิ่มหรือลด แล้วเลือกผู้เล่น` : selected ? `${client.actions.displayCardName(selected.name)} · ${client.actions.displayCardDescription(selected.name)}` : 'แตะการ์ดเพื่อเลือก · แตะซ้ำเพื่อยกเลิก · การ์ดไม่ระบุเป้าหมายแตะซ้ำเพื่อใช้';
        if (description.textContent !== text) description.textContent = text;
        document.querySelectorAll('#table3d-section [data-table-action]').forEach(button => {
            const source = document.getElementById(button.dataset.tableAction);
            const disabled = !canAct() || state.currentPhase !== 'DAY' || (!!request && !request.preview) || !source || source.disabled ||
                (button.dataset.tableAction === 'clear-selected-card' && client.state.selectedCard === null);
            if (button.disabled !== disabled) button.disabled = disabled;
            if (source && button.textContent !== source.textContent) button.textContent = source.textContent;
        });
        client.actions.syncTable3D();
    }
    function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); } }
    document.querySelectorAll('#table3d-section [data-table-action]').forEach(button => button.addEventListener('click', () => {
        if (!button.disabled) document.getElementById(button.dataset.tableAction)?.click();
    }));
    document.getElementById('table3d-details-toggle').addEventListener('click', event => {
        // Open the regular board as a complete view, with its own action UI.
        client.actions.setGameViewMode('2d');
        client.actions.syncTable3D();
        event.currentTarget.setAttribute('aria-expanded', 'false');
        client.actions.switchMobileGameTab('players');
        requestAnimationFrame(() => document.querySelector('.game-layout')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    });
    document.getElementById('table3d-summary').addEventListener('click', () => document.getElementById('reopen-game-summary-btn')?.click());
    new MutationObserver(records => {
        // Our own rendered HUD must not recursively trigger itself.
        if (records.some(record => !record.target.closest?.('#table3d-section'))) schedule();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled', 'aria-pressed', 'value', 'data-life-owner'] });
    document.addEventListener('click', schedule);
    document.addEventListener('change', schedule);
    document.addEventListener('table3d selection', schedule);
    client.state.socket.on('room state update', schedule);
    client.state.socket.on('room left', schedule);
    client.state.socket.on('disconnect', schedule);
    client.state.socket.on('connect', schedule);
    refresh();
}
