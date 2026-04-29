/* =====================================================
   Prospecta v5 — Conversational flow engine
   One question per screen. Typed bot messages.
   ===================================================== */

// ------------ Demo data ------------
const SUGGESTIONS = [
  { text: "Tendencias de capital humano en la Región de Coquimbo hacia 2028–2030, con foco en minería, agricultura y turismo.", kind: "Capital humano · Coquimbo" },
  { text: "Impacto de la automatización sobre carreras TNS en Biobío, horizonte 2028–2032.", kind: "Automatización · Biobío" },
  { text: "Competitividad de la oferta de educación continua para adultos trabajadores del sector minero, zona norte.", kind: "Educación continua · Norte" }
];

const PLAN_DEFAULT = {
  titulo: "Capital humano y pertinencia formativa en Coquimbo, 2028–2030",
  thesis: "La región se recompondrá hacia perfiles técnicos de mediana-alta calificación en minería del cobre y litio, agricultura de precisión y turismo sostenible. La oferta actual cubre bien los núcleos tradicionales, pero muestra brechas en tres familias específicas.",
  secciones: [
    { titulo: "Diagnóstico regional", claim: "Recomposición demográfica y productiva simultánea, ventana 3–4 años." },
    { titulo: "Tendencias sectoriales", claim: "Litio, agricultura de precisión y turismo astronómico concentran el 71% del crecimiento." },
    { titulo: "Oferta formativa actual INACAP", claim: "Sede Coquimbo cubre núcleos tradicionales; tres familias muestran brechas operables." },
    { titulo: "Brechas identificadas", claim: "Operación minera autónoma, agrotecnología de riego, hospitalidad bilingüe." },
    { titulo: "Escenarios de respuesta", claim: "Dos escenarios capturan entre 340 y 820 matrículas anuales incrementales." },
    { titulo: "Recomendaciones", claim: "Priorizar ajustes al portafolio antes que nuevas aperturas; evaluar partnerships." }
  ]
};

// ------------ State ------------
const state = {
  answers: {
    tema: null,
    audiencia: null,
    sectores: [],
    horizonte: null,
    tono: null,
    extension: null
  },
  plan: JSON.parse(JSON.stringify(PLAN_DEFAULT)),
  stepIdx: 0,
  speed: 1 // 1 = normal
};

// Total visible steps in progress bar (captura 6 decisiones antes de planificar)
const TOTAL_QUESTIONS = 6;

// ------------ Helpers ------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const sleep = (ms) => new Promise(r => setTimeout(r, ms * state.speed));

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function scrollBottom() {
  const body = $('#chat-body');
  body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
}

function setProgress(idx, label) {
  state.stepIdx = idx;
  const pct = Math.min(100, (idx / TOTAL_QUESTIONS) * 100);
  $('#prog-fill').style.width = pct + '%';
  $('#prog-current').textContent = Math.min(idx, TOTAL_QUESTIONS);
  $('#prog-total').textContent = TOTAL_QUESTIONS;
  if (label) $('#prog-label').textContent = label;
}

// ------------ Messages ------------
function appendHistory(html) {
  const h = $('#chat-history');
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  // Move children of wrap into history
  while (wrap.firstChild) h.appendChild(wrap.firstChild);
  scrollBottom();
}

function pushUserReply(text, label) {
  appendHistory(`
    <div class="msg msg-user">
      <div class="user-card">
        <div class="user-card-label">${escapeHtml(label || 'Tu respuesta')}</div>
        <div class="user-card-text">${escapeHtml(text)}</div>
        <div class="user-card-edit" title="Editar">Editar</div>
      </div>
    </div>
  `);
}

async function pushTyping(ms = 900) {
  const h = $('#chat-history');
  const typing = document.createElement('div');
  typing.className = 'msg-typing';
  typing.innerHTML = `
    <div class="bot-dot thinking"></div>
    <div class="typing-bubble"><span></span><span></span><span></span></div>
  `;
  h.appendChild(typing);
  scrollBottom();
  await sleep(ms);
  typing.remove();
}

