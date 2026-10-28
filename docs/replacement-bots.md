# Replacement bots

During an active game, leaving voluntarily transfers the existing seat to a bot immediately. A disconnected human has 120 seconds to reconnect before transfer. The same player object, UUID, cards, role, and seating order remain intact.

A returning browser with the same player UUID queues a reclaim request. Control transfers after the bot has completed its pending draw, card choice, confession decision, or current played turn. The bot token is revoked before disconnection, and socket middleware rejects gameplay from the previous controller. On return, private cards and pending prompts are restored.

The room log announces takeover and return. The 2D board displays a countdown; 3D labels display waiting/substitute status. A connected human takes hosting duties when the host is substituted. Rooms with no humans connected or queued to return retain the existing five-minute inactivity cleanup, even if bots remain connected.

Clearing browser storage changes the player UUID and prevents automatic reclaim. Restarting the server loses in-memory rooms as before. A substitute bot is a fallback player, not a strategic equivalent of the human.
