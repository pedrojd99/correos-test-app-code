// IIAPP - Lógica principal y enrutado de pantallas

window.IIAPP = window.IIAPP || {};

(function() {
  const Storage = window.IIAPP.Storage;
  const Stats = window.IIAPP.Stats;
  const SRS = window.IIAPP.SRS;
  const Data = window.IIAPP.Data;
  const TEMARIO = window.IIAPP.TEMARIO;
  const QUESTIONS = window.IIAPP.QUESTIONS;

  // Estado global de la aplicación
  const App = {
    currentScreen: 'home',
    test: null,
    timerInterval: null
  };

  // ========== UTILIDADES ==========

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  // Escapa HTML para evitar XSS al insertar datos del usuario en innerHTML
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(n, decimals = 0) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(decimals).replace('.', ',');
  }

  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function nowIso() { return new Date().toISOString(); }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ========== ROUTER ==========

  async function show(screen, params = {}) {
    App.currentScreen = screen;
    $$('.screen').forEach(s => s.classList.add('hidden'));

    // Limpiar timer si salimos del test
    if (screen !== 'test' && App.timerInterval) {
      clearInterval(App.timerInterval);
      App.timerInterval = null;
    }

    const target = $('#screen-' + screen);
    if (!target) {
      $('#screen-home').classList.remove('hidden');
      return;
    }
    target.classList.remove('hidden');

    // Render dinámico según pantalla
    if (screen === 'home') await renderHome();
    if (screen === 'study') await renderStudy();
    if (screen === 'history') await renderHistory();
    if (screen === 'temario') await renderTemario();
    if (screen === 'tribunal' && typeof renderTribunal === 'function') await renderTribunal();
    if (screen === 'planes') await renderPlanes();
    if (screen === 'cuenta') await renderCuenta();
    if (screen === 'settings') await renderSettings();
    if (screen === 'result') await renderResult(params.sessionId);

    // Actualizar nav activa (header + barra inferior móvil)
    $$('.nav-item, .bn-item').forEach(n => n.classList.remove('active'));
    $$(`[data-nav="${screen}"]`).forEach(n => n.classList.add('active'));

    window.scrollTo(0, 0);
  }

  // ========== PANTALLA: HOME (DASHBOARD) ==========

  async function renderHome() {
    const target = $('#screen-home');
    const g = await Stats.global();
    const last7 = await Stats.last7Days();
    const modules = await Stats.byModule();
    const dueCount = await SRS.countDue();
    const profile = await Storage.getAllProfile();
    const xp = await Stats.getXP();
    const level = Stats.xpToLevel(xp);
    const qdq = Stats.questionOfDay(window.IIAPP.QUESTIONS);

    const alias = profile.alias || (profile.name ? profile.name.split(' ')[0] : null);
    const greeting = alias ? `¡Hola, ${esc(alias)}!` : '¡Hola!';

    // Mensaje motivacional dinámico
    const motivMsg = (() => {
      if (g.total === 0) return '5 minutos al día son suficientes para aprobar. ¡Empieza ahora!';
      if (g.currentStreak >= 7) return `🔥 ¡${g.currentStreak} días seguidos! Estás en racha.`;
      if (last7.accuracy >= 70) return `Llevas un ${fmt(last7.accuracy,0)}% de acierto esta semana. ¡Sigue así!`;
      if (last7.accuracy >= 50) return 'Vas mejorando. Unos minutos más hoy y lo notarás.';
      return 'Cada test que haces te acerca más al aprobado.';
    })();

    // Calcula temas prioritarios para el foco
    const focoMods = TEMARIO.modules.map(m => {
      const stat = modules[m.number];
      const acc = stat && stat.accuracy != null ? stat.accuracy / 100 : 0.5;
      return { ...m, acc: stat && stat.accuracy != null ? stat.accuracy : null, priority: m.weight * (1.2 - Math.min(acc, 1)) };
    }).sort((a, b) => b.priority - a.priority).slice(0, 3);

    target.innerHTML = `
      <div class="container">

        <!-- Cabecera: saludo + nivel XP + racha -->
        <div class="dl-header">
          <div class="dl-greeting">
            <h1 class="page-title" style="margin:0">${greeting}</h1>
            <p class="dl-tagline">${motivMsg}</p>
          </div>
          <div class="dl-badges">
            ${g.currentStreak > 0 ? `<div class="dl-badge dl-streak">🔥 ${g.currentStreak}</div>` : ''}
            <div class="dl-badge dl-level" style="background:${level.color}20;color:${level.color};border-color:${level.color}40">
              ${level.emoji} ${level.name}
            </div>
          </div>
        </div>

        <!-- Barra de XP -->
        <div class="dl-xp-bar-wrap">
          <div class="dl-xp-info">
            <span>${level.xp} XP</span>
            ${level.nextXP ? `<span class="text-muted" style="font-size:12px">Siguiente nivel: ${level.nextXP} XP</span>` : '<span style="color:#FFCD00;font-weight:700">¡Nivel máximo!</span>'}
          </div>
          <div class="dl-xp-track">
            <div class="dl-xp-fill" style="width:${level.progress}%;background:${level.color}"></div>
          </div>
        </div>

        <!-- Acción principal: 5 minutos al día -->
        <button class="dl-cta" onclick="IIAPP.UI.startMicrotest()">
          <div class="dl-cta-left">
            <div class="dl-cta-icon">⏱</div>
            <div>
              <div class="dl-cta-title">5 minutos al día</div>
              <div class="dl-cta-sub">5 preguntas · sin presión · construye hábito</div>
            </div>
          </div>
          <div class="dl-cta-arrow">→</div>
        </button>

        <!-- Pregunta del día -->
        ${qdq ? `
        <div class="card dl-qdq" id="qdq-card">
          <div class="card-header">
            <h3>Pregunta del día</h3>
            <span class="badge" style="background:#fff3cd;color:#856404">Hoy</span>
          </div>
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px">${qdq.text}</p>
          <div class="dl-qdq-options" id="qdq-opts">
            ${qdq.options.map(o => `
              <button class="dl-qdq-btn" onclick="IIAPP.UI.answerQdq('${o.letter}','${qdq.correct}','${qdq.id}')">
                <span class="dl-opt-letter">${o.letter}</span> ${o.text}
              </button>`).join('')}
          </div>
        </div>` : ''}

        <!-- Acciones rápidas -->
        <div class="dl-actions">
          <button class="dl-action-btn" onclick="IIAPP.UI.startSimulacro()">
            <span class="dl-action-icon">📋</span>
            <span class="dl-action-label">Simulacro<br><small>100 preg · 110 min</small></span>
          </button>
          <button class="dl-action-btn" onclick="IIAPP.UI.startFailedReview()">
            <span class="dl-action-icon">↻</span>
            <span class="dl-action-label">Fallos<br><small>Repasar errores</small></span>
          </button>
          <button class="dl-action-btn" onclick="IIAPP.UI.show('temario')">
            <span class="dl-action-icon">📖</span>
            <span class="dl-action-label">Temario<br><small>+audio</small></span>
          </button>
          <button class="dl-action-btn ${dueCount > 0 ? 'dl-action-highlight' : ''}" onclick="IIAPP.UI.startSrsReview()">
            <span class="dl-action-icon">🧠</span>
            <span class="dl-action-label">Repaso<br><small>${dueCount > 0 ? dueCount + ' pendientes' : 'SRS'}</small></span>
          </button>
        </div>

        <!-- Progreso por bloque (compacto) -->
        <div class="card">
          <div class="card-header">
            <h3>Tu progreso</h3>
            <span class="text-muted small">${g.total} preguntas respondidas</span>
          </div>
          <div class="module-list">
            ${TEMARIO.modules.map(m => {
              const data = modules[m.number];
              const pct = data && data.accuracy != null ? data.accuracy : 0;
              const status = data && data.accuracy != null ? (pct >= 70 ? 'ok' : pct >= 50 ? 'mid' : 'warn') : 'empty';
              return `
                <div class="module-row">
                  <div class="module-row-head">
                    <span class="module-name">${m.shortName}</span>
                    <span class="module-pct ${status}">${data && data.accuracy != null ? fmt(pct, 0) + '%' : '—'}</span>
                  </div>
                  <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${status === 'empty' ? '#e2e8f0' : m.color}"></div></div>
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Foco del día (colapsado) -->
        <details class="card dl-details">
          <summary style="cursor:pointer;padding:4px 0;font-weight:600;color:#003366;list-style:none">
            ▸ Temas prioritarios hoy (IA)
          </summary>
          <div class="foco-list" style="margin-top:12px">
            ${focoMods.map((m, i) => `
              <div class="foco-item">
                <div class="foco-rank">${i + 1}</div>
                <div class="foco-info">
                  <div class="foco-name">T${m.number}: ${m.shortName}</div>
                  <div class="foco-stats">Peso ${Math.round(m.weight * 100)}% · ${m.acc != null ? fmt(m.acc, 0) + '% acierto' : 'sin datos'}</div>
                </div>
                <button class="btn-foco" onclick="IIAPP.UI.startModule(${m.number}, 10)">10 preg.</button>
              </div>`).join('')}
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="IIAPP.UI.startAdaptiveSimulacro()">Simulacro adaptativo</button>
        </details>

      </div>
    `;
  }


  // ========== PANTALLA: STUDY (CONFIGURADOR DE TEST) ==========

  async function renderStudy() {
    const target = $('#screen-study');
    const profile = await Storage.getAllProfile();
    const puestoActual = TEMARIO.getPuesto(profile.puesto);
    target.innerHTML = `
      <div class="container">
        <h1 class="page-title">Configurar test</h1>
        <p class="page-subtitle">Elige modo y opciones. La configuración se recuerda para próximas sesiones.</p>

        <div class="card">
          <h3>Modo</h3>
          <div class="mode-list">
            <label class="mode-option">
              <input type="radio" name="mode" value="weighted" checked>
              <div>
                <div class="mode-title">Mixto ponderado</div>
                <div class="mode-desc">Preguntas de los 12 temas según peso del examen real</div>
              </div>
            </label>
            <label class="mode-option">
              <input type="radio" name="mode" value="module">
              <div>
                <div class="mode-title">Por módulo</div>
                <div class="mode-desc">Solo del módulo que selecciones</div>
              </div>
            </label>
            <label class="mode-option">
              <input type="radio" name="mode" value="failed">
              <div>
                <div class="mode-title">Repaso de fallos</div>
                <div class="mode-desc">Solo preguntas que has fallado anteriormente</div>
              </div>
            </label>
            <label class="mode-option">
              <input type="radio" name="mode" value="srs">
              <div>
                <div class="mode-title">Repaso SRS</div>
                <div class="mode-desc">Preguntas pendientes según algoritmo de espaciado</div>
              </div>
            </label>
            <label class="mode-option">
              <input type="radio" name="mode" value="simulacro">
              <div>
                <div class="mode-title">Simulacro completo</div>
                <div class="mode-desc">Formato real: ${TEMARIO.exam.test.questions} preguntas, ${TEMARIO.exam.test.durationMinutes} min, ${TEMARIO.exam.test.penalty ? 'con' : 'sin'} penalización. Umbral para <b>${puestoActual.nombreCorto}</b>: <b>${puestoActual.aciertos} aciertos</b></div>
              </div>
            </label>
          </div>
        </div>

        <div class="card" id="module-selector" style="display:none">
          <h3>Módulo</h3>
          <div class="module-chips">
            ${TEMARIO.modules.map(m => `
              <label class="chip">
                <input type="radio" name="moduleNum" value="${m.number}">
                <span>M${m.number}: ${m.shortName}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="card" id="num-selector">
          <h3>Número de preguntas</h3>
          <div class="num-buttons">
            <label><input type="radio" name="num" value="10"><span>10</span></label>
            <label><input type="radio" name="num" value="25" checked><span>25</span></label>
            <label><input type="radio" name="num" value="50"><span>50</span></label>
            <label><input type="radio" name="num" value="100"><span>100</span></label>
          </div>
        </div>

        <div class="card">
          <h3>Opciones</h3>
          <label class="check-row">
            <input type="checkbox" id="opt-penalty">
            <div>
              <div>Penalización por error</div>
              <div class="text-muted small">Correos: NO hay penalización en el examen real. Déjalo desactivado para simular el examen.</div>
            </div>
          </label>
          <label class="check-row">
            <input type="checkbox" id="opt-shuffle" checked>
            <div>
              <div>Mezclar opciones A/B/C/D</div>
              <div class="text-muted small">Evita memorizar la posición</div>
            </div>
          </label>
          <label class="check-row">
            <input type="checkbox" id="opt-instant" checked>
            <div>
              <div>Feedback inmediato</div>
              <div class="text-muted small">Ver resultado y explicación tras cada respuesta</div>
            </div>
          </label>
        </div>

        <button class="btn btn-primary btn-large btn-block" onclick="IIAPP.UI.startCustom()">
          Empezar test
        </button>
      </div>
    `;

    // Mostrar/ocultar selector de módulo según modo
    target.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', e => {
        const showModule = e.target.value === 'module';
        $('#module-selector').style.display = showModule ? 'block' : 'none';
        const isSimulacro = e.target.value === 'simulacro';
        $('#num-selector').style.display = isSimulacro ? 'none' : 'block';
        if (isSimulacro) {
          $('#opt-penalty').checked = !!TEMARIO.exam.test.penalty;  // false en Correos
          $('#opt-instant').checked = false;
        }
      });
    });
  }

  // ========== PANTALLA: TEST ==========

  async function startTest(config) {
    // Comprueba límite del plan gratuito (200 preguntas)
    const profileTest = await Storage.getAllProfile();
    const planTest = profileTest.plan || 'free';
    if (planTest === 'free') {
      const statsTest = await Stats.global();
      if (statsTest.total >= 200) {
        showPaywall();
        return;
      }
    }

    let pool = [];
    const num = config.num || 10;

    switch (config.mode) {
      case 'weighted': pool = Data.weighted(num); break;
      case 'module': pool = Data.fromModules([config.moduleNum], num); break;
      case 'failed': pool = await Data.fromFailed(num); break;
      case 'srs': pool = await Data.fromSrsDue(num); break;
      case 'simulacro': pool = Data.simulacro(); break;
      case 'adaptativo': pool = await Data.simulacroAdaptivo(); break;
      default: pool = Data.weighted(num);
    }

    if (pool.length === 0) {
      alert(config.mode === 'failed'
        ? 'No tienes preguntas falladas todavía. Haz algunos tests primero.'
        : config.mode === 'srs'
          ? 'No hay preguntas pendientes en el SRS. Vuelve mañana.'
          : 'No hay preguntas disponibles para esta selección.');
      return;
    }

    if (config.shuffle) {
      pool = pool.map(q => Data.shuffleOptions(q));
    }

    App.test = {
      sessionId: uuid(),
      mode: config.mode,
      questions: pool,
      currentIndex: 0,
      answers: [],
      penalty: config.penalty,
      instant: config.instant,
      shuffle: config.shuffle,
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      timeLimit: config.mode === 'simulacro' ? (TEMARIO.exam.test.durationMinutes || 110) * 60 : null,
      finished: false
    };

    show('test');
    renderQuestion();
    startTimer();
  }

  function startTimer() {
    if (App.timerInterval) clearInterval(App.timerInterval);
    App.timerInterval = setInterval(() => {
      if (!App.test || App.test.finished) return;
      const elapsed = Math.floor((Date.now() - App.test.startedAt) / 1000);
      const remaining = App.test.timeLimit ? App.test.timeLimit - elapsed : null;
      const timerEl = $('#test-timer');
      if (!timerEl) return;
      if (remaining != null) {
        if (remaining <= 0) {
          finishTest();
          return;
        }
        timerEl.textContent = fmtTime(remaining);
        if (remaining < 60) timerEl.classList.add('timer-warn');
      } else {
        timerEl.textContent = fmtTime(elapsed);
      }
    }, 1000);
  }

  function renderQuestion() {
    const t = App.test;
    if (!t) return;
    const q = t.questions[t.currentIndex];
    const total = t.questions.length;
    const isLast = t.currentIndex === total - 1;
    const target = $('#screen-test');

    target.innerHTML = `
      <div class="test-shell">
        <div class="test-header">
          <button class="btn-link" onclick="IIAPP.UI.confirmExit()">◀ Salir</button>
          <div class="test-progress-text">Pregunta ${t.currentIndex + 1} / ${total}</div>
          <div id="test-timer" class="test-timer">00:00</div>
        </div>

        <div class="progress-bar"><div class="progress-fill" style="width:${((t.currentIndex + 1) / total) * 100}%"></div></div>

        <div class="question-card">
          <div class="question-tags">
            <span class="tag">M${q.module}: ${TEMARIO.modules[q.module - 1].shortName}</span>
            <span class="tag tag-light">Tema ${q.topic}</span>
            ${q.difficulty === 3 ? '<span class="tag tag-warn">Difícil</span>' : ''}
          </div>
          <h2 class="question-text">${q.text}</h2>
          <div id="options" class="options-list"></div>
        </div>

        <div id="feedback" class="feedback-area hidden"></div>

        <div class="test-footer">
          <div class="counters">
            <span class="counter-ok">✓ <span id="cnt-ok">${t.answers.filter(a => a.isCorrect).length}</span></span>
            <span class="counter-err">✗ <span id="cnt-err">${t.answers.filter(a => !a.isCorrect && a.given).length}</span></span>
          </div>
          <button id="next-btn" class="btn btn-primary hidden" onclick="IIAPP.UI.nextQuestion()">${isLast ? 'Ver resultado →' : 'Siguiente →'}</button>
          ${!t.instant ? `<button id="skip-btn" class="btn btn-primary" onclick="IIAPP.UI.skipNoFeedback()">${isLast ? 'Finalizar →' : 'Siguiente →'}</button>` : ''}
        </div>
      </div>
    `;

    const optsEl = $('#options');
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.letter = opt.letter;
      btn.innerHTML = `
        <span class="option-letter">${opt.letter}</span>
        <span class="option-text">${opt.text}</span>
      `;
      btn.onclick = () => answerQuestion(opt.letter);
      optsEl.appendChild(btn);
    });

    App.test.questionStartedAt = Date.now();
  }

  async function answerQuestion(letter) {
    const t = App.test;
    if (!t) return;
    const q = t.questions[t.currentIndex];
    const isCorrect = letter === q.correct;
    const timeSpent = Math.floor((Date.now() - t.questionStartedAt) / 1000);

    t.answers.push({
      questionId: q.id,
      given: letter,
      correct: q.correct,
      isCorrect,
      timeSpentSeconds: timeSpent
    });

    if (t.instant) {
      // Marcar opciones visualmente
      $$('.option-btn').forEach(btn => {
        btn.disabled = true;
        const l = btn.dataset.letter;
        if (l === q.correct) btn.classList.add('option-correct');
        else if (l === letter) btn.classList.add('option-wrong');
        else btn.classList.add('option-faded');
      });

      // Actualizar contadores
      $('#cnt-ok').textContent = t.answers.filter(a => a.isCorrect).length;
      $('#cnt-err').textContent = t.answers.filter(a => !a.isCorrect && a.given).length;

      // Mostrar feedback
      setTimeout(() => showFeedback(q, isCorrect, letter), 300);
    } else {
      // Modo simulacro: avanzar inmediatamente
      setTimeout(() => nextQuestion(), 80);
    }
  }

  function showFeedback(q, isCorrect, given) {
    const fb = $('#feedback');
    const originalLetter = q.options.find(o => o.letter === given)?.originalLetter || given;

    // Explicación dinámica basada en la pregunta YA MEZCLADA
    // (las letras cambian con el shuffle, no podemos usar las del archivo estático)
    const correctOpt = q.options.find(o => o.letter === q.correct);
    const correctOptText = correctOpt ? correctOpt.text : q.correct;

    // Contexto adicional del archivo explanations.js — eliminamos la parte de la letra
    // porque fue generada con el orden original del PDF, no con el orden mezclado
    const EXP = (window.CORREOS && window.CORREOS.EXPLANATIONS) || {};
    const expData = EXP[q.id] || {};
    const staticExp = (q.explanation || expData.explanation || '');
    // Quitar el prefijo "La respuesta correcta es la X) «...» —" si existe
    const extraCtx = staticExp.replace(/^La respuesta correcta es la [A-D]\)\s*«[^»]*»\s*[—-]?\s*/i, '').trim();

    const explanationText = `<strong>${q.correct}) ${esc(correctOptText)}</strong>${extraCtx ? ` — ${extraCtx}` : ''}`;

    const falloText = (q.iaFallo && q.iaFallo[originalLetter])
      || (expData.fallo && expData.fallo[originalLetter]) || '';

    let iaBlock = '';
    if (!isCorrect && falloText) {
      iaBlock = `
        <div class="fb-card fb-ia">
          <div class="fb-tag">Por qué tu respuesta es incorrecta</div>
          <p>${falloText}</p>
        </div>
      `;
    }

    const mod = TEMARIO.modules.find(m => m.number === q.module);
    const temarioBlock = mod ? `
      <div class="fb-card fb-temario">
        <div class="fb-tag">📖 Tema ${mod.number}: ${mod.shortName}</div>
        <button class="btn-tema-link" style="margin-top:8px" onclick="IIAPP.UI.showTema(${mod.number})">Abrir en el temario →</button>
      </div>` : '';

    fb.classList.remove('hidden');
    fb.innerHTML = `
      <div class="fb-card ${isCorrect ? 'fb-ok' : 'fb-err'}">
        <div class="fb-title">${isCorrect
          ? ['🎉 ¡Correcto!', '⭐ ¡Exacto!', '🔥 ¡Ahí está!', '💪 ¡Lo sabías!', '✅ ¡Bien!'][Math.floor(Math.random()*5)]
          : ['😅 No era esa…', '📬 ¡Casi!', '😬 ¡Uy!', '📮 A repasar este', '💡 Ahora ya lo sabes', '🙈 ¡La próxima!'][Math.floor(Math.random()*6)]
        }</div>
        ${explanationText ? `<p>${explanationText}</p>` : ''}
      </div>
      ${iaBlock}
      ${temarioBlock}
    `;

    $('#next-btn').classList.remove('hidden');
  }

  async function nextQuestion() {
    const t = App.test;
    if (!t) return;
    t.currentIndex++;
    if (t.currentIndex >= t.questions.length) {
      await finishTest();
    } else {
      renderQuestion();
    }
  }

  async function finishTest() {
    const t = App.test;
    if (!t || t.finished) return;
    t.finished = true;
    if (App.timerInterval) clearInterval(App.timerInterval);

    const correct = t.answers.filter(a => a.isCorrect).length;
    const incorrect = t.answers.filter(a => !a.isCorrect && a.given).length;
    const unanswered = t.questions.length - t.answers.length;
    const duration = Math.floor((Date.now() - t.startedAt) / 1000);

    // Cálculo de nota con o sin penalización
    let rawScore = correct;
    if (t.penalty) rawScore = correct - (incorrect / 3);
    const score = Math.max(0, (rawScore / t.questions.length) * 10);

    const session = {
      id: t.sessionId,
      mode: t.mode,
      questionsCount: t.questions.length,
      correctCount: correct,
      incorrectCount: incorrect,
      unansweredCount: unanswered,
      score: Math.round(score * 100) / 100,
      penalty: t.penalty,
      durationSeconds: duration,
      startedAt: t.startedAt,
      finishedAt: Date.now()
    };

    try {
      await Storage.saveSession(session);
    } catch (err) {
      console.error('Error guardando sesión', err);
    }

    // Persistir respuestas y actualizar SRS — un fallo aislado no debe
    // bloquear que el usuario vea su resultado.
    for (const a of t.answers) {
      try {
        await Storage.saveAnswer({
          sessionId: t.sessionId,
          questionId: a.questionId,
          given: a.given,
          correct: a.correct,
          isCorrect: a.isCorrect,
          timeSpentSeconds: a.timeSpentSeconds,
          answeredAt: nowIso()
        });
      } catch (err) {
        console.error('Error guardando respuesta', a.questionId, err);
      }
      try {
        const quickness = a.timeSpentSeconds < 15 ? 'fast' : 'normal';
        await SRS.record(a.questionId, a.isCorrect, quickness);
      } catch (err) {
        console.error('Error actualizando SRS', a.questionId, err);
      }
    }

    App.test = null;
    show('result', { sessionId: session.id });
  }

  // ========== PANTALLA: RESULTADO ==========

  async function renderResult(sessionId) {
    const target = $('#screen-result');
    const session = await Storage.getSession(sessionId);
    if (!session) {
      target.innerHTML = '<div class="container"><p>Sesión no encontrada.</p></div>';
      return;
    }

    const answers = await Storage.getAnswersBySession(sessionId);
    const profileRes = await Storage.getAllProfile();
    const puestoRes = TEMARIO.getPuesto(profileRes.puesto);
    const corte = puestoRes.umbral;
    const vsCorte = session.score - corte;
    const prediction = await Stats.predictApproval();
    const sessionXP = session.correctCount * 10 + session.incorrectCount * 3;
    const totalXP = await Stats.getXP();
    const sessionLevel = Stats.xpToLevel(totalXP);

    // Desglose por módulo de esta sesión
    const moduleStats = {};
    answers.forEach(a => {
      const q = window.IIAPP.QUESTION_BY_ID[a.questionId];
      if (!q) return;
      if (!moduleStats[q.module]) moduleStats[q.module] = { ok: 0, total: 0 };
      moduleStats[q.module].total += 1;
      if (a.isCorrect) moduleStats[q.module].ok += 1;
    });

    target.innerHTML = `
      <div class="container">
        <div class="result-head">
          <h1 class="page-title">Resultado</h1>
          <p class="page-subtitle">${session.questionsCount} preguntas · ${fmtTime(session.durationSeconds)} · ${{
            weighted: 'mixto', module: 'por módulo', failed: 'repaso de fallos',
            srs: 'repaso SRS', simulacro: 'simulacro', adaptativo: 'simulacro adaptativo'
          }[session.mode]}</p>
        </div>

        <div class="card score-card">
          <div class="score-label">TU NOTA</div>
          <div class="score-value">${fmt(session.score, 1)}<span class="score-max">/10</span></div>
          <div class="score-vs ${vsCorte >= 0 ? 'ok' : 'warn'}">
            ${vsCorte >= 0
              ? `Por encima del umbral de aprobado (${fmt(corte, 1)}/10)`
              : `${fmt(Math.abs(vsCorte), 1)} puntos por debajo del umbral de aprobado (${fmt(corte, 1)}/10)`}
          </div>
          <div class="score-counts">
            <span class="ok">✓ ${session.correctCount} correctas</span>
            <span class="err">✗ ${session.incorrectCount} fallos</span>
            ${session.unansweredCount ? `<span class="muted">○ ${session.unansweredCount} sin contestar</span>` : ''}
            ${session.penalty ? '<span class="muted small">con penalización −1/3</span>' : ''}
          </div>
          <div class="xp-gained">+${sessionXP} XP · ${sessionLevel.emoji} ${sessionLevel.name}</div>
        </div>

        ${prediction.probability != null ? `
          <div class="card prediction-card">
            <div class="card-header">
              <h3>Predicción de aprobado actualizada</h3>
            </div>
            <div class="prediction-num">${prediction.probability}%</div>
            <p class="text-muted">${prediction.message}</p>
          </div>
        ` : ''}

        <div class="card">
          <div class="card-header"><h3>Tu rendimiento por bloque</h3></div>
          <div class="module-list">
            ${TEMARIO.modules.filter(m => moduleStats[m.number]).map(m => {
              const d = moduleStats[m.number];
              const pct = (d.ok / d.total) * 100;
              const status = pct >= 70 ? 'ok' : pct >= 50 ? 'mid' : 'warn';
              return `
                <div class="module-row">
                  <div class="module-row-head">
                    <span class="module-name">${m.shortName}</span>
                    <span class="module-pct ${status}">${fmt(pct, 0)}% <span class="text-muted">(${d.ok}/${d.total})</span></span>
                  </div>
                  <div class="bar"><div class="bar-fill" style="width:${pct}%; background:${m.color}"></div></div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${(() => {
          const wrongs = answers.filter(a => !a.isCorrect);
          if (!wrongs.length) return '';
          const items = wrongs.slice(0, 25).map(a => {
            const q = window.IIAPP.QUESTION_BY_ID[a.questionId];
            if (!q) return '';
            const mod = TEMARIO.modules.find(m => m.number === q.module);
            const correctOpt = q.options ? q.options.find(o => o.letter === q.correct) : null;
            const correctText = correctOpt ? correctOpt.text : q.correct;
            return `
              <div class="wrong-item">
                <div class="wrong-q">${q.text}</div>
                <div class="wrong-correct">Correcta: ${q.correct}) ${correctText}</div>
                ${mod ? `<button class="btn-tema-link" onclick="IIAPP.UI.showTema(${mod.number})">Estudiar → Tema ${mod.number}: ${mod.shortName}</button>` : ''}
              </div>`;
          }).join('');
          const extra = wrongs.length > 25 ? `<p class="text-muted" style="padding:8px 16px;font-size:13px">+ ${wrongs.length - 25} fallos más</p>` : '';
          return `
          <div class="card">
            <div class="card-header">
              <h3>Preguntas falladas (${wrongs.length})</h3>
              <p class="text-muted" style="font-size:13px;margin:4px 0 0">Estudia el tema para cada fallo y vuelve a repasar</p>
            </div>
            <div class="wrong-list">${items}${extra}</div>
          </div>`;
        })()}

        <div class="actions-row">
          <button class="btn btn-secondary" onclick="IIAPP.UI.show('home')">Volver al inicio</button>
          <button class="btn btn-primary" onclick="IIAPP.UI.startFailedReview()">Repasar fallos</button>
        </div>
      </div>
    `;
  }

  // ========== PANTALLA: HISTÓRICO ==========

  async function renderHistory() {
    const target = $('#screen-history');
    const sessions = (await Storage.getAllSessions())
      .filter(s => s.finishedAt)
      .sort((a, b) => b.finishedAt - a.finishedAt);
    const g = await Stats.global();
    const profileHist = await Storage.getAllProfile();
    const puestoHist = TEMARIO.getPuesto(profileHist.puesto);
    const umbralhist = puestoHist.umbral;

    target.innerHTML = `
      <div class="container">
        <h1 class="page-title">Historial</h1>
        <p class="page-subtitle">Todas tus sesiones completadas</p>

        <div class="cards-grid">
          <div class="metric-card">
            <div class="metric-label">Total preguntas</div>
            <div class="metric-value">${g.total}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">% acierto global</div>
            <div class="metric-value">${g.total ? fmt(g.accuracy, 0) + '%' : '—'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Sesiones</div>
            <div class="metric-value">${g.sessions}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Tiempo total</div>
            <div class="metric-value">${Math.floor(g.timeSpentSeconds / 60)} min</div>
          </div>
        </div>

        ${sessions.length === 0 ? `
          <div class="empty-state">
            <p>Todavía no has completado ninguna sesión.</p>
            <button class="btn btn-primary" onclick="IIAPP.UI.startQuick(10)">Empezar primer test</button>
          </div>
        ` : `
          <div class="card">
            <div class="card-header"><h3>Sesiones (${sessions.length})</h3></div>
            <div class="session-list">
              ${sessions.map(s => `
                <div class="session-row">
                  <div class="session-meta">
                    <div class="session-mode">${{
                      weighted: 'Mixto', module: 'Por módulo', failed: 'Repaso fallos',
                      srs: 'SRS', simulacro: '⏱ Simulacro', adaptativo: '⏱ Adaptativo'
                    }[s.mode] || s.mode}</div>
                    <div class="session-date">${new Date(s.finishedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</div>
                  </div>
                  <div class="session-stats">
                    <div class="session-score ${s.score >= umbralhist ? 'ok' : 'warn'}">${fmt(s.score, 1)}</div>
                    <div class="session-detail">${s.correctCount}/${s.questionsCount} · ${fmtTime(s.durationSeconds)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `}
      </div>
    `;
  }

  // ========== REPRODUCTOR DE AUDIO ==========

  const TTS = {
    audio: null,
    utterance: null, // alias para compatibilidad con comprobaciones existentes
    currentNum: null,

    play(num, _html, onEnd) {
      this.stop();
      const src = `audio/tema-${String(num).padStart(2, '0')}.mp3`;
      const a = new Audio(src);
      a.onended = () => {
        this.utterance = null;
        this.audio = null;
        this.currentNum = null;
        if (onEnd) onEnd();
      };
      a.onerror = () => console.warn('Audio no disponible:', src);
      a.play().catch(() => {});
      this.audio = a;
      this.utterance = a; // para que los checks de !TTS.utterance funcionen
      this.currentNum = num;
      this._updateBar(num, false);
    },

    pause() {
      if (this.audio) { this.audio.pause(); this._updateBar(this.currentNum, true); }
    },

    resume() {
      if (this.audio) { this.audio.play().catch(() => {}); this._updateBar(this.currentNum, false); }
    },

    stop() {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
      this.audio = null;
      this.utterance = null;
      this.currentNum = null;
      this._updateBar(null, false);
    },

    _updateBar(num, paused) {
      const bar = document.getElementById('audio-player-bar');
      if (!bar) return;
      if (!num) { bar.style.display = 'none'; return; }
      bar.style.display = 'flex';
      const mod = TEMARIO.modules.find(m => m.number === num);
      const nameEl = bar.querySelector('.ap-name');
      if (nameEl) nameEl.textContent = mod ? `T${num}: ${mod.shortName}` : `Tema ${num}`;
      const btn = bar.querySelector('.ap-playpause');
      if (btn) btn.textContent = paused ? '▶' : '⏸';
    }
  };

  // ========== PANTALLA: TEMARIO ==========

  let _temaActivo = 1;

  async function renderTemario() {
    const target = $('#screen-temario');
    const CONTENT = window.CORREOS.TEMARIO_CONTENT || {};
    const modulos = TEMARIO.modules;

    const navBtns = modulos.map(m => `
      <button class="tema-btn ${m.number === _temaActivo ? 'active' : ''}"
        onclick="IIAPP.UI.showTema(${m.number})">
        T${m.number}: ${m.shortName}
      </button>
    `).join('');

    const modulo = modulos.find(m => m.number === _temaActivo);
    const contenido = CONTENT[_temaActivo] || '<p class="text-muted">Contenido pendiente de cargar.</p>';

    const legislacionBadges = (modulo?.legislacion || []).map(l =>
      `<span class="legislacion-badge">📋 ${l}</span>`
    ).join('');

    target.innerHTML = `
      <div class="container">
        <div class="page-head-row no-print">
          <div>
            <h1 class="page-title">Temario oficial</h1>
            <p class="page-subtitle">12 temas · Basado en la convocatoria oficial y la legislación vigente</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary no-print" onclick="IIAPP.UI.playTema(${_temaActivo})">▶ Escuchar</button>
            <button class="btn btn-secondary no-print" onclick="window.print()">Imprimir tema</button>
            <button class="btn btn-secondary no-print" onclick="IIAPP.UI.printTemarioCompleto()">PDF completo</button>
          </div>
        </div>

        <!-- Barra de audio (oculta hasta que se pulse Escuchar) -->
        <div id="audio-player-bar" class="audio-bar no-print" style="display:none">
          <span class="ap-name">—</span>
          <div class="ap-controls">
            <button class="ap-btn ap-playpause" onclick="IIAPP.UI.toggleTema()">⏸</button>
            <button class="ap-btn" onclick="IIAPP.UI.stopTema()">⏹</button>
          </div>
          <audio id="audio-progress" style="display:none"></audio>
        </div>

        <div class="temario-nav no-print">${navBtns}</div>

        ${legislacionBadges ? `<div style="margin-bottom: 16px;" class="no-print">${legislacionBadges}</div>` : ''}

        <div class="tema-content">${contenido}</div>
      </div>
    `;
  }

  // ========== PANTALLA: PLANES ==========

  const PLAN_CATALOG = {
    free: {
      id: 'free', name: 'Gratis', price: 0, priceLabel: '0 €',
      tag: 'Empieza aquí', recommended: false,
      features: [
        '5 minutos al día — modo hábito diario',
        '200 preguntas de exámenes oficiales Correos',
        'Pregunta del día',
        'Temario de los 12 temas con mnemotécnicos',
        'Estadísticas básicas y racha',
      ],
    },
    completo: {
      id: 'completo', name: 'Acceso completo', price: 14.99, priceLabel: '14,99 €',
      tag: 'Recomendado', recommended: true, monthly: 'pago único · sin renovación',
      features: [
        'Banco completo de preguntas sin límite',
        'Simulacros ilimitados (100 preg · 110 min)',
        'Simulacro adaptativo: más preguntas en tus temas flojos',
        'Repaso espaciado SRS — memoriza sin esfuerzo',
        'Predicción de aprobado por puesto (Reparto, Clasificación…)',
        'Estadísticas completas, historial y XP ilimitado',
        'Funciona sin conexión · Instálala en tu móvil',
      ],
    },
    premium: {
      id: 'premium', name: 'Premium + Audio', price: 24.99, priceLabel: '24,99 €',
      tag: 'Con audio', recommended: false, monthly: 'pago único · sin renovación',
      features: [
        'Todo lo del plan Acceso completo',
        'Audio del temario completo (escucha mientras conduces o paseas)',
        'Plan de estudio personalizado por puesto',
        'Análisis semanal de puntos débiles por email',
        'Soporte prioritario',
      ],
      compare: 'Las academias cobran 300–1.500 € por la misma preparación',
    },
  };

  async function renderPlanes() {
    const target = $('#screen-planes');
    const profile = await Storage.getAllProfile();
    const current = profile.plan || 'free';

    const cards = ['free', 'completo', 'premium'].map(id => {
      const p = PLAN_CATALOG[id];
      const isCurrent = id === current;
      const monthly = p.monthly ? `<span class="plan-monthly">o ${p.monthly}</span>` : '';
      const tag = p.tag ? `<span class="plan-tag ${p.recommended ? 'plan-tag-rec' : ''}">${p.tag}</span>` : '';
      const compare = p.compare ? `<p class="plan-compare">${p.compare}</p>` : '';

      return `
        <div class="plan-card ${p.recommended ? 'plan-recommended' : ''} ${isCurrent ? 'plan-current' : ''}">
          <div class="plan-head">
            <h3>${p.name}</h3>
            ${tag}
          </div>
          <div class="plan-price">${p.priceLabel}</div>
          ${monthly}
          ${compare}
          <ul class="plan-features">
            ${p.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
          ${isCurrent
            ? `<button class="btn btn-secondary" disabled>Tu plan actual</button>`
            : id === 'free'
              ? ''
              : `<button class="btn ${p.recommended ? 'btn-primary' : 'btn-secondary'}" onclick="IIAPP.UI.startUpgrade('${id}')">${current === 'free' ? 'Activar' : 'Cambiar a'} ${p.name}</button>`}
        </div>
      `;
    }).join('');

    target.innerHTML = `
      <div class="container">
        <h1 class="page-title">Planes</h1>
        <p class="page-subtitle">Prepárate para Correos sin gastarte cientos de euros en academias. Pago único hasta el examen, sin renovación automática.</p>

        <div class="plans-grid">${cards}</div>

        <div class="card info-card">
          <h3>Cómo funciona el pago</h3>
          <p>El pago se hace una sola vez con tarjeta, Apple Pay, Google Pay o Bizum. Te da acceso completo a la app hasta la fecha del examen de la convocatoria 2026.</p>
          <p class="text-muted small">Sin suscripciones que se renuevan a tus espaldas. Si suspendes y hay una siguiente convocatoria, te haces otro acceso.</p>
        </div>

        <div class="card">
          <h3>Comparativa rápida</h3>
          <div class="compare-table">
            <div class="compare-row compare-head">
              <span></span><span>Gratuito</span><span>Acceso</span><span>Premium</span>
            </div>
            ${[
              ['Banco de preguntas sin límite', '−', '✓', '✓'],
              ['Simulacros ilimitados', '1/sem', '✓', '✓'],
              ['Simulacro adaptativo', '−', '✓', '✓'],
              ['Repaso espaciado (SRS)', '−', '✓', '✓'],
              ['Predicción de aprobado', '−', '✓', '✓'],
              ['Estadísticas por tema', '−', '✓', '✓'],
              ['Funciona sin conexión', '✓', '✓', '✓'],
              ['Audio del temario', '−', '−', '✓'],
              ['Plan personalizado por puesto', '−', '−', '✓'],
              ['Soporte por email', '✓', '✓', 'Prioritario'],
            ].map(row => `
              <div class="compare-row">
                <span class="compare-feat">${row[0]}</span>
                ${row.slice(1).map(c => `<span class="compare-cell ${c === '✓' ? 'compare-yes' : c === '−' ? 'compare-no' : ''}">${c}</span>`).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ========== PANTALLA: CUENTA ==========

  async function renderCuenta() {
    const target = $('#screen-cuenta');
    const profile = await Storage.getAllProfile();
    const g = await Stats.global();
    const current = profile.plan || 'free';
    const planInfo = PLAN_CATALOG[current];

    const isRegistered = profile.email && profile.name;
    const memberSince = profile.registeredAt
      ? new Date(profile.registeredAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const expires = profile.planExpires
      ? new Date(profile.planExpires).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

    target.innerHTML = `
      <div class="container">
        <h1 class="page-title">Mi cuenta</h1>

        ${!isRegistered ? `
          <div class="card info-card">
            <h3>Bienvenido</h3>
            <p>Aún no has completado tu registro. Rellena tus datos para poder activar un plan, sincronizar entre dispositivos y recibir tu plan personalizado por email.</p>
          </div>
        ` : ''}

        <div class="card">
          <h3>Datos personales</h3>
          <label class="form-row">
            <span>Nombre</span>
            <input type="text" id="cuenta-name" value="${esc(profile.name || '')}" placeholder="Tu nombre" maxlength="60">
          </label>
          <label class="form-row">
            <span>Email</span>
            <input type="email" id="cuenta-email" value="${esc(profile.email || '')}" placeholder="tu@email.com" maxlength="120">
          </label>
          <label class="form-row">
            <span>Alias en ranking</span>
            <input type="text" id="cuenta-alias" value="${esc(profile.alias || '')}" placeholder="Sin alias" maxlength="20">
          </label>
          <button class="btn btn-primary" onclick="IIAPP.UI.saveCuenta()">Guardar datos</button>
        </div>

        <div class="card">
          <h3>Plan actual</h3>
          <div class="plan-status">
            <div>
              <div class="plan-status-name plan-tag-${current}">${planInfo.name}${planInfo.tag ? ' · ' + planInfo.tag : ''}</div>
              <div class="text-muted small">
                Miembro desde ${memberSince}${expires ? ' · Renovación el ' + expires : ''}
              </div>
            </div>
            <div class="plan-status-price">${planInfo.priceLabel}</div>
          </div>
          <p class="text-muted small">${planInfo.features.slice(0, 3).join(' · ')}${planInfo.features.length > 3 ? '...' : ''}</p>
          <div class="actions-row">
            ${current === 'free' ? `
              <button class="btn btn-primary" onclick="IIAPP.UI.show('planes')">Ver el acceso completo</button>
            ` : current === 'premium' ? `
              <button class="btn btn-secondary" onclick="IIAPP.UI.show('planes')">Ver planes</button>
            ` : `
              <button class="btn btn-primary" onclick="IIAPP.UI.show('planes')">Ver Premium</button>
            `}
          </div>
        </div>

        <div class="card">
          <h3>Tu actividad</h3>
          <div class="cards-grid">
            <div class="metric-card">
              <div class="metric-label">Total respuestas</div>
              <div class="metric-value">${g.total}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">% acierto global</div>
              <div class="metric-value">${g.total ? fmt(g.accuracy, 0) + '%' : '—'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Sesiones</div>
              <div class="metric-value">${g.sessions}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Examen previsto</div>
              <div class="metric-value small">${profile.examDate || '—'}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>¿A qué puesto te presentas?</h3>
          <p class="text-muted small">El temario y el examen son los mismos para los 4 puestos, pero el número de aciertos para aprobar cambia.</p>
          <div class="puesto-list">
            ${TEMARIO.exam.puestos.map(p => `
              <label class="puesto-row ${(profile.puesto || TEMARIO.exam.puestoDefault) === p.id ? 'puesto-selected' : ''}">
                <input type="radio" name="puesto" value="${p.id}" ${(profile.puesto || TEMARIO.exam.puestoDefault) === p.id ? 'checked' : ''} onchange="IIAPP.UI.setPuesto('${p.id}')">
                <div class="puesto-info">
                  <div class="puesto-nombre">${p.nombre}</div>
                  <div class="text-muted small">${p.descripcion} · Aprueba con <b>${p.aciertos} aciertos</b></div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <h3>Datos del examen</h3>
          <label class="form-row">
            <span>Fecha del examen</span>
            <input type="date" id="cuenta-exam-date" value="${profile.examDate || ''}">
          </label>
          <label class="form-row">
            <span>Horas de estudio al día</span>
            <input type="number" id="cuenta-hours" value="${profile.hoursDay || ''}" min="0" max="12" placeholder="ej. 3">
          </label>
          <button class="btn btn-secondary" onclick="IIAPP.UI.saveCuenta()">Guardar</button>
        </div>

        <div class="card">
          <h3>Preferencias</h3>
          <label class="check-row">
            <input type="checkbox" id="pref-dark" ${profile.darkMode ? 'checked' : ''} onchange="IIAPP.UI.toggleDarkMode(this.checked)">
            <div>
              <div>Modo oscuro</div>
              <div class="text-muted small">Reduce el contraste para sesiones largas de estudio</div>
            </div>
          </label>
          <label class="check-row">
            <input type="checkbox" id="pref-penalty" ${profile.defaultPenalty ? 'checked' : ''} onchange="IIAPP.UI.setPref('defaultPenalty', this.checked)">
            <div>
              <div>Penalización por defecto en tests</div>
              <div class="text-muted small">En Correos el examen real NO penaliza. Déjalo desactivado para simular el examen.</div>
            </div>
          </label>
          <label class="check-row">
            <input type="checkbox" id="pref-shuffle" ${profile.defaultShuffle !== false ? 'checked' : ''} onchange="IIAPP.UI.setPref('defaultShuffle', this.checked)">
            <div>
              <div>Mezclar opciones de respuesta</div>
              <div class="text-muted small">Cambia el orden de A/B/C/D para evitar memorización posicional</div>
            </div>
          </label>
          <label class="check-row">
            <input type="checkbox" id="pref-notif" ${profile.notifications ? 'checked' : ''} onchange="IIAPP.UI.setPref('notifications', this.checked)">
            <div>
              <div>Recordatorios diarios</div>
              <div class="text-muted small">Notificación a tu hora habitual de estudio</div>
            </div>
          </label>
          <label class="form-row">
            <span>Hora del recordatorio</span>
            <input type="time" id="pref-notif-hour" value="${profile.notificationHour || '19:00'}" onchange="IIAPP.UI.setPref('notificationHour', this.value)">
          </label>
          <label class="form-row">
            <span>Idioma de la interfaz</span>
            <select id="pref-lang" disabled>
              <option>Español (única opción)</option>
            </select>
          </label>
        </div>
      </div>
    `;
  }

  // ========== PANTALLA: SETTINGS ==========

  async function renderSettings() {
    const target = $('#screen-settings');
    const profile = await Storage.getAllProfile();
    const g = await Stats.global();
    const learned = await SRS.countLearned();

    target.innerHTML = `
      <div class="container">
        <h1 class="page-title">Ajustes</h1>

        <div class="card">
          <h3>Perfil</h3>
          <label class="form-row">
            <span>Alias para el ranking</span>
            <input type="text" id="alias-input" value="${esc(profile.alias || '')}" placeholder="Sin alias" maxlength="20">
          </label>
          <label class="form-row">
            <span>Fecha del examen</span>
            <input type="date" id="exam-date" value="${profile.examDate || ''}">
          </label>
          <label class="form-row">
            <span>Horas de estudio al día</span>
            <input type="number" id="hours-day" value="${profile.hoursDay || ''}" min="0" max="12" placeholder="ej. 3">
          </label>
          <button class="btn btn-primary" onclick="IIAPP.UI.saveProfile()">Guardar</button>
        </div>

        <div class="card">
          <h3>Apariencia</h3>
          <label class="check-row">
            <input type="checkbox" id="opt-darkmode" ${profile.darkMode ? 'checked' : ''} onchange="IIAPP.UI.toggleDarkMode(this.checked)">
            <div>Modo oscuro</div>
          </label>
        </div>

        <div class="card">
          <h3>Privacidad y tus datos</h3>
          <p class="text-muted small" style="margin-bottom:12px">
            Todos tus datos se guardan <strong>únicamente en este dispositivo</strong>.
            No se envían a ningún servidor. ${g.total} respuestas · ${g.sessions} sesiones · ${learned} preguntas en SRS.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px">
              <div>
                <div style="font-weight:600;font-size:14px">Exportar mis datos</div>
                <div class="text-muted small">Derecho de acceso y portabilidad (art. 15 y 20 RGPD)</div>
              </div>
              <button class="btn btn-secondary" onclick="IIAPP.Storage.exportAll()">Exportar JSON</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f8fafc;border-radius:8px">
              <div>
                <div style="font-weight:600;font-size:14px">Importar backup</div>
                <div class="text-muted small">Restaura tu progreso en un nuevo dispositivo</div>
              </div>
              <label class="btn btn-secondary" style="cursor:pointer">
                Importar
                <input type="file" accept=".json" onchange="IIAPP.UI.importBackup(event)" style="display:none">
              </label>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fff5f5;border-radius:8px;border:1px solid #fecaca">
              <div>
                <div style="font-weight:600;font-size:14px;color:#dc2626">Borrar todos mis datos</div>
                <div class="text-muted small">Derecho de supresión (art. 17 RGPD) · No reversible</div>
              </div>
              <button class="btn btn-danger" onclick="IIAPP.UI.confirmClear()">Borrar</button>
            </div>
          </div>
          <p style="margin-top:12px">
            <button onclick="IIAPP.UI.showPrivacyPolicy()"
              style="background:none;border:0;color:#003366;text-decoration:underline;cursor:pointer;font-family:inherit;font-size:13px;padding:0">
              Ver política de privacidad completa
            </button>
          </p>
        </div>

        <div class="card">
          <h3>Sobre la app</h3>
          <p class="text-muted small">CorreosTest v1.0 · ${QUESTIONS.length} preguntas en el banco.</p>
          <p class="text-muted small">App de preparación para la oposición a Correos. Funciona 100% local en tu dispositivo, sin servidores.</p>
          <p class="text-muted small">Contacto: <a href="mailto:informaticacoseba@gmail.com">informaticacoseba@gmail.com</a></p>
        </div>
      </div>
    `;
  }

  // ========== FLUJO DE ACTIVACIÓN CON CÓDIGO ==========

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function validateCode(code, planId) {
    const hashes = (window.CORREOS.ACTIVATION_HASHES || {})[planId] || [];
    const h = await sha256(code.trim().toUpperCase());
    return hashes.includes(h);
  }

  function runUpgradeFlow(planId, email) {
    const plan = PLAN_CATALOG[planId];
    const overlay = document.createElement('div');
    overlay.className = 'tribunal-overlay upgrade-flow';
    overlay.innerHTML = `
      <div class="upgrade-modal">
        <div class="upgrade-modal-head">
          <h3>Activar ${plan.name} · ${plan.priceLabel}</h3>
          <button class="btn-link" onclick="this.closest('.tribunal-overlay').remove()">✕</button>
        </div>
        <div class="upgrade-steps">
          <div class="upgrade-step">
            <div class="upgrade-step-num">1</div>
            <div>
              <div class="upgrade-step-title">Realiza el pago</div>
              <p class="text-muted small">Pago único de ${plan.priceLabel} · Sin renovación automática · Acceso hasta el examen 2026</p>
              <a class="btn btn-primary" href="mailto:pedrojimenezdiaz@gmail.com?subject=Pedido%20${encodeURIComponent(plan.name)}%20CorreosTest&body=Hola%2C%20quiero%20activar%20el%20plan%20${encodeURIComponent(plan.name)}%20(${plan.priceLabel})%20para%20el%20email%20${encodeURIComponent(email || 'mi-email@correo.com')}" style="display:inline-block;margin-top:8px">Contactar para pagar</a>
              <p class="text-muted small" style="margin-top:6px">Aceptamos Bizum · Transferencia · Tarjeta. Recibirás un código de activación por email.</p>
            </div>
          </div>
          <div class="upgrade-step">
            <div class="upgrade-step-num">2</div>
            <div style="flex:1">
              <div class="upgrade-step-title">Introduce tu código de activación</div>
              <p class="text-muted small">El código llega por email tras confirmar el pago. Formato: CT-XXXX-XXXX-XXXX</p>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <input type="text" id="activation-code-input" placeholder="CT-XXXX-XXXX-XXXX"
                  style="flex:1;min-width:180px;padding:10px 12px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:monospace;text-transform:uppercase"
                  oninput="this.value=this.value.toUpperCase()">
                <button class="btn btn-primary" id="activation-submit-btn" onclick="IIAPP.UI._activateCode('${planId}')">Activar</button>
              </div>
              <div id="activation-msg" style="margin-top:8px;font-size:13px"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  async function _activateCode(planId) {
    const input = document.getElementById('activation-code-input');
    const msg = document.getElementById('activation-msg');
    const btn = document.getElementById('activation-submit-btn');
    if (!input || !msg) return;
    const code = input.value.trim().toUpperCase();
    if (!code) { msg.innerHTML = '<span style="color:#dc2626">Introduce un código.</span>'; return; }
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    const valid = await validateCode(code, planId);
    if (valid) {
      // Marcar como usado en IndexedDB (no en localStorage, más seguro)
      const used = (await Storage.getProfile('usedCodes')) || [];
      if (used.includes(code)) {
        msg.innerHTML = '<span style="color:#dc2626">Este código ya fue utilizado.</span>';
        btn.disabled = false; btn.textContent = 'Activar'; return;
      }
      await Storage.setProfile('usedCodes', [...used, code]);
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      await Storage.setProfile('plan', planId);
      await Storage.setProfile('planActivatedAt', Date.now());
      await Storage.setProfile('planExpires', Date.now() + oneYear);
      document.querySelector('.tribunal-overlay.upgrade-flow').innerHTML = `
        <div class="upgrade-modal" style="text-align:center;padding:40px 24px">
          <div style="font-size:48px;margin-bottom:16px">✓</div>
          <h2 style="color:#003366;margin-bottom:8px">${PLAN_CATALOG[planId].name} activado</h2>
          <p style="color:#64748b">Tienes acceso completo hasta el examen de 2026.</p>
          <button class="btn btn-primary" style="margin-top:20px"
            onclick="this.closest('.tribunal-overlay').remove(); IIAPP.UI.show('planes')">Ver mi plan</button>
        </div>`;
    } else {
      msg.innerHTML = '<span style="color:#dc2626">Código no válido. Comprueba que lo has escrito correctamente.</span>';
      btn.disabled = false; btn.textContent = 'Activar';
    }
  }

  // ========== GENERACIÓN DE PDFs (vía window.print) ==========

  function _renderTemaHtml(mod, content) {
    const color = mod.color || '#003366';
    const legBadges = (mod.legislacion || [])
      .map(l => `<span class="tc-leg">${l}</span>`).join('');
    // Eliminar el h2 inicial del contenido (ya va en la cabecera)
    const bodyHtml = content.replace(/^<h2>[^<]*<\/h2>\s*/i, '');
    return `
      <article class="pdf-tema">
        <header class="tc-head" style="background:${color};border-color:${color}">
          <div class="tc-num">${String(mod.number).padStart(2,'0')}</div>
          <div class="tc-hinfo">
            <div class="tc-label">TEMA ${mod.number} DE 12 &nbsp;·&nbsp; Peso en examen: ${Math.round(mod.weight*100)}%</div>
            <div class="tc-title">${mod.name}</div>
          </div>
        </header>
        ${legBadges ? `<div class="tc-legrow"><span class="tc-leg-lbl">Legislación:</span>${legBadges}</div>` : ''}
        <div class="tc-body">${bodyHtml}</div>
        <footer class="tc-foot">
          <span>CorreosTest 2026</span>
          <span>Tema ${mod.number}: ${mod.shortName}</span>
          <span>Oposición Correos · Grupo IV</span>
        </footer>
      </article>
    `;
  }

  function printTemarioCompleto() {
    const CONTENT = window.CORREOS.TEMARIO_CONTENT || {};
    const temas = TEMARIO.modules
      .map(m => _renderTemaHtml(m, CONTENT[m.number] || '<p>Contenido no disponible.</p>'))
      .join('');

    const hoy = new Date().toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' });
    const tocRows = TEMARIO.modules.map(m => `
      <div class="toc-row">
        <span class="toc-num">T${m.number}</span>
        <span class="toc-name">${m.name}</span>
        <span class="toc-pct">${Math.round(m.weight * 100)}%</span>
      </div>`).join('');

    const portada = `
      <div class="pdf-cover">
        <div class="cover-stripe"></div>
        <div class="cover-logo">CT</div>
        <div class="cover-title">Temario Oficial<br>Correos 2026</div>
        <div class="cover-sub">Personal Laboral Indefinido · Grupo IV</div>
        <div class="cover-meta">
          <strong>12 temas oficiales</strong> · Legislación actualizada (RD 437/2024, Ley 43/2010) ·
          Generado el ${hoy} · CorreosTest
        </div>
        <div class="cover-toc">
          <h2>Índice de contenidos</h2>
          ${tocRows}
        </div>
        <div class="cover-bottom">
          <span>CorreosTest 2026 · correostest.es</span>
          <span>Solo para uso personal del opositor</span>
        </div>
      </div>
    `;

    _openPrintWindow('Temario Correos 2026 — CorreosTest', portada + temas);
  }

  function _openPrintWindow(title, htmlBody) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      alert('Tu navegador bloqueó la apertura de ventana. Permite popups de localhost para descargar el PDF.');
      return;
    }
    const styles = `
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        /* ── PÁGINA ─────────────────────────────────────────────────── */
        @page {
          size: A4;
          margin: 28mm 20mm 26mm 22mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page { /* encabezado y pie en todas las páginas excepto portada */
          @top-left   { content: "CorreosTest 2026"; font-family:'Inter',sans-serif; font-size:8pt; color:#94a3b8; padding-bottom:3mm; border-bottom:0.5pt solid #e2e8f0; }
          @top-right  { content: "Preparación Oposición Correos · Grupo IV"; font-family:'Inter',sans-serif; font-size:8pt; color:#94a3b8; padding-bottom:3mm; border-bottom:0.5pt solid #e2e8f0; }
          @bottom-center { content: "— " counter(page) " —"; font-family:'Inter',sans-serif; font-size:8pt; color:#94a3b8; padding-top:3mm; border-top:0.5pt solid #e2e8f0; }
        }
        @page :first { @top-left{content:""} @top-right{content:""} @bottom-center{content:""} }

        /* ── BASE ───────────────────────────────────────────────────── */
        *  { box-sizing:border-box; }
        body { font-family:'Inter',system-ui,sans-serif; font-size:10.5pt; color:#1e293b; line-height:1.65; margin:0; padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        p  { margin:0 0 10pt; text-align:justify; }
        strong { font-weight:700; }
        .page-break { page-break-after:always; break-after:page; }

        /* ── PORTADA ────────────────────────────────────────────────── */
        .pdf-cover {
          page-break-after: always;
          min-height: 270mm;
          display: flex; flex-direction: column;
          padding: 20mm 0;
          position: relative;
        }
        .cover-stripe { height:8mm; background:#003366; margin-bottom:20mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .cover-logo   { width:70px; height:70px; background:#003366; color:#FFCD00; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:24pt; font-weight:900; margin-bottom:10mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        .cover-title  { font-size:30pt; font-weight:700; color:#003366; line-height:1.15; margin:0 0 4mm; }
        .cover-sub    { font-size:14pt; color:#64748b; font-weight:500; margin:0 0 8mm; }
        .cover-meta   { font-size:9pt; color:#94a3b8; margin:0 0 14mm; }
        .cover-meta strong { color:#475569; }
        .cover-toc    { border-top:2pt solid #003366; padding-top:8mm; }
        .cover-toc h2 { font-size:11pt; font-weight:700; color:#003366; text-transform:uppercase; letter-spacing:.6px; margin:0 0 5mm; }
        .toc-row { display:flex; align-items:baseline; gap:6px; padding:3px 0; font-size:9.5pt; border-bottom:0.5pt dotted #cbd5e1; }
        .toc-num  { font-weight:700; color:#003366; min-width:22px; }
        .toc-name { flex:1; color:#334155; }
        .toc-pct  { font-size:8pt; color:#94a3b8; white-space:nowrap; }
        .cover-bottom { margin-top:auto; padding-top:10mm; border-top:0.5pt solid #e2e8f0; font-size:8pt; color:#94a3b8; display:flex; justify-content:space-between; }

        /* ── CABECERA DE CADA TEMA ──────────────────────────────────── */
        .pdf-tema { page-break-before:always; }
        .tc-head {
          display:flex; align-items:center; gap:14px;
          padding:14px 18px; border-radius:0;
          margin-bottom:0; color:#fff;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        .tc-num {
          font-size:28pt; font-weight:900; opacity:.9;
          min-width:52px; text-align:center; line-height:1;
        }
        .tc-hinfo { flex:1; }
        .tc-label { font-size:7.5pt; opacity:.8; text-transform:uppercase; letter-spacing:.7px; margin-bottom:3px; }
        .tc-title { font-size:13.5pt; font-weight:700; line-height:1.25; }

        /* Faja legislación */
        .tc-legrow { background:#f8fafc; border:0.5pt solid #e2e8f0; border-top:0; padding:7px 18px; display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:14px; }
        .tc-leg-lbl { font-size:7.5pt; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.5px; margin-right:4px; }
        .tc-leg { font-size:7.5pt; background:#e0e7ff; color:#3730a3; border-radius:4px; padding:2px 7px; font-weight:500; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

        /* ── CUERPO DEL TEMA ────────────────────────────────────────── */
        .tc-body { padding:0; }

        h2 { display:none; } /* ya va en la cabecera tc-head */
        h3 {
          font-size:12pt; font-weight:700; color:#003366;
          margin:18pt 0 6pt; padding-bottom:4pt;
          border-bottom:1.5pt solid #003366;
          page-break-after:avoid;
        }
        h4 {
          font-size:10.5pt; font-weight:700; color:#334155;
          margin:12pt 0 4pt;
          page-break-after:avoid;
        }

        ul { list-style:none; padding-left:0; margin:6pt 0 10pt; }
        ul li { padding-left:14px; margin-bottom:4pt; position:relative; }
        ul li::before { content:'▸'; position:absolute; left:0; color:#003366; font-size:9pt; }
        ol { padding-left:18px; margin:6pt 0 10pt; }
        ol li { margin-bottom:4pt; }

        /* Tablas */
        table { width:100%; border-collapse:collapse; margin:10pt 0 14pt; font-size:9pt; page-break-inside:avoid; }
        thead tr { background:#003366 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        th { background:#003366 !important; color:#fff; padding:7pt 9pt; text-align:left; font-weight:700; font-size:8.5pt; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
        td { padding:6pt 9pt; border-bottom:0.5pt solid #e2e8f0; vertical-align:top; }
        tr:nth-child(even) td { background:#f8fafc; -webkit-print-color-adjust:exact; print-color-adjust:exact; }

        /* Bloque "Puntos clave para el examen" */
        em {
          display:block; font-style:normal;
          background:#FFF9C4 !important;
          border-left:4pt solid #FFCD00;
          padding:9pt 13pt; margin:14pt 0;
          font-size:9.5pt; color:#1e293b; line-height:1.6;
          page-break-inside:avoid;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }
        em::before { content:'★  Puntos clave · '; font-weight:700; color:#856404; }

        /* Bloques mnemotécnicos (p con background azul) */
        p[style*="background:#eef6ff"],
        p[style*="background: #eef6ff"] {
          background:#e8f0fe !important;
          border-left:4pt solid #003366;
          padding:9pt 13pt; margin:12pt 0;
          border-radius:0 6pt 6pt 0;
          font-size:9.5pt; line-height:1.65;
          page-break-inside:avoid;
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
        }

        /* ── PIE DE TEMA ────────────────────────────────────────────── */
        .tc-foot {
          margin-top:16pt; padding-top:7pt;
          border-top:0.5pt solid #e2e8f0;
          display:flex; justify-content:space-between;
          font-size:7.5pt; color:#94a3b8;
        }

        /* ── HELPERS ────────────────────────────────────────────────── */
        .text-muted { color:#64748b; }
        .small { font-size:8.5pt; }
      </style>
    `;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body>${htmlBody}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));<\/script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    w.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ========== CARTITO — MASCOTA ==========

  const Mascot = (() => {
    let _timer = null;
    let _tapCount = 0;

    const phrases = {
      greet:   ['¡Hola! Soy Cartito 👋', '¡Listo para repartir saber! ✉️', '¡A por esas preguntas! 🚀'],
      correct: ['¡Eso es! ¡Lo sabías! 🎉', '¡Perfecto! ¡Crack! ⭐', '¡Bien hecho, tío! 💪', '¡Ahí está! 🔥'],
      wrong:   ['¡Casi! No te rajes 😅', '¡Tranqui, próxima sí! 📬', 'Todos fallamos, sigue 💙', '¡Error de novato, igual que yo a veces! 😂'],
      streak:  (n) => `🔥 ¡${n} días seguidos! ¡Imparable!`,
      levelup: (name) => `¡Subiste a ${name}! 🏆 ¡Lo petas!`,
      finish:  (score) => score >= 7 ? `¡${fmt(score,1)}/10! ¡Eres un fiera! 🎉` : score >= 5.5 ? `¡${fmt(score,1)}/10! ¡Aprobado! 🎊` : `${fmt(score,1)}/10 — ¡Sigue, que lo pillas! 💪`,
      tap:     ['¡Para, que tengo correo que repartir! 😄', '¡Eh! ¡Eso hace cosquillas! 🤣', '¡Sigo aquí! No me olvides ✉️', '¡Mi bolsa está llena de preguntas para ti! 📬', '¡Vamos! ¡Tú puedes! 💪'],
      idle:    ['¿Llevas rachas de estudio? ¡La constancia es clave! 🔑', '¡Recuerda hacer el simulacro esta semana! ⏱️', '¿Sabes cuántos intentos tiene la carta certificada? Solo 1 😉', '¡El temario también tiene audio! Pruébalo 🎧'],
    };

    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function show(text, mood = 'happy', duration = 4000) {
      const bubble = document.getElementById('cartito-bubble');
      const textEl = document.getElementById('cartito-text');
      const char   = document.getElementById('cartito-char');
      if (!bubble || !textEl || !char) return;

      textEl.textContent = text;
      bubble.style.display = 'block';
      // Recrear la burbuja para relanzar la animación
      bubble.style.animation = 'none';
      void bubble.offsetWidth;
      bubble.style.animation = '';

      char.classList.remove('jump', 'shake');
      void char.offsetWidth;
      if (mood === 'happy' || mood === 'levelup') char.classList.add('jump');
      if (mood === 'wrong') char.classList.add('shake');

      clearTimeout(_timer);
      _timer = setTimeout(() => { bubble.style.display = 'none'; }, duration);
    }

    return {
      show,
      greet()   { show(pick(phrases.greet), 'happy', 5000); },
      correct() { show(pick(phrases.correct), 'happy'); },
      wrong()   { show(pick(phrases.wrong), 'wrong'); },
      streak(n) { show(phrases.streak(n), 'happy', 5000); },
      levelup(name) { show(phrases.levelup(name), 'levelup', 5000); },
      finish(score) { show(phrases.finish(score), score >= 5.5 ? 'happy' : 'wrong', 5000); },
      tap() {
        _tapCount++;
        show(phrases.tap[_tapCount % phrases.tap.length], 'happy', 3500);
      },
      idle() { show(pick(phrases.idle), 'happy', 6000); },
    };
  })();

  window.IIAPP.Mascot = Mascot;

  // ========== EFECTOS VISUALES ==========

  function launchConfetti(anchor) {
    const colors = ['#FFCD00','#003366','#22c55e','#f97316','#8b5cf6','#3b82f6'];
    const rect = anchor.getBoundingClientRect();
    for (let i = 0; i < 18; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:fixed; pointer-events:none; z-index:9999;
        width:8px; height:8px; border-radius:50%;
        background:${colors[i % colors.length]};
        left:${rect.left + rect.width * Math.random()}px;
        top:${rect.top + rect.height * 0.5}px;
        animation:confetti-fall ${0.6 + Math.random() * 0.6}s ease-out forwards;
        animation-delay:${i * 0.03}s;
      `;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 1500);
    }
  }

  // ========== UI HELPERS ==========

  const UI = {
    _activateCode,
    printTemarioCompleto,
    show,

    acceptConsent() {
      localStorage.setItem('ct_consent', Date.now().toString());
      const b = document.getElementById('consent-banner');
      if (b) b.remove();
    },

    showPrivacyPolicy() {
      const m = document.createElement('div');
      m.className = 'tribunal-overlay';
      m.innerHTML = `
        <div class="tribunal-modal" style="max-width:560px;max-height:85vh;overflow-y:auto">
          <div class="modal-head">
            <h3>Política de privacidad</h3>
            <button class="btn-link" onclick="this.closest('.tribunal-overlay').remove()">✕</button>
          </div>
          <div class="modal-body" style="font-size:14px;line-height:1.7;color:#334155">
            <p><strong>Responsable:</strong> Pedro Jiménez Díaz · informaticacoseba@gmail.com</p>
            <h4 style="margin:16px 0 6px;color:#003366">¿Qué datos guardamos?</h4>
            <ul>
              <li>Nombre, email y alias (solo si tú los introduces en Mi cuenta)</li>
              <li>Progreso de estudio: respuestas, sesiones, estado SRS</li>
              <li>Preferencias de la app y puesto seleccionado</li>
            </ul>
            <h4 style="margin:16px 0 6px;color:#003366">¿Dónde se guardan?</h4>
            <p>Exclusivamente en <strong>tu dispositivo</strong> mediante IndexedDB. No se envían a ningún servidor externo. Si borras los datos del sitio en tu navegador, se eliminan permanentemente.</p>
            <h4 style="margin:16px 0 6px;color:#003366">Tus derechos (RGPD · LOPD-GDD)</h4>
            <ul>
              <li><strong>Acceso:</strong> exporta todos tus datos desde Ajustes → Exportar JSON</li>
              <li><strong>Supresión:</strong> borra todo desde Ajustes → Borrar mis datos</li>
              <li><strong>Portabilidad:</strong> el archivo JSON exportado es legible y reutilizable</li>
              <li><strong>Rectificación:</strong> edita tus datos en Mi cuenta en cualquier momento</li>
            </ul>
            <h4 style="margin:16px 0 6px;color:#003366">Cookies y almacenamiento local</h4>
            <p>No usamos cookies de terceros ni rastreadores. Solo almacenamiento local del navegador (IndexedDB) para que la app funcione sin conexión.</p>
            <h4 style="margin:16px 0 6px;color:#003366">Contacto</h4>
            <p>Para ejercer tus derechos o cualquier consulta sobre privacidad: <a href="mailto:informaticacoseba@gmail.com">informaticacoseba@gmail.com</a></p>
            <p class="text-muted small" style="margin-top:16px">Última actualización: mayo 2026 · Base legal: consentimiento del usuario (art. 6.1.a RGPD)</p>
          </div>
        </div>`;
      document.body.appendChild(m);
    },

    confirmExit() {
      if (App.test && !App.test.finished && App.test.answers.length > 0) {
        if (!confirm('¿Salir del test? Se perderá el progreso de esta sesión.')) return;
      }
      App.test = null;
      show('home');
    },

    nextQuestion,

    skipNoFeedback() {
      if (App.test && !App.test.instant) nextQuestion();
    },

    startQuick(num) {
      startTest({
        mode: 'weighted', num,
        penalty: false, instant: true, shuffle: true
      });
    },

    startSimulacro() {
      startTest({
        mode: 'simulacro',
        num: TEMARIO.exam.test.questions || 100,
        penalty: !!TEMARIO.exam.test.penalty,   // false en Correos
        instant: false, shuffle: true
      });
    },

    startMicrotest() {
      startTest({ mode: 'weighted', num: 5, penalty: false, instant: true, shuffle: true });
    },

    answerQdq(letter, correct, _id) {
      const opts = document.getElementById('qdq-opts');
      if (!opts) return;
      opts.querySelectorAll('.dl-qdq-btn').forEach(btn => {
        btn.disabled = true;
        const l = btn.querySelector('.dl-opt-letter')?.textContent?.trim();
        if (l === letter)   btn.classList.add(letter === correct ? 'qdq-correct' : 'qdq-wrong');
        if (l === correct && l !== letter) btn.classList.add('qdq-correct');
      });
      const card = document.getElementById('qdq-card');
      if (card) {
        const msg = document.createElement('div');
        const ok = letter === correct;
        msg.className = ok ? 'qdq-result qdq-result-ok' : 'qdq-result qdq-result-err';
        msg.textContent = ok ? '🎉 ¡Correcto! +10 XP' : `😅 Era la ${correct} — ¡Para el siguiente!`;
        card.appendChild(msg);
        if (ok) launchConfetti(card);
      }
    },

    startAdaptiveSimulacro() {
      startTest({
        mode: 'adaptativo',
        num: TEMARIO.exam.test.questions || 100,
        penalty: false, instant: false, shuffle: true
      });
    },

    tribunalLookup(conv) {
      const k = (window.IIAPP.OFFICIAL_KEYS || {})[conv];
      if (!k) { alert('Convocatoria no encontrada.'); return; }
      const label = conv.replace('OEP_', 'OEP ').replace('_', '–');
      const overlay = document.createElement('div');
      overlay.className = 'tribunal-overlay';
      overlay.innerHTML = `
        <div class="tribunal-modal">
          <div class="modal-head">
            <h3>${label} — consulta de respuestas oficiales</h3>
            <button class="btn-link" onclick="this.closest('.tribunal-overlay').remove()">✕ Cerrar</button>
          </div>
          <div class="modal-body">
            <div class="lookup-tabs">
              <button class="tab-btn active" data-tab="test">Test (${Object.keys(k.test_principales).length})</button>
              <button class="tab-btn" data-tab="reserva">Reserva (${Object.keys(k.test_reserva).length})</button>
              <button class="tab-btn" data-tab="supuestos">Supuestos</button>
            </div>
            <div id="lookup-content"></div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const renderTab = (tab) => {
        const c = overlay.querySelector('#lookup-content');
        if (tab === 'test' || tab === 'reserva') {
          const data = tab === 'test' ? k.test_principales : k.test_reserva;
          c.innerHTML = `
            <div class="answer-grid">
              ${Object.entries(data).map(([n, l]) => `
                <div class="answer-cell">
                  <span class="answer-num">${n}</span>
                  <span class="answer-letter answer-${l}">${l}</span>
                </div>
              `).join('')}
            </div>
            <p class="text-muted small">Plantilla oficial publicada por el Tribunal Cuerpo Ayudantes IIPP. ${Object.keys(data).length} preguntas.</p>
          `;
        } else {
          c.innerHTML = Object.entries(k.supuestos).map(([s, preguntas]) => `
            <div class="supuesto-block">
              <h4>Supuesto práctico ${s}</h4>
              <div class="answer-grid">
                ${Object.entries(preguntas).map(([n, l]) => `
                  <div class="answer-cell">
                    <span class="answer-num">${n}</span>
                    <span class="answer-letter answer-${l}">${l}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('');
        }
      };

      overlay.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
          overlay.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderTab(btn.dataset.tab);
        };
      });
      renderTab('test');
    },

    tribunalSimulacro(conv) {
      const k = (window.IIAPP.OFFICIAL_KEYS || {})[conv];
      const nTotal = k ? Object.keys(k.test_principales).length : 120;
      if (!confirm(`Simulacro estilo ${conv}: ${nTotal} preguntas cronometradas con tu banco actual.\n\nAl terminar verás tu nota frente a la nota de corte histórica del Tribunal.\n\n¿Empezar?`)) return;
      startTest({
        mode: 'simulacro', num: nTotal,
        penalty: true, instant: false, shuffle: true,
        tribunalConv: conv
      });
    },

    startFailedReview() {
      startTest({
        mode: 'failed', num: 25,
        penalty: false, instant: true, shuffle: true
      });
    },

    startSrsReview() {
      startTest({
        mode: 'srs',
        penalty: false, instant: true, shuffle: true
      });
    },

    startModule(moduleNum, num) {
      startTest({
        mode: 'module', moduleNum, num,
        penalty: false, instant: true, shuffle: true
      });
    },

    startCustom() {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const numEl = document.querySelector('input[name="num"]:checked');
      const num = numEl ? parseInt(numEl.value) : 25;
      const moduleEl = document.querySelector('input[name="moduleNum"]:checked');
      const moduleNum = moduleEl ? parseInt(moduleEl.value) : null;
      const penalty = $('#opt-penalty').checked;
      const shuffle = $('#opt-shuffle').checked;
      const instant = $('#opt-instant').checked;

      if (mode === 'module' && !moduleNum) {
        alert('Selecciona un módulo.');
        return;
      }

      startTest({
        mode, num, moduleNum,
        penalty, shuffle, instant
      });
    },

    async saveProfile() {
      const alias = $('#alias-input').value.trim();
      const examDate = $('#exam-date').value;
      const hoursDay = $('#hours-day').value;
      await Storage.setProfile('alias', alias);
      if (examDate) await Storage.setProfile('examDate', examDate);
      if (hoursDay) await Storage.setProfile('hoursDay', parseInt(hoursDay));
      alert('Perfil guardado.');
    },

    async saveCuenta() {
      const profile = await Storage.getAllProfile();
      const wasNew = !profile.email && !profile.name;
      const fields = {
        name: ($('#cuenta-name')?.value || '').trim(),
        email: ($('#cuenta-email')?.value || '').trim(),
        alias: ($('#cuenta-alias')?.value || '').trim(),
        examDate: $('#cuenta-exam-date')?.value || '',
        hoursDay: parseInt($('#cuenta-hours')?.value || '') || null,
      };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== '' && v !== null) await Storage.setProfile(k, v);
      }
      if (wasNew && fields.email) {
        await Storage.setProfile('registeredAt', Date.now());
      }
      alert('Datos guardados.');
      show('cuenta');
    },

    async setPref(key, value) {
      await Storage.setProfile(key, value);
    },

    async setPuesto(puestoId) {
      await Storage.setProfile('puesto', puestoId);
      show('cuenta');
    },

    showTema(num) {
      _temaActivo = num;
      renderTemario();
    },

    async onboardingSelectPuesto(puestoId) {
      await Storage.setProfile('puesto', puestoId);
      const overlay = document.getElementById('onboarding-overlay');
      if (overlay) {
        // Animación de salida suave
        overlay.style.transition = 'opacity 0.3s';
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); show('home'); }, 300);
      } else {
        show('home');
      }
    },

    async startUpgrade(planId) {
      const plan = PLAN_CATALOG[planId];
      if (!plan) return;
      const profile = await Storage.getAllProfile();
      const email = profile.email;

      if (!email) {
        const overlay = document.createElement('div');
        overlay.className = 'tribunal-overlay';
        overlay.innerHTML = `
          <div class="tribunal-modal upgrade-modal">
            <div class="modal-head">
              <h3>Necesitas un email registrado</h3>
              <button class="btn-link" onclick="this.closest('.tribunal-overlay').remove()">✕</button>
            </div>
            <div class="modal-body">
              <p>Para activar un plan tu cuenta debe tener un email asociado. El email recibe el recibo de Stripe y permite recuperar el acceso si cambias de dispositivo.</p>
              <div class="actions-row" style="margin-top: 16px;">
                <button class="btn btn-primary" onclick="document.querySelector('.tribunal-overlay').remove(); IIAPP.UI.show('cuenta');">Ir a Cuenta</button>
                <button class="btn btn-secondary" onclick="this.closest('.tribunal-overlay').remove()">Cancelar</button>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        return;
      }

      runUpgradeFlow(planId, email);
    },

    async cancelPlan() {
      if (!confirm('¿Cancelar suscripción? Mantendrás el acceso hasta la fecha de renovación. En producción esta acción la gestionaría el portal de Stripe.')) return;
      await Storage.setProfile('plan', 'free');
      await Storage.setProfile('planExpires', null);
      alert('Suscripción cancelada (simulado).');
      show('cuenta');
    },

    // -------- Reproductor temario --------
    playTema(num) {
      const content = window.IIAPP.TEMARIO_CONTENT[num];
      const tema = TEMARIO.modules.flatMap(m => m.topics).find(t => t.number === num);
      if (!content || !tema) return;
      const trackName = $('#ap-track-name');
      if (trackName) trackName.textContent = `Tema ${num} · ${tema.name}`;
      $$('.tema-row').forEach(r => r.classList.remove('tema-playing'));
      const row = document.querySelector(`.tema-row[data-topic="${num}"]`);
      if (row) row.classList.add('tema-playing');
      const toggle = $('#ap-toggle');
      if (toggle) toggle.textContent = '⏸';
      TTS.play(num, content, () => {
        if (row) row.classList.remove('tema-playing');
        if (toggle) toggle.textContent = '▶';
      });
    },

    toggleTema() {
      if (!TTS.utterance) {
        // Sin tema seleccionado, arrancar el primero del primer módulo
        const first = TEMARIO.modules[0].topics[0].number;
        if (window.IIAPP.TEMARIO_CONTENT[first]) UI.playTema(first);
        return;
      }
      if (window.speechSynthesis.paused) {
        TTS.resume();
        const t = $('#ap-toggle'); if (t) t.textContent = '⏸';
      } else if (window.speechSynthesis.speaking) {
        TTS.pause();
        const t = $('#ap-toggle'); if (t) t.textContent = '▶';
      }
    },

    stopTema() {
      TTS.stop();
      $$('.tema-row').forEach(r => r.classList.remove('tema-playing'));
      const t = $('#ap-toggle'); if (t) t.textContent = '▶';
      const tn = $('#ap-track-name'); if (tn) tn.textContent = 'Selecciona un tema';
    },

    nextTema() {
      const current = TTS.currentTopic;
      const allTopics = TEMARIO.modules.flatMap(m => m.topics).map(t => t.number);
      const i = current ? allTopics.indexOf(current) : -1;
      const next = allTopics[i + 1];
      if (next && window.IIAPP.TEMARIO_CONTENT[next]) UI.playTema(next);
    },

    prevTema() {
      const current = TTS.currentTopic;
      const allTopics = TEMARIO.modules.flatMap(m => m.topics).map(t => t.number);
      const i = current ? allTopics.indexOf(current) : 0;
      const prev = allTopics[i - 1] || allTopics[0];
      if (prev && window.IIAPP.TEMARIO_CONTENT[prev]) UI.playTema(prev);
    },

    setSpeed(rate) {
      TTS.setRate(rate);
      $$('.speed-btn').forEach(b => b.classList.remove('active'));
      $$('.speed-btn').forEach(b => {
        if (parseFloat(b.textContent) === rate) b.classList.add('active');
      });
    },

    downloadTemaPdf(num) {
      const tema = TEMARIO.modules.flatMap(m => m.topics.map(t => ({ ...t, mod: m }))).find(t => t.number === num);
      const content = window.IIAPP.TEMARIO_CONTENT[num];
      if (!tema || !content) return;
      _openPrintWindow(`Tema ${num} — ${tema.name}`, _renderTemaHtml(tema, content));
    },

    downloadAllTemarioPdf() {
      const CONTENT = window.IIAPP.TEMARIO_CONTENT || {};
      const sections = TEMARIO.modules.map(m => {
        const temas = m.topics.filter(t => CONTENT[t.number]).map(t => _renderTemaHtml({ ...t, mod: m }, CONTENT[t.number])).join('<div class="page-break"></div>');
        return `
          <div class="pdf-module">
            <h2 class="pdf-module-title" style="border-color: ${m.color}; color: ${m.color}">Módulo ${m.number} · ${m.name}</h2>
            <p class="pdf-module-desc">${m.topics.length} temas · ${(m.weight * 100).toFixed(0)}% del temario</p>
          </div>
          <div class="page-break"></div>
          ${temas}
        `;
      }).join('<div class="page-break"></div>');
      const cover = `
        <div class="pdf-cover">
          <div class="pdf-logo">IIAPP</div>
          <h1>Temario completo</h1>
          <h2>Cuerpo de Ayudantes de Instituciones Penitenciarias</h2>
          <p class="pdf-cover-meta">${TEMARIO.modules.length} módulos · 50 temas · Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div class="pdf-cover-modules">
            ${TEMARIO.modules.map(m => `
              <div class="pdf-cover-mod" style="border-left-color: ${m.color}">
                <b>Módulo ${m.number}</b> · ${m.name}<br>
                <span class="text-muted small">${m.topics.length} temas · ${(m.weight * 100).toFixed(0)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      _openPrintWindow('Temario completo IIPP', cover + '<div class="page-break"></div>' + sections);
    },

    async toggleDarkMode(checked) {
      await Storage.setProfile('darkMode', checked);
      document.body.classList.toggle('dark', checked);
    },

    async confirmClear() {
      await Storage.clearAll();
      location.reload();
    },

    async importBackup(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!confirm(`Importar backup del ${data.exportedAt?.slice(0, 10)}? Sustituirá los datos actuales.`)) return;
        await Storage.importAll(data);
        alert('Backup importado correctamente.');
        location.reload();
      } catch (err) {
        alert('Error al importar: ' + err.message);
      }
    }
  };

  window.IIAPP.UI = UI;
  window.IIAPP.App = App;

  // ========== INICIALIZACIÓN ==========

  async function init() {
    await Storage.open();
    const profile = await Storage.getAllProfile();
    if (profile.darkMode) document.body.classList.add('dark');

    // Service worker (solo si servido por http)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      try {
        await navigator.serviceWorker.register('service-worker.js');
      } catch (e) { /* ignore */ }
    }

    // Banner de privacidad LOPD — primera visita
    if (!localStorage.getItem('ct_consent')) {
      showConsentBanner();
    }

    // Primera apertura: si no ha elegido puesto, mostrar onboarding
    if (!profile.puesto) {
      showOnboarding();
    } else {
      show('home');
    }

    // Cartito aparece al arrancar tras un pequeño retraso
    setTimeout(async () => {
      const g2 = await Stats.global().catch(() => ({}));
      if ((g2.currentStreak || 0) >= 3) {
        Mascot.streak(g2.currentStreak);
      } else {
        Mascot.greet();
      }
    }, 1200);

    // Mensajes idle de Cartito cada 3 minutos sin interacción
    setInterval(() => { Mascot.idle(); }, 3 * 60 * 1000);
  }

  function showConsentBanner() {
    const b = document.createElement('div');
    b.id = 'consent-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Aviso de privacidad');
    b.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; z-index:999;
      background:#1e293b; color:#f1f5f9; padding:16px 20px;
      display:flex; align-items:center; gap:16px; flex-wrap:wrap;
      font-size:13px; line-height:1.5;
    `;
    b.innerHTML = `
      <p style="margin:0;flex:1;min-width:200px">
        <strong>CorreosTest</strong> guarda tu progreso de estudio
        <strong>únicamente en este dispositivo</strong> (sin servidores propios).
        No usamos cookies de terceros ni enviamos datos personales fuera de tu navegador.
        <button onclick="IIAPP.UI.showPrivacyPolicy()"
          style="background:none;border:0;color:#93c5fd;text-decoration:underline;cursor:pointer;font-family:inherit;font-size:13px;padding:0">
          Política de privacidad
        </button>
      </p>
      <button onclick="IIAPP.UI.acceptConsent()"
        style="background:#003366;color:#FFCD00;border:0;border-radius:8px;padding:10px 20px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">
        Entendido
      </button>
    `;
    document.body.appendChild(b);
  }

  function showPaywall() {
    const overlay = document.createElement('div');
    overlay.id = 'paywall-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.55); display: flex;
      align-items: center; justify-content: center; padding: 24px;
    `;
    overlay.innerHTML = `
      <div style="background: #fff; border-radius: 16px; max-width: 480px; width: 100%;
                  padding: 36px 28px; text-align: center; font-family: inherit;">
        <div style="font-size: 42px; margin-bottom: 16px;">🎉</div>
        <h2 style="font-size: 22px; font-weight: 800; color: #003366; margin: 0 0 12px;">
          Has completado tus 200 preguntas gratuitas
        </h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Con el plan gratuito puedes probar hasta 200 preguntas. Para seguir preparándote
          con el banco completo, activa el acceso al concurso.
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left;">
          <div style="font-weight: 700; font-size: 28px; color: #003366; margin-bottom: 4px;">49 €</div>
          <div style="color: #64748b; font-size: 13px; margin-bottom: 14px;">pago único · acceso completo hasta el examen</div>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #334155;">
            <li style="padding: 4px 0;">✓ Las 13.000+ preguntas oficiales</li>
            <li style="padding: 4px 0;">✓ Simulacros ilimitados cronometrados</li>
            <li style="padding: 4px 0;">✓ Predicción de aprobado</li>
            <li style="padding: 4px 0;">✓ Sin renovación automática</li>
          </ul>
        </div>
        <button onclick="IIAPP.UI.show('planes'); document.getElementById('paywall-overlay').remove();"
          style="width: 100%; padding: 15px; background: #003366; color: #FFCD00; border: 0;
                 border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer;
                 font-family: inherit; margin-bottom: 10px;">
          Activar acceso completo — 49 €
        </button>
        <button onclick="document.getElementById('paywall-overlay').remove();"
          style="background: none; border: 0; color: #94a3b8; font-size: 14px;
                 cursor: pointer; font-family: inherit; padding: 8px;">
          Volver al inicio
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function showOnboarding() {
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: #fff; overflow-y: auto;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    `;
    overlay.innerHTML = `
      <div style="max-width: 520px; width: 100%; font-family: inherit;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 64px; height: 64px; background: #FFCD00; border-radius: 16px;
                      display: inline-flex; align-items: center; justify-content: center;
                      font-size: 28px; font-weight: 800; color: #003366; margin-bottom: 20px;">CT</div>
          <h1 style="font-size: 26px; font-weight: 800; color: #003366; margin: 0 0 10px;">Bienvenido a CorreosTest</h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0;">
            Simulacros idénticos al examen real, predicción de aprobado y repaso inteligente.
            <b>Una pregunta antes de empezar:</b>
          </p>
        </div>

        <div style="background: #f8fafc; border-radius: 14px; padding: 24px; margin-bottom: 24px;">
          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 6px; color: #0f172a;">¿A qué puesto te presentas?</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 18px;">
            El temario y el examen son los mismos para todos, pero el número de aciertos para aprobar cambia según el puesto.
          </p>
          <div id="onboarding-puestos" style="display: flex; flex-direction: column; gap: 10px;">
            ${TEMARIO.exam.puestos.map(p => `
              <button
                onclick="IIAPP.UI.onboardingSelectPuesto('${p.id}')"
                style="display: flex; justify-content: space-between; align-items: center;
                       padding: 16px 18px; border: 2px solid #e5e7eb; border-radius: 12px;
                       background: #fff; cursor: pointer; text-align: left; width: 100%;
                       font-family: inherit; transition: all 0.15s;"
                onmouseover="this.style.borderColor='#003366'; this.style.background='#f0f4f8';"
                onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='#fff';">
                <div>
                  <div style="font-weight: 600; font-size: 15px; color: #0f172a;">${p.nombre}</div>
                  <div style="font-size: 13px; color: #64748b; margin-top: 3px;">${p.descripcion}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0; margin-left: 12px;">
                  <div style="font-size: 22px; font-weight: 800; color: #003366;">${p.aciertos}</div>
                  <div style="font-size: 11px; color: #64748b;">aciertos para aprobar</div>
                </div>
              </button>
            `).join('')}
          </div>
        </div>

        <p style="text-align: center; font-size: 13px; color: #94a3b8;">
          Podrás cambiar el puesto en cualquier momento desde <b>Mi cuenta</b>.
        </p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