async function pushBotMessage(parts, { display = false, subtext = null } = {}) {
  // parts: array of strings — each gets staggered fade-in
  const h = $('#chat-history');
  const msg = document.createElement('div');
  msg.className = 'msg msg-bot';
  const partsHtml = parts.map((p, i) => {
    const tag = display ? 'div' : 'div';
    const cls = display ? 'bot-text display' : 'bot-text';
    return `<${tag} class="${cls}" style="opacity:0; transform:translateY(6px); transition: all 380ms var(--ease-out); transition-delay:${i * 180}ms; margin-bottom:${i < parts.length - 1 ? 10 : 0}px;">${p}</${tag}>`;
  }).join('');
  const subHtml = subtext ? `<div class="bot-sub" style="opacity:0; transition: opacity 300ms var(--ease-out); transition-delay:${parts.length * 180 + 150}ms;">${subtext}</div>` : '';
  msg.innerHTML = `
    <div class="bot-dot"></div>
    <div class="bot-bubble">
      <div class="bot-name">Prospecta</div>
      ${partsHtml}
      ${subHtml}
    </div>
  `;
  h.appendChild(msg);
  scrollBottom();
  // trigger stagger
  requestAnimationFrame(() => {
    msg.querySelectorAll('.bot-text').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    const sub = msg.querySelector('.bot-sub');
    if (sub) sub.style.opacity = '1';
  });
  await sleep(parts.length * 180 + 200);
  scrollBottom();
}

function clearActiveRegion() {
  $$('.active-question').forEach(el => el.remove());
  $('#composer').classList.remove('active');
  $('#composer-text').value = '';
}

function appendActiveQuestion(html) {
  const h = $('#chat-history');
  const wrap = document.createElement('div');
  wrap.className = 'active-question';
  wrap.innerHTML = html;
  h.appendChild(wrap);
  scrollBottom();
}

// ------------ LOGIN ------------
$('#btn-login').addEventListener('click', async () => {
  const btn = $('#btn-login');
  const txt = $('#btn-login-text');
  btn.disabled = true;
  txt.innerHTML = '<span class="spinner"></span> Entrando';
  await sleep(700);
  $('#screen-login').classList.remove('active');
  $('#screen-chat').classList.add('active');
  // Start flow
  startFlow();
});

// ------------ FLOW STEPS ------------
async function startFlow() {
  setProgress(1, 'Tema del informe');
  await sleep(400);
  await askTema();
}

// --- STEP 1 · Tema (freeform) ---
async function askTema() {
  clearActiveRegion();
  setProgress(1, 'Tema del informe');
  await pushTyping(700);
  await pushBotMessage(
    ['Hola Ignacio. Soy <em>Prospecta</em>.', '¿Qué quieres saber?'],
    { display: true, subtext: 'Una pregunta — respóndela con tus propias palabras. Mientras más específico, mejor.' }
  );

  appendActiveQuestion(`
    <div class="suggestions-title">Si necesitas un punto de partida</div>
    <div class="suggestions">
      ${SUGGESTIONS.map((s, i) => `
        <button class="suggestion-item" data-sg="${i}">
          <span class="sg-arrow">→</span>
          <span class="sg-text">${escapeHtml(s.text)}</span>
          <span class="sg-kind">${escapeHtml(s.kind)}</span>
        </button>
      `).join('')}
    </div>
  `);

  $$('.suggestion-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.sg;
      const t = SUGGESTIONS[idx].text;
      $('#composer-text').value = t;
      $('#composer-text').dispatchEvent(new Event('input'));
      $('#composer-text').focus();
    });
  });

  activateComposer('Describe el informe que necesitas…', async (text) => {
    state.answers.tema = text;
    pushUserReply(text, 'Tema');
    await askAudiencia();
  });
}

