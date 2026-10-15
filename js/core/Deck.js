/**
 * Deck.js
 * 牌堆管理：生成54张牌、洗牌、不洗牌模式、发牌、底牌预处理
 */

if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    if (typeof Card === 'undefined') {
        const importedCard = require('./Card');
        globalThis.Card = importedCard.Card;
        globalThis.SUITS = importedCard.SUITS;
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.init();
    }

    /**
     * 生成完整的54张扑克牌
     */
    init() {
        this.cards = [];
        const suits = [SUITS.SPADE, SUITS.HEART, SUITS.CLUB, SUITS.DIAMOND];
        
        // 3 ~ 15 (11=J, 12=Q, 13=K, 14=A, 15=2)
        for (let rank = 3; rank <= 15; rank++) {
            for (let suit of suits) {
                this.cards.push(new Card(rank, suit));
            }
        }
        // 小王 (16), 大王 (17)
        this.cards.push(new Card(16, SUITS.NONE, 'joker_black'));
        this.cards.push(new Card(17, SUITS.NONE, 'joker_red'));
    }

    /**
     * 经典随机洗牌 (Fisher-Yates)
     */
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
        return this;
    }

    /**
     * “不洗牌”模式洗牌：模拟真实不洗牌，连续牌堆分段发牌，产生更多炸弹、飞机与顺子
     */
    noShuffle() {
        // 先按真实牌局形成若干连牌、对子、炸弹组
        this.cards.sort((a, b) => a.rank - b.rank);
        
        // 将牌切成 8~12 个牌墩 (chunks)
        const chunks = [];
        let index = 0;
        while (index < this.cards.length) {
            const chunkSize = Math.floor(Math.random() * 4) + 4; // 4~7张一块
            chunks.push(this.cards.slice(index, Math.min(index + chunkSize, this.cards.length)));
            index += chunkSize;
        }

        // 随机切牌打乱牌墩顺序（保留牌墩内部连续性）
        for (let i = chunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
        }

        // 重新平铺
        this.cards = chunks.flat();
        return this;
    }

    /**
     * 发牌：三位玩家各17张，底牌3张
     * @param {Object} options 可选配置（如天赋加成：提高底牌质量）
     * @returns {Object} { playerHands: [hand0, hand1, hand2], bottomCards: [b1, b2, b3] }
     */
    deal(options = {}) {
        const hands = [[], [], []];
        const bottomCards = [];

        // 轮流发牌（3人各17张）
        for (let i = 0; i < 51; i++) {
            hands[i % 3].push(this.cards[i]);
        }
        // 最后3张作为底牌
        for (let i = 51; i < 54; i++) {
            bottomCards.push(this.cards[i]);
        }

        // 天赋“天赐底牌”修正：如果是主角且有底牌强化天赋，确保底牌至少有大牌或对子
        if (options.luckyBottom && Math.random() < options.luckyBottomRate) {
            // 尝试在底牌中找一张大牌（>=14 或对子）
            let hasBigCard = bottomCards.some(c => c.rank >= 14);
            if (!hasBigCard) {
                // 从玩家0牌库中置换一张小牌与牌堆的大牌
                let candidateIdx = hands[0].findIndex(c => c.rank >= 14);
                if (candidateIdx !== -1) {
                    let temp = hands[0][candidateIdx];
                    hands[0][candidateIdx] = bottomCards[0];
                    bottomCards[0] = temp;
                }
            }
        }

        // 所有人手牌按牌面大小降序排列
        hands.forEach(h => h.sort(Card.compare));
        bottomCards.sort(Card.compare);

        return {
            playerHands: hands,
            bottomCards: bottomCards
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Deck };
}
