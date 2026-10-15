/**
 * TableRenderer.js
 * 负责牌桌交互、卡牌排布、拖拽/点击多选、出牌区渲染、记牌器HUD与结算弹窗
 */

class TableRenderer {
    constructor(gameEngine, effects, audio) {
        this.engine = gameEngine;
        this.effects = effects;
        this.audio = audio;

        this.selectedCards = new Set();
        this.hintIndex = 0;
        this.currentHints = [];

        this.initDom();
        this.bindEngineEvents();
    }

    initDom() {
        this.playerHandEl = document.getElementById('player-hand');
        this.aiLeftHandEl = document.getElementById('ai-left-hand');
        this.aiRightHandEl = document.getElementById('ai-right-hand');

        this.tableCenterEl = document.getElementById('table-center-area');
        this.bottomCardsEl = document.getElementById('bottom-cards-bar');
        this.multipliersEl = document.getElementById('game-multipliers-badge');
        this.venueTitleEl = document.getElementById('game-venue-title');

        this.playerActionsEl = document.getElementById('player-actions-panel');
        this.bidActionsEl = document.getElementById('bidding-actions-panel');
        this.doubleActionsEl = document.getElementById('doubling-actions-panel');

        this.cardCounterEl = document.getElementById('card-counter-hud');
        this.gameOverModal = document.getElementById('game-over-modal');

        // 记牌器开关
        const counterToggleBtn = document.getElementById('toggle-counter-btn');
        if (counterToggleBtn) {
            counterToggleBtn.addEventListener('click', () => {
                if (this.cardCounterEl) {
                    this.cardCounterEl.classList.toggle('hidden');
                }
            });
        }
    }

    bindEngineEvents() {
        this.engine.on('deal_finished', data => this.onDealFinished(data));
        this.engine.on('bid_turn_start', data => this.onBidTurnStart(data));
        this.engine.on('bid_action', data => this.onBidAction(data));
        this.engine.on('landlord_decided', data => this.onLandlordDecided(data));
        this.engine.on('doubling_start', data => this.onDoublingStart(data));
        this.engine.on('ai_doubled', data => this.onAiDoubled(data));
        this.engine.on('player_doubled', data => this.onPlayerDoubled(data));
        this.engine.on('playing_start', data => this.onPlayingStart(data));
        this.engine.on('play_turn_start', data => this.onPlayTurnStart(data));
        this.engine.on('play_action', data => this.onPlayAction(data));
        this.engine.on('pass_action', data => this.onPassAction(data));
        this.engine.on('bomb_triggered', data => this.onBombTriggered(data));
        this.engine.on('game_over', data => this.onGameOver(data));
        this.engine.on('card_counter_updated', data => this.renderCardCounter(data.counts));
        this.engine.on('play_error', data => {
            if (data.seat === 0) alert(data.message);
        });
    }

    onDealFinished({ playerHands, bottomCards, venue }) {
        this.venueTitleEl.innerText = `${venue.name} (底分:${venue.baseScore})`;
        this.multipliersEl.innerText = `倍数: 1x`;
        this.clearTable();
        this.renderPlayerHand(playerHands[0]);
        this.renderAiHands(playerHands[1].length, playerHands[2].length);
        this.renderBottomCards(bottomCards, false); // 初始背面朝上
        this.renderCardCounter(Object.fromEntries(this.engine.remainingCardCounts));
    }

    clearTable() {
        this.selectedCards.clear();
        this.hintIndex = 0;
        this.currentHints = [];
        this.tableCenterEl.innerHTML = '';
        this.hideAllActionPanels();
        document.querySelectorAll('.player-speech-bubble').forEach(el => el.remove());
        document.querySelectorAll('.role-tag').forEach(el => el.remove());
    }

    hideAllActionPanels() {
        if (this.playerActionsEl) this.playerActionsEl.classList.add('hidden');
        if (this.bidActionsEl) this.bidActionsEl.classList.add('hidden');
        if (this.doubleActionsEl) this.doubleActionsEl.classList.add('hidden');
    }

