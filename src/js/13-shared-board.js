'use strict';
/* ================= v12 Shared workspace source =================
   Shared mode no longer has a separate page. The normal Memo/Calendar UI
   switches data source between personal IndexedDB and shared folder JSON files.
*/
const SharedBoard=(()=>{
  const POLL_MS=5000;
  const STATUS_META={open:['요청','📥'],doing:['진행','🛠'],hold:['보류','⏸'],done:['완료','✅']};
  const state={configured:false,root:'',displayName:'',notes:[],locks:new Map(),loading:false,lastSyncAt:0,error:'',poll:null,active:false,editId:null,editToken:''};
  function native(){return window.memoboardNative&&window.memoboardNative.available&&window.memoboardNative.sharedLoadBoard?window.memoboardNative:null;}
  function author(){return (state.displayName||localStorage.getItem('mb-shared-display-name')||'익명').trim()||'익명';}
  function isActive(){return meta&&((window.MBStore&&StoreService.workspace?StoreService.workspace():meta.workspace)==='shared');}
  function statusLabel(v){return (STATUS_META[v]||STATUS_META.open)[0];}
  function normalizeSharedNote(raw){
    const now=Date.now();
    const n=Object.assign({id:'s'+now.toString(36)+Math.random().toString(36).slice(2,7),title:'',body:'',tags:[],status:'open',priority:'normal',assignee:'',createdBy:author(),updatedBy:author(),createdAt:now,updatedAt:now,deletedAt:null},raw||{});
    n.id=String(n.id||('s'+now.toString(36)+Math.random().toString(36).slice(2,7)));
    n.title=String(n.title||'');
    n.body=String(n.body||'');
    n.tags=Array.isArray(n.tags)?n.tags.map(x=>String(x).trim()).filter(Boolean):String(n.tags||'').split(',').map(x=>x.trim()).filter(Boolean);
    n.status=STATUS_META[n.status]?n.status:(n.done?'done':'open');
    n.priority=PRIORITY_LABEL[n.priority]?n.priority:'normal';
    n.assignee=String(n.assignee||'');
    n.createdBy=String(n.createdBy||author());
    n.updatedBy=String(n.updatedBy||n.createdBy||author());
    n.createdAt=Number(n.createdAt)||now;
    n.updatedAt=Number(n.updatedAt)||n.createdAt;
    n.deletedAt=n.deletedAt?Number(n.deletedAt):null;
    if(n.done&&n.status!=='done')n.status='done';
    return n;
  }
  function lockFor(id){return state.locks.get(String(id||''))||null;}
  function toAppNote(raw){
    const sn=normalizeSharedNote(raw);
    const lock=lockFor(sn.id);
    const n=Object.assign(newNote(),sn,{
      id:sn.id,title:sn.title,body:sn.body,tags:sn.tags.slice(),color:Number(sn.color)||0,
      pinned:!!sn.pinned,date:sn.date||null,dueDate:sn.dueDate||null,done:sn.status==='done'||!!sn.done,
      doneAt:(sn.status==='done'||sn.done)?(Number(sn.doneAt)||Number(sn.updatedAt)||Date.now()):null,
      priority:sn.priority||'normal',remind:sn.remind||null,reminded:!!sn.reminded,folder:String(sn.folder||''),
      kind:(sn.kind&&CAL_KINDS[sn.kind])?sn.kind:((sn.status==='done'||sn.status==='doing')?'task':'memo'),
      size:(sn.size&&SIZE_LABEL[sn.size])?sn.size:(window.MBStore&&StoreService.defaultSize?StoreService.defaultSize():(meta.defaultSize||'title')),zone:clampZone(sn.zone),
      morder:Number(sn.morder)||Number(sn.createdAt)||Number(sn.updatedAt)||Date.now(),createdAt:sn.createdAt,updatedAt:sn.updatedAt,
      deletedAt:sn.deletedAt,history:Array.isArray(sn.history)?sn.history:[],locked:!!sn.locked,archived:!!sn.archived,
      weeklyKey:sn.weeklyKey||null,_shared:true,_sharedStatus:sn.status,_sharedUpdatedAt:sn.updatedAt,
      _sharedLockOwner:lock&&lock.owner?String(lock.owner):'',createdBy:sn.createdBy,updatedBy:sn.updatedBy,assignee:sn.assignee
    });
    return normalizeNote(n);
  }
  function fromAppNote(note){
    const n=Object.assign({},note||{});
    const status=n.done?'done':((STATUS_META[n._sharedStatus]&&n._sharedStatus!=='done')?n._sharedStatus:'open');
    if(status==='done')n.done=true;
    return normalizeSharedNote(Object.assign({},n,{status,updatedBy:author(),sharedSchema:2}));
  }
  function applyConfig(cfg){
    cfg=cfg||{};
    state.root=cfg.sharedDir||cfg.shared_dir||'';
    state.displayName=cfg.sharedDisplayName||cfg.shared_display_name||localStorage.getItem('mb-shared-display-name')||'';
    state.configured=!!state.root;
    if(state.displayName)localStorage.setItem('mb-shared-display-name',state.displayName);
  }
  async function init(){
    if(!native())return;
    try{const cfg=await native().getSharedConfig();applyConfig(cfg);}catch(e){console.warn('[memoboard] shared config load failed',e);}
    if(!state.poll){state.poll=setInterval(()=>{if(isActive()&&state.configured&&!state.loading&&!editing)refresh(true);},POLL_MS);}
  }
  async function chooseFolder(){
    if(!native()){toast('공유 작업함은 Tauri 데스크톱 앱에서만 지원합니다');return false;}
    const name=author();
    const res=await native().pickSharedDir({displayName:name});
    if(!res||!res.ok)return false;
    applyConfig(res.config);
    await refresh(true);
    toast('공유폴더를 연결했습니다');
    return true;
  }
  async function saveName(name){
    name=(name||'').trim()||author();
    state.displayName=name;
    localStorage.setItem('mb-shared-display-name',name);
    if(native()&&native().setSharedOptions){try{const res=await native().setSharedOptions({displayName:name});applyConfig(res&&res.config);}catch(e){console.warn(e);}}
    toast('공유 표시 이름을 저장했습니다');
  }
  async function refresh(silent){
    if(!native()||!state.configured)return false;
    state.loading=true;state.error='';
    try{
      const res=await native().sharedLoadBoard();
      if(!res||!res.ok){state.error=(res&&res.error)||'공유 작업함 읽기 실패';return false;}
      applyConfig(res.config||{});
      state.notes=Array.isArray(res.notes)?res.notes.map(normalizeSharedNote):[];
      state.locks=new Map((Array.isArray(res.locks)?res.locks:[]).map(l=>[String(l.id||''),l]));
      state.lastSyncAt=Date.now();
      if(isActive()&&!editing){notes=currentNotes();invalidateIndex();if(!silent)toast('공유 작업함을 새로고침했습니다');render();}
      return true;
    }catch(e){state.error=String(e&&e.message||e);console.error('[memoboard] shared refresh failed',e);return false;}
    finally{state.loading=false;updateWorkspaceSwitch();updateStorageInfo();}
  }
  function currentNotes(){return state.notes.map(toAppNote);}
  function getNote(id){return currentNotes().find(n=>n.id===id)||null;}
  function replaceSavedNote(saved){
    const sn=normalizeSharedNote(saved);
    const i=state.notes.findIndex(x=>String(x.id)===String(sn.id));
    if(i>=0)state.notes[i]=sn; else state.notes.push(sn);
    const app=toAppNote(sn);
    const gi=notes.findIndex(x=>String(x.id)===String(app.id));
    if(gi>=0)notes[gi]=app; else notes.push(app);
    invalidateIndex();
    return app;
  }
  async function putNote(note,opts){
    opts=opts||{};
    if(!state.configured){toast('공유폴더를 먼저 선택하세요');return false;}
    const expected=Number(note&&note._sharedUpdatedAt)||0;
    const request={note:fromAppNote(note),expectedUpdatedAt:expected};
    if(state.editId===note.id&&state.editToken)request.lockToken=state.editToken;
    try{
      const res=await native().sharedSaveNote(request);
      if(res&&res.locked){toast('다른 사용자가 편집 중입니다: '+(res.owner||(res.lock&&res.lock.owner)||'알 수 없음'));await refresh(true);return false;}
      if(res&&res.conflict){toast('공유 메모 충돌: 다른 사용자가 먼저 저장했습니다');await refresh(true);return false;}
      if(res&&res.ok){replaceSavedNote(res.note||request.note);return true;}
    }catch(e){console.error('[memoboard] shared save failed',e);toast('공유 메모 저장 실패');}
    return false;
  }
  async function putNotes(arr,opts){
    arr=Array.isArray(arr)?arr:[];
    let ok=true;
    for(const n of arr){if(!await putNote(n,Object.assign({},opts,{skipRender:true})))ok=false;}
    return ok;
  }
  async function deleteNote(id,opts){
    if(!state.configured)return false;
    const old=state.notes.find(x=>String(x.id)===String(id));
    try{
      const res=await native().sharedDeleteNote({id,expectedUpdatedAt:Number(old&&old.updatedAt)||0,author:author()});
      if(res&&res.conflict){toast('공유 메모 삭제 충돌: 새로고침합니다');await refresh(true);return false;}
      if(res&&res.ok&&res.note)replaceSavedNote(res.note);
      else await refresh(true);
      return true;
    }catch(e){console.error('[memoboard] shared delete failed',e);toast('공유 메모 삭제 실패');return false;}
  }
  async function acquireLock(id){
    if(!isActive()||!state.configured||!native())return false;
    state.editId=id;state.editToken='';
    try{
      const res=await native().sharedAcquireLock({id,owner:author()});
      if(res&&res.ok){state.editToken=res.token||'';return true;}
      if(res&&res.locked){toast('다른 사용자가 편집 중입니다: '+(res.owner||'알 수 없음'));return false;}
    }catch(e){console.warn('[memoboard] lock acquire failed',e);}
    return false;
  }
  async function releaseLock(id){
    if(!id)id=state.editId;
    const token=state.editToken;
    state.editId=null;state.editToken='';
    if(id&&token&&native()){try{await native().sharedReleaseLock({id,token});}catch(e){}}
  }

  function ensureWritable(){
    if(!isActive())return true;
    if(state.configured)return true;
    toast('공유 메모를 만들려면 먼저 공유폴더를 선택하세요');
    chooseFolder();
    return false;
  }

  async function switchWorkspace(next){
    next=next==='shared'?'shared':'personal';
    if(next===(window.MBStore&&StoreService.workspace?StoreService.workspace():meta.workspace))return;
    if(editing){toast('에디터를 닫은 뒤 작업함을 전환하세요');return;}
    if(window.MBStore&&StoreService.setWorkspace)StoreService.setWorkspace(next); else meta.workspace=next;
    if(next==='personal'){
      notes=(await dbAll()).map(normalizeNote);
      await metaSave({silent:true});
      invalidateIndex();render();toast('개인 작업함으로 전환했습니다');return;
    }
    if(!state.configured){const ok=await chooseFolder();if(!ok){if(window.MBStore&&StoreService.setWorkspace)StoreService.setWorkspace('personal');else meta.workspace='personal';await metaSave({silent:true});updateWorkspaceSwitch();return;}}
    await refresh(true);
    notes=currentNotes();
    await metaSave({silent:true});
    invalidateIndex();render();toast('공유 작업함으로 전환했습니다');
  }
  function updateWorkspaceSwitch(){
    const box=$('#workspaceSwitch');if(!box)return;
    box.querySelectorAll('[data-workspace]').forEach(b=>b.classList.toggle('on',b.dataset.workspace===(window.MBStore&&StoreService.workspace?StoreService.workspace():(meta.workspace||'personal'))));
    document.body.classList.toggle('workspace-shared',isActive());
  }
  function setupHtml(){return '<div class="workspace-setup"><div class="workspace-setup-card"><h2>공유 작업함 연결</h2><p>같은 공유폴더를 지정한 사용자끼리 메모/달력 보드를 함께 봅니다. 실행파일 위치는 각자 달라도 됩니다.</p><ul><li>메모 1개를 JSON 파일 1개로 저장합니다.</li><li>편집 시 잠금 파일과 updatedAt 충돌 검사를 사용합니다.</li><li>기존 개인 메모는 IndexedDB에 그대로 남습니다.</li></ul><div class="workspace-setup-actions"><button class="primary" data-shared-pick="1">공유폴더 선택</button><button class="softbtn" data-workspace="personal">개인 작업함으로 돌아가기</button></div></div></div>';}
  function bannerHtml(){
    if(!isActive())return '';
    if(!state.configured)return '<div class="workspace-banner"><b>공유 작업함</b><span>공유폴더가 아직 지정되지 않았습니다.</span><div class="hspace"></div><button class="softbtn" data-shared-pick="1">공유폴더 선택</button></div>';
    return '<div class="workspace-banner"><b>공유 작업함</b><span>'+esc(state.root)+'</span><span>동기화 '+(state.lastSyncAt?relTime(state.lastSyncAt):'대기')+'</span><span>작성자 '+esc(author())+'</span><div class="hspace"></div><button class="softbtn" data-shared-refresh="1">새로고침</button><button class="softbtn" data-shared-pick="1">폴더 변경</button></div>';
  }
  function bind(){
    document.addEventListener('click',e=>{
      const ws=e.target.closest('[data-workspace]');if(ws){e.preventDefault();switchWorkspace(ws.dataset.workspace);return;}
      const pick=e.target.closest('[data-shared-pick]');if(pick){e.preventDefault();chooseFolder().then(()=>{if(isActive())refresh(true);else updateWorkspaceSwitch();});return;}
      const ref=e.target.closest('[data-shared-refresh]');if(ref){e.preventDefault();refresh(false);return;}
      const name=e.target.closest('[data-shared-name-save]');if(name){const el=$('#sharedDisplayName');saveName(el&&el.value);return;}
    });
  }
  bind();
  return {state,STATUS_META,init,isActive,author,chooseFolder,saveName,refresh,currentNotes,getNote,putNote,putNotes,deleteNote,acquireLock,releaseLock,switchWorkspace,updateWorkspaceSwitch,setupHtml,bannerHtml,statusLabel,ensureWritable};
})();
window.SharedBoard=SharedBoard;
function workspaceBannerHtml(){return window.SharedBoard?SharedBoard.bannerHtml():'';}
function updateWorkspaceSwitch(){if(window.SharedBoard)SharedBoard.updateWorkspaceSwitch();}

function workspaceWritable(){return !window.SharedBoard||SharedBoard.ensureWritable();}
