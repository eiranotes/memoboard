'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'src', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tauriConf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const mainRs = fs.readFileSync(path.join(root, 'src-tauri', 'src', 'main.rs'), 'utf8');
const cargoToml = fs.readFileSync(path.join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
if (!/tauri-build\s*=\s*\{[^}]*default-features\s*=\s*false/.test(cargoToml)) fail('tauri-build default features must stay disabled to avoid brotli compression');
if (!/tauri\s*=\s*\{[^}]*default-features\s*=\s*false/.test(cargoToml)) fail('tauri default features must stay disabled to avoid brotli compression');
if (/^\s*brotli\s*=/m.test(cargoToml)) fail('Do not add brotli directly; keep Tauri compression disabled instead');
if (/features\s*=\s*\[[^\]]*"compression"/.test(cargoToml)) fail('Tauri compression feature must remain disabled');

function fail(msg){ throw new Error(msg); }
function readDirText(dir, ext){ return fs.readdirSync(dir).filter(f=>f.endsWith(ext)).sort().map(f=>[f, fs.readFileSync(path.join(dir,f),'utf8')]); }
const jsFiles = readDirText(path.join(root, 'src', 'js'), '.js');
const cssFiles = readDirText(path.join(root, 'src', 'css'), '.css');
if (!jsFiles.length) fail('Renderer JS module files missing');
if (!cssFiles.length) fail('Renderer CSS module files missing');
if (/<style[\s>]/i.test(html)) fail('Inline style block remains; use src/css/*.css');
if (/<script>([\s\S]*?)<\/script>/i.test(html)) fail('Inline script remains; use src/js/*.js');
const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m=>m[1]);
for (const src of scriptSrcs) {
  if (/^(https?:)?\/\//i.test(src)) fail('External script reference: ' + src);
  if (!src.startsWith('./js/')) fail('Unexpected script path: ' + src);
}
const cssHrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi)].map(m=>m[1]);
for (const href of cssHrefs) {
  if (/^(https?:)?\/\//i.test(href)) fail('External stylesheet reference: ' + href);
  if (!href.startsWith('./css/')) fail('Unexpected stylesheet path: ' + href);
}
const htmlNoDynamic = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');
const ids = [...htmlNoDynamic.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const dupIds = [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if (dupIds.length) fail('Duplicate static HTML id: ' + dupIds.join(', '));
const sourceBlob = [html, mainRs].concat(jsFiles.map(x=>x[1]), cssFiles.map(x=>x[1])).join('\n');
for (const re of [/local\.adguard/i, /AdGuard/i, /https?:\/\//i]) if (re.test(sourceBlob)) fail('Forbidden external/injected reference: ' + re);
if (/window\.confirm\(/.test(sourceBlob)) fail('Native window.confirm fallback remains');
for (const re of [/\balert\(/, /\bprompt\(/]) {
  if (re.test(sourceBlob)) fail('Native dialog found: ' + re);
}
if (!tauriConf.app || tauriConf.app.withGlobalTauri !== true) fail('Tauri app.withGlobalTauri must be true');
if (!tauriConf.app.windows || tauriConf.app.windows[0].decorations !== false) fail('Tauri window must be frameless/decorations:false');
if (tauriConf.build.frontendDist !== '../src') fail('Tauri frontendDist must be ../src');
if (pkg.version !== '1.0.0') fail('package version mismatch: ' + pkg.version);
if (tauriConf.version !== pkg.version) fail('tauri.conf version mismatch');
if (!/window\.memoboardNative\s*=\s*Object\.freeze/.test(sourceBlob)) fail('Tauri native bridge not found');
if (!/tauri::generate_handler!/.test(mainRs)) fail('Tauri invoke handler not found');
if (/layoutBtn/.test(sourceBlob)) fail('Removed layoutBtn reference remains');
if (/moveDragElement|memoLastDropSig/.test(sourceBlob)) fail('Removed drag legacy remains');
if (/draggable="true"/.test(htmlNoDynamic)) fail('Static native draggable remains in base HTML');
if (!/function\s+normalizeSidebarOrderList\s*\(/.test(sourceBlob)) fail('central sidebar order normalizer missing');
if (/SIDEBAR_SECTION_DEFAULT\.filter\(k=>[^\n;]*includes\(k\)\)\.concat/.test(sourceBlob)) fail('legacy sidebar order normalizer resets custom order');

// Guard against reintroducing large pasted one-liner patches in renderer JS.
for (const [file, content] of jsFiles) {
  content.split(/\r?\n/).forEach((line, idx) => {
    if (line.length > 1600) fail(`Overlong renderer line: ${file}:${idx + 1} (${line.length})`);
  });
}

const expectedScripts = ['00-tauri-native.js','01-storage.js','02-store-services.js','03-backup.js','04-utils-markdown.js','05-render-panels.js','06-calendar.js','07-editor-trash.js','08-drag-service.js','09-main-sidebar-events.js','10-header-io-notification.js','11-commands-help-keys.js','12-init.js','13-shared-board.js'];
const actualScripts = jsFiles.map(x=>x[0]);
if (actualScripts.join('|') !== expectedScripts.join('|')) fail('Unexpected renderer JS module list/order: ' + actualScripts.join(', '));
console.log('Static audit OK');
