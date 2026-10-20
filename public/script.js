import { initialize as initializeHandOrder } from './js/views/hand-order.js';
import { initialize as initializeLifeSetup } from './js/views/life-setup.js';
import { initialize as initializePrank } from './js/views/prank.js';
import { initialize as initializeRoomSettings } from './js/rooms/settings.js';
import { initialize as initializeTable3DLog } from './js/views/table3d-log.js';
import { initialize as initializePlayExperience } from './js/views/play-experience.js';
import { initialize as initializeArtwork } from './js/views/artwork.js';
import './js/views/popup-controls.js';
import { initialize as initializeTable3DActions } from './js/views/table3d-actions.js';
import { initialize as initializeTraining } from './js/training/tutorial.js';
import { initialize as initializeGuidance } from './js/views/action-guide.js';
import { initialize as initializeStory } from './js/views/story.js';
// Browser entry. Register all features, then initialize in dependency order.
import { initialize as initializeIdentity } from './js/core/identity.js';
import { initialize as initializeTable3D } from './js/views/table3d.js';
import { initialize as initializeMusic } from './js/audio/music.js';
import { initialize as initializeElements } from './js/core/elements.js';
import { initialize as initializeMobileTabs } from './js/views/mobile-tabs.js';
import { initialize as initializeSession } from './js/core/session.js';
import { initialize as initializeRoomEvents } from './js/events/room.js';
import { initialize as initializePlayerEvents } from './js/events/player.js';
import { initialize as initializeWitchChat } from './js/chat/witch.js';
import { initialize as initializeLifeSelection } from './js/cards/life-selection.js';
import { initialize as initializeRoomControls } from './js/rooms/controls.js';
import { initialize as initializeTurnControls } from './js/turns/controls.js';
import { initialize as initializeMessages } from './js/views/messages.js';
import { initialize as initializeHand } from './js/cards/hand.js';
import { initialize as initializeNightTargets } from './js/night/targets.js';
import { initialize as initializePlayerBoard } from './js/players/board.js';
import { initialize as initializeNightActions } from './js/night/actions.js';
import { initialize as initializeConfession } from './js/night/confession.js';
import { initialize as initializeNightPlayerList } from './js/night/player-list.js';
import { initialize as initializeConspiracy } from './js/cards/conspiracy.js';
import { initialize as initializeCurse } from './js/cards/curse.js';
import { initialize as initializeTargetSelection } from './js/cards/target-selection.js';
import { initialize as initializeTranslations } from './js/cards/translations.js';
import { initialize as initializeGameSummary } from './js/game/summary.js';
import { initialize as initializeHelp } from './js/views/help.js';
import { initialize as initializePlayerStatus } from './js/players/status.js';
import { initialize as initializeCardEvents } from './js/events/card-actions.js';
import { initialize as initializeAlibi } from './js/cards/alibi.js';

initializeStory();
initializeIdentity();
initializeTable3D();
initializeMusic();
initializeElements();
initializeMobileTabs();
initializeSession();
initializeRoomEvents();
initializePlayerEvents();
initializeWitchChat();
initializeLifeSelection();
initializeRoomControls();
initializeTurnControls();
initializeMessages();
initializeHand();
initializeNightTargets();
initializePlayerBoard();
initializeNightActions();
initializeConfession();
initializeNightPlayerList();
initializeConspiracy();
initializeCurse();
initializeTargetSelection();
initializeTranslations();
initializeGameSummary();
initializeHelp();
initializePlayerStatus();
initializeCardEvents();
initializeAlibi();
initializeGuidance();
initializeTraining();
initializeTable3DActions();

initializeArtwork();

initializePlayExperience();

initializeTable3DLog();

initializeRoomSettings();
initializePrank();

initializeLifeSetup();

initializeHandOrder();
