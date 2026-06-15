'use strict';
/* ================= trash ================= */
function renderTrash(m){
  const arr=notes.filter(n=>n.deletedAt).map(normalizeNote).sort((a,b)=>b.deletedAt-a.deletedAt);
  let h='<div class="viewpad"><div class="trashbar"><div class="grouplabel">🗑 휴지통 · 30일 후 자동 삭제</div>'+
    (arr.length?'<button class="todaybtn" id="emptyTrash" style="color:var(--danger)">휴지통 비우기</button>':'')+'</div>';
  if(!arr.length)h+='<div class="empty"><b>휴지통이 비어 있습니다</b></div>';
  else{
    h+=arr.map(n=>{
      const left=Math.max(0,30-Math.floor((Date.now()-n.deletedAt)/864e5));
      return '<div class="trashrow"><span class="dot" style="background:var(--c'+n.color+'s)"></span>'+
        '<span class="t">'+esc(dispTitle(n))+'</span><span class="d">'+left+'일 남음</span>'+ 
        '<span class="actions"><button class="res" data-id="'+n.id+'">복원</button><button class="del" data-id="'+n.id+'">삭제</button></span></div>';}).join('');}
  h+='</div>';m.innerHTML=h;
  m.querySelectorAll('.res').forEach(b=>b.onclick=()=>{const n=notes.find(x=>x.id===b.dataset.id);n.deletedAt=null;touch(n);toast('복원했습니다');});
  m.querySelectorAll('.del').forEach(b=>b.onclick=()=>{
    notes=notes.filter(x=>x.id!==b.dataset.id);removeStoredNote(b.dataset.id);});
  const et=$('#emptyTrash');if(et)et.onclick=()=>{
    const ids=notes.filter(n=>n.deletedAt).map(n=>n.id);
    notes=notes.filter(n=>!n.deletedAt);Promise.all(ids.map(id=>removeStoredNote(id,{skipRender:true}))).then(()=>{render();toast('휴지통을 비웠습니다');});};}

async function persistNote(n,opts){
  opts=opts||{};
  normalizeNote(n);if(!opts.keepUpdatedAt)n.updatedAt=Date.now();noteCache.delete(n.id);
  const intendedAt=Number(n.updatedAt||Date.now());
  if(n.id)localNoteWriteStamp.set(n.id,intendedAt);
  const ok=await StorageService.putNote(n,opts);
  if(!ok&&n.id&&localNoteWriteStamp.get(n.id)===intendedAt)localNoteWriteStamp.delete(n.id);
  if(ok&&!opts.skipRender){invalidateIndex();render();}
  return ok;
}
async function persistNotes(arr,opts){
  opts=opts||{};
  arr=Array.isArray(arr)?arr:[];
  if(!arr.length)return true;
  arr.forEach(n=>{normalizeNote(n);if(!opts.keepUpdatedAt)n.updatedAt=Date.now();noteCache.delete(n.id);if(n.id)localNoteWriteStamp.set(n.id,Number(n.updatedAt||Date.now()));});
  const ok=await StorageService.putNotes(arr,opts);
  if(!ok)arr.forEach(n=>{if(n&&n.id)localNoteWriteStamp.delete(n.id);});
  if(ok&&!opts.skipRender){invalidateIndex();render();}
  return ok;
}
async function removeStoredNote(id,opts){
  opts=opts||{};
  noteCache.delete(id);localNoteWriteStamp.delete(id);
  const ok=await StorageService.deleteNote(id,opts);
  if(ok&&!opts.skipRender){invalidateIndex();render();}
  return ok;
}
function touch(n,skipRender){return persistNote(n,{skipRender:!!skipRender});}

