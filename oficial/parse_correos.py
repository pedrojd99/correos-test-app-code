"""
Parser para construir el banco de preguntas de CorreosTest
a partir de los PDFs oficiales de convocatorias anteriores.

Fuentes (dominio público - publicadas por Correos en cswetwebcorsta01.blob.core.windows.net):
  - Cuestionarios REP y ATC (modelos A y B) de 2021-2023
  - Plantillas de respuestas correctas de 2021 y 2023

Salida: data/questions.js compatible con el motor CorreosTest (formato IIAPP)
"""

import re
import json
import random
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN: emparejamientos cuestionario ↔ plantilla ↔ modelo
# ─────────────────────────────────────────────────────────────────────────────

EXAMS = [
    # ── 2023 ──────────────────────────────────────────────────────────────────
    {
        "id": "2023_REP_A",
        "anyo": 2023,
        "tipo": "REP",
        "modelo": "A",
        "cuestionario": "correos-2023-REP-A.pdf",
        "plantilla": "plantilla-2023-REP.pdf",
    },
    {
        "id": "2023_REP_B",
        "anyo": 2023,
        "tipo": "REP",
        "modelo": "B",
        "cuestionario": "correos-2023-REP-B.pdf",
        "plantilla": "plantilla-2023-REP.pdf",
    },
    # ── 2021 sept (convocatoria 2020) ─────────────────────────────────────────
    {
        "id": "2021_REP_A",
        "anyo": 2021,
        "tipo": "REP",
        "modelo": "A",
        "cuestionario": "correos-2021-REP-A.pdf",
        "plantilla": "plantilla-2021-sept-REP.pdf",
    },
    {
        "id": "2021_REP_B",
        "anyo": 2021,
        "tipo": "REP",
        "modelo": "B",
        "cuestionario": "correos-2021-sept-REP-B.pdf",
        "plantilla": "plantilla-2021-sept-REP.pdf",
    },
    # ── 2022 extra (misma conv. 2020, mismo banco que sept-2021, dedup descard) ─
    {
        "id": "2022_REP_B",
        "anyo": 2022,
        "tipo": "REP",
        "modelo": "B",
        "cuestionario": "correos-2022-REP-B.pdf",
        "plantilla": "plantilla-2021-sept-REP.pdf",  # misma convocatoria
    },
]

OFICIAL_DIR = Path(__file__).parent
OUTPUT_JS   = Path(__file__).parent.parent / "data" / "questions.js"

# Peso en el simulacro por tipo de tema (aproximado - se afina con temario oficial)
TOPIC_WEIGHTS = {
    1: 0.10, 2: 0.10, 3: 0.08, 4: 0.10, 5: 0.08,
    6: 0.10, 7: 0.10, 8: 0.08, 9: 0.08, 10: 0.06,
    11: 0.06, 12: 0.06,
}

# ─────────────────────────────────────────────────────────────────────────────
# PASO 1: Extraer texto del PDF con pdftotext
# ─────────────────────────────────────────────────────────────────────────────

def pdf_to_text(pdf_path: Path) -> str:
    import subprocess
    result = subprocess.run(
        ["pdftotext", "-layout", str(pdf_path), "-"],
        capture_output=True, text=True, encoding="latin-1"
    )
    return result.stdout


# ─────────────────────────────────────────────────────────────────────────────
# PASO 2: Parsear la plantilla de respuestas
# ─────────────────────────────────────────────────────────────────────────────

def parse_plantilla(text: str, modelo: str) -> dict:
    """
    Parsea la plantilla de respuestas de Correos.
    Layout real de cada fila:
        numA_1stHalf  rptaA_1stHalf  numA_2ndHalf  rptaA_2ndHalf  ...  numB_1stHalf  rptaB_1stHalf  numB_2ndHalf  rptaB_2ndHalf
    Con 110 preguntas → primera mitad q1-55, segunda mitad q56-110.
    Modelos A y B ocupan columnas 1-4 y 5-8 respectivamente.
    """
    seen_a = {}
    seen_b = {}

    # Usamos posición de columna del texto -layout para distinguir A de B.
    # pdftotext pone espacios proporcionales a la posición horizontal.
    # Heurística: la plantilla tiene ~170 chars de ancho.
    # El separador A/B cae aproximadamente en la mitad (~85 chars).

    for line in text.split("\n"):
        matches = list(re.finditer(r'\b(\d{1,3})\s+(Anulada|[ABCD])\b', line))
        if not matches:
            continue

        # Calcular la posición del centro de la línea para separar A/B
        mid = len(line) // 2

        a_pairs = [(int(m.group(1)), m.group(2)) for m in matches if m.start() < mid]
        b_pairs = [(int(m.group(1)), m.group(2)) for m in matches if m.start() >= mid]

        for num, rpta in a_pairs:
            if 1 <= num <= 120 and num not in seen_a:
                seen_a[num] = rpta

        for num, rpta in b_pairs:
            if 1 <= num <= 120 and num not in seen_b:
                seen_b[num] = rpta

    # Fallback: si B quedó vacío (plantilla de un solo modelo), usar A para los dos
    if not seen_b:
        seen_b = seen_a.copy()

    return seen_a if modelo == "A" else seen_b


