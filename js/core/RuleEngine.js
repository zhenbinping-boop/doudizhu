/**
 * RuleEngine.js
 * 斗地主核心规则判定引擎
 * 支持：牌型识别、牌型大小比对、智能出牌提示生成、合法性校验
 */

if (typeof require !== 'undefined' && typeof Card === 'undefined') {
    var { Card } = require('./Card');
}

const CARD_TYPES = {
    INVALID: 'INVALID',
    PASS: 'PASS',
    SINGLE: 'SINGLE',                   // 单张 (1)
    PAIR: 'PAIR',                       // 对子 (2)
    TRIPLE: 'TRIPLE',                   // 三张不带 (3)
    TRIPLE_ONE: 'TRIPLE_ONE',           // 三带一 (4)
    TRIPLE_TWO: 'TRIPLE_TWO',           // 三带二/一对 (5)
    STRAIGHT: 'STRAIGHT',               // 单顺子 (>=5张，3~A)
    CONSECUTIVE_PAIRS: 'CONSECUTIVE_PAIRS', // 连对 (>=3对，3~A)
    AIRPLANE: 'AIRPLANE',               // 飞机不带 (>=2连三张，3~A)
    AIRPLANE_SINGLES: 'AIRPLANE_SINGLES', // 飞机带单牌 (N个三张 + N张单牌)
    AIRPLANE_PAIRS: 'AIRPLANE_PAIRS',   // 飞机带对子 (N个三张 + N个对子)
    FOUR_TWO_SINGLES: 'FOUR_TWO_SINGLES', // 四带两单 (6张)
    FOUR_TWO_PAIRS: 'FOUR_TWO_PAIRS',   // 四带两对 (8张)
    BOMB: 'BOMB',                       // 炸弹 (4张同点数)
    ROCKET: 'ROCKET'                    // 王炸 (双王)
};

class HandCombination {
    constructor(type, rank, length, cards = []) {
        this.type = type;
        this.rank = rank;     // 主要用于比较的核心点数
        this.length = length; // 牌数或连顺长度
        this.cards = cards;
    }

    toString() {
        return `[${this.type} 核心点数:${this.rank} 牌数:${this.cards.length}]`;
    }
}

class RuleEngine {
    /**
     * 统计手牌各点数出现的频次
     * @param {Array<Card>} cards 
     * @returns {Map<number, number>} { rank => count }
     */
    static getRankCounts(cards) {
        const counts = new Map();
        for (const card of cards) {
            counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
        }
        return counts;
    }

