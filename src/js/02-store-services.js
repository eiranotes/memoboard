'use strict';
/* ================= state ================= */
const APP_SCHEMA_VERSION=17, STORE_SCHEMA_VERSION=17, BACKUP_FORMAT_VERSION=17;
let notes=[];
let meta={theme:'light',view:'memo',defaultSize:'title',memoZones:['수집','진행','검토','참고','완료'],collapsedZones:[false,false,false,false,false],sidebarCollapsed:{},sidebarOrder:['work','zone','due','kind','smart','folder','tag','color'],calMode:'month',schemaVersion:APP_SCHEMA_VERSION,weeklyNotes:{},lastBackupAt:0,lastBackupNudgeAt:0,changeCountSinceBackup:0,lastChangedAt:0,autoBackupEnabled:false,autoBackupSnapshots:false,lastAutoBackupAt:0,lastAutoBackupErrorAt:0,lastSnapshotBackupAt:0,changeCountSinceAutoBackup:0,alwaysOnTop:false,windowOpacity:1,weeklyPinnedNoteId:null,minimizeToTray:false,miniMode:false,workMode:'default',workspace:'personal',customTemplates:null,editorWide:false};
let filter={q:'',tag:null,color:null,smart:'all',folder:null,due:null,zone:null,kind:null};
let calCur=(()=>{const d=new Date();d.setDate(1);return d;})();
let editing=null, edOpenSnap=null, edHistSnap=null, edSaveTimer=null, editConflict=null, editConflictToastAt=0;
const localNoteWriteStamp=new Map();
let mbChannel=null, externalReloading=false, saveErrorToastAt=0, externalNoticeToastAt=0;
const TAB_ID='tab-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
const BACKUP_WARN_DAYS=7, BACKUP_WARN_CHANGES=40, BACKUP_NUDGE_COOLDOWN=24*60*60*1000;
const AUTO_BACKUP_FILE='memoboard-autobackup.json', AUTO_BACKUP_DEBOUNCE=1500, AUTO_BACKUP_MIN_INTERVAL=5*60*1000, AUTO_BACKUP_MIN_CHANGES=5, AUTO_BACKUP_SNAPSHOT_INTERVAL=24*60*60*1000;
const COLORS=[0,1,2,3,4,5,6,7];
const COLOR_NAMES=['기본','코랄','앰버','그린','스카이','바이올렛','핑크','그레이'];
const PRIORITY_LABEL={low:'낮음',normal:'보통',high:'높음',critical:'긴급'};
const PRIORITY_ICON={low:'·',normal:'',high:'▲',critical:'🔥'};
const SIDEBAR_SECTION_DEFAULT=['work','zone','due','kind','smart','folder','tag','color'];
function normalizeSidebarOrderList(order){
  const valid=new Set(SIDEBAR_SECTION_DEFAULT);
  const seen=new Set();
  const out=[];
  if(Array.isArray(order)){
    order.forEach(key=>{
      key=String(key||'');
      if(valid.has(key)&&!seen.has(key)){seen.add(key);out.push(key);}
    });
  }
  SIDEBAR_SECTION_DEFAULT.forEach(key=>{if(!seen.has(key))out.push(key);});
  return out;
}