// --- STEP 2 · Audiencia (single-select cards) ---
async function askAudiencia() {
  clearActiveRegion();
  setProgress(2, 'Audiencia');
  await pushTyping(650);
  await pushBotMessage(
    ['Recibido.', '¿Para <em>quién</em> es este informe?'],
    { display: true, subtext: 'El tono, la profundidad técnica y los anexos se ajustan según quién lee.' }
  );

  const opts = [
    { val: 'directivos',   title: 'Directivos académicos',   sub: 'Decanos, vicerrectores, jefes de carrera' },
    { val: 'mesa-oferta',  title: 'Mesa de Oferta',          sub: 'Ajustes y aperturas de portafolio' },
    { val: 'alta-direccion', title: 'Alta dirección',        sub: 'Rectoría y directorio' },
    { val: 'ces',          title: 'Consejos Estratégicos Regionales', sub: 'Comités sede con stakeholders externos' },
    { val: 'tecnicos',     title: 'Equipo técnico interno',  sub: 'DAI, estudios, planificación' }
  ];

  appendActiveQuestion(`
    <div class="active-meta">Pregunta 2 de ${TOTAL_QUESTIONS}</div>
    <div class="chip-list">
      ${opts.map((o, i) => `
        <button class="chip-option" data-val="${o.val}" data-title="${escapeHtml(o.title)}">
          <div style="display:flex; align-items:baseline;">
            <span class="chip-num">${String(i+1).padStart(2,'0')}</span>
            <div>
              <div>${o.title}</div>
              <div class="chip-opt-sub" style="margin-top:2px;">${o.sub}</div>
            </div>
          </div>
          <span class="chip-opt-arrow">→</span>
        </button>
      `).join('')}
    </div>
  `);

  $$('.chip-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.answers.audiencia = btn.dataset.val;
      const title = btn.dataset.title;
      btn.classList.add('selected');
      await sleep(250);
      pushUserReply(title, 'Audiencia');
      await askSectores();
    });
  });
}

// --- STEP 3 · Sectores (multi-select) ---
async function askSectores() {
  clearActiveRegion();
  setProgress(3, 'Sectores');
  await pushTyping(600);
  await pushBotMessage(
    ['¿Qué <em>sectores</em> entran en el análisis?'],
    { display: true, subtext: 'Elige los que quieres cubrir. Puedes marcar varios.' }
  );

  const opts = ['Minería','Agricultura','Turismo','Pesca','Construcción','Logística','Energía','Educación','Salud','Retail'];

  appendActiveQuestion(`
    <div class="active-meta">Pregunta 3 de ${TOTAL_QUESTIONS} · múltiple</div>
    <div class="multi-chips" id="sectores-chips">
      ${opts.map(o => `<button class="mchip" data-val="${o}">${o}</button>`).join('')}
    </div>
    <div class="active-action">
      <span style="font-family:var(--font-mono); font-size:11px; color:var(--ink-3); letter-spacing:0.04em;" id="sel-count">0 seleccionados</span>
      <button class="btn btn-primary" id="btn-sectores-next" disabled>Continuar <span class="btn-arrow">→</span></button>
    </div>
  `);

  // pre-select common ones for demo realism if tema contains "Coquimbo" etc
  const presel = (state.answers.tema || '').toLowerCase();
  const presetBank = [];
  if (/mine/i.test(presel)) presetBank.push('Minería');
  if (/agri|agro/i.test(presel)) presetBank.push('Agricultura');
  if (/tur/i.test(presel)) presetBank.push('Turismo');
  if (presetBank.length === 0) presetBank.push('Minería', 'Agricultura', 'Turismo');

  const selected = new Set(presetBank);
  function refresh() {
    $$('#sectores-chips .mchip').forEach(c => c.classList.toggle('selected', selected.has(c.dataset.val)));
    $('#sel-count').textContent = `${selected.size} seleccionado${selected.size === 1 ? '' : 's'}`;
    $('#btn-sectores-next').disabled = selected.size === 0;
  }
  refresh();

  $$('#sectores-chips .mchip').forEach(c => {
    c.addEventListener('click', () => {
      const v = c.dataset.val;
      if (selected.has(v)) selected.delete(v);
      else selected.add(v);
      refresh();
    });
  });

  $('#btn-sectores-next').addEventListener('click', async () => {
    state.answers.sectores = [...selected];
    pushUserReply(state.answers.sectores.join(', '), 'Sectores');
    await askHorizonte();
  });
}

