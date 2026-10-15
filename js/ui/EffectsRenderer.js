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

    // 炸弹特效
    triggerBomb(x, y) {
        this.shakeScreen(15, 500);

        // 产生火花与烟尘粒子
        const colors = ['#f56565', '#ed8936', '#ecc94b', '#ffffff'];
        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 4;
            this.particles.push({
                type: 'circle',
                x: x || window.innerWidth / 2,
                y: y || window.innerHeight / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.15,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                decay: Math.random() * 0.03 + 0.015
            });
        }

        // 巨幅炸弹字样
        this.showFloatingBanner('💣 炸弹翻倍！', x || window.innerWidth / 2, (y || window.innerHeight / 2) - 40, '#f56565');
        this.startLoop();
    }

    // 王炸/火箭特效
    triggerRocket() {
        this.shakeScreen(22, 700);

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // 火箭冲天尾焰
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
