import {
  DndContext,
  type DragEndEvent,
  type CollisionDetection,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import type { CardColor, CardType } from '@shared/types';
import { useSocket } from './hooks/useSocket';
import { Board } from './components/Board';

type DropZone = 'banquet_top' | 'banquet_bottom' | 'self' | 'opponent';

const DEFAULT_ENABLED_COLORS: Record<CardColor, boolean> = { DG: true, G: true, R: true, Y: true, B: true, W: true };
const DEFAULT_PER_COLOR_TYPE_COUNTS: Record<CardType, number> = { N: 4, X2: 2, S: 2, K: 2, T: 2 };

const COLOR_FULL_NAME: Record<CardColor, string> = {
  DG: 'Dark Green',
  G: 'Green',
  R: 'Red',
  Y: 'Yellow',
  B: 'Blue',
  W: 'White',
};

const TYPE_FULL_NAME: Record<CardType, string> = {
  N: 'Normal',
  X2: '×2',
  S: 'Shield',
  K: 'Killer',
  T: 'Spy',
};

function App() {
  const { isConnected, gameState, error, createGame, joinGame, leaveGame, playCard, resolveKill, cancelKill, socketId, hasJoined, gameId } = useSocket();
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [deckMultiplier, setDeckMultiplier] = useState(1);
  const [advancedDeck, setAdvancedDeck] = useState(false);
  const [enabledColors, setEnabledColors] = useState<Record<CardColor, boolean>>(DEFAULT_ENABLED_COLORS);
  const [perColorTypeCounts, setPerColorTypeCounts] = useState<Record<CardType, number>>(DEFAULT_PER_COLOR_TYPE_COUNTS);

  const isMyTurn = Boolean(gameState && socketId && gameState.turn === socketId);
  const pendingKill = gameState?.pendingAction?.type === 'kill' ? gameState.pendingAction : undefined;
  const isKillDecisionMine = Boolean(pendingKill && socketId && pendingKill.affectedPlayerId === socketId);
  const canPlayZone = useMemo<Record<DropZone, boolean>>(() => {
    return {
      banquet_top: isMyTurn && !gameState?.turnPlays?.banquet,
      banquet_bottom: isMyTurn && !gameState?.turnPlays?.banquet,
      self: isMyTurn && !gameState?.turnPlays?.self,
      opponent: isMyTurn && !gameState?.turnPlays?.opponent,
    };
  }, [isMyTurn, gameState?.turnPlays?.banquet, gameState?.turnPlays?.self, gameState?.turnPlays?.opponent]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const collisionDetection: CollisionDetection = (args) => {
    // Prefer pointer-based detection for transformed/rotated layouts; fall back to rect intersection.
    const pointer = pointerWithin(args);
    return pointer.length > 0 ? pointer : rectIntersection(args);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.data.current) {
      const overId = String(over.id);
      let targetZone: DropZone | null = null;
      let targetPlayerId: string | undefined;

      if (overId.startsWith('opponent:')) {
        targetZone = 'opponent';
        targetPlayerId = overId.slice('opponent:'.length);
      } else if (overId === 'banquet_top' || overId === 'banquet_bottom' || overId === 'self' || overId === 'opponent') {
        targetZone = overId as DropZone;
      }

      if (!targetZone) return;
      const cardId = active.id as string;

      // Client-side guardrails (server still validates).
      if (!canPlayZone[targetZone]) return;

      console.log(`Dragging ${cardId} to ${targetZone}${targetPlayerId ? `:${targetPlayerId}` : ''}`);
      playCard(cardId, targetZone, targetPlayerId);
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
    const baseDeckSize = 6 * (4 + 2 + 2 + 2 + 2); // 6 colors * sum(DISTRIBUTION)
    const enabledColorCount = Object.values(enabledColors).filter(Boolean).length;
    const perColorSum = perColorTypeCounts.N + perColorTypeCounts.X2 + perColorTypeCounts.S + perColorTypeCounts.K + perColorTypeCounts.T;
    const deckSize = advancedDeck ? (enabledColorCount * perColorSum) : (baseDeckSize * deckMultiplier);

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-4xl font-bold text-yellow-500">Courtisans</h1>

        {error && (
          <div className="bg-red-500/90 text-white px-4 py-2 rounded shadow-lg">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="bg-black/30 border border-white/15 rounded-lg p-3">
            <div className="text-xs uppercase tracking-[0.18em] text-white/70">Player name</div>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              className="mt-2 w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-white outline-none"
              maxLength={20}
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.18em] text-white/70">Party size</div>
              <div className="text-xs text-white/80">
                {partySize} players
              </div>
            </div>
            <input
              type="range"
              min={2}
              max={4}
              step={1}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              className="mt-2 w-full"
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.18em] text-white/70">Deck size</div>
              <div className="text-xs text-white/80">
                {advancedDeck ? (
                  <>advanced <span className="text-white/50">({deckSize} cards)</span></>
                ) : (
                  <>×{deckMultiplier} <span className="text-white/50">({deckSize} cards)</span></>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <label className="text-xs text-white/70 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={advancedDeck}
                  onChange={(e) => setAdvancedDeck(e.target.checked)}
                />
                Advanced deck options
              </label>
              <button
                type="button"
                onClick={() => {
                  setEnabledColors(DEFAULT_ENABLED_COLORS);
                  setPerColorTypeCounts(DEFAULT_PER_COLOR_TYPE_COUNTS);
                }}
                className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20"
              >
                Reset
              </button>
            </div>

            {!advancedDeck ? (
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={deckMultiplier}
                onChange={(e) => setDeckMultiplier(Number(e.target.value))}
                className="mt-2 w-full"
              />
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/70">Enabled families</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(['DG', 'G', 'R', 'Y', 'B', 'W'] as const).map((c) => (
                      <label key={c} className="text-xs text-white/80 flex items-center gap-2 bg-black/25 ring-1 ring-white/10 rounded px-2 py-2">
                        <input
                          type="checkbox"
                          checked={enabledColors[c]}
                          onChange={(e) => setEnabledColors((prev) => ({ ...prev, [c]: e.target.checked }))}
                        />
                        {COLOR_FULL_NAME[c]}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/70">Per-family counts</div>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {(['N', 'X2', 'S', 'K', 'T'] as const).map((t) => (
                      <div key={t} className="bg-black/25 ring-1 ring-white/10 rounded px-2 py-2">
                        <div className="text-[11px] text-white/70">{TYPE_FULL_NAME[t]}</div>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={perColorTypeCounts[t]}
                          onChange={(e) => setPerColorTypeCounts((prev) => ({ ...prev, [t]: Number(e.target.value) }))}
                          className="mt-1 w-full px-2 py-1 rounded bg-black/40 border border-white/15 text-white outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-white/55">
                    Counts are applied per enabled family (color).
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => createGame({
              playerName,
              partySize,
              deckMultiplier,
              deckOptions: advancedDeck ? { enabledColors, perColorTypeCounts } : undefined,
            })}
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
              onClick={() => joinGame(joinCode, { playerName })}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 rounded font-bold"
            >
              Join
            </button>
          </div>
        </div>

      </div>
    );
  }

  if (!gameState || !gameState.started) {
    const players = gameState?.players ? Object.values(gameState.players) : [];
    const maxPlayers = gameState?.maxPlayers ?? 2;
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white flex-col gap-4">
        <h1 className="text-3xl font-bold text-yellow-500">Courtisans</h1>
        <div className="text-white/70">Waiting for players...</div>
        {gameId && (
          <div className="bg-black/40 border border-white/20 rounded px-4 py-2">
            Game Code: <span className="font-bold tracking-widest">{gameId}</span>
          </div>
        )}

        <div className="bg-black/30 border border-white/15 rounded-lg px-4 py-3 min-w-[320px]">
          <div className="text-xs uppercase tracking-[0.18em] text-white/70">Lobby</div>
          <div className="mt-2 text-white/80 text-sm">
            Players: <span className="font-semibold text-white">{players.length}</span> / <span className="font-semibold text-white">{maxPlayers}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {players.length === 0 && <div className="text-xs text-white/50">No players yet</div>}
            {players.map((p) => (
              <div key={p.id} className="text-sm text-white/85 bg-black/25 ring-1 ring-white/10 rounded px-2 py-1">
                {(p.name ?? '').trim() || 'Player'}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-white/50">
            Game starts automatically when the party is full.
          </div>
        </div>

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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen w-screen bg-gray-900 text-white font-sans">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
            {error}
          </div>
        )}

        {/* Game code + deck + leave (kept, but placed under Board HUD) */}
        <div className="fixed top-16 left-4 z-40 bg-black/50 px-4 py-2 rounded border border-white/20 flex items-center gap-3">
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
