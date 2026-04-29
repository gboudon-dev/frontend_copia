// frontend/v5/shared/moments/generation.js
import { getState, setState, goToMoment } from "/v5/shared/state.js";
import { pollStatus } from "/v5/shared/api.js";
import { setAgentStatus, setFactbookProgress, setVerifierStats } from "/v5/shared/tech-panel.js";

const AGENT_SEQUENCE = ["planner", "drafter", "quality", "coherence", "completeness", "integrator"];

// Backend v4 reporta progreso via snap.progress (string). Mapeamos frases a
// fases para: (a) actualizar agentes activos, (b) ponderar el % total, y
// (c) mover el anillo del factbook. Las secciones (Analizando X/N) también
// mueven el % dentro de su rango.
const PHASES = [
  { key: "factbook",  test: (p) => /factbook/i.test(p),                      weight: [0,   15] },
  { key: "analyze",   test: (p) => /analizando/i.test(p),                    weight: [15,  65] },
  { key: "editor",    test: (p) => /editor/i.test(p),                        weight: [65,  75] },
  { key: "verifier",  test: (p) => /verificaci[oó]n/i.test(p),               weight: [75,  82] },
  { key: "resumen",   test: (p) => /resumen/i.test(p),                       weight: [82,  90] },
  { key: "assembly",  test: (p) => /ensamblando|compilando/i.test(p),        weight: [90,  98] },
  { key: "done",      test: (p) => /listo/i.test(p),                         weight: [100, 100] },
];

function resolvePhase(progress) {
  const p = progress || "";
  for (const ph of PHASES) if (ph.test(p)) return ph;
  return PHASES[0];
}

