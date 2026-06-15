'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');

const root = path.join(__dirname, '..');
function fail(msg){ throw new Error(msg); }

// ---- Native-side manifest read/write behavior simulation ----
const now = () => Date.now();
const defaultManifest = () => ({
  app: 'memoboard-shared-board',
  schemaVersion: 2,
  version: 2,
  createdAt: now(),
  updatedAt: now(),
  layout: 'note-per-file',
  zones: [],
  settings: {}
});
function readValue(p){
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}
function normalizeReadManifest(dir){
  let manifest = readValue(path.join(dir, 'manifest.json')) || defaultManifest();
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) manifest = defaultManifest();
  if (!('app' in manifest)) manifest.app = 'memoboard-shared-board';
  if (!('schemaVersion' in manifest)) manifest.schemaVersion = 2;
  if (!('version' in manifest)) manifest.version = 2;
  if (!('layout' in manifest)) manifest.layout = 'note-per-file';
  if (!('zones' in manifest)) manifest.zones = [];
  if (!('settings' in manifest)) manifest.settings = {};
  return manifest;
}
function writeManifest(dir, manifest){
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) manifest = defaultManifest();
  manifest.app = 'memoboard-shared-board';
  manifest.schemaVersion = 2;
  manifest.version = 2;
  if (!('createdAt' in manifest)) manifest.createdAt = now();
  manifest.updatedAt = now();
  if (!('layout' in manifest)) manifest.layout = 'note-per-file';
  if (!('settings' in manifest)) manifest.settings = {};
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-manifest-'));
fs.mkdirSync(path.join(tmp, 'notes'));
fs.mkdirSync(path.join(tmp, 'locks'));
fs.mkdirSync(path.join(tmp, 'trash'));

let m = normalizeReadManifest(tmp);
if (!Array.isArray(m.zones) || m.schemaVersion !== 2 || m.app !== 'memoboard-shared-board') fail('missing manifest did not normalize to default');
fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify({zones:[{id:'z-a', name:'공유A', collapsed:true, order:2}]}));
m = normalizeReadManifest(tmp);
if (m.zones[0].name !== '공유A' || m.layout !== 'note-per-file' || !m.settings) fail('partial manifest did not preserve zones and fill defaults');
const saved = writeManifest(tmp, {zones:[{id:'z-b', name:'공유B', collapsed:false, order:0}], updatedBy:'Tester'});
const disk = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
if (disk.zones[0].name !== '공유B' || disk.updatedBy !== 'Tester' || disk.schemaVersion !== 2) fail('manifest write did not persist normalized data');
fs.writeFileSync(path.join(tmp, 'manifest.json'), '{ broken json');
m = normalizeReadManifest(tmp);
if (!Array.isArray(m.zones) || m.zones.length !== 0 || m.schemaVersion !== 2) fail('corrupt manifest did not safely fall back to default');

// ---- Renderer-side manifest application path ----
const localStore = new Map([['mb-shared-display-name','Tester']]);
let appliedZones = null;
let savedMeta = 0;
const context = {
  console,
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
  Date,
  Math,
  Promise,
  Map,
  String,
  Number,
  Array,
  Object,
  window: {},
  document: { body:{classList:{toggle(){}}}, activeElement:null, addEventListener(){}, querySelector(){return null;} },
  localStorage: { getItem:k=>localStore.get(k)||'', setItem:(k,v)=>localStore.set(k,String(v)) },
  meta: { workspace:'shared', memoZones:['로컬1'], collapsedZones:[], defaultSize:'title', view:'settings' },
  StoreService: {
    workspace: () => 'shared',
    view: () => 'settings',
    defaultSize: () => 'title',
    applySharedZones: (zones) => { appliedZones = zones; return true; },
    exportZones: () => [{id:'local-0', name:'로컬1', collapsed:false, order:0}]
  },
  MBStore: true,
  MAX_ZONES: 15,
  PRIORITY_LABEL: {normal:'보통'},
  CAL_KINDS: {memo:true, task:true},
  SIZE_LABEL: {title:true},
  editing: null,
  notes: [],
  $: () => null,
  toast: () => {},
  setView: () => {},
  metaSave: async () => { savedMeta += 1; },
  render: () => {},
  invalidateIndex: () => {},
  updateStorageInfo: () => {},
  newNote: () => ({}),
  normalizeNote: n => n,
  clampZone: z => Number(z)||0,
  relTime: n => String(n),
  esc: s => String(s),
  escAttr: s => String(s),
  dbAll: async () => []
};
context.window = context.window || {};
context.window.MBStore = true;
context.window.memoboardNative = {
  available: true,
  getSharedConfig: async () => ({sharedDir: tmp, sharedDisplayName: 'Tester'}),
  sharedLoadBoard: async () => ({
    ok: true,
    configured: true,
    root: tmp,
    config: {sharedDir: tmp, sharedDisplayName: 'Tester'},
    notes: [],
    locks: [],
    manifest: {app:'memoboard-shared-board', schemaVersion:2, zones:[{id:'zone-x', name:'팀구역', collapsed:true, order:0}], updatedAt:123, updatedBy:'Tester'},
    health: {liveNotes:0, deletedNotes:0, activeLocks:0, corruptNotes:0, bytes:{total:10, notes:0}}
  })
};
context.window.MBDialog = { confirm: async () => false };
context.window.MBCalendarDraft = { isActive: () => false };
context.window.SharedBoard = null;
context.global = context;
vm.createContext(context);
const sharedSrc = fs.readFileSync(path.join(root, 'src/js/13-shared-board.js'), 'utf8');
vm.runInContext(sharedSrc, context, {filename:'13-shared-board.js'});
(async()=>{
  await context.window.SharedBoard.init();
  const ok = await context.window.SharedBoard.refresh(true, {force:true});
  if (!ok) fail('SharedBoard.refresh did not return true');
  if (!appliedZones || appliedZones.length !== 1 || appliedZones[0].name !== '팀구역' || appliedZones[0].collapsed !== true) fail('renderer did not apply manifest zones from sharedLoadBoard');
  if (context.window.SharedBoard.state.manifest.zones[0].name !== '팀구역') fail('renderer state.manifest not updated');
  if (savedMeta < 1) fail('manifest application did not persist zone metadata');
  console.log('Shared manifest regression OK');
})().catch(e=>{ console.error(e); process.exit(1); });
