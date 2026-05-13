# The Cursed Village 1996 - System Export (Detailed, Extended)

This document is a technical handoff intended for future maintenance, debugging, and refactoring work.  
It explains current system behavior as implemented, not a theoretical design.

## 1) Runtime and Project Topology

### 1.1 Runtime Stack

- Backend runtime: Node.js (CommonJS)
- Server framework: Express
- Realtime transport: Socket.IO
- Frontend: Vanilla HTML/CSS/JS under `public/`
- Build tool: Webpack (client bundle emitted to `dist/`)

### 1.2 Key Files

- `server.js`
  - All server logic (room state, game flow, card resolution, socket handlers)
- `public/index.html`
  - Static game shell and main sections
- `public/script.js`
  - Client state, event listeners, UI rendering, popup workflows
- `public/style.css`
  - Layout system and responsive behavior
- `docs/SYSTEM_EXPORT_DETAILED.md`
  - English technical handoff (this file)

### 1.3 Execution Model

- State is held in-memory (`rooms` object); no persistent database currently
- Server is authoritative for gameplay outcomes
- Client is an interaction shell; most critical transitions happen on server
- Reconnect support is soft-state based (socket rebind + state replay)

## 2) Server Domain Model

### 2.1 Room Object (`rooms[roomName]`)

Typical fields include:

- Identity and lifecycle:
  - `name`, `hostUniqueId`
  - `gameStarted`, `currentPhase`, `phaseTimer`, `phaseInterval`
  - `dayNumber`, `gameOver`, `winner`
- Deck/state:
  - `gameDeck`, `discardPile`
- Turn:
  - `currentTurnPlayerUniqueId`
- Accusation/forced reveal:
  - `accusedPlayers`
  - `playerForcedToRevealTryal`
  - `playerForcedToRevealSelector`
- Night:
  - `playersWhoActedAtNight` (`witchKill`, `constableSave`)
  - `nightCardDrawer`
  - `nightConfessors`, `confessionOrder`, `currentConfessionIndex`
- Black Cat / Conspiracy:
  - `blackCatHolder`
  - `blackCatHolderAlreadyActedThisDay`
  - `awaitingConspiracySelection`
  - `awaitingLeftTryalSelections`
  - `conspiracyTryalSelections`
- Logs:
  - `gameMessageHistory`
  - `witchChatHistory`
  - `infectionLog`

### 2.2 Player Object (`room.players[uniqueId]`)

Key fields:

- Identity: `id` (socket id), `uniqueId`, `name`
- Room role: `isHost`
- Alive/connection: `alive`, `connected`
- Hand and cards:
  - `hand`
  - `tryalCards`
  - `inPlayCards`
  - `revealedTryalCardIndexes` (stores reveal markers; currently may include names)
- Role markers:
  - `isWitch`, `hasBeenWitch`
  - `isConstable`
- Turn constraints:
  - `isSilenced`
  - `hasPlayedCardsThisTurn`

## 3) End-to-End Socket Event Flow

### 3.1 Session / Identity

- Client generates/stores `uniqueId` (localStorage)
- On connect: `register uniqueId`
- On reconnect:
  - if previously in room: `join existing room`
  - otherwise: request active room list

### 3.2 Room Management

- Create room: `create room`
- Join room: `join room`
- Leave room: `leave room`
- Browse rooms: `request rooms list` -> `active rooms list`

### 3.3 Game Interaction Events

- Start game: `start game`
- Draw: `draw cards`
- Play card: `play card`
- End turn: `end turn`
- Tryal reveal/confession paths:
  - `confess during night`
  - `confess tryal card`
  - `reveal tryal card`
  - `select tryal card for confession`
- Night actions:
  - `witch kill target`
  - `constable action`
- Special selections:
  - `select curse target`
  - `select alibi removal`
  - `select blackcat tryal`
  - `select left tryal`

## 4) Phase Engine Behavior

### 4.1 Core Phases

- `LOBBY`
- `DAY`
- `NIGHT`
- `PRE_DAWN`
- plus card-driven temporary states (e.g., black-cat/left-tryal wait states)

### 4.2 DAY Flow

- `setNextTurn(room)` selects next active player
- If a selected player has no hand, server can auto-draw logic
- Actions during day:
  - draw cards
  - play cards
  - end turn
- Certain effects pause normal progression:
  - forced tryal reveal
  - Conspiracy chain resolution

### 4.3 NIGHT Flow

- Server prompts witches and constables
- Action completion tracked in `playersWhoActedAtNight`
- Fixed reliability approach:
  - uses explicit key-presence checks (`hasNightActionChosen`)
  - avoids truthy/null ambiguity bugs
- Transition to `PRE_DAWN` after required night actions complete

### 4.4 PRE_DAWN Flow

- Ordered confession and/or skip
- Night resolution finalization (death/protection outcomes)
- Increment day state and return to `DAY`

## 5) Card Resolution Notes (Important Paths)

### 5.1 Red Cards