    /**
     * 检测牌型
     * @param {Array<Card>} cards 
     * @returns {HandCombination}
     */
    static parseHand(cards) {
        if (!cards || cards.length === 0) {
            return new HandCombination(CARD_TYPES.PASS, 0, 0, []);
        }

        const len = cards.length;
        const counts = this.getRankCounts(cards);

        // 1. 单张 (1张)
        if (len === 1) {
            return new HandCombination(CARD_TYPES.SINGLE, cards[0].rank, 1, cards);
        }

        // 2. 双牌：对子 或 王炸 (2张)
        if (len === 2) {
            if (cards.some(c => c.rank === 16) && cards.some(c => c.rank === 17)) {
                return new HandCombination(CARD_TYPES.ROCKET, 17, 2, cards);
            }
            if (counts.size === 1) {
                return new HandCombination(CARD_TYPES.PAIR, cards[0].rank, 2, cards);
            }
            return new HandCombination(CARD_TYPES.INVALID, 0, 0, cards);
        }

        // 3. 三张 (3张)
        if (len === 3) {
            if (counts.size === 1) {
                return new HandCombination(CARD_TYPES.TRIPLE, cards[0].rank, 3, cards);
            }
            return new HandCombination(CARD_TYPES.INVALID, 0, 0, cards);
        }

        // 4. 四张：炸弹 或 三带一 (4张)
        if (len === 4) {
            if (counts.size === 1) {
                return new HandCombination(CARD_TYPES.BOMB, cards[0].rank, 4, cards);
            }
            // 三带一
            for (const [rank, count] of counts.entries()) {
                if (count === 3) {
                    return new HandCombination(CARD_TYPES.TRIPLE_ONE, rank, 4, cards);
                }
            }
            return new HandCombination(CARD_TYPES.INVALID, 0, 0, cards);
        }

        // 5. 五张：三带二、单顺子 (5张)
        if (len === 5) {
            // 三带二（一对）
            if (counts.size === 2) {
                let tripleRank = 0, pairRank = 0;
                for (const [rank, count] of counts.entries()) {
                    if (count === 3) tripleRank = rank;
                    if (count === 2) pairRank = rank;
                }
                if (tripleRank > 0 && pairRank > 0) {
                    return new HandCombination(CARD_TYPES.TRIPLE_TWO, tripleRank, 5, cards);
                }
            }
            // 单顺子 (5张)
            if (this.isStraight(cards)) {
                return new HandCombination(CARD_TYPES.STRAIGHT, Math.max(...cards.map(c => c.rank)), 5, cards);
            }
            return new HandCombination(CARD_TYPES.INVALID, 0, 0, cards);
        }

        // 6. 六张：顺子(6)、连对(3对)、四带两单、飞机不带(2个三张)
        if (len === 6) {
            if (this.isStraight(cards)) {
                return new HandCombination(CARD_TYPES.STRAIGHT, Math.max(...cards.map(c => c.rank)), 6, cards);
            }
            if (this.isConsecutivePairs(cards)) {
                return new HandCombination(CARD_TYPES.CONSECUTIVE_PAIRS, Math.max(...cards.map(c => c.rank)), 3, cards);
            }
            if (this.isAirplane(cards)) {
                return new HandCombination(CARD_TYPES.AIRPLANE, this.getAirplaneMaxRank(cards), 2, cards);
            }
            // 四带两单 (一个4张 + 两个单张 或 一个对子作为两单)
            for (const [rank, count] of counts.entries()) {
                if (count === 4) {
                    return new HandCombination(CARD_TYPES.FOUR_TWO_SINGLES, rank, 6, cards);
                }
            }
        }

        // 通用长度判断：顺子 (len >= 5)
        if (len >= 5 && len <= 12 && this.isStraight(cards)) {
            return new HandCombination(CARD_TYPES.STRAIGHT, Math.max(...cards.map(c => c.rank)), len, cards);
        }

        // 通用长度判断：连对 (len >= 6 且为偶数)
        if (len >= 6 && len % 2 === 0 && this.isConsecutivePairs(cards)) {
            return new HandCombination(CARD_TYPES.CONSECUTIVE_PAIRS, Math.max(...cards.map(c => c.rank)), len / 2, cards);
        }

        // 通用长度判断：飞机不带 (len >= 6 且为 3 的倍数)
        if (len >= 6 && len % 3 === 0 && this.isAirplane(cards)) {
            return new HandCombination(CARD_TYPES.AIRPLANE, this.getAirplaneMaxRank(cards), len / 3, cards);
        }

        // 飞机带单牌 (len = 4 * N, 其中 N >= 2)
        if (len >= 8 && len % 4 === 0) {
            const airplaneSingles = this.checkAirplaneWithWings(cards, 1);
            if (airplaneSingles) return airplaneSingles;
        }

        // 飞机带对子 (len = 5 * N, 其中 N >= 2)
        if (len >= 10 && len % 5 === 0) {
            const airplanePairs = this.checkAirplaneWithWings(cards, 2);
            if (airplanePairs) return airplanePairs;
        }

        // 四带两对 (8张：一个4张 + 两个对子)
        if (len === 8) {
            let quadRank = 0;
            let pairCount = 0;
            for (const [rank, count] of counts.entries()) {
                if (count === 4) quadRank = rank;
                if (count === 2) pairCount++;
            }
            // 两个4张也可以作为四带两对
            if (counts.size === 2 && Array.from(counts.values()).every(c => c === 4)) {
                const ranks = Array.from(counts.keys()).sort((a, b) => b - a);
                return new HandCombination(CARD_TYPES.FOUR_TWO_PAIRS, ranks[0], 8, cards);
            }
            if (quadRank > 0 && pairCount === 2) {
                return new HandCombination(CARD_TYPES.FOUR_TWO_PAIRS, quadRank, 8, cards);
            }
        }

        return new HandCombination(CARD_TYPES.INVALID, 0, 0, cards);
    }

