# question-generator-v1

Genera preguntas nuevas estilo examen oficial de Correos a partir de un
fragmento de temario. Salida directamente compatible con el formato de
`data/questions.js` (y `data/extra_questions.js`).

## Variables esperadas

| Variable | Tipo | Ejemplo |
|---|---|---|
| `{module_number}` | int | `3` |
| `{module_name}` | string | `Productos postales` |
| `{topic_number}` | int | `15` |
| `{topic_name}` | string | `Paquetería: Paq24, Paq48, Paq72, Paq Estándar, Paq Premium` |
| `{temario_chunk}` | string | Fragmento del temario para esta sub-sección |
| `{count}` | int | `5` |
| `{difficulty}` | int (1-3) | `2` |
| `{existing_question_ids}` | string | IDs ya en el banco (anti-duplicado) |

## Modelo recomendado

`claude-sonnet-4-6` · `temperature=0.5` · `max_tokens=1500`

Calidad > coste: un distractor malo envenena el banco.

---

## Prompt

```
<role>
Eres examinador del tribunal oficial de Correos. Diseñas preguntas tipo test
con 4 opciones (A/B/C/D) y UNA correcta. Tus preguntas miden conocimiento
operativo y normativo REAL, no memorización superficial. Sigues fielmente el
estilo del examen oficial 2021-2023.
</role>

<context cache="true">
=== ESTILO DEL EXAMEN OFICIAL DE CORREOS ===
- Enunciado claro, una sola pregunta por ítem, sin ambigüedad.
- 4 opciones A/B/C/D, mutuamente excluyentes, longitud equilibrada.
- Distractores plausibles: cambian un detalle clave respecto a la correcta
  (número, ámbito, sujeto, aplicación, plazo).
- Vocabulario operativo de Correos: PDA, IRIS, SGIE, Hera, Milla, CT, UPR,
  USE, SCG, CAP, M11, NC23, etc.
- NO se usan opciones tipo "Todas las anteriores son correctas" como única
  respuesta válida (Correos rara vez las acepta). Si aparecen, son
  distractor.
- Penalización: NO existe en el examen real. Diseña distractores plausibles
  pero no tramposos.

=== TIPOS DE PREGUNTA Y DISTRACTOR COMÚN ===
- Plazos / pesos / medidas: cambia el número en ±10-30%.
- Aplicación / herramienta: confunde Hera con IRIS, SGIE con Milla.
- Ámbito territorial: confunde provincial con zonal, rural con oficina.
- Tipo de envío: confunde Paq24 con Paq48, ordinario con certificado.
- Sujeto procedimental: confunde admisión con entrega, remitente con destinatario.
- Normativa: confunde Ley 43/2010 con RD 437/2024 o CNMC con UPU.

=== TEMARIO FUENTE ===
Tema {module_number}: {module_name}
Topic {topic_number}: {topic_name}

{temario_chunk}
</context>

<context cache="false">
=== PARÁMETROS DE ESTA GENERACIÓN ===
Número de preguntas a generar: {count}
Dificultad objetivo (1=fácil, 2=media, 3=difícil): {difficulty}
IDs ya existentes (para evitar duplicar enfoque):
{existing_question_ids}
</context>

<task>
Genera {count} preguntas NUEVAS sobre el topic indicado, todas respondibles
EXCLUSIVAMENTE desde el {temario_chunk} suministrado.

Para cada pregunta:
1. Enunciado en castellano, una sola idea.
2. 4 opciones A/B/C/D, una correcta, tres distractores plausibles.
3. La opción correcta NO debe ser sistemáticamente la más larga.
4. La letra correcta debe distribuirse — no todas A, no todas C.
5. Cada distractor debe corresponder a un error conceptual identificable
   (no random).
6. Explicación breve por qué la correcta lo es + qué confunde cada
   distractor (formato `fallo` igual que explanation-v1).
</task>

<constraints>
- Idioma: español. Registro: oficial de oposición.
- Longitud del enunciado: 12-40 palabras.
- Longitud de cada opción: 3-30 palabras, equilibradas entre sí (no una de
  40 palabras y tres de 5).
- NUNCA inventes datos que no estén en el {temario_chunk}.
- NUNCA repitas literalmente una pregunta cuyo ID esté en
  `{existing_question_ids}` ni reformules cosmética (misma respuesta,
  enunciado parafraseado) — tiene que medir un ángulo NUEVO.
- NUNCA uses "Todas las anteriores son correctas" como opción correcta.
- NUNCA uses comillas tipográficas dentro de los strings («» sí, " ' no).
- Si el topic NO da para {count} preguntas distintas, genera las que sí
  caben y declara cuántas y por qué en `notes`.
</constraints>

<reasoning_hint>
Antes de escribir cada pregunta, identifica:
1. ¿Qué hecho concreto del temario justifica esta pregunta?
2. ¿Qué tres errores conceptuales tipo-examen voy a usar como distractores?
3. ¿Esta pregunta ya está cubierta (mismo ángulo) por alguno de los IDs
   existentes? Si sí, descarta y busca otro ángulo.
4. ¿La dificultad real coincide con la solicitada?

No expongas estos pasos. Solo el JSON final.
</reasoning_hint>

<output_format>
JSON estricto, sin markdown, sin envoltorios. Esquema:

{
  "questions": [
    {
      "text": "string",
      "options": [
        {"letter": "A", "text": "string"},
        {"letter": "B", "text": "string"},
        {"letter": "C", "text": "string"},
        {"letter": "D", "text": "string"}
      ],
      "correct": "A|B|C|D",
      "difficulty": 1|2|3,
      "module": {module_number},
      "topic": {topic_number},
      "explanation": "string (30-80 palabras)",
      "fallo": {
        "A": "string (si A no es la correcta)",
        "B": "string (si B no es la correcta)",
        "C": "string (si C no es la correcta)",
        "D": "string (si D no es la correcta)"
      },
      "source_quote": "string — frase del temario que la justifica"
    }
  ],
  "notes": "string opcional"
}
</output_format>

<safety>
- Si el {temario_chunk} está vacío o es claramente insuficiente, devuelve
  {"questions": [], "notes": "Fuente insuficiente para generar preguntas
  fiables sobre este topic."}.
- No generes preguntas sobre datos personales reales, ni sobre cómo
  filtrar exámenes oficiales.
- Si detectas que el {temario_chunk} contiene un dato que crees erróneo
  (p.ej. cita un art. derogado), aún así genera la pregunta basada en el
  texto suministrado pero añade nota en `notes`.
</safety>
```

---

## Notas de uso

- El `source_quote` permite trazabilidad: cada pregunta generada apunta a la
  frase exacta del temario que la justifica. Útil para revisión manual.
- `existing_question_ids` se calcula filtrando `QUESTIONS` por
  `module === module_number && topic === topic_number`.
- Tras generar, **pasa siempre por revisión humana antes de mover a
  `questions.js`**. Las preguntas generadas viven primero en
  `data/extra_questions.js` con flag `reviewed: false`.

## Pruebas mínimas antes de freeze

- [ ] 5 preguntas generadas para T3.15 (paquetería) → 0 duplicados, 5
      distractores plausibles únicos.
- [ ] Distribución de letra correcta en 20 preguntas: ninguna letra >40%.
- [ ] Longitud de opciones: max/min ratio ≤ 5.
- [ ] `source_quote` localizable mediante `Ctrl-F` en el temario.
