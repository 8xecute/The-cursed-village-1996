import { client } from '../core/client.js';

client.actions.renderActiveRooms = function renderActiveRooms(rooms) {
    if (!client.dom.activeRoomsList) return;
    client.dom.activeRoomsList.innerHTML = '';

    if (!rooms || rooms.length === 0) {
        client.dom.activeRoomsList.innerHTML = '<div class="room-list-empty">ยังไม่มีห้องที่เปิดอยู่</div>';
        return;
    }

    rooms.forEach((room) => {
        const roomRow = document.createElement('div');
        roomRow.className = 'active-room-item';

        const info = document.createElement('div');
        info.className = 'active-room-info';
        const roomTitle = document.createElement('div'); roomTitle.className = 'active-room-name'; roomTitle.textContent = room.name;
        const meta = document.createElement('div'); meta.className = 'active-room-meta';
        meta.textContent = `โฮสต์: ${room.hostName} | ผู้เล่น ${room.playerCount}/${room.maxPlayers} · ${room.gameStarted ? room.gameOver ? 'จบเกมแล้ว · เข้าชมได้' : 'กำลังเล่น · เข้าร่วมเป็นผู้ชม' : 'รอเริ่มเกม'}`;
        info.append(roomTitle, meta);

        const joinBtn = document.createElement('button');
        joinBtn.className = 'active-room-join-btn';
        joinBtn.textContent = room.gameStarted ? 'เข้าชม' : room.playerCount >= room.maxPlayers ? 'ห้องเต็ม' : 'เข้าร่วม';
        joinBtn.disabled = !room.gameStarted && room.playerCount >= room.maxPlayers;
        joinBtn.addEventListener('click', () => {
            if (!client.state.myPlayerName) {
                client.state.myPlayerName = `ผู้เล่น-${client.state.myUniqueId.slice(-4)}`;
            }
            client.state.socket.emit('join room', room.name, client.state.myPlayerName);
        });

        roomRow.appendChild(info);
        roomRow.appendChild(joinBtn);
        client.dom.activeRoomsList.appendChild(roomRow);
    });
};

