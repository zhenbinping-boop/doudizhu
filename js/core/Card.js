/**
 * Card.js
 * 扑克牌模型定义
 * 点数映射：
 * 3~10 -> 3~10, J -> 11, Q -> 12, K -> 13, A -> 14, 2 -> 15, 小王 -> 16, 大王 -> 17
 */

const SUITS = {
    SPADE: '♠',
    HEART: '♥',
    CLUB: '♣',
    DIAMOND: '♦',
    NONE: ''
};

const SUIT_COLORS = {
    '♠': 'black',
    '♥': 'red',
    '♣': 'black',
    '♦': 'red',
    '': 'red'
};

const RANK_NAMES = {
    3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
    16: '小王', 17: '大王'
};

class Card {
    constructor(rank, suit = SUITS.NONE, id = null) {
        this.rank = rank; // 3 ~ 17
        this.suit = suit; // '♠', '♥', '♣', '♦'
        this.id = id || `${suit}_${rank}_${Math.random().toString(36).substr(2, 6)}`;
    }

    get name() {
        return RANK_NAMES[this.rank] || String(this.rank);
    }

    get color() {
        if (this.rank === 16) return '#4a5568'; // 小王（黑灰）
        if (this.rank === 17) return '#e53e3e'; // 大王（鲜红）
        return SUIT_COLORS[this.suit] || 'black';
    }

    get isJoker() {
        return this.rank === 16 || this.rank === 17;
    }

    toString() {
        if (this.rank === 16) return '小王';
        if (this.rank === 17) return '大王';
        return `${this.suit}${this.name}`;
    }

    /**
     * 比较两张牌的大小（用于排序：大牌在前）
     */
    static compare(a, b) {
        if (a.rank !== b.rank) {
            return b.rank - a.rank; // 降序
        }
        return a.suit.localeCompare(b.suit);
    }
}

// 兼容浏览器和Node.js测试
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Card, SUITS, RANK_NAMES };
}
