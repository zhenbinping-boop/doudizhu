/**
 * AudioEngine.js
 * 纯原生 Web Audio API 程序化音频合成引擎
 * 零外链音频依赖，离线可用，音效涵盖：发牌、出牌、炸弹爆破、王炸火箭、飞机引擎、胜利/失败号角等
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.2) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // 发牌音效 (轻快清脆扑克滑动声)
    playDeal() {
        this.playTone(600 + Math.random() * 200, 'triangle', 0.05, 0.15);
    }

    // 选中/抬起扑克 (清脆纸牌弹拨声)
    playCardSelect() {
        this.playTone(587.33, 'triangle', 0.05, 0.12);
    }

    // 取消选中扑克 (柔和回落音)
    playCardUnselect() {
        this.playTone(440, 'sine', 0.04, 0.08);
    }

    // 出牌落地音 (清脆拍桌声)
    playCardPlay() {
        this.init();
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
    }

    // 过牌/不出
    playPass() {
        this.playTone(280, 'sine', 0.1, 0.1);
    }

    // 炸弹爆炸音效 (震撼低频白噪重炮)
    playBomb() {
        this.init();
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.6);
    }

    // 王炸/火箭发射与爆破
    playRocket() {
        this.init();
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 呼啸冲天
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.4, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);

        // 紧接着核爆
        setTimeout(() => this.playBomb(), 400);
    }

    // 飞机轰鸣
    playAirplane() {
        this.init();
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(360, now + 0.3);
        osc.frequency.linearRampToValueAtTime(160, now + 0.7);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.75);
    }

    // 春天/春风拂面琶音
    playSpring() {
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                this.playTone(freq, 'sine', 0.25, 0.2);
            }, idx * 100);
        });
    }

    // 获胜欢呼号角
    playWin() {
        const chords = [
            { f: 523.25, d: 0.15 },
            { f: 659.25, d: 0.15 },
            { f: 783.99, d: 0.18 },
            { f: 1046.50, d: 0.5 }
        ];
        chords.forEach((c, idx) => {
            setTimeout(() => {
                this.playTone(c.f, 'triangle', c.d, 0.3);
            }, idx * 140);
        });
    }

    // 失败低音
    playDefeat() {
        const chords = [
            { f: 440, d: 0.2 },
            { f: 392, d: 0.2 },
            { f: 349.23, d: 0.25 },
            { f: 293.66, d: 0.6 }
        ];
        chords.forEach((c, idx) => {
            setTimeout(() => {
                this.playTone(c.f, 'sawtooth', c.d, 0.2);
            }, idx * 160);
        });
    }

    // 金币叮当声
    playCoin() {
        this.playTone(1567.98, 'sine', 0.1, 0.2);
        setTimeout(() => this.playTone(2093.00, 'sine', 0.15, 0.2), 60);
    }

    // 倒计时嘀嗒
    playTick() {
        this.playTone(880, 'sine', 0.04, 0.08);
    }
}

// 挂载全局音频单例
const audio = new AudioEngine();
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioEngine, audio };
}
