/**
 * StorageManager.js
 * 负责本地数据存档、读取、重置、版本迁移以及调试作弊指令
 */

const STORAGE_KEY = 'DOUDIZHU_HERO_SAVE_V1';

const DEFAULT_SAVE_DATA = {
    version: '1.0.0',
    profile: {
        nickname: '斗地主宗师',
        avatar: 'avatar_default',
        title: '初出茅庐',
        level: 1,
        exp: 0,
        totalGames: 0,
        winGames: 0,
        maxStreak: 0,
        currentStreak: 0,
        bombCount: 0,
        springCount: 0
    },
    currencies: {
        coins: 10000,      // 初始赠送 10,000 金币
        diamonds: 88,      // 初始赠送 88 钻石
        energy: 20,        // 初始体力 20点
        maxEnergy: 30,
        lastEnergyUpdate: Date.now()
    },
    rank: {
        tier: 1,           // 1=青铜, 2=白银, 3=黄金, 4=铂金, 5=钻石, 6=星耀, 7=雀圣
        subTier: 3,        // III ~ I
        stars: 1,          // 当前星数
        maxTierAchieved: 1,
        protectCards: 1    // 保星卡数量
    },
    characters: {
        activeId: 'c1',
        owned: {
            'c1': { id: 'c1', name: '经典阿强', level: 1, stars: 1, shards: 10 },
            'c2': { id: 'c2', name: '黄大富', level: 1, stars: 0, shards: 0 },
            'c3': { id: 'c3', name: '神算诸葛', level: 1, stars: 0, shards: 0 },
            'c4': { id: 'c4', name: '倾城小曼', level: 1, stars: 0, shards: 0 }
        }
    },
    talents: {
        'talent_card_counter': 1, // 记牌大师 (1~5)
        'talent_rich_reward': 0,  // 财运亨通 (0~5)
        'talent_streak_bonus': 0, // 连胜风暴 (0~5)
        'talent_loss_shield': 0,  // 逢凶化吉 (0~5)
        'talent_lucky_bottom': 0, // 天赐底牌 (0~5)
        'talent_last_stand': 0    // 绝地反击 (0~5)
    },
    quests: {
        lastResetDate: '',
        daily: [
            { id: 'q1', title: '每日打卡', desc: '完成1次每日签到', target: 1, current: 0, rewardCoins: 1000, rewardDiamonds: 5, claimed: false },
            { id: 'q2', title: '勤劳致富', desc: '完成3局斗地主对局', target: 3, current: 0, rewardCoins: 2000, rewardDiamonds: 10, claimed: false },
            { id: 'q3', title: '威震四方', desc: '作为地主获得1次胜利', target: 1, current: 0, rewardCoins: 2500, rewardDiamonds: 10, claimed: false },
            { id: 'q4', title: '轰天动地', desc: '对局中打出1次炸弹或王炸', target: 1, current: 0, rewardCoins: 3000, rewardDiamonds: 15, claimed: false },
            { id: 'q5', title: '春暖花开', desc: '达成1次春天或反春', target: 1, current: 0, rewardCoins: 5000, rewardDiamonds: 25, claimed: false }
        ]
    },
    signIn: {
        lastClaimDate: '',
        consecutiveDays: 0
    },
    relief: {
        lastDate: '',
        timesUsedToday: 0 // 每日最多3次救济金
    },
    achievements: {
        'ach_first_win': { id: 'ach_first_win', name: '首战告捷', desc: '赢得第一场斗地主对局', current: 0, target: 1, rewardDiamonds: 20, title: '', done: false, claimed: false },
        'ach_bomb_master': { id: 'ach_bomb_master', name: '炸弹狂人', desc: '累计打出 20 次炸弹', current: 0, target: 20, rewardDiamonds: 50, title: '核弹狂魔', done: false, claimed: false },
        'ach_spring_master': { id: 'ach_spring_master', name: '春意盎然', desc: '累计达成 5 次春天', current: 0, target: 5, rewardDiamonds: 60, title: '春满人间', done: false, claimed: false },
        'ach_rich_man': { id: 'ach_rich_man', name: '大富豪', desc: '金币总额突破 100,000', current: 0, target: 100000, rewardDiamonds: 100, title: '富甲一方', done: false, claimed: false },
        'ach_streak_5': { id: 'ach_streak_5', name: '势如破竹', desc: '达成 5 连胜', current: 0, target: 5, rewardDiamonds: 80, title: '常胜将军', done: false, claimed: false },
        'ach_reach_diamond': { id: 'ach_reach_diamond', name: '荣登钻石', desc: '排位段位达到永恒钻石', current: 0, target: 5, rewardDiamonds: 150, title: '斗地主大师', done: false, claimed: false }
    },
    cosmetics: {
        equippedTable: 'table_green',
        equippedBack: 'back_blue',
        equippedEffect: 'effect_bomb_classic',
        equippedTitle: '初出茅庐',
        ownedTables: ['table_green'],
        ownedBacks: ['back_blue'],
        ownedEffects: ['effect_bomb_classic'],
        ownedTitles: ['初出茅庐']
    },
    puzzles: {
        completedLevels: [] // 已通过的残局关卡 ID
    }
};

class StorageManager {
    static data = null;

    static load() {
        try {
            if (typeof localStorage === 'undefined') {
                this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
                return this.data;
            }
            const dataStr = localStorage.getItem(STORAGE_KEY);
            if (!dataStr) {
                const initial = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
                this.data = initial;
                this.save(initial);
                return initial;
            }
            const data = JSON.parse(dataStr);
            // 简单的版本补丁合并
            this.data = Object.assign({}, DEFAULT_SAVE_DATA, data);
            return this.data;
        } catch (e) {
            console.error('Failed to load save data:', e);
            this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
            return this.data;
        }
    }

    static save(data = null) {
        try {
            const toSave = data || this.data;
            if (toSave) {
                this.data = toSave;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
                }
            }
        } catch (e) {
            console.error('Failed to write save data:', e);
        }
    }

    static reset() {
        const fresh = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
        this.save(fresh);
        return fresh;
    }

    /**
     * 调试/测试模式：一键获得海量资源，用于完整体验各种养成与解锁
     */
    static grantDebugResources(data) {
        data.currencies.coins += 500000;
        data.currencies.diamonds += 1000;
        data.rank.protectCards += 10;
        data.rank.tier = 5;
        data.rank.subTier = 1;
        data.rank.stars = 3;
        // 解锁全部角色
        Object.keys(data.characters.owned).forEach(k => {
            data.characters.owned[k].stars = 3;
            data.characters.owned[k].level = 10;
        });
        this.save(data);
        return data;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageManager, DEFAULT_SAVE_DATA };
}
