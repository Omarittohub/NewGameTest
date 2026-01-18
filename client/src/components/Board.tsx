import React, { useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { GameState, Card as CardType } from '@shared/types';
import { Card } from './Card';

const COLOR_HEX: Record<string, string> = {
    DG: '#0b5d3b',
    G: '#1f9d55',
    R: '#b91c1c',
    Y: '#f59e0b',
    B: '#1d4ed8',
    W: '#e5e7eb',
};

// Zone Component
interface ZoneProps {
    id: string;
    title?: string;
    cards: CardType[];
    className?: string;
    killableCardIds?: Set<string>;
    killEnabled?: boolean;
    onKill?: (cardId: string) => void;
}

const Zone: React.FC<ZoneProps> = ({ id, title, cards, className, killableCardIds, killEnabled, onKill }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`
        min-h-[160px] p-3 rounded-xl flex flex-wrap gap-2 justify-center items-center transition-colors
        ${isOver ? 'bg-emerald-500/15 ring-2 ring-emerald-400/60' : 'bg-black/35 ring-1 ring-white/10'}
        ${className}
      `}
        >
            {title && (
                <h3 className="w-full text-center text-white/90 font-semibold mb-2 uppercase text-[11px] tracking-[0.18em]">
                    {title}
                </h3>
            )}
            {cards.map(card => (
                <button
                    key={card.id}
                    type="button"
                    disabled={!(killEnabled && killableCardIds?.has(card.id))}
                    onClick={() => {
                        if (killEnabled && killableCardIds?.has(card.id)) onKill?.(card.id);
                    }}
                    className={
                        killEnabled && killableCardIds?.has(card.id)
                            ? 'relative rounded-xl ring-2 ring-white/80 shadow-[0_0_0.8rem_rgba(255,255,255,0.35)]'
                            : 'relative'
                    }
                >
                    <Card card={card} />
                </button>
            ))}
        </div>
    );
};

interface BoardProps {
    gameState: GameState;
    playerId: string;
    pendingKill?: GameState['pendingAction'];
    onResolveKill?: (data: { cardId?: string; hiddenSign?: 'top' | 'bottom' }) => void;
}

