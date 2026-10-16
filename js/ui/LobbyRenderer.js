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
        this.marqueeInterval = null;

        this.initDom();
        this.updateHeaderHUD();
        this.startMarquee();
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

        // 主角立绘与快速开始推荐
        this.heroAvatarEl = document.getElementById('lobby-hero-avatar');
        this.heroQuoteEl = document.getElementById('lobby-hero-quote');
        this.recommendedVenueEl = document.getElementById('qp-recommended-venue');
        this.quickStartBtn = document.getElementById('btn-quick-start');
        this.marqueeTextEl = document.getElementById('marquee-text');

        if (this.quickStartBtn) {
            this.quickStartBtn.addEventListener('click', () => {
                const best = this.getRecommendedVenue();
                this.onStartMatch(best.key, 'CLASSIC');
            });
        }

        // 救济金按钮
        this.reliefBtn = document.getElementById('btn-claim-relief');
        if (this.reliefBtn) {
            this.reliefBtn.addEventListener('click', () => this.handleClaimRelief());
        }

        // 调试模式按钮
        const debugBtn = document.getElementById('btn-debug-cheat');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                if (confirm('确认开启测试模式，直接获得 500,000 金币、1000 钻石并解锁全角色？')) {
                    this.systems.storage.grantDebugResources(this.systems.storage.data);
                    this.updateHeaderHUD();
                    alert('🎉 调试资源已发放！可以自由体验所有高阶场次、商城装扮与顶级天赋！');
                }
            });
        }

        // 绑定场次选择卡片
        document.querySelectorAll('.venue-card').forEach(card => {
            card.addEventListener('click', () => {
                const venueKey = card.dataset.venue;
                const mode = card.dataset.mode || 'CLASSIC';
                this.onStartMatch(venueKey, mode);
            });
        });

        // 绑定功能弹窗按钮
        this.bindModalButtons();
    }

    getRecommendedVenue() {
        const coins = this.systems.storage.data.currencies.coins;
        if (coins >= 100000) return { key: 'legend', name: '推荐：至尊巅峰场' };
        if (coins >= 15000) return { key: 'master', name: '推荐：大师荣耀场' };
        if (coins >= 3000) return { key: 'expert', name: '推荐：进阶高手场' };
        return { key: 'novice', name: '推荐：新手初级场' };
    }

    startMarquee() {
        const messages = [
            '📢 热烈欢迎来到《斗地主宗师》！当前全服高手云集，排位赛季激战正酣！',
            '🎉 恭喜玩家【牌皇绝影】在至尊巅峰场赢得 2,480,000 金币！',
            '⚡ 不洗牌狂欢场全面开放！连环炸弹、火箭满天飞，刺激翻倍！',
            '🌾 每日任务与七日签到好礼刷新，领金币、钻石与保星卡！',
            '🌲 天赋科技六维树已开启！加点强化金币收益与炸弹免伤！',
            '🧩 经典六大残局闯关上线！烧脑解密，破局赢取海量钻石！'
        ];
        let msgIndex = 0;
        if (this.marqueeInterval) clearInterval(this.marqueeInterval);
        this.marqueeInterval = setInterval(() => {
            if (this.marqueeTextEl) {
                this.marqueeTextEl.style.opacity = '0';
                this.marqueeTextEl.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    msgIndex = (msgIndex + 1) % messages.length;
                    this.marqueeTextEl.innerText = messages[msgIndex];
                    this.marqueeTextEl.style.opacity = '1';
                    this.marqueeTextEl.style.transform = 'translateY(0)';
                }, 300);
            }
        }, 5000);
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

        // 动态刷新英雄展示与台词
        if (this.heroAvatarEl) this.heroAvatarEl.innerText = activeChar.icon;
        if (this.heroQuoteEl) {
            const quote = CHARACTER_QUOTES[activeChar.id] || '牌友你好！今天手气正旺，点击【快速开始】来一局巅峰对决吧！';
            this.heroQuoteEl.innerText = `"${quote}"`;
        }
        if (this.recommendedVenueEl) {
            const rec = this.getRecommendedVenue();
            this.recommendedVenueEl.innerText = rec.name;
        }

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
            alert(`💰 救济金到账！获得 3,000 金币！（今日剩余次数: ${res.remainingTimes}）`);
        } else {
            alert(res.message);
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
                } else {
                    alert(res.message);
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
                } else {
                    alert(res.message);
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
                    alert(`🎉 签到成功！获得：${res.reward.text}`);
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
                    alert(res.message);
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
                    alert(`🎊 恭喜抽中大奖：【${res.prize.name}】！`);
                    spinBtn.disabled = false;
                }, 3700);
            };
        }

        modal.classList.remove('hidden');
    }

    // 6. 商城面板
    openShopModal() {
        const modal = document.getElementById('shop-modal');
        const container = document.getElementById('shop-items-container');
        if (!modal || !container) return;

        container.innerHTML = '';
        const items = this.systems.shop.data ? SHOP_ITEMS : [];

        items.forEach(item => {
            const isOwned = this.systems.shop.isItemOwned(item);
            const isEquipped = this.systems.shop.isItemEquipped(item);
            const el = document.createElement('div');
            el.className = 'shop-item-card';
            el.innerHTML = `
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                <div class="shop-item-price">${item.cost === 0 ? '默认拥有' : (item.costType === 'diamonds' ? `💎 ${item.cost}` : `🪙 ${item.cost}`)}</div>
                <div class="shop-item-action">
                    ${isEquipped ? '<span class="status-badge">使用中</span>' : 
                      (isOwned ? `<button class="btn-primary-sm btn-equip-item" data-id="${item.id}">装备</button>` : 
                       `<button class="btn-warning-sm btn-buy-item" data-id="${item.id}">购买</button>`)}
                </div>
            `;
            container.appendChild(el);
        });

        container.querySelectorAll('.btn-buy-item').forEach(b => {
            b.addEventListener('click', () => {
                const res = this.systems.shop.buyItem(b.dataset.id);
                if (res.success) {
                    this.updateHeaderHUD();
                    this.openShopModal();
                    this.systems.storage.save(this.systems.storage.data);
                } else {
                    alert(res.message);
                }
            });
        });

        container.querySelectorAll('.btn-equip-item').forEach(b => {
            b.addEventListener('click', () => {
                this.systems.shop.equipItem(b.dataset.id);
                this.openShopModal();
                this.systems.storage.save(this.systems.storage.data);
            });
        });

        modal.classList.remove('hidden');
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