/* ================= editor ================= */
const DEFAULT_TEMPLATES={
meeting:{label:'회의록',body:'## 회의 정보\n- 일시: \n- 참석: \n\n## 안건\n- \n\n## 결정 사항\n- \n\n## 액션 아이템\n- [ ] \n- [ ] '},
daily:{label:'일일 메모',body:'## 오늘 할 일\n- [ ] \n- [ ] \n\n## 메모\n\n\n## 내일로\n- '},
sql:{label:'SQL 스니펫',body:'```sql\nSELECT *\n  FROM \n WHERE 1=1\n```\n\n**용도**: \n**주의**: '},
weekly:{label:'주간 리뷰',body:'## 이번 주 한 일\n- \n\n## 잘된 것 / 아쉬운 것\n- \n\n## 다음 주 계획\n- [ ] '}
};
function customTemplateList(){return window.MBStore&&StoreService.templates?StoreService.templates():(Array.isArray(meta.customTemplates)?meta.customTemplates:null);}
function setCustomTemplateList(list){if(window.MBStore&&StoreService.setTemplates)StoreService.setTemplates(list);else meta.customTemplates=Array.isArray(list)?list:null;}
function templateList(){
  const arr=customTemplateList();
  if(arr&&arr.length)return arr;
  return Object.entries(DEFAULT_TEMPLATES).map(([id,t])=>({id,label:t.label,body:t.body,builtin:true}));
}
function templateMap(){const out={};templateList().forEach(t=>out[t.id]=t);return out;}
function refreshTemplateSelect(){
  const sel=$('#edTpl');if(!sel)return;
  sel.innerHTML='<option value="">템플릿</option>'+templateList().map(t=>'<option value="'+esc(t.id)+'">'+esc(t.label)+'</option>').join('');
}
const TemplateManager={
  open(){
    if(!customTemplateList()||!customTemplateList().length)setCustomTemplateList(templateList().map(t=>({id:t.id,label:t.label,body:t.body})));
    this.render();$('#tplWrap').classList.add('open');
  },
  render(){
    const list=customTemplateList()||[];
    $('#tplBody').innerHTML='<p style="font-size:12px;color:var(--sub);margin-bottom:10px">템플릿은 에디터의 템플릿 드롭다운에 표시됩니다. 빈 항목은 저장 시 제외됩니다.</p>'+list.map((t,i)=>
      '<div class="tplrow" data-i="'+i+'"><input class="tpllabel" value="'+esc(t.label||'')+'" placeholder="이름"><textarea class="tplbody" placeholder="본문">'+esc(t.body||'')+'</textarea><div><button data-tpl="del">삭제</button></div></div>'
    ).join('')+'<button class="softbtn" id="tplAdd">＋ 템플릿 추가</button> <button class="primary" id="tplSave">저장</button> <button class="softbtn" id="tplReset">기본값 복원</button>';
    $('#tplAdd').onclick=()=>{list.push({id:'tpl-'+Date.now().toString(36),label:'새 템플릿',body:''});this.render();};
    $('#tplSave').onclick=()=>this.save();
    $('#tplReset').onclick=()=>{setCustomTemplateList(null);metaSave({silent:true});refreshTemplateSelect();$('#tplWrap').classList.remove('open');toast('기본 템플릿으로 복원했습니다');};
    $('#tplBody').querySelectorAll('[data-tpl="del"]').forEach(b=>b.onclick=()=>{const i=+b.closest('.tplrow').dataset.i;list.splice(i,1);this.render();});
  },
  save(){
    const rows=[...$('#tplBody').querySelectorAll('.tplrow')];
    const old=customTemplateList()||[];
    setCustomTemplateList(rows.map((r,i)=>({id:(old[i]&&old[i].id)||('tpl-'+Date.now().toString(36)+'-'+i),label:r.querySelector('.tpllabel').value.trim(),body:r.querySelector('.tplbody').value})).filter(t=>t.label||t.body));
    metaSave({silent:true});refreshTemplateSelect();$('#tplWrap').classList.remove('open');toast('템플릿을 저장했습니다');
  }
};
window.MBTemplateManager=TemplateManager;

const QuickMemo={
  open(){
    // 빠른 메모는 별도 모달보다 메모 보드 상단의 Keep식 빠른 입력을 우선 사용한다.
    // 다른 화면에서 호출되면 메모 화면으로 전환한 뒤 인라인 입력창을 연다.
    try{
      if((window.MBStore&&StoreService.view?StoreService.view():meta.view)!=='memo')setView('memo');
      const openInline=()=>{
        const box=$('#quickComposer');
        if(box){box.click();return true;}
        return false;
      };
      if(openInline())return;
      setTimeout(()=>{if(!openInline())this.openLegacyModal();},30);
      return;
    }catch(e){this.openLegacyModal();}
  },
  openLegacyModal(){
    $('#quickTitle').value='';$('#quickBody').value='';$('#quickWrap').classList.add('open');
    setTimeout(()=>$('#quickTitle').focus(),30);
  },
  close(){ $('#quickWrap').classList.remove('open'); },
  async save(){
    const title=$('#quickTitle').value.trim();
    const body=$('#quickBody').value.trim();
    if(!title&&!body){this.close();return;}
    if(typeof workspaceWritable==='function'&&!workspaceWritable())return;
    const n=newNote({title,body,kind:'memo',size:'normal',zone:0,morder:memoTopOrder(0)});
    notes.push(n);
    await persistNote(n,{skipRender:true});
    this.close();render();toast('빠른 메모를 저장했습니다');
  }
};
window.MBQuickMemo=QuickMemo;


