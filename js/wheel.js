/* Vòng quay vẽ bằng canvas. Kim chỉ ở đỉnh (12 giờ). */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const POINTER = -Math.PI / 2;
  const COLORS = [
    { bg: '#ff5e7e', fg: '#ffffff' },
    { bg: '#ffb23f', fg: '#4a2600' },
    { bg: '#ffe14d', fg: '#4a3b00' },
    { bg: '#4cd97b', fg: '#06391a' },
    { bg: '#3cc8f0', fg: '#03344a' },
    { bg: '#7b6cff', fg: '#ffffff' },
    { bg: '#c86bfa', fg: '#ffffff' },
    { bg: '#ff8a3d', fg: '#ffffff' }
  ];
  const BULBS = 24;

  function mod(a, n) { return ((a % n) + n) % n; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function Wheel(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.rotation = Math.random() * TAU;
    this.highlight = -1;
    this.lights = 0;
    this.raf = 0;
    this.spinning = false;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.idle = setInterval(() => {
      if (!this.spinning) { this.lights ^= 1; this.draw(); }
    }, 500);
    this.resize();
  }

  Wheel.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    clearInterval(this.idle);
    window.removeEventListener('resize', this.onResize);
  };

  Wheel.prototype.resize = function () {
    const size = this.canvas.clientWidth || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.dpr = dpr;
    this.draw();
  };

  Wheel.prototype.setItems = function (items) {
    this.items = items.slice();
    this.highlight = -1;
    this.draw();
  };

  Wheel.prototype.colorAt = function (i) {
    const n = this.items.length, L = COLORS.length;
    let c = i % L;
    // tránh 2 ô cạnh nhau (ô cuối & ô đầu) trùng màu
    if (n > 1 && i === n - 1 && c === 0) c = 3;
    return COLORS[c];
  };

  Wheel.prototype.draw = function () {
    const ctx = this.ctx, dpr = this.dpr || 1;
    const S = this.canvas.width / dpr;
    if (!S) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    const R = S / 2 - 2;
    const rim = Math.max(12, S * 0.048);
    const r = R - rim;

    // viền vàng
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.35, '#ffc83d');
    g.addColorStop(0.7, '#e08a00');
    g.addColorStop(1, '#ffd966');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = g; ctx.fill();

    const n = this.items.length;
    if (!n) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = '#f1e9ff'; ctx.fill();
    } else {
      const seg = TAU / n;
      for (let i = 0; i < n; i++) {
        const a0 = this.rotation + i * seg;
        const col = this.colorAt(i);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, a0 + seg);
        ctx.closePath();
        ctx.fillStyle = col.bg;
        ctx.fill();
        if (i === this.highlight) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = n > 30 ? 1 : 2;
        ctx.stroke();
      }
      // chữ
      const maxW = r * 0.68;
      const chord = seg * r * 0.78;
      const baseSize = Math.max(8, Math.min(chord * 0.62, S * 0.045, 26));
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const col = this.colorAt(i);
        let size = baseSize;
        let label = this.items[i];
        ctx.font = `700 ${size}px "Baloo 2", system-ui, sans-serif`;
        while (ctx.measureText(label).width > maxW && size > 8) {
          size -= 0.5;
          ctx.font = `700 ${size}px "Baloo 2", system-ui, sans-serif`;
        }
        while (ctx.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -2) + '…';
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation + (i + 0.5) * seg);
        ctx.fillStyle = col.fg;
        if (i === this.highlight) {
          ctx.shadowColor = 'rgba(255,255,255,0.9)';
          ctx.shadowBlur = 8;
        }
        ctx.fillText(label, r - Math.max(10, S * 0.025), 1);
        ctx.restore();
      }
    }

    // bóng mờ bên trong viền
    const shade = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = shade; ctx.fill();

    // bóng đèn trên viền
    const br = Math.max(3, rim * 0.22);
    for (let k = 0; k < BULBS; k++) {
      const a = (k / BULBS) * TAU;
      const x = cx + Math.cos(a) * (R - rim / 2);
      const y = cy + Math.sin(a) * (R - rim / 2);
      const on = (k + this.lights) % 2 === 0;
      ctx.beginPath(); ctx.arc(x, y, br, 0, TAU);
      ctx.fillStyle = on ? '#fffbe6' : '#c46a00';
      if (on) { ctx.shadowColor = '#fff6a8'; ctx.shadowBlur = br * 3; }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  /** Quay để ô `index` dừng dưới kim. Gọi onTick mỗi khi một ô đi qua kim. */
  Wheel.prototype.spinTo = function (index, duration, onTick) {
    const n = this.items.length;
    if (!n) return Promise.resolve();
    const seg = TAU / n;
    const jitter = (Math.random() - 0.5) * 0.7 * seg;
    const target = POINTER - (index + 0.5) * seg + jitter;
    const start = this.rotation;
    const turns = 5 + Math.round(duration / 1500);
    const end = start + turns * TAU + mod(target - start, TAU);
    const t0 = performance.now();
    let last = Math.floor(mod(POINTER - start, TAU) / seg);
    this.highlight = -1;
    this.spinning = true;
    return new Promise(resolve => {
      const step = now => {
        const t = Math.min(1, (now - t0) / duration);
        this.rotation = start + (end - start) * easeOut(t);
        this.lights = Math.floor((now - t0) / 140) % 2;
        const cur = Math.floor(mod(POINTER - this.rotation, TAU) / seg);
        if (cur !== last) { last = cur; if (onTick) onTick(); }
        this.draw();
        if (t < 1) this.raf = requestAnimationFrame(step);
        else {
          this.rotation = mod(end, TAU);
          this.spinning = false;
          this.highlight = index;
          this.draw();
          resolve();
        }
      };
      this.raf = requestAnimationFrame(step);
    });
  };

  window.Wheel = Wheel;
})();
