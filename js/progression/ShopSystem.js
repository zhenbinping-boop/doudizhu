/**
 * ShopSystem.js
 * 游戏商城、幸运转盘与个性装扮系统
 */

const WHEEL_PRIZES = [
    { id: 'p1', name: '2,000 金币', type: 'coins', amount: 2000, weight: 30, icon: '🪙' },
    { id: 'p2', name: '5,000 金币', type: 'coins', amount: 5000, weight: 25, icon: '💰' },
    { id: 'p3', name: '15,000 金币', type: 'coins', amount: 15000, weight: 15, icon: '💵' },
    { id: 'p4', name: '50,000 金币', type: 'coins', amount: 50000, weight: 5, icon: '🏦' },
    { id: 'p5', name: '20 钻石', type: 'diamonds', amount: 20, weight: 10, icon: '💎' },
    { id: 'p6', name: '50 钻石', type: 'diamonds', amount: 50, weight: 5, icon: '💠' },
    { id: 'p7', name: '保星卡 × 1', type: 'protectCard', amount: 1, weight: 7, icon: '🛡️' },
    { id: 'p8', name: '黄大富碎片 × 5', type: 'shards', charId: 'c2', amount: 5, weight: 3, icon: '🧩' }
];

const SHOP_ITEMS = [
    // 牌桌皮肤
    { id: 'table_green', type: 'table', name: '经典翡翠', desc: '经久耐看的传统绿呢桌面', cost: 0, costType: 'coins', icon: '🟢' },
    { id: 'table_cyber', type: 'table', name: '赛博霓虹', desc: '充满未来感的深紫荧光电竞桌布', cost: 150, costType: 'diamonds', icon: '🟣' },
    { id: 'table_red', type: 'table', name: '紫禁朱红', desc: '大气质朴的传统皇家红木质感桌布', cost: 250, costType: 'diamonds', icon: '🔴' },
    { id: 'table_blue', type: 'table', name: '深海星空', desc: '沉静幽邃的浩瀚星夜流光牌桌', cost: 400, costType: 'diamonds', icon: '🔵' },

    // 扑克背纹
    { id: 'back_blue', type: 'back', name: '经典雅蓝', desc: '百玩不腻的经典菱形纹理', cost: 0, costType: 'coins', icon: '🃏' },
    { id: 'back_red', type: 'back', name: '赤焰火纹', desc: '战意澎湃的烈焰图腾', cost: 120, costType: 'diamonds', icon: '🔥' },
    { id: 'back_gold', type: 'back', name: '黑金至尊', desc: '顶级 VIP 专属镀金奢华背纹', cost: 300, costType: 'diamonds', icon: '👑' },

    // 出牌与炸弹特效
    { id: 'effect_bomb_classic', type: 'effect', name: '经典爆破', desc: '传统的火花爆炸声效与震颤', cost: 0, costType: 'coins', icon: '💥' },
    { id: 'effect_nuke', type: 'effect', name: '末日核弹', desc: '超强蘑菇云与剧烈全屏震感', cost: 260, costType: 'diamonds', icon: '☢️' },
    { id: 'effect_jet', type: 'effect', name: '超音速歼击', desc: '飞机出牌时轰鸣呼啸战机掠过', cost: 360, costType: 'diamonds', icon: '✈️' }
];

class ShopSystem {
    constructor(saveData) {
        this.data = saveData;
    }

    /**
     * 转盘抽奖
     * @param {boolean} isFree 是否使用每日免费抽
     */
    spinWheel(isFree = false) {
        if (!isFree) {
            if (this.data.currencies.diamonds < 30) {
                return { success: false, message: '钻石不足，抽奖需要 30 钻石！' };
            }
            this.data.currencies.diamonds -= 30;
        }

        // 依据权重随机
        const totalWeight = WHEEL_PRIZES.reduce((acc, p) => acc + p.weight, 0);
        let rand = Math.random() * totalWeight;
        let selectedPrize = WHEEL_PRIZES[0];

        for (const prize of WHEEL_PRIZES) {
            if (rand < prize.weight) {
                selectedPrize = prize;
                break;
            }
            rand -= prize.weight;
        }

        // 发放奖励
        if (selectedPrize.type === 'coins') {
            this.data.currencies.coins += selectedPrize.amount;
        } else if (selectedPrize.type === 'diamonds') {
            this.data.currencies.diamonds += selectedPrize.amount;
        } else if (selectedPrize.type === 'protectCard') {
            this.data.rank.protectCards = (this.data.rank.protectCards || 0) + selectedPrize.amount;
        } else if (selectedPrize.type === 'shards') {
            if (this.data.characters.owned[selectedPrize.charId]) {
                this.data.characters.owned[selectedPrize.charId].shards += selectedPrize.amount;
            }
        }

        return {
            success: true,
            prize: selectedPrize
        };
    }

    /**
     * 购买装扮
     */
    buyItem(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: '商品不存在' };

        const isOwned = this.isItemOwned(item);
        if (isOwned) return { success: false, message: '已经拥有该装扮' };

        if (item.costType === 'diamonds') {
            if (this.data.currencies.diamonds < item.cost) {
                return { success: false, message: `钻石不足，需要 ${item.cost} 钻石` };
            }
            this.data.currencies.diamonds -= item.cost;
        } else {
            if (this.data.currencies.coins < item.cost) {
                return { success: false, message: `金币不足，需要 ${item.cost} 金币` };
            }
            this.data.currencies.coins -= item.cost;
        }

        // 加入已拥有
        if (item.type === 'table') this.data.cosmetics.ownedTables.push(item.id);
        if (item.type === 'back') this.data.cosmetics.ownedBacks.push(item.id);
        if (item.type === 'effect') this.data.cosmetics.ownedEffects.push(item.id);

        return { success: true, item };
    }

    /**
     * 装备装扮
     */
    equipItem(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: '无效装扮' };
        if (!this.isItemOwned(item)) return { success: false, message: '尚未拥有该装扮' };

        if (item.type === 'table') this.data.cosmetics.equippedTable = item.id;
        if (item.type === 'back') this.data.cosmetics.equippedBack = item.id;
        if (item.type === 'effect') this.data.cosmetics.equippedEffect = item.id;

        return { success: true };
    }

    isItemOwned(item) {
        if (item.cost === 0) return true;
        if (item.type === 'table') return this.data.cosmetics.ownedTables.includes(item.id);
        if (item.type === 'back') return this.data.cosmetics.ownedBacks.includes(item.id);
        if (item.type === 'effect') return this.data.cosmetics.ownedEffects.includes(item.id);
        return false;
    }

    isItemEquipped(item) {
        if (item.type === 'table') return this.data.cosmetics.equippedTable === item.id;
        if (item.type === 'back') return this.data.cosmetics.equippedBack === item.id;
        if (item.type === 'effect') return this.data.cosmetics.equippedEffect === item.id;
        return false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShopSystem, SHOP_ITEMS, WHEEL_PRIZES };
}
