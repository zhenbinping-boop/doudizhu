/**
 * LobbyRenderer.js
 * 负责主大厅展示、个人信息、角色养成面板、天赋树加点、每日任务/签到、转盘与商城交互
 */

const CHARACTER_QUOTES = {
    'c1': '牌友你好！咱庄稼人打牌靠实力，配合默契才能百战百胜！',
    'c2': '手握重金，谁敢不服？本财神出手，叫三分超级加倍！',
    'c3': '千算万算，尽在吾彀中。牌池五十有四，已悉数推演无遗！',
    'c4': '小女子今天手气正旺呢~ 官人可敢与我再大战三百回合？'
};

class LobbyRenderer {
    constructor(systems, onStartMatch, onStartPuzzle) {
        this.systems = systems;
        this.onStartMatch = onStartMatch;
        this.onStartPuzzle = onStartPuzzle;
        this.activeCardIndex = 0;

        this.initDom();
        this.updateHeaderHUD();
    }

    initDom() {
        this.lobbyView = document.getElementById('lobby-view');
        this.tableView = document.getElementById('game-table-container');

        // 头部 HUD 元素
        this.playerAvatarEl = document.getElementById('lobby-player-avatar');
        this.playerNameEl = document.getElementById('lobby-player-name');
        this.playerTitleEl = document.getElementById('lobby-player-title');
        this.rankBadgeEl = document.getElementById('lobby-rank-badge');
        this.coinsValEl = document.getElementById('lobby-coins-val');
        this.diamondsValEl = document.getElementById('lobby-diamonds-val');
        this.energyValEl = document.getElementById('lobby-energy-val');

        // 卡牌全屏滑动轮播器组件
        this.carouselTrack = document.getElementById('modes-carousel-track');
        this.carouselDots = document.querySelectorAll('.dot-indicator');
        this.prevCardBtn = document.getElementById('btn-prev-card');
        this.nextCardBtn = document.getElementById('btn-next-card');

        this.bindCarousel();

        // 救济金按钮
        this.reliefBtn = document.getElementById('btn-claim-relief');
        if (this.reliefBtn) {
            this.reliefBtn.addEventListener('click', () => this.handleClaimRelief());
        }

        // 调试模式按钮
        const debugBtn = document.getElementById('btn-debug-cheat');
        if (debugBtn) {
            debugBtn.addEventListener('click', async () => {
                const ok = await window.showGameConfirm({
                    title: '开启测试秘籍',
                    message: '确认开启测试模式，直接获得 500,000 金币、1000 钻石并解锁全角色？',
                    confirmText: '立即发放',
                    cancelText: '取消',
                    icon: '🚀'
                });
                if (ok) {
                    this.systems.storage.grantDebugResources(this.systems.storage.data);
                    this.updateHeaderHUD();
                    window.showGameToast('🎉 调试资源已发放！50万金币与1000钻石已入账！', 'success');
                }
            });
        }

        // 绑定功能弹窗按钮
        this.bindModalButtons();
    }

