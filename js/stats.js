// Estadísticas, métricas y predicción de aprobado

window.IIAPP = window.IIAPP || {};

window.IIAPP.Stats = (function() {
  const Storage = window.IIAPP.Storage;
  const TEMARIO = window.IIAPP.TEMARIO;
  const QUESTIONS = window.IIAPP.QUESTIONS;
  const QUESTION_BY_ID = window.IIAPP.QUESTION_BY_ID;

  // Métricas generales del usuario
  async function global() {
    const answers = await Storage.getAllAnswers();
    const sessions = await Storage.getAllSessions();
    if (answers.length === 0) {
      return {
        total: 0, correct: 0, accuracy: 0, sessions: 0, simulacros: 0,
        timeSpentSeconds: 0, currentStreak: 0
      };
    }
    const total = answers.length;
    const correct = answers.filter(a => a.isCorrect).length;
    const simulacros = sessions.filter(s => s.mode === 'simulacro' && s.finishedAt).length;
    const timeSpentSeconds = answers.reduce((sum, a) => sum + (a.timeSpentSeconds || 0), 0);
    return {
      total, correct,
      accuracy: total ? Math.round((correct / total) * 1000) / 10 : 0,
      sessions: sessions.length,
      simulacros,
      timeSpentSeconds,
      currentStreak: await streakDays()
    };
  }

  // Métricas de los últimos 7 días
  async function last7Days() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const answers = await Storage.getAllAnswers();
    const recent = answers.filter(a => new Date(a.answeredAt).getTime() >= sevenDaysAgo);
    if (recent.length === 0) return { count: 0, accuracy: 0 };
    const correct = recent.filter(a => a.isCorrect).length;
    return {
      count: recent.length,
      accuracy: Math.round((correct / recent.length) * 1000) / 10
    };
  }

  // Métricas por módulo
  async function byModule() {
    const answers = await Storage.getAllAnswers();
    const result = {};
    TEMARIO.modules.forEach(m => {
      const moduleAnswers = answers.filter(a => {
        const q = QUESTION_BY_ID[a.questionId];
        return q && q.module === m.number;
      });
      const correct = moduleAnswers.filter(a => a.isCorrect).length;
      result[m.number] = {
        moduleNumber: m.number,
        moduleName: m.shortName,
        color: m.color,
        total: moduleAnswers.length,
        correct,
        accuracy: moduleAnswers.length
          ? Math.round((correct / moduleAnswers.length) * 1000) / 10
          : null
      };
    });
    return result;
  }

  // Predicción de probabilidad de aprobado (heurística sencilla)
  // Combina:
  //   - Acierto medio reciente
  //   - Acierto reciente vs umbral del puesto elegido
  //   - Número de simulacros completados (factor de confianza)
  async function predictApproval() {
    const sessions = await Storage.getAllSessions();
    const finishedSimulacros = sessions
      .filter(s => s.mode === 'simulacro' && s.finishedAt)
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, 5);

    // Umbral dinámico según el puesto que el usuario ha elegido
    let corte = TEMARIO.exam.cutOffHistory[2024] || 5.5;
    if (typeof TEMARIO.getThresholdForPuesto === 'function') {
      const profile = await Storage.getAllProfile();
      if (profile && profile.puesto) {
        corte = TEMARIO.getThresholdForPuesto(profile.puesto);
      }
    }

    if (finishedSimulacros.length === 0) {
      // Sin simulacros, basamos solo en aciertos generales
      const g = await global();
      if (g.total < 10) return { probability: null, message: 'Necesitas más datos. Haz al menos un simulacro completo.' };
      const score = (g.accuracy / 100) * 10;
      const distance = score - corte;
      const prob = Math.max(8, Math.min(80, 30 + distance * 8));
      return {
        probability: Math.round(prob),
        message: 'Predicción basada en aciertos generales (sin simulacros). Haz un simulacro para mayor precisión.',
        score, corte
      };
    }

    // Media de los últimos simulacros
    const avgScore = finishedSimulacros.reduce((sum, s) => sum + (s.score || 0), 0) / finishedSimulacros.length;
    const distance = avgScore - corte;

    // Confianza por número de simulacros
    const confidenceFactor = Math.min(1, finishedSimulacros.length / 5);

    // Base: 50% si exactamente en nota de corte
    let prob = 50 + distance * 12;
    prob = Math.max(8, Math.min(85, prob));

    // Atemperamos cuanta menor confianza
    if (confidenceFactor < 1) {
      prob = prob * confidenceFactor + 30 * (1 - confidenceFactor);
    }

    let message;
    if (prob >= 65) message = 'Vas bien encaminado. Mantén el ritmo y refuerza los temas más flojos.';
    else if (prob >= 45) message = 'Estás en zona intermedia. Con plan adecuado puedes mejorar significativamente.';
    else message = 'Te queda camino. Es la situación normal al empezar — un plan estructurado de 3–4 meses te lleva fácilmente al umbral de aprobado.';

    return {
      probability: Math.round(prob),
      message,
      score: avgScore,
      corte,
      simulacros: finishedSimulacros.length
    };
  }

  // Racha de días consecutivos con actividad
  async function streakDays() {
    const answers = await Storage.getAllAnswers();
    if (answers.length === 0) return 0;
    const dayKeys = new Set(
      answers.map(a => new Date(a.answeredAt).toISOString().slice(0, 10))
    );
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (dayKeys.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        // Permitir un día de gracia solo el día actual si aún no jugó
        if (streak === 0) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        break;
      }
      if (streak > 365) break; // safety
    }
    return streak;
  }

  // Preguntas más falladas
  async function topFailed(limit = 5) {
    const answers = await Storage.getAllAnswers();
    const byQuestion = {};
    answers.forEach(a => {
      if (!byQuestion[a.questionId]) byQuestion[a.questionId] = { ok: 0, ko: 0 };
      if (a.isCorrect) byQuestion[a.questionId].ok += 1;
      else byQuestion[a.questionId].ko += 1;
    });
    const ranking = Object.entries(byQuestion)
      .filter(([id, v]) => v.ko >= 1 && QUESTION_BY_ID[id])
      .map(([id, v]) => ({
        questionId: id,
        question: QUESTION_BY_ID[id],
        failures: v.ko,
        attempts: v.ok + v.ko,
        failRate: v.ko / (v.ok + v.ko)
      }))
      .sort((a, b) => b.failRate - a.failRate || b.failures - a.failures)
      .slice(0, limit);
    return ranking;
  }

  // IDs de preguntas falladas (para modo "repaso de fallos")
  async function failedQuestionIds() {
    const answers = await Storage.getAllAnswers();
    const failed = new Set();
    const succeeded = new Set();
    // Una pregunta se considera "para repasar" si la última respuesta fue incorrecta
    const sortedByDate = answers.slice().sort(
      (a, b) => new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime()
    );
    sortedByDate.forEach(a => {
      if (a.isCorrect) {
        succeeded.add(a.questionId);
        failed.delete(a.questionId);
      } else {
        failed.add(a.questionId);
      }
    });
    return Array.from(failed);
  }

  return {
    global, last7Days, byModule, predictApproval, streakDays, topFailed, failedQuestionIds
  };
})();
