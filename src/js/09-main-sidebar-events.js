'use strict';
/* ================= main delegation (cards) ================= */
let cpopEl=null, sizepopEl=null;
function closeCpop(){if(cpopEl){cpopEl.remove();cpopEl=null;}}
function closeSizepop(){if(sizepopEl){sizepopEl.remove();sizepopEl=null;}}
$('#main').addEventListener('mouseenter',e=>{
  const item=e.target.closest&&e.target.closest('.card[data-id]');
  if(item)memoPointerId=item.dataset.id;
},true);
$('#main').addEventListener('focusin',e=>{
  const item=e.target.closest&&e.target.closest('.card[data-id]');
  if(item)memoPointerId=item.dataset.id;
});
$('#main').addEventListener('pointerdown',beginMemoPointerDrag);
document.addEventListener('pointermove',updateMemoPointerDrag);
document.addEventListener('pointerup',endMemoPointerDrag);
document.addEventListener('pointercancel',endMemoPointerDrag);
$('#main').addEventListener('dragstart',e=>{
  const item=e.target.closest&&e.target.closest('.card[data-id]');
  if(!item)return;
  e.preventDefault();
});
$('#main').addEventListener('click',e=>{
  if(e.target.closest&&e.target.closest('.draghandle')){e.preventDefault();e.stopPropagation();return;}
  const addZone=e.target.closest('[data-zone-add],#addZoneBtn');
  if(addZone){e.preventDefault();e.stopPropagation();addMemoZone();return;}
  const delZone=e.target.closest('[data-zone-del]');
  if(delZone){e.preventDefault();e.stopPropagation();deleteMemoZone(+delZone.dataset.zoneDel);return;}
  const moveZone=e.target.closest('[data-zone-move]');
  if(moveZone&&!moveZone.disabled){e.preventDefault();e.stopPropagation();moveMemoZone(+moveZone.dataset.zoneMove,+moveZone.dataset.zoneTo);return;}
  const fold=e.target.closest('[data-zone-fold]');
  if(fold){e.preventDefault();e.stopPropagation();ensureZones();const z=+fold.dataset.zoneFold;if(window.MBStore&&StoreService.toggleZoneCollapsed)StoreService.toggleZoneCollapsed(z);else meta.collapsedZones[z]=!meta.collapsedZones[z];if(typeof saveZonesAndPublishManifest==='function')saveZonesAndPublishManifest({silent:true});else metaSave();render();return;}
  const cb=e.target.closest('input[data-task]');
  if(cb){e.stopPropagation();
    const card=cb.closest('.card[data-id]');
    const id=card&&card.dataset.id;const n=notes.find(x=>x.id===id);if(!n)return;
    const taskNo=+cb.dataset.task;
    const ok=toggleTaskInBody(n,taskNo);if(!ok)return;
    const current=taskItems(n).find(t=>t.idx===taskNo);
    const checked=!!(current&&current.done);
    card.querySelectorAll('input[data-task="'+taskNo+'"]').forEach(x=>{x.checked=checked;const label=x.closest('.checkitem');if(label)label.classList.toggle('done',checked);});
    invalidateIndex();
    touch(n,true).then(()=>updateCardDom(n.id));
    return;}
  const act=e.target.closest('.acts button');
  if(act){e.stopPropagation();
    const id=act.closest('[data-id]').dataset.id;const n=notes.find(x=>x.id===id);if(!n)return;
    normalizeNote(n);
    if(act.dataset.a==='pin'){
      n.pinned=!n.pinned;
      if(n.pinned)n.morder=memoTopOrder(n.zone);
      touch(n);
    }
    if(act.dataset.a==='lock'){n.locked=!n.locked;touch(n);toast(n.locked?'메모를 잠갔습니다':'메모 잠금을 해제했습니다');return;}
    if(act.dataset.a==='archive'){n.archived=!n.archived;touch(n);toast(n.archived?'보관함으로 이동했습니다':'보관을 해제했습니다');return;}
    if(act.dataset.a==='size'){closeSizepop();closeCpop();
      sizepopEl=document.createElement('div');sizepopEl.className='sizepop';
      const keys={title:'',small:'',normal:'',large:''};
      sizepopEl.innerHTML=SIZE_ORDER.map(k=>'<button data-size="'+k+'" class="'+(n.size===k?'on':'')+'">'+(n.size===k?'✓':'')+' '+SIZE_LABEL[k]+' <span style="margin-left:auto;color:var(--sub);font-size:11px">'+keys[k]+'</span></button>').join('');
      document.body.appendChild(sizepopEl);
      const r=act.getBoundingClientRect();
      sizepopEl.style.left=Math.min(r.left,innerWidth-170)+'px';sizepopEl.style.top=(r.bottom+6)+'px';
      sizepopEl.addEventListener('click',ev=>{const b=ev.target.closest('button[data-size]');
        if(b){setNoteSize(n,b.dataset.size);}closeSizepop();ev.stopPropagation();});}
    if(act.dataset.a==='del'){
      if(n.locked){toast('잠금 메모입니다. 먼저 잠금을 해제하세요');return;}
      if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive()&&n._sharedLockOwner&&(!SharedBoard.hasEditLock||!SharedBoard.hasEditLock(n.id))){
        toast('다른 사용자가 편집 중이라 삭제할 수 없습니다: '+n._sharedLockOwner);
        return;
      }
      n.deletedAt=Date.now();touch(n);
      toast('휴지통으로 이동했습니다',()=>{n.deletedAt=null;touch(n);});}
    if(act.dataset.a==='color'){closeCpop();closeSizepop();
      cpopEl=document.createElement('div');cpopEl.className='cpop';
      cpopEl.innerHTML=COLORS.map(c=>'<div class="cdot" data-c="'+c+'" style="background:var(--c'+c+'s)" title="'+COLOR_NAMES[c]+'"></div>').join('');
      document.body.appendChild(cpopEl);
      const r=act.getBoundingClientRect();
      cpopEl.style.left=Math.min(r.left,innerWidth-230)+'px';cpopEl.style.top=(r.bottom+6)+'px';
      cpopEl.addEventListener('click',ev=>{const d=ev.target.closest('.cdot');
        if(d){n.color=+d.dataset.c;touch(n);}closeCpop();ev.stopPropagation();});}
    return;}
  const tag=e.target.closest('.minitag[data-tag]');
  if(tag){e.stopPropagation();filter.tag=tag.dataset.tag;render();return;}
  const item=e.target.closest('.card[data-id]');
  if(item){memoPointerId=item.dataset.id; if(!memoDragMoved)openEditor(item.dataset.id,'edit'); memoDragMoved=false;}
});
document.addEventListener('click',e=>{if(cpopEl&&!e.target.closest('.cpop'))closeCpop();
  if(sizepopEl&&!e.target.closest('.sizepop'))closeSizepop();
  if(!e.target.closest('#moreBtn')&&!e.target.closest('#moreMenu'))$('#moreMenu').classList.remove('open');
  if(!e.target.closest('#edMore'))$('#edMoreMenu').classList.remove('open');});
