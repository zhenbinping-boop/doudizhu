/**
 * EndgamePuzzleSystem.js
 * 斗地主残局解密闯关模式
 * 收录 6 大经典残局，玩家扮演地主面对特定AI手牌，寻找唯一破解策略！
 */

if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    if (typeof Card === 'undefined') {
        const importedCard = require('../core/Card');
        globalThis.Card = importedCard.Card;
        globalThis.SUITS = importedCard.SUITS;
    }
}

const PUZZLE_LEVELS = [
    {
        id: 'puz_1',
        level: 1,
        title: '第 1 关：暗度陈仓',
        desc: '敌强我弱，利用小顺子和单张 2 的绝对控制权寻求生机。',
        rewardCoins: 3000,
        rewardDiamonds: 20,
        myCards: [
            new Card(3, '♠'), new Card(4, '♥'), new Card(5, '♣'), new Card(6, '♦'), new Card(7, '♠'),
            new Card(15, '♠') // 2
        ],
        aiCards: [
            new Card(8, '♠'), new Card(9, '♥'), new Card(10, '♣'), new Card(11, '♦'), new Card(12, '♠'), // 8~Q
            new Card(17, '', 'joker_red') // 大王
        ]
    },
    {
        id: 'puz_2',
        level: 2,
        title: '第 2 关：引蛇出洞',
        desc: '面对敌方四张 2 炸弹，如何让对方的重磅炸弹无功而返？',
        rewardCoins: 5000,
        rewardDiamonds: 30,
        myCards: [
            new Card(4, '♠'), new Card(5, '♥'), new Card(6, '♣'), new Card(7, '♦'),
            new Card(8, '♠'), new Card(9, '♥'), new Card(10, '♣'), new Card(11, '♦'),
            new Card(12, '♠'), new Card(13, '♥'), new Card(14, '♣'), // 4~A
            new Card(17, '', 'joker_red') // 大王
        ],
        aiCards: [
            new Card(15, '♠'), new Card(15, '♥'), new Card(15, '♣'), new Card(15, '♦') // 2222 炸弹
        ]
    },
    {
        id: 'puz_3',
        level: 3,
        title: '第 3 关：双龙探海',
        desc: '三带与飞机的博弈，拆牌与顺风跑牌的极致权衡。',
        rewardCoins: 6000,
        rewardDiamonds: 35,
        myCards: [
            new Card(5, '♠'), new Card(5, '♥'), new Card(5, '♣'),
            new Card(6, '♠'), new Card(6, '♥'), new Card(6, '♣'),
            new Card(9, '♠'), new Card(10, '♥')
        ],
        aiCards: [
            new Card(7, '♠'), new Card(7, '♥'), new Card(7, '♣'),
            new Card(8, '♠'), new Card(8, '♥'), new Card(8, '♣'),
            new Card(12, '♠'), new Card(13, '♥')
        ]
    },
    {
        id: 'puz_4',
        level: 4,
        title: '第 4 关：声东击西',
        desc: '小对子与超长大牌的节奏较量，逼对手拆大牌！',
        rewardCoins: 8000,
        rewardDiamonds: 40,
        myCards: [
            new Card(3, '♠'), new Card(3, '♥'),
            new Card(4, '♠'), new Card(4, '♥'),
            new Card(15, '♠'), new Card(15, '♥') // 对2
        ],
        aiCards: [
            new Card(5, '♠'), new Card(5, '♥'),
            new Card(14, '♠'), new Card(14, '♥'), // 对A
            new Card(16, '', 'joker_black')       // 小王
        ]
    },
    {
        id: 'puz_5',
        level: 5,
        title: '第 5 关：釜底抽薪',
        desc: '看似必输的散单牌局，寻找唯一的先手控牌解！',
        rewardCoins: 10000,
        rewardDiamonds: 50,
        myCards: [
            new Card(3, '♠'), new Card(7, '♥'), new Card(8, '♣'), new Card(9, '♦'),
            new Card(10, '♠'), new Card(11, '♥'), new Card(12, '♣'), new Card(13, '♦'), new Card(14, '♠')
        ],
        aiCards: [
            new Card(4, '♠'), new Card(7, '♦'), new Card(8, '♦'), new Card(9, '♠'),
            new Card(10, '♥'), new Card(11, '♣'), new Card(12, '♦'), new Card(13, '♠'), new Card(14, '♥'),
            new Card(15, '♠') // 2
        ]
    },
    {
        id: 'puz_6',
        level: 6,
        title: '第 6 关：逆风翻盘（宗师残局）',
        desc: '炸弹与双王的史诗级交锋，一步算错满盘皆输！',
        rewardCoins: 20000,
        rewardDiamonds: 100,
        myCards: [
            new Card(4, '♠'), new Card(5, '♥'), new Card(6, '♣'), new Card(7, '♦'),
            new Card(8, '♠'), new Card(8, '♥'), new Card(8, '♣'), new Card(8, '♦'), // 8888 炸弹
            new Card(15, '♠') // 单2
        ],
        aiCards: [
            new Card(10, '♠'), new Card(11, '♥'), new Card(12, '♣'), new Card(13, '♦'), new Card(14, '♠'),
            new Card(16, '', 'joker_black'), new Card(17, '', 'joker_red') // 王炸
        ]
    }
];

class EndgamePuzzleSystem {
    constructor(saveData) {
        this.data = saveData;
    }

    getAllPuzzles() {
        const completed = this.data.puzzles.completedLevels || [];
        return PUZZLE_LEVELS.map((puz, index) => {
            const isCompleted = completed.includes(puz.id);
            // 第一关默认解锁，后续关卡要求前一关通关
            const isUnlocked = index === 0 || completed.includes(PUZZLE_LEVELS[index - 1].id);
            return {
                ...puz,
                isCompleted,
                isUnlocked
            };
        });
    }

    completePuzzle(puzzleId) {
        const puz = PUZZLE_LEVELS.find(p => p.id === puzzleId);
        if (!puz) return { success: false, message: '关卡不存在' };

        if (!this.data.puzzles.completedLevels.includes(puzzleId)) {
            this.data.puzzles.completedLevels.push(puzzleId);
            this.data.currencies.coins += puz.rewardCoins;
            this.data.currencies.diamonds += puz.rewardDiamonds;
            return {
                success: true,
                firstClear: true,
                rewardCoins: puz.rewardCoins,
                rewardDiamonds: puz.rewardDiamonds
            };
        }

        return { success: true, firstClear: false };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EndgamePuzzleSystem, PUZZLE_LEVELS };
}
