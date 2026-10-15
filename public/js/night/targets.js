import { client } from '../core/client.js';

client.actions.enableNightTargetSelection = function enableNightTargetSelection(actionType) {
    console.log('enableNightTargetSelection called with actionType:', actionType);
    console.log('Current room state:', client.state.currentRoomState);
    console.log('My unique ID:', client.state.myUniqueId);
    
    client.state.nightActionState.isSelecting = true;
    client.state.nightActionState.actionType = actionType;
    client.state.nightActionState.selectedTargetId = null;

    // Update night action UI
    const nightActionSection = document.getElementById('night-action-section');
    const nightActionTitle = document.getElementById('night-action-title');
    const nightActionInstruction = document.getElementById('night-action-instruction');
    const confirmButton = document.getElementById('confirm-night-action-button');

    if (actionType === 'witch') {
        nightActionTitle.textContent = 'Witch Action - เลือกเป้าหมายที่จะสังหาร';
        nightActionInstruction.textContent = 'คุณเป็นปอบ! เลือกผู้เล่นที่มีชีวิตอยู่ที่จะสังหารในคืนนี้:';
    } else if (actionType === 'constable') {
        nightActionTitle.textContent = 'Constable Action - เลือกผู้เล่นที่จะปกป้อง';
        // Check if player is also a witch
        if (client.state.currentRoomState && client.state.currentRoomState.players[client.state.myUniqueId] && client.state.currentRoomState.players[client.state.myUniqueId].isWitch) {
            nightActionInstruction.textContent = 'คุณเป็นทั้งปอบและหมอผี! ตอนนี้คุณใช้สิทธิ์หมอผีเพื่อปกป้องผู้เล่น:';
        } else {
            nightActionInstruction.textContent = 'คุณเป็นหมอผี! เลือกผู้เล่นที่จะปกป้องด้วยการปัดเป่าของคุณ';
        }
    }

    console.log('Showing night action section');
    nightActionSection.style.display = 'block';
    confirmButton.style.display = 'inline-block';
    
    console.log('Night action section display style:', nightActionSection.style.display);
    console.log('Confirm button display style:', confirmButton.style.display);

    // Update night players grid with selectable targets
    if (client.state.currentRoomState) {
        console.log('Calling updatePlayersGrid with actionType:', actionType);
        client.actions.updatePlayersGrid(client.state.currentRoomState, client.state.myUniqueId, actionType);
    } else {
        console.log('No currentRoomState available');
    }

    client.actions.addGameMessage(`เลือกผู้เล่นจากรายการด้านล่าง แล้วกดยืนยัน (${actionType === 'witch' ? 'สังหาร' : 'ปกป้อง'})`, 'blue');
};

client.actions.disableNightTargetSelection = function disableNightTargetSelection() {
    if (!client.state.nightActionState.isSelecting) return; // No need to disable if not enabled

    client.state.nightActionState.isSelecting = false;
    client.state.nightActionState.actionType = null;
    client.state.nightActionState.selectedTargetId = null;

    // Hide night action UI but keep players grid visible
    const nightActionSection = document.getElementById('night-action-section');
    const confirmButton = document.getElementById('confirm-night-action-button');
    
    nightActionSection.style.display = 'none';
    confirmButton.style.display = 'none';

    // Remove click listeners from night player cards
    document.querySelectorAll('.night-player-card').forEach(card => {
        card.classList.remove('selectable-target', 'selected');
        card.removeEventListener('click', client.actions.handleNightPlayerCardClick);
    });
};

export function initialize() {

}