    /**
     * 判断单顺子（>=5张，不能含有2(15)或大小王(16,17)，必须连续）
     */
    static isStraight(cards) {
        if (cards.length < 5 || cards.length > 12) return false;
        const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
        // 不能有 2、小王、大王
        if (ranks.some(r => r >= 15)) return false;
        // 不能有重复点数
        for (let i = 0; i < ranks.length - 1; i++) {
            if (ranks[i + 1] - ranks[i] !== 1) return false;
        }
        return true;
    }

    /**
     * 判断连对（>=3对，不能含有2或大小王，各点数必须恰好2张且连续）
     */
    static isConsecutivePairs(cards) {
        if (cards.length < 6 || cards.length % 2 !== 0) return false;
        const counts = this.getRankCounts(cards);
        const pairCount = cards.length / 2;
        if (counts.size !== pairCount) return false;

        const ranks = Array.from(counts.keys()).sort((a, b) => a - b);
        if (ranks.some(r => r >= 15)) return false;

        for (let i = 0; i < ranks.length; i++) {
            if (counts.get(ranks[i]) !== 2) return false;
            if (i > 0 && ranks[i] - ranks[i - 1] !== 1) return false;
        }
        return true;
    }

    /**
     * 判断纯飞机（>=2连三张，不能含有2或大小王，各点数必须恰好3张且连续）
     */
    static isAirplane(cards) {
        if (cards.length < 6 || cards.length % 3 !== 0) return false;
        const counts = this.getRankCounts(cards);
        const tripleCount = cards.length / 3;
        if (counts.size !== tripleCount) return false;

        const ranks = Array.from(counts.keys()).sort((a, b) => a - b);
        if (ranks.some(r => r >= 15)) return false;

        for (let i = 0; i < ranks.length; i++) {
            if (counts.get(ranks[i]) !== 3) return false;
            if (i > 0 && ranks[i] - ranks[i - 1] !== 1) return false;
        }
        return true;
    }

    static getAirplaneMaxRank(cards) {
        const counts = this.getRankCounts(cards);
        const ranks = Array.from(counts.keys()).sort((a, b) => a - b);
        return ranks[ranks.length - 1];
    }

    /**
     * 检测飞机带翅膀（wingType: 1=带单牌, 2=带对子）
     */
    static checkAirplaneWithWings(cards, wingType) {
        const counts = this.getRankCounts(cards);
        const triples = [];
        for (const [rank, count] of counts.entries()) {
            if (count >= 3 && rank < 15) { // 飞机核心不能有2和王
                triples.push(rank);
            }
        }
        if (triples.length < 2) return null;
        triples.sort((a, b) => a - b);

        const targetTriplesCount = wingType === 1 ? cards.length / 4 : cards.length / 5;
        if (triples.length < targetTriplesCount) return null;

        // 在所有三张候选中寻找连续的 N 个
        for (let i = 0; i <= triples.length - targetTriplesCount; i++) {
            const sub = triples.slice(i, i + targetTriplesCount);
            let consecutive = true;
            for (let j = 1; j < sub.length; j++) {
                if (sub[j] - sub[j - 1] !== 1) {
                    consecutive = false;
                    break;
                }
            }
            if (!consecutive) continue;

            // 验证翅膀是否满足要求
            if (wingType === 1) {
                // 飞机带单牌：总张数正确且翅膀数匹配
                return new HandCombination(
                    CARD_TYPES.AIRPLANE_SINGLES,
                    sub[sub.length - 1],
                    targetTriplesCount,
                    cards
                );
            } else if (wingType === 2) {
                // 飞机带对子：剩余的牌必须全部是对子
                const remainingCounts = new Map(counts);
                for (const r of sub) {
                    remainingCounts.set(r, remainingCounts.get(r) - 3);
                    if (remainingCounts.get(r) === 0) remainingCounts.delete(r);
                }

                let validPairs = true;
                let pairTotal = 0;
                for (const [r, count] of remainingCounts.entries()) {
                    if (count === 2) {
                        pairTotal += 1;
                    } else if (count === 4) {
                        pairTotal += 2; // 两个对子
                    } else {
                        validPairs = false;
                        break;
                    }
                }

                if (validPairs && pairTotal === targetTriplesCount) {
                    return new HandCombination(
                        CARD_TYPES.AIRPLANE_PAIRS,
                        sub[sub.length - 1],
                        targetTriplesCount,
                        cards
                    );
                }
            }
        }
        return null;
    }

