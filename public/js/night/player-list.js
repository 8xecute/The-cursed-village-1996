import { client } from '../core/client.js';

client.actions.populateNightActionPlayersList = function populateNightActionPlayersList(actionType) {
    console.log('populateNightActionPlayersList called with actionType:', actionType);
    console.log('currentRoomState:', client.state.currentRoomState);
    
    const playersList = document.getElementById('night-action-players-list');
    if (!playersList || !client.state.currentRoomState) {
        console.log('No players list element or no room state');
        return;
    }
    
    playersList.innerHTML = '';
    
    // Filter players based on action type
    let eligiblePlayers = [];
    if (actionType === 'witch') {
        // Witches can target any alive player who does NOT have Asylum and is not self
        eligiblePlayers = Object.values(client.state.currentRoomState.players).filter(player =>
            player.alive &&
            player.uniqueId !== client.state.myUniqueId &&
            !(player.inPlayCards && player.inPlayCards.some(card => (typeof card === 'string' ? card === 'Asylum' : card.name === 'Asylum')))
        );
    } else if (actionType === 'constable') {
        // Constables can target any player except themselves, and only alive
        eligiblePlayers = Object.values(client.state.currentRoomState.players).filter(player => player.uniqueId !== client.state.myUniqueId && player.alive);
    }
    
    console.log('Eligible players for night action:', eligiblePlayers.map(p => ({ name: p.name, uniqueId: p.uniqueId })));
    
    if (eligiblePlayers.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'color: #baa89b; text-align: center; padding: 24px; font-style: italic; font-size: 0.95em;';
        emptyDiv.textContent = 'ไม่มีเป้าหมายที่เลือกได้ในขณะนี้';
        playersList.appendChild(emptyDiv);
        if (actionType === 'witch') {
            const skip = document.createElement('button');
            skip.type = 'button';
            skip.className = 'witch-kill-cancel-btn';
            skip.textContent = 'ไม่สังหารคืนนี้…';
            skip.onclick = () => client.actions.showWitchKillConfirmation(null);
            playersList.appendChild(skip);
        }
        return;
    }

    eligiblePlayers.forEach(player => {
        console.log(`Adding player ${player.name} to night action list`);
        
        const playerDiv = document.createElement('div');
        playerDiv.className = 'night-target-row';
        playerDiv.dataset.uniqueId = player.uniqueId;
        
        playerDiv.innerHTML = `
            <div class="night-target-info">
                <div class="night-target-name">${player.name}</div>
                <div class="night-target-meta">การ์ดในมือ: ${player.handSize ?? 0} ใบ | การ์ดชีวิต: ${player.tryalCardCount ?? 0} ใบ</div>
            </div>
            <div class="night-target-badge">แตะเลือก</div>
        `;
        
        playerDiv.addEventListener('click', () => {
            console.log(`Player ${player.name} clicked in night action popup`);
            
            // Remove previous selection
            playersList.querySelectorAll('.night-target-row').forEach(p => {
                p.classList.remove('selected');
                const badge = p.querySelector('.night-target-badge');
                if (badge) badge.textContent = 'แตะเลือก';
            });
            
            // Highlight selected player
            playerDiv.classList.add('selected');
            const badge = playerDiv.querySelector('.night-target-badge');
            if (badge) badge.textContent = '✓ เลือกแล้ว';
            
            // Update state
            client.state.nightActionState.selectedTargetId = player.uniqueId;
            if (actionType === 'witch') {
                document.getElementById('witch-kill-confirm-panel')?.remove();
                document.getElementById('night-action-popup')?.classList.remove('confirming-kill');
                client.state.socket.emit('witch mark target', player.uniqueId, client.state.currentRoomState?.witchNightState?.nightId);
                client.actions.updateWitchNightMarks();
            }
            console.log('Updated nightActionState.selectedTargetId to:', player.uniqueId);
            
            // Show confirm button
            const confirmBtn = document.getElementById('confirm-night-action');
            if (confirmBtn) {
                confirmBtn.style.display = 'inline-block';
            }


        });
        
        playersList.appendChild(playerDiv);
    });
    
    // Add confirm button event listener
    const confirmBtn = document.getElementById('confirm-night-action');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            console.log('Confirm button clicked');
            client.actions.submitNightAction(actionType);
        };
    }
};

