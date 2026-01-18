"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
// Constants
const COLORS = ['DG', 'G', 'R', 'Y', 'B', 'W'];
const TYPES = ['N', 'X2', 'S', 'K', 'T'];
// Distribution (Heuristic based on standard gameplay feels)
const DISTRIBUTION = {
    'N': 7,
    'X2': 2,
    'S': 2,
    'K': 2,
    'T': 2
};
class Game {
    constructor() {
        this.deck = [];
        this.players = {};
        // Banquet piles: +1 (top) and -1 (bottom)
        this.banquetTop = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        this.banquetBottom = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        // Hidden (Espion) cards played to the banquet must not reveal sign/color mid-game.
        this.hiddenBanquet = [];
        this.currentTurn = '';
        this.playerIds = [];
        this.started = false;
        this.revealHidden = false;
        // Track current turn moves
        this.moves = {};
        this.initializeDeck();
    }
    initializeDeck() {
        this.deck = [];
        COLORS.forEach(color => {
            TYPES.forEach(type => {
                const count = DISTRIBUTION[type];
                for (let i = 0; i < count; i++) {
                    this.deck.push({
                        id: `${color}-${type}-${i}`,
                        color,
                        type,
                        ownerId: '', // Set when dealt
                        image: `${color}${type}.png`, // Matches filename e.g. DGK.png
                        isHidden: false
                    });
                }
            });
        });
        this.shuffleDeck();
    }
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }
    getPlayerCount() {
        return this.playerIds.length;
    }
    removePlayer(id) {
        const idx = this.playerIds.indexOf(id);
        if (idx !== -1) {
            this.playerIds.splice(idx, 1);
            delete this.players[id];
            delete this.moves[id];
            // If a player leaves mid-game, reset to a clean, joinable state.
            this.started = false;
            this.currentTurn = '';
            this.deck = [];
            this.revealHidden = false;
            this.banquetTop = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
            this.banquetBottom = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
            // Keep any remaining player connected, but clear their state.
            this.playerIds.forEach(pid => {
                this.players[pid].hand = [];
                this.players[pid].domain = [];
                this.moves[pid] = {};
            });
        }
    }
    addPlayer(id) {
        if (this.players[id])
            return true;
        if (this.playerIds.length >= 2)
            return false;
        this.playerIds.push(id);
        this.players[id] = {
            id,
            hand: [],
            domain: []
        };
        this.moves[id] = {};
        return true;
    }
    startGame() {
        if (this.playerIds.length < 2)
            return;
        this.initializeDeck();
        this.banquetTop = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        this.banquetBottom = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        this.hiddenBanquet = [];
        this.revealHidden = false;
        this.pendingKill = undefined;
        // Deal 3 cards to each player to start
        this.playerIds.forEach(id => this.drawCards(id, 3));
        this.currentTurn = this.playerIds[0];
        this.started = true;
    }
    drawCards(playerId, count) {
        for (let i = 0; i < count; i++) {
            const card = this.deck.pop();
            if (card) {
                card.ownerId = playerId;
                this.players[playerId].hand.push(card);
            }
        }
    }
    playCard(playerId, cardId, targetZone) {
        if (playerId !== this.currentTurn)
            throw new Error("Not your turn");
        // Killer resolution is optional and must never block gameplay.
        const player = this.players[playerId];
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1)
            throw new Error("Card not in hand");
        // Check if zone already played to
        const currentMoves = this.moves[playerId];
        if (targetZone === 'banquet_top' || targetZone === 'banquet_bottom') {
            if (currentMoves.banquet)
                throw new Error('Already played to banquet');
        }
        else {
            if (currentMoves[targetZone])
                throw new Error(`Already played to ${targetZone}`);
        }
        // Execute Move
        const [card] = player.hand.splice(cardIndex, 1);
        // Espion cards become hidden once they leave the hand (no info revealed mid-game)
        if (card.type === 'T' && !this.revealHidden) {
            card.isHidden = true;
        }
        // Logic for Target
        if (targetZone === 'banquet_top') {
            if (card.type === 'T' && !this.revealHidden) {
                this.hiddenBanquet.push({ card, sign: 'top' });
            }
            else {
                this.banquetTop[card.color].push(card);
            }
            currentMoves.banquet = card.id;
        }
        else if (targetZone === 'banquet_bottom') {
            if (card.type === 'T' && !this.revealHidden) {
                this.hiddenBanquet.push({ card, sign: 'bottom' });
            }
            else {
                this.banquetBottom[card.color].push(card);
            }
            currentMoves.banquet = card.id;
        }
        else if (targetZone === 'self') {
            player.domain.push(card);
            currentMoves.self = card.id;
        }
        else if (targetZone === 'opponent') {
            const opponentId = this.playerIds.find(id => id !== playerId);
            // Handle Trader logic: "Must play 3 cards...". "Trader... in opponent's domain".
            // We just put it there.
            this.players[opponentId].domain.push(card);
            currentMoves.opponent = card.id;
        }
        // Killer requires an explicit target selection.
        if (card.type === 'K') {
            this.queueKill(playerId, targetZone);
            // Killer does not block continuing the turn; it can be resolved or canceled.
        }
        // Check if turn complete
        if (currentMoves.banquet && currentMoves.self && currentMoves.opponent) {
            // If a kill is pending, the turn only advances after resolve/cancel.
            if (!this.pendingKill)
                this.endTurn();
        }
    }
    queueKill(playedBy, targetZone) {
        var _a, _b;
        // The player who played the killer always chooses whether to kill (or cancel).
        const affectedPlayerId = playedBy;
        const area = targetZone === 'opponent' ? 'opponent_domain'
            : targetZone === 'self' ? 'self_domain'
                : 'banquet';
        const candidateCardIds = [];
        let hiddenTopCount;
        let hiddenBottomCount;
        if (area === 'banquet') {
            Object.keys(this.banquetTop).forEach(color => {
                this.banquetTop[color].forEach(c => { if (c.type !== 'S')
                    candidateCardIds.push(c.id); });
                this.banquetBottom[color].forEach(c => { if (c.type !== 'S')
                    candidateCardIds.push(c.id); });
            });
            // Hidden banquet cards are targetable only by position (top/bottom), never by identity.
            hiddenTopCount = this.hiddenBanquet.filter(h => h.sign === 'top').length;
            hiddenBottomCount = this.hiddenBanquet.filter(h => h.sign === 'bottom').length;
        }
        else {
            const targetPlayerId = area === 'self_domain'
                ? affectedPlayerId
                : this.playerIds.find(id => id !== affectedPlayerId);
            const domain = (_b = (_a = this.players[targetPlayerId]) === null || _a === void 0 ? void 0 : _a.domain) !== null && _b !== void 0 ? _b : [];
            domain.forEach(c => {
                if (c.type !== 'S')
                    candidateCardIds.push(c.id);
            });
        }
        this.pendingKill = { affectedPlayerId, area, candidateCardIds, hiddenTopCount, hiddenBottomCount };
    }
    resolveKill(actingPlayerId, data) {
        var _a, _b, _c, _d;
        if (!this.pendingKill)
            throw new Error('No pending kill');
        const pendingKill = this.pendingKill;
        if (actingPlayerId !== pendingKill.affectedPlayerId)
            throw new Error('Not your decision');
        const cardId = data.cardId;
        const hiddenSign = data.hiddenSign;
        if (!cardId && !hiddenSign)
            throw new Error('No kill target provided');
        if (cardId && !pendingKill.candidateCardIds.includes(cardId))
            throw new Error('Invalid kill target');
        const area = pendingKill.area;
        if (area === 'banquet') {
            if (!cardId) {
                // Kill a hidden banquet card by position without revealing identity.
                const idx = this.hiddenBanquet.findIndex(h => h.sign === hiddenSign);
                if (idx === -1)
                    throw new Error('No hidden card at that position');
                this.hiddenBanquet.splice(idx, 1);
                this.pendingKill = undefined;
                const turnMoves = (_a = this.moves[this.currentTurn]) !== null && _a !== void 0 ? _a : {};
                if (turnMoves.banquet && turnMoves.self && turnMoves.opponent) {
                    this.endTurn();
                }
                return;
            }
            // Try visible banquet
            let removed = false;
            Object.keys(this.banquetTop).forEach(color => {
                if (removed)
                    return;
                const ti = this.banquetTop[color].findIndex(c => c.id === cardId);
                if (ti !== -1) {
                    this.banquetTop[color].splice(ti, 1);
                    removed = true;
                    return;
                }
                const bi = this.banquetBottom[color].findIndex(c => c.id === cardId);
                if (bi !== -1) {
                    this.banquetBottom[color].splice(bi, 1);
                    removed = true;
                    return;
                }
            });
            if (!removed)
                throw new Error('Target not found');
        }
        else {
            const targetPlayerId = area === 'self_domain'
                ? pendingKill.affectedPlayerId
                : this.playerIds.find(id => id !== pendingKill.affectedPlayerId);
            const domain = (_c = (_b = this.players[targetPlayerId]) === null || _b === void 0 ? void 0 : _b.domain) !== null && _c !== void 0 ? _c : [];
            const idx = domain.findIndex(c => c.id === cardId);
            if (idx === -1)
                throw new Error('Target not found');
            if (domain[idx].type === 'S')
                throw new Error('Shields cannot be killed');
            domain.splice(idx, 1);
        }
        this.pendingKill = undefined;
        // If the active player already completed their 3 plays, end the turn now.
        const turnMoves = (_d = this.moves[this.currentTurn]) !== null && _d !== void 0 ? _d : {};
        if (turnMoves.banquet && turnMoves.self && turnMoves.opponent) {
            this.endTurn();
        }
    }
    cancelKill(actingPlayerId) {
        var _a;
        if (!this.pendingKill)
            return;
        if (actingPlayerId !== this.pendingKill.affectedPlayerId)
            throw new Error('Not your decision');
        this.pendingKill = undefined;
        const turnMoves = (_a = this.moves[this.currentTurn]) !== null && _a !== void 0 ? _a : {};
        if (turnMoves.banquet && turnMoves.self && turnMoves.opponent) {
            this.endTurn();
        }
    }
    endTurn() {
        // Clear moves
        this.moves[this.currentTurn] = {};
        // Draw 3 cards for next turn for the CURRENT player (to refill for their NEXT turn? Or does the next player play?)
        // Usually: P1 plays 3, draws 3. P2 plays 3, draws 3.
        this.drawCards(this.currentTurn, 3);
        // Switch turn
        const idx = this.playerIds.indexOf(this.currentTurn);
        this.currentTurn = this.playerIds[(idx + 1) % this.playerIds.length];
        this.checkGameOver();
    }
    checkGameOver() {
        if (!this.started)
            return;
        if (this.deck.length > 0)
            return;
        const anyCardsLeftInHands = this.playerIds.some(pid => { var _a, _b; return ((_b = (_a = this.players[pid]) === null || _a === void 0 ? void 0 : _a.hand) === null || _b === void 0 ? void 0 : _b.length) > 0; });
        if (anyCardsLeftInHands)
            return;
        // End of game: reveal hidden (espion) cards
        this.revealHidden = true;
        this.pendingKill = undefined;
        // Restore their real images for scoring/UI
        this.playerIds.forEach(pid => {
            this.players[pid].domain.forEach(c => {
                if (c.type === 'T') {
                    c.isHidden = false;
                    c.image = `${c.color}${c.type}.png`;
                }
            });
        });
        Object.keys(this.banquetTop).forEach(color => {
            this.banquetTop[color].forEach(c => {
                if (c.type === 'T') {
                    c.isHidden = false;
                    c.image = `${c.color}${c.type}.png`;
                }
            });
            this.banquetBottom[color].forEach(c => {
                if (c.type === 'T') {
                    c.isHidden = false;
                    c.image = `${c.color}${c.type}.png`;
                }
            });
        });
        // Reveal hidden banquet cards by moving them into their real piles
        this.hiddenBanquet.forEach(h => {
            h.card.isHidden = false;
            h.card.image = `${h.card.color}${h.card.type}.png`;
            if (h.sign === 'top')
                this.banquetTop[h.card.color].push(h.card);
            else
                this.banquetBottom[h.card.color].push(h.card);
        });
        this.hiddenBanquet = [];
    }
    computeBanquetSummary() {
        const byColor = {
            DG: { topVisible: 0, bottomVisible: 0, valueVisible: 0, valueRevealed: 0 },
            G: { topVisible: 0, bottomVisible: 0, valueVisible: 0, valueRevealed: 0 },
            R: { topVisible: 0, bottomVisible: 0, valueVisible: 0, valueRevealed: 0 },
            Y: { topVisible: 0, bottomVisible: 0, valueVisible: 0, valueRevealed: 0 },
            B: { topVisible: 0, bottomVisible: 0, valueVisible: 0, valueRevealed: 0 },
            W: { topVisible: 0, bottomVisible: 0, valueVisible: 0, valueRevealed: 0 },
        };
        const cardWeight = (c) => (c.type === 'X2' ? 2 : 1);
        Object.keys(this.banquetTop).forEach(color => {
            const top = this.banquetTop[color];
            const bottom = this.banquetBottom[color];
            // Hidden cards are not included in visible banquet scoring at all.
            const topVisibleCards = top.filter(c => !c.isHidden);
            const bottomVisibleCards = bottom.filter(c => !c.isHidden);
            const topVisible = topVisibleCards.length;
            const bottomVisible = bottomVisibleCards.length;
            const valueVisible = topVisibleCards.reduce((s, c) => s + cardWeight(c), 0)
                - bottomVisibleCards.reduce((s, c) => s + cardWeight(c), 0);
            const valueRevealed = top.reduce((s, c) => s + cardWeight(c), 0)
                - bottom.reduce((s, c) => s + cardWeight(c), 0);
            byColor[color] = {
                topVisible,
                bottomVisible,
                valueVisible,
                valueRevealed,
            };
        });
        return {
            byColor,
            hiddenTopCount: this.hiddenBanquet.filter(h => h.sign === 'top').length,
            hiddenBottomCount: this.hiddenBanquet.filter(h => h.sign === 'bottom').length,
        };
    }
    computeBanquetDetails() {
        const byColor = {
            DG: { top: [], bottom: [] },
            G: { top: [], bottom: [] },
            R: { top: [], bottom: [] },
            Y: { top: [], bottom: [] },
            B: { top: [], bottom: [] },
            W: { top: [], bottom: [] },
        };
        Object.keys(this.banquetTop).forEach(color => {
            byColor[color] = {
                top: this.banquetTop[color].filter(c => !c.isHidden),
                bottom: this.banquetBottom[color].filter(c => !c.isHidden),
            };
        });
        return {
            byColor,
            hiddenTopCount: this.hiddenBanquet.filter(h => h.sign === 'top').length,
            hiddenBottomCount: this.hiddenBanquet.filter(h => h.sign === 'bottom').length,
        };
    }
    computeScores(banquetSummary) {
        var _a, _b;
        const scores = {};
        const colors = ['DG', 'G', 'R', 'Y', 'B', 'W'];
        for (const pid of this.playerIds) {
            const byColor = { DG: 0, G: 0, R: 0, Y: 0, B: 0, W: 0 };
            const deckCounts = { DG: 0, G: 0, R: 0, Y: 0, B: 0, W: 0 };
            const domain = (_b = (_a = this.players[pid]) === null || _a === void 0 ? void 0 : _a.domain) !== null && _b !== void 0 ? _b : [];
            for (const card of domain) {
                if (card.type === 'T' && !this.revealHidden)
                    continue;
                // X2 counts as two cards of that color; everything else counts as one.
                deckCounts[card.color] += card.type === 'X2' ? 2 : 1;
            }
            let total = 0;
            for (const color of colors) {
                const value = this.revealHidden ? banquetSummary.byColor[color].valueRevealed : banquetSummary.byColor[color].valueVisible;
                const score = value * deckCounts[color];
                byColor[color] = score;
                total += score;
            }
            scores[pid] = { total, byColor, deckCounts };
        }
        return scores;
    }
    getState(forPlayerId) {
        var _a;
        // Clone state to avoid mutation and handle masking
        const turnMoves = this.currentTurn ? (_a = this.moves[this.currentTurn]) !== null && _a !== void 0 ? _a : {} : {};
        const banquet = this.computeBanquetSummary();
        const banquetDetails = this.computeBanquetDetails();
        const scores = this.computeScores(banquet);
        const state = {
            players: {},
            queens: { 'all': [] },
            turn: this.currentTurn,
            turnPlays: {
                banquet: Boolean(turnMoves.banquet),
                self: Boolean(turnMoves.self),
                opponent: Boolean(turnMoves.opponent),
            },
            banquet,
            banquetDetails,
            scores,
            revealHidden: this.revealHidden,
            deckRemaining: this.deck.length,
            pendingAction: this.pendingKill
                ? {
                    type: 'kill',
                    affectedPlayerId: this.pendingKill.affectedPlayerId,
                    area: this.pendingKill.area,
                    candidateCardIds: [...this.pendingKill.candidateCardIds],
                    hiddenTopCount: this.pendingKill.hiddenTopCount,
                    hiddenBottomCount: this.pendingKill.hiddenBottomCount,
                }
                : undefined,
        };
        this.playerIds.forEach(pid => {
            const p = this.players[pid];
            // Mask hand if opponent
            const hand = pid === forPlayerId
                ? p.hand
                : p.hand.map(c => (Object.assign(Object.assign({}, c), { image: 'back.jpeg', type: 'N', color: 'W' })));
            // Mask domain cards if Trader?
            // "if a card is a "Trader" in an opponent's domain, mask its identity"
            // Wait: "Trader Logic: When sending state to clients, if a card is a "Trader" in an opponent's domain, mask its identity"
            // If I am P1, looking at P2's domain. If P2 has a Trader, I see back.jpeg?
            // Or: If P1 played a Trader into P2's domain. P2 sees back.jpeg?
            // Standard: Traders are played face down.
            // So: Any Trader in a domain is face down? Or just when played to opponent?
            // Prompt: "If a card is a "Trader" in an opponent's domain... browser only receives hidden".
            // This implies if I am looking at Opponent Domain, and there is a Trader, it is hidden.
            // But who is the "Opponent"?
            // If P1 looks at P1's domain: Sees everything.
            // If P1 looks at P2's domain:
            // Sees normal cards.
            // Sees Traders as Hidden?
            const domain = p.domain.map(c => {
                // Espion cards stay hidden until end-game.
                if (c.type === 'T' && !this.revealHidden) {
                    return Object.assign(Object.assign({}, c), { image: 'back.jpeg', isHidden: true, type: 'N', color: 'W' });
                }
                return c;
            });
            state.players[pid] = {
                id: pid,
                hand: hand,
                domain: domain
            };
        });
        return state;
    }
}
exports.Game = Game;
