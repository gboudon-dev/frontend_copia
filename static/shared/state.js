// frontend/v5/shared/state.js
// State machine de los momentos del workbench + auto-save del plan en localStorage.

const DRAFT_KEY = "prospecta_v5_draft";

export const MOMENTS = ["composer", "clarifier", "plan", "generation", "cierre"];

export function getState() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return { moment: "composer", composer: {}, clarifier: {}, plan: null, jobId: null };
  try { return JSON.parse(raw); } catch { return { moment: "composer" }; }
}

export function setState(patch) {
  const curr = getState();
  const next = { ...curr, ...patch };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  return next;
}

export function resetState() {
  localStorage.removeItem(DRAFT_KEY);
}

/**
 * Auto-save con debounce 800ms.
 */
let _timer = null;
export function autoSave(patch) {
  clearTimeout(_timer);
  _timer = setTimeout(() => setState(patch), 800);
}

/**
 * Event bus mínimo para comunicar cambios de momento entre módulos.
 */
const listeners = new Set();
export function onMomentChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function goToMoment(moment) {
  const s = setState({ moment });
  listeners.forEach((fn) => fn(s));
}
