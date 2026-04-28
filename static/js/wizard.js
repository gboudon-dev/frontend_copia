const API = '/api/v2';
let token = '';
let currentPlan = null;
let currentJobId = '';
let pollInterval = null;
let _pollFailures = 0;

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const resp = await fetch(API + path, { ...options, headers });
  return resp;
}

function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(['','step-login','step-tema','step-plan','step-generate'][n]).classList.add('active');
  document.querySelectorAll('.stepper .s').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 === n) s.classList.add('active');
    else if (i + 1 < n) s.classList.add('done');
  });
}

async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Ingresa usuario y contrasena'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  try {
    const resp = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!resp.ok) { errEl.textContent = 'Credenciales invalidas'; return; }
    const data = await resp.json();
    token = data.token;
    goToStep(2);
  } catch (e) {
    errEl.textContent = 'Error de conexion: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Entrar';
  }
}

async function submitTema() {
  const prompt = document.getElementById('prompt').value.trim();
  const contexto = document.getElementById('contexto').value.trim();
  const errEl = document.getElementById('tema-error');
  const btn = document.getElementById('btn-plan');
  errEl.textContent = '';

  if (!prompt) { errEl.textContent = 'Describe el objetivo del informe'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Planificando...';

  try {
    const resp = await apiFetch('/plan', {
      method: 'POST',
      body: JSON.stringify({ prompt, contexto }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      errEl.textContent = err.detail || 'Error generando plan';
      return;
    }
    const data = await resp.json();
    currentPlan = data.plan;
    renderPlan(currentPlan);
    goToStep(3);
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generar plan';
  }
}

function renderPlan(plan) {
  // Título
  document.getElementById('plan-titulo-display').textContent = plan.titulo_sugerido || 'Sin titulo';
  const inp = document.getElementById('plan-titulo-input');
  if (inp) inp.remove();

  const container = document.getElementById('plan-sections');
  container.innerHTML = '';
  (plan.secciones || []).forEach((sec, i) => {
    container.appendChild(buildSecCard(sec, i));
  });
  setupDragDrop(container);
}

function buildSecCard(sec, idx) {
  const card = document.createElement('div');
  card.className = 'sec-card';
  card.draggable = true;
  card.dataset.idx = idx;

  const desc = sec.contexto_adicional || '';
  const bloques = (sec.bloques || []).map(b => `<span class="chip">${esc(b)}</span>`).join('');

  card.innerHTML = `
    <div class="sec-card-header">
      <span class="sec-drag-handle">⠿</span>
      <div class="sec-body">
        <div class="sec-title-row">
          <span class="sec-title">${idx + 1}. ${esc(sec.titulo || 'Sin titulo')}</span>
          <div class="sec-actions">
            <button class="sec-btn sec-btn-edit" onclick="editSecDesc(this)">✎ Editar</button>
            <button class="sec-btn sec-btn-refine" onclick="toggleRefineBox(this)">↺ IA</button>
            <button class="sec-btn sec-btn-delete" onclick="deleteSec(this)">✕</button>
          </div>
        </div>
        ${desc ? `<div class="sec-desc">${esc(desc)}</div>` : ''}
        <div class="chips">${bloques}</div>
        <div class="refine-box" style="display:none;">
          <div class="refine-label">↺ Regenerar con IA</div>
          <input type="text" placeholder="Ej: Agregar foco en litio, incluir datos SIES..." />
          <div class="btn-row">
            <button class="btn btn-primary" style="padding:0.4rem 1rem;font-size:0.82rem;" onclick="submitRefine(this)">Regenerar</button>
            <button class="btn btn-secondary" style="padding:0.4rem 1rem;font-size:0.82rem;" onclick="toggleRefineBox(this)">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  return card;
}

function editTitulo() {
  const display = document.getElementById('plan-titulo-display');
  const row = document.getElementById('plan-titulo-row');
  const current = display.textContent;
  display.style.display = 'none';

  const inp = document.createElement('input');
  inp.id = 'plan-titulo-input';
  inp.value = current;
  inp.onblur = () => {
    currentPlan.titulo_sugerido = inp.value.trim() || current;
    display.textContent = currentPlan.titulo_sugerido;
    display.style.display = '';
    inp.remove();
  };
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
  row.insertBefore(inp, row.querySelector('button'));
  inp.focus();
}

function editSecDesc(btn) {
  const body = btn.closest('.sec-body');
  const descEl = body.querySelector('.sec-desc');
  const current = descEl ? descEl.textContent : '';
  if (descEl) descEl.remove();

  const ta = document.createElement('textarea');
  ta.className = 'sec-desc-input';
  ta.value = current;
  ta.rows = 3;
  ta.onblur = () => {
    syncPlanFromDOM();
    const newDesc = document.createElement('div');
    newDesc.className = 'sec-desc';
    newDesc.textContent = ta.value;
    ta.replaceWith(newDesc);
  };
  const chips = body.querySelector('.chips');
  body.insertBefore(ta, chips);
  ta.focus();
}

function toggleRefineBox(btn) {
  const body = btn.closest('.sec-body');
  const box = body.querySelector('.refine-box');
  const isVisible = box.style.display !== 'none';
  box.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) box.querySelector('input').focus();
}

async function submitRefine(btn) {
  const box = btn.closest('.refine-box');
  const instrucciones = box.querySelector('input').value.trim();
  if (!instrucciones) return;

  const card = btn.closest('.sec-card');
  const idx = parseInt(card.dataset.idx);
  const seccion = currentPlan.secciones[idx];

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const resp = await apiFetch('/plan/refine', {
      method: 'POST',
      body: JSON.stringify({ seccion, instrucciones }),
    });
    if (!resp.ok) throw new Error('Error en refinamiento');
    const data = await resp.json();
    currentPlan.secciones[idx] = data.seccion;
    const newCard = buildSecCard(data.seccion, idx);
    card.replaceWith(newCard);
    setupDragDrop(document.getElementById('plan-sections'));
  } catch (e) {
    document.getElementById('plan-errors').textContent = 'Error al refinar: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Regenerar';
  }
}

function deleteSec(btn) {
  if (!confirm('¿Eliminar esta sección?')) return;
  const card = btn.closest('.sec-card');
  const idx = parseInt(card.dataset.idx);
  currentPlan.secciones.splice(idx, 1);
  card.remove();
  renumberCards();
}

function addSection() {
  const newSec = {
    titulo: 'Nueva sección',
    contexto_adicional: '',
    bloques: [],
  };
  currentPlan.secciones.push(newSec);
  const container = document.getElementById('plan-sections');
  const idx = currentPlan.secciones.length - 1;
  const card = buildSecCard(newSec, idx);
  container.appendChild(card);
  setupDragDrop(container);
  card.querySelector('.sec-btn-edit').click();
}

function renumberCards() {
  document.querySelectorAll('.sec-card').forEach((card, i) => {
    card.dataset.idx = i;
    const titleEl = card.querySelector('.sec-title');
    if (titleEl) {
      titleEl.textContent = `${i + 1}. ${currentPlan.secciones[i]?.titulo || ''}`;
    }
  });
}

function syncPlanFromDOM() {
  document.querySelectorAll('.sec-card').forEach((card, i) => {
    const descEl = card.querySelector('.sec-desc');
    const taEl = card.querySelector('.sec-desc-input');
    if (taEl && currentPlan.secciones[i]) {
      currentPlan.secciones[i].contexto_adicional = taEl.value;
    } else if (descEl && currentPlan.secciones[i]) {
      currentPlan.secciones[i].contexto_adicional = descEl.textContent;
    }
  });
}

// --- Drag & Drop (event delegation — listeners on container, not on each card) ---
let _dragSrcCard = null;

function setupDragDrop(container) {
  if (container.dataset.ddBound) return;
  container.dataset.ddBound = 'true';

  container.addEventListener('dragstart', e => {
    const card = e.target.closest('.sec-card');
    if (!card) return;
    _dragSrcCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', e => {
    const card = e.target.closest('.sec-card');
    if (card) card.classList.remove('dragging');
    container.querySelectorAll('.sec-card').forEach(c => c.classList.remove('drag-over'));
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    const card = e.target.closest('.sec-card');
    if (!card || card === _dragSrcCard) return;
    e.dataTransfer.dropEffect = 'move';
    container.querySelectorAll('.sec-card').forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    const card = e.target.closest('.sec-card');
    if (!_dragSrcCard || !card || _dragSrcCard === card) return;
    const cards = [...container.querySelectorAll('.sec-card')];
    const srcIdx = cards.indexOf(_dragSrcCard);
    const dstIdx = cards.indexOf(card);
    if (srcIdx < dstIdx) {
      card.after(_dragSrcCard);
    } else {
      card.before(_dragSrcCard);
    }
    const [moved] = currentPlan.secciones.splice(srcIdx, 1);
    currentPlan.secciones.splice(dstIdx, 0, moved);
    renumberCards();
    card.classList.remove('drag-over');
  });
}

async function approvePlan() {
  if (!currentPlan) return;

  // Sincronizar ediciones en curso antes de generar
  syncPlanFromDOM();

  goToStep(4);
  const sections = currentPlan.secciones || [];
  const container = document.getElementById('progress-sections');
  container.innerHTML = '';
  sections.forEach((sec, i) => {
    const item = document.createElement('div');
    item.className = 'progress-item';
    item.id = 'progress-sec-' + i;
    item.innerHTML = `
      <span class="icon">&#9711;</span>
      <span class="label">${sec.titulo}</span>
    `;
    container.appendChild(item);
  });

  try {
    const resp = await apiFetch('/generate', {
      method: 'POST',
      body: JSON.stringify({
        plan: currentPlan,
        report_goal: document.getElementById('prompt').value.trim(),
      }),
    });
    if (!resp.ok) {
      document.getElementById('status-text').textContent = 'Error iniciando generacion';
      return;
    }
    const data = await resp.json();
    currentJobId = data.job_id;
    _pollFailures = 0;
    pollInterval = setInterval(pollStatus, 3000);
  } catch (e) {
    document.getElementById('status-text').textContent = 'Error: ' + e.message;
  }
}

async function pollStatus() {
  if (!currentJobId) return;

  try {
    const resp = await apiFetch('/status/' + currentJobId);
    if (!resp.ok) return;
    const data = await resp.json();

    document.getElementById('status-text').textContent = data.progress;

    const total = data.sections_total || 1;
    const done = data.sections_done || 0;
    const pct = data.status === 'completed' ? 100 : Math.round((done / total) * 90);
    document.getElementById('progress-fill').style.width = pct + '%';

    // Actualizar iconos de secciones
    const sections = currentPlan.secciones || [];
    sections.forEach((sec, i) => {
      const el = document.getElementById('progress-sec-' + i);
      if (!el) return;
      const icon = el.querySelector('.icon');
      if (i < done) {
        icon.textContent = '✓';
        icon.style.color = 'var(--green)';
      } else if (i === done && data.status === 'running') {
        icon.innerHTML = '<span class="spinner"></span>';
      }
    });

    if (data.status === 'completed') {
      clearInterval(pollInterval);
      document.getElementById('progress-fill').style.width = '100%';
      document.getElementById('progress-fill').style.background = 'var(--green)';
      document.getElementById('status-text').textContent = '';
      document.getElementById('generate-title').textContent = 'Informe generado';

      renderMetrics(data);
      document.getElementById('result-area').style.display = 'block';

      if (data.pdf_path) {
        const filename = data.pdf_path.split('/').pop();
        const btn = document.getElementById('btn-download');
        btn.href = '/api/download?nombre=' + encodeURIComponent(filename);
        btn.style.display = 'inline-flex';
      }
    } else if (data.status === 'error') {
      clearInterval(pollInterval);
      document.getElementById('status-text').textContent = 'Error: ' + data.error;
      document.getElementById('progress-fill').style.background = 'var(--red)';
    }
  } catch (e) {
    if (++_pollFailures >= 5) {
      clearInterval(pollInterval);
      pollInterval = null;
      document.getElementById('status-text').textContent = 'Error de conexión — recargá la página e intentá nuevamente';
    }
  }
}

function renderMetrics(data) {
  const grid = document.getElementById('metrics-grid');
  grid.innerHTML = '';

  function formatTokens(n) {
    return n ? n.toLocaleString('es-CL') : '—';
  }
  function formatTime(secs) {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const metrics = [
    { label: 'Fuentes consultadas', value: data.fuentes_total || '—', sub: 'documentos RAG', color: 'var(--periwinkle)' },
    { label: 'Tokens usados', value: formatTokens(data.tokens_total), sub: '', color: 'var(--durazno)' },
    { label: 'Costo estimado', value: data.costo_usd || '—', sub: '', color: 'var(--durazno)' },
    { label: 'Tiempo total', value: formatTime(data.elapsed_seconds), sub: 'minutos', color: 'var(--text-bright)' },
  ];

  metrics.forEach(m => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-label">${m.label}</div>
      <div class="metric-value" style="color:${m.color}">${m.value}</div>
      ${m.sub ? `<div class="metric-sub">${m.sub}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}

function newReport() {
  clearInterval(pollInterval);
  pollInterval = null;
  _pollFailures = 0;
  currentPlan = null;
  currentJobId = '';
  document.getElementById('prompt').value = '';
  document.getElementById('contexto').value = '';
  goToStep(2);
}

// Enter key support
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) submitTema(); });