const MBDialog={
  confirm(message,opts){
    opts=opts||{};
    const wrap=$('#confirmWrap');
    if(!wrap){try{toast(message);}catch(_){}return Promise.resolve(false);}
    $('#confirmTitle').textContent=opts.title||'확인';
    $('#confirmIcon').textContent=opts.icon||'⚠️';
    $('#confirmMsg').textContent=message;
    $('#confirmOk').textContent=opts.okText||'확인';
    $('#confirmCancel').textContent=opts.cancelText||'취소';
    $('#confirmOk').className=opts.danger===false?'primary':'dangerbtn';
    wrap.classList.add('open');
    return new Promise(resolve=>{
      const cleanup=(v)=>{
        wrap.classList.remove('open');
        $('#confirmOk').onclick=null;$('#confirmCancel').onclick=null;
        wrap.onmousedown=null;document.removeEventListener('keydown',onKey,true);
        resolve(v);
      };
      const onKey=(e)=>{if(e.key==='Escape'){e.preventDefault();cleanup(false);}if(e.key==='Enter'){e.preventDefault();cleanup(true);}};
      $('#confirmOk').onclick=()=>cleanup(true);
      $('#confirmCancel').onclick=()=>cleanup(false);
      wrap.onmousedown=e=>{if(e.target===wrap)cleanup(false);};
      document.addEventListener('keydown',onKey,true);
      setTimeout(()=>$('#confirmCancel').focus(),20);
    });
  }
};
window.MBDialog=MBDialog;

const RestoreCenter={
  async open(){
    $('#restoreBody').innerHTML='<div class="wempty">백업 목록을 읽는 중...</div>';
    $('#restoreWrap').classList.add('open');
    if(!(window.memoboardNative&&window.memoboardNative.available&&window.memoboardNative.listBackups)){
      $('#restoreBody').innerHTML='<div class="empty"><b>데스크톱 앱에서만 지원합니다</b>브라우저 버전은 JSON 가져오기를 사용하세요.</div>';return;
    }
    try{
      const res=await window.memoboardNative.listBackups();
      const arr=(res&&res.backups)||[];
      if(!arr.length){$('#restoreBody').innerHTML='<div class="empty"><b>백업 파일이 없습니다</b>자동 백업 폴더를 지정하고 백업을 실행하세요.</div>';return;}
      $('#restoreBody').innerHTML=arr.map((b,i)=>'<div class="restoreitem" data-path="'+esc(b.filePath)+'"><div class="rt"><span>'+(b.type==='snapshot'?'🧷':'💾')+'</span><span>'+esc(b.name)+'</span><button data-r="merge">병합 복구</button></div><div class="rs">'+new Date(b.mtime).toLocaleString('ko-KR')+' · '+Math.round((b.size||0)/1024)+' KB</div></div>').join('');
      $('#restoreBody').querySelectorAll('[data-r="merge"]').forEach(btn=>btn.onclick=()=>this.merge(btn.closest('.restoreitem').dataset.path));
    }catch(e){console.error(e);$('#restoreBody').innerHTML='<div class="empty"><b>백업 목록을 읽지 못했습니다</b>자동백업 폴더 권한을 확인하세요.</div>';}
  },
  async merge(filePath){
    if(!await MBDialog.confirm('선택한 백업을 현재 데이터에 병합 복구할까요?\n충돌은 별도 메모로 생성됩니다.',{title:'백업 병합 복구',okText:'병합 복구',danger:false,icon:'💾'}))return;
    try{
      const res=await window.memoboardNative.readBackup(filePath);
      if(!res||!res.ok)throw new Error(res&&res.error||'read failed');
      const r=await ImportService.merge(res.raw);
      $('#restoreWrap').classList.remove('open');
      toast('복구 완료: 신규 '+r.add+'개, 갱신 '+r.upd+'개, 충돌본 '+r.conflict+'개');
    }catch(e){console.error(e);toast('복구 실패: 백업 파일을 읽지 못했습니다');}
  }
};
window.MBRestoreCenter=RestoreCenter;