// --- STEP 4 · Horizonte (single-select) ---
async function askHorizonte() {
  clearActiveRegion();
  setProgress(4, 'Horizonte');
  await pushTyping(550);
  await pushBotMessage(
    ['¿Qué <em>horizonte</em> temporal?'],
    { display: true }
  );

  const opts = [
    { val: 'corto', title: 'Corto plazo',  sub: '12 meses · decisiones operativas' },
    { val: 'medio', title: 'Mediano plazo', sub: '2–4 años · planificación académica' },
    { val: 'largo', title: 'Largo plazo',  sub: '5+ años · posicionamiento estratégico' }
  ];

  appendActiveQuestion(`
    <div class="active-meta">Pregunta 4 de ${TOTAL_QUESTIONS}</div>
    <div class="chip-list">
      ${opts.map((o, i) => `
        <button class="chip-option" data-val="${o.val}" data-title="${escapeHtml(o.title + ' · ' + o.sub)}">
          <div style="display:flex; align-items:baseline;">
            <span class="chip-num">${String(i+1).padStart(2,'0')}</span>
            <div>
              <div>${o.title}</div>
              <div class="chip-opt-sub" style="margin-top:2px;">${o.sub}</div>
            </div>
          </div>
          <span class="chip-opt-arrow">→</span>
        </button>
      `).join('')}
    </div>
  `);

  $$('.chip-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.answers.horizonte = btn.dataset.val;
      btn.classList.add('selected');
      await sleep(250);
      pushUserReply(btn.dataset.title, 'Horizonte');
      await askTono();
    });
  });
}

// --- STEP 5 · Tono ---
async function askTono() {
  clearActiveRegion();
  setProgress(5, 'Tono');
  await pushTyping(500);
  await pushBotMessage(
    ['¿Con qué <em>tono</em> escribo?'],
    { display: true, subtext: 'Afecta la densidad, el uso de tecnicismos y el estilo de las conclusiones.' }
  );

  const opts = [
    { val: 'ejecutivo', title: 'Ejecutivo',  sub: 'Directo. Hallazgos al frente, soporte al fondo.' },
    { val: 'academico', title: 'Académico',  sub: 'Argumentativo. Revisión, método y discusión.' },
    { val: 'tecnico',   title: 'Técnico',    sub: 'Preciso. Tablas, métricas, vocabulario especializado.' }
  ];

  appendActiveQuestion(`
    <div class="active-meta">Pregunta 5 de ${TOTAL_QUESTIONS}</div>
    <div class="chip-list">
      ${opts.map((o, i) => `
        <button class="chip-option" data-val="${o.val}" data-title="${escapeHtml(o.title)}">
          <div style="display:flex; align-items:baseline;">
            <span class="chip-num">${String(i+1).padStart(2,'0')}</span>
            <div>
              <div>${o.title}</div>
              <div class="chip-opt-sub" style="margin-top:2px;">${o.sub}</div>
            </div>
          </div>
          <span class="chip-opt-arrow">→</span>
        </button>
      `).join('')}
    </div>
  `);

  $$('.chip-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.answers.tono = btn.dataset.val;
      btn.classList.add('selected');
      await sleep(250);
      pushUserReply(btn.dataset.title, 'Tono');
      await askExtension();
    });
  });
}

