// frontend/v5/shared/moments/plan.js
import { getState, setState, goToMoment, autoSave } from "/v5/shared/state.js";
import { generate } from "/v5/shared/api.js";

export function mountPlan(root) {
  const observer = new MutationObserver(() => {
    if (root.classList.contains("active")) render();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });

  function render() {
    // Backend v4 emite `titulo_sugerido` y `thesis`; el resto del frontend usa
    // `titulo`/`tesis`. Aceptamos ambos al leer; al guardar escribimos ambos
    // para que el payload enviado a /generate sea compatible con el planner.
    const raw = getState().plan || {};
    const plan = {
      ...raw,
      titulo: raw.titulo || raw.titulo_sugerido || "",
      tesis: raw.tesis || raw.thesis || "",
      secciones: raw.secciones || [],
    };

    root.innerHTML = `
      <style>
        .plan-wrap { max-width: 880px; margin: 3vh auto 0 auto; }
        .plan-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--peach); text-transform: uppercase; margin-bottom: 10px; }
        .plan-title { font-family: var(--font-serif); font-size: 22px; color: var(--text-strong); border: 1px dashed transparent; padding: 6px 8px; border-radius: var(--radius-sm); outline: none; margin-bottom: 18px; }
        .plan-title:focus, .plan-title:hover { border-color: var(--border-hover); }
        .plan-tesis { border-left: 2px solid var(--periwinkle); padding: 10px 16px; margin-bottom: 28px; background: rgba(168,189,223,0.04); }
        .plan-tesis-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--periwinkle); text-transform: uppercase; margin-bottom: 6px; }
        .plan-tesis textarea { width: 100%; background: transparent; border: none; color: var(--text-strong); font-family: var(--font-serif); font-style: italic; font-size: 15px; line-height: 1.5; resize: vertical; outline: none; min-height: 60px; }
        .sec-card { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-panel); padding: 16px 18px; margin-bottom: 12px; display: grid; grid-template-columns: 40px 1fr auto; gap: 14px; align-items: start; }
        .sec-num { font-family: var(--font-mono); font-size: 12px; color: var(--peach); font-weight: 700; padding-top: 4px; }
        .sec-body { min-width: 0; }
        .sec-title { font-size: 14px; color: var(--text-strong); font-weight: 600; border: 1px dashed transparent; padding: 4px 6px; border-radius: var(--radius-sm); outline: none; margin-bottom: 6px; }
        .sec-title:focus, .sec-title:hover { border-color: var(--border-hover); }
        .sec-claim { font-size: 12px; color: var(--text); border: 1px dashed transparent; padding: 4px 6px; border-radius: var(--radius-sm); outline: none; min-height: 20px; line-height: 1.5; margin-bottom: 10px; }
        .sec-claim:focus, .sec-claim:hover { border-color: var(--border-hover); }
        .sec-actions { display: flex; gap: 4px; }
        .icon-btn { width: 38px; height: 38px; border: 1px solid var(--border-hover); border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .icon-btn:hover.up, .icon-btn:hover.down { color: var(--periwinkle); border-color: var(--periwinkle); }
        .icon-btn:hover.edit { color: var(--peach); border-color: var(--peach); }
        .icon-btn:hover.del { color: var(--red-soft); border-color: var(--red-soft); }
        .plan-add { margin: 6px 0 28px 0; width: 100%; padding: 12px; border: 1px dashed var(--border-hover); border-radius: var(--radius-md); background: transparent; color: var(--text-muted); font-family: inherit; font-size: 13px; cursor: pointer; }
        .plan-add:hover { border-color: var(--periwinkle); color: var(--periwinkle); }
        .plan-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 18px; border-top: 1px solid var(--border); }
        .autosave { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); letter-spacing: 0.08em; }
      </style>
      <div class="plan-wrap">
        <div class="plan-eyebrow">Plan · editable</div>
        <div class="plan-title" contenteditable="true" id="p-title">${escapeHtml(plan.titulo || "Título del informe")}</div>
        <div class="plan-tesis">
          <div class="plan-tesis-label">Tesis central</div>
          <textarea id="p-tesis" placeholder="2-3 oraciones que definen el argumento central del informe…">${escapeHtml(plan.tesis || "")}</textarea>
        </div>
        <div id="secciones">${(plan.secciones || []).map((s, i) => renderSection(s, i)).join("")}</div>
        <button class="plan-add" id="p-add">+ Agregar sección</button>
        <div class="plan-actions">
          <div style="display:flex;gap:14px;align-items:center">
            <button class="btn-ghost" id="p-back">← Volver a editar tema</button>
            <span class="autosave" id="autosave-ind">auto-guarda al escribir</span>
          </div>
          <button class="btn-green" id="p-go">Se ve bien — generar informe →</button>
        </div>
      </div>
    `;

    // Bindings
    const titleEl = root.querySelector("#p-title");
    const tesisEl = root.querySelector("#p-tesis");
    titleEl.addEventListener("input", () => {
      const v = titleEl.innerText.trim();
      savePlan({ titulo: v, titulo_sugerido: v });
    });
    tesisEl.addEventListener("input", () => {
      const v = tesisEl.value;
      savePlan({ tesis: v, thesis: v });
    });

    root.querySelectorAll(".sec-title, .sec-claim").forEach((el) => {
      el.addEventListener("input", () => {
        const idx = +el.closest(".sec-card").dataset.idx;
        const field = el.classList.contains("sec-title") ? "titulo" : "claim";
        const secs = [...(getState().plan.secciones || [])];
        secs[idx] = { ...secs[idx], [field]: el.innerText.trim() };
        savePlan({ secciones: secs });
      });
    });

    root.querySelectorAll(".icon-btn.up").forEach((b) => b.addEventListener("click", () => moveSection(+b.dataset.idx, -1)));
    root.querySelectorAll(".icon-btn.down").forEach((b) => b.addEventListener("click", () => moveSection(+b.dataset.idx, +1)));
    root.querySelectorAll(".icon-btn.del").forEach((b) => b.addEventListener("click", () => deleteSection(+b.dataset.idx)));

    root.querySelector("#p-add").addEventListener("click", addSection);
    root.querySelector("#p-back").addEventListener("click", () => goToMoment("composer"));
    root.querySelector("#p-go").addEventListener("click", startGeneration);
  }

  function savePlan(patch) {
    const plan = { ...(getState().plan || {}), ...patch };
    setState({ plan });
    flashAutosave();
  }

  function flashAutosave() {
    const el = root.querySelector("#autosave-ind");
    if (!el) return;
    el.textContent = "guardando…";
    autoSave({ plan: getState().plan });
    setTimeout(() => { if (el) el.textContent = "guardado ✓"; }, 500);
    setTimeout(() => { if (el) el.textContent = "auto-guarda al escribir"; }, 2000);
  }

  function moveSection(idx, delta) {
    const secs = [...(getState().plan.secciones || [])];
    const j = idx + delta;
    if (j < 0 || j >= secs.length) return;
    [secs[idx], secs[j]] = [secs[j], secs[idx]];
    savePlan({ secciones: secs });
    render();
  }

  function deleteSection(idx) {
    const secs = [...(getState().plan.secciones || [])];
    secs.splice(idx, 1);
    savePlan({ secciones: secs });
    render();
  }

  function addSection() {
    const secs = [...(getState().plan.secciones || [])];
    secs.push({ titulo: "Nueva sección", claim: "", metricas: [] });
    savePlan({ secciones: secs });
    render();
  }

  async function startGeneration() {
    const s = getState();
    const btn = root.querySelector("#p-go");
    btn.disabled = true;
    btn.textContent = "Iniciando generación…";
    try {
      const resp = await generate({
        plan: s.plan,
        report_goal: s.composer.prompt,
        audience: "directorio",
        autor: "Prospecta",
      });
      setState({ jobId: resp.job_id });
      goToMoment("generation");
    } catch (e) {
      alert(`No pudo iniciar la generación: ${e.message}`);
      btn.disabled = false;
      btn.textContent = "Se ve bien — generar informe →";
    }
  }

  function renderSection(s, i) {
    const num = String(i + 1).padStart(2, "0");
    return `
      <div class="sec-card" data-idx="${i}">
        <div class="sec-num">${num}</div>
        <div class="sec-body">
          <div class="sec-title" contenteditable="true">${escapeHtml(s.titulo || "")}</div>
          <div class="sec-claim" contenteditable="true">${escapeHtml(s.claim || "")}</div>
        </div>
        <div class="sec-actions">
          <button class="icon-btn up" data-idx="${i}" title="Subir">↑</button>
          <button class="icon-btn down" data-idx="${i}" title="Bajar">↓</button>
          <button class="icon-btn del" data-idx="${i}" title="Eliminar">✕</button>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) { return String(s).replace(/[<>&"']/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c])); }
}