    // 渲染自己手牌
    renderPlayerHand(cards) {
        if (!this.playerHandEl) return;
        this.playerHandEl.innerHTML = '';
        const len = cards.length;

        cards.forEach((card, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = `poker-card rank-${card.rank}`;
            if (this.selectedCards.has(card.id)) cardEl.classList.add('selected');

            cardEl.dataset.id = card.id;
            cardEl.dataset.rank = card.rank;
            cardEl.style.zIndex = idx + 1;

            // 卡牌重叠间隔与扇形弧度自适应
            const overlap = Math.min(46, Math.max(26, 680 / len));
            cardEl.style.left = `${idx * overlap}px`;

            const mid = (len - 1) / 2;
            const rot = (idx - mid) * 1.6;
            const yArch = Math.abs(idx - mid) * 1.4;

            cardEl.style.transform = this.selectedCards.has(card.id) ? 
                `translateY(-30px) rotate(${rot}deg)` : 
                `translateY(${yArch}px) rotate(${rot}deg)`;

            // 卡牌牌面构造
            if (card.isJoker) {
                cardEl.innerHTML = `
                    <div class="card-joker-corner" style="color: ${card.color}">${card.rank === 17 ? '大<br>王' : '小<br>王'}</div>
                    <div class="card-joker-center" style="color: ${card.color}">🃏</div>
                `;
            } else {
                cardEl.innerHTML = `
                    <div class="card-corner" style="color: ${card.color}">
                        <div class="card-corner-rank">${card.name}</div>
                        <div class="card-corner-suit">${card.suit}</div>
                    </div>
                    <div class="card-center" style="color: ${card.color}">${card.suit}</div>
                    <div class="card-corner bottom-right" style="color: ${card.color}">
                        <div class="card-corner-rank">${card.name}</div>
                        <div class="card-corner-suit">${card.suit}</div>
                    </div>
                `;
            }

            // 点击选中切换
            cardEl.addEventListener('click', () => {
                this.audio.playCardSelect();
                if (this.selectedCards.has(card.id)) {
                    this.selectedCards.delete(card.id);
                    cardEl.classList.remove('selected');
                    cardEl.style.transform = `translateY(${yArch}px) rotate(${rot}deg)`;
                } else {
                    this.selectedCards.add(card.id);
                    cardEl.classList.add('selected');
                    cardEl.style.transform = `translateY(-30px) rotate(${rot}deg)`;
                }
            });

            this.playerHandEl.appendChild(cardEl);
        });

        // 居中偏移
        const totalWidth = (len - 1) * Math.min(42, Math.max(22, 600 / len)) + 90;
        this.playerHandEl.style.width = `${totalWidth}px`;
    }

    // 渲染左右 AI 手牌背面与数量
    renderAiHands(leftCount, rightCount) {
        if (this.aiLeftHandEl) {
            this.aiLeftHandEl.innerHTML = `
                <div class="ai-card-fan">
                    <div class="ai-card-back"></div>
                    <span class="ai-count-badge">${leftCount}</span>
                </div>
            `;
        }
        if (this.aiRightHandEl) {
            this.aiRightHandEl.innerHTML = `
                <div class="ai-card-fan">
                    <div class="ai-card-back"></div>
                    <span class="ai-count-badge">${rightCount}</span>
                </div>
            `;
        }
    }

    // 渲染底牌
    renderBottomCards(cards, faceUp = true) {
        if (!this.bottomCardsEl) return;
        this.bottomCardsEl.innerHTML = '';
        cards.forEach(card => {
            const el = document.createElement('div');
            el.className = 'bottom-card-item';
            if (faceUp) {
                el.style.color = card.color;
                el.innerText = card.toString();
            } else {
                el.className += ' face-down';
                el.innerText = '🂠';
            }
            this.bottomCardsEl.appendChild(el);
        });
    }

    // 渲染记牌器
    renderCardCounter(counts) {
        if (!this.cardCounterEl) return;
        const ranks = [
            { r: 17, name: '大王' }, { r: 16, name: '小王' }, { r: 15, name: '2' },
            { r: 14, name: 'A' }, { r: 13, name: 'K' }, { r: 12, name: 'Q' },
            { r: 11, name: 'J' }, { r: 10, name: '10' }, { r: 9, name: '9' },
            { r: 8, name: '8' }, { r: 7, name: '7' }, { r: 6, name: '6' },
            { r: 5, name: '5' }, { r: 4, name: '4' }, { r: 3, name: '3' }
        ];

        let html = '<div class="counter-grid">';
        for (const item of ranks) {
            const count = counts[item.r] || 0;
            let cls = '';
            if (count === 4) cls = 'highlight-bomb'; // 炸弹潜在点
            else if (count === 0) cls = 'zero-card';
            else if (item.r >= 15) cls = 'high-card';

            html += `
                <div class="counter-item ${cls}">
                    <div class="counter-rank">${item.name}</div>
                    <div class="counter-num">${count}</div>
                </div>
            `;
        }
        html += '</div>';
        this.cardCounterEl.innerHTML = html;
    }