    /**
     * 比牌判定：current 能否压过 target
     * @param {HandCombination} current 准备出的牌
     * @param {HandCombination} target 上家出的牌
     * @returns {boolean}
     */
    static canBeat(current, target) {
        if (!current || current.type === CARD_TYPES.INVALID) return false;
        if (!target || target.type === CARD_TYPES.PASS) return true; // 首出任意有效牌均可

        // 1. 王炸无敌
        if (current.type === CARD_TYPES.ROCKET) return true;
        if (target.type === CARD_TYPES.ROCKET) return false;

        // 2. 炸弹压制非炸弹/火箭
        if (current.type === CARD_TYPES.BOMB) {
            if (target.type !== CARD_TYPES.BOMB) return true;
            return current.rank > target.rank;
        }
        if (target.type === CARD_TYPES.BOMB) {
            return false;
        }

        // 3. 同牌型比较
        if (current.type === target.type) {
            // 长度/张数必须一致
            if (current.length !== target.length) return false;
            if (current.cards.length !== target.cards.length) return false;
            return current.rank > target.rank;
        }

        return false;
    }

    /**
     * 智能提示/可出牌生成器：在 myCards 中找出所有能压过 targetHand 的合法出牌组合
     * @param {Array<Card>} myCards 
     * @param {HandCombination|null} targetHand 
     * @returns {Array<Array<Card>>} 排序后（威力从小到大）的可行方案数组
     */
    static findPlayableCombinations(myCards, targetHand) {
        if (!myCards || myCards.length === 0) return [];
        const sortedCards = [...myCards].sort((a, b) => a.rank - b.rank);
        const results = [];

        // 如果首出（targetHand 为空或 PASS），返回推荐起手牌组
        if (!targetHand || targetHand.type === CARD_TYPES.PASS) {
            return this.generateLeadMoves(sortedCards);
        }

        const counts = this.getRankCounts(sortedCards);
        const targetType = targetHand.type;

        // 1. 单张压制
        if (targetType === CARD_TYPES.SINGLE) {
            const singleCandidates = new Set();
            for (const c of sortedCards) {
                if (c.rank > targetHand.rank && !singleCandidates.has(c.rank)) {
                    singleCandidates.add(c.rank);
                    results.push([c]);
                }
            }
        }

        // 2. 对子压制
        else if (targetType === CARD_TYPES.PAIR) {
            for (const [rank, count] of counts.entries()) {
                if (count >= 2 && rank > targetHand.rank) {
                    const cardsOfRank = sortedCards.filter(c => c.rank === rank).slice(0, 2);
                    results.push(cardsOfRank);
                }
            }
        }

        // 3. 三张压制
        else if (targetType === CARD_TYPES.TRIPLE) {
            for (const [rank, count] of counts.entries()) {
                if (count >= 3 && rank > targetHand.rank) {
                    const cardsOfRank = sortedCards.filter(c => c.rank === rank).slice(0, 3);
                    results.push(cardsOfRank);
                }
            }
        }

        // 4. 三带一压制
        else if (targetType === CARD_TYPES.TRIPLE_ONE) {
            for (const [rank, count] of counts.entries()) {
                if (count >= 3 && rank > targetHand.rank) {
                    const tripleCards = sortedCards.filter(c => c.rank === rank).slice(0, 3);
                    // 寻找带牌（优先选单张）
                    for (const singleCard of sortedCards) {
                        if (singleCard.rank !== rank) {
                            results.push([...tripleCards, singleCard]);
                            break; // 先只推一个最优带牌
                        }
                    }
                }
            }
        }

        // 5. 三带二压制
        else if (targetType === CARD_TYPES.TRIPLE_TWO) {
            for (const [rank, count] of counts.entries()) {
                if (count >= 3 && rank > targetHand.rank) {
                    const tripleCards = sortedCards.filter(c => c.rank === rank).slice(0, 3);
                    // 寻找对子带牌
                    for (const [pairRank, pairCount] of counts.entries()) {
                        if (pairRank !== rank && pairCount >= 2) {
                            const pairCards = sortedCards.filter(c => c.rank === pairRank).slice(0, 2);
                            results.push([...tripleCards, ...pairCards]);
                            break;
                        }
                    }
                }
            }
        }

        // 6. 顺子压制
        else if (targetType === CARD_TYPES.STRAIGHT) {
            const seqLen = targetHand.length;
            const uniqueRanks = Array.from(new Set(sortedCards.map(c => c.rank)))
                .filter(r => r < 15) // 不能包含 2 和王
                .sort((a, b) => a - b);

            for (let i = 0; i <= uniqueRanks.length - seqLen; i++) {
                const sub = uniqueRanks.slice(i, i + seqLen);
                let isSeq = true;
                for (let j = 1; j < sub.length; j++) {
                    if (sub[j] - sub[j - 1] !== 1) {
                        isSeq = false;
                        break;
                    }
                }
                if (isSeq && sub[sub.length - 1] > targetHand.rank) {
                    const combo = sub.map(r => sortedCards.find(c => c.rank === r));
                    results.push(combo);
                }
            }
        }

        // 7. 连对压制
        else if (targetType === CARD_TYPES.CONSECUTIVE_PAIRS) {
            const pairLen = targetHand.length; // 连对对数
            const eligiblePairs = [];
            for (const [rank, count] of counts.entries()) {
                if (count >= 2 && rank < 15) {
                    eligiblePairs.push(rank);
                }
            }
            eligiblePairs.sort((a, b) => a - b);

            for (let i = 0; i <= eligiblePairs.length - pairLen; i++) {
                const sub = eligiblePairs.slice(i, i + pairLen);
                let isSeq = true;
                for (let j = 1; j < sub.length; j++) {
                    if (sub[j] - sub[j - 1] !== 1) {
                        isSeq = false;
                        break;
                    }
                }
                if (isSeq && sub[sub.length - 1] > targetHand.rank) {
                    const combo = [];
                    for (const r of sub) {
                        combo.push(...sortedCards.filter(c => c.rank === r).slice(0, 2));
                    }
                    results.push(combo);
                }
            }
        }

        // 8. 炸弹压制 (常规牌型被炸弹压制，或者低级炸弹被高级炸弹压制)
        for (const [rank, count] of counts.entries()) {
            if (count === 4) {
                if (targetType !== CARD_TYPES.BOMB || rank > targetHand.rank) {
                    results.push(sortedCards.filter(c => c.rank === rank));
                }
            }
        }

        // 9. 王炸 (双王压制除王炸外的所有)
        const hasBlackJoker = sortedCards.some(c => c.rank === 16);
        const hasRedJoker = sortedCards.some(c => c.rank === 17);
        if (hasBlackJoker && hasRedJoker && targetType !== CARD_TYPES.ROCKET) {
            results.push(sortedCards.filter(c => c.rank === 16 || c.rank === 17));
        }

        return results;
    }

