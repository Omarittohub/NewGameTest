import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { Board } from './components/Board';

function App() {
  const { isConnected, gameState, error, createGame, joinGame, leaveGame, playCard, resolveKill, cancelKill, socketId, hasJoined, gameId } = useSocket();
  const [joinCode, setJoinCode] = useState('');

  const isMyTurn = Boolean(gameState && socketId && gameState.turn === socketId);
  const pendingKill = gameState?.pendingAction?.type === 'kill' ? gameState.pendingAction : undefined;
  const isKillDecisionMine = Boolean(pendingKill && socketId && pendingKill.affectedPlayerId === socketId);
  const canPlayZone = useMemo(() => {
    return {
      banquet_top: isMyTurn && !gameState?.turnPlays?.banquet,
      banquet_bottom: isMyTurn && !gameState?.turnPlays?.banquet,
      self: isMyTurn && !gameState?.turnPlays?.self,
      opponent: isMyTurn && !gameState?.turnPlays?.opponent,
    };
  }, [isMyTurn, gameState?.turnPlays?.banquet, gameState?.turnPlays?.self, gameState?.turnPlays?.opponent]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.data.current) {
      // Zone IDs: 'banquet_top', 'banquet_bottom', 'self', 'opponent'
      const targetZone = over.id as 'banquet_top' | 'banquet_bottom' | 'self' | 'opponent';
      const cardId = active.id as string;

      // Client-side guardrails (server still validates).
      if (!(canPlayZone as any)[targetZone]) return;

      console.log(`Dragging ${cardId} to ${targetZone}`);
      playCard(cardId, targetZone);
    }
  };

  if (!isConnected) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-4xl font-bold text-yellow-500">Courtisans</h1>
        <div className="text-white/70 text-sm">Connecting...</div>
      </div>
    );
  }

  if (!socketId) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-4xl font-bold text-yellow-500">Courtisans</h1>
        <div className="text-white/70 text-sm">Establishing session...</div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-4xl font-bold text-yellow-500">Courtisans</h1>

        {error && (
          <div className="bg-red-500/90 text-white px-4 py-2 rounded shadow-lg">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={createGame}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg shadow-lg transition-all"
          >
            Create Game
          </button>

          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g. A1B2C3)"
              className="flex-1 px-3 py-3 rounded bg-black/40 border border-white/20 text-white outline-none"
              maxLength={6}
            />
            <button
              onClick={() => joinGame(joinCode)}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded font-bold"
            >
              Join
            </button>
          </div>
        </div>

        <div className="text-white/60 text-xs">
          Tip: open a second browser window to join.
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-3xl font-bold text-yellow-500">Courtisans</h1>
        <div className="text-white/70">Waiting for opponent...</div>
        {gameId && (
          <div className="bg-black/40 border border-white/20 rounded px-4 py-2">
            Game Code: <span className="font-bold tracking-widest">{gameId}</span>
          </div>
        )}
        <button
          onClick={leaveGame}
          className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded border border-white/20"
        >
          Leave
        </button>
      </div>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="h-screen w-screen bg-gray-900 text-white font-sans">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
            {error}
          </div>
        )}

        {/* Game code + leave */}
        <div className="absolute top-4 left-4 z-50 bg-black/50 px-4 py-2 rounded border border-white/20 flex items-center gap-3">
          {gameId && (
            <span className="text-white/80 text-sm">
              Code: <span className="font-bold tracking-widest text-white">{gameId}</span>
            </span>
          )}
          {typeof gameState.deckRemaining === 'number' && (
            <span className="text-white/70 text-sm">
              Deck: <span className="font-semibold text-white">{gameState.deckRemaining}</span>
            </span>
          )}
          <button
            onClick={leaveGame}
            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20"
          >
            Leave
          </button>
        </div>

        {/* Turn Indicator */}
        <div className="absolute top-4 right-4 z-50 bg-black/50 px-4 py-2 rounded border border-white/20">
          {isMyTurn ? (
            <span className="text-green-400 font-bold">YOUR TURN</span>
          ) : (
            <span className="text-gray-400">Opponent's Turn</span>
          )}
        </div>

        {pendingKill && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/60 px-4 py-2 rounded border border-white/15 text-sm">
            {isKillDecisionMine ? (
              <div className="flex items-center gap-3">
                <span className="text-white/90">Killer optional: pick a target or cancel</span>
                <button
                  onClick={() => cancelKill()}
                  className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20"
                >
                  Cancel Kill
                </button>
              </div>
            ) : (
              <span className="text-white/70">Waiting for kill selection...</span>
            )}
          </div>
        )}

        <Board
          gameState={gameState}
          playerId={socketId}
          pendingKill={pendingKill}
          onResolveKill={(data) => resolveKill(data)}
        />
      </div>
    </DndContext>
  );
}

export default App;