function editorInputSnapshot(){
  return {
    title:$('#edTitle')?$('#edTitle').value:'',body:$('#edText')?$('#edText').value:'',
    done:$('#edDone')?!!$('#edDone').checked:false,priority:$('#edPriority')?$('#edPriority').value:'normal',
    kind:$('#edKind')?$('#edKind').value:'memo',date:$('#edDate')?($('#edDate').value||null):null,
    dueDate:$('#edDue')?($('#edDue').value||null):null,remind:$('#edRemind')?($('#edRemind').value||null):null,
    folder:$('#edFolder')?$('#edFolder').value.trim():'',tags:$('#edTags')?$('#edTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean):[],
    sharedStatus:$('#edSharedStatus')?$('#edSharedStatus').value:'',assignee:$('#edSharedAssignee')?$('#edSharedAssignee').value.trim():''
  };
}
function isEditorDirty(){
  const n=curNote();if(!n||!edOpenSnap)return false;
  const s=editorInputSnapshot();
  const nTags=Array.isArray(n.tags)?n.tags.slice().sort():[];
  return s.title!==(edOpenSnap.title||'')||s.body!==(edOpenSnap.body||'')||
    s.done!==!!n.done||s.priority!==(n.priority||'normal')||s.kind!==(n.kind||'memo')||
    s.date!==(n.date||null)||s.dueDate!==(n.dueDate||null)||s.remind!==(n.remind||null)||
    s.folder!==(n.folder||'')||JSON.stringify(s.tags.slice().sort())!==JSON.stringify(nTags)||
    (window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive()&&(s.sharedStatus!==(n._sharedStatus||'open')||s.assignee!==(n.assignee||'')));
}
async function openEditor(id,mode){
  let n=notes.find(x=>x.id===id);
  if(!n){n=newNote();notes.push(n);await persistNote(n,{skipRender:true});}
  normalizeNote(n);
  if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive()){
    const ok=await SharedBoard.acquireLock(n.id);
    if(!ok){
      // 잠금 확보 실패 시 에디터를 열지 않는다. 입력/자동저장 루프가 시작되면 공유폴더에서 경고가 반복된다.
      return false;
    }
  }
  refreshTemplateSelect();
  editing=n.id;
  editConflict=null;
  edOpenSnap={title:n.title,body:n.body,updatedAt:n.updatedAt||0,hash:comparableNote(n)};
  edHistSnap={title:n.title,body:n.body,t:Date.now(),len:(n.title||'').length+(n.body||'').length};
  $('#edTitle').value=n.title;
  $('#edText').value=n.body;
  $('#edDone').checked=!!n.done;
  $('#edPriority').value=n.priority||'normal';
  $('#edKind').value=n.kind||'memo';
  $('#edDate').value=n.date||'';
  $('#edDue').value=n.dueDate||'';
  $('#edRemind').value=n.remind||'';
  $('#edFolder').value=n.folder||'';
  $('#edTags').value=(n.tags||[]).join(', ');
  const ss=$('#edSharedStatus');if(ss)ss.value=n._sharedStatus||'open';
  const sa=$('#edSharedAssignee');if(sa)sa.value=n.assignee||'';
  $('#edTpl').value='';
  $('#edPin').classList.toggle('pin-on',n.pinned);
  $('#edPin').style.color=n.pinned?'var(--accent-ink)':'';
  $('#edLock').classList.toggle('on',!!n.locked);$('#edLock').textContent=n.locked?'🔒':'🔓';
  $('#edArchive').classList.toggle('on',!!n.archived);
  $('#edColors').innerHTML=COLORS.map(c=>
    '<div class="cdot'+(n.color===c?' on':'')+'" data-c="'+c+'" title="'+COLOR_NAMES[c]+'" style="background:var(--c'+c+'s)"></div>').join('');
  $('#edBox').style.borderTopColor='var(--c'+n.color+'s)';
  $('#edSaved').textContent='저장됨 · '+relTime(n.updatedAt);
  $('#edWide').classList.toggle('on',!!(window.MBStore&&StoreService.editorWide?StoreService.editorWide():meta.editorWide));
  renderBacklinks(n);renderEdPrev();updCount();
  const dl=$('#folderDl');dl.innerHTML='';
  [...new Set(liveNotes().map(x=>x.folder).filter(Boolean))].forEach(f=>{const o=document.createElement('option');o.value=f;dl.appendChild(o);});
  $('#edWrap').classList.add('open');
  const openMode=mode||'edit';
  setEdMode(openMode);
  if(openMode==='edit'){$('#edText').focus();}else{$('#edPrev').focus&&$('#edPrev').focus();}}
