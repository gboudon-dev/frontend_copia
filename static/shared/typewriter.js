// frontend/v5/shared/typewriter.js
// Rota palabras con efecto typewriter. Una palabra ("de mercado") se pinta
// en peach; el cursor cambia de color en sync.

const DEFAULT_WORDS = [
  { text: "prospectiva", color: "var(--periwinkle)" },
  { text: "estratégica", color: "var(--periwinkle)" },
  { text: "de mercado", color: "var(--peach)" },
  { text: "regional", color: "var(--periwinkle)" },
  { text: "sectorial", color: "var(--periwinkle)" },
  { text: "territorial", color: "var(--periwinkle)" },
];

const TYPE_MIN = 85;
const TYPE_MAX = 125;
const DELETE_MS = 45;
const HOLD_MS = 1700;

function randomTypeDelay() {
  return TYPE_MIN + Math.random() * (TYPE_MAX - TYPE_MIN);
}

/**
 * Inicia la rotación. Requiere dos elementos:
 *   - textEl: donde se pinta la palabra (innerText). Su color se setea al
 *     color de la palabra actual.
 *   - cursorEl: barra vertical cuyo background se sincroniza al mismo color.
 */
export function startTypewriter(textEl, cursorEl, words = DEFAULT_WORDS) {
  let idx = 0;
  let charIdx = 0;
  let deleting = false;

  function applyColor(color) {
    textEl.style.color = color;
    if (cursorEl) cursorEl.style.background = color;
  }

  function tick() {
    const w = words[idx];
    applyColor(w.color);

    if (!deleting) {
      charIdx++;
      textEl.textContent = w.text.slice(0, charIdx);
      if (charIdx === w.text.length) {
        deleting = true;
        setTimeout(tick, HOLD_MS);
        return;
      }
      setTimeout(tick, randomTypeDelay());
    } else {
      charIdx--;
      textEl.textContent = w.text.slice(0, charIdx);
      if (charIdx === 0) {
        deleting = false;
        idx = (idx + 1) % words.length;
      }
      setTimeout(tick, DELETE_MS);
    }
  }

  tick();
}