export const Board: React.FC<BoardProps> = ({ gameState, playerId, pendingKill, onResolveKill }) => {
    const myPlayer = gameState.players[playerId];
    const isMyTurn = gameState.turn === playerId;
    // Opponent is the other key
    const opponentId = Object.keys(gameState.players).find(id => id !== playerId);
    const opponent = opponentId ? gameState.players[opponentId] : null;

    const turnPlays = gameState.turnPlays;
    const banquet = gameState.banquet;
    const scores = gameState.scores;

    const myScore = scores?.[playerId];
    const oppScore = opponentId ? scores?.[opponentId] : undefined;

    const isKillDecisionMine = Boolean(pendingKill && pendingKill.type === 'kill' && pendingKill.affectedPlayerId === playerId);
    const killableSet = useMemo(() => new Set(pendingKill?.candidateCardIds ?? []), [pendingKill]);

    const killTargetsMe = Boolean(isKillDecisionMine && pendingKill?.area === 'self_domain');
    const killTargetsOpponent = Boolean(isKillDecisionMine && pendingKill?.area === 'opponent_domain');

    const hoveredCloseTimer = useRef<number | null>(null);
    const [hoverColor, setHoverColor] = useState<keyof NonNullable<GameState['banquet']>['byColor'] | null>(null);
    const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

    const scheduleHoverClose = () => {
        if (hoveredCloseTimer.current) window.clearTimeout(hoveredCloseTimer.current);
        hoveredCloseTimer.current = window.setTimeout(() => {
            setHoverColor(null);
            setHoverRect(null);
        }, 250);
    };
    const cancelHoverClose = () => {
        if (hoveredCloseTimer.current) window.clearTimeout(hoveredCloseTimer.current);
        hoveredCloseTimer.current = null;
    };

    const contribution = (c: CardType) => (c.type === 'X2' ? 2 : 1);

    const BanquetZone: React.FC<{ id: 'banquet_top' | 'banquet_bottom'; title: string; hint: string; }> = ({ id, title, hint }) => {
        const { setNodeRef, isOver } = useDroppable({ id });
        return (
            <div
                ref={setNodeRef}
                className={`p-3 rounded-xl text-center transition-all bg-black/35 ring-1 ring-white/10 ${isOver ? 'ring-2 ring-emerald-400/70 bg-emerald-500/10' : ''}`}
            >
                <div className="text-white/90 font-semibold text-xs tracking-[0.18em] uppercase">{title}</div>
                <div className="text-white/60 text-xs mt-1">{hint}</div>
            </div>
        );
    };

    const ScorePanel: React.FC<{ label: string; score?: typeof myScore; }> = ({ label, score }) => {
        if (!score) return null;
        const colors: Array<keyof typeof score.byColor> = ['DG', 'G', 'R', 'Y', 'B', 'W'];
        return (
            <div className="bg-black/35 ring-1 ring-white/10 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/80">{label}</div>
                    <div className="text-white font-bold">{score.total}</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                    {colors.map((c) => (
                        <div key={c} className="flex items-center justify-between bg-black/25 rounded-lg px-2 py-1 ring-1 ring-white/10">
                            <span className="text-xs font-semibold" style={{ color: COLOR_HEX[c] }}>{c}</span>
                            <span className="text-xs text-white/90">{score.byColor[c]}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 text-[11px] text-white/60">
                    Deck counts: {colors.map(c => `${c}:${score.deckCounts[c]}`).join(' · ')}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-auto">
            {/* Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-70"
                    style={{ backgroundImage: "url('/assets/maintapis.jpeg')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/70" />
                <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.9)_1px,transparent_0)] [background-size:22px_22px]" />
            </div>

            {/* Opponent Area */}
            <div className="relative z-10 w-full max-w-6xl flex flex-col gap-3">
                {/* Opponent Hand (Visible as backs) */}
                <div className="flex justify-center gap-2 min-h-[108px]">
                    {opponent?.hand.map(c => <Card key={c.id} card={c} />)}
                </div>

                {/* Opponent Domain */}
                <Zone
                    id="opponent"
                    title="Opponent Domain"
                    cards={opponent?.domain || []}
                    killEnabled={Boolean(killTargetsOpponent)}
                    killableCardIds={killTargetsOpponent ? killableSet : undefined}
                    onKill={(cardId) => onResolveKill?.({ cardId })}
                />
            </div>

            {/* Middle Area: Queen Zone */}
            <div className="relative z-10 w-full max-w-6xl my-4">
                {turnPlays && (
                    <div className="mb-2 flex justify-center gap-3 text-xs text-white/85">
                        <span className={turnPlays.banquet ? 'text-emerald-300' : 'text-white/60'}>Banquet</span>
                        <span className={turnPlays.self ? 'text-emerald-300' : 'text-white/60'}>Self</span>
                        <span className={turnPlays.opponent ? 'text-emerald-300' : 'text-white/60'}>Opponent</span>
                        <span className="text-white/50">{isMyTurn ? '(your 3 plays)' : "(opponent's 3 plays)"}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-1 flex flex-col gap-3">
                        <ScorePanel label="You" score={myScore} />
                        <ScorePanel label="Opponent" score={oppScore} />
                    </div>

                    <div className="lg:col-span-2 bg-black/30 ring-1 ring-white/10 rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="text-white font-bold text-lg">The Banquet</div>
                                <div className="text-white/60 text-sm">Drop a card into +1 (top) or −1 (under)</div>
                            </div>
                            {banquet && (
                                <div className="text-xs text-white/70 bg-black/25 ring-1 ring-white/10 rounded-lg px-3 py-2">
                                    Hidden cards: <span className="text-white font-semibold">+{banquet.hiddenTopCount}</span> / <span className="text-white font-semibold">−{banquet.hiddenBottomCount}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <BanquetZone id="banquet_top" title="+1 (Top)" hint="Counts as +1" />
                            <BanquetZone id="banquet_bottom" title="−1 (Under)" hint="Counts as −1" />
                        </div>

                        {banquet && (
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {(Object.keys(banquet.byColor) as Array<keyof typeof banquet.byColor>).map((color) => {
                                    const summary = banquet.byColor[color];
                                    const value = gameState.revealHidden ? summary.valueRevealed : summary.valueVisible;
                                    const bubbleClass = value >= 0 ? 'bg-emerald-500/20 ring-emerald-400/60 text-emerald-200' : 'bg-red-500/20 ring-red-400/60 text-red-200';
                                    const exemplar = { id: `ex-${color}`, color: color as any, type: 'N' as any, ownerId: '', image: `${color}N.png`, isHidden: false };

                                    return (
                                        <div
                                            key={color}
                                            className="relative bg-black/25 ring-1 ring-white/10 hover:ring-2 hover:ring-white/30 rounded-xl p-2 flex flex-col items-center transition"
                                            onMouseEnter={(e) => {
                                                cancelHoverClose();
                                                setHoverColor(color);
                                                setHoverRect(e.currentTarget.getBoundingClientRect());
                                            }}
                                            onMouseLeave={() => scheduleHoverClose()}
                                        >
                                            <Card card={exemplar as any} draggable={false} />
                                            <div className={`mt-2 px-2 py-1 rounded-full text-xs font-bold ring-1 ${bubbleClass}`}
                                                style={{ borderColor: COLOR_HEX[color] }}>
                                                {value >= 0 ? `+${value}` : `${value}`}
                                            </div>
                                            <div className="mt-1 text-[11px] text-white/60">
                                                +{summary.topVisible} / −{summary.bottomVisible}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Player Area */}
            <div className="relative z-10 w-full max-w-6xl flex flex-col gap-3">
                {/* My Domain */}
                <Zone
                    id="self"
                    title="My Domain"
                    cards={myPlayer?.domain || []}
                    killEnabled={Boolean(killTargetsMe)}
                    killableCardIds={killTargetsMe ? killableSet : undefined}
                    onKill={(cardId) => onResolveKill?.({ cardId })}
                />

                {/* My Hand */}
                <div className="flex justify-center flex-wrap gap-2 mt-4 p-4 bg-black/45 rounded-2xl ring-1 ring-white/10 min-h-[170px]">
                    {myPlayer?.hand.map(c => (
                        <Card key={c.id} card={c} draggable={isMyTurn} />
                    ))}
                </div>
            </div>

            {/* Fixed high-priority hover panel (rendered at Board root to avoid z-index stacking issues) */}
            {banquet && hoverColor && hoverRect && (
                (() => {
                    const details = gameState.banquetDetails?.byColor?.[hoverColor];
                    const top = details?.top ?? [];
                    const bottom = details?.bottom ?? [];

                    const hiddenTop = gameState.banquetDetails?.hiddenTopCount ?? banquet.hiddenTopCount;
                    const hiddenBottom = gameState.banquetDetails?.hiddenBottomCount ?? banquet.hiddenBottomCount;

                    const width = 320;
                    const padding = 12;
                    const maxLeft = (typeof window !== 'undefined')
                        ? Math.max(padding, window.innerWidth - width - padding)
                        : hoverRect.left;
                    const left = Math.min(Math.max(hoverRect.left, padding), maxLeft);
                    const topPos = hoverRect.bottom + 10;

                    // When a killer is placed on the banquet, ANY non-shield card in the banquet is killable.
                    const canPickFromBanquet = isKillDecisionMine && pendingKill?.area === 'banquet';
                    const canKillHiddenTop = canPickFromBanquet && (pendingKill?.hiddenTopCount ?? 0) > 0;
                    const canKillHiddenBottom = canPickFromBanquet && (pendingKill?.hiddenBottomCount ?? 0) > 0;

                    return (
                        <div
                            className="fixed z-[2147483647] rounded-xl bg-black/92 ring-1 ring-white/25 p-3 shadow-2xl"
                            style={{ left, top: topPos, width }}
                            onMouseEnter={() => cancelHoverClose()}
                            onMouseLeave={() => scheduleHoverClose()}
                        >
                            <div className="text-sm font-semibold" style={{ color: COLOR_HEX[String(hoverColor)] || '#fff' }}>
                                {hoverColor} breakdown
                            </div>

                            <div className="mt-2 text-xs text-white/70">Positive (Top):</div>
                            <div className="mt-1 flex flex-col gap-1">
                                {top.length === 0 && <div className="text-xs text-white/50">None</div>}
                                {top.map(c => {
                                    const isKillable = canPickFromBanquet && killableSet.has(c.id) && c.type !== 'S';
                                    const val = contribution(c);
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            disabled={!isKillable}
                                            onClick={() => isKillable && onResolveKill?.({ cardId: c.id })}
                                            className={`text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg ring-1 ${isKillable ? 'ring-white/30 hover:ring-white/70 bg-white/5' : 'ring-white/10 bg-white/0'}`}
                                        >
                                            <span className="text-xs text-white/90">{c.image.replace('.png', '')}</span>
                                            <span className="text-xs text-emerald-200">+{val}</span>
                                        </button>
                                    );
                                })}
                                {canKillHiddenTop && (
                                    <button
                                        type="button"
                                        onClick={() => onResolveKill?.({ hiddenSign: 'top' })}
                                        className="text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg ring-1 ring-white/30 hover:ring-white/70 bg-white/5"
                                    >
                                        <span className="text-xs text-white/90">Hidden card (position: +)</span>
                                        <span className="text-xs text-white/70">destroy</span>
                                    </button>
                                )}
                            </div>

                            <div className="mt-2 text-xs text-white/70">Negative (Under):</div>
                            <div className="mt-1 flex flex-col gap-1">
                                {bottom.length === 0 && <div className="text-xs text-white/50">None</div>}
                                {bottom.map(c => {
                                    const isKillable = canPickFromBanquet && killableSet.has(c.id) && c.type !== 'S';
                                    const val = contribution(c);
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            disabled={!isKillable}
                                            onClick={() => isKillable && onResolveKill?.({ cardId: c.id })}
                                            className={`text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg ring-1 ${isKillable ? 'ring-white/30 hover:ring-white/70 bg-white/5' : 'ring-white/10 bg-white/0'}`}
                                        >
                                            <span className="text-xs text-white/90">{c.image.replace('.png', '')}</span>
                                            <span className="text-xs text-red-200">−{val}</span>
                                        </button>
                                    );
                                })}
                                {canKillHiddenBottom && (
                                    <button
                                        type="button"
                                        onClick={() => onResolveKill?.({ hiddenSign: 'bottom' })}
                                        className="text-left flex items-center justify-between gap-2 px-2 py-1 rounded-lg ring-1 ring-white/30 hover:ring-white/70 bg-white/5"
                                    >
                                        <span className="text-xs text-white/90">Hidden card (position: −)</span>
                                        <span className="text-xs text-white/70">destroy</span>
                                    </button>
                                )}
                            </div>

                            <div className="mt-2 text-[11px] text-white/60">
                                Hidden cards reveal only position counts: +{hiddenTop} / −{hiddenBottom}
                            </div>
                        </div>
                    );
                })()
            )}
        </div>
    );
};
