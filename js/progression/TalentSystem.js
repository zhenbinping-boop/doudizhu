/**
 * TalentSystem.js
 * 局外六维天赋树成长系统
 * 1. 记牌神算 (卡牌信息与预警)
 * 2. 财源滚滚 (结算金币增益)
 * 3. 连胜风暴 (连胜加权奖励)
 * 4. 逢凶化吉 (输分保护与止损)
 * 5. 天赐底牌 (地主底牌质量提升)
 * 6. 绝地反击 (残局残牌爆发)
 */

const TALENT_CONFIGS = [
    {
        id: 'talent_card_counter',
        name: '记牌神算',
        icon: '👁️',
        maxLevel: 5,
        baseCost: 2000,
        costStep: 2500,
        levelsDesc: [
            '未解锁记牌器',
            '解锁基础记牌器：实时显示牌池剩余各点数牌量',
            '高阶预警：高亮标记双王与剩余 2、A',
            '断张雷达：实时标红敌方潜在4张炸弹断点',
            '连对预判：高亮敌方可能构成的顺子区间',
            '神算千术：全盘剩余组合完全可视化透明！'
        ]
    },
    {
        id: 'talent_rich_reward',
        name: '财源滚滚',
        icon: '💰',
        maxLevel: 5,
        baseCost: 3000,
        costStep: 3000,
        levelsDesc: [
            '无加成',
            '对局胜利结算金币额外 +6%',
            '对局胜利结算金币额外 +12%',
            '对局胜利结算金币额外 +18%',
            '对局胜利结算金币额外 +24%',
            '对局胜利结算金币额外 +30%（顶级财神附体）'
        ]
    },
    {
        id: 'talent_streak_bonus',
        name: '连胜风暴',
        icon: '⚡',
        maxLevel: 5,
        baseCost: 4000,
        costStep: 4000,
        levelsDesc: [
            '无加成',
            '连胜时每场额外赠送 500 金币',
            '连胜额外赠送 1000 金币，3连胜额外排位星数概率提升',
            '连胜额外赠送 1600 金币 + 2 钻石',
            '连胜额外赠送 2400 金币 + 4 钻石',
            '连胜额外赠送 3500 金币 + 8 钻石，连胜必定保底升星！'
        ]
    },
    {
        id: 'talent_loss_shield',
        name: '逢凶化吉',
        icon: '🛡️',
        maxLevel: 5,
        baseCost: 3000,
        costStep: 3000,
        levelsDesc: [
            '无减免',
            '对局战败时金币损失减少 -6%',
            '对局战败时金币损失减少 -12%',
            '对局战败时金币损失减少 -18%',
            '对局战败时金币损失减少 -24%',
            '对局战败时金币损失减少 -30%'
        ]
    },
    {
        id: 'talent_lucky_bottom',
        name: '天赐底牌',
        icon: '🃏',
        maxLevel: 5,
        baseCost: 5000,
        costStep: 5000,
        levelsDesc: [
            '标准底牌概率',
            '当地主时，底牌出现大牌(>=14)的概率提升 15%',
            '当地主时，底牌出现大牌或对子的概率提升 30%',
            '当地主时，底牌出现大牌或顺子组件的概率提升 45%',
            '当地主时，底牌极大概率包含2或王牌 (60%)',
            '天选之子：当地主时底牌必然包含至少一张 2 或双王之一！'
        ]
    },
    {
        id: 'talent_last_stand',
        name: '绝地反击',
        icon: '🔥',
        maxLevel: 5,
        baseCost: 4000,
        costStep: 4500,
        levelsDesc: [
            '无爆发效果',
            '手牌剩余 <=3 张时逆转胜出，额外奖励 +15% 金币',
            '手牌剩余 <=3 张时逆转胜出，额外奖励 +30% 金币',
            '手牌剩余 <=3 张时逆转胜出，额外奖励 +45% 金币 + 3 钻石',
            '手牌剩余 <=3 张时逆转胜出，额外奖励 +60% 金币 + 6 钻石',
            '逆风翻盘：残牌胜利金币翻倍 (+100%) 并赠送 10 钻石！'
        ]
    }
];

class TalentSystem {
    constructor(saveData) {
        this.data = saveData;
    }

    getAllTalents() {
        return TALENT_CONFIGS.map(config => {
            const currentLevel = this.data.talents[config.id] || 0;
            const isMax = currentLevel >= config.maxLevel;
            const nextCost = isMax ? 0 : config.baseCost + currentLevel * config.costStep;
            return {
                ...config,
                currentLevel,
                isMax,
                nextCost,
                desc: config.levelsDesc[currentLevel] || '已满级',
                nextDesc: isMax ? '已达顶级' : config.levelsDesc[currentLevel + 1]
            };
        });
    }

    getTalentLevel(id) {
        return this.data.talents[id] || 0;
    }

    upgradeTalent(id) {
        const config = TALENT_CONFIGS.find(t => t.id === id);
        if (!config) return { success: false, message: '无效天赋' };

        const currentLevel = this.data.talents[id] || 0;
        if (currentLevel >= config.maxLevel) {
            return { success: false, message: '该天赋已升至满级！' };
        }

        const cost = config.baseCost + currentLevel * config.costStep;
        if (this.data.currencies.coins < cost) {
            return { success: false, message: `金币不足，升级需要 ${cost} 金币（当前拥有: ${this.data.currencies.coins}）` };
        }

        this.data.currencies.coins -= cost;
        this.data.talents[id] = currentLevel + 1;

        return {
            success: true,
            newLevel: this.data.talents[id],
            cost,
            talentName: config.name
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TalentSystem, TALENT_CONFIGS };
}
