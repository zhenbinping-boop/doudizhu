/**
 * GameEngine.js
 * 斗地主对局状态机引擎
 * 管理：发牌、叫地主/抢地主、加倍、出牌轮转、记牌器数据同步、春天/反春判定、倍数结算与胜负处理
 */

if (typeof require !== 'undefined' && typeof RuleEngine === 'undefined') {
    var { Card } = require('./Card');
    var { Deck } = require('./Deck');
    var { RuleEngine, CARD_TYPES, HandCombination } = require('./RuleEngine');
    var { AIPlayer } = require('./AIPlayer');
}

const VENUES = {
    'novice': { id: 'novice', name: '新手初级场', baseScore: 100, minCoins: 500, icon: '🌱' },
    'expert': { id: 'expert', name: '进阶高手场', baseScore: 500, minCoins: 3000, icon: '🔥' },
    'master': { id: 'master', name: '大师荣耀场', baseScore: 2000, minCoins: 15000, icon: '👑' },
    'legend': { id: 'legend', name: '至尊巅峰场', baseScore: 10000, minCoins: 100000, icon: '🐉' },
    'no_shuffle': { id: 'no_shuffle', name: '不洗牌狂欢场', baseScore: 800, minCoins: 5000, icon: '⚡' }
};

const GAME_STATES = {
    IDLE: 'IDLE',
    DEALING: 'DEALING',
    BIDDING: 'BIDDING',
    DOUBLING: 'DOUBLING',
    PLAYING: 'PLAYING',
    ROUND_OVER: 'ROUND_OVER'
};