    /**
     * 首出牌推荐策略（供首出提示或简单决策）
     */
    static generateLeadMoves(sortedCards) {
        const moves = [];
        const counts = this.getRankCounts(sortedCards);

        // 优先找出顺子
        const straights = this.findAllStraights(sortedCards);
        if (straights.length > 0) moves.push(...straights);

        // 连对
        const pairs = [];
        for (const [rank, count] of counts.entries()) {
            if (count >= 2) {
                pairs.push(sortedCards.filter(c => c.rank === rank).slice(0, 2));
            }
        }

        // 三张/三带
        for (const [rank, count] of counts.entries()) {
            if (count >= 3) {
                const triple = sortedCards.filter(c => c.rank === rank).slice(0, 3);
                // 找最小单张带
                const single = sortedCards.find(c => c.rank !== rank);
                if (single) moves.push([...triple, single]);
                else moves.push(triple);
            }
        }

        // 对子
        if (pairs.length > 0) moves.push(pairs[0]);

        // 最小单张
        if (sortedCards.length > 0) {
            moves.push([sortedCards[0]]);
        }

        return moves;
    }

    static findAllStraights(sortedCards) {
        const unique = Array.from(new Set(sortedCards.map(c => c.rank)))
            .filter(r => r < 15)
            .sort((a, b) => a - b);
        const straights = [];
        for (let len = 5; len <= 8; len++) {
            for (let i = 0; i <= unique.length - len; i++) {
                const sub = unique.slice(i, i + len);
                let ok = true;
                for (let j = 1; j < sub.length; j++) {
                    if (sub[j] - sub[j - 1] !== 1) { ok = false; break; }
                }
                if (ok) {
                    straights.push(sub.map(r => sortedCards.find(c => c.rank === r)));
                }
            }
        }
        return straights;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RuleEngine, CARD_TYPES, HandCombination };
}
