/**
 * TableRenderer.js
 * 负责牌桌交互、三方独立出牌区、全量出牌历史记录、移动端手牌自适应与触控选牌
 */

class TableRenderer {
    constructor(gameEngine, effects, audio) {
        this.engine = gameEngine;
        this.effects = effects;
        this.audio = audio;

        this.selectedCards = new Set();
        this.hintIndex = 0;
        this.currentHints = [];

        // 牌局出牌历史流水
        this.matchPlayHistory = [];
        this.playedCardsSet = new Set(); // 记录所有已被打出的 card.id

        this.initDom();
        this.bindEngineEvents();

        // 监听屏幕尺寸改变，保持移动端手牌完美居中自适应
        window.addEventListener('resize', () => {
            if (this.engine.playerHands[0] && this.engine.playerHands[0].length > 0) {
                this.renderPlayerHand(this.engine.playerHands[0]);
            }
        });
    }

    initDom() {
        this.playerHandEl = document.getElementById('player-hand');
        this.aiLeftHandEl = document.getElementById('ai-left-hand');
        this.aiRightHandEl = document.getElementById('ai-right-hand');

        // 三方独立出牌区
        this.playZones = [
            document.getElementById('play-zone-0'), // 玩家
            document.getElementById('play-zone-1'), // 左侧 AI
            document.getElementById('play-zone-2')  // 右侧 AI
        ];

        this.bottomCardsEl = document.getElementById('bottom-cards-bar');
        this.multipliersEl = document.getElementById('game-multipliers-badge');
        this.venueTitleEl = document.getElementById('game-venue-title');

        this.playerActionsEl = document.getElementById('player-actions-panel');
        this.bidActionsEl = document.getElementById('bidding-actions-panel');
        this.doubleActionsEl = document.getElementById('doubling-actions-panel');

        this.cardCounterEl = document.getElementById('card-counter-hud');
        this.gameOverModal = document.getElementById('game-over-modal');

        // 记牌器开关
        document.getElementById('toggle-counter-btn')?.addEventListener('click', () => {
            if (this.cardCounterEl) {
                this.cardCounterEl.classList.toggle('hidden');
            }
        });

        // 历史出牌记录弹窗
        this.historyModal = document.getElementById('history-log-modal');
        this.historyTimelineList = document.getElementById('history-rounds-list');
        this.historyCardsGrid = document.getElementById('history-cards-grid');

        document.getElementById('btn-open-history')?.addEventListener('click', () => {
            this.openHistoryModal();
        });

        // 历史弹窗内标签切换
        const tabTimeline = document.getElementById('tab-btn-timeline');
        const tabCards = document.getElementById('tab-btn-cards');
        const viewTimeline = document.getElementById('history-timeline-view');
        const viewCards = document.getElementById('history-cards-view');

        tabTimeline?.addEventListener('click', () => {
            tabTimeline.classList.add('active');
            tabCards?.classList.remove('active');
            viewTimeline?.classList.remove('hidden');
            viewCards?.classList.add('hidden');
        });

        tabCards?.addEventListener('click', () => {
            tabCards.classList.add('active');
            tabTimeline?.classList.remove('active');
            viewCards?.classList.remove('hidden');
            viewTimeline?.classList.add('hidden');
            this.renderCardsDistributionMatrix();
        });
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
        this.matchPlayHistory = [];
        this.playedCardsSet.clear();
        this.renderPlayerHand(playerHands[0]);
        this.renderAiHands(playerHands[1].length, playerHands[2].length);
        this.renderBottomCards(bottomCards, false); // 初始背面朝上
        this.renderCardCounter(Object.fromEntries(this.engine.remainingCardCounts));
    }

    clearTable() {
        this.selectedCards.clear();
        this.hintIndex = 0;
        this.currentHints = [];
        this.clearAllPlayZones();
        this.hideAllActionPanels();
        document.querySelectorAll('.player-speech-bubble').forEach(el => el.remove());
        document.querySelectorAll('.role-tag').forEach(el => el.remove());
    }

    clearAllPlayZones() {
        this.playZones.forEach(zone => {
            if (zone) zone.innerHTML = '';
        });
    }

