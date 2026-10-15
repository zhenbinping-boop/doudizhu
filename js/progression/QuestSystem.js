/**
 * QuestSystem.js
 * 任务系统、成就里程碑与7天签到
 */

const SIGN_IN_REWARDS = [
    { day: 1, text: '1,500 金币', coins: 1500, diamonds: 0, shards: 0, protectCard: 0 },
    { day: 2, text: '2,500 金币 + 15 钻石', coins: 2500, diamonds: 15, shards: 0, protectCard: 0 },
    { day: 3, text: '排位保星卡 × 1', coins: 1000, diamonds: 10, shards: 0, protectCard: 1 },
    { day: 4, text: '4,000 金币', coins: 4000, diamonds: 20, shards: 0, protectCard: 0 },
    { day: 5, text: '35 钻石 + 5 阿强碎片', coins: 3000, diamonds: 35, shards: 5, protectCard: 0 },
    { day: 6, text: '6,000 金币 + 保星卡 × 1', coins: 6000, diamonds: 25, shards: 0, protectCard: 1 },
    { day: 7, text: '10,000 金币 + 88 钻石 + 专属称号', coins: 10000, diamonds: 88, shards: 10, protectCard: 1, title: '七日雀皇' }
];

class QuestSystem {
    constructor(saveData) {
        this.data = saveData;
        this.checkDailyReset();
    }

    checkDailyReset() {
        const todayStr = new Date().toDateString();
        if (this.data.quests.lastResetDate !== todayStr) {
            this.data.quests.lastResetDate = todayStr;
            this.data.quests.daily.forEach(q => {
                q.current = 0;
                q.claimed = false;
            });
        }
    }

    /**
     * 7天每日签到状态
     */
    getSignInStatus() {
        const todayStr = new Date().toDateString();
        const canClaim = this.data.signIn.lastClaimDate !== todayStr;
        const currentDayIndex = (this.data.signIn.consecutiveDays % 7);

        return {
            canClaim,
            consecutiveDays: this.data.signIn.consecutiveDays,
            currentDayIndex,
            rewards: SIGN_IN_REWARDS
        };
    }

    /**
     * 执行签到领奖
     */
    claimSignIn() {
        const status = this.getSignInStatus();
        if (!status.canClaim) {
            return { success: false, message: '今日已完成签到，请明天再来！' };
        }

        const todayReward = SIGN_IN_REWARDS[status.currentDayIndex];
        this.data.currencies.coins += todayReward.coins;
        this.data.currencies.diamonds += todayReward.diamonds;
        if (todayReward.protectCard) {
            this.data.rank.protectCards = (this.data.rank.protectCards || 0) + todayReward.protectCard;
        }
        if (todayReward.shards) {
            this.data.characters.owned['c1'].shards += todayReward.shards;
        }
        if (todayReward.title) {
            if (!this.data.cosmetics.ownedTitles.includes(todayReward.title)) {
                this.data.cosmetics.ownedTitles.push(todayReward.title);
            }
        }

        this.data.signIn.lastClaimDate = new Date().toDateString();
        this.data.signIn.consecutiveDays += 1;

        // 推进每日签到任务
        this.triggerQuestEvent('q1', 1);

        return {
            success: true,
            reward: todayReward
        };
    }

    /**
     * 对局结束触发任务与成就更新
     */
    onMatchFinished(stats) {
        const { isWin, isLandlord, bombsPlayed, isSpring, coinsWon } = stats;

        // 推进每日任务
        this.triggerQuestEvent('q2', 1); // 勤劳致富（玩一局）
        if (isWin && isLandlord) {
            this.triggerQuestEvent('q3', 1); // 威震四方（地主胜）
        }
        if (bombsPlayed > 0) {
            this.triggerQuestEvent('q4', bombsPlayed); // 轰天动地（打出炸弹）
        }
        if (isSpring) {
            this.triggerQuestEvent('q5', 1); // 春意盎然（春天）
        }

        // 推进成就
        if (isWin) {
            this.updateAchievement('ach_first_win', 1);
        }
        if (bombsPlayed > 0) {
            this.updateAchievement('ach_bomb_master', bombsPlayed);
        }
        if (isSpring) {
            this.updateAchievement('ach_spring_master', 1);
        }
        if (this.data.currencies.coins >= 100000) {
            this.updateAchievement('ach_rich_man', this.data.currencies.coins);
        }
        if (this.data.profile.currentStreak >= 5) {
            this.updateAchievement('ach_streak_5', this.data.profile.currentStreak);
        }
        if (this.data.rank.tier >= 5) {
            this.updateAchievement('ach_reach_diamond', this.data.rank.tier);
        }
    }

    triggerQuestEvent(questId, amount = 1) {
        this.checkDailyReset();
        const quest = this.data.quests.daily.find(q => q.id === questId);
        if (quest && !quest.claimed) {
            quest.current = Math.min(quest.target, quest.current + amount);
        }
    }

    claimQuestReward(questId) {
        const quest = this.data.quests.daily.find(q => q.id === questId);
        if (!quest) return { success: false, message: '任务不存在' };
        if (quest.claimed) return { success: false, message: '奖励已领取' };
        if (quest.current < quest.target) return { success: false, message: '任务未达成' };

        quest.claimed = true;
        this.data.currencies.coins += quest.rewardCoins;
        this.data.currencies.diamonds += quest.rewardDiamonds;

        return {
            success: true,
            rewardCoins: quest.rewardCoins,
            rewardDiamonds: quest.rewardDiamonds
        };
    }

    updateAchievement(achId, amount, isDirectSet = false) {
        const ach = this.data.achievements[achId];
        if (!ach || ach.done) return;

        if (isDirectSet) {
            ach.current = Math.max(ach.current, amount);
        } else {
            ach.current += amount;
        }

        if (ach.current >= ach.target) {
            ach.done = true;
        }
    }

    claimAchievementReward(achId) {
        const ach = this.data.achievements[achId];
        if (!ach) return { success: false, message: '成就未找到' };
        if (ach.claimed) return { success: false, message: '已领取该成就奖励' };
        if (!ach.done) return { success: false, message: '成就尚未完成' };

        ach.claimed = true;
        this.data.currencies.diamonds += ach.rewardDiamonds;

        if (ach.title && !this.data.cosmetics.ownedTitles.includes(ach.title)) {
            this.data.cosmetics.ownedTitles.push(ach.title);
        }

        return {
            success: true,
            diamonds: ach.rewardDiamonds,
            title: ach.title
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuestSystem, SIGN_IN_REWARDS };
}
