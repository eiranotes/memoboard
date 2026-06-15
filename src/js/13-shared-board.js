'use strict';
/* ================= v12 Shared workspace source =================
   Shared mode no longer has a separate page. The normal Memo/Calendar UI
   switches data source between personal IndexedDB and shared folder JSON files.
*/
const SharedBoard=(()=>{
  const POLL_MS=5000;
  const STATUS_META={open:['요청','📥'],doing:['진행','🛠'],hold:['보류','⏸'],done:['완료','✅']};
  const state={configured:false,root:'',displayName:'',notes:[],locks:new Map(),manifest:null,health:null,manifestAppliedAt:0,healthAt:0,lockHeartbeat:null,loading:false,lastSyncAt:0,error:'',poll:null,active:false,editId:null,editToken:''};
  function native(){return window.memoboardNative&&window.memoboardNative.available&&window.memoboardNative.sharedLoadBoard?window.memoboardNative:null;}
  function explicitDisplayName(){return (state.displayName||localStorage.getItem('mb-shared-display-name')||'').trim();}
  function author(){return explicitDisplayName();}
  function hasIdentity(){return !!explicitDisplayName();}
  function focusSharedNameSetting(){
    try{
      if(typeof setView==='function')setView('settings');
      setTimeout(()=>{const el=document.querySelector('#sharedDisplayName');if(el){el.focus();el.scrollIntoView({block:'center'});}},60);
    }catch(e){}
  }
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
  async function requireIdentity(){
    if(hasIdentity())return true;
    const msg='공유폴더를 연결하려면 설정에서 표시 이름을 먼저 입력하세요';
    if(window.MBDialog&&MBDialog.confirm){
      const go=await MBDialog.confirm(msg,{title:'표시 이름 필요',okText:'설정 열기',cancelText:'취소',danger:false,icon:'👤'});
      if(go)focusSharedNameSetting();
    }else{
      toast(msg,focusSharedNameSetting,'설정 열기');
    }
    return false;
  }
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
      weeklyKey:sn.weeklyKey||null,_shared:true,_sharedStatus:sn.status,_sharedUpdatedAt:sn.updatedAt,_sharedMtime:Number(sn._sharedMtime)||0,
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

  function currentZoneManifest(){
    if(window.MBStore&&StoreService.exportZones)return StoreService.exportZones();
    ensureZones();
    return (meta.memoZones||[]).map((name,i)=>({id:'zone-'+i,name:String(name||('구역 '+(i+1))),collapsed:!!(meta.collapsedZones&&meta.collapsedZones[i]),order:i}));
  }
  function manifestZones(manifest){
    const zones=manifest&&Array.isArray(manifest.zones)?manifest.zones:[];
    return zones.map((z,i)=>({
      id:String(z&&z.id||('zone-'+i)),
      name:String(z&&z.name||('구역 '+(i+1))).trim()||('구역 '+(i+1)),
      collapsed:!!(z&&z.collapsed),
      order:Number.isFinite(Number(z&&z.order))?Number(z.order):i
    })).filter(z=>z.name).slice(0,MAX_ZONES);
  }
  function hasManifestZones(manifest){return manifestZones(manifest).length>0;}
  function applyManifest(manifest,opts){
    opts=opts||{};
    if(manifest&&typeof manifest==='object')state.manifest=manifest;
    const zones=manifestZones(state.manifest);
    let changed=false;
    if(zones.length&&window.MBStore&&StoreService.applySharedZones){
      changed=StoreService.applySharedZones(zones);
      if(changed){
        metaSave({silent:true});
        if(opts.toast)toast('공유폴더 구역 설정을 적용했습니다');
      }
    }
    return changed;
  }
  function applyHealth(health){
    if(health&&typeof health==='object'){state.health=health;state.healthAt=Date.now();}
  }
  async function inspect(silent){
    if(!native()||!state.configured){if(!silent)toast('공유폴더를 먼저 선택하세요');return false;}
    try{
      const res=await native().sharedInspectBoard();
      if(res&&res.ok){
        applyConfig(res.config||{});
        if(res.manifest)applyManifest(res.manifest,{toast:false});
        applyHealth(res.health);
        if(!silent)toast('공유폴더 상태를 점검했습니다');
        if((window.MBStore&&StoreService.view?StoreService.view():meta.view)==='settings')render();
        return true;
      }
    }catch(e){console.warn('[memoboard] shared inspect failed',e);}
    if(!silent)toast('공유폴더 상태 점검 실패');
    return false;
  }
  async function publishManifest(silent){
    if(!native()||!state.configured){if(!silent)toast('공유폴더를 먼저 선택하세요');return false;}
    if(!hasIdentity()){if(!silent)await requireIdentity();return false;}
    try{
      const res=await native().sharedUpdateManifest({zones:currentZoneManifest(),author:author()});
      if(res&&res.ok){
        if(res.manifest)applyManifest(res.manifest,{toast:false});
        applyHealth(res.health);
        if(!silent)toast('현재 구역 설정을 공유폴더 매니페스트에 저장했습니다');
        if((window.MBStore&&StoreService.view?StoreService.view():meta.view)==='settings')render();
        return true;
      }
    }catch(e){console.warn('[memoboard] shared manifest save failed',e);}
    if(!silent)toast('공유 매니페스트 저장 실패');
    return false;
  }

  async function compact(){
    if(!native()||!state.configured){toast('공유폴더를 먼저 선택하세요');return false;}
    try{
      const res=await native().sharedCompactBoard({retentionDays:14});
      if(res&&res.ok){
        applyHealth(res.health);
        toast('공유폴더 정리: 삭제보관 '+(res.archivedDeleted||0)+' · 손상격리 '+(res.quarantinedCorrupt||0)+' · 잠금정리 '+(res.removedLocks||0));
        await refresh(true);
        if((window.MBStore&&StoreService.view?StoreService.view():meta.view)==='settings')render();
        return true;
      }
    }catch(e){console.warn('[memoboard] shared compact failed',e);}
    toast('공유폴더 정리 실패');
    return false;
  }

  function uiDraftActive(){
    const ae=document.activeElement;
    if(ae&&ae.closest&&ae.closest('.dquick,.quickcomposer.open'))return true;
    if(window.MBCalendarDraft&&MBCalendarDraft.isActive&&MBCalendarDraft.isActive())return true;
    const qc=document.querySelector('.quickcomposer.open');
    if(qc){
      const t=qc.querySelector('#qcTitle'), b=qc.querySelector('#qcBody');
      if((t&&t.value.trim())||(b&&b.value.trim()))return true;
    }
    return false;
  }
  async function init(){
    if(!native())return;
    try{const cfg=await native().getSharedConfig();applyConfig(cfg);}catch(e){console.warn('[memoboard] shared config load failed',e);}
    if(!state.poll){state.poll=setInterval(()=>{
      // 편집 중인 메모는 5초 자동 동기화 대상에서 제외한다.
      // 다른 사용자의 저장본이 들어와도 현재 입력 중인 내용/커서가 사라지지 않게 한다.
      if(isActive()&&state.configured&&!state.loading&&!editing&&!uiDraftActive())refresh(true);
    },POLL_MS);}
  }
  async function chooseFolder(){
    if(!native()){toast('공유 작업함은 Tauri 데스크톱 앱에서만 지원합니다');return false;}
    if(!(await requireIdentity()))return false;
    const name=author();
    const res=await native().pickSharedDir({displayName:name});
    if(!res||!res.ok)return false;
    applyConfig(res.config);
    await refresh(true);
    if(!hasManifestZones(state.manifest))await publishManifest(true);
    else applyManifest(state.manifest,{toast:false});
    await inspect(true);
    toast('공유폴더를 연결했습니다');
    return true;
  }
  async function saveName(name){
    name=(name||'').trim();
    if(!name){
      toast('공유 표시 이름을 입력하세요');
      focusSharedNameSetting();
      return false;
    }
    state.displayName=name;
    localStorage.setItem('mb-shared-display-name',name);
    if(native()&&native().setSharedOptions){
      try{
        const res=await native().setSharedOptions({displayName:name});
        applyConfig(res&&res.config);
      }catch(e){
        console.warn(e);
        toast('공유 표시 이름 저장 실패');
        return false;
      }
    }
    toast('공유 표시 이름을 저장했습니다');
    return true;
  }
  async function refresh(silent,opts){
    opts=opts||{};
    if(!native()||!state.configured)return false;
    if(!opts.force&&(editing||uiDraftActive())){
      if(!silent)toast(editing?'편집 중인 메모는 동기화에서 제외됩니다. 닫은 뒤 새로고침하세요':'입력 중인 내용이 있어 동기화를 잠시 멈췄습니다. 저장/취소 후 새로고침하세요');
      return false;
    }
    state.loading=true;state.error='';
    try{
      const res=await native().sharedLoadBoard();
      if(!res||!res.ok){state.error=(res&&res.error)||'공유 작업함 읽기 실패';return false;}
      applyConfig(res.config||{});
      if(res.manifest)applyManifest(res.manifest,{toast:false});
      applyHealth(res.health);
      let nextNotes=Array.isArray(res.notes)?res.notes.map(normalizeSharedNote):[];
      // 수동 새로고침/비정상 이벤트로 refresh가 들어와도 현재 편집 중인 노트는 메모리에서 덮지 않는다.
      // 저장 시점의 충돌 검사는 파일 저장 API의 expectedUpdatedAt/lockToken에서 처리한다.
      if(isActive()&&editing){
        const local=state.notes.find(x=>String(x.id)===String(editing));
        if(local){
          const idx=nextNotes.findIndex(x=>String(x.id)===String(editing));
          if(idx>=0)nextNotes[idx]=local; else nextNotes.push(local);
        }
      }
      state.notes=nextNotes;
      state.locks=new Map((Array.isArray(res.locks)?res.locks:[]).map(l=>[String(l.id||''),l]));
      state.lastSyncAt=Date.now();
      if(isActive()&&!editing){notes=currentNotes();invalidateIndex();if(!silent)toast('공유 작업함을 새로고침했습니다');render();}
      return true;
    }catch(e){state.error=String(e&&e.message||e);console.error('[memoboard] shared refresh failed',e);return false;}
    finally{state.loading=false;updateWorkspaceSwitch();updateStorageInfo();}
  }
  function currentNotes(){return state.notes.map(toAppNote);}
  function getNote(id){return currentNotes().find(n=>n.id===id)||null;}
  function replaceSavedNote(saved,mtime){
    const sn=normalizeSharedNote(saved);
    if(mtime)sn._sharedMtime=Number(mtime)||0;
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
    if(!hasIdentity()){await requireIdentity();return false;}
    const expected=Number(note&&note._sharedUpdatedAt)||0;
    const request={note:fromAppNote(note),expectedUpdatedAt:expected,expectedMtime:Number(note&&note._sharedMtime)||0};
    if(state.editId===note.id&&state.editToken)request.lockToken=state.editToken;
    try{
      const res=await native().sharedSaveNote(request);
      if(res&&res.locked){toast('다른 사용자가 편집 중입니다: '+(res.owner||(res.lock&&res.lock.owner)||'알 수 없음'));await refresh(true);return false;}
      if(res&&res.conflict){toast('공유 메모 충돌: 다른 사용자가 먼저 저장했습니다');await refresh(true);return false;}
      if(res&&res.ok){replaceSavedNote(res.note||request.note,res.mtime);return true;}
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
    if(!hasIdentity()){await requireIdentity();return false;}
    const old=state.notes.find(x=>String(x.id)===String(id));
    try{
      const res=await native().sharedDeleteNote({id,expectedUpdatedAt:Number(old&&old.updatedAt)||0,expectedMtime:Number(old&&old._sharedMtime)||0,author:author()});
      if(res&&res.conflict){toast('공유 메모 삭제 충돌: 새로고침합니다');await refresh(true);return false;}
      if(res&&res.ok&&res.note)replaceSavedNote(res.note,res.mtime);
      else await refresh(true);
      return true;
    }catch(e){console.error('[memoboard] shared delete failed',e);toast('공유 메모 삭제 실패');return false;}
  }
  function stopLockHeartbeat(){
    if(state.lockHeartbeat){clearInterval(state.lockHeartbeat);state.lockHeartbeat=null;}
  }
  async function renewLock(silent){
    if(!state.editId||!state.editToken||!native()||!native().sharedRenewLock)return false;
    try{
      const res=await native().sharedRenewLock({id:state.editId,token:state.editToken,owner:author()});
      if(res&&res.ok)return true;
      if(!silent)toast('공유 편집 잠금이 만료되었거나 다른 사용자가 가져갔습니다');
    }catch(e){console.warn('[memoboard] lock renew failed',e);}
    return false;
  }
  function startLockHeartbeat(){
    stopLockHeartbeat();
    state.lockHeartbeat=setInterval(()=>renewLock(true),30000);
  }

  async function acquireLock(id){
    if(!isActive()||!state.configured||!native())return false;
    if(!hasIdentity()){await requireIdentity();return false;}
    try{
      const res=await native().sharedAcquireLock({id,owner:author()});
      if(res&&res.ok){state.editId=id;state.editToken=res.token||'';startLockHeartbeat();return true;}
      if(res&&res.locked){
        state.editId=null;state.editToken='';
        toast('다른 사용자가 편집 중입니다: '+(res.owner||'알 수 없음'));
        return false;
      }
    }catch(e){console.warn('[memoboard] lock acquire failed',e);}
    state.editId=null;state.editToken='';
    return false;
  }
  async function releaseLock(id){
    if(!id)id=state.editId;
    const token=state.editToken;
    stopLockHeartbeat();
    state.editId=null;state.editToken='';
    if(id&&token&&native()){try{await native().sharedReleaseLock({id,token});}catch(e){}}
  }
  function hasEditLock(id){return !!(id&&state.editId===id&&state.editToken);}

  function ensureWritable(){
    if(!isActive())return true;
    if(!hasIdentity()){requireIdentity();return false;}
    if(state.configured)return true;
    toast('공유 메모를 만들려면 먼저 공유폴더를 선택하세요');
    chooseFolder();
    return false;
  }

  async function switchWorkspace(next){
    next=next==='shared'?'shared':'personal';
    if(next===(window.MBStore&&StoreService.workspace?StoreService.workspace():meta.workspace))return;
    if(editing){toast('에디터를 닫은 뒤 작업함을 전환하세요');return;}
    if(next==='shared'&&!(await requireIdentity())){updateWorkspaceSwitch();return;}
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
      const inspectBtn=e.target.closest('[data-shared-inspect]');if(inspectBtn){e.preventDefault();inspect(false);return;}
      const pub=e.target.closest('[data-shared-manifest-publish]');if(pub){e.preventDefault();publishManifest(false);return;}
      const apply=e.target.closest('[data-shared-manifest-apply]');if(apply){e.preventDefault();const changed=applyManifest(state.manifest,{toast:true});if(changed){metaSave({silent:true});render();}else toast('적용할 공유 구역 변경사항이 없습니다');return;}
      const open=e.target.closest('[data-shared-open-root]');if(open){e.preventDefault();if(native()&&state.root)native().openPath(state.root);return;}
      const compactBtn=e.target.closest('[data-shared-compact]');if(compactBtn){e.preventDefault();compact();return;}
    });
  }
  bind();
  return {state,STATUS_META,init,isActive,author,displayName:explicitDisplayName,chooseFolder,saveName,refresh,inspect,publishManifest,applyManifest,currentNotes,getNote,putNote,putNotes,deleteNote,acquireLock,releaseLock,hasEditLock,switchWorkspace,updateWorkspaceSwitch,setupHtml,bannerHtml,statusLabel,ensureWritable,compact};
})();
window.SharedBoard=SharedBoard;
function workspaceBannerHtml(){return window.SharedBoard?SharedBoard.bannerHtml():'';}
function updateWorkspaceSwitch(){if(window.SharedBoard)SharedBoard.updateWorkspaceSwitch();}

function workspaceWritable(){return !window.SharedBoard||SharedBoard.ensureWritable();}
