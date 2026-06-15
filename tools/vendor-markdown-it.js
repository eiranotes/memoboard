'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'src', 'vendor');
const outFile = path.join(outDir, 'markdown-it.min.js');
try {
  const src = require.resolve('markdown-it/dist/markdown-it.min.js');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(src, outFile);
  console.log('Vendored markdown-it:', path.relative(root, outFile));
} catch (err) {
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(outFile)) {
    fs.writeFileSync(outFile, '/* markdown-it bundle not installed. Run npm install. */\n', 'utf8');
  }
  console.warn('markdown-it bundle not copied. Run npm install in an online/npm-enabled environment if needed.');
}