function curNote(){return notes.find(x=>x.id===editing);}
function renderBacklinks(n){
  const t=n.title.trim();const bl=t?liveNotes().filter(x=>x.id!==n.id&&x.body.includes('[['+t+']]')):[];
  $('#edBacklinks').innerHTML=bl.length?'백링크: '+bl.map(x=>'<a data-id="'+x.id+'">'+esc(dispTitle(x))+'</a>').join(''):'';}
function renderEdPrev(){const n=curNote();if(!n)return;
  const prev=$('#edPrev');
  if(window.MBMarkdown&&typeof window.MBMarkdown.resetMermaid==='function')window.MBMarkdown.resetMermaid();
  prev.innerHTML=md2html(n.body);
  if(window.MBMarkdown&&typeof window.MBMarkdown.hydrate==='function')window.MBMarkdown.hydrate(prev);
  prev.querySelectorAll('input[data-ti]').forEach(cb=>{
    cb.addEventListener('change',()=>{
      toggleTaskInBody(n,+cb.dataset.ti);
      $('#edText').value=n.body;touch(n,true);renderEdPrev();});});
  prev.querySelectorAll('a.wiki').forEach(a=>{
    a.addEventListener('click',()=>openWiki(a.dataset.t));});}
function openWiki(t){
  t=t.trim();
  let n=liveNotes().find(x=>x.title.trim().toLowerCase()===t.toLowerCase());
  if(!n){n=newNote({title:t});notes.push(n);persistNote(n,{skipRender:true});toast('새 메모 생성: '+t);}
  saveEditor();openEditor(n.id);}
function updCount(){const n=curNote();if(!n)return;
  $('#edCount').textContent=n.body.length+'자 · '+n.body.split('\n').length+'줄';}
function pushHistorySnapshot(n,snap){
  if(!n||!snap)return false;
  if(snap.title===n.title&&snap.body===n.body)return false;
  n.history=n.history||[];
  const head=n.history[0];
  if(head&&head.title===snap.title&&head.body===snap.body)return false;
  n.history.unshift({t:Date.now(),title:snap.title,body:snap.body});
  n.history=n.history.slice(0,10);
  return true;
}
function maybeAutoHistorySnapshot(n){
  if(!n||!edHistSnap)return;
  const curLen=(n.title||'').length+(n.body||'').length;
  const lenDelta=Math.abs(curLen-(edHistSnap.len||0));
  const timeDelta=Date.now()-(edHistSnap.t||0);
  const changed=edHistSnap.title!==n.title||edHistSnap.body!==n.body;
  if(changed&&(lenDelta>=500||(timeDelta>=5*60*1000&&lenDelta>=80))){
    if(pushHistorySnapshot(n,edHistSnap))toast('편집 스냅샷을 버전 기록에 저장했습니다');
    edHistSnap={title:n.title,body:n.body,t:Date.now(),len:curLen};
  }
}
async function saveEditor(opts){const n=curNote();if(!n)return false;
  opts=opts||{};
  n.title=$('#edTitle').value;
  n.body=$('#edText').value;
  const wasDone=!!n.done;
  n.done=$('#edDone').checked;
  n.doneAt=n.done?(wasDone?n.doneAt||Date.now():Date.now()):null;
  n.priority=$('#edPriority').value||'normal';
  n.kind=$('#edKind').value||'memo';
  n.date=$('#edDate').value||null;
  n.dueDate=$('#edDue').value||null;
  const r=$('#edRemind').value||null;
  if(r!==n.remind){n.remind=r;n.reminded=false;if(r)ensureNotifPerm();}
  n.folder=$('#edFolder').value.trim();
  n.tags=$('#edTags').value.split(',').map(s=>s.trim().replace(/^#/,'')).filter(Boolean);
  if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive()){
    const ss=$('#edSharedStatus'), sa=$('#edSharedAssignee');
    n._sharedStatus=ss?ss.value:(n.done?'done':'open');
    if(n._sharedStatus==='done')n.done=true;
    n.assignee=sa?sa.value.trim():'';
  }
  if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive()&&(!SharedBoard.hasEditLock||!SharedBoard.hasEditLock(n.id))){
    $('#edSaved').textContent='공유 편집 잠금 없음 · 저장하지 않음';
    if(opts.manual)toast('다른 사용자가 편집 중인 메모는 저장할 수 없습니다. 취소로 닫으세요');
    return false;
  }
  const conflict=await SyncService.checkEditConflict(n,edOpenSnap,opts.force);
  if(conflict){
    editConflict={id:n.id,latest:conflict};
    $('#edSaved').textContent=opts.manual?'충돌 감지 · 저장 보류':'충돌 감지 · 자동저장 일시정지';
    if(opts.manual){
      const yes=await MBDialog.confirm('공유폴더/다른 탭의 최신 수정과 충돌합니다. 현재 에디터 내용을 강제로 저장할까요?',{title:'저장 충돌',okText:'강제저장',cancelText:'취소',danger:false,icon:'⚠️'});
      return yes?saveEditor(Object.assign({},opts,{force:true})):false;
    }
    const now=Date.now();
    if(now-editConflictToastAt>30000){
      editConflictToastAt=now;
      toast('외부 수정과 충돌하여 자동저장을 멈췄습니다. 저장 버튼에서 처리하세요');
    }
    return false;
  }
  maybeAutoHistorySnapshot(n);
  const ok=await touch(n,true);
  if(ok){edOpenSnap={title:n.title,body:n.body,updatedAt:n.updatedAt||Date.now(),hash:comparableNote(n)};editConflict=null;$('#edSaved').textContent='저장됨 · 방금';}
  else $('#edSaved').textContent='저장 실패';
  return ok;}