client.actions.updatePlayersGrid = function updatePlayersGrid(roomState, myUniqueId, actionType = null) {
    const nightPlayersListSection = document.getElementById('night-players-list-section');
    const nightPlayersList = document.getElementById('night-players-list');
    if (!nightPlayersListSection || !nightPlayersList) return;
    
    if (!roomState || !roomState.players) {
        nightPlayersListSection.style.display = 'none';
        return;
    }

    // แสดง section ตลอดเวลาเมื่อเกมเริ่มแล้ว
    if (roomState.gameStarted) {
        nightPlayersListSection.style.display = 'block';
    } else {
        nightPlayersListSection.style.display = 'none';
        return;
    }

    nightPlayersList.innerHTML = ''; // Clear existing cards

    const playersInOrder = Object.values(roomState.players).sort((a, b) => a.name.localeCompare(b.name));

    let myPlayer = roomState.players && roomState.players[myUniqueId];
    let isWitchView = myPlayer && myPlayer.hasBeenWitch;
    playersInOrder.forEach(player => {
        const card = document.createElement('div');
        card.className = 'player-board-card' + (!player.alive ? ' dead' : '') + (roomState.currentTurnPlayerUniqueId === player.uniqueId ? ' current-turn' : '');
        // Header
        let header = `<div class='player-board-header'>`;
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) {
            header += `<span style="color:#ffd700;font-size:1.2em;margin-right:6px;vertical-align:middle;">🔥</span>`;
        }
        header += `${player.name}`;
        if (isWitchView && player.hasBeenWitch) header += ' <span style="color:#ff1744;font-size:0.95em;font-weight:bold;">(ทีมปอบ)</span>';
        if (player.isHost) header += ' <span style="color:#ff4500;">(Host)</span>';
        if (player.isBlackCatHolder) header += ' <span style="color:#ffd700;">(เครื่องเซ่น)</span>';
        if (!player.alive) header += ' <span class="player-dead-badge">💀 เสียชีวิตแล้ว</span>';
        if (roomState.currentTurnPlayerUniqueId === player.uniqueId) header += ' <span style="color:#2196f3;font-weight:bold;">[เทิร์น]</span>';
        header += '</div>';
        // Status
        let status = `<div class='player-board-status'>`;
        status += `การ์ดในมือ: ${player.handSize} | ข้อกล่าวหา: ${player.accusationPoints}`;
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
        let tryals = `<div class='player-board-tryals'>`;
        if (player.tryalCards && Array.isArray(player.tryalCards)) {
            player.tryalCards.forEach((cardObj, idx) => {
                const revealed = !!(
                    player.revealedTryalCardIndexes &&
                    (
                        player.revealedTryalCardIndexes.includes(idx) ||
                        player.revealedTryalCardIndexes.includes(cardObj.name)
                    )
                );
                let cardClass = 'player-board-tryal-card';
                let cardThemeClass = '';
                if (revealed) {
                    if (cardObj.name === 'Witch') {
                        cardThemeClass = ' card-theme card-red';
                    } else if (cardObj.name === 'Constable') {
                        cardThemeClass = ' card-theme card-blue';
                    } else {
                        cardThemeClass = ' card-theme card-black';
                    }
                }
                const cardTitle = revealed
                    ? client.actions.displayCardDescription(cardObj.name)
                    : 'การ์ดชีวิตที่ยังไม่เปิดเผย';
                tryals += `<div class='${cardClass}${revealed ? ' revealed' : ''}${cardThemeClass}' title='${cardTitle}'>${revealed ? client.actions.displayCardName(cardObj.name) : 'Card ' + (idx + 1)}</div>`;
            });
        }
        tryals += '</div>';
        card.innerHTML = header + status + tryals;
        nightPlayersList.appendChild(card);
    });
};

client.actions.handleNightPlayerCardClick = function handleNightPlayerCardClick(event) {
    console.log('handleNightPlayerCardClick called');
    console.log('nightActionState:', client.state.nightActionState);
    
    if (!client.state.nightActionState.isSelecting) {
        console.log('Not in night action selection mode');
        return;
    }

    // Clear previous selection
    document.querySelectorAll('.night-player-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = event.currentTarget;
    selectedCard.classList.add('selected');

    // Get the player's uniqueId from the dataset
    const targetUniqueId = selectedCard.dataset.uniqueId;
    console.log('Selected target uniqueId:', targetUniqueId);
    
    if (targetUniqueId) {
        client.state.nightActionState.selectedTargetId = targetUniqueId;
        if (client.state.nightActionState.actionType === 'witch') {
            client.state.socket.emit('witch mark target', targetUniqueId, client.state.currentRoomState?.witchNightState?.nightId);
        }
        
        // Get player name for display
        const playerNameElement = selectedCard.querySelector('.player-name');
        const playerName = playerNameElement.textContent.split(' ')[0]; // Get first part of name
        console.log('Selected player name:', playerName);
        client.actions.addGameMessage(`เลือก ${playerName} เป็นเป้าหมาย`, 'blue');
    }
};

export function initialize() {

}
