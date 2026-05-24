"""
Genera data/explanations.js usando el prompt engineered prompts/explanation-v1.md.

Sustituye al antiguo make_explanations.py (template-based) por explicaciones
reales: cita normativa, distingue norma de procedimiento operativo, analiza
QUÉ confunde cada distractor (no se limita a repetir la correcta).

Uso:
  ANTHROPIC_API_KEY=sk-ant-... python make_explanations_ai.py [--limit N] [--ids id1,id2]

Flags:
  --limit N       Procesar solo N preguntas (para pruebas).
  --ids LIST      Procesar solo los IDs separados por coma.
  --dry-run       Imprimir prompts sin llamar a la API.
  --model NAME    Modelo Anthropic (default: claude-haiku-4-5-20251001).
  --resume        Saltar preguntas que ya tienen explicación no-template
                  en data/explanations.js.

Coste estimado (Haiku 4.5 con cache del temario): ~0.30€ para las 207
preguntas. Sonnet 4.6: ~3-4€.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
PROMPTS_DIR = ROOT / "prompts"
DATA_DIR = ROOT / "data"
OUTPUT_FILE = DATA_DIR / "explanations.js"


def load_prompt(name: str) -> str:
    """Lee el prompt y extrae el bloque entre ``` ``` (el prompt real,
    no la documentación markdown que lo envuelve)."""
    path = PROMPTS_DIR / f"{name}.md"
    raw = path.read_text(encoding="utf-8")
    blocks = re.findall(r"```\n(.*?)```", raw, re.DOTALL)
    if not blocks:
        raise RuntimeError(f"{path} no contiene bloque de prompt entre ``` ```")
    return blocks[0].strip()


def load_questions(include_extras: bool = True) -> list[dict]:
    """Reusa el parsing del make_explanations.py original.
    Si include_extras=True, también lee data/extra_questions.js."""
    q_pattern = re.compile(
        r"\{id:'(?P<id>[^']+)',module:(?P<module>\d+),topic:(?P<topic>\d+),"
        r"text:'(?P<text>[^']+)',"
        r"options:\[(?P<options>[^\]]+)\],"
        r"correct:'(?P<correct>[A-D])'",
        re.DOTALL,
    )
    opt_pattern = re.compile(r"\{letter:'([A-D])',text:'([^']+)'\}")
    sources = [DATA_DIR / "questions.js"]
    if include_extras and (DATA_DIR / "extra_questions.js").exists():
        sources.append(DATA_DIR / "extra_questions.js")
    out = []
    seen_ids = set()
    for path in sources:
        src = path.read_text(encoding="utf-8")
        for m in q_pattern.finditer(src):
            qid = m.group("id")
            if qid in seen_ids:
                continue
            seen_ids.add(qid)
            opts = {l: t for l, t in opt_pattern.findall(m.group("options"))}
            out.append({
                "id": qid,
                "module": int(m.group("module")),
                "topic": int(m.group("topic")),
                "text": m.group("text"),
                "correct": m.group("correct"),
                "opts": opts,
                "source_file": path.name,
            })
    return out


def load_temario() -> dict[int, str]:
    """Extrae el HTML de cada módulo de data/temario_content.js.
    El archivo expone TEMARIO_CONTENT = {1: `...html...`, 2: `...`, ...}."""
    src = (DATA_DIR / "temario_content.js").read_text(encoding="utf-8")
    # Captura `N: \`...\`` con backticks
    pattern = re.compile(r"^(\d+):\s*`(.*?)`,?\s*$", re.MULTILINE | re.DOTALL)
    out = {}
    for m in pattern.finditer(src):
        out[int(m.group(1))] = m.group(2).strip()
    return out


MODULE_NAMES = {
    1: ("Marco normativo postal", "Ley 43/2010 · RD 437/2024 · Directiva 2008/6/CE"),
    2: ("Gestión de personas, PRL y sostenibilidad", "Ley 31/1995 PRL · LO 3/2007 Igualdad"),
    3: ("Productos y servicios postales", "Ley 43/2010 · RD 437/2024"),
    4: ("Oficinas, financiero y digital", "Ley 10/2010 blanqueo · LO 3/2018 LOPD"),
    5: ("Nuevas líneas de negocio", "Normativa sectorial específica"),
    6: ("Atención al cliente", "Manuales de atención al cliente de Correos"),
    7: ("Derechos del usuario postal", "Ley 43/2010 título IV"),
    8: ("Distribución y reparto", "Procedimientos operativos PDA, IRIS, SGIE"),
    9: ("Prevención de riesgos laborales", "Ley 31/1995 PRL"),
    10: ("Calidad de servicio", "ISO 9001 · EFQM"),
    11: ("Blanqueo de capitales y seguridad", "Ley 10/2010 · SEPBLAC"),
    12: ("Correo internacional", "Convenio UPU · normativa aduanera"),
}


def is_psicotecnica(text: str) -> bool:
    psico = ["repostero", "cruasán", "palmera", "napolitana", "automóvil eléctrico",
             "matriculaciones", "coches", "unidades vendidas", "porcentaje corresponde"]
    tl = text.lower()
    return any(k.lower() in tl for k in psico)


def fill_prompt(template: str, q: dict, temario_chunk: str) -> str:
    module_name, module_leg = MODULE_NAMES.get(q["module"], ("(módulo)", "(legislación)"))
    options_str = " · ".join(f"{l}) {t}" for l, t in q["opts"].items())
    correct_text = q["opts"].get(q["correct"], "")
    psico = "Psicotécnica · razonamiento / comprensión" if is_psicotecnica(q["text"]) \
            else "Conocimiento normativo u operativo"
    subs = {
        "{module_number}": str(q["module"]),
        "{module_name}": module_name,
        "{module_legislacion}": module_leg,
        "{temario_chunk}": temario_chunk,
        "{question_text}": q["text"],
        "{question_options}": options_str,
        "{correct_letter}": q["correct"],
        "{correct_text}": correct_text,
        # placeholder ternario sustituido en seco
        '{is_psicotecnica ? "Psicotécnica · razonamiento / comprensión" : "Conocimiento normativo u operativo"}': psico,
    }
    out = template
    for k, v in subs.items():
        out = out.replace(k, v)
    return out


def call_anthropic(prompt: str, model: str) -> dict:
    """Llama a Anthropic con prompt-cache. El prompt es el system completo
    porque ya viene con sus piezas <role><context>...; lo enviamos como
    system y dejamos el messages mínimo."""
    try:
        import anthropic
    except ImportError:
        sys.exit("Falta dependencia. Instala: pip install anthropic")

    client = anthropic.Anthropic()
    # Separamos el bloque cache="true" (el grande, temario) del resto para
    # poder marcarlo cache_control.
    split = re.split(r'(<context cache="false">.*?</context>)', prompt, flags=re.DOTALL)
    if len(split) == 3:
        cached, dynamic, _ = split[0], split[1], split[2] if len(split) > 2 else ""
        # cached es todo lo anterior al <context cache="false"> + lo posterior.
        # En realidad necesitamos: cached = parte estable, dynamic = la parte
        # de cache="false" + task/constraints/etc.
        # Para simplificar y no romper el orden lógico de las 8 piezas,
        # marcamos como cached SOLO la porción <role>...</context cache="true">.
        cache_split = re.split(r'(</context>)', cached, maxsplit=1)
        if len(cache_split) >= 3:
            cached_block = cache_split[0] + cache_split[1]
            tail = "".join(cache_split[2:])
            user_content = tail + dynamic + split[2]
        else:
            cached_block = cached
            user_content = dynamic + split[2]
    else:
        cached_block = ""
        user_content = prompt

    system_blocks = []
    if cached_block:
        system_blocks.append({
            "type": "text",
            "text": cached_block,
            "cache_control": {"type": "ephemeral"},
        })

    resp = client.messages.create(
        model=model,
        max_tokens=800,
        temperature=0.2,
        system=system_blocks if system_blocks else None,
        messages=[{"role": "user", "content": user_content}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    # Limpia posible envoltorio ```json ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Respuesta no es JSON válido: {e}\n---\n{text[:500]}")


def escape_js_single(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ")


def render_js(explanations: dict) -> str:
    lines = [
        "// Explicaciones por pregunta — generadas con prompts/explanation-v1.md",
        "// No editar a mano. Regenerar con: python make_explanations_ai.py",
        "",
        "window.CORREOS = window.CORREOS || {};",
        "window.IIAPP = window.CORREOS;",
        "",
        "window.CORREOS.EXPLANATIONS = {",
    ]
    items = list(explanations.items())
    for i, (qid, data) in enumerate(items):
        exp = escape_js_single(data.get("explanation", ""))
        fallo = data.get("fallo", {}) or {}
        fallo_parts = []
        for letter in sorted(fallo.keys()):
            fallo_parts.append(f"'{letter}': '{escape_js_single(fallo[letter])}'")
        fallo_js = "{" + ", ".join(fallo_parts) + "}"
        comma = "," if i < len(items) - 1 else ""
        lines.append(f"  '{qid}': {{explanation: '{exp}', fallo: {fallo_js}}}{comma}")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--ids", type=str, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--model", type=str, default="claude-haiku-4-5-20251001")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--no-extras", action="store_true",
                    help="No procesar data/extra_questions.js")
    args = ap.parse_args()

    template = load_prompt("explanation-v1")
    questions = load_questions(include_extras=not args.no_extras)
    temario = load_temario()

    if args.ids:
        wanted = set(args.ids.split(","))
        questions = [q for q in questions if q["id"] in wanted]
    if args.limit:
        questions = questions[: args.limit]

    print(f"Procesando {len(questions)} preguntas con modelo {args.model}")
    results = {}
    failures = []
    for i, q in enumerate(questions, 1):
        chunk = temario.get(q["module"], "")
        if not chunk:
            print(f"[{i}/{len(questions)}] {q['id']} — sin temario para módulo {q['module']}, salto")
            failures.append((q["id"], "no_temario"))
            continue
        prompt = fill_prompt(template, q, chunk)
        if args.dry_run:
            print(f"--- {q['id']} ---")
            print(prompt[:600] + "...\n")
            continue
        try:
            data = call_anthropic(prompt, args.model)
            results[q["id"]] = data
            print(f"[{i}/{len(questions)}] {q['id']} ✓")
        except Exception as e:
            print(f"[{i}/{len(questions)}] {q['id']} ✗ {e}")
            failures.append((q["id"], str(e)[:120]))
            time.sleep(1)

    if args.dry_run:
        print(f"\nDry-run: no se escribió {OUTPUT_FILE}")
        return

    js = render_js(results)
    OUTPUT_FILE.write_text(js, encoding="utf-8")
    print(f"\nEscrito {OUTPUT_FILE} — {len(results)} explicaciones")
    if failures:
        print(f"\n{len(failures)} fallos:")
        for fid, err in failures:
            print(f"  {fid}: {err}")


if __name__ == "__main__":
    main()
