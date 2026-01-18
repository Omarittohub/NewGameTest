"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const Game_1 = require("../game/Game");
const rooms = new Map();
function generateGameId() {
    // 6-char code, avoids ambiguous chars.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}
function getSocketGameId(socket) {
    return socket.data.gameId;
}
function setSocketGameId(socket, gameId) {
    socket.data.gameId = gameId;
}
function broadcastRoomState(io, gameId) {
    return __awaiter(this, void 0, void 0, function* () {
        const room = rooms.get(gameId);
        if (!room)
            return;
        const sockets = yield io.in(gameId).fetchSockets();
        for (const s of sockets) {
            const state = room.game.getState(s.id);
            state.gameId = gameId;
            s.emit('game_state', state);
        }
    });
}
function cleanupRoomIfEmpty(io, gameId) {
    var _a, _b;
    const room = rooms.get(gameId);
    if (!room)
        return;
    const size = (_b = (_a = io.sockets.adapter.rooms.get(gameId)) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0;
    if (size === 0) {
        rooms.delete(gameId);
    }
}
function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('create_game', () => __awaiter(this, void 0, void 0, function* () {
            // Leave any prior game
            const prevGameId = getSocketGameId(socket);
            if (prevGameId) {
                socket.leave(prevGameId);
                setSocketGameId(socket, undefined);
            }
            // Create unique room
            let gameId = generateGameId();
            while (rooms.has(gameId))
                gameId = generateGameId();
            const game = new Game_1.Game();
            rooms.set(gameId, { id: gameId, game });
            // Join creator as player 1
            const added = game.addPlayer(socket.id);
            if (!added) {
                rooms.delete(gameId);
                socket.emit('game_error', 'Failed to create game');
                return;
            }
            socket.join(gameId);
            setSocketGameId(socket, gameId);
            socket.emit('game_created', { gameId });
            socket.emit('joined_game', { gameId });
            yield broadcastRoomState(io, gameId);
        }));
        socket.on('join_game', (data) => __awaiter(this, void 0, void 0, function* () {
            const gameId = ((data === null || data === void 0 ? void 0 : data.gameId) || '').trim().toUpperCase();
            if (!gameId) {
                socket.emit('game_error', 'Game code is required');
                return;
            }
            const room = rooms.get(gameId);
            if (!room) {
                socket.emit('game_error', 'Game not found');
                return;
            }
            // Leave any prior game
            const prevGameId = getSocketGameId(socket);
            if (prevGameId && prevGameId !== gameId) {
                socket.leave(prevGameId);
                setSocketGameId(socket, undefined);
                cleanupRoomIfEmpty(io, prevGameId);
            }
            console.log('Player joining:', socket.id, '->', gameId);
            const added = room.game.addPlayer(socket.id);
            if (!added) {
                socket.emit('game_error', 'Game is full');
                return;
            }
            socket.join(gameId);
            setSocketGameId(socket, gameId);
            socket.emit('joined_game', { gameId });
            if (room.game.getPlayerCount() === 2) {
                room.game.startGame();
            }
            yield broadcastRoomState(io, gameId);
        }));
        socket.on('leave_game', () => __awaiter(this, void 0, void 0, function* () {
            const gameId = getSocketGameId(socket);
            if (!gameId)
                return;
            const room = rooms.get(gameId);
            if (room) {
                room.game.removePlayer(socket.id);
            }
            socket.leave(gameId);
            setSocketGameId(socket, undefined);
            yield broadcastRoomState(io, gameId);
            cleanupRoomIfEmpty(io, gameId);
        }));
        socket.on('play_card', (data) => {
            try {
                const gameId = getSocketGameId(socket);
                if (!gameId)
                    throw new Error('Join a game first');
                const room = rooms.get(gameId);
                if (!room)
                    throw new Error('Game not found');
                room.game.playCard(socket.id, data.cardId, data.targetZone);
                broadcastRoomState(io, gameId);
            }
            catch (e) {
                socket.emit('game_error', e.message);
            }
        });
        socket.on('resolve_kill', (data) => {
            try {
                const gameId = getSocketGameId(socket);
                if (!gameId)
                    throw new Error('Join a game first');
                const room = rooms.get(gameId);
                if (!room)
                    throw new Error('Game not found');
                room.game.resolveKill(socket.id, data);
                broadcastRoomState(io, gameId);
            }
            catch (e) {
                socket.emit('game_error', e.message);
            }
        });
        socket.on('cancel_kill', () => {
            try {
                const gameId = getSocketGameId(socket);
                if (!gameId)
                    throw new Error('Join a game first');
                const room = rooms.get(gameId);
                if (!room)
                    throw new Error('Game not found');
                room.game.cancelKill(socket.id);
                broadcastRoomState(io, gameId);
            }
            catch (e) {
                socket.emit('game_error', e.message);
            }
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            const gameId = getSocketGameId(socket);
            if (!gameId)
                return;
            const room = rooms.get(gameId);
            if (room) {
                room.game.removePlayer(socket.id);
                broadcastRoomState(io, gameId);
            }
            cleanupRoomIfEmpty(io, gameId);
        });
    });
}
