/**
 * AIPlayer.js
 * 智能电脑玩家决策引擎
 * 融合专家启发式算法与手牌价值评估：
 * 1. 叫分与抢地主估值模型
 * 2. 加倍/超级加倍决策
 * 3. 农民协同作战策略（顶地主 vs 顺牌跑地主）
 * 4. 智能控牌、拆牌保护、保牌与炸弹时机判定
 */

if (typeof require !== 'undefined' && typeof RuleEngine === 'undefined') {
    var { RuleEngine, CARD_TYPES } = require('./RuleEngine');
    var { Card } = require('./Card');
}

class AIPlayer {
    /**
     * 评估手牌强度评分（用于叫地主、抢地主、加倍）
     * @param {Array<Card>} cards 
     * @returns {number}
     */
    static evaluateHandStrength(cards) {
        let score = 0;
        const counts = RuleEngine.getRankCounts(cards);

        // 1. 王牌与2的高价值分
        const hasBlackJoker = cards.some(c => c.rank === 16);
        const hasRedJoker = cards.some(c => c.rank === 17);
        if (hasBlackJoker && hasRedJoker) {
            score += 8; // 王炸超高分
        } else {
            if (hasRedJoker) score += 3.5;
            if (hasBlackJoker) score += 2.5;
        }

        // 2 (rank 15)
        const twos = counts.get(15) || 0;
        score += twos * 1.8;

        // A (rank 14)
        const aces = counts.get(14) || 0;
        score += aces * 0.8;

        // 2. 炸弹得分 (4张同点数)
        for (const [rank, count] of counts.entries()) {
            if (count === 4) {
                score += 4.5;
            }
        }

        // 3. 连牌/顺子加分
        const straights = RuleEngine.findAllStraights(cards);
        if (straights.length > 0) {
            score += straights.length * 1.2;
        }

        // 4. 散单牌扣分 (<=10 的单牌属于包袱)
        for (const [rank, count] of counts.entries()) {
            if (count === 1 && rank <= 10) {
                score -= 0.6;
            }
        }

        return Math.max(0, score);
    }

    /**
     * 叫地主决策
     * @param {Array<Card>} cards 
     * @param {number} currentHighestBid 当前最高叫分 (0, 1, 2)
     * @returns {number} 0=不叫/弃权, 1=1分, 2=2分, 3=3分
     */
    static decideBid(cards, currentHighestBid = 0) {
        const strength = this.evaluateHandStrength(cards);

        if (strength >= 8.5) {
            return 3;
        } else if (strength >= 6.0 && currentHighestBid < 2) {
            return 2;
        } else if (strength >= 4.0 && currentHighestBid < 1) {
            return 1;
        }
        return 0; // 不叫 / 不抢
    }

    /**
     * 加倍决策
     * @param {Array<Card>} cards 
     * @param {boolean} isLandlord 是否为地主
     * @returns {number} 1=不加倍, 2=加倍, 4=超级加倍
     */
    static decideDouble(cards, isLandlord) {
        const strength = this.evaluateHandStrength(cards);
        if (isLandlord) {
            if (strength >= 11) return 4; // 超级加倍
            if (strength >= 8) return 2;  // 加倍
        } else {
            // 农民加倍
            if (strength >= 7.5) return 2;
        }
        return 1; // 保持原倍
    }

