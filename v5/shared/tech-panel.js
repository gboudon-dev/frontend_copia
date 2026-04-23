const AGENTS = [
  { key: "clarifier",    name: "Clarifier",    role: "preguntas",    model: "haiku 4.5" },
  { key: "planner",      name: "Planner",      role: "estructura",   model: "deepseek" },
  { key: "drafter",      name: "Drafter",      role: "redacción",    model: "gemini flash" },
  { key: "quality",      name: "Quality",      role: "revisa claims",model: "deepseek" },
  { key: "coherence",    name: "Coherence",    role: "revisa hilo",  model: "gemini flash" },
  { key: "completeness", name: "Completeness", role: "revisa cobertura", model: "gemini flash" },
  { key: "integrator",   name: "Integrator",   role: "editor final", model: "deepseek" },
];

export function mountTechAgents(el) {
  el.innerHTML = `
    <style>
      .agent-row { display: grid; grid-template-columns: 14px 1fr auto; gap: 14px; align-items: center; padding: 15px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
      .agent-row:last-child { border-bottom: none; }
      .agent-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--text-muted); }
      .agent-dot.active { background: var(--peach); animation: pulse-y 0.9s ease-in-out infinite; box-shadow: 0 0 10px rgba(232,196,160,0.6); }
      .agent-dot.done { background: var(--green); box-shadow: 0 0 6px rgba(127,185,154,0.35); }
      .agent-name { color: var(--text-strong); font-weight: 600; font-size: 14px; }
      .agent-sub { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); letter-spacing: 0.04em; margin-top: 3px; }
      .agent-model { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); text-align: right; }
    </style>
  ` + AGENTS.map(a => `
    <div class="agent-row" data-agent="${a.key}">
      <div class="agent-dot"></div>
      <div>
        <div class="agent-name">${a.name}</div>
        <div class="agent-sub">${a.role}</div>
      </div>
      <div class="agent-model">${a.model}</div>
    </div>
  `).join("");
}

/**
 * Actualiza estado visual de un agente: "idle" | "active" | "done".
 */
export function setAgentStatus(agentKey, status) {
  const row = document.querySelector(`[data-agent="${agentKey}"] .agent-dot`);
  if (!row) return;
  row.classList.remove("active", "done");
  if (status === "active") row.classList.add("active");
  if (status === "done") row.classList.add("done");
}

const FB_SEGMENTS = 24;