# ─────────────────────────────────────────────────────────────────────────────
# PASO 3: Parsear el cuestionario (preguntas + opciones)
# ─────────────────────────────────────────────────────────────────────────────

def normalize_text(s: str) -> str:
    """Limpia espacios extra y caracteres de control."""
    s = re.sub(r'\s+', ' ', s).strip()
    # Arreglar encoding latin1→utf8 más común
    fixes = {
        '¿': '¿', 'á': 'á', 'é': 'é', 'í': 'í', 'ó': 'ó', 'ú': 'ú',
        'Á': 'Á', 'É': 'É', 'Í': 'Í', 'Ó': 'Ó', 'Ú': 'Ú',
        'ñ': 'ñ', 'Ñ': 'Ñ', '¡': '¡', '€': '€',
    }
    for bad, good in fixes.items():
        s = s.replace(bad, good)
    return s


def parse_cuestionario_multiline(text: str) -> dict:
    """
    Parser para el formato de 2023-REP-A: preguntas en múltiples líneas.
    Formato:
        N. Texto de la pregunta que puede
           continuar en la siguiente línea
           A. Opción A
           B. Opción B...
    Devuelve {num: {"text": "...", "options": {"A": "...", "B": "...", ...}}}
    """
    questions = {}
    current_q = None
    current_opt = None
    current_num = None

    for line in text.split('\n'):
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # ¿Empieza una pregunta? "N. Texto..."
        q_match = re.match(r'^(\d{1,3})\.\s+(.+)', line_stripped)
        if q_match:
            if current_q and current_num:
                questions[current_num] = current_q
            current_num = int(q_match.group(1))
            if current_num > 120:  # Solo 110 preguntas + reserva
                current_q = None
                continue
            current_q = {
                "text": normalize_text(q_match.group(2)),
                "options": {}
            }
            current_opt = None
            continue

        # ¿Empieza una opción? "A. Texto..." (con sangría)
        opt_match = re.match(r'^([ABCD])\.\s+(.+)', line_stripped)
        if opt_match and current_q is not None:
            current_opt = opt_match.group(1)
            current_q["options"][current_opt] = normalize_text(opt_match.group(2))
            continue

        # Continuación de opción o pregunta
        if current_q is not None:
            if current_opt and current_opt in current_q["options"]:
                current_q["options"][current_opt] += " " + normalize_text(line_stripped)
            elif current_opt is None:
                current_q["text"] += " " + normalize_text(line_stripped)

    if current_q and current_num:
        questions[current_num] = current_q

    return questions


def parse_cuestionario_singleline(text: str) -> dict:
    """
    Parser para el formato de 2021/2022: todo en una línea por pregunta.
    Formato:
        N. Texto? A. Opt1 B. Opt2 C. Opt3 D. Opt4
    Devuelve {num: {"text": "...", "options": {...}}}
    """
    questions = {}
    # Buscar patrones: número punto texto A. texto B. texto C. texto D. texto
    pattern = re.compile(
        r'(\d{1,3})\.\s+'     # número
        r'(.+?)'               # texto pregunta
        r'\s+A\.\s+(.+?)'     # opción A
        r'\s+B\.\s+(.+?)'     # opción B
        r'\s+C\.\s+(.+?)'     # opción C
        r'\s+D\.\s+(.+?)(?=\s+\d{1,3}\.|$)',  # opción D hasta siguiente o fin
        re.DOTALL
    )
    for m in pattern.finditer(text.replace('\n', ' ')):
        num = int(m.group(1))
        if num > 120:
            continue
        questions[num] = {
            "text": normalize_text(m.group(2)),
            "options": {
                "A": normalize_text(m.group(3)),
                "B": normalize_text(m.group(4)),
                "C": normalize_text(m.group(5)),
                "D": normalize_text(m.group(6)),
            }
        }
    return questions


