import { Server, Socket } from 'socket.io';
import { Game } from '../game/Game';

type GameId = string;

interface GameRoom {
    id: GameId;
    game: Game;
}

const rooms = new Map<GameId, GameRoom>();

function generateGameId() {
    // 6-char code, avoids ambiguous chars.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}

function getSocketGameId(socket: Socket): string | undefined {
    return (socket.data as any).gameId;
}

function setSocketGameId(socket: Socket, gameId?: string) {
    (socket.data as any).gameId = gameId;
}

async function broadcastRoomState(io: Server, gameId: string) {
    const room = rooms.get(gameId);
    if (!room) return;

    const sockets = await io.in(gameId).fetchSockets();
    for (const s of sockets) {
        const state = room.game.getState(s.id);
        state.gameId = gameId;
        s.emit('game_state', state);
    }
}

function cleanupRoomIfEmpty(io: Server, gameId: string) {
    const room = rooms.get(gameId);
    if (!room) return;

    const size = io.sockets.adapter.rooms.get(gameId)?.size ?? 0;
    if (size === 0) {
        rooms.delete(gameId);
    }
}

export function setupSocketHandlers(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        socket.on('create_game', async (data?: { playerName?: string; partySize?: number; deckMultiplier?: number; deckOptions?: { enabledColors?: Record<string, boolean>; perColorTypeCounts?: Record<string, number> } }) => {
            // Leave any prior game
            const prevGameId = getSocketGameId(socket);
            if (prevGameId) {
                socket.leave(prevGameId);
                setSocketGameId(socket, undefined);
            }

            // Create unique room
            let gameId = generateGameId();
            while (rooms.has(gameId)) gameId = generateGameId();

            const partySize = Number(data?.partySize ?? 2);
            const deckMultiplier = Number(data?.deckMultiplier ?? 1);
            const deckOptions = data?.deckOptions as any;
            const game = new Game({ maxPlayers: partySize, deckMultiplier, deckOptions });
            rooms.set(gameId, { id: gameId, game });

            // Join creator as player 1
            const playerName = (data?.playerName ?? '').trim();
            const added = game.addPlayer(socket.id, playerName || undefined);
            if (!added) {
                rooms.delete(gameId);
                socket.emit('game_error', 'Failed to create game');
                return;
            }

            socket.join(gameId);
            setSocketGameId(socket, gameId);

            socket.emit('game_created', { gameId });
            socket.emit('joined_game', { gameId });
            await broadcastRoomState(io, gameId);
        });

        socket.on('join_game', async (data: { gameId: string; playerName?: string }) => {
            const gameId = (data?.gameId || '').trim().toUpperCase();
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
            const playerName = (data?.playerName ?? '').trim();
            const added = room.game.addPlayer(socket.id, playerName || undefined);
            if (!added) {
                socket.emit('game_error', 'Game is full');
                return;
            }

            socket.join(gameId);
            setSocketGameId(socket, gameId);
            socket.emit('joined_game', { gameId });

            if (room.game.getPlayerCount() === room.game.getMaxPlayers()) {
                room.game.startGame();
            }

            await broadcastRoomState(io, gameId);
        });

        socket.on('leave_game', async () => {
            const gameId = getSocketGameId(socket);
            if (!gameId) return;

            const room = rooms.get(gameId);
            if (room) {
                room.game.removePlayer(socket.id);
            }

            socket.leave(gameId);
            setSocketGameId(socket, undefined);
            await broadcastRoomState(io, gameId);
            cleanupRoomIfEmpty(io, gameId);
        });

        socket.on('play_card', (data: { cardId: string; targetZone: 'banquet_top' | 'banquet_bottom' | 'self' | 'opponent'; targetPlayerId?: string }) => {
            try {
                const gameId = getSocketGameId(socket);
                if (!gameId) throw new Error('Join a game first');
                const room = rooms.get(gameId);
                if (!room) throw new Error('Game not found');

                room.game.playCard(socket.id, data.cardId, data.targetZone, data.targetPlayerId);
                broadcastRoomState(io, gameId);
            } catch (e: any) {
                socket.emit('game_error', e.message);
            }
        });

        socket.on('resolve_kill', (data: { cardId?: string; hiddenSign?: 'top' | 'bottom' }) => {
            try {
                const gameId = getSocketGameId(socket);
                if (!gameId) throw new Error('Join a game first');
                const room = rooms.get(gameId);
                if (!room) throw new Error('Game not found');

                room.game.resolveKill(socket.id, data);
                broadcastRoomState(io, gameId);
            } catch (e: any) {
                socket.emit('game_error', e.message);
            }
        });

        socket.on('cancel_kill', () => {
            try {
                const gameId = getSocketGameId(socket);
                if (!gameId) throw new Error('Join a game first');
                const room = rooms.get(gameId);
                if (!room) throw new Error('Game not found');

                room.game.cancelKill(socket.id);
                broadcastRoomState(io, gameId);
            } catch (e: any) {
                socket.emit('game_error', e.message);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            const gameId = getSocketGameId(socket);
            if (!gameId) return;
            const room = rooms.get(gameId);
            if (room) {
                room.game.removePlayer(socket.id);
                broadcastRoomState(io, gameId);
            }
            cleanupRoomIfEmpty(io, gameId);
        });
    });
}