async function closeEditor(opts){
  opts=opts||{};
  clearTimeout(edSaveTimer);
  const n=curNote();
  if(n){
    let ok=true;
    if(!opts.skipSave){
      ok=await saveEditor({manual:true});
      if(!ok){toast('저장되지 않아 에디터를 닫지 않았습니다. 저장하지 않으려면 취소를 누르세요');return;}
    }
    if(edHistSnap&&pushHistorySnapshot(n,edHistSnap))await StorageService.putNote(n);
    if(ok&&!n.title.trim()&&!n.body.trim()&&!n.date&&!n.dueDate){
      notes=notes.filter(x=>x.id!==n.id);await removeStoredNote(n.id,{skipRender:true});}
  }
  if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive())await SharedBoard.releaseLock(editing);
  editing=null;edOpenSnap=null;edHistSnap=null;editConflict=null;
  $('#edWrap').classList.remove('open');render();}
async function cancelEditor(){
  clearTimeout(edSaveTimer);
  const n=curNote();
  if(n&&isEditorDirty()){
    const ok=await MBDialog.confirm('저장하지 않고 에디터를 닫을까요?\n현재 입력 중인 내용은 버립니다.',{title:'편집 취소',okText:'닫기',cancelText:'계속 편집',danger:false,icon:'↩'});
    if(!ok)return false;
  }
  if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive())await SharedBoard.releaseLock(editing);
  // 입력 폼만 버린다. notes 배열은 열기 전 메모 객체를 유지하므로 공유 자동동기화와 충돌하지 않는다.
  editing=null;edOpenSnap=null;edHistSnap=null;editConflict=null;
  $('#edWrap').classList.remove('open');
  render();
  return true;
}
function sharedEditingActive(){return !!(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive());}
function markEditorDirty(){
  const n=curNote();
  if(!n)return;
  $('#edSaved').textContent=sharedEditingActive()?'편집 중 · 저장 전':'편집 중';
}
function edInput(){clearTimeout(edSaveTimer);
  if(sharedEditingActive()){
    markEditorDirty();
    // 공유 작업함은 입력 중 자동저장을 하지 않는다. 저장/완료를 눌렀을 때만 공유폴더에 쓴다.
    edSaveTimer=setTimeout(()=>{
      if($('#edBox').classList.contains('m-split'))renderEdPrev();
      updCount();
    },250);
    return;
  }
  edSaveTimer=setTimeout(()=>{saveEditor();
    if($('#edBox').classList.contains('m-split'))renderEdPrev();
    updCount();},500);}

async function saveEditorManual(closeAfter){
  clearTimeout(edSaveTimer);
  const ok=await saveEditor({manual:true});
  if(!ok){toast('저장하지 못했습니다');return false;}
  renderEdPrev();updCount();
  if(closeAfter){toast('저장하고 닫았습니다');await closeEditor({skipSave:true});}
  else toast('저장했습니다');
  return true;
}
function focusEditorBodyAtEnd(){
  setEdMode('edit');
  const t=$('#edText');
  t.focus();
  const len=t.value.length;
  try{t.selectionStart=t.selectionEnd=len;}catch(e){}
}