export function mountTechFactbook(el) {
  el.innerHTML = `
    <style>
      .ring-wrap { position: relative; width: 200px; height: 200px; margin: 0 auto; }
      .ring-svg { position: absolute; inset: 0; animation: svg-rotate 8s linear infinite; animation-play-state: paused; }
      .ring-svg.spinning { animation-play-state: running; }
      .ring-svg.done { animation-play-state: paused; }
      .ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font-mono); text-align: center; gap: 4px; }
      .ring-state { font-size: 11px; color: var(--text-strong); letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
      .ring-state.active { color: var(--blue); }
      .ring-state.done { color: var(--green); }
      .ring-count { font-size: 22px; color: var(--text-strong); font-weight: 700; font-family: var(--font-serif); line-height: 1; }
      .ring-count.active { color: var(--blue); }
      .ring-count.done { color: var(--green); }
      .ring-sub { font-size: 9.5px; color: var(--text-muted); letter-spacing: 0.14em; text-transform: uppercase; }
      @keyframes svg-rotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .seg { fill: none; stroke-width: 6; stroke-linecap: butt; transition: stroke 0.3s; }
      .seg.empty { stroke: var(--border-hover); }
      .seg.filled { stroke: var(--blue); }
      .seg.done { stroke: var(--green); }
    </style>
    <div class="ring-wrap">
      <svg class="ring-svg" id="ring-svg" viewBox="0 0 200 200">
        <g id="ring-segments" transform="translate(100,100)"></g>
      </svg>
      <div class="ring-label">
        <div class="ring-count" id="ring-count">—</div>
        <div class="ring-sub" id="ring-sub">hechos</div>
        <div class="ring-state" id="ring-state">○ Inactivo</div>
      </div>
    </div>
  `;

  const svgNS = "http://www.w3.org/2000/svg";
  const g = document.getElementById("ring-segments");
  const R = 80;
  const ARC = (2 * Math.PI) / FB_SEGMENTS;
  const GAP = 0.06;
  for (let i = 0; i < FB_SEGMENTS; i++) {
    const a0 = i * ARC + GAP / 2;
    const a1 = (i + 1) * ARC - GAP / 2;
    const x0 = Math.cos(a0) * R, y0 = Math.sin(a0) * R;
    const x1 = Math.cos(a1) * R, y1 = Math.sin(a1) * R;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`);
    path.setAttribute("class", "seg empty");
    path.setAttribute("data-idx", i);
    g.appendChild(path);
  }
}

/**
 * Estados del factbook:
 *   "idle"        — antes del job
 *   "building"    — recopilando (ring gira, segmentos se rellenan proporcionalmente)
 *   "done"        — listo (todos verdes, ring detenido)
 *
 * found, target: enteros con hechos encontrados y objetivo (si se conoce).
 */
export function setFactbookProgress(state, found = null, target = null) {
  const svg = document.getElementById("ring-svg");
  const stateEl = document.getElementById("ring-state");
  const countEl = document.getElementById("ring-count");
  const subEl = document.getElementById("ring-sub");
  if (!svg || !stateEl) return;

  svg.classList.remove("spinning", "done");
  stateEl.classList.remove("active", "done");
  countEl.classList.remove("active", "done");

  if (state === "building") {
    svg.classList.add("spinning");
    stateEl.classList.add("active");
    countEl.classList.add("active");
    stateEl.textContent = "◐ Construyendo";
  } else if (state === "done") {
    svg.classList.add("done");
    stateEl.classList.add("done");
    countEl.classList.add("done");
    stateEl.textContent = "✓ Listo";
  } else {
    stateEl.textContent = "○ Inactivo";
  }

  // Label del contador
  if (state === "idle" || found == null) {
    countEl.textContent = "—";
    if (subEl) subEl.textContent = "hechos";
  } else if (target && target > 0 && state === "building") {
    countEl.textContent = String(found);
    if (subEl) subEl.textContent = `de ${target} hechos`;
  } else {
    countEl.textContent = String(found);
    if (subEl) subEl.textContent = "hechos";
  }

  // Relleno proporcional de segmentos.
  let fillRatio;
  if (state === "done") fillRatio = 1;
  else if (state === "building" && target && target > 0) fillRatio = Math.min(1, found / target);
  else if (state === "building") fillRatio = 0.5; // sin target conocido
  else fillRatio = 0;

  const filled = Math.round(fillRatio * FB_SEGMENTS);
  document.querySelectorAll("#ring-segments .seg").forEach((p, i) => {
    p.classList.remove("empty", "filled", "done");
    if (state === "done") p.classList.add("done");
    else if (state === "building" && i < filled) p.classList.add("filled");
    else p.classList.add("empty");
  });
}

export function mountTechVerifier(el) {
  el.innerHTML = `
    <style>
      .vf-row { display: flex; justify-content: space-between; padding: 6px 0; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.04em; border-bottom: 1px dashed var(--border); }
      .vf-row:last-child { border-bottom: none; }
      .vf-label { color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.12em; font-size: 9.5px; }
      .vf-value { color: var(--text-strong); }
      .vf-value.gap { color: var(--peach); }
      .vf-state { margin-bottom: 10px; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--text-muted); text-transform: uppercase; }
      .vf-state.active { color: var(--periwinkle); }
    </style>
    <div class="vf-state" id="vf-state">○ inactivo</div>
    <div class="vf-row"><span class="vf-label">Claims</span><span class="vf-value" id="vf-claims">0</span></div>
    <div class="vf-row"><span class="vf-label">Respaldados</span><span class="vf-value" id="vf-ok">0</span></div>
    <div class="vf-row"><span class="vf-label">Gaps</span><span class="vf-value gap" id="vf-gaps">0</span></div>
  `;
}

export function setVerifierStats({ state, claims, ok, gaps }) {
  const s = document.getElementById("vf-state");
  if (s) {
    s.textContent = state === "active" ? "◐ verificando…" : "○ inactivo";
    s.classList.toggle("active", state === "active");
  }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  if (claims != null) set("vf-claims", claims);
  if (ok != null) set("vf-ok", ok);
  if (gaps != null) set("vf-gaps", gaps);
}
