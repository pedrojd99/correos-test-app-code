// Repaso espaciado (Spaced Repetition System)
// Algoritmo SM-2 simplificado al estilo Anki
//
// Estado por pregunta:
//   { questionId, easeFactor, intervalDays, repetitions, nextReviewAt, lastReviewedAt }
//
// Calidad de respuesta (input):
//   0 = fallo total (resetea progreso)
//   3 = correcto pero con esfuerzo
//   4 = correcto con confianza
//   5 = perfecto, instantáneo
//
// Para simplificar la UX, mapeamos:
//   - Fallo en test → quality = 0 (resetea)
//   - Acierto en test → quality = 4 (correcto con confianza)
//   - Acierto en repaso SRS rápido → quality = 5

window.IIAPP = window.IIAPP || {};

window.IIAPP.SRS = (function() {
  const Storage = window.IIAPP.Storage;

  function defaultState(questionId) {
    return {
      questionId,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      nextReviewAt: Date.now(),
      lastReviewedAt: null
    };
  }

  // Devuelve el nuevo estado SRS tras una respuesta
  function calculate(prevState, quality) {
    const now = Date.now();
    let { easeFactor, intervalDays, repetitions } = prevState || {};
    easeFactor = easeFactor || 2.5;
    intervalDays = intervalDays || 0;
    repetitions = repetitions || 0;

    if (quality < 3) {
      // Fallo: resetea repeticiones, intervalo corto
      repetitions = 0;
      intervalDays = 1;
    } else {
      // Acierto: progresa
      repetitions += 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 3;
      else intervalDays = Math.round(intervalDays * easeFactor);
    }

    // Ajuste del factor de facilidad
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const nextReviewAt = now + intervalDays * 24 * 60 * 60 * 1000;

    return {
      questionId: prevState.questionId,
      easeFactor: Math.round(easeFactor * 100) / 100,
      intervalDays,
      repetitions,
      nextReviewAt,
      lastReviewedAt: now
    };
  }

  // Registra un resultado en el SRS para una pregunta
  async function record(questionId, isCorrect, quickness = 'normal') {
    const prev = (await Storage.getSrsState(questionId)) || defaultState(questionId);
    let quality;
    if (!isCorrect) quality = 0;
    else if (quickness === 'fast') quality = 5;
    else quality = 4;
    const next = calculate(prev, quality);
    await Storage.saveSrsState(next);
    return next;
  }

  // Devuelve preguntas pendientes de revisar HOY
  async function getDueToday() {
    const due = await Storage.getSrsDue(Date.now());
    return due;
  }

  async function countDue() {
    const due = await getDueToday();
    return due.length;
  }

  async function countLearned() {
    const all = await Storage.getAllSrsStates();
    return all.filter(s => s.repetitions >= 1).length;
  }

  return {
    calculate, record, getDueToday, countDue, countLearned, defaultState
  };
})();