/* ================= StoreService: canonical meta.store + compatibility mirrors ================= */
const StoreService=(()=>{
  const schema=STORE_SCHEMA_VERSION;
  const VALID_VIEW=['memo','cal','settings'];
  const VALID_SIZE=['title','small','normal','large'];
  const VALID_WORK_MODE=['default','work','writing','project'];
  const VALID_WORKSPACE=['personal','shared'];
  function clampOpacity(value){value=Number(value);if(!Number.isFinite(value))value=1;return Math.max(.55,Math.min(1,value));}
  function normTheme(value){return value==='dark'?'dark':'light';}
  function normView(value){return VALID_VIEW.includes(value)?value:'memo';}
  function normCalMode(value){return value==='week'?'week':'month';}
  function normSize(value){return VALID_SIZE.includes(value)?value:'title';}
  function normWorkMode(value){return VALID_WORK_MODE.includes(value)?value:'default';}
  function normWorkspace(value){return value==='shared'?'shared':'personal';}
  function defaults(){return {
    schemaVersion:schema,
    zones:DEFAULT_ZONES.map((name,i)=>({id:'zone-'+i,name,collapsed:false,order:i})),
    uiState:{
      sidebarOrder:SIDEBAR_SECTION_DEFAULT.slice(),sidebarCollapsed:{},theme:'light',activeView:'memo',calMode:'month',
      defaultSize:'title',workMode:'default',editorWide:false
    },
    workspace:{mode:'personal'},
    weekly:{notes:{},pinnedNoteId:null},
    templates:null,
    backup:{
      lastBackupAt:0,lastBackupNudgeAt:0,changeCountSinceBackup:0,lastChangedAt:0,
      autoBackupEnabled:false,autoBackupSnapshots:false,lastAutoBackupAt:0,lastAutoBackupErrorAt:0,
      lastSnapshotBackupAt:0,changeCountSinceAutoBackup:0
    },
    desktop:{alwaysOnTop:false,windowOpacity:1,minimizeToTray:false,miniMode:false},
    views:[
      {id:'all',label:'전체',filter:{smart:'all'}},{id:'today',label:'오늘',filter:{smart:'today'}},
      {id:'pinned',label:'고정됨',filter:{smart:'pinned'}},{id:'archive',label:'보관함',filter:{smart:'archive'}}
    ]
  };}
  function legacyZones(){
    const names=Array.isArray(meta.memoZones)&&meta.memoZones.length?meta.memoZones:DEFAULT_ZONES;
    const collapsed=Array.isArray(meta.collapsedZones)?meta.collapsedZones:[];
    return names.map((name,i)=>({
      id:'zone-'+i,
      name:String(name||DEFAULT_ZONES[i]||('구역 '+(i+1))).trim()||('구역 '+(i+1)),
      collapsed:!!collapsed[i],order:i
    }));
  }
  function normalizeZones(zones){
    let list=Array.isArray(zones)&&zones.length?zones:legacyZones();
    list=list.slice(0,MAX_ZONES).map((z,i)=>({
      id:String(z&&z.id||('zone-'+i)),
      name:String(z&&z.name||DEFAULT_ZONES[i]||('구역 '+(i+1))).trim()||('구역 '+(i+1)),
      collapsed:!!(z&&z.collapsed),
      order:Number.isFinite(Number(z&&z.order))?Number(z.order):i
    }));
    while(list.length<MIN_ZONES)list.push({id:'zone-'+list.length,name:DEFAULT_ZONES[list.length]||('구역 '+(list.length+1)),collapsed:false,order:list.length});
    return list.sort((a,b)=>a.order-b.order).map((z,i)=>Object.assign(z,{order:i}));
  }
  function migrateTopLevel(st,force){
    if(!force)return;
    st.zones=normalizeZones(legacyZones());
    st.uiState=Object.assign({},st.uiState||{},{
      sidebarOrder:normalizeSidebarOrderList(meta.sidebarOrder||[]),
      sidebarCollapsed:Object.assign({},meta.sidebarCollapsed||{}),
      theme:normTheme(meta.theme),activeView:normView(meta.view),calMode:normCalMode(meta.calMode),
      defaultSize:normSize(meta.defaultSize),workMode:normWorkMode(meta.workMode),editorWide:!!meta.editorWide
    });
    st.workspace=Object.assign({},st.workspace||{},{mode:normWorkspace(meta.workspace)});
    st.weekly=Object.assign({},st.weekly||{}, {
      notes:(meta.weeklyNotes&&typeof meta.weeklyNotes==='object'&&!Array.isArray(meta.weeklyNotes))?Object.assign({},meta.weeklyNotes):{},
      pinnedNoteId:(typeof meta.weeklyPinnedNoteId==='string')?meta.weeklyPinnedNoteId:null
    });
    st.templates=Array.isArray(meta.customTemplates)?meta.customTemplates:null;
    st.backup=Object.assign({},st.backup||{}, {
      lastBackupAt:Number(meta.lastBackupAt)||0,lastBackupNudgeAt:Number(meta.lastBackupNudgeAt)||0,
      changeCountSinceBackup:Number(meta.changeCountSinceBackup)||0,lastChangedAt:Number(meta.lastChangedAt)||0,
      autoBackupEnabled:!!meta.autoBackupEnabled,autoBackupSnapshots:!!meta.autoBackupSnapshots,
      lastAutoBackupAt:Number(meta.lastAutoBackupAt)||0,lastAutoBackupErrorAt:Number(meta.lastAutoBackupErrorAt)||0,
      lastSnapshotBackupAt:Number(meta.lastSnapshotBackupAt)||0,changeCountSinceAutoBackup:Number(meta.changeCountSinceAutoBackup)||0
    });
    st.desktop=Object.assign({},st.desktop||{}, {
      alwaysOnTop:!!meta.alwaysOnTop,windowOpacity:clampOpacity(meta.windowOpacity),
      minimizeToTray:!!meta.minimizeToTray,miniMode:!!meta.miniMode
    });
  }
  function ensureStore(){
    let created=false;
    if(!meta.store||typeof meta.store!=='object'||Array.isArray(meta.store)){
      meta.store=defaults();
      created=true;
    }
    const oldSchema=Number(meta.store.schemaVersion||meta.schemaVersion||0);
    migrateTopLevel(meta.store,created||oldSchema<schema);
    return meta.store;
  }
  function normalizeBackup(b){
    b=Object.assign({},defaults().backup,b||{});
    ['lastBackupAt','lastBackupNudgeAt','changeCountSinceBackup','lastChangedAt','lastAutoBackupAt','lastAutoBackupErrorAt','lastSnapshotBackupAt','changeCountSinceAutoBackup'].forEach(k=>{b[k]=Number(b[k])||0;});
    b.autoBackupEnabled=!!b.autoBackupEnabled;
    b.autoBackupSnapshots=!!b.autoBackupSnapshots;
    return b;
  }
  function normalizeDesktop(d){
    d=Object.assign({},defaults().desktop,d||{});
    d.alwaysOnTop=!!d.alwaysOnTop;
    d.windowOpacity=clampOpacity(d.windowOpacity);
    d.minimizeToTray=!!d.minimizeToTray;
    d.miniMode=!!d.miniMode;
    return d;
  }
  function applyCompat(){
    const st=meta.store;
    meta.memoZones=st.zones.map(z=>z.name);
    meta.collapsedZones=st.zones.map(z=>!!z.collapsed);
    meta.sidebarOrder=st.uiState.sidebarOrder.slice();
    meta.sidebarCollapsed=Object.assign({},st.uiState.sidebarCollapsed);
    meta.theme=st.uiState.theme;
    meta.view=st.uiState.activeView;
    meta.calMode=st.uiState.calMode;
    meta.defaultSize=st.uiState.defaultSize;
    meta.workMode=st.uiState.workMode;
    meta.editorWide=!!st.uiState.editorWide;
    meta.workspace=st.workspace.mode;
    meta.weeklyNotes=Object.assign({},st.weekly.notes||{});
    meta.weeklyPinnedNoteId=st.weekly.pinnedNoteId||null;
    meta.customTemplates=Array.isArray(st.templates)?st.templates:null;
    Object.assign(meta,st.backup,st.desktop);
    meta.schemaVersion=schema;
    return st;
  }
  function normalize(){
    const st=ensureStore(), d=defaults();
    st.schemaVersion=schema;
    st.zones=normalizeZones(st.zones);
    st.uiState=Object.assign({},d.uiState,st.uiState||{});
    st.uiState.sidebarOrder=normalizeSidebarOrderList(st.uiState.sidebarOrder||[]);
    st.uiState.sidebarCollapsed=Object.assign({},st.uiState.sidebarCollapsed||{});
    st.uiState.theme=normTheme(st.uiState.theme);
    st.uiState.activeView=normView(st.uiState.activeView);
    st.uiState.calMode=normCalMode(st.uiState.calMode);
    st.uiState.defaultSize=normSize(st.uiState.defaultSize);
    st.uiState.workMode=normWorkMode(st.uiState.workMode);
    st.uiState.editorWide=!!st.uiState.editorWide;
    st.workspace=Object.assign({},d.workspace,st.workspace||{});
    st.workspace.mode=normWorkspace(st.workspace.mode);
    st.weekly=Object.assign({},d.weekly,st.weekly||{});
    if(!st.weekly.notes||typeof st.weekly.notes!=='object'||Array.isArray(st.weekly.notes))st.weekly.notes={};
    if(st.weekly.pinnedNoteId!=null&&typeof st.weekly.pinnedNoteId!=='string')st.weekly.pinnedNoteId=null;
    st.templates=Array.isArray(st.templates)?st.templates:null;
    st.backup=normalizeBackup(st.backup);
    st.desktop=normalizeDesktop(st.desktop);
    st.views=Array.isArray(st.views)&&st.views.length?st.views:d.views;
    return applyCompat();
  }
  function update(mutator){
    normalize();
    if(typeof mutator==='function')mutator(meta.store);
    return normalize();
  }
  function zones(){return normalize().zones;}
  function zoneNames(){return zones().map(z=>z.name);}
  function zoneCount(){return zones().length;}
  function collapsedZones(){return zones().map(z=>!!z.collapsed);}
  function setZoneName(idx,name){idx=Number(idx);return update(st=>{if(st.zones[idx])st.zones[idx].name=String(name||('구역 '+(idx+1))).trim()||('구역 '+(idx+1));});}
  function setZoneCollapsed(idx,value){idx=Number(idx);return update(st=>{if(st.zones[idx])st.zones[idx].collapsed=!!value;});}
  function toggleZoneCollapsed(idx){idx=Number(idx);return update(st=>{if(st.zones[idx])st.zones[idx].collapsed=!st.zones[idx].collapsed;});}
  function addZone(){
    let added=false;
    update(st=>{
      if(st.zones.length>=MAX_ZONES)return;
      const i=st.zones.length;
      st.zones.push({id:'zone-'+Date.now().toString(36)+'-'+i,name:'구역 '+(i+1),collapsed:false,order:i});
      added=true;
    });
    return added;
  }
  function removeZone(idx){
    idx=Number(idx);
    if(!Number.isInteger(idx)||idx<0)return false;
    let removed=false;
    update(st=>{
      if(idx>=st.zones.length||st.zones.length<=MIN_ZONES)return;
      st.zones.splice(idx,1);
      removed=true;
    });
    return removed;
  }
  function sidebarOrder(){return normalize().uiState.sidebarOrder.slice();}
  function setSidebarOrder(order){return update(st=>{st.uiState.sidebarOrder=normalizeSidebarOrderList(order);});}
  function setSidebarCollapsed(key,value){return update(st=>{st.uiState.sidebarCollapsed[String(key||'')]=!!value;});}
  function toggleSidebarCollapsed(key){key=String(key||'');return update(st=>{st.uiState.sidebarCollapsed[key]=!st.uiState.sidebarCollapsed[key];});}
  function theme(){return normalize().uiState.theme;}
  function setTheme(value){return update(st=>{st.uiState.theme=normTheme(value);});}
  function toggleTheme(){return setTheme(theme()==='light'?'dark':'light').uiState.theme;}
  function view(){return normalize().uiState.activeView;}
  function setView(value){return update(st=>{st.uiState.activeView=normView(value);});}
  function calMode(){return normalize().uiState.calMode;}
  function setCalMode(value){return update(st=>{st.uiState.calMode=normCalMode(value);});}
  function defaultSize(){return normalize().uiState.defaultSize;}
  function setDefaultSize(value){return update(st=>{st.uiState.defaultSize=normSize(value);});}
  function workMode(){return normalize().uiState.workMode;}
  function setWorkModeValue(value){return update(st=>{st.uiState.workMode=normWorkMode(value);});}
  function editorWide(){return !!normalize().uiState.editorWide;}
  function setEditorWide(value){return update(st=>{st.uiState.editorWide=!!value;});}
  function toggleEditorWide(){return setEditorWide(!editorWide()).uiState.editorWide;}
  function workspace(){return normalize().workspace.mode;}
  function setWorkspace(value){return update(st=>{st.workspace.mode=normWorkspace(value);});}
  function weeklyPinnedNoteId(){return normalize().weekly.pinnedNoteId||null;}
  function setWeeklyPinnedNoteId(value){return update(st=>{st.weekly.pinnedNoteId=typeof value==='string'?value:null;});}
  function templates(){const st=normalize();return Array.isArray(st.templates)?st.templates:null;}
  function setTemplates(list){return update(st=>{st.templates=Array.isArray(list)?list:null;});}
  function backup(){return Object.assign({},normalize().backup);}
  function setBackupPatch(patch){return update(st=>{Object.assign(st.backup,patch||{});});}
  function recordDataWrite(){return update(st=>{const b=st.backup;b.lastChangedAt=Date.now();b.changeCountSinceBackup=(Number(b.changeCountSinceBackup)||0)+1;b.changeCountSinceAutoBackup=(Number(b.changeCountSinceAutoBackup)||0)+1;});}
  function desktop(){return Object.assign({},normalize().desktop);}
  function setDesktopPatch(patch){return update(st=>{Object.assign(st.desktop,patch||{});});}
  function persistable(){normalize();return {schemaVersion:schema,store:JSON.parse(JSON.stringify(meta.store))};}
  return {schema,normalize,persistable,update,zones,zoneNames,zoneCount,collapsedZones,setZoneName,setZoneCollapsed,toggleZoneCollapsed,addZone,removeZone,
    sidebarOrder,setSidebarOrder,setSidebarCollapsed,toggleSidebarCollapsed,theme,setTheme,toggleTheme,view,setView,calMode,setCalMode,
    defaultSize,setDefaultSize,workMode,setWorkMode:setWorkModeValue,editorWide,setEditorWide,toggleEditorWide,workspace,setWorkspace,
    weeklyPinnedNoteId,setWeeklyPinnedNoteId,templates,setTemplates,backup,setBackupPatch,recordDataWrite,desktop,setDesktopPatch};
})();
window.MBStore=StoreService;

