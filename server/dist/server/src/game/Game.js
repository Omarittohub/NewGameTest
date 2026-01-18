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
        this.queens = {}; // Keyed by color maybe? Or just a list of cards?
        // Prompt: "1 to Queen". Usually Queen has columns. Let's store as list and frontend sorts.
        // Actually, Courtisans has a "Queen's Table".
        // We'll store all cards played to Queen in a single list or mapped by color.
        // Mapped by color is easier for scoring.
        this.queensZone = [];
        this.currentTurn = '';
        this.playerIds = [];
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
    addPlayer(id) {
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
        // Deal 3 cards to each player to start
        this.playerIds.forEach(id => this.drawCards(id, 3));
        this.currentTurn = this.playerIds[0];
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
        const player = this.players[playerId];
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1)
            throw new Error("Card not in hand");
        // Check if zone already played to
        const currentMoves = this.moves[playerId];
        if (currentMoves[targetZone])
            throw new Error(`Already played to ${targetZone}`);
        // Execute Move
        const [card] = player.hand.splice(cardIndex, 1);
        // Logic for Target
        if (targetZone === 'queen') {
            this.queensZone.push(card);
            currentMoves.queen = card.id;
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
        // Check if turn complete
        if (currentMoves.queen && currentMoves.self && currentMoves.opponent) {
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
        // Check game over
        if (this.deck.length === 0 && this.players[this.currentTurn].hand.length === 0) {
            // Game Over
            // For now just stop or flag it.
        }
    }
    getState(forPlayerId) {
        // Clone state to avoid mutation and handle masking
        const state = {
            players: {},
            queens: { 'all': [...this.queensZone] }, // Simplified for now
            turn: this.currentTurn,
        };
        this.playerIds.forEach(pid => {
            const p = this.players[pid];
            // Mask hand if opponent
            const hand = pid === forPlayerId ? p.hand : p.hand.map(c => (Object.assign(Object.assign({}, c), { image: 'back.jpeg', type: 'N', color: 'W' }))); // Hide details
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
                // If card is Trader, is it hidden?
                // Usually Traders are face down until end of game.
                // So they are hidden for EVERYONE? Or just opponent?
                // Prompt says "mask its identity so the browser only receives...".
                // Let's assume Traders are ALWAYS hidden in domain until end game.
                // Or owner knows? "Opponent's domain... mask".
                // Let's mask it if `c.type === 'T'`.
                // BUT: The owner might need to know? 
                // "played Face Down". Usually means owner knows what they played, but once on board it's just a face down card.
                // Use `isHidden` flag in Card interface.
                if (c.type === 'T') {
                    return Object.assign(Object.assign({}, c), { image: 'back.jpeg', isHidden: true });
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
