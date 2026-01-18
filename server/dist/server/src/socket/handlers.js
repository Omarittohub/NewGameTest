"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const Game_1 = require("../game/Game");
// Singleton for now
const game = new Game_1.Game();
function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('join_game', () => {
            const added = game.addPlayer(socket.id);
            if (added && game['playerIds'].length === 2) {
                game.startGame();
            }
            // Send state to everyone
            broadcastState(io);
        });
        socket.on('play_card', (data) => {
            try {
                game.playCard(socket.id, data.cardId, data.targetZone);
                broadcastState(io);
            }
            catch (e) {
                socket.emit('game_error', e.message);
            }
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            // Handle player leaving? Reset game?
        });
    });
}
function broadcastState(io) {
    // We need to send custom state to each player because of masking
    const sockets = io.sockets.sockets;
    sockets.forEach((s) => {
        const state = game.getState(s.id);
        s.emit('game_state', state);
    });
}
