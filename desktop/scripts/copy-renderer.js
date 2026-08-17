// Copia o build de produção do frontend (client/dist) para desktop/renderer,
// que é o que o Electron carrega dentro do app instalado.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'client', 'dist');
const dest = path.join(__dirname, '..', 'renderer');

if (!fs.existsSync(src)) {
  console.error('client/dist não encontrado. Rode "npm run build:renderer" antes.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Renderer copiado de ${src} para ${dest}`);
