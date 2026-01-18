"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
// Constants
const COLORS = ['DG', 'G', 'R', 'Y', 'B', 'W'];
const TYPES = ['N', 'X2', 'S', 'K', 'T'];
const COLOR_FULL_NAME = {
    DG: 'Dark Green',
    G: 'Green',
    R: 'Red',
    Y: 'Yellow',
    B: 'Blue',
    W: 'White',
};
const TYPE_FULL_NAME = {
    N: 'Normal',
    X2: '×2',
    S: 'Shield',
    K: 'Killer',
    T: 'Spy',
};
// Distribution (Heuristic based on standard gameplay feels)
const DISTRIBUTION = {
    'N': 4,
    'X2': 2,
    'S': 2,
    'K': 2,
    'T': 2
};
const OBJECTIVE_POINTS_EACH = 3;
class Game {
    constructor(options) {
        var _a, _b;
        this.deck = [];
        this.players = {};
        this.objectives = {};
        // Banquet piles: +1 (top) and -1 (bottom)
        this.banquetTop = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        this.banquetBottom = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        // Hidden (Espion) cards played to the banquet must not reveal sign/color mid-game.
        this.hiddenBanquet = [];
        this.currentTurn = '';
        this.playerIds = [];
        this.started = false;
        this.revealHidden = false;
        this.historySeq = 0;
        this.history = [];
        // Track current turn moves
        this.moves = {};
        const mp = Number((_a = options === null || options === void 0 ? void 0 : options.maxPlayers) !== null && _a !== void 0 ? _a : 2);
        this.maxPlayers = Number.isFinite(mp) ? Math.max(2, Math.min(4, Math.floor(mp))) : 2;
        const mult = Number((_b = options === null || options === void 0 ? void 0 : options.deckMultiplier) !== null && _b !== void 0 ? _b : 1);
        this.deckMultiplier = Number.isFinite(mult) ? Math.max(1, Math.min(5, Math.floor(mult))) : 1;
        this.deckOptions = options === null || options === void 0 ? void 0 : options.deckOptions;
        this.initializeDeck();
    }
    getMaxPlayers() {
        return this.maxPlayers;
    }
    leftNeighborId(playerId) {
        const idx = this.playerIds.indexOf(playerId);
        if (idx === -1 || this.playerIds.length < 2)
            return undefined;
        return this.playerIds[(idx + 1) % this.playerIds.length];
    }
    displayName(playerId) {
        var _a, _b;
        const n = ((_b = (_a = this.players[playerId]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '').trim();
        if (n)
            return n;
        const idx = this.playerIds.indexOf(playerId);
        return idx >= 0 ? `Player ${idx + 1}` : 'Player';
    }
    pushHistory(item) {
        this.historySeq += 1;
        this.history.push(Object.assign({ id: String(this.historySeq) }, item));
        // Avoid unbounded growth
        if (this.history.length > 80)
            this.history.splice(0, this.history.length - 80);
    }
    zoneLabel(playedBy, targetZone, targetPlayerId) {
        if (targetZone === 'self')
            return 'their domain';
        if (targetZone === 'opponent') {
            const opponentId = targetPlayerId !== null && targetPlayerId !== void 0 ? targetPlayerId : this.leftNeighborId(playedBy);
            const oppName = opponentId ? this.displayName(opponentId) : 'opponent';
            return `${oppName}'s domain`;
        }
        if (targetZone === 'banquet_top')
            return 'Grace (+1) on the Banquet';
        return 'Disgrace (−1) on the Banquet';
    }
    cardNameForHistory(card) {
        // Keep Espion identity secret mid-game (no color/type leak beyond "Spy").
        if (card.type === 'T' && !this.revealHidden)
            return 'a Spy card';
        const color = COLOR_FULL_NAME[card.color];
        const type = TYPE_FULL_NAME[card.type];
        return card.type === 'K' || card.type === 'S'
            ? `a ${color} ${type} card`
            : `a ${color} ${type} card`;
    }
    initializeDeck() {
        var _a, _b;
        this.deck = [];
        const enabledColors = (_a = this.deckOptions) === null || _a === void 0 ? void 0 : _a.enabledColors;
        const colors = enabledColors
            ? COLORS.filter(c => enabledColors[c] !== false)
            : COLORS;
        const overrideCounts = (_b = this.deckOptions) === null || _b === void 0 ? void 0 : _b.perColorTypeCounts;
        const clampCount = (n) => {
            if (!Number.isFinite(n))
                return 0;
            return Math.max(0, Math.min(50, Math.floor(n)));
        };
        colors.forEach(color => {
            TYPES.forEach(type => {
                const perColorBase = overrideCounts === null || overrideCounts === void 0 ? void 0 : overrideCounts[type];
                const count = typeof perColorBase === 'number'
                    ? clampCount(perColorBase)
                    : (DISTRIBUTION[type] * this.deckMultiplier);
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
            this.objectiveResults = undefined;
            this.historySeq = 0;
            this.history = [];
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
    addPlayer(id, name) {
        if (this.players[id])
            return true;
        if (this.started)
            return false;
        if (this.playerIds.length >= this.maxPlayers)
            return false;
        this.playerIds.push(id);
        this.players[id] = {
            id,
            name,
            hand: [],
            domain: []
        };
        this.moves[id] = {};
        return true;
    }
    setPlayerName(id, name) {
        const n = (name !== null && name !== void 0 ? name : '').trim();
        if (!this.players[id])
            return;
        this.players[id].name = n ? n.slice(0, 20) : undefined;
    }
    startGame() {
        if (this.playerIds.length < 2)
            return;
        if (this.started)
            return;
        this.initializeDeck();
        this.banquetTop = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        this.banquetBottom = { DG: [], G: [], R: [], Y: [], B: [], W: [] };
        this.hiddenBanquet = [];
        this.revealHidden = false;
        this.pendingKill = undefined;
        this.objectiveResults = undefined;
        this.historySeq = 0;
        this.history = [];
        this.assignObjectives();
        // Deal 3 cards to each player to start
        this.playerIds.forEach(id => this.drawCards(id, 3));
        this.currentTurn = this.playerIds[0];
        this.started = true;
        this.pushHistory({ action: 'start', message: 'Game started.' });
    }
    assignObjectives() {
        const makeGraceful = () => {
            const byColor = ['DG', 'G', 'R', 'Y', 'B', 'W'].map((c) => ({
                id: `graceful_fewer_than_neighbor_${c}`,
                kind: 'graceful',
                title: `Fewer than Neighbor (${COLOR_FULL_NAME[c]})`,
                description: `Have fewer ${COLOR_FULL_NAME[c]} cards in your collection than the player to your left.`,
                color: c,
            }));
            return [
                ...byColor,
                {
                    id: 'graceful_killer_2',
                    kind: 'graceful',
                    title: 'The Killer Objective',
                    description: 'Have at least 2 Killer cards in your collection.',
                },
                {
                    id: 'graceful_espion_3',
                    kind: 'graceful',
                    title: 'The Espion Objective',
                    description: 'Have at least 3 Espion cards in your collection.',
                },
                {
                    id: 'graceful_guard_4',
                    kind: 'graceful',
                    title: 'The Guard Objective',
                    description: 'Have at least 4 Shield (Guard) cards in your collection.',
                },
                {
                    id: 'graceful_noble_3',
                    kind: 'graceful',
                    title: 'The Noble Objective',
                    description: 'Have at least 3 Noble cards in your collection.',
                },
            ];
        };
        const makeDisgraceful = () => {
            const byColor = ['DG', 'G', 'R', 'Y', 'B', 'W'].map((c) => ({
                id: `disgrace_family_negative_${c}`,
                kind: 'disgraceful',
                title: `Family in Disgrace (${COLOR_FULL_NAME[c]})`,
                description: `${COLOR_FULL_NAME[c]} must have a negative final value on the Banquet.`,
                color: c,
            }));
            return [
                ...byColor,
                {
                    id: 'disgrace_deep_hatred',
                    kind: 'disgraceful',
                    title: 'Deep Hatred',
                    description: 'At least one family has 5 or more cards in the negative section of the Banquet.',
                },
                {
                    id: 'disgrace_universal_despisal',
                    kind: 'disgraceful',
                    title: 'Universal Despisal',
                    description: 'Every family has at least one card in the negative section of the Banquet.',
                },
                {
                    id: 'disgrace_dark_age',
                    kind: 'disgraceful',
                    title: 'Dark Age',
                    description: 'At most 3 families are enlightened (positive on the Banquet).',
                },
                {
                    id: 'disgrace_double_trouble',
                    kind: 'disgraceful',
                    title: 'Double Trouble',
                    description: 'At least 2 different families are in disgrace (negative on the Banquet).',
                },
            ];
        };
        const shuffle = (arr) => {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };
        const graceful = shuffle(makeGraceful());
        const disgraceful = shuffle(makeDisgraceful());
        this.objectives = {};
        this.playerIds.forEach((pid, idx) => {
            this.objectives[pid] = {
                graceful: graceful[idx % graceful.length],
                disgraceful: disgraceful[idx % disgraceful.length],
            };
        });
    }
    evaluateObjectiveAtEnd(playerId, obj) {
        var _a, _b, _c, _d, _e, _f;
        const domain = (_b = (_a = this.players[playerId]) === null || _a === void 0 ? void 0 : _a.domain) !== null && _b !== void 0 ? _b : [];
        const countType = (t) => domain.filter(c => c.type === t).length;
        const countNoble = () => domain.filter(c => c.type === 'N' || c.type === 'X2').length;
        const colors = ['DG', 'G', 'R', 'Y', 'B', 'W'];
        const banquetValueByColor = { DG: 0, G: 0, R: 0, Y: 0, B: 0, W: 0 };
        const bottomCountByColor = { DG: 0, G: 0, R: 0, Y: 0, B: 0, W: 0 };
        const weight = (c) => (c.type === 'X2' ? 2 : 1);
        for (const c of colors) {
            banquetValueByColor[c] =
                this.banquetTop[c].reduce((s, card) => s + weight(card), 0)
                    - this.banquetBottom[c].reduce((s, card) => s + weight(card), 0);
            bottomCountByColor[c] = this.banquetBottom[c].length;
        }
        switch (obj.id) {
            case 'graceful_killer_2':
                return countType('K') >= 2;
            case 'graceful_espion_3':
                return countType('T') >= 3;
            case 'graceful_guard_4':
                return countType('S') >= 4;
            case 'graceful_noble_3':
                return countNoble() >= 3;
            case 'disgrace_deep_hatred':
                return colors.some(c => bottomCountByColor[c] >= 5);
            case 'disgrace_universal_despisal':
                return colors.every(c => bottomCountByColor[c] >= 1);
            case 'disgrace_dark_age':
                return colors.filter(c => banquetValueByColor[c] > 0).length <= 3;
            case 'disgrace_double_trouble':
                return colors.filter(c => banquetValueByColor[c] < 0).length >= 2;
            default:
                break;
        }
        if (obj.id.startsWith('graceful_fewer_than_neighbor_')) {
            const color = obj.color;
            if (!color)
                return false;
            const idx = this.playerIds.indexOf(playerId);
            if (idx === -1 || this.playerIds.length < 2)
                return false;
            const leftNeighborId = this.playerIds[(idx + 1) % this.playerIds.length];
            const myCount = ((_d = (_c = this.players[playerId]) === null || _c === void 0 ? void 0 : _c.domain) !== null && _d !== void 0 ? _d : []).filter(c => c.color === color).length;
            const neighborCount = ((_f = (_e = this.players[leftNeighborId]) === null || _e === void 0 ? void 0 : _e.domain) !== null && _f !== void 0 ? _f : []).filter(c => c.color === color).length;
            return myCount < neighborCount;
        }
        if (obj.id.startsWith('disgrace_family_negative_')) {
            const color = obj.color;
            if (!color)
                return false;
            return banquetValueByColor[color] < 0;
        }
        return false;
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
    playCard(playerId, cardId, targetZone, targetPlayerId) {
        if (!this.started)
            throw new Error('Game has not started yet');
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
            const opponentId = (targetPlayerId && this.players[targetPlayerId] && targetPlayerId !== playerId)
                ? targetPlayerId
                : this.leftNeighborId(playerId);
            if (!opponentId)
                throw new Error('No opponent available');
            // Handle Trader logic: "Must play 3 cards...". "Trader... in opponent's domain".
            // We just put it there.
            this.players[opponentId].domain.push(card);
            currentMoves.opponent = card.id;
        }
        // History message (Spy cards stay generic mid-game)
        const actor = this.displayName(playerId);
        const where = this.zoneLabel(playerId, targetZone, targetPlayerId);
        const destination = targetZone === 'self' ? 'my_domain'
            : targetZone === 'opponent' ? 'opponent_domain'
                : targetZone === 'banquet_top' ? 'banquet_grace'
                    : 'banquet_disgrace';
        const opponentId = targetZone === 'opponent'
            ? ((targetPlayerId && this.players[targetPlayerId] && targetPlayerId !== playerId) ? targetPlayerId : this.leftNeighborId(playerId))
            : undefined;
        const targetName = opponentId ? this.displayName(opponentId) : undefined;
        if (card.type === 'T' && !this.revealHidden) {
            this.pushHistory({
                action: 'play',
                actorId: playerId,
                actorName: actor,
                destination,
                targetName,
                card: { type: 'T', hidden: true },
                message: `${actor} played a Spy card in ${where}.`,
            });
        }
        else if (card.type === 'K' && (targetZone === 'banquet_top' || targetZone === 'banquet_bottom')) {
            this.pushHistory({
                action: 'play',
                actorId: playerId,
                actorName: actor,
                destination,
                targetName,
                card: { type: 'K', color: card.color },
                message: `${actor} put a Killer in ${where}.`,
            });
        }
        else {
            const hiddenSpy = card.type === 'T' && !this.revealHidden;
            this.pushHistory({
                action: 'play',
                actorId: playerId,
                actorName: actor,
                destination,
                targetName,
                card: hiddenSpy ? { type: 'T', hidden: true } : { type: card.type, color: card.color },
                message: `${actor} put ${this.cardNameForHistory(card)} in ${where}.`,
            });
        }
        // Killer requires an explicit target selection.
        if (card.type === 'K') {
            this.queueKill(playerId, targetZone, opponentId);
            // Killer does not block continuing the turn; it can be resolved or canceled.
        }
        // Check if turn complete
        if (currentMoves.banquet && currentMoves.self && currentMoves.opponent) {
            // If a kill is pending, the turn only advances after resolve/cancel.
            if (!this.pendingKill)
                this.endTurn();
        }
    }
    queueKill(playedBy, targetZone, opponentTargetPlayerId) {
        var _a, _b, _c;
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
                : ((_a = opponentTargetPlayerId !== null && opponentTargetPlayerId !== void 0 ? opponentTargetPlayerId : this.leftNeighborId(affectedPlayerId)) !== null && _a !== void 0 ? _a : this.playerIds.find(id => id !== affectedPlayerId));
            const domain = (_c = (_b = this.players[targetPlayerId]) === null || _b === void 0 ? void 0 : _b.domain) !== null && _c !== void 0 ? _c : [];
            domain.forEach(c => {
                if (c.type !== 'S')
                    candidateCardIds.push(c.id);
            });
        }
        this.pendingKill = { affectedPlayerId, area, targetPlayerId: area === 'opponent_domain' ? opponentTargetPlayerId : undefined, candidateCardIds, hiddenTopCount, hiddenBottomCount };
    }
    resolveKill(actingPlayerId, data) {
        var _a, _b, _c, _d, _e, _f;
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
        const actor = this.displayName(actingPlayerId);
        let killedCard;
        if (area === 'banquet') {
            if (!cardId) {
                // Kill a hidden banquet card by position without revealing identity.
                const idx = this.hiddenBanquet.findIndex(h => h.sign === hiddenSign);
                if (idx === -1)
                    throw new Error('No hidden card at that position');
                this.hiddenBanquet.splice(idx, 1);
                this.pendingKill = undefined;
                const where = hiddenSign === 'top' ? 'Grace (+1) on the Banquet' : 'Disgrace (−1) on the Banquet';
                this.pushHistory({
                    action: 'kill_hidden',
                    actorId: actingPlayerId,
                    actorName: actor,
                    destination: hiddenSign === 'top' ? 'banquet_grace' : 'banquet_disgrace',
                    card: { hidden: true },
                    message: `${actor} destroyed a hidden card from ${where}.`,
                });
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
                    killedCard = this.banquetTop[color][ti];
                    this.banquetTop[color].splice(ti, 1);
                    removed = true;
                    return;
                }
                const bi = this.banquetBottom[color].findIndex(c => c.id === cardId);
                if (bi !== -1) {
                    killedCard = this.banquetBottom[color][bi];
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
                : ((_c = (_b = pendingKill.targetPlayerId) !== null && _b !== void 0 ? _b : this.leftNeighborId(pendingKill.affectedPlayerId)) !== null && _c !== void 0 ? _c : this.playerIds.find(id => id !== pendingKill.affectedPlayerId));
            const domain = (_e = (_d = this.players[targetPlayerId]) === null || _d === void 0 ? void 0 : _d.domain) !== null && _e !== void 0 ? _e : [];
            const idx = domain.findIndex(c => c.id === cardId);
            if (idx === -1)
                throw new Error('Target not found');
            if (domain[idx].type === 'S')
                throw new Error('Shields cannot be killed');
            killedCard = domain[idx];
            domain.splice(idx, 1);
        }
        if (killedCard) {
            if (killedCard.type === 'T' && !this.revealHidden) {
                this.pushHistory({
                    action: 'kill',
                    actorId: actingPlayerId,
                    actorName: actor,
                    card: { type: 'T', hidden: true },
                    message: `${actor} killed a Spy card.`,
                });
            }
            else {
                const color = COLOR_FULL_NAME[killedCard.color];
                const type = TYPE_FULL_NAME[killedCard.type];
                this.pushHistory({
                    action: 'kill',
                    actorId: actingPlayerId,
                    actorName: actor,
                    card: { type: killedCard.type, color: killedCard.color },
                    message: `${actor} killed a ${color} ${type} card.`,
                });
            }
        }
        this.pendingKill = undefined;
        // If the active player already completed their 3 plays, end the turn now.
        const turnMoves = (_f = this.moves[this.currentTurn]) !== null && _f !== void 0 ? _f : {};
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
        const actor = this.displayName(actingPlayerId);
        this.pushHistory({
            action: 'kill_none',
            actorId: actingPlayerId,
            actorName: actor,
            message: `${actor} didn't kill anyone.`,
        });
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
        // Evaluate objectives (only once, after reveal)
        this.objectiveResults = {};
        this.playerIds.forEach(pid => {
            const obj = this.objectives[pid];
            if (!obj)
                return;
            this.objectiveResults[pid] = {
                gracefulMet: this.evaluateObjectiveAtEnd(pid, obj.graceful),
                disgracefulMet: this.evaluateObjectiveAtEnd(pid, obj.disgraceful),
            };
        });
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
        var _a, _b, _c, _d, _e, _f;
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
            const objectivePoints = this.revealHidden
                ? ((((_d = (_c = this.objectiveResults) === null || _c === void 0 ? void 0 : _c[pid]) === null || _d === void 0 ? void 0 : _d.gracefulMet) ? OBJECTIVE_POINTS_EACH : 0)
                    + (((_f = (_e = this.objectiveResults) === null || _e === void 0 ? void 0 : _e[pid]) === null || _f === void 0 ? void 0 : _f.disgracefulMet) ? OBJECTIVE_POINTS_EACH : 0))
                : 0;
            total += objectivePoints;
            scores[pid] = { total, byColor, deckCounts, objectivePoints };
        }
        return scores;
    }
    computeDomainSummary() {
        var _a, _b;
        const summary = {};
        const zero = { DG: 0, G: 0, R: 0, Y: 0, B: 0, W: 0 };
        const weight = (c) => (c.type === 'X2' ? 2 : 1);
        for (const pid of this.playerIds) {
            const byColorCounts = Object.assign({}, zero);
            let spiesCount = 0;
            const domain = (_b = (_a = this.players[pid]) === null || _a === void 0 ? void 0 : _a.domain) !== null && _b !== void 0 ? _b : [];
            for (const c of domain) {
                if (c.type === 'T') {
                    spiesCount += 1;
                    continue; // keep spies out of color buckets to avoid leaking hidden spy colors
                }
                byColorCounts[c.color] += weight(c);
            }
            summary[pid] = { byColorCounts, spiesCount };
        }
        return summary;
    }
    getState(forPlayerId) {
        var _a, _b, _c, _d, _e, _f, _g;
        // Clone state to avoid mutation and handle masking
        const turnMoves = this.currentTurn ? (_a = this.moves[this.currentTurn]) !== null && _a !== void 0 ? _a : {} : {};
        const banquet = this.computeBanquetSummary();
        const banquetDetails = this.computeBanquetDetails();
        const scores = this.computeScores(banquet);
        const domainSummary = this.computeDomainSummary();
        const playerOrder = [...this.playerIds];
        const finalRanking = this.revealHidden
            ? playerOrder
                .map((pid) => {
                var _a, _b;
                return ({
                    playerId: pid,
                    name: this.displayName(pid),
                    total: (_b = (_a = scores === null || scores === void 0 ? void 0 : scores[pid]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0,
                });
            })
                .sort((a, b) => b.total - a.total)
            : undefined;
        const winner = (_b = finalRanking === null || finalRanking === void 0 ? void 0 : finalRanking[0]) === null || _b === void 0 ? void 0 : _b.playerId;
        const state = {
            players: {},
            queens: { 'all': [] },
            turn: this.currentTurn,
            started: this.started,
            maxPlayers: this.maxPlayers,
            playerOrder,
            turnPlays: {
                banquet: Boolean(turnMoves.banquet),
                self: Boolean(turnMoves.self),
                opponent: Boolean(turnMoves.opponent),
            },
            banquet,
            banquetDetails,
            domainSummary,
            scores,
            revealHidden: this.revealHidden,
            deckRemaining: this.deck.length,
            objectiveResultsPublic: this.revealHidden ? ((_c = this.objectiveResults) !== null && _c !== void 0 ? _c : undefined) : undefined,
            pendingAction: this.pendingKill
                ? {
                    type: 'kill',
                    affectedPlayerId: this.pendingKill.affectedPlayerId,
                    area: this.pendingKill.area,
                    targetPlayerId: this.pendingKill.targetPlayerId,
                    candidateCardIds: [...this.pendingKill.candidateCardIds],
                    hiddenTopCount: this.pendingKill.hiddenTopCount,
                    hiddenBottomCount: this.pendingKill.hiddenBottomCount,
                }
                : undefined,
            history: [...this.history],
            winner,
            finalRanking,
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
                name: p.name,
                hand: hand,
                domain: domain
            };
        });
        // Private objectives: only the requesting player sees them.
        const myObj = this.objectives[forPlayerId];
        if (myObj) {
            state.myObjectives = {
                graceful: myObj.graceful,
                disgraceful: myObj.disgraceful,
                gracefulMet: this.revealHidden ? (_e = (_d = this.objectiveResults) === null || _d === void 0 ? void 0 : _d[forPlayerId]) === null || _e === void 0 ? void 0 : _e.gracefulMet : undefined,
                disgracefulMet: this.revealHidden ? (_g = (_f = this.objectiveResults) === null || _f === void 0 ? void 0 : _f[forPlayerId]) === null || _g === void 0 ? void 0 : _g.disgracefulMet : undefined,
            };
        }
        return state;
    }
}
exports.Game = Game;
