export type CardColor = 'DG' | 'G' | 'R' | 'Y' | 'B' | 'W';
export type CardType = 'N' | 'X2' | 'S' | 'K' | 'T';

export type PlayZone = 'banquet_top' | 'banquet_bottom' | 'self' | 'opponent';

export interface Card {
    id: string;
    color: CardColor;
    type: CardType;
    ownerId: string; // 'player1' | 'player2'
    image: string; // Filename e.g., 'DGK.png'
    isHidden?: boolean; // If true, client sees back.jpeg
}

export interface PlayerState {
    id: string;
    name?: string;
    hand: Card[];
    domain: Card[]; // Cards in "My Domain"
}

export type ObjectiveKind = 'graceful' | 'disgraceful';
export type ObjectiveId =
    | `graceful_fewer_than_neighbor_${CardColor}`
    | 'graceful_killer_2'
    | 'graceful_espion_3'
    | 'graceful_guard_4'
    | 'graceful_noble_3'
    | `disgrace_family_negative_${CardColor}`
    | 'disgrace_deep_hatred'
    | 'disgrace_universal_despisal'
    | 'disgrace_dark_age'
    | 'disgrace_double_trouble';

export interface Objective {
    id: ObjectiveId;
    kind: ObjectiveKind;
    title: string;
    description: string;
    color?: CardColor;
}

export interface HistoryItem {
    id: string;
    message: string;

    // Optional structured fields for richer UI rendering.
    action?: 'start' | 'play' | 'kill' | 'kill_hidden' | 'kill_none';
    actorId?: string;
    actorName?: string;
    destination?: 'my_domain' | 'opponent_domain' | 'banquet_grace' | 'banquet_disgrace';
    targetName?: string;
    card?: {
        type?: CardType;
        color?: CardColor;
        hidden?: boolean;
    };
}

export interface GameState {
    players: Record<string, PlayerState>;
    // Keep legacy field for backwards-compat (UI no longer renders this as a pile).
    queens: Record<string, Card[]>;
    turn: string; // current player id
    started?: boolean;
    maxPlayers?: number;
    // Stable turn/seating order (server authoritative)
    playerOrder?: string[];
    turnPlays?: {
        banquet: boolean;
        self: boolean;
        opponent: boolean;
    };
    gameId?: string;
    revealHidden?: boolean;
    deckRemaining?: number;
    pendingAction?: {
        type: 'kill';
        affectedPlayerId: string;
        area: 'self_domain' | 'opponent_domain' | 'banquet';
        // For multiplayer: when a kill targets an opponent domain, this is the chosen opponent.
        targetPlayerId?: string;
        candidateCardIds: string[];
        // Only for banquet kills: hidden (Espion) cards are targetable by position only.
        hiddenTopCount?: number;
        hiddenBottomCount?: number;
    };
    banquet?: {
        byColor: Record<CardColor, {
            topVisible: number;
            bottomVisible: number;
            valueVisible: number;
            valueRevealed: number;
        }>;
        // Hidden (Espion) cards on the banquet reveal only their position counts, never identity.
        hiddenTopCount: number;
        hiddenBottomCount: number;
    };
    banquetDetails?: {
        byColor: Record<CardColor, {
            top: Card[];
            bottom: Card[];
        }>;
        hiddenTopCount?: number;
        hiddenBottomCount?: number;
    };

    // Domain summary for compact opponent views (does NOT include hidden spy colors).
    domainSummary?: Record<string, {
        byColorCounts: Record<CardColor, number>; // X2 counts as 2
        spiesCount: number; // spies (hidden or revealed)
    }>;
    scores?: Record<string, {
        total: number;
        byColor: Record<CardColor, number>;
        deckCounts: Record<CardColor, number>;
        objectivePoints: number;
    }>;

    // At end-of-game only: public objective met flags so score breakdown can explain objective points.
    objectiveResultsPublic?: Record<string, {
        gracefulMet: boolean;
        disgracefulMet: boolean;
    }>;
    winner?: string;

    // End-game standings (present when the game ends).
    finalRanking?: Array<{
        playerId: string;
        name: string;
        total: number;
    }>;

    // Public event feed: play-by-play messages (keeps Espion identity secret mid-game).
    history?: HistoryItem[];

    // Objectives are private: server only includes this for the requesting player.
    myObjectives?: {
        graceful: Objective;
        disgraceful: Objective;
        // Only revealed at end-game (to avoid leaking hidden info mid-game).
        gracefulMet?: boolean;
        disgracefulMet?: boolean;
    };
}

export interface CreateGameResponse {
    gameId: string;
}

export interface CreateGameRequest {
    playerName?: string;
    // Party size (2–4). Game starts automatically when this many players have joined.
    partySize?: number;
    // Multiplies the per-color distribution (1 = default deck).
    deckMultiplier?: number;
    // Advanced deck customization.
    deckOptions?: {
        // Toggle which families exist in the deck (default: all enabled).
        enabledColors?: Partial<Record<CardColor, boolean>>;
        // Per-color distribution (applied to each enabled color). Overrides deckMultiplier.
        perColorTypeCounts?: Partial<Record<CardType, number>>;
    };
}

export interface JoinGameRequest {
    gameId: string;
    playerName?: string;
}

export interface JoinedGameResponse {
    gameId: string;
}

export interface ServerEvents {
    'game_state': (state: GameState) => void;
    'game_error': (msg: string) => void;
    'game_created': (data: CreateGameResponse) => void;
    'joined_game': (data: JoinedGameResponse) => void;
}

export interface ClientEvents {
    'create_game': (data?: CreateGameRequest) => void;
    'join_game': (data: JoinGameRequest) => void;
    'leave_game': () => void;
    // If targetZone is 'opponent', targetPlayerId optionally selects which opponent (defaults to left neighbor).
    'play_card': (data: { cardId: string; targetZone: PlayZone; targetPlayerId?: string }) => void;
    'resolve_kill': (data: { cardId?: string; hiddenSign?: 'top' | 'bottom' }) => void;
    'cancel_kill': () => void;
}
