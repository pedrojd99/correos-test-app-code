"""
Genera audio MP3 para los 12 temas del temario CorreosTest.
Usa gTTS (Google Text-to-Speech) con voz española.
Salida: audio/tema-01.mp3 ... audio/tema-12.mp3
"""
import re, os, time
from bs4 import BeautifulSoup
from gtts import gTTS

os.makedirs("audio", exist_ok=True)

# --- Leer temario_content.js y extraer los bloques HTML por tema ---
src = open("data/temario_content.js", encoding="utf-8").read()

blocks = {}
pattern = re.compile(r'\n(\d+):\s*`(.*?)`\s*,?\s*\n//', re.DOTALL)
for m in pattern.finditer(src):
    blocks[int(m.group(1))] = m.group(2).strip()

last = re.search(r'\n(12):\s*`(.*?)`\s*\n\n\};', src, re.DOTALL)
if last:
    blocks[12] = last.group(2).strip()

print(f"Temas encontrados: {sorted(blocks.keys())}")

# ── Expansión de abreviaturas y términos técnicos ──────────────────────────────
EXPANSIONES = [
    # Referencias legales — eliminar o simplificar
    (r'\(BOE-[A-Z]-\d{4}-\d+\)',          ''),
    (r'\(BOE[^)]{0,40}\)',                 ''),
    (r'BOE-[A-Z]-\d{4}-\d+',              ''),

    # Reglamentos y leyes — expandir sigla antes del número
    (r'\bRD\s+(\d[\d/]+)',    r'Real Decreto \1'),
    (r'\bRDL\s+(\d[\d/]+)',   r'Real Decreto Ley \1'),
    (r'\bLO\s+(\d[\d/]+)',    r'Ley Orgánica \1'),
    (r'\bart\.\s*(\d+)',      r'artículo \1'),
    (r'\barts?\.\s*(\d+)',    r'artículos \1'),
    (r'\bpárr\.\s*(\d+)',     r'párrafo \1'),
    (r'\bpág\.\s*(\d+)',      r'página \1'),
    (r'\bvol\.\s*(\d+)',      r'volumen \1'),

    # Siglas comunes — expandir completo
    (r'\bSPU\b',      'Servicio Postal Universal'),
    (r'\bUPU\b',      'Unión Postal Universal'),
    (r'\bCNMC\b',     'Comisión Nacional de los Mercados y la Competencia'),
    (r'\bSEPI\b',     'Sociedad Estatal de Participaciones Industriales'),
    (r'\bAEPD\b',     'Agencia Española de Protección de Datos'),
    (r'\bRGPD\b',     'Reglamento General de Protección de Datos'),
    (r'\bLOPD\b',     'Ley Orgánica de Protección de Datos'),
    (r'\bSEPBLAC\b',  'Servicio Ejecutivo de Prevención del Blanqueo de Capitales'),
    (r'\bEFQM\b',     'modelo europeo de excelencia empresarial'),
    (r'\bNPS\b',      'índice neto de recomendación'),
    (r'\bSRS\b',      'sistema de repaso espaciado'),
    (r'\bPRL\b',      'prevención de riesgos laborales'),
    (r'\bEPI\b',      'equipo de protección individual'),
    (r'\bODS\b',      'objetivos de desarrollo sostenible'),
    (r'\bRSC\b',      'responsabilidad social corporativa'),
    (r'\bCTA\b',      'centro de tratamiento automatizado'),
    (r'\bCTI\b',      'centro de tratamiento internacional'),
    (r'\bCAM\b',      'centro de admisión masiva'),
    (r'\bCTP\b',      'centro de tratamiento provincial'),
    (r'\bCTL\b',      'centro de tratamiento local'),
    (r'\bURO\b',      'unidad de reparto ordinario'),
    (r'\bUSE\b',      'unidad de servicios especiales'),
    (r'\bURP\b',      'unidad de reparto de paquetes'),
    (r'\bUPO\b',      'unidad de productos ordinarios'),
    (r'\bUPR\b',      'unidad de productos registrados'),
    (r'\bIRIS\b',     'sistema Iris'),
    (r'\bSGIE\b',     'sistema de gestión integral de envíos'),
    (r'\bSEDI\b',     'sistema de distribución'),
    (r'\bSIGUA\b',    'sistema de gestión de unidades y acuerdos'),
    (r'\bCRM\b',      'sistema de gestión de clientes'),
    (r'\bPDA\b',      'dispositivo portátil'),
    (r'\bOCR\b',      'lector óptico de caracteres'),
    (r'\bDEH\b',      'dirección electrónica habilitada'),
    (r'\bICS2\b',     'sistema de control de importaciones'),
    (r'\bIOSS\b',     'sistema de ventanilla única de importación'),
    (r'\bDUA\b',      'documento único aduanero'),
    (r'\bDDP\b',      'entregado con derechos pagados'),
    (r'\bDAP\b',      'entregado en el lugar acordado'),
    (r'\bEMS\b',      'servicio urgente internacional'),
    (r'\bIPC\b',      'cooperativa postal internacional'),
    (r'\bENS\b',      'esquema nacional de seguridad'),
    (r'\bGDP\b',      'buenas prácticas de distribución farmacéutica'),
    (r'\bPEP\b',      'persona políticamente expuesta'),
    (r'\bB2B\b',      'de empresa a empresa'),
    (r'\bTTS\b',      ''),

    # Porcentajes y números especiales
    (r'(\d+)\s*%',    r'\1 por ciento'),
    (r'(\d+)\s*°C',   r'\1 grados'),
    (r'(\d+)\s*kg',   r'\1 kilogramos'),
    (r'(\d+)\s*km',   r'\1 kilómetros'),
    (r'€',            ' euros'),

    # Caracteres especiales
    (r'→',   ' implica '),
    (r'·',   ', '),
    (r'✓',   ''),
    (r'✗',   ''),
    (r'≤',   'igual o menor que'),
    (r'≥',   'igual o mayor que'),
    (r'×',   'por'),
    (r'[<>{}]', ''),
    (r'—',   ', '),
    (r'–',   ', '),
    (r'\+',  'más'),
    (r'™|®|©', ''),
]

