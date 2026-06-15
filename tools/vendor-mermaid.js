'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'src', 'vendor');
const outFile = path.join(outDir, 'mermaid.min.js');
try {
  const src = require.resolve('mermaid/dist/mermaid.min.js');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(src, outFile);
  console.log('Vendored mermaid:', path.relative(root, outFile));
} catch (e) {
  if (!fs.existsSync(outFile)) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, '/* mermaid bundle not installed. Run npm install. */\n', 'utf8');
  }
  console.warn('Mermaid bundle not copied. Run npm install in an online/npm-enabled environment if needed.');
}
