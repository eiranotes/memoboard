'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const src = ['src/index.html','src/js/02-store-services.js','src/js/04-utils-markdown.js','src/js/05-render-panels.js','src/js/06-calendar.js','src/js/09-main-sidebar-events.js','src/js/10-header-io-notification.js','src/js/11-commands-help-keys.js','src/js/13-shared-board.js','src-tauri/src/main.rs'].map(read).join('\n');
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

if (!/const\s+CalendarQuickDraft\s*=/.test(src)) fail('calendar quick-input draft guard missing');
if (!/MBCalendarDraft\.capture\(m\)/.test(src) || !/MBCalendarDraft\.restore\(m\)/.test(src)) fail('calendar draft capture/restore not wired');
if (!/function\s+uiDraftActive\s*\(\)/.test(src)) fail('shared sync must guard inline UI drafts');
if (!/!editing&&!uiDraftActive\(\)/.test(src)) fail('shared polling must skip active inline drafts');
if (/quickComposer[\s\S]{0,2600}openEditor\(n\.id/.test(src)) fail('inline quick composer should save without opening editor');

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


if (/function\s+author\(\)\{return explicitDisplayName\(\)\|\|'익명';\}/.test(src)) fail('shared author must not fall back to anonymous or OS-derived identity');
if (!/if\(!SharedBoard\.displayName\(\)\)/.test(read('src/js/12-init.js'))) fail('startup shared workspace must be blocked when display name is empty');
const sharedSrc = read('src/js/13-shared-board.js');
if ((sharedSrc.match(/if\(!hasIdentity\(\)\)\{await requireIdentity\(\);return false;\}/g)||[]).length < 3) fail('shared write paths must require explicit display name');
if (!/if\(!hasIdentity\(\)\)\{requireIdentity\(\);return false;\}/.test(sharedSrc)) fail('shared quick-create path must require explicit display name');
if (/unwrap_or_else\(\|\|\s*"익명"\.to_string\(\)\)/.test(read('src-tauri/src/main.rs'))) fail('native shared lock must not fall back to anonymous owner');

console.log('Regression scenarios OK');
