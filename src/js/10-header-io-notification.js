'use strict';
/* ================= header events ================= */
let searchTimer=null;
$('#q').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{filter.q=$('#q').value.trim();
  if(filter.smart==='trash')filter.smart='all';render();},120);});
$('#newBtn').onclick=()=>quickNew();
$('#themeBtn').onclick=()=>{const theme=(window.MBStore&&StoreService.toggleTheme)?StoreService.toggleTheme():(meta.theme=meta.theme==='light'?'dark':'light');
  document.documentElement.dataset.theme=theme;metaSave();};
$('#menuBtn').onclick=()=>$('#side').classList.toggle('open');
$('#viewTabs').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;setView(b.dataset.view);});
$('#viewTabs').addEventListener('dragover',e=>{
  const b=e.target.closest('button[data-view]');if(!b||!memoDragId)return;
  e.preventDefault();
  clearTimeout(viewDragSwitchTimer);
  viewDragSwitchTimer=setTimeout(()=>{if((window.MBStore&&StoreService.view?StoreService.view():meta.view)!==b.dataset.view)setView(b.dataset.view);},240);
});
function setView(v){const next=(v==='cal'||v==='settings'||v==='guide')?v:'memo';if(window.MBStore&&StoreService.setView)StoreService.setView(next);else meta.view=next;if(filter.smart==='trash')filter.smart='all';metaSave();render();}
function memoTopOrder(zone){const arr=liveNotes().map(normalizeNote).filter(n=>zone==null||n.zone===zone);return arr.length?Math.min(...arr.map(n=>n.morder||0))-1024:Date.now();}
function quickNew(p){if(typeof workspaceWritable==='function'&&!workspaceWritable())return;const z=(p&&typeof p.zone==='number')?clampZone(p.zone):0;const n=newNote(Object.assign({size:(window.MBStore&&StoreService.defaultSize?StoreService.defaultSize():(meta.defaultSize||'title')),zone:z,morder:memoTopOrder(z)},p||{}));notes.push(n);persistNote(n,{skipRender:true}).then(()=>openEditor(n.id,'edit'));}
$('#moreBtn').onclick=e=>{e.stopPropagation();$('#moreMenu').classList.toggle('open');};
function executeAppAction(act,el){
  if(act==='export')exportJSON();
  if(act==='import'){if(window.memoboardNative&&window.memoboardNative.available)importJSONNative();else $('#impFile').click();}
  if(act==='md-export-folder')MarkdownIO.exportFolder();
  if(act==='md-import-folder')MarkdownIO.importFolder();
  if(act==='always-on-top')DesktopWindowManager.toggleAlwaysOnTop();
  if(act==='mini-mode')DesktopWindowManager.toggleMiniMode();
  if(act==='hide-to-tray')DesktopWindowManager.hideToTray();
  if(act==='minimize-to-tray')DesktopWindowManager.toggleMinimizeToTray();
  if(act==='quick-note')QuickMemo.open();
  if(act==='work-mode')setWorkMode((el&&el.dataset&&el.dataset.mode)||'default');
  if(act==='restore-center')RestoreCenter.open();
  if(act==='template-manager')TemplateManager.open();
  if(act==='autobackup-setup')BackupManager.setup();
  if(act==='autobackup-run')BackupManager.runNow();
  if(act==='autobackup-snapshot')BackupManager.toggleSnapshot();
  if(act==='autobackup-off')BackupManager.disable();
  if(act==='bulk-size'){bulkSetSize(el&&el.dataset?el.dataset.size:'normal');}
  if(act==='trash'){filter.smart='trash';setView('memo');}
  if(act==='notif')ensureNotifPerm(true);
  if(act==='help')openHelp();
  if(act==='reset-sidebar-order'){if(window.MBStore&&StoreService.setSidebarOrder)StoreService.setSidebarOrder(SIDEBAR_SECTION_DEFAULT.slice());else meta.sidebarOrder=SIDEBAR_SECTION_DEFAULT.slice();metaSave();renderSidebar();toast('좌측 카테고리 순서를 초기화했습니다');}
}
$('#moreMenu').addEventListener('click',e=>{
  if(e.target.closest('[data-no-close]'))return;
  const b=e.target.closest('button');if(!b)return;
  $('#moreMenu').classList.remove('open');
  executeAppAction(b.dataset.act,b);
});
$('#moreMenu').addEventListener('input',e=>{
  const rng=e.target.closest('#opacityRange');
  if(rng)DesktopWindowManager.setOpacity(Number(rng.value)/100);
});
$('#quickSave').onclick=()=>QuickMemo.save();
$('#quickCancel').onclick=()=>QuickMemo.close();
$('#quickClose').onclick=()=>QuickMemo.close();
$('#quickWrap').addEventListener('mousedown',e=>{if(e.target===$('#quickWrap'))QuickMemo.close();});
$('#quickBody').addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();QuickMemo.save();}});
$('#quickTitle').addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();QuickMemo.save();}});