- `Accusation` (+1), `Evidence` (+3), `Witness` (+7)
- On play:
  - increments `accusedPlayers[target]`
  - appends card to target `inPlayCards`
  - emits updates and game log
- Threshold:
  - at `>= 7`, forced reveal path is created
  - selector and target pointers stored for subsequent reveal handler

### 5.2 Blue Cards

- Persistent status cards (e.g., `Asylum`, `Piety`, `Matchmaker`, `Black Cat`)
- Stored in `inPlayCards` until removed by effects like `Curse`
- Client rendering relies on server `emitRoomState` payload

### 5.3 Green Cards

- Action cards typically consumed/discarded after resolution
- Some open nested selection workflows (`Curse`, `Alibi`, etc.)

### 5.4 Event Cards

- Immediate branch logic:
  - `Night`
  - `Conspiracy`
- Can interrupt regular turn flow and create waiting states

## 6) UI Rendering Contract

### 6.1 Room State Shape Expectations

`emitRoomState` includes per-player:

- `handSize`, `tryalCardCount`, `accusationPoints`
- `inPlayCards` as rich objects:
  - `{ name, color, value }`

Client still tolerates legacy strings in several renderers for backward safety.

### 6.2 Thai Label Rules

- Always localize card names through:
  - `displayCardName(name)` for UI labels
  - `getCardNameTH(name)` for mixed payload usage
- `getCardNameTH` now accepts object values safely (`{name: ...}`), preventing `[object Object]` rendering leaks

### 6.3 Revealed Tryal Behavior

- UI supports reveal markers by either:
  - index
  - card name
- Revealed display is rendered in Thai labels

## 7) Game-Over Conditions and Recap

### 7.1 Win Conditions (Current)

- Witches win immediately if all alive players are witch-side
- Witches win if no alive townsfolk remain under relevant state conditions
- Townsfolk win if witch cards are exhausted/unrevealed conditions met
- Draw when no alive players remain

### 7.2 Endgame UI

- Endgame popup includes:
  - winner section
  - winner-side featured cards
  - infection recap based on `infectionLog`

### 7.3 Infection Tracking

- `infectionLog` entries are appended during Conspiracy transfer logic when Witch card moves
- Entry shape:
  - `from`, `to`, `card`, `day`, `timestamp`

## 8) Reliability Improvements Already Applied

- Night dual-role action reliability (`isWitch` + `isConstable` player)
- Red card server updates now consistently reflected in dashboard/log
- Forced reveal notifications surfaced to affected target player
- Waiting status banners for multi-player selection stages
- Responsive UI improvements for PC/tablet/phone usage

## 9) Security and Dependency Posture

### 9.1 Current Audit State

- `npm audit --json` reports zero vulnerabilities

### 9.2 Dependency Strategy Applied

- Upgraded vulnerable direct dependencies
- Removed fragile legacy image optimization chain causing large vulnerable transitive trees
- Updated build scripts to avoid missing optimizer script dependency

## 10) Operational Runbook

### 10.1 Development

- Start dev server: `npm run dev`
- Run prod-like server: `npm start`

### 10.2 Validation

- Lint: `npm run lint`
- Health checks: `npm run health`
- Build client: `npm run build:client`
- Audit security: `npm audit --json`

### 10.3 Build Output Notes

- Webpack filenames are hash-based
- Every build may create new hashed assets and mark old ones as deleted
- This is expected and not a functional regression by itself

## 11) Known Technical Debt

- `server.js` is monolithic and handles many bounded contexts
- Some reveal tracking still mixes name/index semantics
- High coupling between socket handlers and card rule logic
- In-memory room state means no persistence after process restart

## 12) Recommended Refactor Plan (Incremental)

### Phase A - Low Risk

- Extract constants/maps into separate modules
- Centralize Thai localization maps
- Add shared event-name constants for server/client parity

### Phase B - Medium Risk

- Split server logic:
  - room management module
  - phase engine module
  - card resolver module
  - socket controller module

### Phase C - Reliability

- Add deterministic state machine for phase transitions
- Add integration test harness for night action and forced reveal chains
- Add snapshot tests for room state payload schemas

## 13) Suggested Test Matrix

- Night action:
  - witch-only
  - constable-only
  - same player is both witch and constable
- Red card chains:
  - accusation accumulation to threshold
  - witness immediate forced reveal
- Conspiracy chains:
  - black-cat reveal path
  - left-tryal all-player waiting completion
- Endgame:
  - all infected alive witches
  - townsfolk win
  - draw

## 14) Quick Troubleshooting Guide

- Symptom: role action unavailable at night
  - Check `playersWhoActedAtNight` key presence semantics
  - Verify prompt events dispatched to expected player socket
- Symptom: status badges stale
  - Ensure `emitRoomState` invoked after resolution branch
  - Ensure client updates local state on `update in play cards`
- Symptom: odd card labels (`[object Object]`)
  - Check payload format and localization helper call site
- Symptom: phase stuck
  - Inspect awaiting flags:
    - `awaitingConspiracySelection`
    - `awaitingLeftTryalSelections`
    - forced reveal pointers