export function initialize() {
  client.state.socket.on('connect', () => {
      console.log('Connected to server!');
      // Register uniqueId and name on connect/reconnect
      // We send playerName here because it's required for creating/joining rooms.
      // If not set, it will be an empty string, server will handle it.
      client.state.socket.emit('register uniqueId', client.state.myUniqueId, client.state.myPlayerName || '');

      // If player was in a room before disconnecting, try to rejoin
      if (client.state.currentRoomName) {
          client.state.socket.emit('join existing room', client.state.currentRoomName);
      } else if (client.state.roomFromUrl) {
          if (!client.state.myPlayerName) client.state.myPlayerName = `ผู้เล่น-${client.state.myUniqueId.slice(-4)}`;
          client.state.socket.emit('join room', client.state.roomFromUrl, client.state.myPlayerName);
      } else {
          // Otherwise, request active rooms to display in lobby
          client.state.socket.emit('request rooms list');
      }
  });

  client.state.socket.on('active rooms list', (rooms) => {
      console.log('Active rooms:', rooms);
      client.actions.renderActiveRooms(rooms || []);
  });

  client.state.socket.on('room joined', (roomName) => {
      client.state.currentRoomName = roomName;
      try { sessionStorage.setItem('currentRoomName', roomName); sessionStorage.setItem('villageEntered', 'true'); } catch (e) {}
      document.getElementById('music-overlay').style.display = 'none';
      client.dom.currentRoomDisplay.textContent = roomName || 'ไม่มี';
      client.dom.roomManagementSection.style.display = 'none';
      client.dom.roomLobbySection.style.display = 'block';
      client.dom.gameSection.style.display = 'none'; // Ensure game section is hidden initially
      client.dom.leaveRoomButton.style.display = 'block';
      if (client.dom.copyRoomLinkHeaderBtn) client.dom.copyRoomLinkHeaderBtn.style.display = 'inline-block';
      if (client.dom.invitedRoomBanner) client.dom.invitedRoomBanner.style.display = 'none';

      // Update browser URL query parameter with room name
      try {
          const currentUrl = new URL(window.location.href);
          if (currentUrl.searchParams.get('room') !== roomName) {
              currentUrl.searchParams.set('room', roomName);
              window.history.replaceState({}, '', currentUrl);
          }
      } catch (e) {
          console.error('Failed to update URL:', e);
      }

      // ไม่ต้องสั่งเปิดเพลงหรือเปลี่ยน src ที่นี่อีก ปล่อยให้ระบบเพลงจัดการเองตามเฟส
  });

  client.state.socket.on('room state update', (roomState) => {
      console.log('Room state updated:', roomState);
      client.state.currentRoomState = roomState; // Store room state for night actions
      client.actions.syncTable3D();
      if (client.dom.nameInputContainer) client.dom.nameInputContainer.style.display = roomState.gameStarted ? 'none' : 'flex';
      const registeredName = roomState.players?.[client.state.myUniqueId]?.name;
      if (registeredName) {
          const previousName = client.state.myPlayerName || '';
          const draft = client.dom.nameInput.value;
          // Ready toggles and other room updates must preserve an unfinished
          // rename, including an empty draft and edits made while saving.
          const hasDraft = draft !== previousName;
          client.state.myPlayerName = registeredName;
          try { sessionStorage.setItem('playerName', registeredName); } catch (_) {}
          client.dom.playerNameDisplay.textContent = registeredName;
          if (!hasDraft || draft.trim() === registeredName) client.dom.nameInput.value = registeredName;
      }
      client.actions.updateTryalCardDisplay(); // Always update tryal card display on room state update
      
      // Change background music based on game phase
      if (roomState.currentPhase) {
          client.actions.changePhaseMusic(roomState.currentPhase, roomState);
      }
      // Update lobby/game UI based on roomState
      client.dom.lobbyRoomName.textContent = roomState.name;
      client.dom.lobbyPlayerCount.textContent = roomState.playerCount;
      client.dom.lobbyMaxPlayers.textContent = roomState.maxPlayers;
      client.dom.playerListDiv.innerHTML = '';
      let isHost = false;
      let myPlayer = roomState.players?.[client.state.myUniqueId] || null;
      const viewerIsHost = !!roomState.players?.[client.state.myUniqueId]?.isHost;
      const playersInOrder = Object.values(roomState.players).sort((a, b) => a.name.localeCompare(b.name));

      // Populate player list and check host status
      playersInOrder.forEach(player => {
          const playerDiv = document.createElement('div');
          playerDiv.className = `player-item ${player.alive ? 'alive' : 'dead'} ${roomState.currentTurnPlayerUniqueId === player.uniqueId ? 'current-turn' : ''}`;
          playerDiv.dataset.uniqueId = player.uniqueId; // Store uniqueId for night actions
          let html = `<span class="player-name-status">${player.name}`;
          // เพิ่ม tag (ทีมปอบ) เฉพาะฝั่งปอบเห็น
          if (myPlayer && myPlayer.hasBeenWitch && player.hasBeenWitch) {
              html += ' <span style="color:#ff1744;font-size:0.95em;font-weight:bold;">(ทีมปอบ)</span>';
          }
          html += ` ${player.isHost ? '(โฮสต์)' : ''} ${player.isBlackCatHolder ? ' (เครื่องเซ่น)' : ''}`;
          if (player.isBot) html += ' <span class="bot-player-badge">🤖 บอท</span>';
          if (!player.alive) {
              html += ' <span class="player-dead-badge-sm">💀 เสียชีวิตแล้ว</span>';
          }
          if (!roomState.gameStarted) {
              if (player.isHost) {
                  html += ' <span class="ready-badge host">👑 หัวห้อง</span>';
              } else if (player.isReady) {
                  html += ' <span class="ready-badge ready">✅ พร้อม</span>';
              } else {
                  html += ' <span class="ready-badge not-ready">⏳ รอพร้อม</span>';
              }
          }
          html += '</span>';
          if (roomState.gameStarted) {
              html += `<span class="player-stats">การ์ด: ${player.handSize} | ชีวิต: ${player.tryalCardCount} | ข้อกล่าวหา: ${player.accusationPoints}</span>`;
          }
          // --- Show Red Card Status Effects (Accusation/Evidence/Witness) ---
          if (player.inPlayCards && Array.isArray(player.inPlayCards)) {
              const redEffectCards = player.inPlayCards.filter(c => c && typeof c === 'object' && c.color === 'Red');
              if (redEffectCards.length > 0) {
                  html += '<div class="sidebar-red-effects" style="margin-top:2px; display:flex; flex-wrap:wrap; gap:4px;">';
                  redEffectCards.forEach((cardObj, idx) => {
                      let value = cardObj.value || 1;
                      let cardName = client.actions.displayCardName(cardObj.name);
                      let badge = `<span class='effect-card card-theme card-red' data-effect='${cardName}' style="padding:1.5px 8px 1.5px 8px;margin:0 4px 2px 0;border-radius:7px;font-size:0.93em;vertical-align:middle;display:inline-flex;align-items:center;gap:2px;">` +
                          `${cardName} <span style=\"color:#fff;background:#b71c1c;padding:0.5px 5px;border-radius:5px;margin-left:2px;font-size:0.95em;\">+${value}</span>` +
                          `</span>`;
                      html += badge;
                  });
                  html += '</div>';
              }
          }
          playerDiv.innerHTML = html;
          if (!roomState.gameStarted && viewerIsHost && player.isBot) {
              const removeBotButton = document.createElement('button');
              removeBotButton.type = 'button';
              removeBotButton.className = 'bot-player-remove-btn';
              removeBotButton.textContent = 'นำบอทออก';
              removeBotButton.addEventListener('click', () => {
                  client.state.socket.emit('remove bot', roomState.name, player.uniqueId);
              });
              playerDiv.appendChild(removeBotButton);
          }
          client.dom.playerListDiv.appendChild(playerDiv);
          if (player.uniqueId === client.state.myUniqueId) {
              isHost = player.isHost;
              myPlayer = player;
          }
      });

      // Populate the target selection dropdown with the latest player data
      client.actions.populateCardTargetSelect(roomState.players, client.state.myUniqueId);

      // Update Ready toggle button for non-hosts
      if (client.dom.readyToggleBtn) {
          if (!roomState.gameStarted && !isHost) {
              client.dom.readyToggleBtn.style.display = 'inline-flex';
              const me = roomState.players[client.state.myUniqueId];
              if (me && me.isReady) {
                  client.dom.readyToggleBtn.className = 'ready-btn ready';
                  client.dom.readyToggleBtn.innerHTML = '<span class="ready-btn-icon">✅</span> <span class="ready-btn-text">พร้อมแล้ว · ยกเลิก</span>';
              } else {
                  client.dom.readyToggleBtn.className = 'ready-btn not-ready';
                  client.dom.readyToggleBtn.innerHTML = '<span class="ready-btn-icon">⏳</span> <span class="ready-btn-text">พร้อม</span>';
              }
          } else {
              client.dom.readyToggleBtn.style.display = 'none';
          }
      }

      // Host controls visibility
      if (isHost) {
          client.dom.hostControlsLobby.style.display = 'block';
          if (client.dom.addBotButton) {
              client.dom.addBotButton.style.display = roomState.gameStarted ? 'none' : 'inline-flex';
              client.dom.addBotButton.disabled = roomState.gameStarted || roomState.playerCount >= roomState.maxPlayers;
          }
          client.dom.startGameButton.style.display = roomState.gameStarted ? 'none' : 'inline-block';
          if (!roomState.gameStarted) {
              const nonHostPlayers = Object.values(roomState.players).filter(p => !p.isHost);
              const readyCount = nonHostPlayers.filter(p => p.isReady).length;
              if (nonHostPlayers.length > 0) {
                  client.dom.startGameButton.textContent = `เริ่มเกม (${readyCount}/${nonHostPlayers.length} พร้อม)`;
              } else {
                  client.dom.startGameButton.textContent = 'เริ่มเกม';
              }
          }
          // Make the game-specific host controls visible if the game has started
          if (roomState.gameStarted) {
              client.dom.hostControlsGame.style.display = 'block';
          } else {
              client.dom.hostControlsGame.style.display = 'none';
          }
      } else {
          client.dom.hostControlsLobby.style.display = 'none';
          client.dom.hostControlsGame.style.display = 'none';
          client.dom.startGameButton.style.display = 'none';
          if (client.dom.addBotButton) client.dom.addBotButton.style.display = 'none';
      }

      // Game state updates
      if (roomState.gameStarted) {
          document.body.classList.add('in-game');
          client.dom.roomLobbySection.style.display = 'none';

          // If phase is not NIGHT, ensure night action UI is hidden/reset
          if (roomState.currentPhase !== 'NIGHT') {
              client.actions.disableNightTargetSelection();
          }

          client.dom.gameSection.style.display = 'block';

          client.dom.currentPhaseDisplay.textContent = client.actions.getPhaseNameTH(roomState.currentPhase);
          client.dom.dayNumberDisplay.textContent = roomState.dayNumber;
          client.dom.currentTurnPlayerDisplay.textContent = roomState.currentTurnPlayerName || 'ยังไม่มี';
          
          // Update deck information
          if (roomState.deckCount !== undefined) {
              client.dom.deckCountDisplay.textContent = roomState.deckCount;
          }
          if (roomState.discardPileCount !== undefined) {
              client.dom.discardPileCountDisplay.textContent = roomState.discardPileCount;
          }

          // Update turn status
          const wasMyTurn = client.state.isMyTurn;
          client.state.isMyTurn = roomState.currentPhase === 'DAY' && !roomState.gameOver &&
              !!roomState.players?.[client.state.myUniqueId]?.alive &&
              roomState.currentTurnPlayerUniqueId === client.state.myUniqueId;
          if (!client.state.isMyTurn) {
              client.state.hasPlayedCardsThisTurn = false; // Reset when turn changes
          }
          client.actions.updateTurnUI();

          // Update mobile tabs badges & auto-switch
          if (client.dom.tabTurnBadge) {
              client.dom.tabTurnBadge.style.display = client.state.isMyTurn ? 'inline-block' : 'none';
          }
          if (client.dom.tabPlayerCountBadge && roomState.players) {
              const count = Object.keys(roomState.players).length;
              client.dom.tabPlayerCountBadge.textContent = `(${count})`;
          }
          if (client.state.isMyTurn && !wasMyTurn && window.innerWidth <= 768 && client.state.currentMobileGameTab !== 'hand') {
              client.actions.switchMobileGameTab('hand');
          }

          // The action-guide feature owns the status banner.

          // --- Spectator handling ---
          client.state.isSpectatorMode = !!roomState.isSpectator;
          client.actions.updateSpectatorUI(client.state.isSpectatorMode);

          // --- NEW: Disable all controls if player is dead ---
          if (myPlayer && !myPlayer.alive) {
              if (!client.state.deathNotified) {
                  client.actions.addGameMessage('💀 คุณตายแล้ว! คุณจะไม่สามารถทำแอ็กชันใดๆ ได้อีก', 'red', true);
                  client.state.deathNotified = true;
                  client.actions.showDeathNoticeModal();
              }
              if (typeof client.dom.drawCardButton !== 'undefined' && client.dom.drawCardButton) client.dom.drawCardButton.disabled = true;
              if (typeof client.dom.playCardButton !== 'undefined' && client.dom.playCardButton) client.dom.playCardButton.disabled = true;
              if (typeof client.dom.endTurnButton !== 'undefined' && client.dom.endTurnButton) client.dom.endTurnButton.disabled = true;
              if (typeof client.dom.confessButton !== 'undefined' && client.dom.confessButton) client.dom.confessButton.disabled = true;
              if (typeof client.dom.skipConfessButton !== 'undefined' && client.dom.skipConfessButton) client.dom.skipConfessButton.disabled = true;
              // Hide/disable night action section
              var nightActionSection = document.getElementById('night-action-section');
              if (nightActionSection) nightActionSection.style.display = 'none';
              // Hide/disable witch action section
              if (typeof client.dom.witchActionSection !== 'undefined' && client.dom.witchActionSection) client.dom.witchActionSection.style.display = 'none';
              // Hide/disable game actions
              if (typeof client.dom.gameActionsDiv !== 'undefined' && client.dom.gameActionsDiv) client.dom.gameActionsDiv.style.display = 'none';
              // --- ปิด witch chat input/button ---
              if (typeof client.dom.witchChatInput !== 'undefined' && client.dom.witchChatInput) client.dom.witchChatInput.disabled = true;
              if (typeof client.dom.witchChatSendButton !== 'undefined' && client.dom.witchChatSendButton) client.dom.witchChatSendButton.disabled = true;
              if (typeof client.dom.witchChatInput !== 'undefined' && client.dom.witchChatInput) client.dom.witchChatInput.placeholder = 'คุณตายแล้ว ไม่สามารถส่งข้อความได้';
          }
          if (myPlayer && myPlayer.alive) {
              client.state.deathNotified = false;
          }

          // --- NEW: Disable all controls if awaitingLeftTryalSelections (พิธีเซ่นไหว้) ---
          if (roomState.awaitingLeftTryalSelections) {
              if (typeof client.dom.drawCardButton !== 'undefined' && client.dom.drawCardButton) client.dom.drawCardButton.disabled = true;
              if (typeof client.dom.playCardButton !== 'undefined' && client.dom.playCardButton) client.dom.playCardButton.disabled = true;
              if (typeof client.dom.endTurnButton !== 'undefined' && client.dom.endTurnButton) client.dom.endTurnButton.disabled = true;
          }

          // Update my hand display (only if my hand data is sent by server)
          // Server only sends myHand via specific 'update hand' event
          client.dom.handCardCount.textContent = myPlayer ? myPlayer.handSize : 0;

          // Update Tryal card display
          client.actions.updateTryalCardDisplay();

          // Show/hide confess section
          // --- Reset confess popup flag when phase or day changes ---
          if (roomState.currentPhase !== client.state.lastConfessPhase || roomState.dayNumber !== client.state.lastConfessDay) {
              client.state.confessPopupShownForThisPreDawn = false;
              client.state.lastConfessPhase = roomState.currentPhase;
              client.state.lastConfessDay = roomState.dayNumber;
          }
          if (
              roomState.currentPhase === 'PRE_DAWN' &&
              myPlayer && myPlayer.alive &&
              (!roomState.confessionActions || !roomState.confessionActions.includes(client.state.myUniqueId)) &&
              (!roomState.nightConfessors || !roomState.nightConfessors.includes(client.state.myUniqueId)) &&
              roomState.confessionOrder &&
              roomState.confessionOrder.includes(client.state.myUniqueId) &&
              !client.state.confessPopupShownForThisPreDawn
          ) {
              if (client.state.myTryalCards?.length > 0) {
                  client.actions.showConfessPopup(client.state.myTryalCards);
                  client.state.confessPopupShownForThisPreDawn = true;
              }
          } else if (roomState.currentPhase === 'DAY' && myPlayer && myPlayer.alive && roomState.playerForcedToRevealTryal === client.state.myUniqueId) {
              // ซ่อน confess section เมื่อถูกบังคับเปิดการ์ดชีวิต
              client.dom.confessSection.style.display = 'none';
          } else {
              client.dom.confessSection.style.display = 'none';
          }

          // Show/hide Witch action section for Black Cat assignment
          if (roomState.isAssigningBlackCat && myPlayer && (myPlayer.isWitch || myPlayer.hasBeenWitch)) {
              client.dom.witchActionSection.style.display = 'block';
              if (!document.getElementById('assign-blackcat-popup')) {
                  const aliveList = Object.values(roomState.players || {}).filter(p => p.alive);
                  client.actions.showAssignBlackCatPopup(aliveList);
              }
          } else {
              client.dom.witchActionSection.style.display = 'none';
          }

          // Show/hide witch chat based on witch status
          if (myPlayer) {
              client.actions.updateWitchChatVisibility(myPlayer.hasBeenWitch);
          }

          // Request game message history for reconnection
          if (client.state.currentRoomName) {
              client.state.socket.emit('request game message history', client.state.currentRoomName);
          }

          // Show/hide Night action section
          if (roomState.currentPhase === 'NIGHT' && myPlayer && myPlayer.alive) {
              // Check if player is witch or constable
              if (myPlayer.hasBeenWitch || myPlayer.isWitch || myPlayer.isConstable) {
                  const nightActionSection = document.getElementById('night-action-section');
                  if (nightActionSection) nightActionSection.style.display = 'block';
                  // Update players grid
                  client.actions.updatePlayersGrid(roomState, client.state.myUniqueId, client.state.nightActionState.actionType);
                  // The specific prompts will be handled by socket events
                  
                  // If player is both witch and constable, show special message
                  if (myPlayer.isWitch && myPlayer.isConstable) {
                      client.actions.addGameMessage('คุณเป็นทั้งปอบและหมอผี! คุณจะใช้สิทธิ์สังหารก่อน แล้วค่อยใช้สิทธิ์ปกป้อง', 'purple', true);
                  }
              } else {
                  const nightActionSection = document.getElementById('night-action-section');
                  if (nightActionSection) nightActionSection.style.display = 'none';
              }
          } else {
              const nightActionSection = document.getElementById('night-action-section');
              if (nightActionSection) nightActionSection.style.display = 'none';
              // Ensure night target selection is disabled when not in night phase
              client.actions.disableNightTargetSelection();
          }

          // --- Always update players board grid when game is started ---
          if (roomState.gameStarted) {
              client.actions.updatePlayersBoardGrid(roomState, client.state.myUniqueId);
          } else {
              // ซ่อน section ถ้าเกมยังไม่เริ่ม
              document.body.classList.remove('in-game');
              const section = document.getElementById('players-board-section');
              if (section) section.style.display = 'none';
          }

          // Show game over message and stats
          if (roomState.gameOver) {
              client.actions.addGameMessage(`เกมจบแล้ว! ผู้ชนะคือ: ${roomState.winner}!`, 'gold', true);
              // Optionally disable all game actions
              if (client.dom.gameActionsDiv) client.dom.gameActionsDiv.style.display = 'none';
              if (client.dom.confessSection) client.dom.confessSection.style.display = 'none';
              
              // แสดงสถิติเกมจบแล้ว
              client.actions.showGameOverStats(roomState);
          }

          // Reset nightActionState.hasSubmitted เมื่อเริ่มรอบใหม่ (เฟสเปลี่ยน)
          if (roomState.currentPhase !== 'NIGHT') client.state.nightActionState.hasSubmitted = false;
          
          // ลบ popup สถิติถ้าเกมยังไม่จบ
          if (!roomState.gameOver) {
              const statsPopup = document.querySelector('.stats-popup');
              if (statsPopup) {
                  statsPopup.remove();
              }
          }

          // ถ้าเพิ่ง forced reveal ให้ disable draw card button
          if (client.state.forcedRevealJustHappened) {
              client.dom.drawCardButton.disabled = true;
          }

          // --- Witch Action Popup State ---
          let witchActionPopupOpen = false;
          let witchActionHasChosen = false;
          let witchActionType = null; // 'blackcat' or 'kill'

          function showWitchActionPopup(type) {
              witchActionPopupOpen = true;
              witchActionHasChosen = false;
              witchActionType = type;
              // ... existing popup creation code ...
          }

          // Example: When confirming Black Cat assignment
          // witchActionHasChosen = true; witchActionPopupOpen = false;

          // Example: When confirming witch kill
          // witchActionHasChosen = true; witchActionPopupOpen = false;

          // In room state update or phase update
          function handleWitchActionPopupState(roomState) {
              if (witchActionPopupOpen && !witchActionHasChosen) {
                  // Black Cat assignment
                  if (witchActionType === 'blackcat' && !roomState.isAssigningBlackCat) {
                      // Find which witch made the selection (if possible)
                      const lastWitch = roomState.lastBlackCatAssignerName || 'ปอบคนอื่น';
                      client.actions.addGameMessage(`${lastWitch} ได้เลือกเป้าหมายเครื่องเซ่นแล้ว คุณไม่ได้เลือกทันเวลา`, 'orange', true);
                      // Close popup (implement actual popup close logic here)
                      witchActionPopupOpen = false;
                  }
                  // Witch kill
                  if (witchActionType === 'kill' && roomState.currentPhase !== 'NIGHT') {
                      const lastWitch = roomState.lastWitchKillerName || 'ปอบคนอื่น';
                      client.actions.addGameMessage(`${lastWitch} ได้เลือกเป้าหมายฆ่าตอนกลางคืน`, 'orange', true);
                      witchActionPopupOpen = false;
                  }
              }
          }

          // Call handleWitchActionPopupState(currentRoomState) inside socket.on('room state update', ...) after updating currentRoomState.
          // ... existing code ...
      } else {
          client.dom.gameSection.style.display = 'none';
          client.dom.roomLobbySection.style.display = 'block';
      }
      client.actions.updateWitchChatTeamList();

      // --- Hide overlay on room state update if not in LOBBY phase ---
      if (window.hideMusicOverlayIfNeeded) {
          window.hideMusicOverlayIfNeeded(roomState.currentPhase);
      }
      // --- ปิด popup เลือกฆ่า/วางแมวดำถ้าคนอื่นเลือกไปแล้ว ---
      // ปิด popup เลือกฆ่า (night-action-popup) ถ้า phase ไม่ใช่ NIGHT
      if (roomState.currentPhase !== 'NIGHT' ||
          (client.state.nightActionState.actionType === 'witch' && roomState.witchNightState?.committed)) {
          client.actions.removeNightActionPopup();
      }
      client.actions.updateWitchNightMarks();
      const closeLifeDialog = id => {
          const popup = document.getElementById(id);
          if (popup) (popup.closest('.tryal-modal-overlay') || popup).remove();
      };
      if (roomState.gameOver || !roomState.players?.[client.state.myUniqueId]?.alive) {
          ['confess-popup', 'accused-tryal-select-popup', 'select-left-tryal-popup'].forEach(closeLifeDialog);
          document.querySelectorAll('.select-player-modal, .curse-target-modal, #alibi-redcard-select-popup').forEach(element => element.remove());
      }
      if (!roomState.playerForcedToRevealTryal) closeLifeDialog('accused-tryal-select-popup');
      if (!roomState.awaitingLeftTryalSelections) closeLifeDialog('select-left-tryal-popup');
      if (roomState.currentPhase !== 'PRE_DAWN' || roomState.confessionActions?.includes(client.state.myUniqueId)) closeLifeDialog('confess-popup');
      // ปิด popup เลือกวางแมวดำ (assign-blackcat-popup) ถ้าไม่ได้อยู่ในสถานะ assign แล้ว
      if (document.getElementById('assign-blackcat-popup') && !roomState.isAssigningBlackCat) {
          document.getElementById('assign-blackcat-overlay')?.remove();
          document.getElementById('assign-blackcat-popup')?.remove();
      }
      // --- ปิด popup เลือกการ์ดชีวิตพิธีเซ่นไหว้ ถ้า phase ไม่ใช่ BLACKCAT_TRYAL หรือผู้เล่นตาย ---
      const blackcatTryalPopup = document.getElementById('blackcat-tryal-select-popup');
      if (blackcatTryalPopup && (roomState.currentPhase !== 'BLACKCAT_TRYAL' || (myPlayer && !myPlayer.alive))) {
          (blackcatTryalPopup.closest('.tryal-modal-overlay') || blackcatTryalPopup).remove();
      }
  });

  client.state.socket.on('game message', (message, color = 'black', bold = false) => {
      client.actions.addGameMessage(message, color, bold);
      // ปิด popup เลือกเป้าหมายปอบถ้าได้รับแจ้งเตือนทีมปอบเลือกเป้าหมายแล้ว
      if (message.startsWith('คืนนี้ทีมปอบ:')) {
          client.actions.disableNightTargetSelection();
          // The dedicated witch-chat event supplies this message once.
      }
      // Special handling for duplicate room or join-not-found
      if (message.includes('ชื่อห้องนี้ถูกใช้แล้ว')) {
          alert('สร้างห้องไม่ได้: มีชื่อห้องนี้แล้ว');
      }
      if (message.includes('ไม่พบห้องนี้.')) {
          alert('เข้าห้องไม่ได้: ไม่พบห้องนี้');
      }
  });

  client.state.socket.on('game message history', (messages) => {
      // Clear existing messages and load history
      client.dom.gameMessagesDiv.innerHTML = '';
      messages.forEach(msg => {
          client.actions.addGameMessage(msg.message, msg.color, msg.bold);
      });
  });

  client.state.socket.on('request player name', () => {
      // If name is not set, show input. If already set, do nothing.
      if (!client.state.myPlayerName && !client.state.currentRoomName) {
          client.dom.nameInputContainer.style.display = 'flex';
      }
  });

  client.state.socket.on('room left', () => {
      document.querySelectorAll('.tryal-modal-overlay, .select-player-modal, .curse-target-modal, #alibi-redcard-select-popup, #night-action-popup, #night-action-overlay, #must-play-night-popup, #forced-reveal-notice-popup').forEach(element => element.remove());
      client.actions.closeForcedRevealNotice?.();
      client.actions.removeNightActionPopup?.();
      client.actions.restoreTable3DDialogs?.();
      client.state.table3D?.setActive(false);
      client.state.table3DFocusedPlayer = null;
      document.getElementById('table3d-section').hidden = true;
      // ลบ popup สถิติถ้ามี
      const statsPopup = document.querySelector('.stats-popup');
      if (statsPopup) {
          statsPopup.remove();
      }
      // Clear player board and player list
      const playersBoardList = document.getElementById('players-board-list');
      if (playersBoardList) playersBoardList.innerHTML = '';
      const nightPlayersList = document.getElementById('night-players-list');
      if (nightPlayersList) nightPlayersList.innerHTML = '';
      // Hide all game/lobby sections except room management
      document.body.classList.remove('in-game');
      client.actions.switchMobileGameTab('hand');
      if (client.dom.tabTurnBadge) client.dom.tabTurnBadge.style.display = 'none';
      if (client.dom.tabChatBadge) client.dom.tabChatBadge.style.display = 'none';
      client.dom.roomManagementSection.style.display = 'block';
      client.dom.roomLobbySection.style.display = 'none';
      client.dom.gameSection.style.display = 'none';
      client.dom.leaveRoomButton.style.display = 'none';
      if (client.dom.copyRoomLinkHeaderBtn) client.dom.copyRoomLinkHeaderBtn.style.display = 'none';
      try {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('room');
          window.history.replaceState({}, '', currentUrl);
      } catch (e) {
          console.error('Failed to clear URL param:', e);
      }
      // Reset game state variables
      client.state.currentRoomName = null;
      try { sessionStorage.removeItem('currentRoomName'); } catch (e) {}
      client.state.currentRoomState = null;
      client.state.myCurrentHand = [];
      client.state.myTryalCards = [];
      client.state.myRevealedTryalCardIndexes = [];
      client.state.selectedCard = null;
      client.state.isMyTurn = false;
      client.state.hasPlayedCardsThisTurn = false;
      client.state.drawButtonDisabled = false;
      // Hide/clear other UI as needed
      client.actions.updateHandDisplay([]);
      client.actions.updateTryalCardDisplay();
      client.actions.updatePlayersGrid(null, client.state.myUniqueId);
      client.actions.updateWitchChatVisibility(false);
      client.dom.confessSection.style.display = 'none';
      // Show name input if not set
      if (!client.state.myPlayerName) {
          client.dom.nameInputContainer.style.display = 'flex';
      }
      client.state.socket.emit('request rooms list');
      client.actions.addGameMessage('คุณออกจากห้องแล้ว.', 'orange');
  });
}
