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
    // 1. 牌桌桌布 (Table Skins)
    { id: 'table_green', type: 'table', name: '经典翡翠', desc: '经久耐看的蒙特卡洛深祖母绿羊毛呢绒', cost: 0, costType: 'coins', rarity: 'common', tag: '经典', icon: '🟢', previewClass: 'prev-table-green' },
    { id: 'table_wood', type: 'table', name: '沉香檀木', desc: '雅致深红实木古木桌垫，配温润暗纹与黄铜饰线', cost: 38000, costType: 'coins', rarity: 'rare', tag: '珍藏', icon: '🪵', previewClass: 'prev-table-wood' },
    { id: 'table_cyber', type: 'table', name: '赛博霓虹', desc: '未来科技深紫幽蓝光效、流动电路线条与荧光星盘', cost: 260, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '🟣', previewClass: 'prev-table-cyber' },
    { id: 'table_red', type: 'table', name: '紫禁御宴', desc: '宫廷朱红金丝锦缎、云锦金龙暗纹、富贵逼人', cost: 480, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '🔴', previewClass: 'prev-table-red' },
    { id: 'table_blue', type: 'table', name: '浩瀚星河', desc: '沉静幽邃的群青深空、星图环绕与流星轨迹微光', cost: 780, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '🌌', previewClass: 'prev-table-blue' },
    { id: 'table_gold', type: 'table', name: '黑金至尊·龙腾九天', desc: '顶奢磨砂曜黑绒面、真金双龙戏珠浮雕、耀金流光光环', cost: 1680, costType: 'diamonds', rarity: 'legendary', tag: '典藏至尊', icon: '👑', previewClass: 'prev-table-gold' },

    // 2. 扑克牌背 (Card Back Skins)
    { id: 'back_blue', type: 'back', name: '经典雅蓝', desc: '纯正经典的皇家深蓝菱格纹理', cost: 0, costType: 'coins', rarity: 'common', tag: '经典', icon: '🃏', previewClass: 'prev-back-blue' },
    { id: 'back_classic_red', type: 'back', name: '中国红菱', desc: '喜庆热烈的传统宫廷红菱几何纹饰', cost: 20000, costType: 'coins', rarity: 'rare', tag: '珍藏', icon: '🧧', previewClass: 'prev-back-red' },
    { id: 'back_bamboo', type: 'back', name: '青竹幽韵', desc: '水墨江南幽篁翠竹，玉石质感温润如脂', cost: 58000, costType: 'coins', rarity: 'rare', tag: '珍藏', icon: '🎋', previewClass: 'prev-back-bamboo' },
    { id: 'back_cyber', type: 'back', name: '赛博芯片', desc: '霓虹赛博矩阵发光电路板，科幻数码流光', cost: 320, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '⚡', previewClass: 'prev-back-cyber' },
    { id: 'back_flame', type: 'back', name: '赤焰火纹', desc: '战意澎湃的烈焰图腾与火红熔岩脉络', cost: 580, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '🔥', previewClass: 'prev-back-flame' },
    { id: 'back_silver', type: 'back', name: '玄银冰魄', desc: '冷艳月影铂金雕花，带微光霜华冰晶', cost: 880, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '❄️', previewClass: 'prev-back-silver' },
    { id: 'back_gold', type: 'back', name: '黑金至尊·金龙傲世', desc: '纯黑哑光磨砂底面与立体手工掐丝金龙纹，尊贵无双', cost: 1880, costType: 'diamonds', rarity: 'legendary', tag: '典藏至尊', icon: '🐉', previewClass: 'prev-back-gold' },

    // 3. 轰鸣特效 (Play & Bomb Effects)
    { id: 'effect_bomb_classic', type: 'effect', name: '经典爆破', desc: '传统的火花爆炸声效与牌桌震颤', cost: 0, costType: 'coins', rarity: 'common', tag: '经典', icon: '💥', previewClass: 'prev-effect-classic' },
    { id: 'effect_fireworks', type: 'effect', name: '祥瑞礼炮', desc: '打出炸弹时绚丽彩金礼花齐鸣，万枚金币喷涌', cost: 68000, costType: 'coins', rarity: 'rare', tag: '珍藏', icon: '🎆', previewClass: 'prev-effect-fireworks' },
    { id: 'effect_lightning', type: 'effect', name: '狂雷天降', desc: '紫电撕裂苍穹，高压电弧激荡与重低音雷鸣', cost: 420, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '⚡', previewClass: 'prev-effect-lightning' },
    { id: 'effect_nuke', type: 'effect', name: '末日核弹', desc: '毁灭级升腾蘑菇云与剧烈全屏震感，寸草不生', cost: 720, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '☢️', previewClass: 'prev-effect-nuke' },
    { id: 'effect_jet', type: 'effect', name: '超音速歼击', desc: '打出飞机时双战机编队破音障超低空轰鸣掠过', cost: 980, costType: 'diamonds', rarity: 'epic', tag: '史诗', icon: '🚀', previewClass: 'prev-effect-jet' },
    { id: 'effect_dragon', type: 'effect', name: '龙吟九霄·天尊降世', desc: '打出炸弹与王炸时金光万道，五爪神龙盘旋升空长吟', cost: 2180, costType: 'diamonds', rarity: 'legendary', tag: '典藏至尊', icon: '✨', previewClass: 'prev-effect-dragon' },

    // 4. 专属称号 (Custom Titles)
    { id: 'title_apprentice', type: 'title', name: '初出茅庐', desc: '初入江湖，勤勉求教的年轻牌友', cost: 0, costType: 'coins', rarity: 'common', tag: '经典', titleText: '初出茅庐', icon: '🌱' },
    { id: 'title_pro', type: 'title', name: '江湖老手', desc: '牌术精湛，身经百战的牌坛老客', cost: 28000, costType: 'coins', rarity: 'rare', tag: '珍藏', titleText: '江湖老手', icon: '🥋' },
    { id: 'title_tycoon', type: 'title', name: '富甲一方', desc: '金币如流水，豪气冲天的大富豪', cost: 99000, costType: 'coins', rarity: 'rare', tag: '珍藏', titleText: '富甲一方', icon: '💰' },
    { id: 'title_king', type: 'title', name: '牌坛霸主', desc: '威风凛凛，傲视群雄的竞技霸王', cost: 660, costType: 'diamonds', rarity: 'epic', tag: '史诗', titleText: '牌坛霸主', icon: '🦅' },
    { id: 'title_god', type: 'title', name: '斗地主之神', desc: '登峰造极，君临天下的牌坛无上至尊', cost: 1999, costType: 'diamonds', rarity: 'legendary', tag: '典藏至尊', titleText: '斗地主之神', icon: '👑' }
];

