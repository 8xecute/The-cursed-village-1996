const path = require('path');
const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { createBotClient } = require('../bots/player');
const { getGameCardsForPlayerCount } = require('../shared/cards');
const config = require('./config');
const registerSocketHandlers = require('./socket');
const serviceFactories = [
  require('./game/rooms'),
  require('./game/state'),
  require('./game/cards'),
  require('./game/turns'),
  require('./game/phases'),
  require('./game/confession'),
  require('./game/night'),
  require('./game/conspiracy'),
  require('./game/outcome'),
];

function createGameServer() {
  const app = express();
  app.use(compression());
  const server = http.createServer(app);
  const io = new Server(server, { pingTimeout: 30000, pingInterval: 25000 });
  app.use(express.static(path.resolve(__dirname, '../..', 'public'), {
    maxAge: 0,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.match(/\.(css|js)$/)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.match(/\.(png|jpg|jpeg|gif|svg|mp3|ogg|wav)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        }
    }
}));
  const game = { ...config, app, server, io, PORT: process.env.PORT || 3000, rooms: {}, roomLastActive: {}, botClients: new Map(), uuidv4,
    createBotClient, getGameCardsForPlayerCount };
  for (const createServices of serviceFactories) Object.assign(game, createServices(game));
  registerSocketHandlers(game);
  const roomLastActive = game.roomLastActive;
  const ROOM_EMPTY_TIMEOUT = 5 * 60 * 1000;
  const ROOM_CLEANUP_INTERVAL = 30 * 1000;
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const roomName in game.rooms) {
        const room = game.rooms[roomName];
        const playerCount = Object.values(room.players).filter(player =>
            (!player.isBot && player.connected) || game.io.sockets.sockets.get(player.returnSocketId)?.connected).length;
        if (playerCount === 0) {
            if (!roomLastActive[roomName]) {
                roomLastActive[roomName] = now;
            } else if (now - roomLastActive[roomName] > ROOM_EMPTY_TIMEOUT) {
                game.deleteRoom(roomName);
                console.log(`Room ${roomName} deleted due to inactivity.`);
            }
        } else {
            roomLastActive[roomName] = now;
        }
    }
}, ROOM_CLEANUP_INTERVAL);
  game.close = async () => {
    clearInterval(cleanupTimer);
    for (const roomName of Object.keys(game.rooms)) game.deleteRoom(roomName, { notify: false, broadcast: false });
    await new Promise(resolve => io.close(resolve));
  };
  return game;
}

module.exports = { createGameServer };
