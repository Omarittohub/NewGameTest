import React, { useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { GameState, Card as CardType, CardColor, CardType as CardTypeCode, HistoryItem } from '@shared/types';
import { Card } from './Card';

const COLOR_HEX: Record<string, string> = {
    DG: '#0b5d3b',
    G: '#1f9d55',
    R: '#b91c1c',
    Y: '#f59e0b',
    B: '#1d4ed8',
    W: '#e5e7eb',
};

const COLOR_FULL_NAME: Record<CardColor, string> = {
    DG: 'Dark Green',
    G: 'Green',
    R: 'Red',
    Y: 'Yellow',
    B: 'Blue',
    W: 'White',
};

const TYPE_FULL_NAME: Record<string, string> = {
    N: 'Normal',
    X2: '×2',
    S: 'Shield',
    K: 'Killer',
    T: 'Spy',
};

const destinationLabel = (d?: HistoryItem['destination'], targetName?: string) => {
    switch (d) {
        case 'banquet_grace':
            return 'Grace (+1) on the Banquet';
        case 'banquet_disgrace':
            return 'Disgrace (−1) on the Banquet';
        case 'opponent_domain':
            return targetName ? `${targetName}'s domain` : "opponent's domain";
        case 'my_domain':
            return 'their domain';
        default:
            return undefined;
    }
};

const TypePill: React.FC<{ t: CardTypeCode | string; className?: string }> = ({ t, className }) => {
    const label = TYPE_FULL_NAME[String(t)] ?? String(t);
    const tint = t === 'K' ? 'bg-red-500/15 text-red-100 ring-red-400/30'
        : t === 'S' ? 'bg-sky-500/15 text-sky-100 ring-sky-400/30'
            : t === 'T' ? 'bg-purple-500/15 text-purple-100 ring-purple-400/30'
                : t === 'X2' ? 'bg-amber-500/15 text-amber-100 ring-amber-400/30'
                    : 'bg-white/10 text-white/85 ring-white/15';
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full ring-1 font-semibold ${tint} ${className ?? ''}`}>{label}</span>
    );
};

const cardDisplayName = (c: CardType) => {
    const color = COLOR_FULL_NAME[c.color] ?? c.color;
    const type = TYPE_FULL_NAME[c.type] ?? c.type;
    return `${color} ${type} card`;
};

// Zone Component
interface ZoneProps {
    id: string;
    title?: string;
    nameBadge?: string;
    nameBadgeClassName?: string;
    cards: CardType[];
    className?: string;
    killableCardIds?: Set<string>;
    killEnabled?: boolean;
    onKill?: (cardId: string) => void;
}

const Zone: React.FC<ZoneProps> = ({ id, title, nameBadge, nameBadgeClassName, cards, className, killableCardIds, killEnabled, onKill }) => {
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
            {(title || nameBadge) && (
                <div className="w-full flex items-center justify-between gap-2 mb-2">
                    <div className="text-white/90 font-semibold uppercase text-[11px] tracking-[0.18em]">
                        {title}
                    </div>
                    {nameBadge && (
                        <div className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold ring-1 ring-white/15 bg-black/30 ${nameBadgeClassName ?? ''}`}>
                            {nameBadge}
                        </div>
                    )}
                </div>
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

    const myName = (myPlayer?.name ?? '').trim() || 'You';
    const opponentName = (opponent?.name ?? '').trim() || 'Opponent';

    const turnPlays = gameState.turnPlays;
    const banquet = gameState.banquet;
    const scores = gameState.scores;

    const myScore = scores?.[playerId];
    const oppScore = opponentId ? scores?.[opponentId] : undefined;
    const myObjectives = gameState.myObjectives;

    const isKillDecisionMine = Boolean(pendingKill && pendingKill.type === 'kill' && pendingKill.affectedPlayerId === playerId);
    const killableSet = useMemo(() => new Set(pendingKill?.candidateCardIds ?? []), [pendingKill]);

    const killTargetsMe = Boolean(isKillDecisionMine && pendingKill?.area === 'self_domain');
    const killTargetsOpponent = Boolean(isKillDecisionMine && pendingKill?.area === 'opponent_domain');

    const hoveredCloseTimer = useRef<number | null>(null);
    const [hoverColor, setHoverColor] = useState<CardColor | null>(null);
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
                            <span className="text-[11px] font-semibold" style={{ color: COLOR_HEX[c] }}>{COLOR_FULL_NAME[c] ?? c}</span>
                            <span className="text-xs text-white/90">{score.byColor[c]}</span>
                        </div>
                    ))}
                </div>
                <div className="mt-2 text-[11px] text-white/60">
                    Deck counts: {colors.map(c => `${COLOR_FULL_NAME[c] ?? c}:${score.deckCounts[c]}`).join(' · ')}
                </div>
            </div>
        );
    };

    const HistoryPanel: React.FC = () => {
        const items = (gameState.history ?? []).slice(-18).reverse();
        if (items.length === 0) return null;

        const PlayerPill: React.FC<{ name?: string }> = ({ name }) => (
            <span className="px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/15 text-white font-bold text-[11px]">
                {name || 'Player'}
            </span>
        );

        const DestinationPill: React.FC<{ label?: string }> = ({ label }) => (
            <span className="px-2 py-0.5 rounded-full bg-black/30 ring-1 ring-white/15 text-white/85 font-semibold text-[11px]">
                {label}
            </span>
        );

        const ColorLabel: React.FC<{ color?: CardColor }> = ({ color }) => {
            if (!color) return null;
            return (
                <span className="font-bold" style={{ color: COLOR_HEX[color] }}>
                    {COLOR_FULL_NAME[color]}
                </span>
            );
        };

        const CardPhrase: React.FC<{ card?: { type?: CardTypeCode; color?: CardColor; hidden?: boolean } }> = ({ card }) => {
            if (!card) return null;
            const t = card.type;
            const isHidden = Boolean(card.hidden);
            if (isHidden || t === 'T') {
                return (
                    <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-white/80">a</span>
                        <TypePill t="T" />
                        <span className="text-white/80">card</span>
                    </span>
                );
            }

            return (
                <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/80">a</span>
                    <ColorLabel color={card.color} />
                    {t && <TypePill t={t} />}
                    <span className="text-white/80">card</span>
                </span>
            );
        };

        const Row: React.FC<{ h: NonNullable<GameState['history']>[number] }> = ({ h }) => {
            // Fallback to plain message if server didn't attach structured fields.
            if (!h.action) {
                return (
                    <div className="text-xs text-white/75 bg-black/25 rounded-lg px-2 py-1 ring-1 ring-white/10 whitespace-nowrap overflow-hidden text-ellipsis">
                        {h.message}
                    </div>
                );
            }

            const dest = destinationLabel(h.destination as any, h.targetName);
            const action = h.action;

            return (
                <div className="text-xs text-white/80 bg-black/25 rounded-lg px-2 py-1 ring-1 ring-white/10">
                    <div className="flex items-center gap-2 flex-wrap">
                        <PlayerPill name={h.actorName} />
                        {action === 'play' && (
                            <>
                                <span className="text-white/70">put</span>
                                <CardPhrase card={h.card} />
                                {dest && (
                                    <>
                                        <span className="text-white/60">in</span>
                                        <DestinationPill label={dest} />
                                    </>
                                )}
                            </>
                        )}

                        {action === 'kill' && (
                            <>
                                <span className="text-white/70">killed</span>
                                <CardPhrase card={h.card} />
                            </>
                        )}

                        {action === 'kill_hidden' && (
                            <>
                                <span className="text-white/70">destroyed</span>
                                <span className="text-white/80 font-semibold">a hidden card</span>
                                {dest && <DestinationPill label={dest} />}
                            </>
                        )}

                        {action === 'kill_none' && (
                            <span className="text-white/70">didn't kill anyone</span>
                        )}

                        {action === 'start' && (
                            <span className="text-white/70">started the game</span>
                        )}
                    </div>
                </div>
            );
        };

        return (
            <div className="bg-black/35 ring-1 ring-white/10 rounded-xl px-3 py-2 h-[260px] flex flex-col">
                <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/80">History</div>
                    <div className="text-[11px] text-white/50">last {items.length}</div>
                </div>
                <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-1">
                    {items.map((h) => (
                        <Row key={h.id} h={h} />
                    ))}
                </div>
            </div>
        );
    };

    const ObjectivesPanel: React.FC = () => {
        if (!myObjectives) return null;

        const showResult = Boolean(gameState.revealHidden);
        const badge = (met?: boolean) => {
            if (!showResult) return <span className="text-[10px] text-white/50">(revealed at end)</span>;
            return met
                ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40">met</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-200 ring-1 ring-red-400/40">missed</span>;
        };

        return (
            <div className="bg-black/35 ring-1 ring-white/10 rounded-xl px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/80">Objectives</div>
                <div className="mt-2 flex flex-col gap-2">
                    <div className="bg-black/25 rounded-lg px-2 py-2 ring-2 ring-emerald-700/50">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-emerald-200">Graceful</div>
                            {badge(myObjectives.gracefulMet)}
                        </div>
                        <div className="mt-1 text-xs text-white/80">{myObjectives.graceful.title}</div>
                        <div className="mt-0.5 text-[11px] text-white/60">{myObjectives.graceful.description}</div>
                    </div>
                    <div className="bg-black/25 rounded-lg px-2 py-2 ring-2 ring-red-800/55">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-red-200">Disgraceful</div>
                            {badge(myObjectives.disgracefulMet)}
                        </div>
                        <div className="mt-1 text-xs text-white/80">{myObjectives.disgraceful.title}</div>
                        <div className="mt-0.5 text-[11px] text-white/60">{myObjectives.disgraceful.description}</div>
                    </div>
                </div>
            </div>
        );
    };

    const BanquetBreakdownPanel: React.FC = () => {
        if (!banquet) return null;
        const details = gameState.banquetDetails;
        if (!details) return null;

        const colors: CardColor[] = ['DG', 'G', 'R', 'Y', 'B', 'W'];
        const summarize = (cards: CardType[]) => {
            const plus2 = cards.filter(c => c.type === 'X2').length;
            const plus1 = cards.length - plus2;
            return { plus1, plus2 };
        };

        const hiddenTop = details.hiddenTopCount ?? banquet.hiddenTopCount;
        const hiddenBottom = details.hiddenBottomCount ?? banquet.hiddenBottomCount;

        return (
            <div className="mt-4 bg-black/25 ring-1 ring-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/80">Banquet breakdown</div>
                    <div className="text-[11px] text-white/60">(+1/−1/+2/−2 counts)</div>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {colors.map((c) => {
                        const top = details.byColor[c]?.top ?? [];
                        const bottom = details.byColor[c]?.bottom ?? [];
                        const up = summarize(top);
                        const down = summarize(bottom);
                        return (
                            <div key={c} className="bg-black/30 ring-1 ring-white/10 rounded-lg px-2 py-2">
                                <div className="text-[11px] font-bold" style={{ color: COLOR_HEX[c] }}>{COLOR_FULL_NAME[c]}</div>
                                <div className="mt-1 grid grid-cols-4 gap-1 text-[11px]">
                                    <div className="text-emerald-200">+1</div>
                                    <div className="text-white/85 font-semibold">{up.plus1}</div>
                                    <div className="text-emerald-200">+2</div>
                                    <div className="text-white/85 font-semibold">{up.plus2}</div>

                                    <div className="text-red-200">−1</div>
                                    <div className="text-white/85 font-semibold">{down.plus1}</div>
                                    <div className="text-red-200">−2</div>
                                    <div className="text-white/85 font-semibold">{down.plus2}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {(hiddenTop > 0 || hiddenBottom > 0) && (
                    <div className="mt-2 text-[11px] text-white/65">
                        Hidden cards (unknown family): <span className="text-white/85 font-semibold">+{hiddenTop}</span> / <span className="text-white/85 font-semibold">−{hiddenBottom}</span>
                    </div>
                )}
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
                    nameBadge={opponentName}
                    nameBadgeClassName="text-red-100 bg-red-500/15 ring-red-400/30"
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
                    <div className="lg:col-span-1 flex flex-col gap-3">
                        <ScorePanel label="You" score={myScore} />
                        <ScorePanel label="Opponent" score={oppScore} />
                        <ObjectivesPanel />
                        <HistoryPanel />
                    </div>

                    <div className="lg:col-span-2 bg-black/30 ring-1 ring-white/10 rounded-2xl p-4 self-start">
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
                                            <div className="mt-2 text-[11px] font-semibold" style={{ color: COLOR_HEX[color] }}>
                                                {COLOR_FULL_NAME[color] ?? String(color)}
                                            </div>
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

                        <BanquetBreakdownPanel />
                    </div>
                </div>
            </div>

            {/* Player Area */}
            <div className="relative z-10 w-full max-w-6xl flex flex-col gap-3">
                {/* My Domain */}
                <Zone
                    id="self"
                    title="My Domain"
                    nameBadge={myName}
                    nameBadgeClassName="text-emerald-100 bg-emerald-500/15 ring-emerald-400/30"
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

                    const CardRow: React.FC<{ c: CardType; kind: 'top' | 'bottom' }> = ({ c, kind }) => {
                        const isKillable = canPickFromBanquet && killableSet.has(c.id) && c.type !== 'S';
                        const outline = kind === 'top'
                            ? 'ring-4 ring-emerald-400/90'
                            : 'ring-4 ring-red-400/90';
                        return (
                            <button
                                key={c.id}
                                type="button"
                                disabled={!isKillable}
                                onClick={() => isKillable && onResolveKill?.({ cardId: c.id })}
                                className={`w-full flex items-center gap-3 rounded-xl p-2 ring-1 ${isKillable ? 'ring-white/30 hover:ring-white/70 bg-white/5' : 'ring-white/10 bg-white/0'}`}
                            >
                                <div className={`shrink-0 rounded-xl ${outline} shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}>
                                    <Card card={c} draggable={false} />
                                </div>
                                <div className="min-w-0 flex-1 text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="text-xs font-semibold text-white/90 truncate">{cardDisplayName(c)}</div>
                                        <TypePill t={c.type} />
                                    </div>
                                    <div className="mt-1 text-[11px] text-white/60">
                                        {kind === 'top' ? 'Positive (Grace +1)' : 'Negative (Disgrace −1)'} · contributes {kind === 'top' ? '+' : '−'}{contribution(c)}
                                    </div>
                                </div>
                            </button>
                        );
                    };

                    return (
                        <div
                            className="fixed z-[2147483647] rounded-xl bg-black/92 ring-1 ring-white/25 p-3 shadow-2xl"
                            style={{ left, top: topPos, width }}
                            onMouseEnter={() => cancelHoverClose()}
                            onMouseLeave={() => scheduleHoverClose()}
                        >
                            <div className="text-sm font-semibold" style={{ color: COLOR_HEX[hoverColor] || '#fff' }}>
                                {COLOR_FULL_NAME[hoverColor] ?? hoverColor} breakdown
                            </div>

                            <div className="mt-2 max-h-[420px] overflow-y-auto pr-1 flex flex-col gap-3">
                                <div>
                                    <div className="text-xs text-white/70">Positive (Grace +1)</div>
                                    <div className="mt-2 flex flex-col gap-2">
                                        {top.length === 0 && <div className="text-xs text-white/50">None</div>}
                                        {top.map((c) => (
                                            <CardRow key={c.id} c={c} kind="top" />
                                        ))}
                                        {canKillHiddenTop && (
                                            <button
                                                type="button"
                                                onClick={() => onResolveKill?.({ hiddenSign: 'top' })}
                                                className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl ring-1 ring-white/30 hover:ring-white/70 bg-white/5"
                                            >
                                                <div className="text-left">
                                                    <div className="text-xs font-semibold text-white/90">Hidden card (Grace +)</div>
                                                    <div className="text-[11px] text-white/60">destroy without revealing identity</div>
                                                </div>
                                                <span className="text-[11px] text-white/70">destroy</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs text-white/70">Negative (Disgrace −1)</div>
                                    <div className="mt-2 flex flex-col gap-2">
                                        {bottom.length === 0 && <div className="text-xs text-white/50">None</div>}
                                        {bottom.map((c) => (
                                            <CardRow key={c.id} c={c} kind="bottom" />
                                        ))}
                                        {canKillHiddenBottom && (
                                            <button
                                                type="button"
                                                onClick={() => onResolveKill?.({ hiddenSign: 'bottom' })}
                                                className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-xl ring-1 ring-white/30 hover:ring-white/70 bg-white/5"
                                            >
                                                <div className="text-left">
                                                    <div className="text-xs font-semibold text-white/90">Hidden card (Disgrace −)</div>
                                                    <div className="text-[11px] text-white/60">destroy without revealing identity</div>
                                                </div>
                                                <span className="text-[11px] text-white/70">destroy</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
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