    /**
     * AI出牌决策
     * @param {Object} context 牌局上下文
     * {
     *   myCards: Array<Card>,
     *   mySeat: number,
     *   landlordSeat: number,
     *   lastSeat: number,
     *   lastHand: HandCombination,
     *   cardCounts: [number, number, number], // 各家剩余牌数
     *   handHistory: Array
     * }
     * @returns {Array<Card>|null} 要出的牌数组，null 表示不出 (PASS)
     */
    static decidePlay(context) {
        const { myCards, mySeat, landlordSeat, lastSeat, lastHand, cardCounts } = context;
        const isLandlord = (mySeat === landlordSeat);
        const isTeammate = (!isLandlord && lastSeat !== landlordSeat && lastSeat !== mySeat);

        // 如果是自己首出，或者前面两家都 PASS 了
        if (!lastHand || lastHand.type === CARD_TYPES.PASS) {
            return this.decideLead(myCards, isLandlord, mySeat, landlordSeat, cardCounts);
        }

        // 寻找所有能压制当前牌的合法出牌方案
        const legalPlays = RuleEngine.findPlayableCombinations(myCards, lastHand);
        if (legalPlays.length === 0) {
            return null; // 要不起
        }

        // 队友出牌时的避让协同策略 (农民配合)
        if (isTeammate) {
            const teammateSeat = lastSeat;
            const teammateLeft = cardCounts[teammateSeat];

            // 队友只剩少量牌 (<=3张)，且当前压制着地主，直接不出让队友走
            if (teammateLeft <= 3) {
                return null;
            }

            // 队友出的牌很大 (A或2或炸弹或顺子)，且地主已经PASS，不盲目接队友的牌
            if (lastHand.rank >= 14 || lastHand.type === CARD_TYPES.BOMB || lastHand.type === CARD_TYPES.ROCKET) {
                return null;
            }

            // 队友出较小牌时，如果自己能接而且有大牌掌控局面，可以考虑上手帮队友控盘
            // 否则放行走牌
            if (Math.random() < 0.6) {
                return null;
            }
        }

        // 面对对手（地主或农民）出的牌
        // 分离常规牌型与炸弹/王炸
        const normalPlays = legalPlays.filter(p => {
            const type = RuleEngine.parseHand(p).type;
            return type !== CARD_TYPES.BOMB && type !== CARD_TYPES.ROCKET;
        });
        const bombPlays = legalPlays.filter(p => {
            const type = RuleEngine.parseHand(p).type;
            return type === CARD_TYPES.BOMB || type === CARD_TYPES.ROCKET;
        });

        // 优先使用最小的常规压制牌
        if (normalPlays.length > 0) {
            // 排序选最小的合法方案
            return normalPlays[0];
        }

        // 如果只有炸弹或王炸可以压：
        if (bombPlays.length > 0) {
            const opponentLeft = isLandlord ? 
                Math.min(cardCounts[(mySeat + 1) % 3], cardCounts[(mySeat + 2) % 3]) :
                cardCounts[landlordSeat];

            // 1. 如果对手剩余牌数危急 (<= 3 张)，果断炸他！
            if (opponentLeft <= 3) {
                return bombPlays[0];
            }

            // 2. 如果自己牌很顺，炸了之后能快速收割走光
            if (myCards.length <= 6) {
                return bombPlays[0];
            }

            // 3. 对手出大牌 (例如2或高级三带)，有一定概率动用炸弹抢夺球权
            if (lastHand.rank >= 15 && Math.random() < 0.5) {
                return bombPlays[0];
            }
        }

        // 其余情况选择要不起/过牌，保存实力
        return null;
    }

    /**
     * AI主动起手领出牌策略
     */
    static decideLead(myCards, isLandlord, mySeat, landlordSeat, cardCounts) {
        const sortedCards = [...myCards].sort((a, b) => a.rank - b.rank);
        const counts = RuleEngine.getRankCounts(sortedCards);
        const isUpstreamFarmer = (!isLandlord && (mySeat + 1) % 3 === landlordSeat); // 地主的上家（顶庄位）

        // 如果是顶地主的上家农民，优先起手出中大牌顶住地主，或者出对子压制
        if (isUpstreamFarmer) {
            // 优先打对子
            for (const [rank, count] of counts.entries()) {
                if (count === 2 && rank >= 8) {
                    return sortedCards.filter(c => c.rank === rank).slice(0, 2);
                }
            }
        }

        // 1. 优先出顺子或连对（能走多张就走多张）
        const straights = RuleEngine.findAllStraights(sortedCards);
        if (straights.length > 0) {
            // 出最长的顺子
            straights.sort((a, b) => b.length - a.length);
            return straights[0];
        }

        // 2. 三带一 / 三带二（快速清理散牌）
        for (const [rank, count] of counts.entries()) {
            if (count === 3 && rank < 15) {
                const triple = sortedCards.filter(c => c.rank === rank);
                // 找最小的散单牌
                const single = sortedCards.find(c => counts.get(c.rank) === 1 && c.rank <= 10);
                if (single) {
                    return [...triple, single];
                }
                // 找最小的对子
                const pairRank = Array.from(counts.keys()).find(r => r !== rank && counts.get(r) === 2);
                if (pairRank) {
                    const pair = sortedCards.filter(c => c.rank === pairRank).slice(0, 2);
                    return [...triple, ...pair];
                }
                return triple;
            }
        }

        // 3. 连对或对子
        for (const [rank, count] of counts.entries()) {
            if (count === 2 && rank < 14) {
                return sortedCards.filter(c => c.rank === rank).slice(0, 2);
            }
        }

        // 4. 最小散单牌
        const singles = sortedCards.filter(c => counts.get(c.rank) === 1);
        if (singles.length > 0) {
            return [singles[0]];
        }

        // 5. 兜底出最小牌
        return [sortedCards[0]];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIPlayer };
}
