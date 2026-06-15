'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/js/04-utils-markdown.js'), 'utf8');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx, { filename: 'src/js/04-utils-markdown.js' });
function fail(msg){ throw new Error(msg); }
function render(src){ return ctx.MBMarkdown.render(src); }
let html = render('10. 열 번째\n11. 열한 번째');
if (!/<ol start="10">/.test(html)) fail('ordered list start number must be preserved');
if (!/<li>열 번째<\/li><li>열한 번째<\/li>/.test(html)) fail('ordered list items must render sequentially');
html = render('10. 열 번째\n12. 열두 번째');
if (!/<ol start="10">/.test(html) || !/<li value="12">열두 번째<\/li>/.test(html)) fail('non-sequential ordered list value must be preserved');
html = render('1. 숫자 목록\n- bullet');
if (!/<ol><li>숫자 목록<\/li><\/ol><ul><li>bullet<\/li><\/ul>/.test(html)) fail('ordered and unordered lists must not be merged');
html = render('```txt\n10. code\n```\n10. list');
if (!/<pre>/.test(html) || !/<ol start="10">/.test(html)) fail('fenced code and ordered list must both render');
html = render('[file](file:///C:/secret.txt) [js](javascript:alert(1)) [mail](mailto:team@example.com)');
if (/href="file:/i.test(html) || /href="javascript:/i.test(html)) fail('unsafe link schemes must be blocked');
if (!/href="mailto:team@example.com"/.test(html)) fail('mailto links should remain allowed');


try {
  let MarkdownIt = null;
  try { MarkdownIt = require('markdown-it'); }
  catch (e) {
    if (!e || e.code !== 'MODULE_NOT_FOUND') throw e;
    const vendorCtx = { console };
    vendorCtx.window = vendorCtx; vendorCtx.self = vendorCtx; vendorCtx.globalThis = vendorCtx;
    vm.createContext(vendorCtx);
    vm.runInContext(fs.readFileSync(path.join(root, 'src/vendor/markdown-it.min.js'), 'utf8'), vendorCtx, { filename: 'src/vendor/markdown-it.min.js' });
    MarkdownIt = vendorCtx.markdownit;
  }
  const ctx2 = { console };
  ctx2.window = ctx2;
  ctx2.window.markdownit = MarkdownIt;
  vm.createContext(ctx2);
  vm.runInContext(code, ctx2, { filename: 'src/js/04-utils-markdown.js' });
  if (ctx2.MBMarkdown.engine() !== 'markdown-it') fail('markdown-it engine should be active when library is available');
  const html2 = ctx2.MBMarkdown.render('10. 열 번째\n11. 열한 번째');
  if (!/<ol start="10">/.test(html2)) fail('markdown-it must preserve ordered-list start number');
  const jump = ctx2.MBMarkdown.render('10. 열 번째\n12. 열두 번째');
  if (!/<li value="12">/.test(jump)) fail('markdown-it branch must preserve explicit non-sequential ordered-list values');
  const task = ctx2.MBMarkdown.render('- [x] 완료');
  if (!/class="task done"/.test(task) || !/data-ti="0"/.test(task)) fail('markdown-it task list enhancement failed');
  const mmd = ctx2.MBMarkdown.render('```mermaid\nflowchart TD\n  A-->B\n```');
  if (!/class="mermaid-block"/.test(mmd) || !/language-mermaid/.test(mmd)) fail('markdown-it mermaid fence placeholder missing');
  const link = ctx2.MBMarkdown.render('[문서](https://example.com)');
  if (!/target="_blank"/.test(link) || !/rel="noopener noreferrer"/.test(link)) fail('markdown-it links must not navigate the app webview');
  const unsafe = ctx2.MBMarkdown.render('[file](file:///C:/secret.txt) [proto](//example.com) [js](javascript:alert(1))');
  if (/href="file:/i.test(unsafe) || /href="\/\//.test(unsafe) || /href="javascript:/i.test(unsafe)) fail('markdown-it unsafe schemes must be blocked');
} catch (err) {
  throw err;
}

const htmlFile = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const panelsFile = fs.readFileSync(path.join(root, 'src/js/05-render-panels.js'), 'utf8');
const cssFile = fs.readFileSync(path.join(root, 'src/css/app.css'), 'utf8');
if (!htmlFile.includes('./vendor/markdown-it.min.js')) fail('markdown-it vendor script must be present');
if (!htmlFile.includes('./vendor/mermaid.min.js')) fail('mermaid vendor script must be present');
if (!htmlFile.includes('id="edPrev" class="prose markdown-view"')) fail('editor preview must use markdown-view class');
if (!panelsFile.includes('card-preview prose markdown-view')) fail('card preview must use the same markdown-view/prose class');
if (!cssFile.includes('markdown-it renderer alignment')) fail('shared markdown-view CSS alignment block missing');
if (typeof ctx.MBMarkdown.engine !== 'function') fail('markdown engine indicator missing');

console.log('Markdown regression OK');