def parse_cuestionario(text: str, exam_id: str) -> dict:
    """Detecta el formato y usa el parser adecuado."""
    # El 2023-REP-A tiene saltos de línea entre opciones (formato multiline)
    # Los demás (2021, 2022) son single-line por pregunta
    multiline_exams = {"2023_REP_A", "2023_REP_B", "2023_ATC_A", "2023_ATC_B"}
    if exam_id in multiline_exams:
        return parse_cuestionario_multiline(text)
    else:
        return parse_cuestionario_singleline(text)


# ─────────────────────────────────────────────────────────────────────────────
# PASO 4: Combinar preguntas + respuestas y generar el JSON
# ─────────────────────────────────────────────────────────────────────────────

def shuffle_options_deterministic(q_num: int, options: dict, correct: str):
    """Baraja las opciones de forma determinística (mismo seed = mismo orden siempre)."""
    rng = random.Random(q_num * 1000 + sum(ord(c) for c in correct))
    letters = list(options.keys())  # A, B, C, D
    texts = [options[l] for l in letters]
    indices = list(range(4))
    rng.shuffle(indices)
    new_options = {}
    new_correct = None
    for new_idx, old_idx in enumerate(indices):
        new_letter = letters[new_idx]
        old_letter = letters[old_idx]
        new_options[new_letter] = texts[old_idx]
        if old_letter == correct:
            new_correct = new_letter
    return new_options, new_correct


def assign_module(q_num: int, exam_type: str) -> int:
    """
    Asignación heurística de módulo (tema) según posición y tipo de examen.
    Se refinará cuando tengamos el temario oficial 2026.
    REP: bloques aproximados según distribución habitual de preguntas.
    """
    # Distribución aproximada por bloques de preguntas en exámenes REP
    if exam_type == "REP":
        if q_num <= 15:   return 1   # Productos y servicios
        if q_num <= 28:   return 2   # Admisión
        if q_num <= 40:   return 3   # Clasificación
        if q_num <= 56:   return 4   # Reparto
        if q_num <= 65:   return 5   # Financiero
        if q_num <= 72:   return 6   # Atención al cliente
        if q_num <= 82:   return 7   # Paquetería
        if q_num <= 88:   return 8   # Servicios digitales
        if q_num <= 93:   return 9   # PRL
        if q_num <= 97:   return 10  # Igualdad
        if q_num <= 100:  return 11  # Protección datos
        return 12  # Sostenibilidad / reserva
    if exam_type == "ATC":
        if q_num <= 20: return 6  # Atención al cliente (mayoría)
        if q_num <= 40: return 1  # Productos
        if q_num <= 55: return 2  # Admisión
        if q_num <= 70: return 7  # Paquetería
        if q_num <= 85: return 5  # Financiero
        return 8  # Digitales / otros
    return 1


def js_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ")


def build_bank(exams_config: list) -> list:
    all_questions = []
    seen_texts = set()  # Para deduplicar preguntas repetidas entre años

    for ex in exams_config:
        cuestionario_path = OFICIAL_DIR / ex["cuestionario"]
        plantilla_path = OFICIAL_DIR / ex["plantilla"]

        if not cuestionario_path.exists():
            print(f"  ⚠ No encontrado: {ex['cuestionario']}")
            continue
        if not plantilla_path.exists():
            print(f"  ⚠ No encontrado: {ex['plantilla']}")
            continue

        print(f"\n-> Procesando {ex['id']}...")
        q_text = pdf_to_text(cuestionario_path)
        p_text = pdf_to_text(plantilla_path)

        questions = parse_cuestionario(q_text, ex["id"])
        answers   = parse_plantilla(p_text, ex["modelo"])

        print(f"  Preguntas extraídas: {len(questions)}")
        print(f"  Respuestas en plantilla: {len(answers)}")

        paired = 0
        skipped_anuladas = 0
        skipped_incomplete = 0
        skipped_dup = 0

        for num, q in sorted(questions.items()):
            correct_raw = answers.get(num)

            # Excluir anuladas
            if correct_raw == "Anulada":
                skipped_anuladas += 1
                continue

            # Excluir sin respuesta o sin opciones completas
            if not correct_raw or len(q["options"]) < 4:
                skipped_incomplete += 1
                continue

            # Deduplicación por texto de pregunta (normalizado y truncado)
            dedup_key = q["text"][:80].lower()
            if dedup_key in seen_texts:
                skipped_dup += 1
                continue
            seen_texts.add(dedup_key)

            # Barajar opciones
            shuffled_opts, new_correct = shuffle_options_deterministic(
                num + ex["anyo"] * 1000, q["options"], correct_raw
            )

            module = assign_module(num, ex["tipo"])
            question_id = f"correos-{ex['id'].lower()}-{num:03d}"

            all_questions.append({
                "id": question_id,
                "module": module,
                "topic": module,
                "text": q["text"],
                "options": [
                    {"letter": l, "text": shuffled_opts[l]}
                    for l in ["A", "B", "C", "D"]
                ],
                "correct": new_correct,
                "explanation": "",
                "iaFallo": {},
                "temarioText": "",
                "temarioHighlight": "",
                "temarioSource": f"Convocatoria Correos {ex['anyo']} · {ex['tipo']} · q{num}",
                "difficulty": 2,
                "ciclo": f"correos-{ex['anyo']}",
            })
            paired += 1

        print(f"  OK Emparejadas y anadidas: {paired}")
        print(f"  -- Anuladas: {skipped_anuladas} | Sin completar: {skipped_incomplete} | Duplicadas: {skipped_dup}")

    return all_questions