class GameEngine {
    constructor(systems) {
        this.systems = systems; // { storage, economy, rank, character, talent, quest, shop, puzzle }
        this.venue = VENUES['novice'];
        this.mode = 'CLASSIC'; // 'CLASSIC', 'NO_SHUFFLE', 'PUZZLE'
        this.state = GAME_STATES.IDLE;

        // 对局数据
        this.playerHands = [[], [], []]; // 0=玩家自己, 1=左侧AI, 2=右侧AI
        this.bottomCards = [];
        this.landlordSeat = -1;
        this.currentTurn = 0;
        this.highestBid = 0;
        this.highestBidder = -1;
        this.bidHistory = []; // 叫分历史
        this.biddingRound = 0;

        // 倍数控制
        this.baseMultiplier = 1;
        this.bombCount = 0;
        this.playerDoubles = [1, 1, 1]; // 0, 1, 2 每人的加倍系数 (1=不加倍, 2=加倍, 4=超级加倍)

        // 桌面出牌状态
        this.tableLastHand = null;
        this.tableLastSeat = -1;
        this.passCount = 0;
        this.playHistory = []; // [{ seat, hand, timestamp }]

        // 春天判定统计
        this.farmerPlaysCount = [0, 0, 0]; // 各家出牌手数统计
        this.landlordPlaysCount = 0;

        // 记牌器牌池剩余统计 (点数 3~17 => 剩余张数)
        this.remainingCardCounts = new Map();

        // 事件监听器 (UI 绑定)
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * 开始新对局
     */
    startMatch(venueKey = 'novice', mode = 'CLASSIC') {
        this.venue = VENUES[venueKey] || VENUES['novice'];
        this.mode = mode;

        // 检查金币门槛
        if (this.systems.storage.data.currencies.coins < this.venue.minCoins) {
            return {
                success: false,
                reason: 'COINS_NOT_ENOUGH',
                message: `进入该场次需要至少 ${this.venue.minCoins} 金币！`
            };
        }

        // 消耗体力
        this.systems.economy.consumeEnergy(2);

        this.state = GAME_STATES.DEALING;
        this.bombCount = 0;
        this.playerDoubles = [1, 1, 1];
        this.tableLastHand = null;
        this.tableLastSeat = -1;
        this.passCount = 0;
        this.playHistory = [];
        this.farmerPlaysCount = [0, 0, 0];
        this.landlordPlaysCount = 0;

        // 初始化牌堆
        const deck = new Deck();
        if (this.mode === 'NO_SHUFFLE') {
            deck.noShuffle();
        } else {
            deck.shuffle();
        }

        // 角色天赋判定：天赐底牌加成
        const luckyBottomLevel = this.systems.talent.getTalentLevel('talent_lucky_bottom');
        const dealResult = deck.deal({
            luckyBottom: luckyBottomLevel > 0,
            luckyBottomRate: luckyBottomLevel * 0.15
        });

        this.playerHands = dealResult.playerHands;
        this.bottomCards = dealResult.bottomCards;

        // 初始化记牌器
        this.initCardCounter();

        this.emit('deal_finished', {
            playerHands: this.playerHands,
            bottomCards: this.bottomCards,
            venue: this.venue
        });

        // 开启叫地主阶段
        this.startBidding();

        return { success: true };
    }

    /**
     * 初始化记牌器牌池数据
     */
    initCardCounter() {
        this.remainingCardCounts.clear();
        for (let r = 3; r <= 15; r++) this.remainingCardCounts.set(r, 4);
        this.remainingCardCounts.set(16, 1); // 小王
        this.remainingCardCounts.set(17, 1); // 大王

        // 扣除玩家自己手中的牌
        for (const c of this.playerHands[0]) {
            const cur = this.remainingCardCounts.get(c.rank) || 0;
            this.remainingCardCounts.set(c.rank, Math.max(0, cur - 1));
        }
    }

    /**
     * 当有牌被打出或底牌翻开时，同步记牌器
     */
    updateCardCounter(cards) {
        for (const c of cards) {
            const cur = this.remainingCardCounts.get(c.rank) || 0;
            this.remainingCardCounts.set(c.rank, Math.max(0, cur - 1));
        }
        this.emit('card_counter_updated', {
            counts: Object.fromEntries(this.remainingCardCounts)
        });
    }

    /**
     * 进入叫地主阶段
     */
    startBidding() {
        this.state = GAME_STATES.BIDDING;
        this.highestBid = 0;
        this.highestBidder = -1;
        this.bidHistory = [];
        this.biddingRound = 0;
        // 随机指定首位叫牌玩家
        this.currentTurn = Math.floor(Math.random() * 3);

        this.emit('bid_turn_start', {
            seat: this.currentTurn,
            highestBid: this.highestBid
        });

        this.checkBiddingTurn();
    }

    checkBiddingTurn() {
        if (this.state !== GAME_STATES.BIDDING) return;

        // 如果是电脑玩家，AI 自动决策
        if (this.currentTurn !== 0) {
            setTimeout(() => {
                const aiBid = AIPlayer.decideBid(this.playerHands[this.currentTurn], this.highestBid);
                this.handlePlayerBid(this.currentTurn, aiBid);
            }, 800);
        }
    }

    /**
     * 玩家/AI 执行叫分
     * @param {number} seat 0, 1, 2
     * @param {number} bid 0(不叫), 1, 2, 3
     */
    handlePlayerBid(seat, bid) {
        if (this.state !== GAME_STATES.BIDDING || seat !== this.currentTurn) return;

        if (bid > this.highestBid) {
            this.highestBid = bid;
            this.highestBidder = seat;
        }

        this.bidHistory.push({ seat, bid });
        this.biddingRound += 1;

        this.emit('bid_action', {
            seat,
            bid,
            highestBid: this.highestBid,
            highestBidder: this.highestBidder
        });

        // 如果有人直接叫 3 分，立即成为地主
        if (this.highestBid === 3) {
            this.finalizeLandlord(this.highestBidder, 3);
            return;
        }

        // 3个人都叫过一轮
        if (this.biddingRound >= 3) {
            if (this.highestBidder !== -1) {
                this.finalizeLandlord(this.highestBidder, this.highestBid);
            } else {
                // 三人都不叫：重新发牌或默认当前玩家1分当地主
                this.emit('all_passed_bidding', {});
                setTimeout(() => {
                    this.startMatch(this.venue.id, this.mode);
                }, 1500);
            }
            return;
        }

        // 轮到下一家叫牌
        this.currentTurn = (this.currentTurn + 1) % 3;
        this.emit('bid_turn_start', {
            seat: this.currentTurn,
            highestBid: this.highestBid
        });
        this.checkBiddingTurn();
    }

    /**
     * 确定地主并分配底牌
     */
    finalizeLandlord(landlordSeat, finalBid) {
        this.landlordSeat = landlordSeat;
        this.baseMultiplier = Math.max(1, finalBid);

        // 底牌给地主
        this.playerHands[landlordSeat].push(...this.bottomCards);
        this.playerHands[landlordSeat].sort(Card.compare);

        // 如果玩家自己不是地主，更新记牌器中公开的三张底牌
        if (this.landlordSeat !== 0) {
            this.updateCardCounter(this.bottomCards);
        }

        this.emit('landlord_decided', {
            landlordSeat,
            bottomCards: this.bottomCards,
            baseMultiplier: this.baseMultiplier
        });

        // 开启加倍阶段
        this.startDoubling();
    }

    /**
     * 加倍阶段
     */
    startDoubling() {
        this.state = GAME_STATES.DOUBLING;
        this.emit('doubling_start', {});

        // 左右 AI 自动选择加倍策略
        const ai1Double = AIPlayer.decideDouble(this.playerHands[1], this.landlordSeat === 1);
        const ai2Double = AIPlayer.decideDouble(this.playerHands[2], this.landlordSeat === 2);
        this.playerDoubles[1] = ai1Double;
        this.playerDoubles[2] = ai2Double;

        // 提示 AI 加倍结果
        setTimeout(() => {
            this.emit('ai_doubled', { seat: 1, double: ai1Double });
            this.emit('ai_doubled', { seat: 2, double: ai2Double });
        }, 500);
    }

    /**
     * 玩家选择加倍
     * @param {number} doubleVal 1=不加倍, 2=加倍, 4=超级加倍
     */
    handlePlayerDouble(doubleVal) {
        if (this.state !== GAME_STATES.DOUBLING) return;
        this.playerDoubles[0] = doubleVal;
        this.emit('player_doubled', { seat: 0, double: doubleVal });

        // 进入正式出牌阶段，由地主首出
        this.startPlaying();
    }

    /**
     * 进入出牌阶段
     */
    startPlaying() {
        this.state = GAME_STATES.PLAYING;
        this.currentTurn = this.landlordSeat;
        this.tableLastHand = null;
        this.tableLastSeat = -1;
        this.passCount = 0;

        this.emit('playing_start', {
            firstTurnSeat: this.currentTurn
        });

        this.checkPlayTurn();
    }

    checkPlayTurn() {
        if (this.state !== GAME_STATES.PLAYING) return;

        this.emit('play_turn_start', {
            seat: this.currentTurn,
            isLead: (this.tableLastHand === null || this.passCount >= 2),
            lastHand: this.tableLastHand
        });

        if (this.currentTurn !== 0) {
            // AI 思考出牌
            setTimeout(() => {
                const isLead = (this.tableLastHand === null || this.passCount >= 2);
                const context = {
                    myCards: this.playerHands[this.currentTurn],
                    mySeat: this.currentTurn,
                    landlordSeat: this.landlordSeat,
                    lastSeat: this.tableLastSeat,
                    lastHand: isLead ? null : this.tableLastHand,
                    cardCounts: this.playerHands.map(h => h.length),
                    handHistory: this.playHistory
                };

                const aiMoveCards = AIPlayer.decidePlay(context);
                if (aiMoveCards) {
                    this.executePlay(this.currentTurn, aiMoveCards);
                } else {
                    this.executePass(this.currentTurn);
                }
            }, 1000);
        }
    }

    /**
     * 玩家或 AI 确认出牌
     * @param {number} seat 
     * @param {Array<Card>} cards 
     */
    executePlay(seat, cards) {
        if (this.state !== GAME_STATES.PLAYING || seat !== this.currentTurn) return;

        const hand = RuleEngine.parseHand(cards);
        if (hand.type === CARD_TYPES.INVALID) {
            this.emit('play_error', { seat, message: '不合法的出牌类型！' });
            return;
        }

        const isLead = (this.tableLastHand === null || this.passCount >= 2);
        if (!isLead && !RuleEngine.canBeat(hand, this.tableLastHand)) {
            this.emit('play_error', { seat, message: '所选牌型无法压制上家！' });
            return;
        }

        // 成功出牌：从玩家手牌中扣除
        const cardIds = new Set(cards.map(c => c.id));
        this.playerHands[seat] = this.playerHands[seat].filter(c => !cardIds.has(c.id));

        // 如果是对手出牌，同步扣除记牌器
        if (seat !== 0) {
            this.updateCardCounter(cards);
        }

        // 炸弹与王炸翻倍统计
        if (hand.type === CARD_TYPES.BOMB || hand.type === CARD_TYPES.ROCKET) {
            this.bombCount += 1;
            this.emit('bomb_triggered', {
                seat,
                bombType: hand.type,
                totalBombs: this.bombCount
            });
        }

        // 记录出牌手数
        if (seat === this.landlordSeat) {
            this.landlordPlaysCount += 1;
        } else {
            this.farmerPlaysCount[seat] += 1;
        }

        this.tableLastHand = hand;
        this.tableLastSeat = seat;
        this.passCount = 0;
        this.playHistory.push({ seat, hand, timestamp: Date.now() });

        this.emit('play_action', {
            seat,
            hand,
            remainingCount: this.playerHands[seat].length,
            totalMultipliers: this.calculateCurrentMultiplier()
        });

        // 检查胜负
        if (this.playerHands[seat].length === 0) {
            this.handleGameOver(seat);
            return;
        }

        // 轮转下家
        this.currentTurn = (this.currentTurn + 1) % 3;
        this.checkPlayTurn();
    }

    /**
     * 玩家或 AI 选择不出 (PASS)
     */
    executePass(seat) {
        if (this.state !== GAME_STATES.PLAYING || seat !== this.currentTurn) return;

        const isLead = (this.tableLastHand === null || this.passCount >= 2);
        if (isLead) {
            this.emit('play_error', { seat, message: '首出牌必须出牌，不能选择不出！' });
            return;
        }

        this.passCount += 1;
        this.emit('pass_action', { seat });

        // 如果连续两家不出，牌权回到上一个出牌人
        if (this.passCount >= 2) {
            this.tableLastHand = null; // 重置桌面牌
            this.currentTurn = this.tableLastSeat;
        } else {
            this.currentTurn = (this.currentTurn + 1) % 3;
        }

        this.checkPlayTurn();
    }

    /**
     * 计算当前全局倍数
     */
    calculateCurrentMultiplier() {
        let mult = this.baseMultiplier;
        mult *= Math.pow(2, this.bombCount);
        return mult;
    }

    /**
     * 结算对局
     * @param {number} winnerSeat 获胜者座位
     */
    handleGameOver(winnerSeat) {
        this.state = GAME_STATES.ROUND_OVER;
        const isLandlordWinner = (winnerSeat === this.landlordSeat);
        const isPlayerWinner = (winnerSeat === 0) || (!isLandlordWinner && this.landlordSeat !== 0);

        // 春天判定：
        // 地主获胜且两个农民出牌手数均为0 => 春天
        // 农民获胜且地主只出过1手牌 => 反春
        let isSpring = false;
        if (isLandlordWinner) {
            const f1 = (this.landlordSeat + 1) % 3;
            const f2 = (this.landlordSeat + 2) % 3;
            if (this.farmerPlaysCount[f1] === 0 && this.farmerPlaysCount[f2] === 0) {
                isSpring = true;
            }
        } else {
            if (this.landlordPlaysCount <= 1) {
                isSpring = true; // 反春
            }
        }

        let totalMultiplier = this.calculateCurrentMultiplier();
        if (isSpring) totalMultiplier *= 2;

        // 角色加成与技能判定
        const roleBonus = this.systems.character.getMatchBonuses(
            this.landlordSeat === 0,
            isSpring,
            this.systems.storage.data.profile.currentStreak
        );

        // 天赋加成判定
        const talentRichLevel = this.systems.talent.getTalentLevel('talent_rich_reward');
        const talentLossLevel = this.systems.talent.getTalentLevel('talent_loss_shield');
        const talentLastStandLevel = this.systems.talent.getTalentLevel('talent_last_stand');

        const baseWinCoin = this.venue.baseScore * totalMultiplier * this.playerDoubles[0];
        let finalCoinsDelta = 0;

        if (isPlayerWinner) {
            let winRate = 1.0 + roleBonus.coinBonusRate + (talentRichLevel * 0.06);
            if (this.playerHands[0].length <= 3 && talentLastStandLevel > 0) {
                winRate += talentLastStandLevel * 0.15;
            }
            finalCoinsDelta = Math.round(baseWinCoin * winRate);

            // 更新连胜与胜率
            this.systems.storage.data.profile.winGames += 1;
            this.systems.storage.data.profile.currentStreak += 1;
            if (this.systems.storage.data.profile.currentStreak > this.systems.storage.data.profile.maxStreak) {
                this.systems.storage.data.profile.maxStreak = this.systems.storage.data.profile.currentStreak;
            }

            // 排位升星结算
            var rankResult = this.systems.rank.handleMatchWin(
                this.systems.storage.data.profile.currentStreak,
                {
                    streakBonus: this.systems.talent.getTalentLevel('talent_streak_bonus') > 0,
                    isSpringDouble: roleBonus.isSpringDouble
                }
            );
        } else {
            // 战败：享受角色与天赋止损保护
            const lossReduction = Math.min(0.6, roleBonus.lossReductionRate + (talentLossLevel * 0.06));
            finalCoinsDelta = -Math.round(baseWinCoin * (1.0 - lossReduction));

            // 清空中断连胜
            this.systems.storage.data.profile.currentStreak = 0;

            // 排位掉星结算
            var rankResult = this.systems.rank.handleMatchLoss();
        }

        this.systems.storage.data.profile.totalGames += 1;
        if (this.bombCount > 0) this.systems.storage.data.profile.bombCount += this.bombCount;
        if (isSpring) this.systems.storage.data.profile.springCount += 1;

        // 金币与钻石增减
        this.systems.economy.addCoins(finalCoinsDelta);
        if (roleBonus.diamondBonus > 0) {
            this.systems.economy.addDiamonds(roleBonus.diamondBonus);
        }

        // 触发任务与成就更新
        this.systems.quest.onMatchFinished({
            isWin: isPlayerWinner,
            isLandlord: this.landlordSeat === 0,
            bombsPlayed: this.bombCount,
            isSpring: isSpring,
            coinsWon: finalCoinsDelta
        });

        // 自动存档
        this.systems.storage.save(this.systems.storage.data);

        // 广播对局结束事件
        const summary = {
            winnerSeat,
            isPlayerWinner,
            isLandlordWinner,
            isSpring,
            bombCount: this.bombCount,
            totalMultiplier,
            finalCoinsDelta,
            rankResult,
            remainingHands: this.playerHands,
            currentCoins: this.systems.storage.data.currencies.coins
        };

        this.emit('game_over', summary);
        return summary;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameEngine, VENUES, GAME_STATES };
}
