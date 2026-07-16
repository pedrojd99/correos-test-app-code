// Copia los assets de la PWA a www/ para empaquetarlos en la app nativa
// (Capacitor usa webDir=www; el repo raíz no sirve porque arrastraría
// node_modules, android/, marketing/, etc.)
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

// audio/ no está en el repo (gitignore): en CI el APK sale sin audio,
// en local sí se incluye si la carpeta existe.
const dirs = ['css', 'js', 'data', 'icons', 'audio', 'recursos'];
const files = ['index.html', 'manifest.json', 'service-worker.js'];

for (const d of dirs) {
  if (existsSync(join(root, d))) cpSync(join(root, d), join(www, d), { recursive: true });
  else console.warn('AVISO: se omite ' + d + '/ (no existe en este entorno)');
}
for (const f of files) copyFileSync(join(root, f), join(www, f));

console.log('www/ generado correctamente');
