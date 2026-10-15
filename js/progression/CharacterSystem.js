/**
 * CharacterSystem.js
 * 角色养成与专属技能系统
 * 4大特色角色：阿强、黄大富、神算诸葛、倾城小曼
 * 支持：角色升级、碎片升星、好感度、局内被动与技能效果挂钩
 */

const CHARACTER_CONFIGS = {
    'c1': {
        id: 'c1',
        name: '经典阿强',
        title: '农家质朴少年',
        icon: '🌾',
        color: '#48bb78',
        desc: '淳朴善良的农民少年，种地打牌两不误，与队友配合天衣无缝。',
        passiveDesc: '【勤劳致富】以农民身份获胜时，结算金币额外提升 +15%（每级+2%）',
        skillName: '丰收连连',
        skillDesc: '连胜达成时，每场额外获取 500 金币与 2 钻石。',
        basePassiveRate: 0.15,
        perLevelPassiveRate: 0.02
    },
    'c2': {
        id: 'c2',
        name: '黄大富',
        title: '霸道商贾地主',
        icon: '🎩',
        color: '#ecc94b',
        desc: '腰缠万贯的大地主，气场强大，喜欢抢地主和超级加倍。',
        passiveDesc: '【富可敌国】以地主身份获胜时，结算金币额外提升 +20%（每级+2.5%）',
        skillName: '金玉满堂',
        skillDesc: '当三张底牌含有对子或大牌(2/王)时，当局底分额外提升 20%。',
        basePassiveRate: 0.20,
        perLevelPassiveRate: 0.025
    },
    'c3': {
        id: 'c3',
        name: '神算诸葛',
        title: '千王算无遗策',
        icon: '🪭',
        color: '#4299e1',
        desc: '洞察一切的牌局推演大师，记牌与算牌无人能敌。',
        passiveDesc: '【天机神算】打出炸弹或王炸时，直接额外获得 2 钻石奖励。',
        skillName: '借东风',
        skillDesc: '对局惜败时，金币损失减免 25%，并保留记牌器高级推演特权。',
        basePassiveRate: 0.10,
        perLevelPassiveRate: 0.015
    },
    'c4': {
        id: 'c4',
        name: '倾城小曼',
        title: '绝色名媛名角',
        icon: '💃',
        color: '#ed64a6',
        desc: '优雅迷人的旗袍名媛，逢场作戏皆是赢家。',
        passiveDesc: '【闭月羞花】连胜状态下金币收益额外提升 +30%（每级+3%）',
        skillName: '春回大地',
        skillDesc: '若当局打出“春天”或“反春”，排位额外赠送 1 颗段位星，结算金币翻倍！',
        basePassiveRate: 0.30,
        perLevelPassiveRate: 0.03
    }
};

class CharacterSystem {
    constructor(saveData) {
        this.data = saveData;
    }

    getActiveCharacter() {
        const id = this.data.characters.activeId || 'c1';
        const characterData = this.data.characters.owned[id] || { level: 1, stars: 1, shards: 0 };
        const config = CHARACTER_CONFIGS[id] || CHARACTER_CONFIGS['c1'];
        return {
            ...config,
            ...characterData
        };
    }

    getAllCharacters() {
        return Object.keys(CHARACTER_CONFIGS).map(id => {
            const config = CHARACTER_CONFIGS[id];
            const owned = this.data.characters.owned[id] || { level: 1, stars: 0, shards: 0 };
            return {
                ...config,
                ...owned,
                isUnlocked: owned.stars > 0,
                isActive: this.data.characters.activeId === id
            };
        });
    }

    setActiveCharacter(id) {
        if (this.data.characters.owned[id] && this.data.characters.owned[id].stars > 0) {
            this.data.characters.activeId = id;
            return true;
        }
        return false;
    }

    /**
     * 升级角色 (消耗金币)
     */
    upgradeCharacter(id) {
        const char = this.data.characters.owned[id];
        if (!char || char.stars === 0) return { success: false, message: '角色尚未解锁' };
        if (char.level >= 10) return { success: false, message: '已达到满级 (Lv10)' };

        const costCoins = char.level * 3000;
        if (this.data.currencies.coins < costCoins) {
            return { success: false, message: `金币不足，升级需要 ${costCoins} 金币` };
        }

        this.data.currencies.coins -= costCoins;
        char.level += 1;
        return { success: true, newLevel: char.level, costCoins };
    }

    /**
     * 角色升星/解锁 (消耗角色碎片)
     */
    starUpCharacter(id) {
        const char = this.data.characters.owned[id];
        if (!char) return { success: false, message: '无效角色' };

        const needShards = (char.stars + 1) * 10;
        if (char.shards < needShards) {
            return { success: false, message: `碎片不足，升星需要 ${needShards} 碎片（当前拥有: ${char.shards}）` };
        }

        char.shards -= needShards;
        char.stars += 1;
        return { success: true, newStars: char.stars };
    }

    /**
     * 获取当局角色加成参数
     */
    getMatchBonuses(isLandlord, isSpring, streak = 0) {
        const active = this.getActiveCharacter();
        let coinBonusRate = 0;
        let isSpringDouble = false;
        let lossReductionRate = 0;
        let diamondBonus = 0;

        if (active.id === 'c1' && !isLandlord) {
            coinBonusRate += active.basePassiveRate + (active.level - 1) * active.perLevelPassiveRate;
            if (streak >= 2) diamondBonus += 2;
        } else if (active.id === 'c2' && isLandlord) {
            coinBonusRate += active.basePassiveRate + (active.level - 1) * active.perLevelPassiveRate;
        } else if (active.id === 'c3') {
            lossReductionRate = 0.25;
            diamondBonus += 1;
        } else if (active.id === 'c4') {
            if (streak > 0) {
                coinBonusRate += active.basePassiveRate + (active.level - 1) * active.perLevelPassiveRate;
            }
            if (isSpring) {
                isSpringDouble = true;
                coinBonusRate += 1.0; // 春天金币翻倍
            }
        }

        return {
            character: active,
            coinBonusRate,
            lossReductionRate,
            isSpringDouble,
            diamondBonus
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CharacterSystem, CHARACTER_CONFIGS };
}
