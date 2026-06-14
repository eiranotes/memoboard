'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const jsDir = path.join(root, 'src', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
if (!files.length) throw new Error('No renderer JS files found');
for (const file of files) {
  const code = fs.readFileSync(path.join(jsDir, file), 'utf8');
  new vm.Script(code, { filename: `src/js/${file}` });
}
console.log(`Renderer script syntax OK (${files.length})`);
