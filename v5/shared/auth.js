// frontend/v5/shared/auth.js
// Helpers de autenticación — token en localStorage, guard de rutas.

const TOKEN_KEY = "prospecta_v5_token";
const USER_KEY = "prospecta_v5_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  if (username) localStorage.setItem(USER_KEY, username);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser() {
  return localStorage.getItem(USER_KEY) || "";
}

export function isAuthenticated() {
  return !!getToken();
}

/**
 * Guard de páginas protegidas. Si no hay token, redirige a /login?next=<ruta-actual>.
 * Llamar al inicio de páginas que requieren auth (ej. workbench).
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    const next = encodeURIComponent(window.location.pathname);
    window.location.replace(`/login?next=${next}`);
    return false;
  }
  return true;
}

/**
 * Logout: limpia token y redirige al landing.
 */
export function logout() {
  clearToken();
  window.location.replace("/");
}
