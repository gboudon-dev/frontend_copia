// frontend/v5/shared/moments/composer.js
import { setState, goToMoment } from "/v5/shared/state.js";
import { requestPlan } from "/v5/shared/api.js";
import { setAgentStatus } from "/v5/shared/tech-panel.js";

export function mountComposer(root) {
  root.innerHTML = `
    <style>
      .composer-wrap { max-width: 720px; margin: 6vh auto 0 auto; }
      .composer-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--periwinkle); text-transform: uppercase; margin-bottom: 12px; }
      .composer-title { font-family: var(--font-serif); font-size: 28px; color: var(--text-strong); margin: 0 0 24px 0; line-height: 1.3; }
      .composer-card { border: 1px solid var(--border-hover); border-radius: var(--radius-lg); background: var(--bg-base); padding: 22px 24px; }
      .composer-textarea { width: 100%; min-height: 90px; background: transparent; border: none; color: var(--text-strong); font-size: 16px; font-family: var(--font-body); line-height: 1.5; resize: vertical; outline: none; }
      .composer-divider { height: 1px; background: var(--border); margin: 16px 0; }
      .composer-actions { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
      .ext-group { display: inline-flex; border: 1px solid var(--border-hover); border-radius: var(--radius-md); overflow: hidden; }
      .ext-opt { padding: 8px 14px; font-size: 11.5px; color: var(--text-muted); cursor: pointer; background: transparent; border: none; font-family: inherit; }
      .ext-opt.active { background: var(--periwinkle); color: var(--bg-base); font-weight: 600; }
      .composer-err { color: var(--red-soft); font-size: 12px; margin-top: 10px; display: none; }
      .composer-err.show { display: block; }
      .dots::after { display: inline-block; content: ""; animation: dots-pulse 1.2s steps(4, end) infinite; }
      @keyframes dots-pulse { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } 100% { content: ""; } }
      .composer-thinking { display: none; margin-top: 14px; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-panel); font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; color: var(--periwinkle); align-items: center; gap: 10px; }
      .composer-thinking.show { display: flex; }
      .thinking-spinner { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--border-hover); border-top-color: var(--periwinkle); animation: spin 0.8s linear infinite; flex-shrink: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    <div class="composer-wrap">
      <div class="composer-eyebrow">Momento 1 · Composer</div>
      <h1 class="composer-title">¿De qué quieres que generemos inteligencia?</h1>
      <div class="composer-card">
        <textarea class="composer-textarea" id="c-prompt" placeholder="Ej.: Perspectivas del sector minero en Atacama, horizonte 2026-2030…"></textarea>
        <div class="composer-divider"></div>
        <div class="composer-actions">
          <div class="ext-group">
            <button class="ext-opt" data-ext="ejecutivo">Ejecutivo · ≤2 pág</button>
            <button class="ext-opt active" data-ext="completo">Completo</button>
          </div>
          <button class="btn-primary" id="c-submit">Planificar →</button>
        </div>
        <div class="composer-err" id="c-err"></div>
        <div class="composer-thinking" id="c-thinking"><div class="thinking-spinner"></div><span>Clarifier revisando el tema<span class="dots"></span></span></div>
      </div>
    </div>
  `;

  const ta = root.querySelector("#c-prompt");
  let extension = "completo";

  root.querySelectorAll(".ext-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      extension = btn.dataset.ext;
      root.querySelectorAll(".ext-opt").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  root.querySelector("#c-submit").addEventListener("click", async () => {
    const prompt = ta.value.trim();
    const err = root.querySelector("#c-err");
    err.classList.remove("show");
    if (prompt.length < 10) {
      err.textContent = "Describe el tema con al menos una oración.";
      err.classList.add("show");
      return;
    }

    setState({ composer: { prompt, extension } });
    const btn = root.querySelector("#c-submit");
    const thinking = root.querySelector("#c-thinking");
    btn.disabled = true;
    btn.innerHTML = 'Pensando preguntas<span class="dots"></span>';
    thinking.classList.add("show");
    setAgentStatus("clarifier", "active");

    try {
      // region/period son required en backend v4. Defaults amplios; clarifier
      // los corrige si detecta referencias explicitas en el prompt.
      const resp = await requestPlan({ prompt, region: "nacional", period: "2026-2028", extension });
      if (resp.status === "needs_clarification") {
        setState({ clarifier: { questions: resp.questions, inferred: resp.inferred || [], missing: resp.missing || [], answers: {} } });
        goToMoment("clarifier");
      } else if (resp.status === "ready") {
        setAgentStatus("clarifier", "done");
        setState({ plan: resp.plan });
        goToMoment("plan");
      } else {
        throw new Error("Respuesta inesperada del planner");
      }
    } catch (e) {
      err.textContent = `No pudimos contactar el planner (${e.message}). Reintenta en unos segundos.`;
      err.classList.add("show");
      btn.disabled = false;
      btn.textContent = "Planificar →";
      thinking.classList.remove("show");
      setAgentStatus("clarifier", "idle");
    }
  });
}
