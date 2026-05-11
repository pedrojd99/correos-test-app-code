// Selección y filtrado del banco de preguntas según modo

window.IIAPP = window.IIAPP || {};

window.IIAPP.Data = (function() {
  const QUESTIONS = window.IIAPP.QUESTIONS;
  const QUESTIONS_BY_MODULE = window.IIAPP.QUESTIONS_BY_MODULE;
  const TEMARIO = window.IIAPP.TEMARIO;
  const Stats = window.IIAPP.Stats;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Selecciona N preguntas distribuidas según pesos del temario
  function weighted(num) {
    const result = [];
    TEMARIO.modules.forEach(m => {
      const target = Math.round(num * m.weight);
      const pool = shuffle(QUESTIONS_BY_MODULE[m.number] || []);
      result.push(...pool.slice(0, target));
    });
    // Si por redondeo nos pasamos o faltamos, ajustar
    while (result.length < num && QUESTIONS.length > result.length) {
      const remaining = QUESTIONS.filter(q => !result.includes(q));
      if (remaining.length === 0) break;
      result.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
    return shuffle(result.slice(0, num));
  }

  function fromModules(moduleNumbers, num) {
    const pool = QUESTIONS.filter(q => moduleNumbers.includes(q.module));
    return shuffle(pool).slice(0, num);
  }

  async function fromFailed(num) {
    const failedIds = await Stats.failedQuestionIds();
    const pool = QUESTIONS.filter(q => failedIds.includes(q.id));
    return shuffle(pool).slice(0, num);
  }

  async function fromSrsDue(num) {
    const due = await window.IIAPP.SRS.getDueToday();
    const ids = due.map(d => d.questionId);
    const pool = QUESTIONS.filter(q => ids.includes(q.id));
    return shuffle(pool).slice(0, num || pool.length);
  }

  // Configuración de un test "real" tipo Correos (simulacro: 100 preguntas)
  function simulacro() {
    const n = (TEMARIO && TEMARIO.exam && TEMARIO.exam.test && TEMARIO.exam.test.questions) || 100;
    return weighted(Math.min(n, QUESTIONS.length));
  }

  // Simulacro adaptativo: redistribuye preguntas según rendimiento del usuario.
  // Los temas con peor acierto y mayor peso en el examen reciben más preguntas.
  async function simulacroAdaptivo() {
    const n = (TEMARIO && TEMARIO.exam && TEMARIO.exam.test && TEMARIO.exam.test.questions) || 100;
    let modStats;
    try { modStats = await window.IIAPP.Stats.byModule(); } catch(e) { return weighted(n); }

    let totalW = 0;
    const adaptW = {};
    TEMARIO.modules.forEach(m => {
      const stat = modStats[m.number];
      const acc = stat && stat.total > 0 ? stat.accuracy / 100 : 0.5;
      // Peso adaptado: temas flojos y con más peso oficial reciben más preguntas
      const w = m.weight * (1.2 - Math.min(acc, 1));
      adaptW[m.number] = w;
      totalW += w;
    });

    const result = [];
    TEMARIO.modules.forEach(m => {
      const proportion = adaptW[m.number] / totalW;
      const target = Math.max(1, Math.round(n * proportion));
      const pool = shuffle(QUESTIONS_BY_MODULE[m.number] || []);
      result.push(...pool.slice(0, target));
    });

    while (result.length < n) {
      const remaining = QUESTIONS.filter(q => !result.includes(q));
      if (!remaining.length) break;
      result.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
    return shuffle(result.slice(0, n));
  }

  // Mezclar opciones (A/B/C/D) manteniendo la lógica de respuesta correcta
  function shuffleOptions(question) {
    const shuffled = shuffle(question.options);
    return {
      ...question,
      options: shuffled.map((opt, idx) => ({
        ...opt,
        letter: ['A', 'B', 'C', 'D'][idx],
        originalLetter: opt.letter
      })),
      correctOriginal: question.correct,
      correct: shuffled.find(o => o.letter === question.correct)
        ? ['A', 'B', 'C', 'D'][shuffled.findIndex(o => o.letter === question.correct)]
        : question.correct
    };
  }

  return {
    weighted, fromModules, fromFailed, fromSrsDue, simulacro, simulacroAdaptivo, shuffleOptions, shuffle
  };
})();
