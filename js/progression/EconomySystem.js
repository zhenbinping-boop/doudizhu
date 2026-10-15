/**
 * EconomySystem.js
 * 局外经济与资源管理：金币、钻石、体力与破产救济金
 */

class EconomySystem {
    constructor(saveData) {
        this.data = saveData;
        this.updateEnergy();
        this.checkDailyReliefReset();
    }

    /**
     * 体力随时间恢复 (每5分钟恢复1点)
     */
    updateEnergy() {
        const cur = this.data.currencies;
        const now = Date.now();
        const diffMs = now - (cur.lastEnergyUpdate || now);
        const restoreIntervalMs = 5 * 60 * 1000; // 5分钟
        const pointsToAdd = Math.floor(diffMs / restoreIntervalMs);

        if (pointsToAdd > 0 && cur.energy < cur.maxEnergy) {
            cur.energy = Math.min(cur.maxEnergy, cur.energy + pointsToAdd);
            cur.lastEnergyUpdate = now - (diffMs % restoreIntervalMs);
        }
    }

    /**
     * 消耗体力
     */
    consumeEnergy(amount = 2) {
        this.updateEnergy();
        if (this.data.currencies.energy >= amount) {
            this.data.currencies.energy -= amount;
            return true;
        }
        return false;
    }

    /**
     * 检查并重置每日救济金次数
     */
    checkDailyReliefReset() {
        const todayStr = new Date().toDateString();
        if (this.data.relief.lastDate !== todayStr) {
            this.data.relief.lastDate = todayStr;
            this.data.relief.timesUsedToday = 0;
        }
    }

    /**
     * 是否可以领取破产救济金 (金币 < 1000 且当日次数 < 3)
     */
    canClaimRelief() {
        this.checkDailyReliefReset();
        return this.data.currencies.coins < 1000 && this.data.relief.timesUsedToday < 3;
    }

    /**
     * 领取破产救济金 (每次发放 3,000 金币)
     */
    claimRelief() {
        if (!this.canClaimRelief()) {
            return { success: false, message: '今日救济金次数已用尽或金币充足' };
        }
        this.data.currencies.coins += 3000;
        this.data.relief.timesUsedToday += 1;
        return {
            success: true,
            coinsAdded: 3000,
            remainingTimes: 3 - this.data.relief.timesUsedToday
        };
    }

    /**
     * 增加金币/钻石
     */
    addCoins(amount) {
        this.data.currencies.coins = Math.max(0, this.data.currencies.coins + amount);
    }

    addDiamonds(amount) {
        this.data.currencies.diamonds = Math.max(0, this.data.currencies.diamonds + amount);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EconomySystem };
}