export function mountGeneration(root) {
  let startedJobId = null;
  let _t0 = Date.now();
  const observer = new MutationObserver(() => {
    if (root.classList.contains("active")) tryStart();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });

  function tryStart() {
    const s = getState();
    if (!s.jobId || startedJobId === s.jobId) return;
    startedJobId = s.jobId;
    render();
    runPolling(s.jobId);
  }

  function render() {
    const plan = getState().plan || {};
    const secciones = plan.secciones || [];
    root.innerHTML = `
      <style>
        .gen-wrap { max-width: 920px; margin: 2vh auto 0 auto; }
        .gen-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--peach); text-transform: uppercase; margin-bottom: 8px; }
        .gen-title { font-family: var(--font-serif); font-size: 22px; color: var(--text-strong); margin: 0 0 8px 0; }
        .gen-meta { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); letter-spacing: 0.04em; margin-bottom: 18px; }
        .gen-meta span.strong { color: var(--text-strong); }
        .gen-bar { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-bottom: 22px; }
        .gen-bar-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--periwinkle)); transition: width 0.5s; }
        .sec-strip { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
        .sec-live { border: 1px solid var(--border); border-left-width: 3px; border-radius: var(--radius-sm); padding: 12px 16px; display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; align-items: center; font-size: 12px; transition: opacity 0.3s; }
        .sec-live.done { border-left-color: var(--green); }
        .sec-live.active { border-left-color: var(--peach); animation: periwinkle-glow 2s ease-in-out infinite; }
        .sec-live.review { border-left-color: var(--periwinkle); }
        .sec-live.pending { opacity: 0.55; }
        .sec-live .num { font-family: var(--font-mono); color: var(--text-muted); }
        .sec-live .status { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); }
        .halt-banner { display: none; padding: 14px 18px; border-radius: var(--radius-md); border: 1px solid; margin-bottom: 18px; font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.06em; }
        .halt-banner.show { display: block; }
        .halt-banner.review { border-color: var(--periwinkle); background: rgba(168,189,223,0.06); color: var(--periwinkle); animation: periwinkle-glow 2s ease-in-out infinite; }
        .halt-banner.integrator { border-color: var(--golden); background: rgba(212,165,116,0.06); color: var(--golden); box-shadow: 0 0 16px rgba(212,165,116,0.25); }
        .stream-card { display: none; border: 1px solid rgba(232,196,160,0.3); background: rgba(232,196,160,0.04); border-radius: var(--radius-md); padding: 16px 18px; margin-bottom: 22px; }
        .stream-card.show { display: block; }
        .stream-text { font-size: 12.5px; color: var(--text); line-height: 1.6; }
        .stream-cursor { display: inline-block; width: 2px; height: 14px; background: var(--peach); vertical-align: middle; animation: pulse-y 0.7s step-end infinite; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .kpi { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-panel); padding: 14px 14px; position: relative; overflow: hidden; }
        .kpi::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); }
        .kpi .label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .kpi .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse-y 1s ease-in-out infinite; }
        .kpi .value { font-family: var(--font-mono); font-size: 18px; color: var(--text-strong); font-weight: 700; }
        .kpi .sub { font-family: var(--font-mono); font-size: 9.5px; color: var(--text-muted); margin-top: 3px; }
        .kpi[data-color="peach"] { --accent: var(--peach); }
        .kpi[data-color="blue"] { --accent: var(--blue); }
        .kpi[data-color="green"] { --accent: var(--green); }
        .kpi[data-color="golden"] { --accent: var(--golden); }
        .kpi.halt::before { opacity: 0.2; }
        .kpi.halt .value { color: var(--text-muted); }
        .kpi.halt .dot { background: var(--text-muted); animation: none; }
      </style>
      <div class="gen-wrap">
        <div class="gen-eyebrow">Informe en construcción</div>
        <h2 class="gen-title">${escapeHtml(plan.titulo || "Informe")}</h2>
        <div class="gen-meta"><span class="strong" id="m-pct">0%</span> completado · transcurrido <span class="strong" id="m-elapsed">00:00</span> · ETA <span class="strong" id="m-eta">—</span></div>
        <div class="gen-bar"><div class="gen-bar-fill" id="bar" style="width:0%"></div></div>

        <div class="halt-banner review" id="halt-review">Coherence + Completeness revisando · contadores en pausa</div>
        <div class="halt-banner integrator" id="halt-integrator">Integrator · pasada de edición global · contadores en pausa</div>

        <div class="sec-strip" id="sec-strip">${secciones.map((s, i) => `
          <div class="sec-live pending" data-idx="${i}">
            <div class="num">§ ${String(i + 1).padStart(2, "0")}</div>
            <div>${escapeHtml(s.titulo || "")}</div>
            <div class="status">○ en cola</div>
          </div>
        `).join("")}</div>

        <div class="stream-card" id="stream"><div class="stream-text"><span id="stream-text"></span><span class="stream-cursor"></span></div></div>

        <div class="kpi-grid">
          <div class="kpi" data-color="peach" id="kpi-tokens"><div class="label"><span class="dot"></span>Tokens</div><div class="value" id="v-tokens">0</div><div class="sub" id="s-tokens">0 in · 0 out</div></div>
          <div class="kpi" data-color="blue" id="kpi-speed"><div class="label"><span class="dot"></span>Velocidad</div><div class="value" id="v-speed">— tok/s</div><div class="sub">agentes en paralelo</div></div>
          <div class="kpi" data-color="green" id="kpi-sources"><div class="label"><span class="dot"></span>Fuentes</div><div class="value" id="v-sources">0</div><div class="sub">Qdrant · retrieval</div></div>
          <div class="kpi" data-color="golden" id="kpi-cost"><div class="label"><span class="dot"></span>Costo</div><div class="value" id="v-cost">$0.0000</div><div class="sub">OpenRouter</div></div>
        </div>
      </div>
    `;
  }

  function runPolling(jobId) {
    _t0 = Date.now();
    const timerEl = () => root.querySelector("#m-elapsed");
    const timer = setInterval(() => {
      const el = timerEl();
      if (!el) return;
      const d = Math.floor((Date.now() - _t0) / 1000);
      el.textContent = `${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
    }, 1000);

    pollStatus(jobId, (snap) => {
      applySnapshot(snap);
      if (snap.status === "completed") {
        clearInterval(timer);
        setState({ result: snap });
        goToMoment("cierre");
        return false;
      }
      if (snap.status === "failed") {
        clearInterval(timer);
        alert(`La generación falló: ${snap.error || "error desconocido"}`);
        return false;
      }
    }, 1000).catch((e) => { clearInterval(timer); alert(`Error de polling: ${e.message}`); });
  }

  function applySnapshot(snap) {
    const total = (getState().plan?.secciones || []).length || snap.sections_total || 4;
    const done = snap.sections_done || 0;
    const phase = resolvePhase(snap.progress);

    // % ponderado por fase. Dentro de "analyze", interpolamos según sections_done.
    let pct = phase.weight[0];
    if (phase.key === "analyze") {
      const [a, b] = phase.weight;
      pct = Math.min(b, Math.round(a + (b - a) * (done / Math.max(1, total))));
    } else {
      pct = phase.weight[1];
    }
    if (snap.status === "completed") pct = 100;

    const bar = root.querySelector("#bar"); if (bar) bar.style.width = pct + "%";
    const pctEl = root.querySelector("#m-pct"); if (pctEl) pctEl.textContent = pct + "%";

    // ETA: con elapsed del backend o del reloj local.
    const etaEl = root.querySelector("#m-eta");
    if (etaEl) {
      const elapsed = snap.elapsed_s != null ? snap.elapsed_s : (Date.now() - _t0) / 1000;
      if (snap.status === "completed" || pct >= 100) {
        etaEl.textContent = "00:00";
      } else if (pct >= 5 && elapsed > 3) {
        const remaining = elapsed * (100 - pct) / pct;
        etaEl.textContent = fmtClock(remaining);
      } else {
        etaEl.textContent = "calculando…";
      }
    }

    // Secciones: marcar done/active/pending según sections_done
    root.querySelectorAll(".sec-live").forEach((el) => {
      const idx = +el.dataset.idx;
      el.classList.remove("done", "active", "review", "pending");
      const statusEl = el.querySelector(".status");
      const allSectionsDone = phase.key !== "factbook" && phase.key !== "analyze";
      if (allSectionsDone || idx < done) { el.classList.add("done"); statusEl.textContent = "✓ redactada · revisada · verificada"; }
      else if (idx === done) { el.classList.add("active"); statusEl.textContent = "◐ drafter redactando"; }
      else { el.classList.add("pending"); statusEl.textContent = "○ en cola"; }
    });

    // Banners informativos (editor = revisión global; resumen+assembly = integrator).
    // Los KPIs no se pausan: siguen visibles y activos hasta el final.
    const inReview = phase.key === "editor" || phase.key === "verifier";
    const inIntegrator = phase.key === "resumen" || phase.key === "assembly";
    root.querySelector("#halt-review")?.classList.toggle("show", inReview);
    root.querySelector("#halt-integrator")?.classList.toggle("show", inIntegrator);

    // KPIs — backend v4 emite tokens_total (no split in/out). Tween entre polls
    // para que los números se muevan suavemente en vez de saltar cada 1s.
    const tTotal = snap.tokens_total != null
      ? snap.tokens_total
      : (snap.tokens_input || 0) + (snap.tokens_output || 0);
    animateNumber(root.querySelector("#v-tokens"), tTotal, fmtNum);
    const sTokens = root.querySelector("#s-tokens");
    if (sTokens) {
      sTokens.textContent = snap.tokens_input != null
        ? `${fmtNum(snap.tokens_input)} in · ${fmtNum(snap.tokens_output || 0)} out`
        : "del LLM";
    }
    if (snap.speed_tok_s != null) {
      animateNumber(root.querySelector("#v-speed"), snap.speed_tok_s, (n) => `${Math.round(n)} tok/s`);
    }
    if (snap.sources_consulted != null) {
      animateNumber(root.querySelector("#v-sources"), snap.sources_consulted, fmtNum);
    }
    if (snap.cost_usd != null) {
      animateNumber(root.querySelector("#v-cost"), snap.cost_usd, (n) => `$${n.toFixed(4)}`);
    }

    // Tech panel: agentes según fase del backend.
    const activeByPhase = {
      factbook:  [],
      analyze:   ["drafter"],
      editor:    ["quality", "coherence", "completeness"],
      verifier:  [],
      resumen:   ["integrator"],
      assembly:  ["integrator"],
      done:      [],
    };
    const doneByPhase = {
      factbook:  ["planner"],
      analyze:   ["planner"],
      editor:    ["planner", "drafter"],
      verifier:  ["planner", "drafter", "quality", "coherence", "completeness"],
      resumen:   ["planner", "drafter", "quality", "coherence", "completeness"],
      assembly:  ["planner", "drafter", "quality", "coherence", "completeness"],
      done:      AGENT_SEQUENCE,
    };
    const activeSet = new Set(activeByPhase[phase.key] || []);
    const doneSet = new Set(doneByPhase[phase.key] || []);
    AGENT_SEQUENCE.forEach((agent) => {
      if (doneSet.has(agent)) setAgentStatus(agent, "done");
      else if (activeSet.has(agent)) setAgentStatus(agent, "active");
      else setAgentStatus(agent, "idle");
    });

    // Factbook ring: backend emite factbook_found / factbook_target en vivo.
    const fbFound = snap.factbook_found ?? 0;
    const fbTarget = snap.factbook_target ?? null;
    if (phase.key === "factbook") {
      setFactbookProgress("building", fbFound, fbTarget);
    } else if (fbFound > 0) {
      setFactbookProgress("done", fbFound, fbTarget);
    } else {
      setFactbookProgress("idle");
    }
    if (snap.verifier) setVerifierStats({ state: phase.key === "verifier" ? "active" : "idle", ...snap.verifier });
    else setVerifierStats({ state: phase.key === "verifier" ? "active" : "idle" });

    // Streaming preview
    if (snap.streaming_text) {
      root.querySelector("#stream")?.classList.add("show");
      const t = root.querySelector("#stream-text"); if (t) t.textContent = snap.streaming_text;
    } else {
      root.querySelector("#stream")?.classList.remove("show");
    }
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n));
  }

  // Tween suave entre polls: interpola el valor del KPI con easeOutCubic
  // durante ~900ms. Guarda el último valor objetivo en un WeakMap por elemento
  // para arrancar desde ahí, y cancela el rAF previo para evitar saltos.
  const _numState = new WeakMap();
  function animateNumber(el, to, formatter, duration = 900) {
    if (!el) return;
    to = Number(to) || 0;
    const prev = _numState.get(el);
    const from = prev ? prev.last : 0;
    if (prev && prev.raf) cancelAnimationFrame(prev.raf);
    if (from === to) {
      el.textContent = formatter(to);
      _numState.set(el, { last: to, raf: null });
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      el.textContent = formatter(cur);
      if (t < 1) {
        const raf = requestAnimationFrame(step);
        _numState.set(el, { last: to, raf });
      } else {
        _numState.set(el, { last: to, raf: null });
      }
    };
    const raf = requestAnimationFrame(step);
    _numState.set(el, { last: to, raf });
  }

  function fmtClock(secs) {
    secs = Math.max(0, Math.round(Number(secs) || 0));
    const m = Math.floor(secs / 60), s = secs % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}h${String(m % 60).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function escapeHtml(s) { return String(s).replace(/[<>&"']/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c])); }
}
