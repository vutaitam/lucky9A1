/* Âm thanh (tự tạo bằng WebAudio, không cần file) và pháo giấy. */
(function () {
  'use strict';

  const Sound = {
    enabled: true,
    ctx: null,
    lastTick: 0,
    audio() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, at, len, type, vol) {
      const c = this.ctx;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(c.destination);
      o.start(at); o.stop(at + len + 0.02);
    },
    tick() {
      if (!this.enabled) return;
      const now = performance.now();
      if (now - this.lastTick < 35) return;
      this.lastTick = now;
      const c = this.audio(); if (!c) return;
      this.tone(1200 + Math.random() * 250, c.currentTime, 0.045, 'triangle', 0.12);
    },
    win() {
      if (!this.enabled) return;
      const c = this.audio(); if (!c) return;
      const t = c.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.12, 0.25, 'square', 0.06));
      [1046.5, 1318.5, 1568].forEach(f => this.tone(f, t + 0.55, 0.7, 'triangle', 0.07));
    }
  };

  const COLORS = ['#ff5e7e', '#ffb23f', '#ffe14d', '#4cd97b', '#3cc8f0', '#7b6cff', '#c86bfa', '#ffffff'];

  function confetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    const parts = [];
    const shoot = (x, dir) => {
      for (let i = 0; i < 90; i++) {
        const ang = (-Math.PI / 2) + dir * (0.25 + Math.random() * 0.6);
        const sp = 9 + Math.random() * 11;
        parts.push({
          x, y: H + 10, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 1.25,
          w: 6 + Math.random() * 7, h: 8 + Math.random() * 10,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35,
          color: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3
        });
      }
    };
    shoot(W * 0.08, 1);
    shoot(W * 0.92, -1);
    const t0 = performance.now();
    const step = now => {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 2);
        ctx.restore();
      });
      if (now - t0 < 4000) requestAnimationFrame(step);
      else cv.remove();
    };
    requestAnimationFrame(step);
  }

  window.Sound = Sound;
  window.Confetti = { burst: confetti };
})();
