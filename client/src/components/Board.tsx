import React, { useMemo, useRef, useState } from 'react';
import { useDndMonitor, useDroppable } from '@dnd-kit/core';
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
    title?: React.ReactNode;
    nameBadge?: string;
    nameBadgeClassName?: string;
    cards: CardType[];
    className?: string;
    minHeightClassName?: string;
    droppableDisabled?: boolean;
    killableCardIds?: Set<string>;
    killEnabled?: boolean;
    onKill?: (cardId: string) => void;
    children?: React.ReactNode;
}

const Zone: React.FC<ZoneProps> = ({ id, title, nameBadge, nameBadgeClassName, cards, className, minHeightClassName, droppableDisabled, killableCardIds, killEnabled, onKill, children }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        disabled: Boolean(droppableDisabled),
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                                relative ${minHeightClassName ?? 'min-h-[120px]'} p-2 rounded-xl flex flex-wrap gap-2 justify-center items-center transition-colors
        ${!droppableDisabled && isOver ? 'bg-emerald-500/15 ring-2 ring-emerald-400/60' : 'bg-black/35 ring-1 ring-white/10'}
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

            {children}

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

const TurnActionsBubble: React.FC<{
    isMyTurn: boolean;
    turnPlays?: GameState['turnPlays'];
    hasPendingDecision: boolean;
}> = ({ isMyTurn, turnPlays, hasPendingDecision }) => {
    const items: Array<{ id: string; label: string; done: boolean }> = [
        { id: 'banquet', label: 'Play to Banquet', done: Boolean(turnPlays?.banquet) },
        { id: 'self', label: 'Play to My Domain', done: Boolean(turnPlays?.self) },
        { id: 'opponent', label: 'Play to Opponent', done: Boolean(turnPlays?.opponent) },
    ];
    const doneCount = items.filter(i => i.done).length;
    const totalCount = items.length;

    return (
        <div className="w-[260px] max-w-[calc(100vw-1.5rem)] bg-black/65 backdrop-blur-sm ring-1 ring-white/15 rounded-2xl p-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="text-white/90 font-semibold uppercase text-[11px] tracking-[0.18em]">Turn actions</div>
                    <div className="mt-0.5 text-[11px] text-white/55">{doneCount}/{totalCount} done</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {hasPendingDecision && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-100 ring-1 ring-red-400/30">
                            Action
                        </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ring-1 ${isMyTurn ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30' : 'bg-white/5 text-white/60 ring-white/10'}`}>
                        {isMyTurn ? 'Your turn' : 'Waiting'}
                    </span>
                </div>
            </div>

            <div className="mt-2 flex flex-col gap-1">
                {items.map((it, idx) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 bg-black/25 ring-1 ring-white/10 rounded-xl px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ${it.done ? 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/25' : 'bg-white/5 text-white/70 ring-white/10'}`}>
                                {idx + 1}
                            </div>
                            <div className={`text-[11px] font-medium truncate ${it.done ? 'text-white/55 line-through' : 'text-white/85'}`}>
                                {it.label}
                            </div>
                        </div>

                        <div className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${it.done ? 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30' : 'bg-white/5 text-white/60 ring-white/10'}`}>
                            {it.done ? 'Done' : 'To do'}
                        </div>
                    </div>
                ))}
            </div>
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
    const myName = (myPlayer?.name ?? '').trim() || 'You';

    const hasFinalRanking = Array.isArray(gameState.finalRanking) && gameState.finalRanking.length > 0;
    const finalRanking = hasFinalRanking ? gameState.finalRanking! : undefined;
    const [showGameOverOverlay, setShowGameOverOverlay] = useState(true);
    React.useEffect(() => {
        if (hasFinalRanking) setShowGameOverOverlay(true);
    }, [hasFinalRanking]);

    const playerOrder = (gameState.playerOrder && gameState.playerOrder.length > 0)
        ? gameState.playerOrder
        : Object.keys(gameState.players);
    const playerCount = playerOrder.length;
    const myIndex = Math.max(0, playerOrder.indexOf(playerId));
    const leftNeighborId = playerCount >= 2 ? playerOrder[(myIndex + 1) % playerCount] : undefined;
    const rightNeighborId = playerCount >= 2 ? playerOrder[(myIndex - 1 + playerCount) % playerCount] : undefined;

    // Game rules currently treat "opponent" as your left neighbor.
    const targetOpponentId = leftNeighborId;

    const otherOpponentIds = playerOrder.filter((id) => id !== playerId && id !== targetOpponentId);

    const banquet = gameState.banquet;
    const scores = gameState.scores;
    const myObjectives = gameState.myObjectives;

    const [expandedOpponents, setExpandedOpponents] = useState<Record<string, boolean>>({});
    const setExclusiveExpandedOpponent = (id?: string) => {
        if (!id) {
            setExpandedOpponents({});
            return;
        }
        setExpandedOpponents({ [id]: true });
    };
    const toggleOpponentExpanded = (id: string) => {
        const isExpanded = Boolean(expandedOpponents[id]);
        if (isExpanded) {
            setExpandedOpponents({});
        } else {
            setExclusiveExpandedOpponent(id);
        }
    };

    const isKillDecisionMine = Boolean(pendingKill && pendingKill.type === 'kill' && pendingKill.affectedPlayerId === playerId);
    const killableSet = useMemo(() => new Set(pendingKill?.candidateCardIds ?? []), [pendingKill]);

    const killTargetsMe = Boolean(isKillDecisionMine && pendingKill?.area === 'self_domain');
    const killTargetsOpponent = Boolean(isKillDecisionMine && pendingKill?.area === 'opponent_domain');

    // Multiplayer: when killing an opponent domain, server can specify which opponent is being targeted.
    const killTargetOpponentId = killTargetsOpponent
        ? (pendingKill?.targetPlayerId ?? targetOpponentId)
        : undefined;

    // If the current player must select a card from an opponent domain, auto-expand that opponent.
    React.useEffect(() => {
        if (!killTargetsOpponent) return;
        if (!killTargetOpponentId) return;
        setExclusiveExpandedOpponent(killTargetOpponentId);
    }, [killTargetsOpponent, killTargetOpponentId]);

    const hoveredCloseTimer = useRef<number | null>(null);
    const [hoverColor, setHoverColor] = useState<CardColor | null>(null);
    const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);

    const hoveredDomainCloseTimer = useRef<number | null>(null);
    const [hoverDomain, setHoverDomain] = useState<null | { opponentId: string; category: CardColor | 'HIDDEN'; rect: DOMRect }>(null);
    const [isDragging, setIsDragging] = useState(false);

    useDndMonitor({
        onDragStart: () => {
            setIsDragging(true);
            setHoverColor(null);
            setHoverRect(null);
            setHoverDomain(null);
            if (hoveredCloseTimer.current) window.clearTimeout(hoveredCloseTimer.current);
            hoveredCloseTimer.current = null;
            if (hoveredDomainCloseTimer.current) window.clearTimeout(hoveredDomainCloseTimer.current);
            hoveredDomainCloseTimer.current = null;
        },
        onDragCancel: () => {
            setIsDragging(false);
        },
        onDragEnd: () => {
            setIsDragging(false);
        }
    });

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

    const scheduleDomainHoverClose = () => {
        if (hoveredDomainCloseTimer.current) window.clearTimeout(hoveredDomainCloseTimer.current);
        hoveredDomainCloseTimer.current = window.setTimeout(() => {
            setHoverDomain(null);
        }, 450);
    };
    const cancelDomainHoverClose = () => {
        if (hoveredDomainCloseTimer.current) window.clearTimeout(hoveredDomainCloseTimer.current);
        hoveredDomainCloseTimer.current = null;
    };

    const contribution = (c: CardType) => (c.type === 'X2' ? 2 : 1);

    const BanquetZone: React.FC<{ id: 'banquet_top' | 'banquet_bottom'; title: string; hint: string; }> = ({ id, title, hint }) => {
        const { setNodeRef, isOver } = useDroppable({ id });
        return (
            <div
                ref={setNodeRef}
                className={`p-2 rounded-xl text-center transition-all bg-black/35 ring-1 ring-white/10 ${isOver ? 'ring-2 ring-emerald-400/70 bg-emerald-500/10' : ''}`}
            >
                <div className="text-white/90 font-semibold text-[11px] tracking-[0.18em] uppercase">{title}</div>
                <div className="text-white/55 text-[11px] mt-0.5 hidden sm:block">{hint}</div>
            </div>
        );
    };

    const ScoreBubble: React.FC = () => {
        if (!scores) return null;
        const colors: CardColor[] = ['DG', 'G', 'R', 'Y', 'B', 'W'];

        const [open, setOpen] = useState(false);
        const orderedIds = playerOrder.filter((id) => scores[id]);

        return (
            <div className="fixed top-4 right-4 z-50">
                <div
                    className="bg-black/55 ring-1 ring-white/15 rounded-full px-3 py-2 backdrop-blur-sm cursor-default"
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                >
                    <div className="flex items-center gap-3">
                        {orderedIds.map((id) => {
                            const p = gameState.players[id];
                            const name = (p?.name ?? '').trim() || 'Player';
                            const total = scores[id]?.total ?? 0;
                            const isTurn = gameState.turn === id;
                            const isMe = id === playerId;
                            return (
                                <div key={id} className={`flex items-center gap-2 ${isTurn ? 'text-emerald-200' : 'text-white/90'}`}>
                                    <span className={`text-xs font-bold ${isMe ? 'text-amber-200' : ''}`}>{name}</span>
                                    <span className="text-xs font-extrabold">{total}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {open && (
                    <div className="mt-2 w-[360px] max-w-[90vw] bg-black/90 ring-1 ring-white/20 rounded-xl p-3 shadow-2xl">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Scores</div>
                        <div className="mt-2 flex flex-col gap-2">
                            {orderedIds.map((id) => {
                                const p = gameState.players[id];
                                const name = (p?.name ?? '').trim() || 'Player';
                                const s = scores[id];
                                if (!s) return null;
                                const obj = gameState.objectiveResultsPublic?.[id];
                                return (
                                    <div key={id} className="bg-black/40 ring-1 ring-white/10 rounded-lg px-2 py-2">
                                        <div className="flex items-center justify-between">
                                            <div className={`text-sm font-bold ${id === playerId ? 'text-amber-200' : 'text-white/90'}`}>{name}</div>
                                            <div className="text-white font-extrabold">{s.total}</div>
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-1">
                                            {colors.map((c) => {
                                                const usedValue = banquet
                                                    ? (gameState.revealHidden ? banquet.byColor[c].valueRevealed : banquet.byColor[c].valueVisible)
                                                    : 0;
                                                const count = s.deckCounts?.[c] ?? 0;
                                                const pts = s.byColor?.[c] ?? (usedValue * count);
                                                return (
                                                    <div key={c} className="bg-black/25 rounded px-2 py-1 ring-1 ring-white/10">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-semibold" style={{ color: COLOR_HEX[c] }}>{COLOR_FULL_NAME[c]}</span>
                                                            <span className="text-[10px] text-white/90 font-semibold tabular-nums">{pts}</span>
                                                        </div>
                                                        <div className="mt-0.5 text-[10px] text-white/55 tabular-nums">
                                                            {usedValue} × {count}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="mt-2 text-[11px] text-white/70">
                                            Objectives: <span className="text-white font-semibold tabular-nums">{s.objectivePoints ?? 0}</span>
                                            {obj && (
                                                <span className="text-white/55">
                                                    {' '}(Graceful {obj.gracefulMet ? `+${3}` : '+0'}, Disgraceful {obj.disgracefulMet ? `+${3}` : '+0'})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const TurnIndicator: React.FC = () => {
        const turnId = gameState.turn;
        const name = (gameState.players[turnId]?.name ?? '').trim() || 'Player';
        const isYou = turnId === playerId;
        return (
            <div className="fixed top-4 left-4 z-50">
                <div className="bg-black/55 ring-1 ring-white/15 rounded-full px-3 py-2 backdrop-blur-sm">
                    <div className="text-xs text-white/80">
                        Turn: <span className={`font-extrabold ${isYou ? 'text-amber-200' : 'text-white'}`}>{isYou ? `${name} (you)` : name}</span>
                    </div>
                </div>
            </div>
        );
    };

    const DomainSummaryPanel: React.FC<{ forPlayerId: string; layout?: 'grid' | 'vertical-list'; mode?: 'score' | 'count' }> = ({ forPlayerId, layout = 'grid', mode = 'score' }) => {
        const colors: CardColor[] = ['DG', 'G', 'R', 'Y', 'B', 'W'];
        const score = scores?.[forPlayerId];
        const domainSummary = gameState.domainSummary?.[forPlayerId];

        if (!score && !domainSummary) {
            return <div className="text-xs text-white/55">No summary</div>;
        }

        // Prefer score-by-family (can be negative) unless explicitly asked for counts.
        const rows = colors.map((c) => {
            if (mode === 'score') {
                const v = score?.byColor?.[c];
                if (typeof v === 'number') return { color: c, value: v, kind: 'score' as const };
            }
            const countFromSummary = domainSummary?.byColorCounts?.[c];
            if (typeof countFromSummary === 'number') return { color: c, value: countFromSummary, kind: 'count' as const };

            // Fallback: compute from visible cards (avoid leaking hidden spy colors).
            const p = gameState.players[forPlayerId];
            const count = (p?.domain ?? [])
                .filter((card) => !(card.isHidden || card.type === 'T') && card.color === c)
                .reduce((sum, card) => sum + contribution(card), 0);
            return { color: c, value: count, kind: 'count' as const };
        });

        if (layout === 'vertical-list') {
            const nonZero = rows.filter((r) => r.value !== 0);
            const list = nonZero.length > 0 ? nonZero : rows;
            return (
                <div className="w-full">
                    <div className="flex flex-col gap-1">
                        {list.map((r) => (
                            <div key={r.color} className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold" style={{ color: COLOR_HEX[r.color] }}>{COLOR_FULL_NAME[r.color]}</span>
                                <span className={`text-[11px] font-extrabold tabular-nums ${r.value < 0 ? 'text-red-200' : 'text-emerald-200'}`}>{r.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full">
                <div className="grid grid-cols-3 gap-1">
                    {rows.map((r) => (
                        <div key={r.color} className="flex items-center justify-between bg-black/25 rounded px-2 py-1 ring-1 ring-white/10">
                            <span className="text-[10px] font-semibold" style={{ color: COLOR_HEX[r.color] }}>{COLOR_FULL_NAME[r.color]}</span>
                            <span className="text-[10px] text-white/85 font-semibold tabular-nums">{r.value}</span>
                        </div>
                    ))}
                </div>
                {domainSummary && (
                    <div className="mt-2 text-[11px] text-white/65">Spies: <span className="text-white/85 font-semibold">{domainSummary.spiesCount}</span></div>
                )}
            </div>
        );
    };

    const OpponentDomainPanel: React.FC<{
        opponentId: string;
        placement: 'top' | 'left' | 'right';
        isTarget: boolean;
    }> = ({ opponentId, placement, isTarget }) => {
        const op = gameState.players[opponentId];
        if (!op) return null;
        const name = (op.name ?? '').trim() || 'Opponent';
        const expanded = Boolean(expandedOpponents[opponentId]);

        const isKillTarget = Boolean(killTargetsOpponent && killTargetOpponentId === opponentId);

        const arrow = (() => {
            // Buttons must always point toward the center (inner edge).
            if (placement === 'top') return expanded ? '▲' : '▼';
            if (placement === 'left') return expanded ? '◀' : '▶';
            return expanded ? '▶' : '◀';
        })();

        const title = <span>{isTarget ? 'Opponent Domain' : 'Player Domain'}</span>;

        const zoneId = `opponent:${opponentId}`;
        const droppableDisabled = false;

        // Side panels: stack vertically and avoid wrapping.
        // Add inner-edge padding so the expand button never overlaps text/cards.
        const zoneClassName = placement === 'top'
            ? 'pb-10'
            : `w-full flex-col flex-nowrap items-center justify-start ${placement === 'left' ? 'pr-10' : 'pl-10'}`;

        const zoneMinHeight = placement === 'top'
            ? (expanded ? 'min-h-[130px]' : 'min-h-[105px]')
            : (expanded ? 'min-h-[260px]' : 'min-h-[180px]');

        const showNameInZoneHeader = placement === 'top';

        // Player 3/4 (left/right) domains are aggregated + inspectable (Banquet-like).
        if (placement !== 'top') {
            const summary = gameState.domainSummary?.[opponentId];
            const colorOrder: CardColor[] = ['Y', 'R', 'G', 'DG', 'B', 'W'];

            const getCountForColor = (color: CardColor) => {
                const v = summary?.byColorCounts?.[color];
                if (typeof v === 'number') return v;
                // Fallback: compute from visible cards (avoid leaking hidden colors).
                return op.domain
                    .filter((c) => !(c.isHidden || c.type === 'T') && c.color === color)
                    .reduce((sum, c) => sum + contribution(c), 0);
            };

            const getCardsForCategory = (category: CardColor | 'HIDDEN') => {
                if (category === 'HIDDEN') {
                    return op.domain.filter((c) => c.isHidden || c.type === 'T');
                }
                return op.domain.filter((c) => !(c.isHidden || c.type === 'T') && c.color === category);
            };

            const CategoryCard: React.FC<{ category: CardColor | 'HIDDEN' }> = ({ category }) => {
                const cards = getCardsForCategory(category);
                const exemplar: CardType = category === 'HIDDEN'
                    ? { id: `ex-${opponentId}-H`, color: 'DG', type: 'T', ownerId: opponentId, image: 'back.jpeg', isHidden: true }
                    : ({ id: `ex-${opponentId}-${category}`, color: category, type: 'N', ownerId: opponentId, image: `${category}N.png`, isHidden: false } as any);
                const rep = cards[0] ?? exemplar;

                const categoryHasKillable = isKillTarget
                    ? cards.some((c) => killableSet.has(c.id) && c.type !== 'S')
                    : false;

                const isHovered = Boolean(
                    hoverDomain &&
                    hoverDomain.opponentId === opponentId &&
                    hoverDomain.category === category
                );

                const hoverRing = isHovered ? 'ring-2 ring-emerald-300/80' : 'ring-1 ring-white/12';
                const killRing = isKillTarget
                    ? (categoryHasKillable ? 'ring-2 ring-red-400/80 hover:ring-red-300/90' : 'ring-1 ring-white/8')
                    : 'hover:ring-2 hover:ring-white/25';
                const dim = isKillTarget && !categoryHasKillable ? 'opacity-45' : 'opacity-100';

                const glow = isKillTarget
                    ? (categoryHasKillable ? 'shadow-[0_0_24px_rgba(248,113,113,0.25)]' : '')
                    : (isHovered ? 'shadow-[0_0_24px_rgba(52,211,153,0.18)]' : '');

                return (
                    <div
                        className={`rounded-2xl bg-gradient-to-b from-white/5 to-black/20 ${hoverRing} ${killRing} ${dim} ${glow} transition-all duration-150 p-1.5 flex items-center justify-center hover:-translate-y-[1px]`}
                        onPointerEnter={(e) => {
                            if (isDragging) return;
                            cancelDomainHoverClose();
                            const rect = e.currentTarget.getBoundingClientRect();
                            // Defer state update slightly to reduce jitter when rapidly moving across cards.
                            window.requestAnimationFrame(() => {
                                setHoverDomain({ opponentId, category, rect });
                            });
                        }}
                        onPointerLeave={() => scheduleDomainHoverClose()}
                    >
                        <div style={{ transform: 'scale(0.82)', transformOrigin: 'center' }}>
                            <Card card={rep} draggable={false} />
                        </div>
                    </div>
                );
            };

            return (
                <div className="h-full flex flex-col justify-between">
                    <Zone
                        id={zoneId}
                        title={title}
                        minHeightClassName={zoneMinHeight}
                        droppableDisabled={droppableDisabled}
                        className={zoneClassName}
                        cards={[]}
                        killEnabled={Boolean(isKillTarget)}
                        killableCardIds={isKillTarget ? killableSet : undefined}
                        onKill={(cardId) => onResolveKill?.({ cardId })}
                    >
                        {/* Inner-edge expand button */}
                        <button
                            type="button"
                            onClick={() => toggleOpponentExpanded(opponentId)}
                            className={`absolute z-10 text-[12px] font-extrabold w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/15 flex items-center justify-center
                                ${placement === 'left' ? 'right-2 top-1/2 -translate-y-1/2' : ''}
                                ${placement === 'right' ? 'left-2 top-1/2 -translate-y-1/2' : ''}
                            `}
                            aria-label={expanded ? 'Collapse domain' : 'Expand domain'}
                        >
                            {arrow}
                        </button>

                        {!expanded && (
                            <div className="w-full">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/65">Card counts</div>
                                <div className="mt-2 grid grid-cols-1 gap-1">
                                    {colorOrder.map((c) => (
                                        <div key={c} className="flex items-center justify-between bg-black/25 rounded px-2 py-1 ring-1 ring-white/10">
                                            <span className="text-[11px] font-semibold" style={{ color: COLOR_HEX[c] }}>{COLOR_FULL_NAME[c]}</span>
                                            <span className="text-[11px] text-white/85 font-extrabold tabular-nums">{getCountForColor(c)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {expanded && (
                            <div className="w-full flex flex-col gap-2">
                                <CategoryCard category="Y" />
                                <CategoryCard category="R" />
                                <CategoryCard category="G" />
                                <CategoryCard category="DG" />
                                <CategoryCard category="B" />
                                <CategoryCard category="W" />
                                <CategoryCard category="HIDDEN" />
                            </div>
                        )}
                    </Zone>

                    <div className="mt-1 flex items-center justify-center">
                        <div className="px-2 py-1 rounded-full text-[11px] font-semibold ring-1 ring-white/15 bg-black/30 text-white/85">
                            {name}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={`h-full flex flex-col ${placement === 'top' ? '' : 'justify-between'}`}>
                <Zone
                    id={zoneId}
                    title={title}
                    nameBadge={showNameInZoneHeader ? name : undefined}
                    nameBadgeClassName={showNameInZoneHeader ? 'text-red-100 bg-red-500/15 ring-red-400/30' : undefined}
                    minHeightClassName={zoneMinHeight}
                    droppableDisabled={droppableDisabled}
                    className={zoneClassName}
                    cards={expanded ? (op.domain || []) : []}
                    killEnabled={Boolean(isKillTarget)}
                    killableCardIds={isKillTarget ? killableSet : undefined}
                    onKill={(cardId) => onResolveKill?.({ cardId })}
                >
                    {/* Inner-edge expand button */}
                    <button
                        type="button"
                        onClick={() => toggleOpponentExpanded(opponentId)}
                        className={`absolute z-10 text-[12px] font-extrabold w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/15 flex items-center justify-center
                            bottom-2 left-1/2 -translate-x-1/2
                        `}
                        aria-label={expanded ? 'Collapse domain' : 'Expand domain'}
                    >
                        {arrow}
                    </button>

                    {!expanded && (
                        <div className="w-full flex flex-col gap-2">
                            <DomainSummaryPanel forPlayerId={opponentId} layout={placement === 'top' ? 'grid' : 'vertical-list'} mode={placement === 'top' ? 'count' : 'score'} />
                            {isTarget && (
                                <div className="text-[11px] text-white/55">Drop your opponent-play card here.</div>
                            )}
                            {!isTarget && (
                                <div className="text-[11px] text-white/45">You can play to any opponent.</div>
                            )}
                        </div>
                    )}
                </Zone>

                {!showNameInZoneHeader && (
                    <div className="mt-2 flex items-center justify-center">
                        <div className="px-2 py-1 rounded-full text-[11px] font-semibold ring-1 ring-white/15 bg-black/30 text-white/85">
                            {name}
                        </div>
                    </div>
                )}
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

    const showObjectivesDock = Boolean(myObjectives);
    const showHistoryDock = (gameState.history ?? []).length > 0;

    return (
        <div className="w-full h-full flex flex-col items-center justify-between p-3 sm:p-4 relative overflow-auto">
            {/* Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-70"
                    style={{ backgroundImage: "url('/assets/maintapis.jpeg')" }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/70" />
                <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.9)_1px,transparent_0)] [background-size:22px_22px]" />
            </div>

            <ScoreBubble />
            <TurnIndicator />

            {showObjectivesDock && (
                <div className="fixed bottom-3 left-3 z-50 flex flex-col gap-3 pointer-events-auto">
                    <TurnActionsBubble
                        isMyTurn={isMyTurn}
                        turnPlays={gameState.turnPlays}
                        hasPendingDecision={isKillDecisionMine}
                    />
                    <div className="w-[260px] max-w-[calc(100vw-1.5rem)] max-h-[260px] overflow-y-auto">
                        <ObjectivesPanel />
                    </div>
                </div>
            )}

            {showHistoryDock && (
                <div className="fixed bottom-3 right-3 z-50 pointer-events-auto w-[420px] max-w-[calc(100vw-1.5rem)] max-h-[320px] overflow-y-auto">
                    <HistoryPanel />
                </div>
            )}

            {hasFinalRanking && showGameOverOverlay && finalRanking && (
                <div className="fixed inset-0 z-[2147483646] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-black/90 ring-1 ring-white/20 rounded-2xl p-4 shadow-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-white font-extrabold text-xl">Game over</div>
                                {gameState.winner && (
                                    <div className="mt-1 text-white/80">Winner: <span className="text-amber-200 font-bold">{(gameState.players[gameState.winner]?.name ?? '').trim() || 'Player'}</span></div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowGameOverOverlay(false)}
                                className="shrink-0 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/15 text-white/85 text-xs font-semibold"
                            >
                                Close
                            </button>
                        </div>
                        <div className="mt-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Final ranking</div>
                            <div className="mt-2 flex flex-col gap-2">
                                {finalRanking.map((r, idx) => (
                                    <div key={r.playerId} className="flex items-center justify-between bg-black/40 ring-1 ring-white/10 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="text-white/60 text-xs w-5">#{idx + 1}</div>
                                            <div className={`text-sm font-bold truncate ${r.playerId === playerId ? 'text-amber-200' : 'text-white/90'}`}>{r.name}</div>
                                        </div>
                                        <div className="text-white font-extrabold">{r.total}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-white/50">Close this to review final points.</div>
                    </div>
                </div>
            )}

            {hasFinalRanking && !showGameOverOverlay && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
                    <button
                        type="button"
                        onClick={() => setShowGameOverOverlay(true)}
                        className="px-4 py-2 rounded-full bg-black/60 hover:bg-black/75 ring-1 ring-white/15 backdrop-blur-sm text-white/90 text-xs font-semibold"
                    >
                        View final ranking
                    </button>
                </div>
            )}

            {/* Tabletop layout */}
            <div className="relative z-10 w-full max-w-[1700px]">
                <div className="grid grid-cols-1 gap-3 lg:gap-4 lg:grid-cols-[320px_minmax(520px,1fr)_320px] lg:grid-rows-[auto_minmax(520px,1fr)_auto]">
                    {/* Top (Player 2) */}
                    <div className="hidden lg:block lg:col-start-2 lg:row-start-1">
                        {targetOpponentId && (
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-center gap-2 min-h-[84px]">
                                    {(gameState.players[targetOpponentId]?.hand ?? []).map((c) => <Card key={c.id} card={c} />)}
                                </div>
                                <OpponentDomainPanel opponentId={targetOpponentId} placement="top" isTarget={true} />
                            </div>
                        )}
                    </div>

                    {/* Left (Player 4) */}
                    <div className="hidden lg:flex lg:col-start-1 lg:row-start-2 flex-col gap-2 items-stretch justify-center pr-3 pl-1">
                        {playerCount === 4 && otherOpponentIds.length >= 2 && (
                            (() => {
                                // Prefer putting the non-right-neighbor on the left.
                                const leftId = otherOpponentIds.find((id) => id !== rightNeighborId) ?? otherOpponentIds[0];
                                if (!leftId) return null;
                                const hand = gameState.players[leftId]?.hand ?? [];
                                return (
                                    <div className="h-full w-full flex items-center justify-between gap-3">
                                        {/* Hidden cards nearest the screen edge (fully visible) */}
                                        <div className="shrink-0 pointer-events-none w-[190px] overflow-visible">
                                            <div className="flex gap-2" style={{ transform: 'rotate(-90deg)', transformOrigin: 'left center' }}>
                                                {hand.map((c) => <Card key={c.id} card={c} />)}
                                            </div>
                                        </div>
                                        {/* Domain reserved space (max width), sits between hidden cards and banquet */}
                                        <div className="flex-1 flex justify-end">
                                            <div className="w-full max-w-[240px]">
                                                <OpponentDomainPanel opponentId={leftId} placement="left" isTarget={false} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    {/* Right (Player 3) */}
                    <div className="hidden lg:flex lg:col-start-3 lg:row-start-2 flex-col gap-2 items-stretch justify-center pl-3 pr-1">
                        {playerCount >= 3 && rightNeighborId && rightNeighborId !== targetOpponentId && (
                            (() => {
                                const rightId = rightNeighborId;
                                const hand = gameState.players[rightId]?.hand ?? [];
                                return (
                                    <div className="h-full w-full flex items-center justify-between gap-3">
                                        {/* Domain reserved space (max width), sits between banquet and hidden cards */}
                                        <div className="flex-1 flex justify-start">
                                            <div className="w-full max-w-[240px]">
                                                <OpponentDomainPanel opponentId={rightId} placement="right" isTarget={false} />
                                            </div>
                                        </div>
                                        {/* Hidden cards nearest the screen edge (fully visible) */}
                                        <div className="shrink-0 pointer-events-none w-[190px] overflow-visible flex justify-end">
                                            <div className="flex gap-2" style={{ transform: 'rotate(90deg)', transformOrigin: 'right center' }}>
                                                {hand.map((c) => <Card key={c.id} card={c} />)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                        {playerCount === 3 && otherOpponentIds[0] && otherOpponentIds[0] !== targetOpponentId && otherOpponentIds[0] !== rightNeighborId && (
                            <OpponentDomainPanel opponentId={otherOpponentIds[0]} placement="right" isTarget={false} />
                        )}
                    </div>

                    {/* Center (Banquet square + details) */}
                    <div className="lg:col-start-2 lg:row-start-2 bg-black/30 ring-1 ring-white/10 rounded-2xl p-3 lg:p-4 self-stretch mx-auto w-full max-w-[680px] min-w-0">

                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="text-white font-extrabold text-lg">The Banquet</div>
                                <div className="text-white/60 text-[12px]">Drop a card into +1 (top) or −1 (under)</div>
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
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                {(Object.keys(banquet.byColor) as Array<keyof typeof banquet.byColor>).map((color) => {
                                    const summary = banquet.byColor[color];
                                    const value = gameState.revealHidden ? summary.valueRevealed : summary.valueVisible;
                                    const bubbleClass = value >= 0 ? 'bg-emerald-500/20 ring-emerald-400/60 text-emerald-200' : 'bg-red-500/20 ring-red-400/60 text-red-200';
                                    const exemplar = { id: `ex-${color}`, color: color as any, type: 'N' as any, ownerId: '', image: `${color}N.png`, isHidden: false };

                                    return (
                                        <div
                                            key={color}
                                            className="relative bg-black/25 ring-1 ring-white/10 hover:ring-2 hover:ring-white/30 rounded-xl p-1.5 flex flex-col items-center transition"
                                            onMouseEnter={(e) => {
                                                cancelHoverClose();
                                                setHoverColor(color);
                                                setHoverRect(e.currentTarget.getBoundingClientRect());
                                            }}
                                            onMouseLeave={() => scheduleHoverClose()}
                                        >
                                            <Card card={exemplar as any} draggable={false} />
                                            <div className="mt-1 text-[11px] font-semibold" style={{ color: COLOR_HEX[color] }}>
                                                {COLOR_FULL_NAME[color] ?? String(color)}
                                            </div>
                                            <div className={`mt-1 px-2 py-1 rounded-full text-xs font-bold ring-1 ${bubbleClass}`}
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

                    {/* Bottom (Player 1: You) */}
                    <div className="lg:col-start-2 lg:row-start-3 flex flex-col gap-3">
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

                        <div className="flex justify-center flex-wrap gap-2 p-3 bg-black/45 rounded-2xl ring-1 ring-white/10 min-h-[140px]">
                            {myPlayer?.hand.map(c => (
                                <Card key={c.id} card={c} draggable={isMyTurn} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed high-priority hover panel (rendered at Board root to avoid z-index stacking issues) */}
            {banquet && !isDragging && hoverColor && hoverRect && (
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

            {/* Side domain inspect panel (Player 3/4) */}
            {!isDragging && hoverDomain && (
                (() => {
                    const op = gameState.players[hoverDomain.opponentId];
                    if (!op) return null;
                    const opName = (op.name ?? '').trim() || 'Player';

                    const categoryLabel = hoverDomain.category === 'HIDDEN'
                        ? 'Hidden'
                        : (COLOR_FULL_NAME[hoverDomain.category] ?? hoverDomain.category);

                    const cards = hoverDomain.category === 'HIDDEN'
                        ? op.domain.filter((c) => c.isHidden || c.type === 'T')
                        : op.domain.filter((c) => !(c.isHidden || c.type === 'T') && c.color === hoverDomain.category);

                    const isKillTarget = Boolean(
                        isKillDecisionMine &&
                        pendingKill?.area === 'opponent_domain' &&
                        (pendingKill?.targetPlayerId ?? targetOpponentId) === hoverDomain.opponentId
                    );

                    const width = 420;
                    const padding = 12;
                    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1400;
                    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900;
                    const preferRight = hoverDomain.rect.left < viewportW / 2;
                    const unclampedLeft = preferRight ? (hoverDomain.rect.right + 10) : (hoverDomain.rect.left - width - 10);
                    const left = Math.min(Math.max(unclampedLeft, padding), Math.max(padding, viewportW - width - padding));
                    const top = Math.min(Math.max(hoverDomain.rect.top, padding), Math.max(padding, viewportH - 420 - padding));

                    const group = {
                        N: cards.filter((c) => c.type === 'N'),
                        X2: cards.filter((c) => c.type === 'X2'),
                        S: cards.filter((c) => c.type === 'S'),
                        K: cards.filter((c) => c.type === 'K'),
                        T: cards.filter((c) => c.type === 'T'),
                    };

                    const Section: React.FC<{ title: string; list: CardType[] }> = ({ title, list }) => {
                        if (list.length === 0) return null;
                        return (
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60">{title}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {list.map((c) => {
                                        const isKillable = isKillTarget && killableSet.has(c.id) && c.type !== 'S';
                                        const dimmed = isKillTarget && !isKillable;
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                disabled={!isKillable}
                                                onClick={() => {
                                                    if (isKillable) {
                                                        onResolveKill?.({ cardId: c.id });
                                                        // Optional: retract after selection to reduce clutter.
                                                        setExpandedOpponents({});
                                                    }
                                                }}
                                                className={
                                                    isKillable
                                                        ? 'relative rounded-xl ring-2 ring-red-400/90 shadow-[0_0_1.0rem_rgba(248,113,113,0.45)]'
                                                        : `relative ${dimmed ? 'opacity-50' : 'opacity-95'}`
                                                }
                                            >
                                                <Card card={c} draggable={false} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div
                            className="fixed z-[60] pointer-events-auto"
                            style={{ left, top, width }}
                            onPointerEnter={() => cancelDomainHoverClose()}
                            onPointerLeave={() => scheduleDomainHoverClose()}
                        >
                            <div className="bg-black/92 ring-1 ring-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-sm animate-[fadeIn_120ms_ease-out]">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-extrabold text-white/90">
                                        {opName} — {categoryLabel}
                                    </div>
                                    {isKillTarget && (
                                        <div className="text-[11px] text-red-200/90">Select a card to kill</div>
                                    )}
                                </div>

                                <div className="mt-3 flex flex-col gap-3 max-h-[360px] overflow-auto pr-1">
                                    <Section title="Normal" list={group.N} />
                                    <Section title="×2" list={group.X2} />
                                    <Section title="Shield" list={group.S} />
                                    <Section title="Killer" list={group.K} />
                                    <Section title="Espion" list={group.T} />
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}
        </div>
    );
};
