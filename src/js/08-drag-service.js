'use strict';
/* ================= DragService: note/sidebar/calendar drag policy ================= */
const DragService=(()=>{
  let state={type:null,id:null,from:null,active:false};

  function begin(type,id,from){
    state={type,id,from,active:true};
    return state;
  }

  function end(){
    state={type:null,id:null,from:null,active:false};
    return state;
  }

  function dataTransfer(e,type,id){
    if(!e||!e.dataTransfer)return;
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',id||'');
    e.dataTransfer.setData('application/x-memoboard-drag',JSON.stringify({type,id}));
  }

  async function dropNoteToZone(noteId,container){
    if(!noteId||!container)return false;
    const inDom=container.querySelector('.card[data-id="'+noteId+'"]');
    if(inDom){
      await reindexMemoContainer(container);
      return true;
    }
    const n=notes.find(x=>x.id===noteId);
    if(!n)return false;
    const zone=container.dataset.zone!=null?clampZone(container.dataset.zone):0;
    n.zone=zone;
    n.morder=memoTopOrder(zone);
    await touch(n);
    return true;
  }

  async function dropNoteToDate(noteId,date,oldDate){
    const n=notes.find(x=>x.id===noteId);
    if(!n||!date)return false;
    n.date=date;
    if(n.dueDate&&(!oldDate||n.dueDate===oldDate||['task','deadline','report'].includes(n.kind)))n.dueDate=date;
    await touch(n);
    return true;
  }

  function reorderSidebar(key,targetKey,after){
    key=String(key||'');
    targetKey=String(targetKey||'');
    if(!key||!targetKey||key===targetKey)return false;
    if(!SIDEBAR_SECTION_DEFAULT.includes(key))return false;

    const base=window.MBStore&&StoreService.sidebarOrder?StoreService.sidebarOrder():meta.sidebarOrder;
    const order=normalizeSidebarOrderList(base).filter(k=>k!==key);
    const targetIdx=order.indexOf(targetKey);
    if(targetIdx<0)return false;

    order.splice(targetIdx+(after?1:0),0,key);
    if(window.MBStore&&StoreService.setSidebarOrder)StoreService.setSidebarOrder(order);
    else meta.sidebarOrder=normalizeSidebarOrderList(order);
    return true;
  }

  return {begin,end,dataTransfer,dropNoteToZone,dropNoteToDate,reorderSidebar};
})();
window.MBDrag=DragService;