/* editor events */
$('#edTitle').addEventListener('input',edInput);
$('#edText').addEventListener('input',edInput);
function edMetaChange(){
  if(sharedEditingActive()){markEditorDirty();renderEdPrev();updCount();return;}
  saveEditor();
}
['edDone','edPriority','edKind','edDate','edDue','edRemind','edFolder','edTags','edSharedStatus','edSharedAssignee'].forEach(id=>$('#'+id).addEventListener('change',edMetaChange));
$('#edText').addEventListener('keydown',e=>{
  if(window.MBMarkdown&&window.MBMarkdown.shortcuts&&window.MBMarkdown.shortcuts.handle(e))return;
  if(e.key==='Tab'){e.preventDefault();
    const t=e.target,s=t.selectionStart;
    t.value=t.value.slice(0,s)+'  '+t.value.slice(t.selectionEnd);
    t.selectionStart=t.selectionEnd=s+2;edInput();}});
$('#edColors').addEventListener('click',e=>{
  const d=e.target.closest('.cdot');if(!d)return;
  const n=curNote();n.color=+d.dataset.c;touch(n,true);
  $('#edColors').querySelectorAll('.cdot').forEach(x=>x.classList.toggle('on',x===d));
  $('#edBox').style.borderTopColor='var(--c'+n.color+'s)';});
$('#edPin').onclick=()=>{const n=curNote();n.pinned=!n.pinned;touch(n,true);
  $('#edPin').style.color=n.pinned?'var(--accent-ink)':'';toast(n.pinned?'고정했습니다':'고정 해제');};
$('#edLock').onclick=()=>{const n=curNote();n.locked=!n.locked;touch(n,true);$('#edLock').classList.toggle('on',!!n.locked);$('#edLock').textContent=n.locked?'🔒':'🔓';toast(n.locked?'메모를 잠갔습니다':'메모 잠금을 해제했습니다');};
$('#edArchive').onclick=()=>{const n=curNote();n.archived=!n.archived;touch(n,true);$('#edArchive').classList.toggle('on',!!n.archived);toast(n.archived?'보관함으로 이동했습니다':'보관을 해제했습니다');};
$('#edDel').onclick=()=>{const n=curNote();if(n.locked){toast('잠금 메모입니다. 먼저 잠금을 해제하세요');return;}n.deletedAt=Date.now();touch(n,true).then(()=>{editing=null;$('#edWrap').classList.remove('open');render();});
  toast('휴지통으로 이동했습니다',()=>{n.deletedAt=null;touch(n);});};
$('#edWide').onclick=()=>{const wide=window.MBStore&&StoreService.toggleEditorWide?StoreService.toggleEditorWide():!(meta.editorWide);if(!(window.MBStore&&StoreService.toggleEditorWide))meta.editorWide=wide;metaSave({silent:true});$('#edBox').classList.toggle('wide',!!wide);$('#edWide').classList.toggle('on',!!wide);toast(wide?'장문 편집 영역을 넓혔습니다':'기본 편집 크기로 돌아왔습니다');};
$('#edCancelBtn').onclick=()=>cancelEditor();
$('#edSaveBtn').onclick=()=>saveEditorManual(false);
$('#edDoneBtn').onclick=()=>saveEditorManual(true);
$('#edClose').onclick=()=>cancelEditor();
$('#edPrev').addEventListener('click',e=>{
  if(e.target.closest('a,input,button,select,textarea,label'))return;
  if(!$('#edBox').classList.contains('m-split'))focusEditorBodyAtEnd();
});
$('#edWrap').addEventListener('mousedown',e=>{if(e.target===$('#edWrap'))saveEditorManual(true);});
$('#edModes').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  setEdMode(b.dataset.m);
  if(b.dataset.m==='edit')$('#edText').focus();});
$('#edTpl').addEventListener('change',()=>{
  const k=$('#edTpl').value;if(!k)return;
  const tpl=templateMap()[k];if(!tpl)return;
  const t=$('#edText');
  t.value=t.value+(t.value&&!t.value.endsWith('\n')?'\n':'')+(tpl.body||'');
  $('#edTpl').value='';saveEditor();renderEdPrev();updCount();t.focus();});
$('#edBacklinks').addEventListener('click',e=>{
  const a=e.target.closest('a[data-id]');if(a){saveEditor().then(()=>openEditor(a.dataset.id));}});
