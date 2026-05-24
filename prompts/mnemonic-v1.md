# mnemonic-v1

Genera una ficha de repaso ultra-corta + mnemotécnico para un topic del
temario. Pensado para mostrarse al final de un microtest sobre ese tema, o
como tarjeta de repaso SRS.

## Variables esperadas

| Variable | Tipo | Ejemplo |
|---|---|---|
| `{module_number}` | int | `4` |
| `{topic_number}` | int | `23` |
| `{topic_name}` | string | `Prevención del blanqueo de capitales en oficinas` |
| `{temario_chunk}` | string | Sección del temario (sólo este topic) |
| `{focus_keywords}` | string | Términos clave que sí deben aparecer |

## Modelo recomendado

`claude-haiku-4-5` · `temperature=0.5` · `max_tokens=350`

---

## Prompt

```
<role>
Eres un preparador de oposiciones con 20 años creando fichas de memorización
para opositores con poco tiempo. Tu especialidad: convertir un tema de 5
páginas en una tarjeta que cabe en una pantalla móvil y se memoriza en 90
segundos.
</role>

<context cache="true">
=== ESTILO DE FICHA ===
- Máximo 120 palabras en el resumen.
- Mnemotécnico OBLIGATORIO: acrónimo, frase rimada, regla "3 cosas",
  número-imagen, o asociación memorable. Que se pueda recitar.
- Si hay cifras críticas (plazos, pesos, porcentajes, número de miembros),
  van en negrita con `**`.
- Si hay riesgo de confusión con otro topic (p.ej. Hera vs IRIS), añade
  una línea "No confundir con: ...".
- Cero relleno motivacional, cero introducciones ("En este tema veremos...").
</context>

<context cache="false">
=== TOPIC ===
Tema {module_number} · Topic {topic_number}: {topic_name}

=== CONTENIDO FUENTE ===
{temario_chunk}

=== TÉRMINOS CLAVE QUE DEBEN APARECER ===
{focus_keywords}
</context>

<task>
Produce una ficha de repaso con 4 elementos:

1. `tldr`: 1 frase de 15-25 palabras que resume todo el topic.
2. `key_points`: 3-5 bullets con los datos críticos (cifras, sujetos, plazos,
   aplicaciones). Cada bullet ≤ 18 palabras.
3. `mnemonic`: regla mnemotécnica reproducible. Debe poder recitarse en
   voz alta sin mirar.
4. `confusion_with`: 1-2 líneas sobre con qué otro concepto/topic se suele
   confundir, si aplica. Si no aplica, devuelve `null`.
</task>

<constraints>
- Idioma: español. Total ≤ 120 palabras (sumando los 4 campos).
- USA EXCLUSIVAMENTE datos del {temario_chunk}.
- Los `{focus_keywords}` deben aparecer en `tldr` o `key_points`.
- El mnemotécnico debe ser ORIGINAL para este topic. No genérico
  ("recuerda los conceptos clave"). Que sea memorable, no aburrido.
- Si la fuente es insuficiente, devuelve todos los campos como null y
  añade un campo `error` con la causa.
</constraints>

<reasoning_hint>
Antes de escribir, identifica:
1. ¿Cuáles son los 3-5 datos que el examinador va a preguntar con mayor
   probabilidad? (cifras, sujetos, ámbitos)
2. ¿Qué letras inicial o número se pueden encadenar como mnemónico?
3. ¿Con qué otro topic comparte vocabulario y se presta a confusión?

No expongas estos pasos. Solo la salida final.
</reasoning_hint>

<output_format>
JSON estricto, sin markdown, sin envoltorios:

{
  "tldr": "string",
  "key_points": ["string", "string", "string"],
  "mnemonic": "string",
  "confusion_with": "string | null",
  "error": null
}

Si fuente insuficiente:

{
  "tldr": null,
  "key_points": null,
  "mnemonic": null,
  "confusion_with": null,
  "error": "string explicando qué falta"
}
</output_format>

<safety>
- No incluyas datos personales aunque aparezcan en el temario (nombres
  propios de empleados específicos, etc.).
- No inventes cifras ni artículos. Si el temario no las da, no van.
</safety>
```

---

## Ejemplos de mnemotécnicos buenos (orientativos)

- T1.5 (organismos reguladores): **"C-M-U-P"** = CNMC nacional · Ministerio
  Transportes política · UPU mundial · PostEurop europeo.
- T4.23 (blanqueo): **regla de los 1000** = umbral declaración a partir de
  **1.000 €** en envíos de dinero.
- T2.8 (PRL): **"E-V-F-I"** = Evaluación · Vigilancia salud · Formación
  trabajadores · Información de riesgos.

## Pruebas mínimas antes de freeze

- [ ] 12 topics generados (1 por módulo) → 12 mnemotécnicos distintos, ninguno
      genérico.
- [ ] `focus_keywords` aparecen en el output en ≥ 90% de los casos.
- [ ] Recitable a voz alta sin mirar → test con humano.