let memoDragId=null,memoPointerId=null,memoDragMoved=false, viewDragSwitchTimer=null;
let memoPointerState=null;
const MEMO_DRAG_THRESHOLD=8;
function applySizeShortcut(size){bulkSetSize(size);}
function orderedZoneIdsWithDomSubset(zone,domIds){
  const visibleSet=new Set(domIds);
  const allZone=liveNotes().map(normalizeNote)
    .filter(n=>clampZone(n.zone)===zone||visibleSet.has(n.id))
    .sort(compareMemoOrder)
    .map(n=>n.id);
  const out=[];
  let vi=0;
  for(const id of allZone){
    if(visibleSet.has(id)){
      if(vi<domIds.length)out.push(domIds[vi++]);
    }else{
      out.push(id);
    }
  }
  while(vi<domIds.length)out.push(domIds[vi++]);
  return [...new Set(out)];
}
async function reindexMemoContainer(container){
  if(!container)return false;
  const domIds=[...container.querySelectorAll('.card[data-id]')].map(el=>el.dataset.id).filter(Boolean);
  const zone=container.dataset.zone!=null?clampZone(container.dataset.zone):0;
  const orderedIds=orderedZoneIdsWithDomSubset(zone,domIds);
  const changed=[];
  orderedIds.forEach((id,i)=>{
    const n=notes.find(x=>x.id===id);
    if(!n)return;
    normalizeNote(n);
    const nextOrder=(i+1)*1024;
    if(clampZone(n.zone)!==zone||n.morder!==nextOrder){
      n.zone=zone;
      n.morder=nextOrder;
      noteCache.delete(n.id);
      changed.push(n);
    }
  });
  if(changed.length)await persistNotes(changed,{skipRender:true,keepUpdatedAt:true});
  if(typeof invalidateIndex==='function')invalidateIndex();
  render();
  return changed.length>0;
}
let memoPlaceholder=null;
function ensureMemoPlaceholder(card){
  if(!memoPlaceholder){
    memoPlaceholder=document.createElement('div');
    memoPlaceholder.className='memo-placeholder';
  }
  const h=card?Math.max(58,Math.min(180,card.getBoundingClientRect().height||80)):72;
  memoPlaceholder.style.height=h+'px';
  return memoPlaceholder;
}
function clearMemoPlaceholder(){
  if(memoPlaceholder&&memoPlaceholder.parentNode)memoPlaceholder.parentNode.removeChild(memoPlaceholder);
}
function nearestMemoContainer(x,y){
  const containers=$$('#main .mzonelist');
  if(!containers.length)return null;
  let best=null,bestScore=Infinity;
  containers.forEach(c=>{
    const r=c.getBoundingClientRect();
    const dx=x<r.left?r.left-x:(x>r.right?x-r.right:0);
    const dy=y<r.top?r.top-y:(y>r.bottom?y-r.bottom:0);
    const score=dx*dx+dy*dy;
    if(score<bestScore){bestScore=score;best=c;}
  });
  return best;
}
function memoInsertBeforeAt(container,x,y){
  const cards=[...container.querySelectorAll('.card[data-id]:not(.dragging)')];
  if(!cards.length)return null;
  const isGrid=getComputedStyle(container).display.includes('grid');
  if(!isGrid){
    for(const c of cards){
      const r=c.getBoundingClientRect();
      if(y<r.top+r.height/2)return c;
    }
    return null;
  }
  for(const c of cards){
    const r=c.getBoundingClientRect();
    const cy=r.top+r.height/2;
    const cx=r.left+r.width/2;
    if(y<cy||(y>=r.top&&y<=r.bottom&&x<cx))return c;
  }
  return null;
}
function placeMemoPlaceholder(container,x,y){
  if(!container||!memoDragId)return;
  const card=$('#main .card[data-id="'+memoDragId+'"]');
  const ph=ensureMemoPlaceholder(card);
  const before=memoInsertBeforeAt(container,x,y);
  if(before)container.insertBefore(ph,before);
  else container.appendChild(ph);
}
function beginMemoPointerDrag(e){
  if(e.button!=null&&e.button!==0)return;
  const handle=e.target.closest&&e.target.closest('.draghandle');
  if(!handle)return;
  const card=handle.closest('.card[data-id]');
  if(!card)return;
  e.preventDefault();
  e.stopPropagation();
  memoPointerId=card.dataset.id;
  memoPointerState={
    id:card.dataset.id,
    startX:e.clientX,
    startY:e.clientY,
    pointerId:e.pointerId,
    active:false,
    handle,
    currentX:e.clientX,
    currentY:e.clientY
  };
  memoDragMoved=false;
  if(handle.setPointerCapture){try{handle.setPointerCapture(e.pointerId);}catch(err){}}
}
function activateMemoPointerDrag(){
  const st=memoPointerState;
  if(!st||st.active)return;
  st.active=true;
  memoDragMoved=true;
  memoDragId=st.id;
  const card=$('#main .card[data-id="'+memoDragId+'"]');
  if(card)card.classList.add('dragging');
  document.body.classList.add('memo-dragging');
  DragService.begin('note',memoDragId,{source:'handle'});
}
function updateMemoPointerDrag(e){
  const st=memoPointerState;
  if(!st)return;
  const dx=e.clientX-st.startX;
  const dy=e.clientY-st.startY;
  st.currentX=e.clientX;
  st.currentY=e.clientY;
  if(!st.active&&Math.sqrt(dx*dx+dy*dy)<MEMO_DRAG_THRESHOLD)return;
  e.preventDefault();
  activateMemoPointerDrag();
  const zoneBox=e.target.closest&&e.target.closest('.mzone');
  $$('#main .mzone.dragover').forEach(z=>{if(z!==zoneBox)z.classList.remove('dragover');});
  if(zoneBox)zoneBox.classList.add('dragover');
  const container=nearestMemoContainer(e.clientX,e.clientY);
  if(container)placeMemoPlaceholder(container,e.clientX,e.clientY);
}
async function endMemoPointerDrag(){
  const st=memoPointerState;
  if(!st)return;
  memoPointerState=null;
  const id=st.id;
  const moved=st.active;
  if(viewDragSwitchTimer){clearTimeout(viewDragSwitchTimer);viewDragSwitchTimer=null;}
  if(moved&&memoDragId){
    const ph=memoPlaceholder;
    let container=ph&&ph.parentNode&&ph.parentNode.classList.contains('mzonelist')?ph.parentNode:null;
    const card=$('#main .card[data-id="'+memoDragId+'"]');
    if(!container&&Number.isFinite(st.currentX)&&Number.isFinite(st.currentY))container=nearestMemoContainer(st.currentX,st.currentY);
    if(container&&card){
      if(ph&&ph.parentNode===container)container.insertBefore(card,ph);
      else container.appendChild(card);
      clearMemoPlaceholder();
      await DragService.dropNoteToZone(id,container);
    }else{
      clearMemoPlaceholder();
    }
    $$('#main .dragging,.drop-target,.mzone.dragover').forEach(x=>x.classList.remove('dragging','drop-target','dragover'));
    document.body.classList.remove('memo-dragging');
    DragService.end();
    memoDragId=null;
    setTimeout(()=>{memoDragMoved=false;},120);
    return;
  }
  document.body.classList.remove('memo-dragging');
  DragService.end();
  memoDragId=null;
  clearMemoPlaceholder();
  setTimeout(()=>{memoDragMoved=false;},40);
}
