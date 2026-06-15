'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function fail(msg){ throw new Error(msg); }
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const utils = fs.readFileSync(path.join(root, 'src/js/04-utils-markdown.js'), 'utf8');
const panels = fs.readFileSync(path.join(root, 'src/js/05-render-panels.js'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'src/js/07-editor-trash.js'), 'utf8');
const header = fs.readFileSync(path.join(root, 'src/js/10-header-io-notification.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/css/app.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
if (!scripts.includes('./vendor/mermaid.min.js')) fail('mermaid vendor script missing');
if (scripts.indexOf('./vendor/mermaid.min.js') > scripts.indexOf('./js/04-utils-markdown.js')) fail('mermaid must load before markdown utilities');
if (!fs.existsSync(path.join(root, 'src/vendor/mermaid.min.js'))) fail('vendored mermaid bundle missing');
if (!pkg.dependencies || !pkg.dependencies.mermaid) fail('mermaid dependency missing');
if (!pkg.scripts || !/vendor-mermaid/.test(pkg.scripts.postinstall||'')) fail('postinstall must vendor mermaid');
for (const needle of ['mermaidPlaceholder', 'renderMermaidIn', 'securityLevel:\'strict\'', 'language-mermaid']) {
  if (!utils.includes(needle)) fail('missing mermaid utility: ' + needle);
}
if (!panels.includes('hydrateMainMarkdown')) fail('main/card markdown hydration missing');
if (!editor.includes('window.MBMarkdown.hydrate(prev)')) fail('editor preview mermaid hydration missing');
if (!header.includes('Object.assign(window.MBMarkdown||{}, MarkdownIO)')) fail('MarkdownIO must not overwrite markdown renderer helpers');
if (!css.includes('Mermaid diagram preview') || !css.includes('.mermaid-diagram svg')) fail('mermaid preview CSS missing');

let MarkdownIt = null;
try { MarkdownIt = require('markdown-it'); } catch (e) { if (!e || e.code !== 'MODULE_NOT_FOUND') throw e; }
const ctx = { console };
ctx.window = ctx;
ctx.document = { body: { contains(){ return true; } } };
if (MarkdownIt) ctx.window.markdownit = MarkdownIt;
ctx.window.mermaid = { initialize(){}, async render(id, src){ return { svg: '<svg data-id="'+id+'"><text>'+src+'</text></svg>' }; } };
vm.createContext(ctx);
vm.runInContext(utils, ctx, { filename: 'src/js/04-utils-markdown.js' });
const htmlOut = ctx.MBMarkdown.render('```mermaid\nflowchart TD\n  A-->B\n```');
if (!/class="mermaid-block"/.test(htmlOut) || !/flowchart TD/.test(htmlOut)) fail('mermaid fence should render as a placeholder block');
if (/class="hl language-mermaid"/.test(htmlOut)) fail('mermaid fence must not render as a normal highlighted code block');
if (ctx.MBMarkdown.mermaid() !== 'mermaid') fail('mermaid engine indicator should be active when library is present');
(async()=>{
  const block = {
    dataset: { mermaidStatus: 'pending' },
    innerHTML: '',
    querySelector(sel){ return sel === 'code.language-mermaid' ? { textContent: 'flowchart TD\n  A-->B' } : null; }
  };
  const root = { querySelectorAll(sel){ return sel === '.mermaid-block' ? [block] : []; } };
  await ctx.MBMarkdown.renderMermaidIn(root);
  if (block.dataset.mermaidStatus !== 'rendered') fail('mermaid hydrate should render pending blocks');
  if (!/mermaid-diagram/.test(block.innerHTML) || !/<svg/.test(block.innerHTML)) fail('mermaid hydrate should inject rendered svg wrapper');
  ctx.window.mermaid.render = async () => ({
    svg: '<svg><script>alert(1)</script><g onclick="alert(1)"><a href="javascript:alert(1)"><foreignObject><div>x</div></foreignObject><text>safe</text></a></g></svg>'
  });
  const unsafeBlock = {
    dataset: { mermaidStatus: 'pending' },
    innerHTML: '',
    querySelector(sel){ return sel === 'code.language-mermaid' ? { textContent: 'flowchart TD\n  A-->B' } : null; }
  };
  await ctx.MBMarkdown.renderMermaidIn({ querySelectorAll(sel){ return sel === '.mermaid-block' ? [unsafeBlock] : []; } });
  if (/script|onclick|javascript:|foreignObject/i.test(unsafeBlock.innerHTML)) fail('mermaid sanitizer must strip executable SVG content');
  console.log('Mermaid regression OK');
})().catch(err=>{ throw err; });