function newNote(p){const now=Date.now();return Object.assign({
  id:'n'+now.toString(36)+Math.random().toString(36).slice(2,6),
  title:'',body:'',tags:[],color:0,pinned:false,date:null,dueDate:null,done:false,doneAt:null,priority:'normal',
  remind:null,reminded:false,folder:'',kind:'memo',size:(window.MBStore&&StoreService.defaultSize?StoreService.defaultSize():((meta&&meta.defaultSize)||'title')),zone:0,morder:now,createdAt:now,updatedAt:now,deletedAt:null,history:[]
},p||{});}

function reportSaveError(e){
  console.error('[memoboard] storage write failed',e);
  const now=Date.now();
  if(now-saveErrorToastAt>4000){
    saveErrorToastAt=now;
    try{toast('저장 실패: 브라우저 저장소를 확인하고 JSON 백업을 내보내세요',exportJSON,'백업');}catch(_){console.error('[memoboard] save error toast unavailable');}
  }
  return false;
}
function afterDataWrite(kind,opts){
  opts=opts||{};
  if(typeof invalidateIndex==='function')invalidateIndex();
  if(!opts.noDirty){
    if(window.MBStore&&StoreService.recordDataWrite)StoreService.recordDataWrite();
    else {
      meta.lastChangedAt=Date.now();
      meta.changeCountSinceBackup=(Number(meta.changeCountSinceBackup)||0)+1;
      meta.changeCountSinceAutoBackup=(Number(meta.changeCountSinceAutoBackup)||0)+1;
    }
    metaSave({silent:true});
    maybeSuggestBackup(false);
    if(window.MBBackup)window.MBBackup.onDataWrite();
  }
  if(!opts.silent)broadcastStorageChange(kind||'notes',opts);
  return true;
}
function broadcastStorageChange(kind,payload){
  if(externalReloading)return;
  payload=payload||{};
  try{if(mbChannel)mbChannel.postMessage({app:'memoboard',tabId:TAB_ID,kind:kind||'notes',entityId:payload.entityId||null,entityUpdatedAt:payload.entityUpdatedAt||0,bulkCount:payload.bulkCount||0,at:Date.now()});}catch(e){}
}
async function reloadExternalChange(){
  if(externalReloading)return;
  externalReloading=true;
  try{
    const m=await metaLoad();
    if(m)Object.assign(meta,m);
    sanitizeMeta();
    notes=(await dbAll()).map(normalizeNote);
    invalidateIndex();
    render();
    updateStorageInfo();
  }finally{externalReloading=false;}
}
function setupMultiTabSync(){
  if('BroadcastChannel' in window){
    mbChannel=new BroadcastChannel('memoboard');
    mbChannel.onmessage=e=>{
      const msg=e.data||{};
      if(msg.app!=='memoboard'||msg.tabId===TAB_ID)return;
      if(editing&&SyncService.noticeExternal(msg))return;
      reloadExternalChange().then(()=>toast('다른 탭 변경사항을 반영했습니다'));
    };
  }
  window.addEventListener('storage',e=>{
    if(e.key!=='mb-notes'&&e.key!=='mb-meta')return;
    const kind=e.key==='mb-meta'?'meta':'notes';
    if(editing){SyncService.noticeExternal({kind,entityId:null,at:Date.now()});return;}
    reloadExternalChange();
  });
}
function sanitizeMeta(){
  delete meta.layout;
  if(window.MBStore&&StoreService.normalize)StoreService.normalize();
  else {
    meta.schemaVersion=APP_SCHEMA_VERSION;
    if(!['memo','cal','settings'].includes(meta.view))meta.view='memo';
    if(meta.calMode!=='week')meta.calMode='month';
  }
  ensureZones();
  if(window.MBStore&&StoreService.normalize)StoreService.normalize();
}
function daysSince(ts){return ts?Math.floor((Date.now()-ts)/864e5):Infinity;}
function maybeSuggestBackup(force){
  const now=Date.now();
  if(!force&&meta.lastBackupNudgeAt&&now-meta.lastBackupNudgeAt<BACKUP_NUDGE_COOLDOWN)return;
  const liveCount=notes.filter(n=>!n.deletedAt).length;
  const stale=daysSince(Number(meta.lastBackupAt)||0)>=BACKUP_WARN_DAYS;
  const manyChanges=(Number(meta.changeCountSinceBackup)||0)>=BACKUP_WARN_CHANGES;
  if(liveCount>0&&(force||stale||manyChanges)){
    if(window.MBStore&&StoreService.setBackupPatch)StoreService.setBackupPatch({lastBackupNudgeAt:now});
    else meta.lastBackupNudgeAt=now;
    metaSave({silent:true});
    const reason=manyChanges?'수정이 많이 쌓였습니다':'백업한 지 오래됐습니다';
    toast(reason+' · JSON 백업을 권장합니다',exportJSON,'내보내기');
  }
}
function updateStorageInfo(){
  const el=$('#storageInfo');if(!el)return;
  const liveCount=notes.filter(n=>!n.deletedAt).length;
  const backup=meta.lastBackupAt?(' · 수동백업 '+relTime(meta.lastBackupAt)):' · 수동백업 없음';
  const auto=(window.MBBackup&&window.MBBackup.statusText)?(' · 자동백업 '+window.MBBackup.statusText()):'';
  const health=(window.MBBackup&&window.MBBackup.health)?window.MBBackup.health():null;
  const risk=health&&health.level!=='ok'?' · '+health.label:'';
  const shared=window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive();
  const scope=shared?'공유폴더':((window.memoboardNative&&window.memoboardNative.available)?'데스크톱 앱 저장소':'이 PC 브라우저');
  const storeName=shared?'Shared folder':(useLS?'localStorage':'IndexedDB');
  el.textContent='저장소: '+storeName+' · '+(shared?'공유 ':'')+'메모 '+liveCount+'개'+backup+auto+risk+' · 데이터는 '+scope+'에 저장됩니다';
}

