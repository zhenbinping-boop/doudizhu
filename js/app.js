/**
 * app.js
 * 游戏入口总控：初始化系统、串联音效、特效、牌桌与大厅控制器
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化数据存档与核心成长系统
    const saveData = StorageManager.load();
    const economy = new EconomySystem(saveData);
    const rank = new RankSystem(saveData);
    const character = new CharacterSystem(saveData);
    const talent = new TalentSystem(saveData);
    const quest = new QuestSystem(saveData);
    const shop = new ShopSystem(saveData);
    const puzzle = new EndgamePuzzleSystem(saveData);

    const systems = {
        storage: StorageManager,
        economy,
        rank,
        character,
        talent,
        quest,
        shop,
        puzzle
    };

    // 2. 初始化音效与特效
    const effects = new EffectsRenderer('effects-canvas');

    // 3. 初始化对局引擎与牌桌渲染器
    const engine = new GameEngine(systems);
    const tableRenderer = new TableRenderer(engine, effects, audio);

    // 4. 初始化大厅控制器
    const lobbyView = document.getElementById('lobby-view');
    const tableView = document.getElementById('game-table-container');

    const switchToTable = () => {
        audio.init();
        lobbyView.classList.add('hidden');
        tableView.classList.remove('hidden');
    };

    const switchToLobby = () => {
        tableView.classList.add('hidden');
        lobbyView.classList.remove('hidden');
        lobbyRenderer.updateHeaderHUD();
    };

    // 绑定返回大厅按钮
    document.getElementById('btn-back-lobby')?.addEventListener('click', () => {
        if (engine.state === GAME_STATES.PLAYING) {
            if (confirm('对局正在进行中，现在退出将被判负并扣除底分，确定退出吗？')) {
                engine.handleGameOver(1); // 判负
                switchToLobby();
            }
        } else {
            switchToLobby();
        }
    });

    // 结算弹窗中的“再来一局”与“返回大厅”
    document.getElementById('btn-modal-next-round')?.addEventListener('click', () => {
        document.getElementById('game-over-modal').classList.add('hidden');
        if (engine.mode === 'PUZZLE') {
            switchToLobby();
            lobbyRenderer.openPuzzleModal();
        } else {
            engine.startMatch(engine.venue.id, engine.mode);
        }
    });

    document.getElementById('btn-modal-to-lobby')?.addEventListener('click', () => {
        document.getElementById('game-over-modal').classList.add('hidden');
        switchToLobby();
    });

    // 绑定出牌操作按钮
    document.getElementById('action-play-btn')?.addEventListener('click', () => {
        tableRenderer.triggerPlaySelected();
    });

    document.getElementById('action-hint-btn')?.addEventListener('click', () => {
        tableRenderer.triggerHint();
    });

    document.getElementById('action-pass-btn')?.addEventListener('click', () => {
        engine.executePass(0);
    });

    // 绑定叫分按钮
    document.querySelectorAll('.bid-score-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const score = parseInt(btn.dataset.score);
            engine.handlePlayerBid(0, score);
        });
    });

    // 绑定加倍按钮
    document.querySelectorAll('.btn-double-choice').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.double);
            engine.handlePlayerDouble(val);
        });
    });

    // 启动普通/不洗牌对局
    const handleStartMatch = (venueKey, mode) => {
        const res = engine.startMatch(venueKey, mode);
        if (res.success) {
            switchToTable();
        } else {
            if (res.reason === 'COINS_NOT_ENOUGH') {
                if (confirm(`${res.message}\n金币不足！是否前往领取破产救济金或抽奖？`)) {
                    if (economy.canClaimRelief()) {
                        lobbyRenderer.handleClaimRelief();
                    } else {
                        lobbyRenderer.openWheelModal();
                    }
                }
            } else {
                alert(res.message);
            }
        }
    };

    // 启动残局闯关
    const handleStartPuzzle = (puzzleId) => {
        const puz = PUZZLE_LEVELS.find(p => p.id === puzzleId);
        if (!puz) return;

        switchToTable();
        engine.mode = 'PUZZLE';
        engine.venue = { id: 'puzzle', name: puz.title, baseScore: 200, minCoins: 0 };
        engine.state = GAME_STATES.PLAYING;
        engine.bombCount = 0;
        engine.baseMultiplier = 2;
        engine.landlordSeat = 0; // 玩家始终是残局地主

        engine.playerHands = [
            [...puz.myCards].sort(Card.compare),
            [], // 左侧空
            [...puz.aiCards].sort(Card.compare)  // 右侧 AI 对手
        ];
        engine.bottomCards = [];

        tableRenderer.clearTable();
        tableRenderer.venueTitleEl.innerText = `${puz.title} (残局解密)`;
        tableRenderer.multipliersEl.innerText = `目标: 破局获胜`;
        tableRenderer.renderPlayerHand(engine.playerHands[0]);
        tableRenderer.renderAiHands(0, engine.playerHands[2].length);
        tableRenderer.renderBottomCards([], false);

        // 挂载地主与农民徽章
        const pSeat = document.getElementById('seat-player');
        if (pSeat) {
            const b = document.createElement('div');
            b.className = 'role-tag role-landlord';
            b.innerText = '👑 残局地主';
            pSeat.appendChild(b);
        }
        const aiSeat = document.getElementById('seat-ai-right');
        if (aiSeat) {
            const b = document.createElement('div');
            b.className = 'role-tag role-farmer';
            b.innerText = '🌾 守关AI';
            aiSeat.appendChild(b);
        }

        // 残局获胜监听拦截
        const puzzleGameOverHandler = (summary) => {
            if (engine.mode === 'PUZZLE' && summary.isPlayerWinner) {
                puzzle.completePuzzle(puzzleId);
                lobbyRenderer.updateHeaderHUD();
            }
        };
        engine.on('game_over', puzzleGameOverHandler);

        // 玩家首出
        engine.startPlaying();
    };

    const lobbyRenderer = new LobbyRenderer(systems, handleStartMatch, handleStartPuzzle);

    // 绑定开场欢迎页面的“点击进入游戏”
    const splashScreen = document.getElementById('splash-screen');
    const enterGameBtn = document.getElementById('btn-enter-game');

    if (enterGameBtn && splashScreen) {
        enterGameBtn.addEventListener('click', () => {
            // 用户手势初始化 Web Audio API
            audio.init();
            audio.playTone(523.25, 'triangle', 0.15, 0.25);
            setTimeout(() => audio.playTone(659.25, 'triangle', 0.18, 0.25), 100);
            setTimeout(() => audio.playTone(783.99, 'triangle', 0.25, 0.3), 200);

            // 淡出开场动画，展现大厅 (1.2s 慢速柔和转场)
            splashScreen.classList.add('fade-out');
            setTimeout(() => {
                splashScreen.style.display = 'none';
                lobbyView.classList.remove('hidden');
                lobbyRenderer.updateHeaderHUD();
            }, 1150);
        });
    } else if (splashScreen) {
        splashScreen.style.display = 'none';
        lobbyView.classList.remove('hidden');
    }
});
