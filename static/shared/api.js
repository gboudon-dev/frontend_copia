// frontend/v5/shared/api.js
// Cliente de la API v4 consumida vía proxy (/api/v4/*).
// Todas las llamadas pasan por el proxy de frontend, que reenvía al backend
// en 10.58.114.33:8093 e incluye el header Authorization.

import { getToken, clearToken } from "/v5/shared/auth.js";

const BASE = "/api/v4";

/**
 * Wrapper sobre fetch. Inyecta Authorization si hay token, maneja 401
 * purgando token + redirect a /login.
 */
export async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/login?next=${next}`);
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  const ct = res.headers.get("Content-Type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

export async function login(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login falló: ${res.status}`);
  const data = await res.json();  // backend v4 devuelve { token, username }
  return { access_token: data.token || data.access_token, username: data.username };
}

/**
 * Solicitar plan. Respuesta puede ser:
 *  - { status: "needs_clarification", questions: [...], missing: [...], inferred: [...] }
 *  - { status: "ready", plan: {...} }
 */
export async function requestPlan({ prompt, region, period, contexto, audience, extension }) {
  return apiFetch("/plan", {
    method: "POST",
    body: JSON.stringify({ prompt, region, period, contexto, audience, extension }),
  });
}

/**
 * Arrancar generación async. Devuelve { job_id }.
 */
export async function generate({ plan, report_goal, audience, autor }) {
  return apiFetch("/generate", {
    method: "POST",
    body: JSON.stringify({ plan, report_goal, audience, autor }),
  });
}

/**
 * Consultar estado de job. Devuelve { status, sections_done, tokens_input, tokens_output, pdf_path, ... }
 */
export async function getStatus(jobId) {
  return apiFetch(`/status/${jobId}`);
}

export async function getResult(jobId) {
  return apiFetch(`/result/${jobId}`);
}

/**
 * Polling helper. Llama onTick cada 3s con el snapshot del job.
 * Resuelve cuando status === "completed" o "failed". onTick puede cancelar
 * devolviendo false.
 */
export function pollStatus(jobId, onTick, intervalMs = 3000) {
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const snap = await getStatus(jobId);
        const cont = onTick(snap);
        if (cont === false) return resolve(snap);
        if (snap.status === "completed" || snap.status === "failed") return resolve(snap);
        setTimeout(tick, intervalMs);
      } catch (e) { reject(e); }
    };
    tick();
  });
}