# ─────────────────────────────────────────────────────────────────────────────
# PASO 5: Generar questions.js
# ─────────────────────────────────────────────────────────────────────────────

def generate_js(questions: list) -> str:
    by_module = {}
    for q in questions:
        by_module.setdefault(q["module"], 0)
        by_module[q["module"]] += 1

    lines = [
        "// Banco de preguntas CorreosTest",
        "// Generado automáticamente desde exámenes oficiales de Correos (dominio público)",
        "// NO EDITAR a mano. Regenerar con: python oficial/parse_correos.py",
        f"// Total preguntas: {len(questions)}",
        "",
        "window.CORREOS = window.CORREOS || {};",
        "window.IIAPP = window.CORREOS;",
        "",
        "window.CORREOS.QUESTIONS = [",
    ]

    for q in questions:
        opts_js = ", ".join(
            f"{{letter:'{o['letter']}',text:'{js_escape(o['text'])}'}}"
            for o in q["options"]
        )
        lines.append(
            f"  {{id:'{q['id']}',module:{q['module']},topic:{q['topic']},"
            f"text:'{js_escape(q['text'])}',"
            f"options:[{opts_js}],"
            f"correct:'{q['correct']}',"
            f"explanation:'',iaFallo:{{}},"
            f"temarioText:'',temarioHighlight:'',"
            f"temarioSource:'{js_escape(q['temarioSource'])}',"
            f"difficulty:{q['difficulty']},ciclo:'{q['ciclo']}'}},"
        )

    lines.extend([
        "];",
        "",
        "window.CORREOS.QUESTIONS_BY_MODULE = window.CORREOS.QUESTIONS.reduce((acc, q) => {",
        "  if (!acc[q.module]) acc[q.module] = [];",
        "  acc[q.module].push(q);",
        "  return acc;",
        "}, {});",
        "",
        "window.CORREOS.QUESTION_BY_ID = window.CORREOS.QUESTIONS.reduce((acc, q) => {",
        "  acc[q.id] = q;",
        "  return acc;",
        "}, {});",
        "",
        "window.IIAPP.QUESTIONS = window.CORREOS.QUESTIONS;",
        "window.IIAPP.QUESTIONS_BY_MODULE = window.CORREOS.QUESTIONS_BY_MODULE;",
        "window.IIAPP.QUESTION_BY_ID = window.CORREOS.QUESTION_BY_ID;",
    ])

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== CorreosTest · Parser banco de preguntas oficiales ===\n")
    questions = build_bank(EXAMS)

    print(f"\n=== RESUMEN FINAL ===")
    print(f"Total preguntas en el banco: {len(questions)}")
    by_module = {}
    for q in questions:
        by_module.setdefault(q["module"], 0)
        by_module[q["module"]] += 1
    for m, n in sorted(by_module.items()):
        print(f"  Módulo {m:2d}: {n} preguntas")

    js = generate_js(questions)
    OUTPUT_JS.write_text(js, encoding="utf-8")
    size_kb = OUTPUT_JS.stat().st_size / 1024
    print(f"\nEscrito: {OUTPUT_JS} ({size_kb:.1f} KB)")
    print("Listo. Recarga la app para ver las nuevas preguntas.")