// --- STEP 6 · Extensión ---
async function askExtension() {
  clearActiveRegion();
  setProgress(6, 'Extensión');
  await pushTyping(450);
  await pushBotMessage(
    ['Última pregunta.', '¿Qué <em>largo</em>?'],
    { display: true, subtext: 'Esto define cuántas secciones voy a proponer y cuántas fuentes voy a consultar.' }
  );

  const opts = [
    { val: 'short',  title: 'Breve',    sub: '~8 páginas · 25 fuentes · 90 segundos' },
    { val: 'medium', title: 'Estándar', sub: '~16 páginas · 42 fuentes · 3 minutos' },
    { val: 'long',   title: 'Extenso',  sub: '~32 páginas · 80 fuentes · 6 minutos' }
  ];

  appendActiveQuestion(`
    <div class="active-meta">Pregunta 6 de ${TOTAL_QUESTIONS}</div>
    <div class="chip-list">
      ${opts.map((o, i) => `
        <button class="chip-option" data-val="${o.val}" data-title="${escapeHtml(o.title + ' · ' + o.sub)}">
          <div style="display:flex; align-items:baseline;">
            <span class="chip-num">${String(i+1).padStart(2,'0')}</span>
            <div>
              <div>${o.title}</div>
              <div class="chip-opt-sub" style="margin-top:2px;">${o.sub}</div>
            </div>
          </div>
          <span class="chip-opt-arrow">→</span>
        </button>
      `).join('')}
    </div>
  `);

  $$('.chip-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.answers.extension = btn.dataset.val;
      btn.classList.add('selected');
      await sleep(250);
      pushUserReply(btn.dataset.title, 'Extensión');
      await showPlan();
    });
  });
}

// --- PLAN (single action: generar, con edición inline) ---
async function showPlan() {
  clearActiveRegion();
  setProgress(TOTAL_QUESTIONS, 'Plan · revisión');
  await pushTyping(1200);
  await pushBotMessage(
    ['Listo. Tengo suficiente.', 'Este es el <em>plan</em>.'],
    { display: true, subtext: 'Puedes editar el título, la tesis y cualquier sección. También reordenar o eliminar. Cuando estés conforme, genero.' }
  );

  appendActiveQuestion(`
    <div class="plan-card" id="plan-card">
      <div class="plan-card-header">
        <div class="plan-card-eyebrow">Título · clic para editar</div>
        <h3 id="plan-title" contenteditable="true" spellcheck="false">${escapeHtml(state.plan.titulo)}</h3>
        <div class="plan-card-thesis" id="plan-thesis-display">
          <em style="color:var(--ink-3); font-family:var(--font-mono); font-size:10px; letter-spacing:0.1em; text-transform:uppercase; font-style:normal;">Tesis central</em><br>
          <span id="plan-thesis-text">${escapeHtml(state.plan.thesis)}</span>
        </div>
      </div>
      <div class="plan-sections" id="plan-sections"></div>
      <button class="plan-add" id="plan-add">
        <span class="plus">+</span>
        Agregar sección
      </button>
    </div>
    <div class="active-action" style="margin-top: 24px;">
      <button class="link-btn" id="btn-plan-restart">Volver a empezar</button>
      <button class="btn btn-accent btn-lg" id="btn-plan-generate">
        Se ve bien — genera el informe <span class="btn-arrow">→</span>
      </button>
    </div>
  `);

  renderPlanSections();

  $('#plan-title').addEventListener('blur', (e) => {
    state.plan.titulo = e.target.textContent.trim();
  });

  $('#plan-thesis-text').setAttribute('contenteditable', 'true');
  $('#plan-thesis-text').addEventListener('blur', (e) => {
    state.plan.thesis = e.target.textContent.trim();
  });

  $('#plan-add').addEventListener('click', () => {
    state.plan.secciones.push({ titulo: 'Nueva sección', claim: 'Describe brevemente la afirmación central de esta sección.' });
    renderPlanSections();
  });

  $('#btn-plan-restart').addEventListener('click', () => {
    if (confirm('¿Empezar de nuevo? Se borran las respuestas actuales.')) {
      resetFlow();
    }
  });

  $('#btn-plan-generate').addEventListener('click', runGeneration);
}