def html_to_speech_text(html):
    soup = BeautifulSoup(html, "html.parser")

    # Añadir pausas naturales
    for tag in soup.find_all("em"):
        tag.insert_before("Puntos clave para el examen. ")
    for tag in soup.find_all("h2"):
        tag.insert_after(". ")
    for tag in soup.find_all("h3"):
        tag.insert_before(". ")
        tag.insert_after(". ")
    for tag in soup.find_all("h4"):
        tag.insert_after(". ")
    for tag in soup.find_all("th"):
        tag.insert_after(": ")
    for tag in soup.find_all("li"):
        tag.insert_after(". ")
    for tag in soup.find_all("tr"):
        tag.insert_after(". ")

    text = soup.get_text(separator=" ")

    # Aplicar expansiones
    for patron, reemplazo in EXPANSIONES:
        text = re.sub(patron, reemplazo, text)

    # Limpiar espacios múltiples y puntuación redundante
    text = re.sub(r'\.{2,}', '.', text)
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s([,\.])', r'\1', text)
    text = text.strip()
    return text

# --- Generar MP3 para cada tema ---
nombres_modulo = {
    1:  "Marco normativo postal",
    2:  "Gestión de personas y sostenibilidad",
    3:  "Productos y servicios postales",
    4:  "Oficinas, servicios financieros y digitales",
    5:  "Nuevas líneas de negocio",
    6:  "Herramientas de gestión",
    7:  "Admisión de envíos",
    8:  "Tratamiento y transporte",
    9:  "Distribución y entrega",
    10: "Atención al cliente y calidad",
    11: "Internacionalización y aduanas",
    12: "Cumplimiento normativo",
}

# Forzar regeneración borrando archivos existentes
for num in range(1, 13):
    p = f"audio/tema-{num:02d}.mp3"
    if os.path.exists(p):
        os.remove(p)
        print(f"  Borrado {p}")

for num in sorted(blocks.keys()):
    out_path = f"audio/tema-{num:02d}.mp3"
    text = html_to_speech_text(blocks[num])
    intro = f"Tema {num}. {nombres_modulo.get(num, '')}. "
    full_text = intro + text

    print(f"  Generando tema {num:02d} — {nombres_modulo.get(num)} ({len(full_text)} chars)...")
    try:
        tts = gTTS(text=full_text, lang="es", slow=False)
        tts.save(out_path)
        kb = os.path.getsize(out_path) // 1024
        print(f"  -> {out_path} ({kb} KB)")
        time.sleep(1)
    except Exception as e:
        print(f"  ERROR en tema {num}: {e}")

total = sum(
    os.path.getsize(f"audio/tema-{n:02d}.mp3")
    for n in range(1, 13)
    if os.path.exists(f"audio/tema-{n:02d}.mp3")
)
print(f"\nTotal: {total // (1024*1024)} MB")