/* ================= service facades: storage + sync ================= */
function comparableNote(n){
  n=n||{};
  return JSON.stringify({title:n.title||'',body:n.body||'',tags:Array.isArray(n.tags)?n.tags.slice().sort():[],color:n.color||0,pinned:!!n.pinned,locked:!!n.locked,archived:!!n.archived,date:n.date||null,dueDate:n.dueDate||null,done:!!n.done,priority:n.priority||'normal',remind:n.remind||null,folder:n.folder||'',kind:n.kind||'memo',size:n.size||'',zone:Number(n.zone)||0,weeklyKey:n.weeklyKey||null,deletedAt:n.deletedAt||null});
}
function activeSharedSource(){return window.SharedBoard&&typeof SharedBoard.isActive==='function'&&SharedBoard.isActive();}
const StorageService={
  putNote:(n,opts)=>activeSharedSource()?SharedBoard.putNote(n,opts):dbPut(n,opts),
  putNotes:(arr,opts)=>activeSharedSource()?SharedBoard.putNotes(arr,opts):dbPutMany(arr,opts),
  deleteNote:(id,opts)=>activeSharedSource()?SharedBoard.deleteNote(id,opts):dbDelete(id,opts),
  getNote:id=>activeSharedSource()?Promise.resolve(SharedBoard.getNote(id)):dbGet(id),
  allNotes:()=>activeSharedSource()?Promise.resolve(SharedBoard.currentNotes()):dbAll(),
  saveMeta:opts=>metaSave(opts),
  loadMeta:()=>metaLoad(),
  getHandle:key=>handleGet(key),
  putHandle:(key,val)=>handlePut(key,val),
  deleteHandle:key=>handleDelete(key)
};
const SyncService={
  async checkEditConflict(n,base,force){
    if(force||!n||!n.id||!base||!base.updatedAt)return null;
    const latest=await StorageService.getNote(n.id);
    if(!latest||Number(latest.updatedAt||0)<=Number(base.updatedAt||0))return null;
    // 같은 창의 자동저장/체크리스트/빠른 생성 저장이 IndexedDB에 먼저 반영된 경우는
    // 외부 탭 충돌이 아니므로 저장을 계속 진행한다.
    const localAt=Number(localNoteWriteStamp.get(n.id)||0);
    if(localAt&&Number(latest.updatedAt||0)<=localAt)return null;
    // 내용이 열었던 스냅샷과 같고 timestamp만 더 최신인 경우도 충돌로 보지 않는다.
    // 자동저장 경합이나 복구 직후 timestamp 보정 때문에 잘못된 강제저장 알림이 뜨는 것을 막는다.
    if(base.hash&&comparableNote(latest)===base.hash)return null;
    if(comparableNote(latest)===comparableNote(n))return null;
    return latest;
  },
  noticeExternal(msg){
    if(!editing)return false;
    msg=msg||{};
    const kind=msg.kind||'';
    if(kind==='meta'){
      // 화면/테마/사이드바 같은 설정 동기화는 현재 편집 중인 메모 충돌이 아니다.
      // 에디터를 닫은 뒤 다음 렌더에서 반영하면 충분하므로 알림도 띄우지 않는다.
      return true;
    }
    const now=Date.now();
    const canToast=now-externalNoticeToastAt>5000;
    if(msg.entityId&&msg.entityId===editing){
      editConflict={id:editing,externalUpdatedAt:msg.entityUpdatedAt||msg.at||now};
      $('#edSaved').textContent='외부 수정 감지 · 저장 시 충돌 확인';
      if(canToast){externalNoticeToastAt=now;toast('현재 메모가 다른 탭에서 수정됐습니다. 저장할 때 충돌을 확인합니다',()=>location.reload(),'새로고침');}
    }else if(msg.entityId){
      if(canToast){externalNoticeToastAt=now;toast('다른 메모의 변경사항은 에디터를 닫으면 반영됩니다');}
    }else{
      // localStorage storage 이벤트나 대량 가져오기처럼 대상 메모를 특정할 수 없는 경우.
      // 여기서 바로 강제저장 충돌로 몰지 않고, 실제 저장 시 최신 레코드를 비교한다.
      editConflict={id:editing,externalUnknown:true,externalUpdatedAt:msg.at||now};
      $('#edSaved').textContent='외부 변경 감지 · 저장 시 확인';
      if(canToast){externalNoticeToastAt=now;toast('외부 변경이 감지됐습니다. 현재 메모는 저장 시 최신본과 비교합니다');}
    }
    return true;
  }
};
window.MBStorage=StorageService;
window.MBSync=SyncService;
