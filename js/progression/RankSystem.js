/**
 * RankSystem.js
 * 排位天梯段位系统：青铜 -> 白银 -> 黄金 -> 铂金 -> 钻石 -> 星耀 -> 雀圣
 * 支持：胜负升星/掉星、连胜暴击加星、保星卡抵扣、晋级大段位动画数据
 */

const RANK_TIERS = [
    { tier: 1, name: '倔强青铜', icon: '🥉', subTiers: 3, starsPerSub: 3, dropStar: false },
    { tier: 2, name: '秩序白银', icon: '🥈', subTiers: 3, starsPerSub: 3, dropStar: true },
    { tier: 3, name: '荣耀黄金', icon: '🥇', subTiers: 4, starsPerSub: 4, dropStar: true },
    { tier: 4, name: '尊贵铂金', icon: '💎', subTiers: 4, starsPerSub: 4, dropStar: true },
    { tier: 5, name: '永恒钻石', icon: '👑', subTiers: 5, starsPerSub: 5, dropStar: true },
    { tier: 6, name: '至尊星耀', icon: '🌟', subTiers: 5, starsPerSub: 5, dropStar: true },
    { tier: 7, name: '绝世雀圣', icon: '🐉', subTiers: 1, starsPerSub: 9999, dropStar: true }
];

const SUB_TIER_NAMES = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };

class RankSystem {
    constructor(saveData) {
        this.data = saveData;
    }

    get rankData() {
        return this.data.rank;
    }

    /**
     * 获取当前段位详细展示文本与配置
     */
    getCurrentRankInfo() {
        const tierConfig = RANK_TIERS.find(t => t.tier === this.rankData.tier) || RANK_TIERS[0];
        const subName = tierConfig.tier === 7 ? '' : ` ${SUB_TIER_NAMES[this.rankData.subTier] || 'I'}`;
        const fullName = `${tierConfig.name}${subName}`;
        const starText = tierConfig.tier === 7 ? 
            `${this.rankData.stars}★` : 
            `${this.rankData.stars}/${tierConfig.starsPerSub}★`;

        return {
            tier: tierConfig.tier,
            name: fullName,
            shortName: tierConfig.name,
            icon: tierConfig.icon,
            subTier: this.rankData.subTier,
            stars: this.rankData.stars,
            maxStars: tierConfig.starsPerSub,
            starText: starText,
            protectCards: this.rankData.protectCards || 0
        };
    }

    /**
     * 对局获胜结算段位星数
     * @param {number} streak 当前连胜数
     * @param {Object} bonusOptions 天赋或角色加成
     * @returns {Object} { starChange: number, promoted: boolean, newRankInfo: Object }
     */
    handleMatchWin(streak = 1, bonusOptions = {}) {
        let starGain = 1;

        // 3连胜及以上且拥有连胜天赋或特定段位额外奖励+1星
        if (streak >= 3 && (bonusOptions.streakBonus || Math.random() < 0.3)) {
            starGain += 1;
        }

        // 角色小曼特殊技能加成：春天胜利额外获得1星
        if (bonusOptions.isSpringDouble) {
            starGain += 1;
        }

        const oldTier = this.rankData.tier;
        const tierConfig = RANK_TIERS.find(t => t.tier === this.rankData.tier);
        let promoted = false;

        this.rankData.stars += starGain;

        if (tierConfig.tier < 7) {
            // 检查是否升子段位或大段位
            while (this.rankData.stars > tierConfig.starsPerSub && this.rankData.tier < 7) {
                this.rankData.stars -= tierConfig.starsPerSub;
                if (this.rankData.subTier > 1) {
                    this.rankData.subTier -= 1; // III -> II -> I
                } else {
                    // 晋级到下一个大段位！
                    this.rankData.tier += 1;
                    const nextTier = RANK_TIERS.find(t => t.tier === this.rankData.tier);
                    this.rankData.subTier = nextTier.subTiers;
                    promoted = true;
                }
            }
        }

        if (this.rankData.tier > (this.rankData.maxTierAchieved || 1)) {
            this.rankData.maxTierAchieved = this.rankData.tier;
        }

        return {
            starChange: starGain,
            promoted: promoted || (this.rankData.tier > oldTier),
            rankInfo: this.getCurrentRankInfo()
        };
    }

    /**
     * 对局失败结算段位星数
     * @returns {Object} { starChange: number, demoted: boolean, protectedByCard: boolean, rankInfo: Object }
     */
    handleMatchLoss() {
        const tierConfig = RANK_TIERS.find(t => t.tier === this.rankData.tier);

        // 青铜段位不掉星
        if (!tierConfig.dropStar) {
            return {
                starChange: 0,
                demoted: false,
                protectedByCard: false,
                rankInfo: this.getCurrentRankInfo(),
                message: '青铜段位受新手保护，不掉星！'
            };
        }

        // 保星卡保护
        if (this.rankData.protectCards > 0) {
            this.rankData.protectCards -= 1;
            return {
                starChange: 0,
                demoted: false,
                protectedByCard: true,
                rankInfo: this.getCurrentRankInfo(),
                message: '消耗 1 张保星卡，段位星数不受损失！'
            };
        }

        let demoted = false;
        if (this.rankData.stars > 0) {
            this.rankData.stars -= 1;
        } else {
            // 掉子段位
            if (this.rankData.subTier < tierConfig.subTiers) {
                this.rankData.subTier += 1;
                this.rankData.stars = tierConfig.starsPerSub - 1;
                demoted = true;
            } else if (this.rankData.tier > 1) {
                // 掉大段位
                this.rankData.tier -= 1;
                const prevTier = RANK_TIERS.find(t => t.tier === this.rankData.tier);
                this.rankData.subTier = 1;
                this.rankData.stars = prevTier.starsPerSub - 1;
                demoted = true;
            }
        }

        return {
            starChange: -1,
            demoted: demoted,
            protectedByCard: false,
            rankInfo: this.getCurrentRankInfo()
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RankSystem, RANK_TIERS };
}
