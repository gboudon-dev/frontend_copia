// frontend/v5/shared/moments/clarifier.js
import { getState, setState, goToMoment } from "/v5/shared/state.js";
import { requestPlan } from "/v5/shared/api.js";
import { setAgentStatus } from "/v5/shared/tech-panel.js";

export function mountClarifier(root) {
  // Re-renderiza cuando entra al momento
  const observer = new MutationObserver(() => {
    if (root.classList.contains("active")) render();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });

  function render() {
    const s = getState();
    const questions = s.clarifier?.questions || [];
    const answers = s.clarifier?.answers || {};
    const answered = Object.values(answers).filter((v) => {
      if (Array.isArray(v)) return v.length > 0;
      return v != null && String(v).trim() !== "";
    }).length;
    const total = questions.length;

    root.innerHTML = `
      <style>
        .clar-wrap { max-width: 820px; margin: 4vh auto 0 auto; }
        .clar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
        .clar-progress { flex: 1; margin: 0 20px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
        .clar-progress-bar { height: 100%; background: var(--peach); transition: width 0.3s; }
        .clar-count { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.1em; }
        .q { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-panel); padding: 18px 20px; margin-bottom: 14px; }
        .q-label { font-size: 14px; color: var(--text-strong); margin-bottom: 6px; line-height: 1.5; }
        .q-hint { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
        .q-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip { padding: 7px 14px; border: 1px solid var(--border-hover); border-radius: 14px; font-size: 11.5px; color: var(--text); background: transparent; cursor: pointer; font-family: inherit; }
        .chip:hover { border-color: var(--periwinkle); }
        .chip.active { background: var(--periwinkle); color: var(--bg-base); border-color: var(--periwinkle); font-weight: 600; }
        .chip.other { font-style: italic; color: var(--text-muted); }
        .q-other { margin-top: 10px; width: 100%; background: var(--bg-base); border: 1px solid var(--border-hover); border-radius: var(--radius-md); padding: 10px 12px; color: var(--text-strong); font-family: inherit; font-size: 12.5px; display: none; }
        .q-other.show { display: block; }
        .clar-actions { display: flex; justify-content: space-between; margin-top: 22px; }
        .dots::after { display: inline-block; content: ""; animation: dots-pulse 1.2s steps(4, end) infinite; }
        @keyframes dots-pulse { 0% { content: ""; } 25% { content: "."; } 50% { content: ".."; } 75% { content: "..."; } 100% { content: ""; } }
      </style>
      <div class="clar-wrap">
        <div class="clar-header">
          <div class="clar-count"><strong>${answered}</strong> / ${total} respondidas</div>
          <div class="clar-progress"><div class="clar-progress-bar" style="width:${total ? (answered * 100 / total) : 0}%"></div></div>
        </div>
        <div id="qlist">${questions.map((q, i) => renderQuestion(q, i, answers[i])).join("")}</div>
        <div class="clar-actions">
          <button class="btn-ghost" id="c-skip">Saltar resto · usar inferencia</button>
          <button class="btn-primary" id="c-plan">Planificar →</button>
        </div>
      </div>
    `;

    root.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const qIdx = +chip.dataset.q;
        const value = chip.dataset.value;
        const a = getState().clarifier.answers || {};
        if (chip.classList.contains("other")) {
          const ta = root.querySelector(`#q-other-${qIdx}`);
          ta.classList.add("show");
          ta.focus();
          return;
        }
        // Multi-select: toggle el valor dentro del array de respuestas.
        const curr = toArray(a[qIdx]);
        const hit = curr.indexOf(value);
        if (hit >= 0) curr.splice(hit, 1);
        else curr.push(value);
        a[qIdx] = curr;
        setState({ clarifier: { ...getState().clarifier, answers: a } });
        render();
      });
    });

    root.querySelectorAll(".q-other").forEach((ta) => {
      ta.addEventListener("blur", () => {
        const qIdx = +ta.dataset.q;
        const a = getState().clarifier.answers || {};
        const curr = toArray(a[qIdx]).filter((v) => {
          // Mantener solo valores que correspondan a options (no textos libres previos)
          const q = getState().clarifier.questions?.[qIdx];
          return (q?.options || []).includes(v);
        });
        const text = ta.value.trim();
        if (text) curr.push(text);
        a[qIdx] = curr;
        setState({ clarifier: { ...getState().clarifier, answers: a } });
        render();
      });
    });

    root.querySelector("#c-skip").addEventListener("click", () => submit(true));
    root.querySelector("#c-plan").addEventListener("click", () => submit(false));
  }

  function renderQuestion(q, i, selected) {
    const opts = q.options || [];
    const chosen = toArray(selected);
    const customValues = chosen.filter((v) => !opts.includes(v));
    const hasCustom = customValues.length > 0;
    // Si la pregunta no trae opciones, mostramos el textarea por defecto.
    const freeForm = opts.length === 0;
    const taVisible = freeForm || hasCustom;
    const taContent = customValues.join(", ");
    return `
      <div class="q">
        <div class="q-label">${escapeHtml(q.text || q.question || "")}</div>
        ${freeForm ? "" : `<div class="q-hint">selecciona una o varias · multi-respuesta</div>`}
        <div class="q-chips">
          ${opts.map((o) => `<button class="chip ${chosen.includes(o) ? "active" : ""}" data-q="${i}" data-value="${escapeAttr(o)}">${escapeHtml(o)}</button>`).join("")}
          ${freeForm ? "" : `<button class="chip other ${hasCustom ? "active" : ""}" data-q="${i}">+ describir otro…</button>`}
        </div>
        <textarea class="q-other ${taVisible ? "show" : ""}" id="q-other-${i}" data-q="${i}" placeholder="Describe…">${escapeHtml(taContent)}</textarea>
      </div>
    `;
  }

  function toArray(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.slice();
    return [String(v)];
  }

  async function submit(skipRemaining) {
    const s = getState();
    const prompt = s.composer.prompt;
    const extension = s.composer.extension;
    const fmt = (v) => Array.isArray(v) ? v.join("; ") : String(v ?? "");
    const contexto = skipRemaining
      ? ""
      : Object.entries(s.clarifier.answers || {})
          .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== ""))
          .map(([i, v]) => `${s.clarifier.questions[i]?.text || ""}: ${fmt(v)}`)
          .join("\n");
    const btn = root.querySelector("#c-plan");
    btn.disabled = true;
    btn.innerHTML = 'Planificando<span class="dots"></span>';
    setAgentStatus("clarifier", "done");
    setAgentStatus("planner", "active");
    try {
      const resp = await requestPlan({ prompt, region: "nacional", period: "2026-2028", extension, contexto });
      if (resp.status === "ready") {
        setAgentStatus("planner", "done");
        setState({ plan: resp.plan });
        goToMoment("plan");
      } else if (resp.status === "needs_clarification") {
        // Nuevas preguntas residuales
        setAgentStatus("planner", "idle");
        setAgentStatus("clarifier", "active");
        setState({ clarifier: { ...s.clarifier, questions: resp.questions, answers: {} } });
        render();
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
      btn.disabled = false;
      btn.textContent = "Planificar →";
      setAgentStatus("planner", "idle");
    }
  }

  function escapeHtml(s) { return String(s).replace(/[<>&"']/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c])); }
  function escapeAttr(s) { return escapeHtml(s); }
}
