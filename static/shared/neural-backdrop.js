// frontend/v5/shared/neural-backdrop.js
// Red de conocimiento animada en canvas — hubs + nodos pequeños con aristas
// dinámicas y pulsos de datos viajando por las conexiones.
// Portado del wizard v5 original (commit d90bae8).

export function renderNeuralBackdrop(cvs) {
  if (!cvs || cvs.tagName !== "CANVAS") return;
  const ctx = cvs.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const nodes = [];
  const HUB_COUNT = 24;
  const SMALL_COUNT = 440;
  const NODE_COUNT = HUB_COUNT + SMALL_COUNT;
  const LINK_DIST = 90;
  let t0 = performance.now();
  const pulses = [];

  function resize() {
    const rect = cvs.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cvs.width = W * dpr; cvs.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    nodes.length = 0;
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        r: i < HUB_COUNT ? 2.2 : 1.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnPulse() {
    for (let tries = 0; tries < 20; tries++) {
      const a = nodes[(Math.random() * nodes.length) | 0];
      const b = nodes[(Math.random() * nodes.length) | 0];
      if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > LINK_DIST || d < 30) continue;
      pulses.push({ a, b, t: 0, dur: 1600 + Math.random() * 1400 });
      return;
    }
  }

  function tick(now) {
    const dt = Math.min(40, now - t0);
    t0 = now;

    for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
    }

    if (Math.random() < 0.025) spawnPulse();

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK_DIST) {
          const alpha = (1 - d / LINK_DIST) * 0.35;
          ctx.strokeStyle = `rgba(168, 189, 223, ${alpha})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += dt;
      const k = p.t / p.dur;
      if (k >= 1) { pulses.splice(i, 1); continue; }
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = p.a.x + (p.b.x - p.a.x) * e;
      const y = p.a.y + (p.b.y - p.a.y) * e;
      const fade = Math.sin(k * Math.PI);
      ctx.fillStyle = `rgba(168, 189, 223, ${0.8 * fade})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(168, 189, 223, ${0.3 * fade})`;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const n of nodes) {
      const breathe = 0.85 + Math.sin(now / 1400 + n.phase) * 0.15;
      ctx.fillStyle = `rgba(168, 189, 223, ${0.9 * breathe})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      if (n.r > 2) {
        ctx.strokeStyle = `rgba(168, 189, 223, ${0.55 * breathe})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(cvs);
  resize();
  seed();
  requestAnimationFrame((t) => { t0 = t; tick(t); });
}
