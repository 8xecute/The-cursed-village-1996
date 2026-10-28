import { client } from '../core/client.js';
import { lifeSlots } from '../cards/life-slots.mjs';

client.actions.updatePlayersBoardGrid = function updatePlayersBoardGrid(roomState, myUniqueId) {
    const section = document.getElementById('players-board-section');
    const list = document.getElementById('players-board-list');
    if (!roomState || !roomState.players) {
        section.style.display = 'none';
        return;
    }
    if (roomState.gameStarted) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
        return;
    }
    list.innerHTML = '';
    // --- เรียงลำดับผู้เล่นตามลำดับเดิม ---
    const allPlayers = Object.values(roomState.players);
    let playersInOrder = allPlayers;
    const knowsWitchTeam = !!roomState.players[myUniqueId]?.hasBeenWitch;
    playersInOrder.forEach(player => {
        const card = document.createElement('div');
        card.dataset.playerId = player.uniqueId;
        card.className = 'player-board-card' + (!player.alive ? ' dead' : '') + (roomState.currentTurnPlayerUniqueId === player.uniqueId ? ' current-turn' : '');
        // Header
        let header = `<div class='player-board-header'>`;
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) {
            header += `<span class="board-turn" aria-hidden="true">▶</span>`;
        }
        header += `${player.name}`;
        if (knowsWitchTeam && player.hasBeenWitch) header += ' <span class="board-team">(ทีมปอบ)</span>';
        if (player.isReplacementBot) header += ' <span>· บอทเล่นแทน</span>';
        else if (player.reconnectDeadline) header += `<span class="reconnect-countdown" data-deadline="${Number(player.reconnectDeadline)}"></span>`;
        if (player.isHost) header += ' <span class="board-host">(โฮสต์)</span>';
        if (player.isBlackCatHolder) header += ' <span class="board-offering">(เครื่องเซ่น)</span>';
        if (!player.alive) header += ' <span class="player-dead-badge">💀 เสียชีวิตแล้ว</span>';
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) header += ' <span class="board-turn">กำลังเล่น</span>';
        header += '</div>';
        // Status
        let status = `<div class='player-board-status'>`;
        status += `การ์ดในมือ: ${player.handSize} | ข้อกล่าวหา: ${player.accusationPoints || 0}`;
        // --- Effect: Blue, Green, and now Red cards ---
        let blueEffectCards = [];
        let greenEffectCards = [];
        let redEffectCards = [];
        let blackEffectCards = [];
        
        if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
            console.log(`Player ${player.name} inPlayCards:`, player.inPlayCards);
            
            // แยกการ์ดตามสี
            player.inPlayCards.forEach(card => {
                if (typeof card === 'object') {
                    if (card.color === 'Red') {
                        redEffectCards.push(card);
                    } else if (card.color === 'Blue') {
                        blueEffectCards.push(card);
                    } else if (card.color === 'Green') {
                        greenEffectCards.push(card);
                    } else if (card.color === 'Black') {
                        blackEffectCards.push(card);
                    }
                } else if (typeof card === 'string') {
                    // Legacy string cards - กำหนดสีตามชื่อการ์ด
                    if (card === 'Accusation' || card === 'Evidence' || card === 'Witness') {
                        redEffectCards.push(card);
                    } else if (card === 'Stocks') {
                        greenEffectCards.push(card);
                    } else if (card === 'Black Cat' || card === 'Asylum' || card === 'Piety' || card === 'Matchmaker') {
                        blueEffectCards.push(card);
        }
                }
            });
            
            console.log(`Player ${player.name} blueEffectCards:`, blueEffectCards);
            console.log(`Player ${player.name} greenEffectCards:`, greenEffectCards);
            console.log(`Player ${player.name} redEffectCards:`, redEffectCards);
            console.log(`Player ${player.name} blackEffectCards:`, blackEffectCards);
        }
        
        // --- Show All Status Effects (Blue/Green/Red/Black) in one bar ---
        if (blueEffectCards.length > 0 || greenEffectCards.length > 0 || redEffectCards.length > 0 || blackEffectCards.length > 0) {
            status += `<div class='effect-bar' style='display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;'>`;
            
            // Blue effects (Permanent cards)
            blueEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? client.actions.displayCardName(cardObj) : client.actions.displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? client.actions.displayCardDescription(cardObj) : client.actions.displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-blue' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            // Green effects (Action cards)
            greenEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? client.actions.displayCardName(cardObj) : client.actions.displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? client.actions.displayCardDescription(cardObj) : client.actions.displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-green' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            // Red effects (Accusation cards)
            redEffectCards.forEach((cardObj, idx) => {
                let value = (typeof cardObj === 'object' && cardObj.value) ? cardObj.value :
                    (cardObj === 'Accusation' ? 1 : cardObj === 'Evidence' ? 3 : cardObj === 'Witness' ? 7 : 1);
                let cardName = typeof cardObj === 'string' ? client.actions.displayCardName(cardObj) : client.actions.displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? client.actions.displayCardDescription(cardObj) : client.actions.displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-red' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName} <span style=\"color:#fff;background:#b71c1c;padding:0.5px 5px;border-radius:5px;margin-left:2px;font-size:0.95em;\">+${value}</span></span>`;
            });
            
            // Black effects (Event cards)
            blackEffectCards.forEach((cardObj, idx) => {
                let cardName = typeof cardObj === 'string' ? client.actions.displayCardName(cardObj) : client.actions.displayCardName(cardObj.name);
                let cardDesc = typeof cardObj === 'string' ? client.actions.displayCardDescription(cardObj) : client.actions.displayCardDescription(cardObj.name);
                status += `<span class='effect-card card-theme card-black' title='${cardDesc}' style='padding:2px 10px;border-radius:7px;font-size:0.97em;'>${cardName}</span>`;
            });
            
            status += `</div>`;
        }
        status += '</div>';
        // Tryal Cards
        let tryals = `<div class='player-board-tryals'>การ์ดชีวิตที่เหลือ: <b>${player.tryalCardCount}</b> ใบ</div>`;
        card.innerHTML = header + status + tryals;
        const lifeRow = document.createElement('div'); lifeRow.className = 'player-board-life-row';
        for (const slot of lifeSlots(player)) {
            const item = document.createElement('figure'); item.className = 'player-life-slot';
            const known = slot.opened || !player.alive || roomState.gameOver;
            item.classList.toggle('is-opened', slot.opened);
            const mini = document.createElement('span'); mini.className = 'player-life-mini';
            mini.textContent = slot.opened ? '×' : String(slot.slot + 1);
            const caption = document.createElement('figcaption');
            caption.textContent = known && slot.card?.name ? client.actions.displayCardName(slot.card.name) : `ใบที่ ${slot.slot + 1}`;
            item.title = `ใบที่ ${slot.slot + 1}${slot.opened ? ' · เปิดเผยแล้ว' : ''}${known && slot.card?.name ? ' · ' + client.actions.displayCardName(slot.card.name) : ''}`;
            item.append(mini, caption); lifeRow.appendChild(item);
        }
        card.appendChild(lifeRow);
        list.appendChild(card);
    });
};

export function initialize() {

}

// Update only countdown text; do not rebuild cards or steal focus from dialogs.
setInterval(() => {
    if (document.body.classList.contains('game-view-3d') && Object.values(client.state.currentRoomState?.players || {}).some(player => player.reconnectDeadline)) {
        client.actions.updateTable3DFocus?.();
    }
    document.querySelectorAll('.reconnect-countdown[data-deadline]').forEach(element => {
        const seconds = Math.max(0, Math.ceil((Number(element.dataset.deadline) - Date.now()) / 1000));
        element.textContent = ` · รอเชื่อมต่อ ${seconds} วินาที`;
    });
}, 1000);
