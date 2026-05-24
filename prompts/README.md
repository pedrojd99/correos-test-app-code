# Prompts engineered — CorreosTest

Framework de prompting adaptado del proyecto Formia. Cada prompt está
estructurado en **8 piezas** que separan instrucciones inmutables, contexto
cacheable, contexto dinámico, tarea concreta, restricciones, pista de
razonamiento, formato de salida y guardarraíles de seguridad.

El objetivo es producir resultados **consistentes, citables y verificables**
sobre el temario oficial de Correos.

---

## Las 8 piezas

| # | Bloque | Función |
|---|---|---|
| 1 | `<role>` | Quién es el modelo, qué autoridad tiene, qué tono usa. |
| 2 | `<context cache="true">` | Material grande y estable. Va dentro del prompt cache de Anthropic — paga 1 vez, reutilizable. |
| 3 | `<context cache="false">` | Material dinámico de cada llamada (datos del usuario, fragmentos RAG, conversación). |
| 4 | `<task>` | La instrucción específica. Una sola. Sin ambigüedad. |
| 5 | `<constraints>` | Lo que **no** debe hacer + límites de longitud, idioma, formato. |
| 6 | `<reasoning_hint>` | Pasos mentales antes de responder. Cuando aplica, se pide salida en `<thinking>` interno. |
| 7 | `<output_format>` | Forma exacta: JSON estricto, texto plano, plantilla, etc. |
| 8 | `<safety>` | Inyección de prompt, off-topic, datos personales, crisis. |

Las piezas pueden combinarse libremente; lo importante es que **siempre que el
prompt cambia se versione**. El nombre del archivo lleva sufijo `vN`.

---

## Convención de variables

Las variables en plantilla van entre `{llaves}` y se sustituyen antes de enviar.
Ejemplo: `{course_topic}`, `{question_text}`, `{temario_chunk}`.

Cada prompt declara al principio las variables que espera. Si el código de
sustitución no las encuentra, debe **fallar ruidosamente** — no rellenar con
defaults silenciosos.

---

## Versionado

- `explanation-v1.md` → versión 1, congelada cuando se generen las primeras
  explicaciones reales. Cualquier cambio mayor → `explanation-v2.md`.
- Cambios menores de formato → nota al pie en el mismo archivo, sin bump.
- Eliminar versiones antiguas **solo** cuando ningún output en producción
  dependa de ellas.

---

## Prompts disponibles

| Archivo | Uso | Variables clave |
|---|---|---|
| [`explanation-v1.md`](explanation-v1.md) | Genera explicación real + análisis por distractor de una pregunta usando el temario como fuente única | `question_*`, `temario_chunk`, `module_*` |
| [`tutor-system-v1.md`](tutor-system-v1.md) | System prompt para el endpoint `/api/tutor` cuando exista | `student_*`, `current_*`, `retrieved_chunks` |
| [`question-generator-v1.md`](question-generator-v1.md) | Genera N preguntas nuevas estilo examen oficial a partir de un fragmento de temario | `temario_chunk`, `count`, `difficulty` |
| [`mnemonic-v1.md`](mnemonic-v1.md) | Resumen + mnemotécnico por tema (≤120 palabras, para ficha de repaso) | `topic_*`, `temario_chunk` |

---

## Cómo usarlos

1. Lee el archivo del prompt con `open(path, encoding='utf-8').read()`.
2. Sustituye variables: `prompt.replace('{var}', value)` o `string.Template`.
3. Pásalo al modelo. Si vas a Anthropic, el bloque `<context cache="true">`
   debe enviarse como `cache_control: {type:"ephemeral"}` (ver
   `make_explanations_ai.py` como ejemplo).
4. Valida la salida contra `<output_format>` antes de persistirla.

---

## Modelos recomendados

| Tarea | Modelo | Por qué |
|---|---|---|
| Explainer batch (207 preguntas) | `claude-haiku-4-5` | Suficiente para citar + ser pedagógico, coste mínimo |
| Tutor runtime | `claude-sonnet-4-6` | Razona mejor con contexto de la conversación |
| Generador de preguntas | `claude-sonnet-4-6` | Calidad > coste — un mal distractor envenena el banco |
| Mnemónico | `claude-haiku-4-5` | Tarea creativa pero corta |

---

## Anti-patrones

- **No** mezclar instrucciones, contexto y tarea en un solo párrafo amorfo.
- **No** poner el temario dentro del mensaje del usuario — va en
  `<context cache="true">` para que Anthropic lo cachee.
- **No** dejar `temperature` por defecto: 0.1–0.3 para explainer/judge,
  0.4–0.6 para tutor, 0.5–0.7 para generador.
- **No** confiar en que el JSON salga bien sin validarlo. Siempre `json.loads`
  con try/except + reintento con `repair` si falla.
- **No** versionar prompts en el código (TS/Python). Viven en `prompts/*.md`
  y se leen en runtime — así son auditables sin grep.
