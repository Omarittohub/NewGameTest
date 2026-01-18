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
    hand: Card[];
    domain: Card[]; // Cards in "My Domain"
}

export interface GameState {
    players: Record<string, PlayerState>;
    // Keep legacy field for backwards-compat (UI no longer renders this as a pile).
    queens: Record<string, Card[]>;
    turn: string; // current player id
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
    scores?: Record<string, {
        total: number;
        byColor: Record<CardColor, number>;
        deckCounts: Record<CardColor, number>;
    }>;
    winner?: string;
}

export interface CreateGameResponse {
    gameId: string;
}

export interface JoinGameRequest {
    gameId: string;
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
    'create_game': () => void;
    'join_game': (data: JoinGameRequest) => void;
    'leave_game': () => void;
    'play_card': (data: { cardId: string, targetZone: PlayZone }) => void;
    'resolve_kill': (data: { cardId?: string; hiddenSign?: 'top' | 'bottom' }) => void;
    'cancel_kill': () => void;
}