$('#main').addEventListener('input',e=>{
  const inp=e.target.closest('input[data-zone-name]');if(!inp)return;
  ensureZones();const zi=clampZone(inp.dataset.zoneName);const name=inp.value.trim()||('구역 '+(zi+1));if(window.MBStore&&StoreService.setZoneName)StoreService.setZoneName(zi,name);else meta.memoZones[zi]=name;if(typeof saveZonesAndPublishManifest==='function')saveZonesAndPublishManifest({silent:true});else metaSave();
});
$('#main').addEventListener('keydown',e=>{
  const inp=e.target.closest&&e.target.closest('input[data-zone-name]');
  if(inp&&e.key==='Enter'){e.preventDefault();inp.blur();}
});

/* ================= sidebar events ================= */

let sidebarDragMoved=false, sidebarSuppressClick=false;
let sidebarPointerState=null;
function clearSidebarDropMarks(){
  $$('#side .sec').forEach(x=>x.classList.remove('side-drop-before','side-drop-after','side-dragging'));
}
function sidebarDropTargetAt(y,key){
  const secs=$$('#side .sec[data-sec]').filter(sec=>sec.dataset.sec!==key&&sec.offsetParent!==null);
  if(!secs.length)return null;
  let fallback={sec:secs[secs.length-1],after:true};
  for(const sec of secs){
    const r=sec.getBoundingClientRect();
    if(y<r.top+r.height/2)return {sec,after:false};
    fallback={sec,after:true};
  }
  return fallback;
}
function markSidebarDrop(target){
  $$('#side .sec').forEach(x=>x.classList.remove('side-drop-before','side-drop-after'));
  if(target&&target.sec)target.sec.classList.add(target.after?'side-drop-after':'side-drop-before');
}
// 섹션 순서 변경은 HTML5 drag를 쓰지 않는다. Electron frameless 환경에서 native drag가 pointer 이벤트를 삼켜 순서 변경이 무시되는 문제가 있었음.
$('#side').addEventListener('dragstart',e=>{if(e.target.closest&&e.target.closest('.sec-drag'))e.preventDefault();});
$('#side').addEventListener('pointerdown',e=>{
  const title=e.target.closest&&e.target.closest('.sec-title');
  const sec=e.target.closest&&e.target.closest('.sec[data-sec]');
  if(!title||!sec)return;
  if(e.button!=null&&e.button!==0)return;
  e.stopPropagation();
  const handle=e.target.closest&&e.target.closest('.sec-drag');
  sidebarPointerState={key:sec.dataset.sec,startY:e.clientY,active:false,target:null,after:false,pointerId:e.pointerId,captureEl:handle||title};
  sidebarDragMoved=false;
  if(handle)e.preventDefault();
  if((handle||title).setPointerCapture){try{(handle||title).setPointerCapture(e.pointerId);}catch(err){}}
});
document.addEventListener('pointermove',e=>{
  const st=sidebarPointerState;if(!st)return;
  if(!st.active&&Math.abs(e.clientY-st.startY)<6)return;
  e.preventDefault();
  st.active=true;sidebarDragMoved=true;
  const draggingSec=$('#side .sec[data-sec="'+st.key+'"]');if(draggingSec)draggingSec.classList.add('side-dragging');
  const target=sidebarDropTargetAt(e.clientY,st.key);
  st.target=target&&target.sec?target.sec.dataset.sec:null;
  st.after=!!(target&&target.after);
  markSidebarDrop(target);
});
function finishSidebarPointerDrag(){
  const st=sidebarPointerState;if(!st)return;
  sidebarPointerState=null;
  clearSidebarDropMarks();
  if(st.active&&st.target){
    const ok=DragService.reorderSidebar(st.key,st.target,st.after);
    sidebarSuppressClick=true;
    if(ok){metaSave({silent:true}).then(()=>{renderSidebar();toast('좌측 카테고리 순서를 저장했습니다');});}
    setTimeout(()=>{sidebarSuppressClick=false;sidebarDragMoved=false;},250);
  }else{
    sidebarDragMoved=false;
  }
}
document.addEventListener('pointerup',finishSidebarPointerDrag);
document.addEventListener('pointercancel',finishSidebarPointerDrag);
$('#side').addEventListener('click',e=>{
  if(sidebarSuppressClick){e.preventDefault();e.stopPropagation();return;}
  if(sidebarDragMoved){sidebarDragMoved=false;return;}
  if(e.target.closest('.sec-drag'))return;
  const head=e.target.closest('[data-sec-toggle]');
  if(head){const sec=head.closest('.sec[data-sec]');if(sec){
    const key=sec.dataset.sec;if(window.MBStore&&StoreService.toggleSidebarCollapsed)StoreService.toggleSidebarCollapsed(key);
    else {if(!meta.sidebarCollapsed||typeof meta.sidebarCollapsed!=='object')meta.sidebarCollapsed={};meta.sidebarCollapsed[key]=!meta.sidebarCollapsed[key];}
    metaSave();applySidebarCollapsed();}
    return;}
  const a=e.target.closest('[data-action]');
  if(a){const act=a.dataset.action;
    if(act==='new')quickNew();
    if(act==='quick')QuickMemo.open();
    if(act==='all'){filter={q:'',tag:null,color:null,smart:'all',folder:null,due:null,zone:null,kind:null};const q=$('#q');if(q)q.value='';setView('memo');}
    if(act==='calendar'){if(window.MBStore&&StoreService.setCalMode)StoreService.setCalMode('month');else meta.calMode='month';setView('cal');}
    if(act==='weekcal'){if(window.MBStore&&StoreService.setCalMode)StoreService.setCalMode('week');else meta.calMode='week';calCur=new Date();setView('cal');}
    return;}
  const mode=e.target.closest('[data-mode-action]');
  if(mode){setWorkMode(mode.dataset.modeAction);return;}
  const za=e.target.closest('[data-zone-add]');
  if(za){addMemoZone();return;}
  const z=e.target.closest('[data-zone-filter]');
  if(z){filter.zone=z.dataset.zoneFilter==='all'?null:clampZone(z.dataset.zoneFilter);filter.smart='all';render();return;}
  const d=e.target.closest('[data-due]');
  if(d){filter.due=d.dataset.due==='clear'?null:d.dataset.due;filter.smart='all';render();return;}
  const k=e.target.closest('[data-kind-filter]');
  if(k){filter.kind=k.dataset.kindFilter==='clear'?null:k.dataset.kindFilter;filter.smart='all';render();return;}
  const s=e.target.closest('[data-smart]');
  if(s){filter.smart=s.dataset.smart;filter.folder=null;render();return;}
  const f=e.target.closest('[data-folder]');
  if(f){filter.folder=filter.folder===f.dataset.folder?null:f.dataset.folder;filter.smart='all';render();return;}
  const t=e.target.closest('[data-tag]');
  if(t){filter.tag=filter.tag===t.dataset.tag?null:t.dataset.tag;render();return;}
  const c=e.target.closest('[data-cf]');
  if(c){const v=+c.dataset.cf;filter.color=filter.color===v?null:v;render();return;}
  if(innerWidth<=900)$('#side').classList.remove('open');});