    // 叫分阶段
    onBidTurnStart({ seat, highestBid }) {
        this.hideAllActionPanels();
        if (seat === 0) {
            this.bidActionsEl.classList.remove('hidden');
            // 根据当前最高分启用/禁用叫分按钮
            document.querySelectorAll('.bid-score-btn').forEach(btn => {
                const score = parseInt(btn.dataset.score);
                btn.disabled = score <= highestBid;
            });
        }
    }

    onBidAction({ seat, bid }) {
        const text = bid === 0 ? '不叫' : `${bid} 分！`;
        this.showSpeechBubble(seat, text);
        this.audio.playTone(400 + bid * 100, 'sine', 0.15, 0.2);
    }

    onLandlordDecided({ landlordSeat, bottomCards, baseMultiplier }) {
        this.hideAllActionPanels();
        this.renderBottomCards(bottomCards, true);
        this.multipliersEl.innerText = `倍数: ${baseMultiplier}x`;

        // 挂载地主/农民身份徽章
        for (let s = 0; s < 3; s++) {
            const isLandlord = (s === landlordSeat);
            const parent = document.getElementById(s === 0 ? 'seat-player' : (s === 1 ? 'seat-ai-left' : 'seat-ai-right'));
            if (parent) {
                const badge = document.createElement('div');
                badge.className = `role-tag ${isLandlord ? 'role-landlord' : 'role-farmer'}`;
                badge.innerText = isLandlord ? '👑 地主' : '🌾 农民';
                parent.appendChild(badge);
            }
        }

        // 重新渲染玩家手牌和底牌
        this.renderPlayerHand(this.engine.playerHands[0]);
        this.renderAiHands(this.engine.playerHands[1].length, this.engine.playerHands[2].length);
    }

    // 加倍阶段
    onDoublingStart() {
        this.hideAllActionPanels();
        if (this.doubleActionsEl) {
            this.doubleActionsEl.classList.remove('hidden');
        }
    }

    onAiDoubled({ seat, double }) {
        const text = double === 4 ? '超级加倍！' : (double === 2 ? '加倍！' : '不加倍');
        this.showSpeechBubble(seat, text);
    }

    onPlayerDoubled({ seat, double }) {
        const text = double === 4 ? '超级加倍！' : (double === 2 ? '加倍！' : '不加倍');
        this.showSpeechBubble(seat, text);
    }

    // 正式打牌
    onPlayingStart() {
        this.hideAllActionPanels();
    }

    onPlayTurnStart({ seat, isLead, lastHand }) {
        this.hideAllActionPanels();
        if (seat === 0) {
            this.playerActionsEl.classList.remove('hidden');
            const passBtn = document.getElementById('action-pass-btn');
            if (passBtn) passBtn.disabled = isLead;

            // 预设提示候选
            this.currentHints = RuleEngine.findPlayableCombinations(this.engine.playerHands[0], isLead ? null : lastHand);
            this.hintIndex = 0;
        }
    }

    onPlayAction({ seat, hand, remainingCount, totalMultipliers }) {
        this.audio.playCardPlay();
        this.multipliersEl.innerText = `倍数: ${totalMultipliers}x`;

        // 在出牌区渲染刚出的牌
        this.renderTablePlay(seat, hand.cards);

        // 如果是自己出的牌，刷新手牌
        if (seat === 0) {
            this.selectedCards.clear();
            this.renderPlayerHand(this.engine.playerHands[0]);
        } else {
            this.renderAiHands(this.engine.playerHands[1].length, this.engine.playerHands[2].length);
        }

        // 飞机特效
        if (hand.type === 'AIRPLANE' || hand.type === 'AIRPLANE_SINGLES' || hand.type === 'AIRPLANE_PAIRS') {
            this.audio.playAirplane();
            this.effects.triggerAirplane();
        }
    }

