// frontend/v5/shared/moments/cierre.js
import { getState, resetState } from "/v5/shared/state.js";
import { getResult } from "/v5/shared/api.js";

export function mountCierre(root) {
  const observer = new MutationObserver(() => {
    if (root.classList.contains("active")) render();
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });

  async function render() {
    const s = getState();
    const plan = s.plan || {};
    const result = s.result || {};
    // Fetch detalle completo (gaps, stats) si no viene en el snapshot final.
    let detail = result;
    try { if (s.jobId) detail = await getResult(s.jobId); } catch {}

    const gaps = detail.gaps || [];
    const stats = detail.stats || {};

    root.innerHTML = `
      <style>
        .cierre-wrap { max-width: 820px; margin: 3vh auto 0 auto; }
        .cierre-hero { text-align: center; padding: 6px 0 22px 0; }
        .cierre-eye { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.2em; color: var(--green); text-transform: uppercase; margin-bottom: 6px; }
        .cierre-title { font-family: var(--font-serif); font-size: 22px; color: var(--text-strong); line-height: 1.3; margin-bottom: 10px; }
        .cierre-stats { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.06em; }
        .cierre-stats span { color: var(--text); }
        .download-wrap { display: flex; justify-content: center; margin: 6px 0 28px 0; }
        .download-btn { padding: 18px 48px; background: var(--green); color: var(--bg-base); border: 1px solid var(--green); border-radius: var(--radius-md); font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 12px; animation: green-glow 2.6s ease-in-out infinite; }
        .gaps-block { border: 1px solid rgba(232,196,160,0.25); background: rgba(232,196,160,0.04); border-radius: var(--radius-md); padding: 18px 20px; margin-bottom: 16px; }
        .gaps-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .gaps-eye { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--peach); margin-bottom: 3px; }
        .gaps-title { font-size: 13px; color: var(--text-strong); font-weight: 600; }
        .gaps-count { font-family: var(--font-mono); font-size: 10px; color: var(--peach); }
        .gap-item { padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: rgba(255,255,255,0.02); margin-bottom: 8px; display: grid; grid-template-columns: 40px 1fr 70px; gap: 12px; align-items: start; }
        .gap-sec { font-family: var(--font-mono); font-size: 11px; color: var(--peach); font-weight: 600; padding-top: 1px; }
        .gap-claim { font-size: 11.5px; color: var(--text-strong); line-height: 1.5; margin-bottom: 4px; }
        .gap-detail { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); letter-spacing: 0.04em; }
        .gap-sev { font-size: 9.5px; font-family: var(--font-mono); text-align: right; padding: 2px 8px; border-radius: 10px; display: inline-block; }
        .gap-sev.media { background: rgba(232,196,160,0.12); color: var(--peach); border: 1px solid rgba(232,196,160,0.3); }
        .gap-sev.baja { background: rgba(168,189,223,0.1); color: var(--periwinkle); border: 1px solid rgba(168,189,223,0.25); }
        .learn-msg { border: 1px solid rgba(127,185,154,0.25); background: rgba(127,185,154,0.04); border-radius: var(--radius-md); padding: 16px 20px; display: flex; gap: 14px; align-items: flex-start; margin-bottom: 18px; }
        .learn-icon { width: 32px; height: 32px; border-radius: 50%; background: rgba(127,185,154,0.15); display: flex; align-items: center; justify-content: center; color: var(--green); font-size: 15px; }
        .learn-eye { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--green); margin-bottom: 5px; }
        .learn-text { font-size: 11.5px; color: var(--text); line-height: 1.6; }
        .cierre-new { text-align: center; margin-top: 20px; }
        .cierre-new a { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; }
      </style>
      <div class="cierre-wrap">
        <div class="cierre-hero">
          <div class="cierre-eye">✓ Informe listo</div>
          <div class="cierre-title">${escapeHtml(plan.titulo || "Informe")}</div>
          <div class="cierre-stats">
            <span>${stats.secciones || (plan.secciones || []).length} secciones</span> ·
            <span>${stats.paginas || "—"} páginas</span> ·
            <span>${fmtNum(stats.palabras || 0)} palabras</span> ·
            <span>${stats.fuentes || 0} fuentes citadas</span>
          </div>
        </div>

        <div class="download-wrap">
          <button class="download-btn" id="dl">⬇ Descargar Informe</button>
        </div>

        ${gaps.length ? `
        <div class="gaps-block">
          <div class="gaps-head">
            <div>
              <div class="gaps-eye">Transparencia de evidencia</div>
              <div class="gaps-title">Dónde nos faltó información</div>
            </div>
            <span class="gaps-count">${gaps.length} gap${gaps.length === 1 ? "" : "s"} detectado${gaps.length === 1 ? "" : "s"}</span>
          </div>
          ${gaps.map((g) => `
            <div class="gap-item">
              <div class="gap-sec">§ ${String(g.seccion || "—").padStart(2, "0")}</div>
              <div>
                <div class="gap-claim">${escapeHtml(g.claim || "")}</div>
                <div class="gap-detail">${escapeHtml(g.detalle || g.detail || "")}</div>
              </div>
              <div><span class="gap-sev ${g.severidad || "baja"}">${escapeHtml(g.severidad || "baja")}</span></div>
            </div>
          `).join("")}
        </div>

        <div class="learn-msg">
          <div class="learn-icon">↻</div>
          <div>
            <div class="learn-eye">Prospecta aprende</div>
            <div class="learn-text">Estas brechas quedaron registradas en el backlog de ingesta. Prospecta buscará incorporar las fuentes faltantes en los próximos ciclos de actualización del factbook, para que futuros informes sobre este tema descansen sobre una base de evidencia más completa.</div>
          </div>
        </div>
        ` : ""}

        <div class="cierre-new"><a href="#" id="new-report">+ Generar otro informe</a></div>
      </div>
    `;

    root.querySelector("#dl").addEventListener("click", () => {
      const pdf = detail.pdf_path || result.pdf_path;
      if (!pdf) { alert("El PDF aún no está disponible."); return; }
      // Backend devuelve una ruta absoluta del host PDF (p.ej.
      // "/tmp/informes_v4/informe_v4_....pdf"). El proxy /api/download espera
      // `?nombre=<archivo>.pdf` porque fetchea desde Nextcloud /informes/,
      // donde generate_pdf() sube los PDFs al terminar.
      const filename = String(pdf).split(/[\\/]/).pop();
      if (!filename.toLowerCase().endsWith(".pdf")) {
        alert("PDF inválido: " + filename); return;
      }
      window.location.href = `/api/download?nombre=${encodeURIComponent(filename)}`;
    });
    root.querySelector("#new-report").addEventListener("click", (e) => {
      e.preventDefault();
      resetState();
      window.location.reload();
    });
  }

  function fmtNum(n) { return n.toLocaleString("es-CL"); }
  function escapeHtml(s) { return String(s).replace(/[<>&"']/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c])); }
}