function renderPlanSections() {
  const wrap = $('#plan-sections');
  wrap.innerHTML = '';
  state.plan.secciones.forEach((sec, i) => {
    const el = document.createElement('div');
    el.className = 'plan-sec';
    el.innerHTML = `
      <div class="plan-sec-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="plan-sec-body">
        <h4 contenteditable="true" spellcheck="false" data-field="titulo">${escapeHtml(sec.titulo)}</h4>
        <p>${escapeHtml(sec.claim)}</p>
      </div>
      <div class="plan-sec-actions">
        <button class="icon-btn" title="Subir" data-act="up">
          <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
        <button class="icon-btn" title="Bajar" data-act="down">
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="icon-btn danger" title="Eliminar" data-act="del">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
    el.querySelector('[data-field="titulo"]').addEventListener('blur', (e) => {
      state.plan.secciones[i].titulo = e.target.textContent.trim();
    });
    el.querySelector('[data-act="up"]').addEventListener('click', () => {
      if (i === 0) return;
      [state.plan.secciones[i - 1], state.plan.secciones[i]] = [state.plan.secciones[i], state.plan.secciones[i - 1]];
      renderPlanSections();
    });
    el.querySelector('[data-act="down"]').addEventListener('click', () => {
      if (i === state.plan.secciones.length - 1) return;
      [state.plan.secciones[i + 1], state.plan.secciones[i]] = [state.plan.secciones[i], state.plan.secciones[i + 1]];
      renderPlanSections();
    });
    el.querySelector('[data-act="del"]').addEventListener('click', () => {
      if (state.plan.secciones.length <= 1) return;
      state.plan.secciones.splice(i, 1);
      renderPlanSections();
    });
    wrap.appendChild(el);
  });
}

// --- GENERATION (first-person narration) ---
async function runGeneration() {
  clearActiveRegion();
  // Confirmation as user action
  pushUserReply('Se ve bien — genera el informe', 'Aprobación del plan');

  await pushTyping(800);
  await pushBotMessage(
    ['Me pongo a trabajar.'],
    { display: true, subtext: 'Puedes seguir el avance en vivo. Si algo se ve mal, puedes detener y ajustar.' }
  );

  // build generation panel
  appendActiveQuestion(`
    <div class="gen-screen">
      <div class="gen-progress-row">
        <div>
          <div class="gen-pct" id="gen-pct">0</div>
        </div>
        <div class="gen-pct-sub">avance</div>
        <div class="gen-eta">Faltan <strong id="gen-eta">~3 min</strong></div>
      </div>
      <div class="gen-bar"><div class="gen-bar-fill" id="gen-bar"></div></div>

      <div class="gen-status-line" style="margin-top: 22px;">
        <span class="status-dot"></span>
        <span class="status-text" id="gen-current">Abriendo la base de conocimiento…</span>
      </div>

      <div class="gen-steps" id="gen-steps"></div>
    </div>
  `);

  // Narrative steps — first person, concrete
  const steps = [
    { label: 'Entiendo tu tema y lo descompongo en preguntas', meta: 'Contexto',    ms: 900 },
    { label: 'Busco en la base de conocimiento de la DAI',      meta: '12.847 docs', ms: 1300 },
    { label: `Reúno fuentes externas relevantes`,              meta: 'Cochilco, SIES, OMIL', ms: 1100 },
    ...state.plan.secciones.map((s, i) => ({
      label: `Redacto la sección ${String(i+1).padStart(2,'0')} · ${s.titulo}`,
      meta: 'Sección', ms: 1400
    })),
    { label: 'Armo bibliografía y verifico citas',              meta: 'Referencias', ms: 900 },
    { label: 'Compilo el PDF y lo dejo disponible',             meta: 'Exporte',     ms: 800 }
  ];

  const stepsWrap = $('#gen-steps');
  steps.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'gen-step';
    el.id = `gs-${i}`;
    el.innerHTML = `
      <div class="g-icon"></div>
      <div>${escapeHtml(s.label)}</div>
      <div class="gen-step-meta">${escapeHtml(s.meta)}</div>
    `;
    stepsWrap.appendChild(el);
  });

  // narration phrases (first-person, sober)
  const currentEl = $('#gen-current');

  const total = steps.length;
  let elapsed = 0;
  const totalMs = steps.reduce((a, s) => a + s.ms, 0);

  for (let i = 0; i < total; i++) {
    const step = steps[i];
    const el = $(`#gs-${i}`);
    el.classList.add('active');
    currentEl.textContent = step.label + '…';

    // progress grows during this step
    const startPct = Math.round((elapsed / totalMs) * 100);
    const endPct = Math.round(((elapsed + step.ms) / totalMs) * 100);
    animateProgress(startPct, endPct, step.ms);

    // ETA
    const remainingMs = totalMs - elapsed - step.ms;
    $('#gen-eta').textContent = humanEta(remainingMs);

    await sleep(step.ms);
    el.classList.remove('active');
    el.classList.add('done');
    el.querySelector('.gen-step-meta').textContent = 'Completo';
    elapsed += step.ms;
  }

  // done
  $('#gen-pct').textContent = '100';
  $('#gen-bar').style.width = '100%';
  $('#gen-eta').innerHTML = 'Listo en <strong>2:47</strong>';
  currentEl.textContent = 'Informe compilado.';

  await sleep(600);
  await showResult();
}

function animateProgress(from, to, ms) {
  const start = performance.now();
  const bar = $('#gen-bar');
  const pctEl = $('#gen-pct');
  function tick(now) {
    const t = Math.min(1, (now - start) / (ms * state.speed));
    const val = Math.round(from + (to - from) * t);
    bar.style.width = val + '%';
    pctEl.textContent = val;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function humanEta(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `~${Math.max(5, s)} seg`;
  const m = Math.floor(s / 60), r = s % 60;
  return `~${m}:${String(r).padStart(2,'0')}`;
}

// --- RESULT (single primary CTA) ---
async function showResult() {
  clearActiveRegion();
  setProgress(TOTAL_QUESTIONS, 'Informe listo');
  await pushBotMessage(
    ['Aquí está tu informe.'],
    { display: true, subtext: 'Puedes descargarlo, compartirlo o pedirme que ajuste algo.' }
  );

  appendActiveQuestion(`
    <div class="result-screen">
      <div class="result-done-stamp">Generado hace un momento</div>
      <div class="result-title">${escapeHtml(state.plan.titulo.split(',')[0])}<br><em>${escapeHtml(state.plan.titulo.split(',').slice(1).join(',').trim() || 'Informe prospectivo')}</em></div>
      <p class="result-sub">${state.plan.secciones.length} secciones · 42 fuentes citadas · resumen ejecutivo al inicio, anexo metodológico al final.</p>

      <div class="result-primary">
        <button class="btn btn-accent btn-lg" id="btn-download">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PDF
        </button>
      </div>

      <div class="result-stats">
        <div class="result-stat">
          <div class="result-stat-label">Extensión</div>
          <div class="result-stat-value">16 <span style="font-size:18px; color:var(--ink-3);">pg</span></div>
          <div class="result-stat-sub">4.820 palabras</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Fuentes</div>
          <div class="result-stat-value">42</div>
          <div class="result-stat-sub">11 externas · 31 internas</div>
        </div>
        <div class="result-stat">
          <div class="result-stat-label">Tiempo</div>
          <div class="result-stat-value">2:47</div>
          <div class="result-stat-sub">min:seg</div>
        </div>
      </div>

      <div class="result-secondary">
        <button class="link-btn" id="btn-share">Copiar enlace</button>
        <button class="link-btn" id="btn-email">Enviar por correo</button>
        <button class="link-btn" id="btn-refine">Ajustar algo</button>
        <button class="link-btn" id="btn-new">Nuevo informe</button>
      </div>
    </div>
  `);

  $('#btn-download').addEventListener('click', async () => {
    const b = $('#btn-download');
    b.disabled = true;
    b.innerHTML = '<span class="spinner" style="border-top-color:var(--bg-1);"></span> Descargando…';
    await sleep(1200);
    b.innerHTML = '✓ Descargado';
    setTimeout(() => {
      b.disabled = false;
      b.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar PDF`;
    }, 1800);
  });

  $('#btn-new').addEventListener('click', () => resetFlow());
  $('#btn-refine').addEventListener('click', async () => {
    pushUserReply('Me gustaría ajustar la sección sobre brechas formativas', 'Solicitud de ajuste');
    await pushTyping(700);
    await pushBotMessage(
      ['Claro. ¿Qué quieres cambiar en esa sección?'],
      { display: false, subtext: 'Puedes pedirme que la reescriba, que agregue evidencia, o que la enfoque distinto.' }
    );
    activateComposer('Describe el ajuste que necesitas…', async (text) => {
      pushUserReply(text, 'Ajuste solicitado');
      await pushTyping(1100);
      await pushBotMessage(
        ['Entendido. Regenero esa sección y te aviso en cuanto esté.'],
        { display: false }
      );
    });
  });
}

// --- Composer ---
function activateComposer(placeholder, onSubmit) {
  const c = $('#composer');
  const ta = $('#composer-text');
  const send = $('#composer-send');
  ta.placeholder = placeholder;
  c.classList.add('active');
  ta.focus();

  function update() {
    send.disabled = ta.value.trim().length < 8;
    // auto-resize
    ta.style.height = 'auto';
    ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
  }
  ta.oninput = update;
  update();

  async function submit() {
    const v = ta.value.trim();
    if (v.length < 8) return;
    c.classList.remove('active');
    ta.value = '';
    await onSubmit(v);
  }
  send.onclick = submit;
  ta.onkeydown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
  };
}

// --- Reset ---
function resetFlow() {
  state.answers = { tema: null, audiencia: null, sectores: [], horizonte: null, tono: null, extension: null };
  state.plan = JSON.parse(JSON.stringify(PLAN_DEFAULT));
  $('#chat-history').innerHTML = '';
  setProgress(0, 'Tema del informe');
  startFlow();
}

// ------------ Tweaks ------------
$('#tweaks-toggle').addEventListener('click', () => {
  $('#tweaks-panel').classList.toggle('open');
});

$$('.tweak-row').forEach(row => {
  row.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tweak = row.dataset.tweak;
    const val = btn.dataset.val;

    if (tweak === 'jump') {
      jumpTo(val);
      return;
    }

    row.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (tweak === 'palette') document.documentElement.setAttribute('data-palette', val);
    if (tweak === 'theme') document.documentElement.setAttribute('data-theme', val);
    if (tweak === 'radius') document.documentElement.setAttribute('data-radius', val);
    if (tweak === 'speed') {
      state.speed = val === 'fast' ? 0.4 : val === 'slow' ? 1.7 : 1;
    }
  });
});

function jumpTo(step) {
  if (step === 'login') {
    $('#screen-chat').classList.remove('active');
    $('#screen-login').classList.add('active');
    $('#chat-history').innerHTML = '';
    return;
  }
  $('#screen-login').classList.remove('active');
  $('#screen-chat').classList.add('active');
  $('#chat-history').innerHTML = '';
  state.answers = {
    tema: 'Tendencias de capital humano en la Región de Coquimbo hacia 2028–2030, con foco en minería, agricultura y turismo.',
    audiencia: 'directivos',
    sectores: ['Minería', 'Agricultura', 'Turismo'],
    horizonte: 'medio',
    tono: 'ejecutivo',
    extension: 'medium'
  };
  state.plan = JSON.parse(JSON.stringify(PLAN_DEFAULT));

  if (step === 'start') { startFlow(); return; }

  // Reconstruct history for jumps that skip
  if (step === 'plan' || step === 'gen' || step === 'done') {
    const fake = async () => {
      setProgress(TOTAL_QUESTIONS, 'Plan · revisión');
      pushUserReply(state.answers.tema, 'Tema');
      pushUserReply('Directivos académicos', 'Audiencia');
      pushUserReply(state.answers.sectores.join(', '), 'Sectores');
      pushUserReply('Mediano plazo · 2–4 años', 'Horizonte');
      pushUserReply('Ejecutivo', 'Tono');
      pushUserReply('Estándar · ~16 páginas', 'Extensión');
      if (step === 'plan') { await showPlan(); return; }
      if (step === 'gen') { await runGeneration(); return; }
      if (step === 'done') { await showResult(); return; }
    };
    state.speed = 0.1; // instant for jump
    fake().then(() => { state.speed = 1; });
  }
}
