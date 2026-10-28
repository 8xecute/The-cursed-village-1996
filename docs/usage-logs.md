# Usage logs in Render

The server writes one JSON record per usage event to stdout. Deploy these changes,
then open the service's **Logs → Application logs**. Search for `"category":"usage"`
or an event name, player name, player ID, or room name.

## Events

- `server_started`: confirms the usage logger is enabled after startup, with deployment commit when available.

- `connection_opened`: connection ID, transport, coarse device category.
- `player_registered`: persistent browser player ID associated with this connection.
- `player_name_set`: accepted name before joining a room.
- `player_name_changed`: accepted lobby rename, previous name and new name.
- `room_created`: host, name, room.
- `room_joined`: successful joins and reconnects, player/spectator role, bot flag.
- `room_leave_requested`: user requested to leave (not a confirmed departure).
- `connection_closed`: reason and connection duration, not total player lifetime.
- `game_started`: round ID, room, player/human counts and host.
- `game_finished`: round ID, winner, days and game duration.

Each event includes UTC `timestamp`, `schemaVersion`, and a unique `eventId`.
`playerId` links activity across connections on the same browser; clearing browser
storage creates a new identity. `connectionId` identifies one socket connection.
`roundId` identifies one started game, including rematches. Deduplicate exported
records by `eventId`. Reconnects are new connections and room-join events, not new people.

Names are user-provided, not verified identities. Text fields are bounded to 180
characters and control characters removed for log safety. The usage logger does
not capture chat messages, IP addresses, tokens, or full request headers.

These records are application logs, not a permanent analytics database. Render
retention depends on the workspace plan. For long-term tracking, configure a
Render log stream or export records before retention expires:
https://render.com/docs/logging
https://render.com/docs/log-streams

Logs begin after deployment; earlier visits cannot be reconstructed by this feature.