class ShopSystem {
    constructor(saveData) {
        this.data = saveData;
        this.ensureDataSchema();
    }

    ensureDataSchema() {
        if (!this.data.cosmetics) {
            this.data.cosmetics = {
                equippedTable: 'table_green',
                equippedBack: 'back_blue',
                equippedEffect: 'effect_bomb_classic',
                equippedTitle: '初出茅庐',
                ownedTables: ['table_green'],
                ownedBacks: ['back_blue'],
                ownedEffects: ['effect_bomb_classic'],
                ownedTitles: ['初出茅庐']
            };
        }
        if (!this.data.cosmetics.ownedTables) this.data.cosmetics.ownedTables = ['table_green'];
        if (!this.data.cosmetics.ownedBacks) this.data.cosmetics.ownedBacks = ['back_blue'];
        if (!this.data.cosmetics.ownedEffects) this.data.cosmetics.ownedEffects = ['effect_bomb_classic'];
        if (!this.data.cosmetics.ownedTitles) this.data.cosmetics.ownedTitles = ['初出茅庐'];
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
        this.ensureDataSchema();
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: '商品不存在' };

        const isOwned = this.isItemOwned(item);
        if (isOwned) return { success: false, message: '已经拥有该装扮' };

        if (item.costType === 'diamonds') {
            if (this.data.currencies.diamonds < item.cost) {
                return { success: false, message: `钻石不足！购买【${item.name}】需要 ${item.cost} 钻石` };
            }
            this.data.currencies.diamonds -= item.cost;
        } else {
            if (this.data.currencies.coins < item.cost) {
                return { success: false, message: `金币不足！购买【${item.name}】需要 ${item.cost.toLocaleString()} 金币` };
            }
            this.data.currencies.coins -= item.cost;
        }

        // 加入已拥有
        if (item.type === 'table' && !this.data.cosmetics.ownedTables.includes(item.id)) {
            this.data.cosmetics.ownedTables.push(item.id);
        }
        if (item.type === 'back' && !this.data.cosmetics.ownedBacks.includes(item.id)) {
            this.data.cosmetics.ownedBacks.push(item.id);
        }
        if (item.type === 'effect' && !this.data.cosmetics.ownedEffects.includes(item.id)) {
            this.data.cosmetics.ownedEffects.push(item.id);
        }
        if (item.type === 'title') {
            const titleName = item.titleText || item.name;
            if (!this.data.cosmetics.ownedTitles.includes(titleName)) {
                this.data.cosmetics.ownedTitles.push(titleName);
            }
        }

        // 购买后自动装备
        this.equipItem(item.id);

        return { success: true, item, message: `🎉 成功解锁【${item.name}】并已自动佩戴！` };
    }

    /**
     * 装备装扮
     */
    equipItem(itemId) {
        this.ensureDataSchema();
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: '无效装扮' };
        if (!this.isItemOwned(item)) return { success: false, message: '尚未拥有该装扮' };

        if (item.type === 'table') this.data.cosmetics.equippedTable = item.id;
        if (item.type === 'back') this.data.cosmetics.equippedBack = item.id;
        if (item.type === 'effect') this.data.cosmetics.equippedEffect = item.id;
        if (item.type === 'title') {
            const titleName = item.titleText || item.name;
            this.data.cosmetics.equippedTitle = titleName;
            this.data.profile.title = titleName;
        }

        return { success: true, item, message: `✨ 已成功切换佩戴：【${item.name}】！` };
    }

    isItemOwned(item) {
        this.ensureDataSchema();
        if (item.cost === 0) return true;
        if (item.type === 'table') return this.data.cosmetics.ownedTables.includes(item.id);
        if (item.type === 'back') return this.data.cosmetics.ownedBacks.includes(item.id);
        if (item.type === 'effect') return this.data.cosmetics.ownedEffects.includes(item.id);
        if (item.type === 'title') {
            const titleName = item.titleText || item.name;
            return (this.data.cosmetics.ownedTitles || []).includes(titleName);
        }
        return false;
    }

    isItemEquipped(item) {
        this.ensureDataSchema();
        if (item.type === 'table') return this.data.cosmetics.equippedTable === item.id;
        if (item.type === 'back') return this.data.cosmetics.equippedBack === item.id;
        if (item.type === 'effect') return this.data.cosmetics.equippedEffect === item.id;
        if (item.type === 'title') {
            const titleName = item.titleText || item.name;
            return this.data.cosmetics.equippedTitle === titleName;
        }
        return false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShopSystem, SHOP_ITEMS, WHEEL_PRIZES };
}
