// Temario de la oposición a Correos · Personal Laboral Indefinido Grupo IV
// Estructura aproximada basada en las últimas convocatorias.
// Se ajustará cuando se publique el temario oficial de la convocatoria 2026.

window.CORREOS = window.CORREOS || {};
// Alias compat con motor heredado IIAPP
window.IIAPP = window.CORREOS;

window.CORREOS.TEMARIO = {
  modules: [
    {
      number: 1,
      name: 'Tema 1: Productos y servicios postales',
      shortName: 'Productos y servicios',
      weight: 0.10,
      color: '#003366',
      topics: [
        { number: 1, name: 'Productos de Correos: cartas, postales, paquetes, valores declarados' }
      ]
    },
    {
      number: 2,
      name: 'Tema 2: La admisión',
      shortName: 'Admisión',
      weight: 0.10,
      color: '#0055A0',
      topics: [
        { number: 2, name: 'Procesos de admisión: ventanilla, contratos, IRIS' }
      ]
    },
    {
      number: 3,
      name: 'Tema 3: Curso interno y clasificación',
      shortName: 'Clasificación',
      weight: 0.08,
      color: '#0077C0',
      topics: [
        { number: 3, name: 'Tratamiento, encaminamiento, clasificación automatizada' }
      ]
    },
    {
      number: 4,
      name: 'Tema 4: Reparto',
      shortName: 'Reparto',
      weight: 0.10,
      color: '#FFCD00',
      topics: [
        { number: 4, name: 'Reparto urbano, rural, motorizado, a pie' }
      ]
    },
    {
      number: 5,
      name: 'Tema 5: Liquidación y servicios financieros',
      shortName: 'Servicios financieros',
      weight: 0.08,
      color: '#E5B800',
      topics: [
        { number: 5, name: 'Giros, reembolsos, Western Union, tarjeta Correos Prepago' }
      ]
    },
    {
      number: 6,
      name: 'Tema 6: Atención al cliente',
      shortName: 'Atención al cliente',
      weight: 0.10,
      color: '#1D9E75',
      topics: [
        { number: 6, name: 'Calidad, reclamaciones, comunicación con clientes' }
      ]
    },
    {
      number: 7,
      name: 'Tema 7: Paquetería y comercio electrónico',
      shortName: 'Paquetería',
      weight: 0.10,
      color: '#0F8060',
      topics: [
        { number: 7, name: 'Paq72, Paq48, Paq24, Paq Estándar, devoluciones' }
      ]
    },
    {
      number: 8,
      name: 'Tema 8: Servicios digitales',
      shortName: 'Servicios digitales',
      weight: 0.08,
      color: '#8B4FBC',
      topics: [
        { number: 8, name: 'Notificaciones electrónicas, Correos ID, Citypaq' }
      ]
    },
    {
      number: 9,
      name: 'Tema 9: Prevención de riesgos laborales',
      shortName: 'PRL',
      weight: 0.08,
      color: '#C03030',
      topics: [
        { number: 9, name: 'Seguridad, ergonomía, equipos de protección individual' }
      ]
    },
    {
      number: 10,
      name: 'Tema 10: Igualdad y prevención del acoso',
      shortName: 'Igualdad',
      weight: 0.06,
      color: '#BA7517',
      topics: [
        { number: 10, name: 'Plan de igualdad, prevención del acoso laboral y sexual' }
      ]
    },
    {
      number: 11,
      name: 'Tema 11: Protección de datos',
      shortName: 'Protección de datos',
      weight: 0.06,
      color: '#475569',
      topics: [
        { number: 11, name: 'RGPD, secreto de las comunicaciones postales' }
      ]
    },
    {
      number: 12,
      name: 'Tema 12: Sostenibilidad y responsabilidad social',
      shortName: 'Sostenibilidad',
      weight: 0.06,
      color: '#10b981',
      topics: [
        { number: 12, name: 'Compromisos medioambientales y sociales de Correos' }
      ]
    }
  ],

  exam: {
    body: 'Correos · Personal Laboral Indefinido Grupo IV',
    test: {
      questions: 100,
      durationMinutes: 110,
      penalty: 0,                  // sin penalización
      options: 4,
      pointsPerCorrect: 0.1,       // 100 × 0,1 = 10 max
      passThreshold: 5.5           // umbral por defecto (Reparto / Clasificación)
    },
    // Mantenemos compatibilidad con stats.js heredado (umbral fijo)
    cutOffHistory: {
      2026: 5.5,
      2025: 5.5,
      2024: 5.5,
      2023: 5.5,
      2022: 5.5
    },
    // 4 puestos dentro del Grupo Profesional IV de Correos
    // Comparten el mismo temario y examen, solo cambia el umbral de aprobado.
    puestos: [
      {
        id: 'reparto1',
        nombre: 'Reparto motorizado (Reparto 1)',
        nombreCorto: 'Reparto motorizado',
        descripcion: 'Reparto en moto o furgoneta',
        aciertos: 55,
        umbral: 5.5,
        plazasTipicas: 'Mayoría de plazas en cada convocatoria'
      },
      {
        id: 'reparto2',
        nombre: 'Reparto a pie (Reparto 2)',
        nombreCorto: 'Reparto a pie',
        descripcion: 'Reparto andando por zonas urbanas',
        aciertos: 55,
        umbral: 5.5,
        plazasTipicas: 'Frecuente en grandes ciudades'
      },
      {
        id: 'clasificacion',
        nombre: 'Agente de Clasificación',
        nombreCorto: 'Clasificación',
        descripcion: 'Centros automatizados, ordenación de correo',
        aciertos: 55,
        umbral: 5.5,
        plazasTipicas: 'Plazas constantes en CTA'
      },
      {
        id: 'atencion',
        nombre: 'Atención al Cliente',
        nombreCorto: 'Atención al cliente',
        descripcion: 'Mostrador en oficinas',
        aciertos: 60,
        umbral: 6.0,
        plazasTipicas: 'Menos plazas, exige más aciertos'
      }
    ],
    puestoDefault: 'reparto1'
  },

  // Helper: devuelve el umbral (sobre 10) del puesto seleccionado
  getThresholdForPuesto: function(puestoId) {
    const p = this.exam.puestos.find(x => x.id === puestoId);
    return p ? p.umbral : this.exam.test.passThreshold;
  },

  // Helper: devuelve el puesto entero o el default
  getPuesto: function(puestoId) {
    return this.exam.puestos.find(x => x.id === puestoId)
      || this.exam.puestos.find(x => x.id === this.exam.puestoDefault);
  },

  fuente: 'Convocatoria Correos · Personal Laboral Grupo IV (BOE en función del año)',
  notas: 'Estructura aproximada. Se actualizará al publicarse el temario oficial de 2026.'
};