    hideAllActionPanels() {
        if (this.playerActionsEl) this.playerActionsEl.classList.add('hidden');
        if (this.bidActionsEl) this.bidActionsEl.classList.add('hidden');
        if (this.doubleActionsEl) this.doubleActionsEl.classList.add('hidden');
    }

    /**
     * 渲染自己手牌（自适应移动端与桌面端，支持动态扇形和触屏操作）
     */
    renderPlayerHand(cards) {
        if (!this.playerHandEl) return;
        this.playerHandEl.innerHTML = '';
        const len = cards.length;
        if (len === 0) return;

        const screenWidth = window.innerWidth;
        const isMobile = screenWidth <= 768;
        const cardWidth = isMobile ? 54 : 86;
        const maxTotalWidth = Math.min(screenWidth - 20, isMobile ? screenWidth - 10 : 760);

        // 自适应重叠间距，确保 17~20 张牌永远不超出屏幕！
        const overlap = len <= 1 ? 0 : Math.min(cardWidth * 0.52, Math.max(isMobile ? 15 : 24, (maxTotalWidth - cardWidth) / (len - 1)));
        const totalWidth = (len - 1) * overlap + cardWidth;
        this.playerHandEl.style.width = `${totalWidth}px`;

        const mid = (len - 1) / 2;

        cards.forEach((card, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = `poker-card rank-${card.rank}`;
            const isSelected = this.selectedCards.has(card.id);
            if (isSelected) cardEl.classList.add('selected');

            cardEl.dataset.id = card.id;
            cardEl.dataset.rank = card.rank;
            cardEl.style.zIndex = idx + 1;
            cardEl.style.left = `${idx * overlap}px`;

            // 扇形微倾斜与自然拱形
            const rot = (idx - mid) * (isMobile ? 1.2 : 1.6);
            const yArch = Math.abs(idx - mid) * (isMobile ? 1.0 : 1.5);

            cardEl.style.transform = isSelected ? 
                `translateY(-26px) rotate(${rot}deg)` : 
                `translateY(${yArch}px) rotate(${rot}deg)`;

            // 卡牌牌面设计
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

            // 点击或触控选中
            cardEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelectCard(card, cardEl, yArch, rot);
            });

            this.playerHandEl.appendChild(cardEl);
        });
    }

    toggleSelectCard(card, cardEl, yArch, rot) {
        this.audio.playCardSelect();
        if (this.selectedCards.has(card.id)) {
            this.selectedCards.delete(card.id);
            cardEl.classList.remove('selected');
            cardEl.style.transform = `translateY(${yArch}px) rotate(${rot}deg)`;
        } else {
            this.selectedCards.add(card.id);
            cardEl.classList.add('selected');
            cardEl.style.transform = `translateY(-26px) rotate(${rot}deg)`;
        }
    }

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

    renderCardCounter(counts) {
        if (!this.cardCounterEl) return;
        const ranks = [
            { r: 17, name: '大王' }, { r: 16, name: '小王' }, { r: 15, name: '2' },
            { r: 14, name: 'A' }, { r: 13, name: 'K' }, { r: 12, name: 'Q' },
            { r: 11, name: 'J' }, { r: 10, name: '10' }, { r: 9, name: '9' },
            { r: 8, name: '8' }, { r: 7, name: '7' }, { r: 6, name: '6' },
            { r: 5, name: '5' }, { r: 4, name: '4' }, { r: 3, name: '3' }
        ];

        let html = '<div class="counter-header"><span>👁️ 牌池记牌器</span></div><div class="counter-grid">';
        for (const item of ranks) {
            const count = counts[item.r] || 0;
            let cls = '';
            if (count === 4) cls = 'highlight-bomb';
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

    onBidTurnStart({ seat, highestBid }) {
        this.hideAllActionPanels();
        if (seat === 0) {
            this.bidActionsEl.classList.remove('hidden');
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

        this.renderPlayerHand(this.engine.playerHands[0]);
        this.renderAiHands(this.engine.playerHands[1].length, this.engine.playerHands[2].length);
    }

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

    onPlayingStart() {
        this.hideAllActionPanels();
        this.clearAllPlayZones();
    }

    onPlayTurnStart({ seat, isLead, lastHand }) {
        this.hideAllActionPanels();

        // 如果是新一轮主动领出（上家两家均不出），清空各家桌面上一轮的出牌残影
        if (isLead) {
            this.clearAllPlayZones();
        }

        if (seat === 0) {
            this.playerActionsEl.classList.remove('hidden');
            const passBtn = document.getElementById('action-pass-btn');
            if (passBtn) passBtn.disabled = isLead;

            this.currentHints = RuleEngine.findPlayableCombinations(this.engine.playerHands[0], isLead ? null : lastHand);
            this.hintIndex = 0;
        }
    }

    /**
     * 关键修复：三方独立渲染所出的牌，各家保留自己的出牌内容！
     */
    onPlayAction({ seat, hand, remainingCount, totalMultipliers }) {
        this.audio.playCardPlay();
        this.multipliersEl.innerText = `倍数: ${totalMultipliers}x`;

        // 在该座位的专属出牌区渲染牌面
        this.renderSeatPlay(seat, hand.cards);

        // 记入全量历史记录
        const seatName = seat === 0 ? '我' : (seat === 1 ? '下家电脑' : '上家电脑');
        this.matchPlayHistory.push({
            seat,
            seatName,
            isPass: false,
            cards: [...hand.cards],
            handType: hand.type,
            handRank: hand.rank,
            time: new Date().toLocaleTimeString()
        });

        // 记录已打出的卡牌 ID
        hand.cards.forEach(c => this.playedCardsSet.add(c.id));

        // 刷新手牌
        if (seat === 0) {
            this.selectedCards.clear();
            this.renderPlayerHand(this.engine.playerHands[0]);
        } else {
            this.renderAiHands(this.engine.playerHands[1].length, this.engine.playerHands[2].length);
        }

        if (hand.type === 'AIRPLANE' || hand.type === 'AIRPLANE_SINGLES' || hand.type === 'AIRPLANE_PAIRS') {
            this.audio.playAirplane();
            this.effects.triggerAirplane();
        }
    }

    onPassAction({ seat }) {
        this.audio.playPass();
        this.showSpeechBubble(seat, '不要 / 过');

        // 在该座位的专属出牌区显示不出徽章
        const zone = this.playZones[seat];
        if (zone) {
            zone.innerHTML = `<div class="table-pass-tag">不出</div>`;
        }

        const seatName = seat === 0 ? '我' : (seat === 1 ? '下家电脑' : '上家电脑');
        this.matchPlayHistory.push({
            seat,
            seatName,
            isPass: true,
            cards: [],
            time: new Date().toLocaleTimeString()
        });
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

    /**
     * 在专属座位出牌区渲染牌组
     */
    renderSeatPlay(seat, cards) {
        const zone = this.playZones[seat];
        if (!zone) return;
        zone.innerHTML = '';

        const playContainer = document.createElement('div');
        playContainer.className = `played-cards-fan seat-zone-${seat}`;
        
        const isMobile = window.innerWidth <= 768;
        const overlap = isMobile ? 18 : 26;

        cards.forEach((card, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'played-poker-card';
            cardEl.style.left = `${idx * overlap}px`;
            cardEl.style.zIndex = idx + 1;
            cardEl.style.color = card.color;

            if (card.isJoker) {
                cardEl.innerText = card.rank === 17 ? '大王' : '小王';
            } else {
                cardEl.innerHTML = `<span class="played-rank">${card.name}</span><span class="played-suit">${card.suit}</span>`;
            }
            playContainer.appendChild(cardEl);
        });

        // 容器自适应总宽
        const totalW = (cards.length - 1) * overlap + (isMobile ? 46 : 64);
        playContainer.style.width = `${totalW}px`;

        zone.appendChild(playContainer);
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
            alert('没有能压过上家的合法牌型！');
            return;
        }

        const candidate = this.currentHints[this.hintIndex % this.currentHints.length];
        this.hintIndex += 1;

        this.selectedCards.clear();
        candidate.forEach(c => this.selectedCards.add(c.id));
        this.renderPlayerHand(this.engine.playerHands[0]);
    }

    triggerPlaySelected() {
        const cardsToPlay = this.engine.playerHands[0].filter(c => this.selectedCards.has(c.id));
        if (cardsToPlay.length === 0) {
            alert('请先点击扑克牌选择要出的手牌！');
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
        document.getElementById('modal-title-text').style.color = isWin ? '#4ade80' : '#ef4444';

        document.getElementById('modal-coins-delta').innerText = `${summary.finalCoinsDelta >= 0 ? '+' : ''}${summary.finalCoinsDelta.toLocaleString()} 金币`;
        document.getElementById('modal-coins-delta').style.color = summary.finalCoinsDelta >= 0 ? '#fde047' : '#94a3b8';

        document.getElementById('modal-multipliers-detail').innerText = `总倍数: ${summary.totalMultiplier}x (炸弹: ${summary.bombCount}次${summary.isSpring ? ' · 春天翻倍' : ''})`;

        const rankMsg = summary.rankResult.starChange > 0 ? 
            `段位提升: +${summary.rankResult.starChange}★ (${summary.rankResult.rankInfo.name} ${summary.rankResult.rankInfo.starText})` :
            (summary.rankResult.protectedByCard ? '段位保护: 消耗保星卡不掉星' : `段位变动: ${summary.rankResult.starChange}★`);
        document.getElementById('modal-rank-change-text').innerText = rankMsg;

        this.gameOverModal.classList.remove('hidden');
    }

    /**
     * 关键功能：打开全量出牌历史与牌池追踪弹窗
     */
    openHistoryModal() {
        if (!this.historyModal) return;

        // 渲染流水
        if (this.historyTimelineList) {
            if (this.matchPlayHistory.length === 0) {
                this.historyTimelineList.innerHTML = '<div class="history-empty-tip">本局尚未开始出牌</div>';
            } else {
                let html = '';
                this.matchPlayHistory.forEach((item, index) => {
                    if (item.isPass) {
                        html += `
                            <div class="history-item-row pass-row">
                                <span class="history-turn-index">#${index + 1}</span>
                                <span class="history-seat-tag">${item.seatName}</span>
                                <span class="history-pass-text">不出 / 过</span>
                            </div>
                        `;
                    } else {
                        const cardsStr = item.cards.map(c => `<span class="hist-card" style="color:${c.color}">${c.toString()}</span>`).join(' ');
                        html += `
                            <div class="history-item-row play-row">
                                <span class="history-turn-index">#${index + 1}</span>
                                <span class="history-seat-tag">${item.seatName}</span>
                                <span class="history-cards-str">${cardsStr}</span>
                            </div>
                        `;
                    }
                });
                this.historyTimelineList.innerHTML = html;
            }
        }

        this.historyModal.classList.remove('hidden');
    }

    /**
     * 渲染 54 张扑克牌池已出 vs 未出矩阵
     */
    renderCardsDistributionMatrix() {
        if (!this.historyCardsGrid) return;

        const ranks = [
            { r: 17, name: '大王' }, { r: 16, name: '小王' }, { r: 15, name: '2' },
            { r: 14, name: 'A' }, { r: 13, name: 'K' }, { r: 12, name: 'Q' },
            { r: 11, name: 'J' }, { r: 10, name: '10' }, { r: 9, name: '9' },
            { r: 8, name: '8' }, { r: 7, name: '7' }, { r: 6, name: '6' },
            { r: 5, name: '5' }, { r: 4, name: '4' }, { r: 3, name: '3' }
        ];

        let html = '<div class="matrix-grid-box">';
        ranks.forEach(item => {
            const remaining = this.engine.remainingCardCounts.get(item.r) || 0;
            const maxCount = (item.r >= 16) ? 1 : 4;
            const usedCount = maxCount - remaining;

            html += `
                <div class="matrix-card-stat ${remaining === 0 ? 'all-played' : ''}">
                    <div class="matrix-rank-title">${item.name}</div>
                    <div class="matrix-count-info">
                        <span class="used-text">已出: ${usedCount}</span>
                        <span class="remain-text">剩余: ${remaining}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        this.historyCardsGrid.innerHTML = html;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TableRenderer };
}
