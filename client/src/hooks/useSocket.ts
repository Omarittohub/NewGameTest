import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, PlayZone } from '@shared/types';

// Hardcoded for now, or env
const URL = import.meta.env.PROD ? '/' : 'http://localhost:8080';

export const socket: Socket = io(URL, {
    autoConnect: false
});

export function useSocket() {
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [error, setError] = useState('');
    const [hasJoined, setHasJoined] = useState(false);
    const [gameId, setGameId] = useState<string | null>(null);

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
        }

        function onDisconnect() {
            setIsConnected(false);
            setHasJoined(false);
            setGameId(null);
        }

        function onGameState(state: GameState) {
            setGameState(state);

            if (state.gameId) {
                setGameId(state.gameId);
            }

            // Consider ourselves "joined" once the server includes us in the players map.
            // This is robust across reconnects where socket.id may change.
            const id = socket.id;
            if (id && state.players && state.players[id]) {
                setHasJoined(true);
            }
        }

        function onGameCreated(data: { gameId: string }) {
            setGameId(data.gameId);
        }

        function onJoinedGame(data: { gameId: string }) {
            setGameId(data.gameId);
        }

        function onError(msg: string) {
            setError(msg);
            // Clear after 3s
            setTimeout(() => setError(''), 3000);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('game_state', onGameState);
        socket.on('game_error', onError);
        socket.on('game_created', onGameCreated);
        socket.on('joined_game', onJoinedGame);

        socket.connect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('game_state', onGameState);
            socket.off('game_error', onError);
            socket.off('game_created', onGameCreated);
            socket.off('joined_game', onJoinedGame);
            socket.disconnect();
        };
    }, []);

    const createGame = (options?: { playerName?: string; partySize?: number; deckMultiplier?: number; deckOptions?: { enabledColors?: Record<string, boolean>; perColorTypeCounts?: Record<string, number> } }) => {
        socket.emit('create_game', options);
    };

    const joinGame = (joinGameId: string, options?: { playerName?: string }) => {
        socket.emit('join_game', { gameId: joinGameId, ...options });
    };

    const leaveGame = () => {
        socket.emit('leave_game');
        setHasJoined(false);
        setGameId(null);
        setGameState(null);
    };

    const playCard = (cardId: string, targetZone: PlayZone, targetPlayerId?: string) => {
        socket.emit('play_card', { cardId, targetZone, targetPlayerId });
    };

    const resolveKill = (data: { cardId?: string; hiddenSign?: 'top' | 'bottom' }) => {
        socket.emit('resolve_kill', data);
    };

    const cancelKill = () => {
        socket.emit('cancel_kill');
    };

    return { isConnected, gameState, error, createGame, joinGame, leaveGame, playCard, resolveKill, cancelKill, socketId: socket.id, hasJoined, gameId };
}