$('#edHist').onclick=()=>{
  const n=curNote();const arr=n.history||[];
  $('#histBody').innerHTML=arr.length?arr.map((h,i)=>
    '<div class="histitem"><div class="ht">'+new Date(h.t).toLocaleString('ko-KR')+' · '+esc(h.title||'(제목 없음)')+
    '<button data-i="'+i+'">이 버전으로 복원</button></div><div class="hp">'+esc(h.body.slice(0,200))+'</div></div>').join('')
    :'<div class="empty"><b>저장된 버전이 없습니다</b>에디터를 닫거나 큰 폭으로 수정하면 이전 버전이 기록됩니다.</div>';
  $('#histWrap').classList.add('open');
  $('#histBody').querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>{
    const h=n.history[+b.dataset.i];
    n.history.unshift({t:Date.now(),title:n.title,body:n.body});n.history=n.history.slice(0,10);
    n.title=h.title;n.body=h.body;touch(n,true);
    $('#histWrap').classList.remove('open');openEditor(n.id);toast('복원했습니다');});};
$('#edMore').onclick=e=>{e.stopPropagation();$('#edMoreMenu').classList.toggle('open');};
$('#edMoreMenu').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  const n=curNote();await saveEditor();
  const name=(dispTitle(n)||'메모').replace(/[\\/:*?"<>|]/g,'_');
  if(b.dataset.act==='md')download(name+'.md','# '+dispTitle(n)+'\n\n'+n.body,'text/markdown;charset=utf-8');
  if(b.dataset.act==='copymd')navigator.clipboard.writeText('# '+dispTitle(n)+'\n\n'+n.body).then(()=>toast('마크다운을 복사했습니다'));
  if(b.dataset.act==='copyhtml')navigator.clipboard.writeText('<h1>'+esc(dispTitle(n))+'</h1>'+md2html(n.body)).then(()=>toast('HTML을 복사했습니다'));
  $('#edMoreMenu').classList.remove('open');});
const EditorService={open:openEditor,save:saveEditor,close:closeEditor,cancel:cancelEditor};
window.MBEditor=EditorService;

function setNoteSize(n,size,skipRender){
  if(!n||!SIZE_LABEL[size])return;
  normalizeNote(n);n.size=size;touch(n,!!skipRender);
}
async function bulkSetSize(size){
  if(!SIZE_LABEL[size])return;
  const changed=liveNotes().map(n=>{normalizeNote(n);n.size=size;noteCache.delete(n.id);return n;});
  if(window.MBStore&&StoreService.setDefaultSize)StoreService.setDefaultSize(size); else meta.defaultSize=size;
  const ok=await persistNotes(changed,{skipRender:true});
  await metaSave({silent:true});
  if(ok){render();toast('전체 메모를 '+SIZE_LABEL[size]+' 보기로 바꿨습니다');}
}
function addMemoZone(){
  ensureZones();
  if(zoneCount()>=MAX_ZONES){toast('구역은 최대 '+MAX_ZONES+'개까지 가능합니다');return;}
  if(window.MBStore&&StoreService.addZone)StoreService.addZone();
  else {meta.memoZones.push('구역 '+(meta.memoZones.length+1));meta.collapsedZones.push(false);}
  metaSave();render();toast('구역을 추가했습니다');
}
async function deleteMemoZone(idx){
  ensureZones();idx=Number(idx);
  const names=zoneNames();
  if(!Number.isInteger(idx)||idx<0||idx>=names.length)return;
  if(names.length<=MIN_ZONES){toast('최소 1개 구역은 필요합니다');return;}
  const name=names[idx]||('구역 '+(idx+1));
  const count=notes.filter(n=>!n.deletedAt&&clampZone(n.zone)===idx).length;
  const destIdx=idx>0?idx-1:0;
  const destName=names[destIdx]||'인접 구역';
  const msg='"'+name+'" 구역을 삭제할까요?'+(count?'\n메모 '+count+'개는 "'+destName+'" 구역으로 이동합니다.':'');
  if(!await MBDialog.confirm(msg,{title:'구역 삭제',okText:'삭제',danger:true,icon:'🗑'}))return;
  const changed=[];
  notes.forEach(n=>{
    if(n.deletedAt)return;
    const old=clampZone(n.zone);let nz=old;
    if(old===idx)nz=destIdx;
    else if(old>idx)nz=old-1;
    if(nz!==old){n.zone=nz;noteCache.delete(n.id);changed.push(n);}
  });
  if(window.MBStore&&StoreService.removeZone)StoreService.removeZone(idx);
  else {meta.memoZones.splice(idx,1);meta.collapsedZones.splice(idx,1);}
  if(filter.zone!==null){
    if(filter.zone===idx)filter.zone=null;
    else if(filter.zone>idx)filter.zone--;
  }
  await persistNotes(changed,{skipRender:true});await metaSave({silent:true});render();toast('구역을 삭제했습니다');
}
