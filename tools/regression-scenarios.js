'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const src = ['src/index.html','src/js/02-store-services.js','src/js/04-utils-markdown.js','src/js/05-render-panels.js','src/js/09-main-sidebar-events.js','src/js/10-header-io-notification.js','src/js/11-commands-help-keys.js','src/js/13-shared-board.js','src-tauri/src/main.rs'].map(read).join('\n');
function fail(msg){ throw new Error(msg); }
if (!/function\s+matchSearchOp\s*\(/.test(src)) fail('search operator dispatcher missing');
for (const op of ['title','body','priority','before','after']) {
  if (!src.includes("k==='"+op+"'")) fail('search operator missing: ' + op);
}
if ((src.match(/\['locked','🔐','잠금 메모'/g)||[]).length !== 1) fail('duplicate locked smart filter row');
if (!/function\s+updateCardDom\s*\(/.test(src)) fail('partial card updater missing');
if (!/touch\(n,true\)\.then\(\(\)=>updateCardDom\(n\.id\)\)/.test(src)) fail('checkbox must update card without full render');
if (/version:13/.test(read('src/js/10-header-io-notification.js'))) fail('hard-coded backup format version remains');
if (!/© GSP reserved/.test(src)) fail('copyright text missing');
if (!/workspace-switch/.test(src)) fail('workspace switch UI missing');
if (/data-view="shared"/.test(src)) fail('shared tab should be removed in v12');
if (!/function\s+activeSharedSource\s*\(/.test(src)) fail('shared storage source branch missing');
if (!/SharedBoard\.isActive/.test(src)) fail('shared workspace controller not wired');

if (!/function\s+renderMarkdownPreview\s*\(/.test(src)) fail('central markdown preview renderer missing');
if (!/function\s+cardPreviewHtml\s*\(/.test(src)) fail('card markdown preview renderer missing');
if (!/clipCardMarkdown\(n\.body,size\)/.test(src)) fail('card preview must clip markdown before rendering');
if (!/html=md2html\(clipped\.markdown\)/.test(src)) fail('card preview must reuse markdown renderer');
if (!/data-ti="\(\\d\+\)"\/g,'data-task="\$1"'/.test(src)) fail('card preview task checkbox mapping missing');
if (!/function\s+highlightRenderedHtml\s*\(/.test(src)) fail('safe HTML text highlighter missing');
if (!/const\s+MarkdownShortcuts\s*=/.test(src)) fail('markdown shortcut handler missing');
for (const token of ['Ctrl+Shift+K','Ctrl+Shift+T','지원 마크다운 문법','이미지 참조']) {
  if (!src.includes(token)) fail('markdown help missing: ' + token);
}
if (!/\^\\s\*\(\?:\[-\*\]\|\\d\+\\.\)\\s\+\\\[/.test(src)) fail('ordered checklist markdown support missing');
console.log('Regression scenarios OK');
