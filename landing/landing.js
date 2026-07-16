/* CorreosTest — Landing JS */

const $ = id => document.getElementById(id);

/* === Calculadora de baremo === */
(function() {
  if (!$('exp-misma')) return;

  const num = id => parseFloat($(id).value) || 0;
  const check = id => $(id).checked ? 1 : 0;
  const fmt = n => n.toFixed(2).replace('.', ',');

  function calcular() {
    const expMisma = Math.min(num('exp-misma') * 0.40, 35);
    const expOtras = Math.min(num('exp-otras') * 0.20, 18);
    const expOtrasAdmon = Math.min(num('exp-otras-admon') * 0.07, 6);
    const exp = expMisma + expOtras + expOtrasAdmon;

    const col = check('discapacidad') * 3 +
                check('mayor45') * 1 +
                check('parolargo') * 1 +
                check('familianumerosa') * 1 +
                check('violenciagenero') * 2;

    const forma = Math.min(num('formacion') * 0.01, 3) + check('permiso-c') * 0.5;
    const idiomas = Math.min(num('b2') * 0.5, 1) + Math.min(num('c1') * 1, 2);

    const total = exp + col + forma + idiomas;

    $('r-exp').textContent = fmt(exp) + ' pts';
    $('r-col').textContent = fmt(col) + ' pts';
    $('r-for').textContent = fmt(forma) + ' pts';
    $('r-idi').textContent = fmt(idiomas) + ' pts';
    $('r-total').textContent = fmt(total) + ' pts';
  }

  ['exp-misma','exp-otras','exp-otras-admon','formacion','b2','c1'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', calcular);
  });
  ['discapacidad','mayor45','parolargo','familianumerosa','violenciagenero','permiso-c'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('change', calcular);
  });
  calcular();
})();

/* === Simulador de nota === */
(function() {
  if (!$('aciertos')) return;

  let conPenalizacion = true;

  function calcular() {
    const a = parseInt($('aciertos').value) || 0;
    const e = parseInt($('errores').value) || 0;
    const b = parseInt($('blanco').value) || 0;
    const total = parseInt($('total').value) || 100;

    const suma = a + e + b;
    const tc = $('totalcount');
    let txt = 'Total: ' + suma + ' / ' + total + ' preguntas';
    if (suma !== total && suma > 0) {
      txt += suma > total ? ' (te pasas en ' + (suma - total) + ')' : ' (te faltan ' + (total - suma) + ')';
    }
    tc.textContent = txt;
    tc.className = suma === total ? 'totalcount' : 'totalcount error';

    const denom = Math.max(suma, total);
    const pct = n => denom === 0 ? 0 : (n / denom) * 100;
    $('bar-aciertos').style.width = pct(a) + '%';
    $('bar-errores').style.width = pct(e) + '%';
    $('bar-blanco').style.width = pct(b) + '%';

    const nota = conPenalizacion ? a - (e / 3) : a;
    $('nota').textContent = nota.toFixed(2).replace('.', ',');
    $('total-display').textContent = total;
    $('formula').innerHTML = conPenalizacion
      ? '<strong>Fórmula:</strong> Nota = Aciertos − (Errores ÷ 3)'
      : '<strong>Fórmula:</strong> Nota = Aciertos (los errores no penalizan)';
  }

  $('btn-con').addEventListener('click', () => {
    conPenalizacion = true;
    $('btn-con').classList.add('activo');
    $('btn-sin').classList.remove('activo');
    calcular();
  });
  $('btn-sin').addEventListener('click', () => {
    conPenalizacion = false;
    $('btn-sin').classList.add('activo');
    $('btn-con').classList.remove('activo');
    calcular();
  });

  ['aciertos','errores','blanco','total'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', calcular);
  });
  calcular();
})();

/* === Formulario de email === */
(function() {
  const form = document.getElementById('email-form');
  if (!form) return;

  const status = document.getElementById('email-status');
  const btn = form.querySelector('button[type="submit"]');
  const btnLabel = btn.textContent;

  function showStatus(msg, isError) {
    if (!status) return;
    status.textContent = msg;
    status.style.display = 'block';
    status.style.color = isError ? '#c43e3e' : '';
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value.trim();
    const website = form.querySelector('input[name="website"]').value;

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, website: website })
      });
      const data = await r.json().catch(function() { return {}; });

      if (r.ok && data.ok) {
        const done = document.createElement('p');
        done.className = 'email-done';
        done.textContent = 'Hecho. Te avisaremos el día que salga la convocatoria en el BOE.';
        done.style.cssText = 'font-weight:600;padding:12px 0';
        form.replaceWith(done);
        if (status) status.style.display = 'none';
        return;
      }

      if (r.status === 400) {
        showStatus('Ese email no parece válido. Revísalo e inténtalo de nuevo.', true);
      } else if (r.status === 429) {
        showStatus('Demasiados intentos seguidos. Espera un minuto y vuelve a probar.', true);
      } else {
        showStatus('No hemos podido apuntarte ahora mismo. Inténtalo de nuevo en unos minutos.', true);
      }
    } catch (err) {
      showStatus('Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.', true);
    } finally {
      if (document.body.contains(btn)) {
        btn.disabled = false;
        btn.textContent = btnLabel;
      }
    }
  });
})();
