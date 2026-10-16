/**
 * EffectsRenderer.js
 * 负责牌桌粒子特效、炸弹爆破、王炸火箭、飞机横穿、春天落花与屏幕震颤
 */

class EffectsRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.particles = [];
        this.running = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startLoop() {
        if (this.running) return;
        this.running = true;
        const loop = () => {
            if (this.particles.length > 0) {
                this.update();
                this.render();
                requestAnimationFrame(loop);
            } else {
                this.running = false;
                if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        };
        requestAnimationFrame(loop);
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity || 0;
            p.alpha -= p.decay || 0.02;
            p.rotation = (p.rotation || 0) + (p.rotSpeed || 0);

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (const p of this.particles) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation || 0);

            if (p.type === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fillStyle = p.color;
                this.ctx.fill();
            } else if (p.type === 'coin') {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ffd700';
                this.ctx.fill();
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = '#d69e2e';
                this.ctx.stroke();
            } else if (p.type === 'petal') {
                this.ctx.beginPath();
                this.ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = p.color || '#fbb6ce';
                this.ctx.fill();
            } else if (p.type === 'text') {
                this.ctx.font = `bold ${p.size}px "Microsoft YaHei", sans-serif`;
                this.ctx.fillStyle = p.color;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(p.text, 0, 0);
            }

            this.ctx.restore();
        }
    }

    // 屏幕震颤
    shakeScreen(intensity = 10, durationMs = 400) {
        const table = document.getElementById('game-table-container');
        if (!table) return;

        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= durationMs) {
                clearInterval(interval);
                table.style.transform = 'none';
                return;
            }
            const decay = 1 - (elapsed / durationMs);
            const dx = (Math.random() * 2 - 1) * intensity * decay;
            const dy = (Math.random() * 2 - 1) * intensity * decay;
            table.style.transform = `translate(${dx}px, ${dy}px)`;
        }, 16);
    }

    // 炸弹特效 (依据装备的商城特效动态渲染)
    triggerBomb(x, y) {
        const effect = this.equippedEffect || 'effect_bomb_classic';
        const cx = x || window.innerWidth / 2;
        const cy = y || window.innerHeight / 2;

        if (effect === 'effect_nuke') {
            this.shakeScreen(28, 750);
            const nukeColors = ['#f97316', '#ef4444', '#facc15', '#451a03', '#ffffff'];
            for (let i = 0; i < 90; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 16 + 5;
                this.particles.push({
                    type: 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 2,
                    gravity: 0.1,
                    size: Math.random() * 12 + 6,
                    color: nukeColors[Math.floor(Math.random() * nukeColors.length)],
                    alpha: 1.0,
                    decay: 0.018
                });
            }
            this.showFloatingBanner('☢️ 末日核弹·寸草不生！', cx, cy - 50, '#ef4444');
        } else if (effect === 'effect_dragon') {
            this.shakeScreen(24, 650);
            const dragonColors = ['#f59e0b', '#fbbf24', '#fef08a', '#d97706', '#ffffff'];
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15 + 4;
                this.particles.push({
                    type: i % 4 === 0 ? 'coin' : 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 3,
                    gravity: 0.08,
                    size: Math.random() * 10 + 4,
                    color: dragonColors[Math.floor(Math.random() * dragonColors.length)],
                    alpha: 1.0,
                    decay: 0.016
                });
            }
            this.showFloatingBanner('🐉 龙吟九霄·天尊降世！', cx, cy - 50, '#f59e0b');
        } else if (effect === 'effect_lightning') {
            this.shakeScreen(20, 550);
            const lightColors = ['#a855f7', '#c084fc', '#e9d5ff', '#38bdf8', '#ffffff'];
            for (let i = 0; i < 80; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 18 + 6;
                this.particles.push({
                    type: 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 0.05,
                    size: Math.random() * 8 + 3,
                    color: lightColors[Math.floor(Math.random() * lightColors.length)],
                    alpha: 1.0,
                    decay: 0.022
                });
            }
            this.showFloatingBanner('⚡ 狂雷天降·万劫不复！', cx, cy - 50, '#a855f7');
        } else if (effect === 'effect_fireworks') {
            this.shakeScreen(16, 500);
            const fireColors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ffffff'];
            for (let i = 0; i < 90; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 14 + 4;
                this.particles.push({
                    type: i % 3 === 0 ? 'coin' : 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 0.12,
                    size: Math.random() * 9 + 4,
                    color: fireColors[Math.floor(Math.random() * fireColors.length)],
                    alpha: 1.0,
                    decay: 0.018
                });
            }
            this.showFloatingBanner('🎆 祥瑞礼炮·财源广进！', cx, cy - 50, '#ec4899');
        } else {
            // 经典爆破
            this.shakeScreen(15, 500);
            const colors = ['#f56565', '#ed8936', '#ecc94b', '#ffffff'];
            for (let i = 0; i < 60; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 12 + 4;
                this.particles.push({
                    type: 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 0.15,
                    size: Math.random() * 8 + 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    alpha: 1.0,
                    decay: Math.random() * 0.03 + 0.015
                });
            }
            this.showFloatingBanner('💣 经典爆破·威力翻倍！', cx, cy - 40, '#f56565');
        }

        this.startLoop();
    }

    // 王炸/火箭特效
    triggerRocket() {
        const effect = this.equippedEffect || 'effect_bomb_classic';
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        if (effect === 'effect_dragon') {
            this.shakeScreen(28, 850);
            for (let i = 0; i < 130; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 20 + 6;
                this.particles.push({
                    type: i % 3 === 0 ? 'coin' : 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 0.06,
                    size: Math.random() * 12 + 5,
                    color: ['#fbbf24', '#f59e0b', '#d97706', '#fef08a', '#ffffff'][Math.floor(Math.random() * 5)],
                    alpha: 1.0,
                    decay: 0.014
                });
            }
            this.showFloatingBanner('👑 龙皇啸天·至尊无上！', cx, cy - 60, '#f59e0b');
        } else {
            this.shakeScreen(22, 700);
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 18 + 6;
                this.particles.push({
                    type: 'circle',
                    x: cx,
                    y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 0.1,
                    size: Math.random() * 10 + 5,
                    color: ['#e53e3e', '#dd6b20', '#faf089', '#ffffff'][Math.floor(Math.random() * 4)],
                    alpha: 1.0,
                    decay: 0.02
                });
            }
            this.showFloatingBanner('🚀 王炸降临·毁天灭地！', cx, cy - 60, '#e53e3e');
        }

        this.startLoop();
    }

    // 飞机掠过特效
    triggerAirplane() {
        const startY = window.innerHeight * 0.45;
        this.showFloatingBanner('✈️ 飞机呼啸！', window.innerWidth / 2, startY - 30, '#4299e1');

        // 飞机尾部气流粒子
        let currentX = -50;
        const speed = (window.innerWidth + 100) / 40;
        const timer = setInterval(() => {
            currentX += speed;
            if (currentX > window.innerWidth + 80) {
                clearInterval(timer);
                return;
            }
            for (let i = 0; i < 4; i++) {
                this.particles.push({
                    type: 'circle',
                    x: currentX,
                    y: startY + (Math.random() * 30 - 15),
                    vx: -Math.random() * 4,
                    vy: Math.random() * 2 - 1,
                    size: Math.random() * 12 + 6,
                    color: '#e2e8f0',
                    alpha: 0.8,
                    decay: 0.03
                });
            }
            this.startLoop();
        }, 20);
    }

    // 春天花瓣雨特效
    triggerSpring() {
        const colors = ['#fbb6ce', '#f687b3', '#fed7e2', '#68d391'];
        for (let i = 0; i < 80; i++) {
            this.particles.push({
                type: 'petal',
                x: Math.random() * window.innerWidth,
                y: -Math.random() * 200,
                vx: Math.random() * 3 - 1.5,
                vy: Math.random() * 3 + 2,
                rotation: Math.random() * Math.PI,
                rotSpeed: Math.random() * 0.05 - 0.025,
                size: Math.random() * 10 + 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                decay: 0.008
            });
        }

        this.showFloatingBanner('🌸 春暖花开·春天翻倍！', window.innerWidth / 2, window.innerHeight * 0.35, '#ed64a6');
        this.startLoop();
    }

    // 金币喷涌雨
    triggerCoinFountain(targetX, targetY) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 4;
            this.particles.push({
                type: 'coin',
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.25,
                size: 8,
                alpha: 1.0,
                decay: 0.018
            });
        }
        this.startLoop();
    }

    showFloatingBanner(text, x, y, color = '#ffd700') {
        const banner = document.createElement('div');
        banner.className = 'floating-effect-banner';
        banner.innerText = text;
        banner.style.left = `${x}px`;
        banner.style.top = `${y}px`;
        banner.style.color = color;
        document.body.appendChild(banner);

        setTimeout(() => {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
        }, 1800);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EffectsRenderer };
}
