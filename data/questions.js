// Banco inicial de preguntas para CorreosTest · MUESTRA para probar el motor
// Las preguntas oficiales se cargarán cuando salga el temario de la convocatoria 2026.
// Mientras tanto, estas 30 preguntas permiten validar todo el flujo de la app.

window.CORREOS = window.CORREOS || {};
window.IIAPP = window.CORREOS;  // alias compat

window.CORREOS.QUESTIONS = [

  // ============= TEMA 1: PRODUCTOS Y SERVICIOS POSTALES =============
  {
    id: 'q-001', module: 1, topic: 1,
    text: '¿Cuál es el peso máximo permitido para una carta ordinaria nacional?',
    options: [
      { letter: 'A', text: '500 g' },
      { letter: 'B', text: '2 kg' },
      { letter: 'C', text: '1 kg' },
      { letter: 'D', text: '5 kg' }
    ],
    correct: 'B',
    explanation: 'Las cartas ordinarias nacionales admiten hasta <b>2 kg</b> de peso. Por encima se consideran paquetes.',
    iaFallo: {
      A: 'Has marcado 500 g, que es el límite para envíos urgentes pequeños, no para cartas ordinarias.',
      C: 'Has marcado 1 kg, pero el límite real es el doble.',
      D: '5 kg es el rango ya de paquetería, no de carta.'
    },
    temarioText: 'Las cartas constituyen un servicio postal universal con peso máximo de 2 kg.',
    temarioHighlight: '2 kg',
    temarioSource: 'Tema 1 · Productos y servicios postales',
    difficulty: 1
  },
  {
    id: 'q-002', module: 1, topic: 1,
    text: 'Una carta certificada se diferencia de una carta ordinaria principalmente porque:',
    options: [
      { letter: 'A', text: 'Es más rápida' },
      { letter: 'B', text: 'Se entrega bajo firma del destinatario' },
      { letter: 'C', text: 'No tiene peso máximo' },
      { letter: 'D', text: 'Es internacional obligatoriamente' }
    ],
    correct: 'B',
    explanation: 'La certificada implica <b>prueba de entrega mediante firma</b> del destinatario, lo que da valor probatorio.',
    iaFallo: {
      A: 'La certificada no es necesariamente más rápida; lo que aporta es trazabilidad y firma.',
      C: 'Tiene los mismos límites de peso que una ordinaria.',
      D: 'Puede ser nacional o internacional.'
    },
    temarioText: 'La carta certificada es admitida bajo recibo y entregada bajo firma.',
    temarioHighlight: 'firma del destinatario',
    temarioSource: 'Tema 1 · Productos y servicios postales',
    difficulty: 1
  },
  {
    id: 'q-003', module: 1, topic: 1,
    text: '¿Qué es un envío con valor declarado?',
    options: [
      { letter: 'A', text: 'Un envío urgente' },
      { letter: 'B', text: 'Un envío con seguro por una cantidad fijada por el remitente' },
      { letter: 'C', text: 'Un envío internacional' },
      { letter: 'D', text: 'Un envío que se entrega solo al destinatario' }
    ],
    correct: 'B',
    explanation: 'El valor declarado es una <b>cobertura por una cantidad declarada</b> por el remitente, que se indemniza en caso de pérdida o avería.',
    temarioSource: 'Tema 1 · Productos y servicios postales',
    difficulty: 2
  },

  // ============= TEMA 2: ADMISIÓN =============
  {
    id: 'q-004', module: 2, topic: 2,
    text: 'IRIS es:',
    options: [
      { letter: 'A', text: 'El sistema informático de gestión de oficinas de Correos' },
      { letter: 'B', text: 'Un servicio de paquetería internacional' },
      { letter: 'C', text: 'El nombre del sindicato mayoritario' },
      { letter: 'D', text: 'Un tipo de carta certificada' }
    ],
    correct: 'A',
    explanation: 'IRIS es la <b>aplicación informática</b> que utilizan las oficinas de Correos para registrar admisiones, ventas y operaciones diarias.',
    iaFallo: {
      B: 'Has confundido IRIS con un producto. Es una herramienta interna.',
      C: 'Los sindicatos en Correos son CCOO, UGT, CSIF y SL, entre otros.',
      D: 'No es un tipo de envío.'
    },
    temarioSource: 'Tema 2 · La admisión',
    difficulty: 1
  },
  {
    id: 'q-005', module: 2, topic: 2,
    text: 'Las dimensiones máximas de una carta ordinaria nacional son:',
    options: [
      { letter: 'A', text: 'Longitud + anchura + altura ≤ 90 cm, ningún lado más de 60 cm' },
      { letter: 'B', text: '50 × 30 × 20 cm máximo' },
      { letter: 'C', text: 'Sin límite' },
      { letter: 'D', text: 'A4 como máximo' }
    ],
    correct: 'A',
    explanation: 'Las cartas nacionales tienen como límite que la <b>suma de las tres dimensiones</b> no supere 90 cm y ninguna pase de 60 cm.',
    temarioSource: 'Tema 2 · La admisión',
    difficulty: 2
  },
  {
    id: 'q-006', module: 2, topic: 2,
    text: '¿Cuál de los siguientes documentos NO es válido para acreditar la identidad del remitente?',
    options: [
      { letter: 'A', text: 'DNI' },
      { letter: 'B', text: 'Pasaporte' },
      { letter: 'C', text: 'Permiso de conducir' },
      { letter: 'D', text: 'Tarjeta sanitaria' }
    ],
    correct: 'D',
    explanation: 'La <b>tarjeta sanitaria</b> no es documento identificativo válido a efectos legales. Los válidos son DNI, NIE, pasaporte y carnet de conducir.',
    temarioSource: 'Tema 2 · La admisión',
    difficulty: 2
  },

  // ============= TEMA 3: CURSO INTERNO Y CLASIFICACIÓN =============
  {
    id: 'q-007', module: 3, topic: 3,
    text: 'El centro automatizado de tratamiento de correo se denomina:',
    options: [
      { letter: 'A', text: 'CAM' },
      { letter: 'B', text: 'CTA' },
      { letter: 'C', text: 'CTP' },
      { letter: 'D', text: 'OTP' }
    ],
    correct: 'B',
    explanation: 'CTA significa <b>Centro de Tratamiento Automatizado</b>. Es donde se realiza la clasificación masiva de envíos.',
    temarioSource: 'Tema 3 · Curso interno y clasificación',
    difficulty: 2
  },
  {
    id: 'q-008', module: 3, topic: 3,
    text: 'En la clasificación de correo, el código postal indica fundamentalmente:',
    options: [
      { letter: 'A', text: 'La provincia y zona de reparto del destino' },
      { letter: 'B', text: 'El precio del envío' },
      { letter: 'C', text: 'El tipo de producto' },
      { letter: 'D', text: 'La fecha de admisión' }
    ],
    correct: 'A',
    explanation: 'Las dos primeras cifras del código postal indican la <b>provincia</b>, y las tres siguientes el sector y zona de reparto.',
    temarioSource: 'Tema 3 · Curso interno y clasificación',
    difficulty: 1
  },

  // ============= TEMA 4: REPARTO =============
  {
    id: 'q-009', module: 4, topic: 4,
    text: 'La PDA es la herramienta que utiliza el cartero para:',
    options: [
      { letter: 'A', text: 'Cobrar al cliente en efectivo' },
      { letter: 'B', text: 'Registrar entregas y firmas de los destinatarios' },
      { letter: 'C', text: 'Hacer fotografías de los envíos' },
      { letter: 'D', text: 'Ninguna de las anteriores' }
    ],
    correct: 'B',
    explanation: 'La PDA (asistente personal digital) permite al cartero <b>registrar la entrega</b>, capturar firmas y actualizar el estado en tiempo real en los sistemas de Correos.',
    temarioSource: 'Tema 4 · Reparto',
    difficulty: 1
  },
  {
    id: 'q-010', module: 4, topic: 4,
    text: 'Si el destinatario está ausente en el primer intento de entrega de una carta certificada, ¿qué hace el cartero?',
    options: [
      { letter: 'A', text: 'Devuelve el envío al remitente inmediatamente' },
      { letter: 'B', text: 'Deja aviso para retirada en oficina y vuelve a intentar al día siguiente' },
      { letter: 'C', text: 'Deja aviso para retirada en oficina (un solo intento de entrega)' },
      { letter: 'D', text: 'Lo entrega al vecino más próximo' }
    ],
    correct: 'C',
    explanation: 'En las certificadas hay un único intento de entrega a domicilio. Si el destinatario no está, se deja aviso y debe <b>recogerlo en oficina</b> en el plazo establecido.',
    temarioSource: 'Tema 4 · Reparto',
    difficulty: 2
  },
  {
    id: 'q-011', module: 4, topic: 4,
    text: 'Los carteros rurales se diferencian de los urbanos principalmente porque:',
    options: [
      { letter: 'A', text: 'Solo trabajan en pueblos' },
      { letter: 'B', text: 'Atienden poblaciones menores de 50.000 habitantes y pueden realizar admisiones en ruta' },
      { letter: 'C', text: 'Tienen mejor salario' },
      { letter: 'D', text: 'Solo reparten paquetes' }
    ],
    correct: 'B',
    explanation: 'El cartero rural cubre zonas con menor densidad y suele <b>combinar reparto con admisión</b> de envíos en la ruta.',
    temarioSource: 'Tema 4 · Reparto',
    difficulty: 2
  },

  // ============= TEMA 5: LIQUIDACIÓN Y SERVICIOS FINANCIEROS =============
  {
    id: 'q-012', module: 5, topic: 5,
    text: 'Western Union es:',
    options: [
      { letter: 'A', text: 'Una empresa de paquetería competidora' },
      { letter: 'B', text: 'Un sistema de envío de dinero internacional con el que Correos tiene acuerdo' },
      { letter: 'C', text: 'Una marca de sellos antiguos' },
      { letter: 'D', text: 'El sistema interno de salarios' }
    ],
    correct: 'B',
    explanation: 'Correos ofrece el servicio Western Union para <b>envíos de dinero internacionales</b> en sus oficinas.',
    temarioSource: 'Tema 5 · Servicios financieros',
    difficulty: 1
  },
  {
    id: 'q-013', module: 5, topic: 5,
    text: 'La tarjeta Correos Prepago es:',
    options: [
      { letter: 'A', text: 'Una tarjeta de fidelización por puntos' },
      { letter: 'B', text: 'Una tarjeta de débito sin necesidad de cuenta bancaria' },
      { letter: 'C', text: 'Una tarjeta exclusiva para empleados' },
      { letter: 'D', text: 'Una tarjeta solo para envíos internacionales' }
    ],
    correct: 'B',
    explanation: 'La tarjeta Correos Prepago es una <b>tarjeta de débito</b> recargable que se puede contratar sin tener cuenta bancaria.',
    temarioSource: 'Tema 5 · Servicios financieros',
    difficulty: 1
  },

  // ============= TEMA 6: ATENCIÓN AL CLIENTE =============
  {
    id: 'q-014', module: 6, topic: 6,
    text: '¿Cuál es el primer principio en la atención al cliente?',
    options: [
      { letter: 'A', text: 'Despachar rápido para reducir colas' },
      { letter: 'B', text: 'Escuchar activamente al cliente y entender su necesidad' },
      { letter: 'C', text: 'Vender el producto más caro' },
      { letter: 'D', text: 'No interrumpir aunque hable mucho' }
    ],
    correct: 'B',
    explanation: 'La <b>escucha activa</b> es la base de cualquier modelo de atención al cliente.',
    temarioSource: 'Tema 6 · Atención al cliente',
    difficulty: 1
  },
  {
    id: 'q-015', module: 6, topic: 6,
    text: 'Si un cliente presenta una reclamación, ¿cuál es la actuación correcta?',
    options: [
      { letter: 'A', text: 'Negar el problema para no escalar' },
      { letter: 'B', text: 'Escuchar, registrar la reclamación en el sistema y darle número de seguimiento' },
      { letter: 'C', text: 'Mandarle al competidor' },
      { letter: 'D', text: 'Resolverla solo si tiene razón' }
    ],
    correct: 'B',
    explanation: 'Toda reclamación debe <b>registrarse</b> en el sistema con número de seguimiento, independientemente de quién tenga razón.',
    temarioSource: 'Tema 6 · Atención al cliente',
    difficulty: 1
  },

  // ============= TEMA 7: PAQUETERÍA =============
  {
    id: 'q-016', module: 7, topic: 7,
    text: 'Paq24 es:',
    options: [
      { letter: 'A', text: 'Un paquete entregado en 24 días' },
      { letter: 'B', text: 'Un servicio urgente con compromiso de entrega al día siguiente laborable' },
      { letter: 'C', text: 'El paquete más barato' },
      { letter: 'D', text: 'Solo para envíos internacionales' }
    ],
    correct: 'B',
    explanation: 'Paq24 es el servicio <b>urgente nacional</b> con compromiso de entrega en el siguiente día laborable.',
    iaFallo: {
      A: 'El número 24 son las horas (24 h), no días.',
      C: 'Al ser urgente, es más caro que el Paq Estándar.',
      D: 'Es servicio nacional.'
    },
    temarioSource: 'Tema 7 · Paquetería',
    difficulty: 1
  },
  {
    id: 'q-017', module: 7, topic: 7,
    text: 'Paq72 garantiza entrega en:',
    options: [
      { letter: 'A', text: '72 horas hábiles' },
      { letter: 'B', text: '3 días laborables' },
      { letter: 'C', text: '72 horas naturales incluyendo fines de semana' },
      { letter: 'D', text: 'Cuando se pueda' }
    ],
    correct: 'B',
    explanation: 'Paq72 entrega en <b>3 días laborables</b> contados desde la admisión.',
    temarioSource: 'Tema 7 · Paquetería',
    difficulty: 2
  },
  {
    id: 'q-018', module: 7, topic: 7,
    text: '¿Qué es Citypaq?',
    options: [
      { letter: 'A', text: 'Una sucursal de Correos en zonas céntricas' },
      { letter: 'B', text: 'Una red de buzones inteligentes para recoger paquetes 24/7' },
      { letter: 'C', text: 'Un servicio premium con cartero dedicado' },
      { letter: 'D', text: 'Una app de seguimiento de envíos' }
    ],
    correct: 'B',
    explanation: 'Citypaq es la <b>red de taquillas automatizadas</b> de Correos donde el cliente puede recoger paquetes a cualquier hora.',
    temarioSource: 'Tema 7 · Paquetería',
    difficulty: 1
  },

  // ============= TEMA 8: SERVICIOS DIGITALES =============
  {
    id: 'q-019', module: 8, topic: 8,
    text: 'Las notificaciones electrónicas administrativas se entregan a través de:',
    options: [
      { letter: 'A', text: 'WhatsApp' },
      { letter: 'B', text: 'La Dirección Electrónica Habilitada (DEH) o la Carpeta Ciudadana' },
      { letter: 'C', text: 'SMS' },
      { letter: 'D', text: 'Email convencional' }
    ],
    correct: 'B',
    explanation: 'Las notificaciones administrativas oficiales se entregan a través de la <b>DEH</b> o Carpeta Ciudadana, que tienen validez legal.',
    temarioSource: 'Tema 8 · Servicios digitales',
    difficulty: 2
  },
  {
    id: 'q-020', module: 8, topic: 8,
    text: '¿Qué es Correos ID?',
    options: [
      { letter: 'A', text: 'El número de DNI del empleado' },
      { letter: 'B', text: 'Un identificador digital único del cliente para servicios online' },
      { letter: 'C', text: 'El sistema de control horario' },
      { letter: 'D', text: 'Un tipo de envío especial' }
    ],
    correct: 'B',
    explanation: 'Correos ID es la <b>identidad digital del cliente</b> para acceder a todos los servicios online de Correos.',
    temarioSource: 'Tema 8 · Servicios digitales',
    difficulty: 2
  },

  // ============= TEMA 9: PRL =============
  {
    id: 'q-021', module: 9, topic: 9,
    text: 'Los equipos de protección individual (EPI) son obligatorios:',
    options: [
      { letter: 'A', text: 'Solo si el trabajador lo pide' },
      { letter: 'B', text: 'En todos los puestos donde la evaluación de riesgos los exige' },
      { letter: 'C', text: 'Solo para personal nuevo' },
      { letter: 'D', text: 'Nunca, son recomendados' }
    ],
    correct: 'B',
    explanation: 'Los EPI son <b>obligatorios</b> en cualquier puesto donde la evaluación de riesgos así lo establezca.',
    temarioSource: 'Tema 9 · Prevención de riesgos laborales',
    difficulty: 1
  },
  {
    id: 'q-022', module: 9, topic: 9,
    text: 'En el manejo manual de cargas, se recomienda no superar de forma habitual:',
    options: [
      { letter: 'A', text: '5 kg' },
      { letter: 'B', text: '15 kg en hombres y 12 kg en mujeres' },
      { letter: 'C', text: '25 kg' },
      { letter: 'D', text: '50 kg si se está bien preparado físicamente' }
    ],
    correct: 'C',
    explanation: 'La normativa marca <b>25 kg como límite general</b> de manejo manual de cargas en condiciones óptimas. Se rebaja a 15 kg para población general.',
    temarioSource: 'Tema 9 · Prevención de riesgos laborales',
    difficulty: 3
  },

  // ============= TEMA 10: IGUALDAD =============
  {
    id: 'q-023', module: 10, topic: 10,
    text: 'El plan de igualdad de una empresa:',
    options: [
      { letter: 'A', text: 'Es voluntario para todas las empresas' },
      { letter: 'B', text: 'Es obligatorio en empresas de más de 50 trabajadores' },
      { letter: 'C', text: 'Solo se aplica al personal directivo' },
      { letter: 'D', text: 'No se aplica al sector público' }
    ],
    correct: 'B',
    explanation: 'Desde el RDL 6/2019, los planes de igualdad son <b>obligatorios en empresas con más de 50 trabajadores</b>. Correos los tiene desde mucho antes.',
    temarioSource: 'Tema 10 · Igualdad',
    difficulty: 2
  },
  {
    id: 'q-024', module: 10, topic: 10,
    text: 'El acoso laboral se caracteriza por:',
    options: [
      { letter: 'A', text: 'Un único incidente aislado' },
      { letter: 'B', text: 'Conductas hostiles, sistemáticas y reiteradas en el tiempo' },
      { letter: 'C', text: 'Discusiones puntuales entre compañeros' },
      { letter: 'D', text: 'Cualquier llamada de atención del jefe' }
    ],
    correct: 'B',
    explanation: 'El acoso laboral exige <b>sistematicidad y reiteración</b> en el tiempo; un hecho puntual no es acoso aunque sea reprochable.',
    temarioSource: 'Tema 10 · Igualdad',
    difficulty: 2
  },

  // ============= TEMA 11: PROTECCIÓN DE DATOS =============
  {
    id: 'q-025', module: 11, topic: 11,
    text: 'El RGPD protege:',
    options: [
      { letter: 'A', text: 'Solo los datos económicos de las empresas' },
      { letter: 'B', text: 'Los datos personales de las personas físicas en la UE' },
      { letter: 'C', text: 'Únicamente datos médicos' },
      { letter: 'D', text: 'Solo el secreto profesional' }
    ],
    correct: 'B',
    explanation: 'El Reglamento General de Protección de Datos protege los <b>datos personales de las personas físicas</b> en el ámbito de la UE.',
    temarioSource: 'Tema 11 · Protección de datos',
    difficulty: 1
  },
  {
    id: 'q-026', module: 11, topic: 11,
    text: 'El secreto de las comunicaciones postales:',
    options: [
      { letter: 'A', text: 'Es una recomendación interna de Correos' },
      { letter: 'B', text: 'Está protegido constitucionalmente en el art. 18.3 CE' },
      { letter: 'C', text: 'Solo se aplica a cartas certificadas' },
      { letter: 'D', text: 'Caduca tras 1 año' }
    ],
    correct: 'B',
    explanation: 'El <b>art. 18.3 de la Constitución Española</b> garantiza el secreto de las comunicaciones, incluidas las postales.',
    temarioSource: 'Tema 11 · Protección de datos',
    difficulty: 2
  },

  // ============= TEMA 12: SOSTENIBILIDAD =============
  {
    id: 'q-027', module: 12, topic: 12,
    text: 'Correos ha apostado en su transformación de flota por:',
    options: [
      { letter: 'A', text: 'Vehículos diésel exclusivamente' },
      { letter: 'B', text: 'Vehículos eléctricos y de bajas emisiones' },
      { letter: 'C', text: 'Eliminar los vehículos a motor' },
      { letter: 'D', text: 'Solo bicicletas' }
    ],
    correct: 'B',
    explanation: 'Correos ha incorporado una flota creciente de <b>vehículos eléctricos</b> y de bajas emisiones como parte de su estrategia de sostenibilidad.',
    temarioSource: 'Tema 12 · Sostenibilidad',
    difficulty: 1
  },

  // ============= PSICOTÉCNICAS (10 al final del examen real) =============
  {
    id: 'q-028', module: 1, topic: 1,
    text: '(Psicotécnica) Si una furgoneta recorre 60 km en 45 minutos, ¿cuál es su velocidad media en km/h?',
    options: [
      { letter: 'A', text: '60 km/h' },
      { letter: 'B', text: '75 km/h' },
      { letter: 'C', text: '80 km/h' },
      { letter: 'D', text: '90 km/h' }
    ],
    correct: 'C',
    explanation: '45 minutos = 0,75 horas. Velocidad = 60 / 0,75 = <b>80 km/h</b>.',
    temarioSource: 'Psicotécnico · cálculo numérico',
    difficulty: 2
  },
  {
    id: 'q-029', module: 1, topic: 1,
    text: '(Psicotécnica) Completa la serie: 2, 6, 12, 20, 30, ___',
    options: [
      { letter: 'A', text: '40' },
      { letter: 'B', text: '42' },
      { letter: 'C', text: '45' },
      { letter: 'D', text: '50' }
    ],
    correct: 'B',
    explanation: 'Diferencias: 4, 6, 8, 10, 12 → siguiente = 30+12 = <b>42</b>.',
    temarioSource: 'Psicotécnico · series numéricas',
    difficulty: 2
  },
  {
    id: 'q-030', module: 1, topic: 1,
    text: '(Psicotécnica) "BOQUERÓN" es a "PESCADO" como "GORRIÓN" es a:',
    options: [
      { letter: 'A', text: 'AVE' },
      { letter: 'B', text: 'VUELO' },
      { letter: 'C', text: 'PLUMA' },
      { letter: 'D', text: 'NIDO' }
    ],
    correct: 'A',
    explanation: 'La relación es de tipo (boquerón es un tipo de pescado; gorrión es un tipo de <b>ave</b>).',
    temarioSource: 'Psicotécnico · razonamiento verbal',
    difficulty: 1
  }

];

// Índices derivados (compat IIAPP)
window.CORREOS.QUESTIONS_BY_MODULE = window.CORREOS.QUESTIONS.reduce((acc, q) => {
  if (!acc[q.module]) acc[q.module] = [];
  acc[q.module].push(q);
  return acc;
}, {});

window.CORREOS.QUESTION_BY_ID = window.CORREOS.QUESTIONS.reduce((acc, q) => {
  acc[q.id] = q;
  return acc;
}, {});

// Aliases para retrocompatibilidad con el motor IIAPP
window.IIAPP.QUESTIONS = window.CORREOS.QUESTIONS;
window.IIAPP.QUESTIONS_BY_MODULE = window.CORREOS.QUESTIONS_BY_MODULE;
window.IIAPP.QUESTION_BY_ID = window.CORREOS.QUESTION_BY_ID;