    /**
     * 绑定主界面全屏模式卡牌滑动、左右切换与放大穿梭进场动画
     */
    bindCarousel() {
        if (!this.carouselTrack) return;

        // 监听滑轨横向滚动，实时同步小圆点索引
        this.carouselTrack.addEventListener('scroll', () => {
            const scrollLeft = this.carouselTrack.scrollLeft;
            const firstCard = this.carouselTrack.querySelector('.mode-slide-card');
            const cardWidth = firstCard ? firstCard.offsetWidth : 360;
            const gap = 24;
            const index = Math.round(scrollLeft / (cardWidth + gap));
            if (index !== this.activeCardIndex && index >= 0 && index < this.carouselDots.length) {
                this.updateActiveDot(index);
            }
        });

        // 左右翻卡箭头
        this.prevCardBtn?.addEventListener('click', () => {
            const firstCard = this.carouselTrack.querySelector('.mode-slide-card');
            const cardWidth = firstCard ? firstCard.offsetWidth : 360;
            this.carouselTrack.scrollBy({ left: -(cardWidth + 24), behavior: 'smooth' });
        });

        this.nextCardBtn?.addEventListener('click', () => {
            const firstCard = this.carouselTrack.querySelector('.mode-slide-card');
            const cardWidth = firstCard ? firstCard.offsetWidth : 360;
            this.carouselTrack.scrollBy({ left: (cardWidth + 24), behavior: 'smooth' });
        });

        // 点击小圆点快速定位
        this.carouselDots.forEach((dot, idx) => {
            dot.addEventListener('click', () => {
                const cards = this.carouselTrack.querySelectorAll('.mode-slide-card');
                if (cards[idx]) {
                    cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    this.updateActiveDot(idx);
                }
            });
        });

        // 点击卡牌：卡牌放大，逐渐进入牌局
        this.carouselTrack.querySelectorAll('.mode-slide-card').forEach(card => {
            card.addEventListener('click', () => {
                const venueKey = card.dataset.venue;
                const mode = card.dataset.mode || 'CLASSIC';

                // 资金门槛判定
                const minCoins = { novice: 500, expert: 3000, master: 15000, legend: 100000, no_shuffle: 5000, puzzle: 0 };
                const req = minCoins[venueKey] || 0;
                if (mode !== 'PUZZLE' && this.systems.storage.data.currencies.coins < req) {
                    window.showGameConfirm({
                        title: '金币不足',
                        message: `进入该场次需要 ${req.toLocaleString()} 金币。\n是否前往领取破产救济金或抽取幸运转盘？`,
                        confirmText: '去获取金币',
                        cancelText: '稍后再来',
                        icon: '🪙'
                    }).then(ok => {
                        if (ok) {
                            if (this.systems.economy.canClaimRelief()) {
                                this.handleClaimRelief();
                            } else {
                                this.openWheelModal();
                            }
                        }
                    });
                    return;
                }

                // 核心动画：卡牌放大穿梭进入牌局
                card.classList.add('card-diving');

                if (window.audio) {
                    window.audio.playTone(392, 'triangle', 0.2, 0.4);
                    setTimeout(() => window.audio.playTone(523.25, 'triangle', 0.25, 0.4), 120);
                    setTimeout(() => window.audio.playTone(659.25, 'triangle', 0.35, 0.5), 240);
                }

                setTimeout(() => {
                    card.classList.remove('card-diving');
                    if (mode === 'PUZZLE') {
                        this.openPuzzleModal();
                    } else {
                        this.onStartMatch(venueKey, mode);
                    }
                }, 520);
            });
        });
    }

    updateActiveDot(index) {
        this.activeCardIndex = index;
        this.carouselDots.forEach((d, i) => {
            if (i === index) d.classList.add('active');
            else d.classList.remove('active');
        });
    }

    updateHeaderHUD() {
        const data = this.systems.storage.data;
        const rankInfo = this.systems.rank.getCurrentRankInfo();
        const activeChar = this.systems.character.getActiveCharacter();

        if (this.playerAvatarEl) this.playerAvatarEl.innerText = activeChar.icon;
        if (this.playerNameEl) this.playerNameEl.innerText = data.profile.nickname;
        if (this.playerTitleEl) this.playerTitleEl.innerText = data.cosmetics.equippedTitle || '初出茅庐';

        if (this.rankBadgeEl) {
            this.rankBadgeEl.innerHTML = `${rankInfo.icon} ${rankInfo.name} <span class="stars-text">${rankInfo.starText}</span>`;
        }

        if (this.coinsValEl) this.coinsValEl.innerText = data.currencies.coins.toLocaleString();
        if (this.diamondsValEl) this.diamondsValEl.innerText = data.currencies.diamonds.toLocaleString();
        if (this.energyValEl) this.energyValEl.innerText = `${data.currencies.energy}/${data.currencies.maxEnergy}`;

        // 检查救济金是否可领
        if (this.reliefBtn) {
            const canRelief = this.systems.economy.canClaimRelief();
            this.reliefBtn.style.display = canRelief ? 'inline-flex' : 'none';
        }
    }

    handleClaimRelief() {
        const res = this.systems.economy.claimRelief();
        if (res.success) {
            this.updateHeaderHUD();
            this.systems.storage.save(this.systems.storage.data);
            window.showGameToast(`💰 救济金到账！获得 3,000 金币！（今日剩余: ${res.remainingTimes}次）`, 'success');
        } else {
            window.showGameToast(res.message, 'warning');
        }
    }