    onPassAction({ seat }) {
        this.audio.playPass();
        this.showSpeechBubble(seat, '不要 / 过');
    }

    onBombTriggered({ seat, bombType }) {
        if (bombType === 'ROCKET') {
            this.audio.playRocket();
            this.effects.triggerRocket();
        } else {
            this.audio.playBomb();
            this.effects.triggerBomb();
        }
    }

    renderTablePlay(seat, cards) {
        if (!this.tableCenterEl) return;
        this.tableCenterEl.innerHTML = '';

        const playContainer = document.createElement('div');
        playContainer.className = `played-cards-group seat-${seat}`;
        cards.forEach((card, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'played-poker-card';
            cardEl.style.left = `${idx * 25}px`;
            cardEl.style.color = card.color;
            cardEl.innerText = card.toString();
            playContainer.appendChild(cardEl);
        });

        this.tableCenterEl.appendChild(playContainer);
    }

    showSpeechBubble(seat, text) {
        const seatEl = document.getElementById(seat === 0 ? 'seat-player' : (seat === 1 ? 'seat-ai-left' : 'seat-ai-right'));
        if (!seatEl) return;

        const old = seatEl.querySelector('.player-speech-bubble');
        if (old) old.remove();

        const bubble = document.createElement('div');
        bubble.className = 'player-speech-bubble';
        bubble.innerText = text;
        seatEl.appendChild(bubble);

        setTimeout(() => bubble.remove(), 1600);
    }

    // 智能提示循环
    triggerHint() {
        if (!this.currentHints || this.currentHints.length === 0) {
            alert('没有能压过上家的牌型！');
            return;
        }

        const candidate = this.currentHints[this.hintIndex % this.currentHints.length];
        this.hintIndex += 1;

        // 选中这几张牌
        this.selectedCards.clear();
        candidate.forEach(c => this.selectedCards.add(c.id));
        this.renderPlayerHand(this.engine.playerHands[0]);
    }

    // 玩家点击出牌按钮
    triggerPlaySelected() {
        const cardsToPlay = this.engine.playerHands[0].filter(c => this.selectedCards.has(c.id));
        if (cardsToPlay.length === 0) {
            alert('请先选择要出的牌！');
            return;
        }
        this.engine.executePlay(0, cardsToPlay);
    }

    // 局后结算弹窗
    onGameOver(summary) {
        this.hideAllActionPanels();
        if (summary.isSpring) {
            this.audio.playSpring();
            this.effects.triggerSpring();
        }

        if (summary.isPlayerWinner) {
            this.audio.playWin();
            this.effects.triggerCoinFountain();
        } else {
            this.audio.playDefeat();
        }

        setTimeout(() => {
            this.showGameOverModal(summary);
        }, 1200);
    }

    showGameOverModal(summary) {
        if (!this.gameOverModal) return;
        const isWin = summary.isPlayerWinner;

        document.getElementById('modal-title-text').innerText = isWin ? '🎉 对局大胜 🎉' : '🥀 遗憾惜败 🥀';
        document.getElementById('modal-title-text').style.color = isWin ? '#48bb78' : '#e53e3e';

        document.getElementById('modal-coins-delta').innerText = `${summary.finalCoinsDelta >= 0 ? '+' : ''}${summary.finalCoinsDelta.toLocaleString()} 金币`;
        document.getElementById('modal-coins-delta').style.color = summary.finalCoinsDelta >= 0 ? '#ecc94b' : '#a0aec0';

        document.getElementById('modal-multipliers-detail').innerText = `总倍数: ${summary.totalMultiplier}x (炸弹: ${summary.bombCount}次${summary.isSpring ? ' · 春天翻倍' : ''})`;

        const rankMsg = summary.rankResult.starChange > 0 ? 
            `段位提升: +${summary.rankResult.starChange}★ (${summary.rankResult.rankInfo.name} ${summary.rankResult.rankInfo.starText})` :
            (summary.rankResult.protectedByCard ? '段位保护: 消耗保星卡不掉星' : `段位变动: ${summary.rankResult.starChange}★`);
        document.getElementById('modal-rank-change-text').innerText = rankMsg;

        this.gameOverModal.classList.remove('hidden');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TableRenderer };
}
