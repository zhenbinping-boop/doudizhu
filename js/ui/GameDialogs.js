/**
 * GameDialogs.js
 * 游戏内沉浸式浮动提示 (Toast) 与拟物化确认弹窗 (Confirm)
 * 彻底替换原生侵入式浏览器 alert() 与 confirm()
 */

class GameDialogs {
    static init() {
        this.toastContainer = document.getElementById('game-toast-container');
        this.confirmModal = document.getElementById('game-confirm-modal');
        this.confirmIcon = document.getElementById('confirm-modal-icon');
        this.confirmTitle = document.getElementById('confirm-modal-title');
        this.confirmMsg = document.getElementById('confirm-modal-message');
        this.btnCancel = document.getElementById('confirm-btn-cancel');
        this.btnOk = document.getElementById('confirm-btn-ok');

        this.confirmResolver = null;

        if (this.btnCancel) {
            this.btnCancel.addEventListener('click', () => this.resolveConfirm(false));
        }
        if (this.btnOk) {
            this.btnOk.addEventListener('click', () => this.resolveConfirm(true));
        }

        // 点击遮罩外部取消
        if (this.confirmModal) {
            this.confirmModal.addEventListener('click', (e) => {
                if (e.target === this.confirmModal) {
                    this.resolveConfirm(false);
                }
            });
        }

        // ESC 键关闭确认弹窗
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.confirmModal && !this.confirmModal.classList.contains('hidden')) {
                this.resolveConfirm(false);
            }
        });
    }

    static resolveConfirm(val) {
        if (this.confirmModal) {
            this.confirmModal.classList.add('hidden');
        }
        if (typeof this.confirmResolver === 'function') {
            const cb = this.confirmResolver;
            this.confirmResolver = null;
            cb(val);
        }
    }

    /**
     * 游戏内悬浮轻量 Toast 提示
     * @param {string} message 提示文本
     * @param {'info'|'success'|'warning'|'error'} type 提示类型
     * @param {number} duration 停留毫秒数
     */
    static showToast(message, type = 'info', duration = 2600) {
        if (!this.toastContainer) {
            this.toastContainer = document.getElementById('game-toast-container');
        }
        if (!this.toastContainer) return;

        const iconMap = {
            success: '🎉',
            warning: '⚠️',
            error: '❌',
            info: '💡'
        };

        const toast = document.createElement('div');
        toast.className = `game-toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${iconMap[type] || '🔔'}</span>
            <span class="toast-text">${message}</span>
        `;

        // 点击立即消除
        toast.addEventListener('click', () => {
            this.removeToast(toast);
        });

        this.toastContainer.appendChild(toast);

        // Anime.js 平滑弹簧浮现动效
        if (typeof anime !== 'undefined') {
            anime({
                targets: toast,
                translateY: [-24, 0],
                opacity: [0, 1],
                scale: [0.92, 1],
                duration: 280,
                easing: 'easeOutElastic(1, .8)'
            });
        }

        // 自动延时消散
        setTimeout(() => {
            this.removeToast(toast);
        }, duration);
    }

    static removeToast(toast) {
        if (!toast || toast._removing) return;
        toast._removing = true;

        if (typeof anime !== 'undefined') {
            anime({
                targets: toast,
                translateY: [0, -18],
                opacity: [1, 0],
                scale: [1, 0.9],
                duration: 220,
                easing: 'easeInQuad',
                complete: () => toast.remove()
            });
        } else {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-15px)';
            setTimeout(() => toast.remove(), 200);
        }
    }

    /**
     * 游戏内拟物确认弹窗 (Promise 异步支持)
     * @param {object} options
     * @returns {Promise<boolean>}
     */
    static showConfirm({ title = '系统提示', message = '确定执行此操作吗？', confirmText = '确定', cancelText = '取消', icon = '⚠️' } = {}) {
        if (!this.confirmModal) this.init();

        if (this.confirmTitle) this.confirmTitle.innerText = title;
        if (this.confirmMsg) this.confirmMsg.innerText = message;
        if (this.confirmIcon) this.confirmIcon.innerText = icon;
        if (this.btnOk) this.btnOk.innerText = confirmText;
        if (this.btnCancel) this.btnCancel.innerText = cancelText;

        if (this.confirmModal) {
            this.confirmModal.classList.remove('hidden');
            const panel = this.confirmModal.querySelector('.game-confirm-panel');
            if (panel && typeof anime !== 'undefined') {
                anime({
                    targets: panel,
                    scale: [0.85, 1],
                    opacity: [0, 1],
                    duration: 240,
                    easing: 'easeOutBack'
                });
            }
        }

        return new Promise((resolve) => {
            this.confirmResolver = resolve;
        });
    }
}

// 注入到全局 window，方便所有模块直接调用
window.showGameToast = (msg, type, duration) => GameDialogs.showToast(msg, type, duration);
window.showGameConfirm = (options) => GameDialogs.showConfirm(options);

document.addEventListener('DOMContentLoaded', () => {
    GameDialogs.init();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameDialogs };
}