    bindModalButtons() {
        // 角色弹窗
        document.getElementById('nav-character-btn')?.addEventListener('click', () => this.openCharacterModal());
        // 天赋弹窗
        document.getElementById('nav-talent-btn')?.addEventListener('click', () => this.openTalentModal());
        // 任务成就弹窗
        document.getElementById('nav-quest-btn')?.addEventListener('click', () => this.openQuestModal());
        // 签到弹窗
        document.getElementById('nav-signin-btn')?.addEventListener('click', () => this.openSignInModal());
        // 转盘弹窗
        document.getElementById('nav-wheel-btn')?.addEventListener('click', () => this.openWheelModal());
        // 商城弹窗
        document.getElementById('nav-shop-btn')?.addEventListener('click', () => this.openShopModal());
        // 残局闯关
        document.getElementById('nav-puzzle-btn')?.addEventListener('click', () => this.openPuzzleModal());

        // 关闭按钮
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.app-modal');
                if (modal) modal.classList.add('hidden');
            });
        });

        // 点击遮罩背景关闭弹窗
        document.querySelectorAll('.app-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    // 1. 角色面板
    openCharacterModal() {
        const modal = document.getElementById('character-modal');
        const container = document.getElementById('character-list-container');
        if (!modal || !container) return;

        const chars = this.systems.character.getAllCharacters();
        container.innerHTML = '';

        chars.forEach(char => {
            const card = document.createElement('div');
            card.className = `character-item-card ${char.isActive ? 'active-card' : ''}`;
            card.innerHTML = `
                <div class="char-icon" style="background:${char.color}22">${char.icon}</div>
                <div class="char-details">
                    <div class="char-name">${char.name} <span class="char-lv">Lv.${char.level} (${char.stars}★)</span></div>
                    <div class="char-title-tag">${char.title}</div>
                    <div class="char-passive">${char.passiveDesc}</div>
                    <div class="char-skill"><strong>技能·${char.skillName}:</strong> ${char.skillDesc}</div>
                </div>
                <div class="char-actions">
                    ${char.isActive ? '<span class="status-badge">出战中</span>' : 
                      (char.isUnlocked ? `<button class="btn-primary-sm btn-select-char" data-id="${char.id}">出战</button>` : 
                       `<button class="btn-warning-sm btn-unlock-char" data-id="${char.id}">解锁(10碎片)</button>`)}
                    ${char.isUnlocked && char.level < 10 ? 
                      `<button class="btn-success-sm btn-upgrade-char" data-id="${char.id}">升级 (${char.level * 3000}金币)</button>` : ''}
                </div>
            `;
            container.appendChild(card);
        });

        // 绑定出战与升级事件
        container.querySelectorAll('.btn-select-char').forEach(b => {
            b.addEventListener('click', () => {
                this.systems.character.setActiveCharacter(b.dataset.id);
                this.updateHeaderHUD();
                this.openCharacterModal();
            });
        });

        container.querySelectorAll('.btn-upgrade-char').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.character.upgradeCharacter(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.openCharacterModal();
                    this.systems.storage.save(this.systems.storage.data);
                    window.showGameToast('🎉 角色升级成功！技能效果已增强！', 'success');
                } else {
                    window.showGameToast(res.message, 'warning');
                }
            });
        });

        modal.classList.remove('hidden');
    }

    // 2. 天赋树面板
    openTalentModal() {
        const modal = document.getElementById('talent-modal');
        const container = document.getElementById('talent-list-container');
        if (!modal || !container) return;

        const talents = this.systems.talent.getAllTalents();
        container.innerHTML = '';

        talents.forEach(t => {
            const el = document.createElement('div');
            el.className = 'talent-item-card';
            el.innerHTML = `
                <div class="talent-icon">${t.icon}</div>
                <div class="talent-info">
                    <div class="talent-name">${t.name} <span class="talent-lv">Lv.${t.currentLevel}/${t.maxLevel}</span></div>
                    <div class="talent-curr-desc">当前: ${t.desc}</div>
                    ${!t.isMax ? `<div class="talent-next-desc">下级: ${t.nextDesc}</div>` : '<div class="talent-max-tag">已满级</div>'}
                </div>
                <div class="talent-action">
                    ${!t.isMax ? `<button class="btn-primary-sm btn-upgrade-talent" data-id="${t.id}">升级 (${t.nextCost.toLocaleString()}金币)</button>` : '<span class="status-badge">MAX</span>'}
                </div>
            `;
            container.appendChild(el);
        });

        container.querySelectorAll('.btn-upgrade-talent').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.talent.upgradeTalent(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.openTalentModal();
                    this.systems.storage.save(this.systems.storage.data);
                    window.showGameToast('✨ 天赋升级成功！属性已加成！', 'success');
                } else {
                    window.showGameToast(res.message, 'warning');
                }
            });
        });

        modal.classList.remove('hidden');
    }

    // 3. 每日任务与成就面板
    openQuestModal() {
        const modal = document.getElementById('quest-modal');
        const dailyContainer = document.getElementById('daily-quests-container');
        const achContainer = document.getElementById('achievements-container');
        if (!modal) return;

        // 每日任务渲染
        dailyContainer.innerHTML = '';
        this.systems.quest.data.quests.daily.forEach(q => {
            const el = document.createElement('div');
            el.className = 'quest-item-row';
            const progress = `${q.current}/${q.target}`;
            const canClaim = q.current >= q.target && !q.claimed;
            el.innerHTML = `
                <div class="quest-text">
                    <div class="quest-title">${q.title} <span class="quest-progress">(${progress})</span></div>
                    <div class="quest-desc">${q.desc}</div>
                    <div class="quest-rewards">奖励: 🪙 +${q.rewardCoins} | 💎 +${q.rewardDiamonds}</div>
                </div>
                <div class="quest-btn-box">
                    ${q.claimed ? '<span class="status-badge">已完成</span>' : 
                      (canClaim ? `<button class="btn-success-sm btn-claim-quest" data-id="${q.id}">领取</button>` : 
                       '<span class="quest-doing-badge">进行中</span>')}
                </div>
            `;
            dailyContainer.appendChild(el);
        });

        dailyContainer.querySelectorAll('.btn-claim-quest').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.quest.claimQuestReward(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.openQuestModal();
                    this.systems.storage.save(this.systems.storage.data);
                }
            });
        });

        // 永久成就渲染
        achContainer.innerHTML = '';
        Object.values(this.systems.quest.data.achievements).forEach(ach => {
            const el = document.createElement('div');
            el.className = 'quest-item-row';
            const canClaim = ach.done && !ach.claimed;
            el.innerHTML = `
                <div class="quest-text">
                    <div class="quest-title">${ach.name} <span class="quest-progress">(${ach.current}/${ach.target})</span></div>
                    <div class="quest-desc">${ach.desc}</div>
                    <div class="quest-rewards">奖励: 💎 +${ach.rewardDiamonds} ${ach.title ? `| 称号: 【${ach.title}】` : ''}</div>
                </div>
                <div class="quest-btn-box">
                    ${ach.claimed ? '<span class="status-badge">已达成</span>' : 
                      (canClaim ? `<button class="btn-success-sm btn-claim-ach" data-id="${ach.id}">领取</button>` : 
                       '<span class="quest-doing-badge">未达成</span>')}
                </div>
            `;
            achContainer.appendChild(el);
        });

        achContainer.querySelectorAll('.btn-claim-ach').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.quest.claimAchievementReward(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.openQuestModal();
                    this.systems.storage.save(this.systems.storage.data);
                }
            });
        });

        modal.classList.remove('hidden');
    }

    // 4. 每日签到
    openSignInModal() {
        const modal = document.getElementById('signin-modal');
        const container = document.getElementById('signin-grid-container');
        const claimBtn = document.getElementById('btn-execute-signin');
        if (!modal || !container) return;

        const status = this.systems.quest.getSignInStatus();
        container.innerHTML = '';

        status.rewards.forEach((r, idx) => {
            const isToday = idx === status.currentDayIndex;
            const isSigned = idx < status.currentDayIndex;
            const el = document.createElement('div');
            el.className = `signin-card-day ${isToday ? 'today-active' : ''} ${isSigned ? 'signed-done' : ''}`;
            el.innerHTML = `
                <div class="signin-day-title">第 ${r.day} 天</div>
                <div class="signin-gift-icon">🎁</div>
                <div class="signin-gift-desc">${r.text}</div>
                ${isSigned ? '<div class="signin-stamp">✔ 已领</div>' : ''}
            `;
            container.appendChild(el);
        });

        if (claimBtn) {
            claimBtn.disabled = !status.canClaim;
            claimBtn.innerText = status.canClaim ? '立即签到领奖' : '今日已签到';
            claimBtn.onclick = () => {
                const res = this.systems.quest.claimSignIn();
                if (res.success) {
                    this.updateHeaderHUD();
                    this.openSignInModal();
                    this.systems.storage.save(this.systems.storage.data);
                    window.showGameToast(`🎉 签到成功！获得：${res.reward.text}`, 'success');
                }
            };
        }

        modal.classList.remove('hidden');
    }

    // 5. 幸运转盘
    openWheelModal() {
        const modal = document.getElementById('wheel-modal');
        const spinBtn = document.getElementById('btn-spin-wheel');
        const wheelEl = document.getElementById('wheel-disk');
        if (!modal) return;

        if (spinBtn) {
            spinBtn.onclick = () => {
                spinBtn.disabled = true;
                const res = this.systems.shop.spinWheel(false);
                if (!res.success) {
                    window.showGameToast(res.message, 'warning');
                    spinBtn.disabled = false;
                    return;
                }

                // 旋转动画 (随机旋转 4~6 圈 + 角度)
                const randomDeg = 1440 + Math.floor(Math.random() * 360);
                if (wheelEl) {
                    wheelEl.style.transition = 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
                    wheelEl.style.transform = `rotate(${randomDeg}deg)`;
                }

                setTimeout(() => {
                    this.updateHeaderHUD();
                    this.systems.storage.save(this.systems.storage.data);
                    window.showGameToast(`🎊 恭喜抽中大奖：【${res.prize.name}】！`, 'success', 3500);
                    spinBtn.disabled = false;
                }, 3700);
            };
        }

        modal.classList.remove('hidden');
    }

    // 6. 商城面板（多分类、拟物预览、品阶标记与分级定价）
    openShopModal() {
        const modal = document.getElementById('shop-modal');
        const container = document.getElementById('shop-items-container');
        if (!modal || !container) return;

        // 更新顶部资产显示
        const coinsEl = document.getElementById('shop-coins-display');
        const diamondsEl = document.getElementById('shop-diamonds-display');
        if (coinsEl) coinsEl.innerText = (this.systems.storage.data.currencies.coins || 0).toLocaleString();
        if (diamondsEl) diamondsEl.innerText = (this.systems.storage.data.currencies.diamonds || 0).toLocaleString();

        if (!this.currentShopTab) this.currentShopTab = 'all';

        // 绑定分类切换标签
        const nav = document.getElementById('shop-tabs-nav');
        if (nav && !nav._tabBound) {
            nav._tabBound = true;
            nav.querySelectorAll('.shop-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    nav.querySelectorAll('.shop-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.currentShopTab = btn.dataset.tab;
                    this.renderShopItems(container);
                });
            });
        }

        this.renderShopItems(container);
        modal.classList.remove('hidden');
    }

    renderShopItems(container) {
        container.innerHTML = '';
        const activeTab = this.currentShopTab || 'all';
        const allItems = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : [];
        const items = activeTab === 'all' ? allItems : allItems.filter(i => i.type === activeTab);

        items.forEach(item => {
            const isOwned = this.systems.shop.isItemOwned(item);
            const isEquipped = this.systems.shop.isItemEquipped(item);
            const el = document.createElement('div');
            el.className = `shop-item-card rarity-card-${item.rarity || 'common'}`;

            // 生成预览图/样式缩略组件
            let previewHtml = '';
            if (item.type === 'table') {
                previewHtml = `
                    <div class="shop-preview-box preview-table ${item.id}">
                        <div class="mini-table-felt">
                            <span class="mini-table-crest">✦</span>
                        </div>
                    </div>
                `;
            } else if (item.type === 'back') {
                previewHtml = `
                    <div class="shop-preview-box">
                        <div class="mini-card-back card-skin-${item.id}">
                            <div class="mini-back-pattern"></div>
                        </div>
                    </div>
                `;
            } else if (item.type === 'effect') {
                previewHtml = `
                    <div class="shop-preview-box preview-effect">
                        <div class="mini-effect-aura">
                            <span class="effect-anim-icon">${item.icon}</span>
                        </div>
                    </div>
                `;
            } else if (item.type === 'title') {
                previewHtml = `
                    <div class="shop-preview-box preview-title">
                        <div class="mini-title-ribbon">
                            <span class="title-badge-inner">${item.titleText || item.name}</span>
                        </div>
                    </div>
                `;
            }

            const priceHtml = item.cost === 0 ? 
                '<span class="price-pill free">默认拥有</span>' : 
                (item.costType === 'diamonds' ? 
                    `<span class="price-pill diamond">💎 ${item.cost}</span>` : 
                    `<span class="price-pill coin">🪙 ${item.cost.toLocaleString()}</span>`);

            el.innerHTML = `
                <div class="shop-item-header">
                    <span class="shop-rarity-pill rarity-${item.rarity || 'common'}">${item.tag || '经典'}</span>
                </div>
                ${previewHtml}
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                <div class="shop-item-price-bar">${priceHtml}</div>
                <div class="shop-item-action">
                    ${isEquipped ? '<span class="status-badge equipped-badge">已佩戴</span>' : 
                      (isOwned ? `<button class="btn-primary-sm btn-equip-item" data-id="${item.id}">佩戴</button>` : 
                       `<button class="btn-warning-sm btn-buy-item" data-id="${item.id}">购买解锁</button>`)}
                </div>
            `;
            container.appendChild(el);
        });

        // 绑定购买事件
        container.querySelectorAll('.btn-buy-item').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.shop.buyItem(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.systems.storage.save(this.systems.storage.data);
                    window.showGameToast(res.message, 'success');
                    if (window.tableRenderer) window.tableRenderer.applyCosmetics();
                    this.openShopModal();
                } else {
                    window.showGameToast(res.message, 'warning');
                }
            });
        });

        // 绑定装备事件
        container.querySelectorAll('.btn-equip-item').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.shop.equipItem(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.systems.storage.save(this.systems.storage.data);
                    window.showGameToast(res.message, 'success');
                    if (window.tableRenderer) window.tableRenderer.applyCosmetics();
                    this.openShopModal();
                } else {
                    window.showGameToast(res.message, 'warning');
                }
            });
        });
    }

    // 7. 残局解密闯关面板
    openPuzzleModal() {
        const modal = document.getElementById('puzzle-modal');
        const container = document.getElementById('puzzle-list-container');
        if (!modal || !container) return;

        const puzzles = this.systems.puzzle.getAllPuzzles();
        container.innerHTML = '';

        puzzles.forEach(p => {
            const el = document.createElement('div');
            el.className = `puzzle-item-card ${p.isCompleted ? 'puz-done' : ''} ${!p.isUnlocked ? 'puz-locked' : ''}`;
            el.innerHTML = `
                <div class="puz-title">${p.title}</div>
                <div class="puz-desc">${p.desc}</div>
                <div class="puz-reward">通关奖励: 🪙 +${p.rewardCoins} | 💎 +${p.rewardDiamonds}</div>
                <div class="puz-action">
                    ${p.isCompleted ? '<span class="status-badge">已破局</span>' : 
                      (p.isUnlocked ? `<button class="btn-success-sm btn-start-puzzle" data-id="${p.id}">开始挑战</button>` : 
                       '<span class="locked-text">🔒 前一关解锁</span>')}
                </div>
            `;
            container.appendChild(el);
        });

        container.querySelectorAll('.btn-start-puzzle').forEach(b => {
            b.addEventListener('click', () => {
                modal.classList.add('hidden');
                this.onStartPuzzle(b.dataset.id);
            });
        });

        modal.classList.remove('hidden');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LobbyRenderer };
}