/* ================= import/export ================= */
function exportMeta(){
  const out=(window.MBStore&&StoreService.persistable)?StoreService.persistable():Object.assign({},meta);
  out.exportedBy='memoboard';
  return out;
}

function safeMdFileName(name){return String(name||'untitled').replace(/[\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim().slice(0,80)||'untitled';}
function yamlScalar(v){if(v==null||v==='')return '';if(typeof v==='number'||typeof v==='boolean')return String(v);return '"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
function noteToMarkdown(n){normalizeNote(n);const lines=['---'];const data={id:n.id,title:dispTitle(n),createdAt:new Date(n.createdAt||Date.now()).toISOString(),updatedAt:new Date(n.updatedAt||Date.now()).toISOString(),folder:n.folder||'',tags:n.tags||[],color:n.color,pinned:!!n.pinned,done:!!n.done,dueDate:n.dueDate||'',date:n.date||'',kind:n.kind||'memo',priority:n.priority||'normal',zone:clampZone(n.zone),weeklyKey:n.weeklyKey||'',locked:!!n.locked,archived:!!n.archived};Object.keys(data).forEach(k=>{const v=data[k];if(Array.isArray(v))lines.push(k+': ['+v.map(x=>yamlScalar(x)).join(', ')+']');else lines.push(k+': '+yamlScalar(v));});lines.push('---','');if(n.title)lines.push('# '+n.title,'');lines.push(n.body||'');return lines.join('\n');}
function parseFrontmatter(raw){raw=String(raw||'');if(!raw.startsWith('---'))return {meta:{},body:raw};const end=raw.indexOf('\n---',3);if(end<0)return {meta:{},body:raw};const head=raw.slice(3,end).trim().split(/\r?\n/), body=raw.slice(end+4).replace(/^\r?\n/,'');const out={};head.forEach(line=>{const m=line.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);if(!m)return;let v=m[2].trim();if(/^\[.*\]$/.test(v)){v=v.slice(1,-1).split(',').map(x=>x.trim().replace(/^"|"$/g,'')).filter(Boolean);}else if(v==='true'||v==='false')v=v==='true';else if(/^\d+(\.\d+)?$/.test(v))v=Number(v);else v=v.replace(/^"|"$/g,'').replace(/\\"/g,'"').replace(/\\\\/g,'\\');out[m[1]]=v;});return {meta:out,body};}
function markdownToNote(file){const p=parseFrontmatter(file.content||'');const m=p.meta||{};let body=p.body||'';let title=String(m.title||'');if(!title){const first=(body.split(/\r?\n/).find(x=>/^#\s+/.test(x))||'').replace(/^#\s+/,'').trim();if(first)title=first;}return normalizeNote(newNote({id:String(m.id||('md-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6))),title,body,folder:String(m.folder||''),tags:Array.isArray(m.tags)?m.tags:[],color:Number(m.color)||0,pinned:!!m.pinned,done:!!m.done,dueDate:m.dueDate||null,date:m.date||null,kind:m.kind||'memo',priority:m.priority||'normal',zone:Number.isFinite(Number(m.zone))?Number(m.zone):0,weeklyKey:m.weeklyKey||null,locked:!!m.locked,archived:!!m.archived,createdAt:m.createdAt?Date.parse(m.createdAt):Date.now(),updatedAt:m.updatedAt?Date.parse(m.updatedAt):Date.now()}));}
const MarkdownIO={async exportFolder(){const live=notes.filter(n=>!n.deletedAt).map(normalizeNote);const files=live.map((n,i)=>({fileName:String(i+1).padStart(4,'0')+'_'+safeMdFileName(dispTitle(n))+'.md',content:noteToMarkdown(n)}));const manifest={app:'memoboard',version:BACKUP_FORMAT_VERSION,exportedAt:new Date().toISOString(),count:files.length,meta:exportMeta()};if(window.memoboardNative&&window.memoboardNative.available&&window.memoboardNative.exportMarkdownFolder){const res=await window.memoboardNative.exportMarkdownFolder({manifest,files});if(res&&res.ok)toast('Markdown 폴더로 내보냈습니다');return res;}toast('Markdown 폴더 내보내기는 데스크톱 앱에서 지원합니다');},async importFolder(){if(!(window.memoboardNative&&window.memoboardNative.available&&window.memoboardNative.importMarkdownFolder)){toast('Markdown 폴더 가져오기는 데스크톱 앱에서 지원합니다');return;}const res=await window.memoboardNative.importMarkdownFolder();if(!res||!res.ok||!Array.isArray(res.files))return;const imported=res.files.map(markdownToNote);const payload=JSON.stringify({app:'memoboard',version:BACKUP_FORMAT_VERSION,notes:imported,meta:res.manifest&&res.manifest.meta});const r=await ImportService.merge(payload);toast('Markdown 가져오기 완료: 신규 '+r.add+'개, 갱신 '+r.upd+'개, 충돌본 '+r.conflict+'개');}};
window.MBMarkdown=Object.assign(window.MBMarkdown||{}, MarkdownIO);

async function exportJSON(){
  const name='memoboard-backup-'+todayYmd()+'.json';
  const payload={app:'memoboard',version:BACKUP_FORMAT_VERSION,backupType:'manual',exportedAt:new Date().toISOString(),meta:exportMeta(),notes};
  try{
    if(window.memoboardNative&&window.memoboardNative.available){
      const res=await window.memoboardNative.exportJson(payload,name);
      if(!res||!res.ok)return;
    }else{
      download(name,JSON.stringify(payload,null,1),'application/json');
    }
    if(window.MBStore&&StoreService.setBackupPatch)StoreService.setBackupPatch({lastBackupAt:Date.now(),changeCountSinceBackup:0,lastBackupNudgeAt:0});
    else {meta.lastBackupAt=Date.now();meta.changeCountSinceBackup=0;meta.lastBackupNudgeAt=0;}
    await metaSave({silent:true});
    updateStorageInfo();
    toast('JSON 백업을 내보냈습니다');
  }catch(e){console.error('[memoboard] manual export failed',e);toast('JSON 백업 저장 실패');}
}
async function importJSONNative(){
  try{
    const res=await window.memoboardNative.importJson();
    if(!res||!res.ok||!res.raw)return;
    const r=await ImportService.merge(res.raw);
    toast('가져오기 완료: 신규 '+r.add+'개, 갱신 '+r.upd+'개, 충돌본 '+r.conflict+'개'+(r.metaImported?' · 설정 포함':''));
  }catch(err){console.error(err);toast('가져오기 실패: 올바른 백업 파일이 아닙니다');}
}
function importMeta(data){
  if(!data||!data.meta||typeof data.meta!=='object')return false;
  const imported=Object.assign({},data.meta);
  delete imported.exportedBy;
  Object.assign(meta,imported);
  sanitizeMeta();
  metaSave({silent:true});
  return true;
}
function noteVersionTime(n){return Math.max(Number(n&&n.updatedAt)||0,Number(n&&n.deletedAt)||0,Number(n&&n.createdAt)||0);}
function makeImportConflictCopy(imp,ex){
  const copy=JSON.parse(JSON.stringify(imp));
  copy.id='conflict-'+(imp.id||uid())+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,5);
  copy.title='[가져온 충돌본] '+(dispTitle(imp)||'제목 없음');
  copy.createdAt=Date.now();copy.updatedAt=Date.now();copy.deletedAt=null;
  copy.tags=[...(Array.isArray(copy.tags)?copy.tags:[]),'import-conflict'];
  copy.body=(copy.body||'')+'\n\n---\n가져오기 충돌: 원본 id '+(imp.id||'unknown')+' / 로컬 수정시각 '+(ex&&ex.updatedAt?new Date(ex.updatedAt).toLocaleString('ko-KR'):'없음');
  return normalizeNote(copy);
}
const ImportService={
  parse(raw){
    const data=JSON.parse(raw);
    const arr=Array.isArray(data)?data:data.notes;
    if(!Array.isArray(arr))throw new Error('invalid backup notes');
    return {data,arr};
  },
  async merge(raw){
    const {data,arr}=this.parse(raw);
    const metaImported=importMeta(data);
    const byId=new Map(notes.map(n=>[n.id,n]));
    let add=0,upd=0,skip=0,conflict=0,deleted=0;
    const changed=[];
    arr.forEach(src=>{
      if(!src||!src.id)return;
      const imp=normalizeNote(JSON.parse(JSON.stringify(src)));
      const ex=byId.get(imp.id);
      if(!ex){notes.push(imp);byId.set(imp.id,imp);changed.push(imp);add++;if(imp.deletedAt)deleted++;return;}
      normalizeNote(ex);
      if(comparableNote(ex)===comparableNote(imp)){skip++;return;}
      const it=noteVersionTime(imp), et=noteVersionTime(ex);
      if(it>et){Object.assign(ex,imp);normalizeNote(ex);noteCache.delete(ex.id);changed.push(ex);upd++;if(ex.deletedAt)deleted++;return;}
      if(it===et){const copy=makeImportConflictCopy(imp,ex);notes.push(copy);changed.push(copy);conflict++;return;}
      if(!imp.deletedAt){const copy=makeImportConflictCopy(imp,ex);notes.push(copy);changed.push(copy);conflict++;}
      else skip++;
    });
    const ok=changed.length?await persistNotes(changed,{skipRender:true,keepUpdatedAt:true}):true;
    await metaSave({silent:true});
    invalidateIndex();render();updateStorageInfo();
    return {ok,add,upd,skip,conflict,deleted,metaImported};
  }
};
window.MBImport=ImportService;
$('#impFile').addEventListener('change',()=>{
  const f=$('#impFile').files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async ()=>{try{
    const res=await ImportService.merge(r.result);
    toast('가져오기 완료: 신규 '+res.add+'개, 갱신 '+res.upd+'개, 충돌본 '+res.conflict+'개'+(res.metaImported?' · 설정 포함':''));
  }catch(err){console.error(err);toast('가져오기 실패: 올바른 백업 파일이 아닙니다');}
  $('#impFile').value='';};
  r.readAsText(f);});

/* ================= notifications ================= */
function ensureNotifPerm(verbose){
  if(!('Notification'in window)){if(verbose)toast('이 브라우저는 알림을 지원하지 않습니다');return;}
  if(Notification.permission==='granted'){if(verbose)toast('알림 권한이 허용되어 있습니다');return;}
  if(Notification.permission==='denied'){toast('알림이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요.');return;}
  Notification.requestPermission().then(p=>{
    if(p==='granted')toast('알림이 켜졌습니다 (탭이 열려있는 동안 동작)');
    else toast('알림 권한이 거부되었습니다');});}
function checkReminders(){
  const now=Date.now();
  liveNotes().filter(n=>n.remind&&!n.reminded).forEach(n=>{
    if(new Date(n.remind).getTime()<=now){
      n.reminded=true;touch(n,true);
      const title='⏰ '+dispTitle(n);
      const body=stripMd(n.body).split('\n')[0]||'';
      if('Notification'in window&&Notification.permission==='granted'){
        try{const noti=new Notification(title,{body,tag:n.id});
          noti.onclick=()=>{window.focus();openEditor(n.id);};}catch(e){}}
      toast(title,()=>openEditor(n.id),'열기');}});}
setInterval(checkReminders,60000);
