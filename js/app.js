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

  function el(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

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
    // 'temario' y 'tribunal' eran pantallas IIPP-específicas; en Correos no aplican igual
    if (screen === 'temario' && typeof renderTemario === 'function') await renderTemario();
    if (screen === 'tribunal' && typeof renderTribunal === 'function') await renderTribunal();
    if (screen === 'planes') await renderPlanes();
    if (screen === 'cuenta') await renderCuenta();
    if (screen === 'settings') await renderSettings();
    if (screen === 'result') await renderResult(params.sessionId);

    // Actualizar nav activa
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    const active = $(`[data-nav="${screen}"]`);
    if (active) active.classList.add('active');

    window.scrollTo(0, 0);
  }

  // ========== PANTALLA: HOME (DASHBOARD) ==========

  async function renderHome() {
    const target = $('#screen-home');
    const g = await Stats.global();
    const last7 = await Stats.last7Days();
    const modules = await Stats.byModule();
    const prediction = await Stats.predictApproval();
    const dueCount = await SRS.countDue();
    const profile = await Storage.getAllProfile();

    const greeting = profile.alias ? `Hola, ${profile.alias}` : 'Hola, futur@ funcionari@ de Correos';
    const puestoActual = TEMARIO.getPuesto(profile.puesto);

    target.innerHTML = `
      <div class="container">
        <div class="puesto-banner">
          <div class="puesto-banner-name">
            Te estás preparando para: <span>${puestoActual.nombreCorto}</span>
            <div class="text-muted small" style="color: #cbd5e1; margin-top: 2px;">${puestoActual.descripcion} · aprueba con ${puestoActual.aciertos} aciertos</div>
          </div>
          <button class="puesto-banner-link" onclick="IIAPP.UI.show('cuenta')">Cambiar puesto</button>
        </div>

        <div class="header-row">
          <div>
            <h1 class="page-title">${greeting}</h1>
            <p class="page-subtitle">${g.total === 0 ? 'Empieza con un test de diagnóstico' : `${g.total} preguntas respondidas · ${g.simulacros} simulacros`}</p>
          </div>
          ${g.currentStreak > 1 ? `<div class="streak-badge">🔥 ${g.currentStreak} días</div>` : ''}
        </div>

        <div class="cards-grid">
          <div class="metric-card">
            <div class="metric-label">Hoy</div>
            <div class="metric-value">${last7.count}</div>
            <div class="metric-sub">preguntas (7d)</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">% acierto</div>
            <div class="metric-value ${last7.accuracy >= 60 ? 'metric-ok' : 'metric-warn'}">${last7.count ? fmt(last7.accuracy, 0) + '%' : '—'}</div>
            <div class="metric-sub">últimos 7 días</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Simulacros</div>
            <div class="metric-value">${g.simulacros}</div>
            <div class="metric-sub">completados</div>
          </div>
          <div class="metric-card metric-prediction">
            <div class="metric-label">Predicción IA</div>
            <div class="metric-value">${prediction.probability != null ? prediction.probability + '%' : '—'}</div>
            <div class="metric-sub">de aprobar</div>
          </div>
        </div>

        <div class="two-col">
          <div class="col-main">
            <div class="card">
              <div class="card-header">
                <h3>Tu progreso por bloque</h3>
                <span class="text-muted">% acierto</span>
              </div>
              <div class="module-list">
                ${TEMARIO.modules.map(m => {
                  const data = modules[m.number];
                  const pct = data && data.accuracy != null ? data.accuracy : 0;
                  const status = data && data.accuracy != null
                    ? (pct >= 70 ? 'ok' : pct >= 50 ? 'mid' : 'warn')
                    : 'empty';
                  return `
                    <div class="module-row">
                      <div class="module-row-head">
                        <span class="module-name">${m.shortName}</span>
                        <span class="module-pct ${status}">${data && data.accuracy != null ? fmt(pct, 0) + '%' : 'sin datos'} ${data && data.total ? `<span class="text-muted">(${data.correct}/${data.total})</span>` : ''}</span>
                      </div>
                      <div class="bar"><div class="bar-fill bar-${status}" style="width:${pct}%; background:${status === 'empty' ? '#e2e8f0' : m.color}"></div></div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <h3>Acción recomendada</h3>
              </div>
              ${renderRecommendation(modules, prediction)}
            </div>
          </div>

          <div class="col-side">
            <div class="card srs-card">
              <div class="card-header">
                <h3>Repaso de hoy</h3>
                <span class="badge badge-warn">SRS</span>
              </div>
              <p class="text-muted small">${dueCount > 0 ? `${dueCount} preguntas listas para repasar` : 'Sin nada pendiente. Haz tests para alimentar el SRS.'}</p>
              <button class="btn btn-primary btn-block" ${dueCount === 0 ? 'disabled' : ''} onclick="IIAPP.UI.startSrsReview()">
                ${dueCount > 0 ? 'Empezar repaso' : 'No hay pendiente'}
              </button>
            </div>

            <div class="card">
              <div class="card-header"><h3>Inicio rápido</h3></div>
              <div class="quick-actions">
                <button class="quick-btn" onclick="IIAPP.UI.startQuick(10)">
                  <div class="quick-btn-num">10</div>
                  <div class="quick-btn-label">preguntas mixtas</div>
                </button>
                <button class="quick-btn" onclick="IIAPP.UI.startQuick(25)">
                  <div class="quick-btn-num">25</div>
                  <div class="quick-btn-label">test medio</div>
                </button>
                <button class="quick-btn" onclick="IIAPP.UI.startSimulacro()">
                  <div class="quick-btn-num">⏱</div>
                  <div class="quick-btn-label">Simulacro</div>
                </button>
                <button class="quick-btn" onclick="IIAPP.UI.startFailedReview()">
                  <div class="quick-btn-num">↻</div>
                  <div class="quick-btn-label">Repasar fallos</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderRecommendation(modules, prediction) {
    // Encuentra el módulo más flojo con datos
    const modArr = Object.values(modules).filter(m => m.accuracy != null);
    if (modArr.length === 0) {
      return `
        <p>Aún no tenemos datos de tu rendimiento. Empieza con un <b>test de 10 preguntas mixtas</b> para que la IA detecte tus puntos fuertes y débiles.</p>
        <button class="btn btn-primary" onclick="IIAPP.UI.startQuick(10)">Empezar diagnóstico</button>
      `;
    }
    const weakest = modArr.reduce((a, b) => a.accuracy < b.accuracy ? a : b);
    if (weakest.accuracy < 60) {
      return `
        <p>Tu punto más flojo es <b>${weakest.moduleName}</b> (${fmt(weakest.accuracy, 0)}% acierto). Empezar con un repaso enfocado de 25 preguntas en este módulo.</p>
        <button class="btn btn-primary" onclick="IIAPP.UI.startModule(${weakest.moduleNumber}, 25)">Practicar ${weakest.moduleName}</button>
      `;
    }
    return `
      <p>Tu rendimiento es bueno en todos los módulos. Para consolidar y subir la predicción, te sugiero un <b>simulacro completo</b> esta semana.</p>
      <button class="btn btn-primary" onclick="IIAPP.UI.startSimulacro()">Empezar simulacro</button>
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

    let iaBlock = '';
    if (!isCorrect && q.iaFallo && q.iaFallo[originalLetter]) {
      iaBlock = `
        <div class="fb-card fb-ia">
          <div class="fb-tag">IA · TU FALLO</div>
          <p>${q.iaFallo[originalLetter]}</p>
        </div>
      `;
    }

    const highlightedTemario = q.temarioText.replace(
      q.temarioHighlight,
      `<span class="highlight">${q.temarioHighlight}</span>`
    );

    fb.classList.remove('hidden');
    fb.innerHTML = `
      <div class="fb-card ${isCorrect ? 'fb-ok' : 'fb-err'}">
        <div class="fb-title">${isCorrect ? '✓ Correcto' : '✗ Incorrecto'}</div>
        <p>${q.explanation}</p>
      </div>
      ${iaBlock}
      <div class="fb-card fb-temario">
        <div class="fb-tag">📖 Del temario</div>
        <blockquote>"${highlightedTemario}"</blockquote>
        <div class="fb-source">${q.temarioSource}</div>
      </div>
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
            srs: 'repaso SRS', simulacro: 'simulacro'
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
                      srs: 'SRS', simulacro: '⏱ Simulacro'
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
        <h1 class="page-title">Temario oficial</h1>
        <p class="page-subtitle">12 temas · Basado en la convocatoria oficial y la legislación vigente</p>

        <div class="temario-nav">${navBtns}</div>

        ${legislacionBadges ? `<div style="margin-bottom: 16px;">${legislacionBadges}</div>` : ''}

        <div class="tema-content">${contenido}</div>
      </div>
    `;
  }

  // ========== PANTALLA: PLANES ==========

  const PLAN_CATALOG = {
    free: {
      id: 'free', name: 'Gratuito', price: 0, priceLabel: '0 €',
      tag: '', recommended: false,
      features: [
        '200 preguntas de prueba',
        '1 simulacro completo a la semana',
        'Estadísticas básicas',
        'Histórico últimos 7 días',
        'Soporte por email',
      ],
    },
    completo: {
      id: 'completo', name: 'Acceso al concurso', price: 49, priceLabel: '49 €',
      tag: 'Recomendado', recommended: true, monthly: 'pago único hasta el examen',
      features: [
        'Las 13.000+ preguntas oficiales',
        'Simulacros ilimitados cronometrados',
        'Repaso espaciado (recuerda mejor lo que fallas)',
        'Predicción de probabilidad de aprobado',
        'Estadísticas por tema',
        'Funciona sin conexión',
        'Acceso completo hasta la fecha del examen',
        'Sin renovación automática',
      ],
    },
    premium: {
      id: 'premium', name: 'Premium', price: 79, priceLabel: '79 €',
      tag: 'Con audio', recommended: false, monthly: 'pago único hasta el examen',
      features: [
        'Todo lo del plan Acceso al concurso',
        'Audio del temario completo (escucha mientras conduces o paseas)',
        'Plan de estudio personalizado por IA',
        'Análisis de tus puntos débiles',
        'Recordatorios de repaso',
        'Soporte prioritario',
      ],
      compare: 'Las academias online cobran 300-1.500 € por la misma preparación',
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
              ['Banco completo (13.000+ preg)', '−', '✓', '✓'],
              ['Simulacros ilimitados', '1/sem', '✓', '✓'],
              ['Repaso espaciado', '−', '✓', '✓'],
              ['Predicción de aprobado', '−', '✓', '✓'],
              ['Estadísticas por tema', '−', '✓', '✓'],
              ['Funciona sin conexión', '✓', '✓', '✓'],
              ['Audio del temario', '−', '−', '✓'],
              ['Plan personalizado IA', '−', '−', '✓'],
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
            <input type="text" id="cuenta-name" value="${profile.name || ''}" placeholder="Tu nombre" maxlength="60">
          </label>
          <label class="form-row">
            <span>Email</span>
            <input type="email" id="cuenta-email" value="${profile.email || ''}" placeholder="tu@email.com" maxlength="120">
          </label>
          <label class="form-row">
            <span>Alias en ranking</span>
            <input type="text" id="cuenta-alias" value="${profile.alias || ''}" placeholder="Sin alias" maxlength="20">
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
            <input type="text" id="alias-input" value="${profile.alias || ''}" placeholder="Sin alias" maxlength="20">
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
          <h3>Datos</h3>
          <p class="text-muted">${g.total} respuestas · ${g.sessions} sesiones · ${learned} preguntas en SRS</p>
          <div class="actions-row">
            <button class="btn btn-secondary" onclick="IIAPP.Storage.exportAll()">Exportar a JSON</button>
            <label class="btn btn-secondary">
              Importar JSON
              <input type="file" accept=".json" onchange="IIAPP.UI.importBackup(event)" style="display:none">
            </label>
            <button class="btn btn-danger" onclick="IIAPP.UI.confirmClear()">Borrar todo</button>
          </div>
        </div>

        <div class="card">
          <h3>Sobre la app</h3>
          <p class="text-muted small">CorreosTest — versión local v0.1</p>
          <p class="text-muted small">App de preparación para la oposición a Correos. Funciona 100% local en tu dispositivo, sin servidores.</p>
          <p class="text-muted small">${QUESTIONS.length} preguntas en el banco actual.</p>
        </div>
      </div>
    `;
  }

  // ========== FLUJO DE UPGRADE DEEP-LINK (simulado) ==========

  function runUpgradeFlow(planId, email) {
    const plan = PLAN_CATALOG[planId];
    const overlay = document.createElement('div');
    overlay.className = 'tribunal-overlay upgrade-flow';
    document.body.appendChild(overlay);

    // Paso 1: app pide token y abre navegador
    overlay.innerHTML = `
      <div class="upgrade-screen up-step1">
        <div class="up-device-frame">
          <div class="up-device-screen">
            <div class="up-app-bar">IIAPP · Cuenta</div>
            <div class="up-loading">
              <div class="up-spinner"></div>
              <p>Solicitando token seguro...</p>
              <p class="text-muted small">POST /api/auth/upgrade-token</p>
            </div>
          </div>
        </div>
        <div class="up-caption">
          <h4>Paso 1 · La app pide al backend un JWT efímero (5 min de vida)</h4>
          <p class="text-muted small">El token contiene tu userId y un scope limitado a "upgrade". Tu app móvil nunca tiene la clave de firma.</p>
        </div>
      </div>
    `;
    setTimeout(() => stepBrowser(), 1200);

    // Paso 2: navegador abre la web con el token
    function stepBrowser() {
      overlay.innerHTML = `
        <div class="upgrade-screen up-step2">
          <div class="up-browser-frame">
            <div class="up-browser-bar">
              <span class="up-url">🔒 correostest.es/u?t=eyJhbGc...&plan=${planId}</span>
            </div>
            <div class="up-browser-page">
              <div class="up-checkout">
                <h3>Activar ${plan.name}</h3>
                <div class="up-price-row">
                  <span>${plan.name} · 1 año</span>
                  <b>${plan.priceLabel}</b>
                </div>
                <div class="up-row text-muted small">
                  <span>IVA incluido</span>
                  <span>Pago único hasta el examen · Sin renovación automática</span>
                </div>
                <div class="up-pay-buttons">
                  <button class="up-paybtn up-applepay" onclick="IIAPP.UI._payStep('${planId}', '${email}', 'Apple Pay')">
                     Pay
                  </button>
                  <button class="up-paybtn up-googlepay" onclick="IIAPP.UI._payStep('${planId}', '${email}', 'Google Pay')">
                    G Pay
                  </button>
                  <button class="up-paybtn up-bizum" onclick="IIAPP.UI._payStep('${planId}', '${email}', 'Bizum')">
                    Bizum
                  </button>
                  <button class="up-paybtn up-card" onclick="IIAPP.UI._payStep('${planId}', '${email}', 'Tarjeta')">
                    💳 Tarjeta
                  </button>
                </div>
                <p class="up-secure-text">Pago seguro con Stripe · Powered by ${email}</p>
              </div>
            </div>
          </div>
          <div class="up-caption">
            <h4>Paso 2 · Stripe Checkout en navegador externo (no webview)</h4>
            <p class="text-muted small">El token validó tu sesión. Elige método de pago — todo es 1 toque biométrico. Comisión Stripe ~1,8%, comisión Apple/Google <b>0%</b>.</p>
          </div>
          <button class="btn-link up-cancel" onclick="this.closest('.tribunal-overlay').remove()">✕ Cancelar simulación</button>
        </div>
      `;
    }
  }

  async function _payStep(planId, email, method) {
    const plan = PLAN_CATALOG[planId];
    const overlay = document.querySelector('.tribunal-overlay.upgrade-flow');
    if (!overlay) return;

    // Paso 2.5: biometría
    overlay.innerHTML = `
      <div class="upgrade-screen up-step2b">
        <div class="up-bio-prompt">
          <div class="up-bio-icon">${method === 'Apple Pay' ? '👤' : method === 'Google Pay' ? '👆' : method === 'Bizum' ? '📱' : '🔐'}</div>
          <h3>Confirmar con ${method}</h3>
          <p class="text-muted">${plan.priceLabel} a IIAPP</p>
          <div class="up-bio-action">
            <div class="up-bio-pulse"></div>
            <p class="small">Autentícate para confirmar el pago</p>
          </div>
        </div>
        <div class="up-caption">
          <h4>Biometría nativa (FaceID / TouchID / huella)</h4>
          <p class="text-muted small">Mismo gesto que un pago in-app, pero la pasarela es Stripe.</p>
        </div>
      </div>
    `;
    await new Promise(r => setTimeout(r, 1400));

    // Paso 3: procesando webhook
    overlay.innerHTML = `
      <div class="upgrade-screen up-step3">
        <div class="up-pipeline">
          <div class="up-pipe-step up-done">
            <div class="up-check">✓</div>
            <span>Stripe cobra ${plan.priceLabel}</span>
          </div>
          <div class="up-pipe-arrow">↓</div>
          <div class="up-pipe-step up-active">
            <div class="up-spinner"></div>
            <span>Webhook → backend actualiza users.plan</span>
          </div>
          <div class="up-pipe-arrow">↓</div>
          <div class="up-pipe-step">
            <div class="up-circle"></div>
            <span>Universal Link abre la app</span>
          </div>
        </div>
        <div class="up-caption">
          <h4>Paso 3 · Webhook async actualiza tu plan en BD (&lt;2 s)</h4>
          <p class="text-muted small">Idempotente — si Stripe reenvía el evento, no se duplica gracias a la tabla stripe_events.</p>
        </div>
      </div>
    `;

    const oneYear = 365 * 24 * 60 * 60 * 1000;
    await Storage.setProfile('plan', planId);
    await Storage.setProfile('planActivatedAt', Date.now());
    await Storage.setProfile('planExpires', Date.now() + oneYear);
    await new Promise(r => setTimeout(r, 1500));

    // Paso 4: deep link de retorno
    overlay.innerHTML = `
      <div class="upgrade-screen up-step4">
        <div class="up-redirect">
          <div class="up-redirect-icon">↩</div>
          <h3>iiapp://payment/success</h3>
          <p class="text-muted small">El sistema operativo abre la app instalada</p>
          <div class="up-spinner"></div>
        </div>
        <div class="up-caption">
          <h4>Paso 4 · Universal Link / App Link de retorno</h4>
          <p class="text-muted small">La app refresca el perfil con GET /api/me y desbloquea las funciones del nuevo plan.</p>
        </div>
      </div>
    `;
    await new Promise(r => setTimeout(r, 1100));

    // Paso 5: app vuelve con plan activo
    overlay.innerHTML = `
      <div class="upgrade-screen up-success">
        <div class="up-success-icon">✓</div>
        <h2>${plan.name} activado</h2>
        <p>Tu cuenta <b>${email}</b> tiene ahora todas las funciones de ${plan.name} disponibles durante 1 año.</p>
        <div class="up-features-quick">
          ${plan.features.slice(0, 4).map(f => `<div class="up-feat">✓ ${f}</div>`).join('')}
        </div>
        <button class="btn btn-primary" onclick="this.closest('.tribunal-overlay').remove(); IIAPP.UI.show('cuenta');">Ir a mi cuenta</button>
      </div>
    `;
  }

  // ========== GENERACIÓN DE PDFs (vía window.print) ==========

  function _renderTemaHtml(tema, content) {
    return `
      <article class="pdf-tema">
        <header class="pdf-tema-head" style="border-color: ${tema.mod ? tema.mod.color : '#0C447C'}">
          <div class="pdf-tema-num">${String(tema.number).padStart(2, '0')}</div>
          <div>
            ${tema.mod ? `<div class="pdf-tema-mod">Módulo ${tema.mod.number} · ${tema.mod.name}</div>` : ''}
            <h1>${tema.name}</h1>
          </div>
        </header>
        <section class="pdf-tema-body">
          <p>${content}</p>
        </section>
        <footer class="pdf-tema-foot">
          <span>CorreosTest · Preparación oposición Correos</span>
          <span>correostest.es</span>
        </footer>
      </article>
    `;
  }

  function _openPrintWindow(title, htmlBody) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      alert('Tu navegador bloqueó la apertura de ventana. Permite popups de localhost para descargar el PDF.');
      return;
    }
    const styles = `
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', system-ui, sans-serif;
          color: #0f172a; line-height: 1.55; margin: 0; padding: 0;
          font-size: 11.5pt;
        }
        h1, h2 { font-weight: 600; }
        .pdf-cover {
          padding: 60px 30px; min-height: 90vh;
          display: flex; flex-direction: column; justify-content: center; gap: 12px;
          page-break-after: always;
        }
        .pdf-logo {
          background: #0C447C; color: white;
          width: 80px; height: 80px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; font-weight: 700; margin-bottom: 24px;
        }
        .pdf-cover h1 { font-size: 36pt; margin: 0; }
        .pdf-cover h2 { font-size: 16pt; color: #64748b; font-weight: 500; margin: 8px 0 24px; }
        .pdf-cover-meta { color: #64748b; font-size: 10pt; margin-bottom: 32px; }
        .pdf-cover-modules { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .pdf-cover-mod {
          padding: 10px 14px; border-left: 4px solid #ccc; background: #f8fafc;
          font-size: 11pt;
        }
        .pdf-module-title {
          font-size: 22pt; padding: 8px 0; margin: 24px 0 8px;
          border-bottom: 3px solid;
        }
        .pdf-module-desc { color: #64748b; margin: 0 0 24px; }
        .pdf-tema {
          page-break-inside: avoid;
          break-inside: avoid;
          padding: 12px 0;
        }
        .pdf-tema-head {
          display: flex; align-items: center; gap: 16px;
          padding-bottom: 12px; margin-bottom: 16px;
          border-bottom: 2px solid #0C447C;
        }
        .pdf-tema-num {
          background: #0C447C; color: white;
          width: 48px; height: 48px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18pt; font-weight: 700; flex-shrink: 0;
        }
        .pdf-tema-mod { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .pdf-tema-head h1 { font-size: 18pt; margin: 4px 0 0; line-height: 1.2; }
        .pdf-tema-body { padding: 0 4px; text-align: justify; }
        .pdf-tema-body p { margin: 0 0 12px; }
        .pdf-tema-foot {
          margin-top: 18px; padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          display: flex; justify-content: space-between;
          font-size: 8pt; color: #94a3b8;
        }
        .page-break { page-break-after: always; break-after: page; height: 0; }
        .text-muted { color: #64748b; }
        .small { font-size: 9pt; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    `;
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body>${htmlBody}<script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));<\/script></body></html>`);
    w.document.close();
  }

  // ========== UI HELPERS ==========

  const UI = {
    _payStep,
    show,

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

    // Primera apertura: si no ha elegido puesto, mostrar onboarding
    if (!profile.puesto) {
      showOnboarding();
    } else {
      show('home');
    }
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
