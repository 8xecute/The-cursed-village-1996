import { client } from '../core/client.js';

client.actions.switchMobileGameTab = function switchMobileGameTab(tabName) {
    client.state.currentMobileGameTab = tabName;
    document.body.setAttribute('data-mobile-game-tab', tabName);
    
    if (client.dom.mobileTabHandBtn) client.dom.mobileTabHandBtn.classList.toggle('active', tabName === 'hand');
    if (client.dom.mobileTabPlayersBtn) client.dom.mobileTabPlayersBtn.classList.toggle('active', tabName === 'players');
    if (client.dom.mobileTabChatBtn) client.dom.mobileTabChatBtn.classList.toggle('active', tabName === 'chat');

    if (tabName === 'chat' && client.dom.tabChatBadge) {
        client.dom.tabChatBadge.style.display = 'none';
    }
};

export function initialize() {
  client.dom.mobileGameTabs = document.getElementById('mobile-game-tabs');

  client.dom.mobileTabHandBtn = document.getElementById('mobile-tab-hand-btn');

  client.dom.mobileTabPlayersBtn = document.getElementById('mobile-tab-players-btn');

  client.dom.mobileTabChatBtn = document.getElementById('mobile-tab-chat-btn');

  client.dom.tabTurnBadge = document.getElementById('tab-turn-badge');

  client.dom.tabPlayerCountBadge = document.getElementById('tab-player-count-badge');

  client.dom.tabChatBadge = document.getElementById('tab-chat-badge');

  client.state.currentMobileGameTab = 'hand';

  if (client.dom.mobileTabHandBtn) {
      client.dom.mobileTabHandBtn.addEventListener('click', () => client.actions.switchMobileGameTab('hand'));
  }

  if (client.dom.mobileTabPlayersBtn) {
      client.dom.mobileTabPlayersBtn.addEventListener('click', () => client.actions.switchMobileGameTab('players'));
  }

  if (client.dom.mobileTabChatBtn) {
      client.dom.mobileTabChatBtn.addEventListener('click', () => client.actions.switchMobileGameTab('chat'));
  }
}
