'use strict';
/* ================= calendar ================= */

const CalendarQuickDraft=(function(){
  const drafts=new Map();
  function readKind(box){const sel=box&&box.querySelector?box.querySelector('.dkind'):null;return sel?sel.value:'task';}
  function set(date,text,kind){
    if(!date)return;
    text=String(text||'');kind=kind||'task';
    if(text.trim())drafts.set(date,{text,kind,at:Date.now()});
    else drafts.delete(date);
  }
  function capture(root){
    (root||document).querySelectorAll&& (root||document).querySelectorAll('.dquick').forEach(box=>{
      const inp=box.querySelector('.dadd');
      if(inp&&inp.value) set(box.dataset.d,inp.value,readKind(box));
    });
  }
  function restore(root){
    if(!root||!root.querySelectorAll)return;
    root.querySelectorAll('.dquick').forEach(box=>{
      const d=box.dataset.d, draft=drafts.get(d);
      if(!draft)return;
      const inp=box.querySelector('.dadd'), sel=box.querySelector('.dkind'), cell=box.closest('.dcell');
      if(sel)sel.value=draft.kind||'task';
      if(inp)inp.value=draft.text||'';
      if(cell)cell.classList.add('adding');
    });
  }
  function clear(date){if(date)drafts.delete(date);else drafts.clear();}
  function isActive(){
    const ae=document.activeElement;
    if(ae&&ae.closest&&ae.closest('.dquick'))return true;
    for(const inp of document.querySelectorAll('.dadd')){if((inp.value||'').trim())return true;}
    return drafts.size>0;
  }
  function bind(root){
    (root||document).querySelectorAll&& (root||document).querySelectorAll('.dquick').forEach(box=>{
      const inp=box.querySelector('.dadd'), sel=box.querySelector('.dkind');
      if(!inp)return;
      const update=()=>set(box.dataset.d,inp.value,sel?sel.value:'task');
      inp.addEventListener('input',update);
      inp.addEventListener('focus',update);
      if(sel)sel.addEventListener('change',update);
    });
  }
  return {capture,restore,bind,set,clear,isActive};
})();
window.MBCalendarDraft=CalendarQuickDraft;

function weekRange(){
  const start=weekStart(calCur), end=new Date(start);end.setDate(start.getDate()+6);
  return {start,end,startKey:ymd(start),endKey:ymd(end),label:fmtMd(start)+' - '+fmtMd(end)};
}
function inYmdRange(date,start,end){return !!date&&date>=start&&date<=end;}
function weekCalendarEntries(){
  const live=getIndex().live.filter(n=>!n.archived);
  const r=weekRange();
  return live.filter(n=>inYmdRange(n.date,r.startKey,r.endKey)).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||a.done-b.done||duePriority(b)-duePriority(a)||a.createdAt-b.createdAt);
}
function weekSchedulePanel(items){
  const grouped={};
  items.forEach(n=>{const k=n.date||'';(grouped[k]=grouped[k]||[]).push(n);});
  const keys=Object.keys(grouped).sort();
  let rows='';
  keys.forEach(k=>{
    rows+='<div class="weekdaygroup"><div class="weekdayhead">'+k.slice(5).replace('-','/')+'</div>'+grouped[k].map(n=>{
      const di=ddayInfo(n);
      return '<div class="witem" data-id="'+n.id+'"><span>'+kindIcon(n.kind)+'</span><span class="wt">'+esc(dispTitle(n))+'</span>'+(di.label?'<span class="wd '+di.cls+'">'+di.label+'</span>':'')+'</div>';
    }).join('')+'</div>';
  });
  return '<section class="weekpanel"><div class="weekpanel-head"><h3>달력 입력 메모</h3></div>'+(rows||'<div class="wempty">이번 주 달력에 입력된 메모가 없습니다</div>')+'</section>';
}
function weekMemoKey(){return weekRange().startKey;}
function weekNoteEntries(){
  const key=weekMemoKey();
  const live=getIndex().live.filter(n=>!n.archived&&!n.deletedAt);
  return live.filter(n=>n.weeklyKey===key).sort((a,b)=>(b.pinned-a.pinned)||(b.updatedAt-a.updatedAt));
}
function createWeeklyNote(){
  const r=weekRange();
  const n=newNote({title:'',body:'',kind:'memo',weeklyKey:r.startKey,folder:'주간 메모',tags:['weekly'],color:2,size:'normal'});
  notes.push(n);
  persistNote(n,{skipRender:true}).then(()=>{invalidateIndex();render();openEditor(n.id,'edit');});
}
function weekMemoPanel(){
  const r=weekRange(), items=weekNoteEntries();
  const rows=items.map(n=>noteCardMarkup(n,'',{week:true})).join('');
  return '<section class="weekpanel weeknotes"><div class="weekpanel-head"><h3>주간 메모</h3><button class="weekmini" id="addWeeklyNote">＋ 주간 메모</button></div>'+(rows||'<div class="wempty">이 주차에 연결된 일반 메모가 없습니다</div>')+'</section>';
}
function weekBottomHtml(){
  return '<div class="weekbottom weekbottom-clean">'+weekSchedulePanel(weekCalendarEntries())+weekMemoPanel()+'</div>';
}
function renderCal(m){
  if((window.MBStore&&StoreService.calMode?StoreService.calMode():meta.calMode)!=='week'){if(window.MBStore&&StoreService.setCalMode)StoreService.setCalMode('month');else meta.calMode='month';}
  const base=new Date(calCur);
  const monthMode=(window.MBStore&&StoreService.calMode?StoreService.calMode():meta.calMode)==='month';
  let cells=[], title='', rangeSub='';
  if(monthMode){
    const y=base.getFullYear(),mo=base.getMonth();
    const first=new Date(y,mo,1),startDow=first.getDay();
    const start=new Date(y,mo,1-startDow);
    for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(d);}
    title=y+'년 '+(mo+1)+'월';
  }else{
    const start=weekStart(base);
    for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(d);}
    const endd=new Date(start);endd.setDate(start.getDate()+6);
    title=start.getFullYear()+'년 '+fmtMd(start)+' - '+fmtMd(endd);
    rangeSub='주간';
  }
  const byDate={};getIndex().live.filter(n=>!n.archived).forEach(n=>{if(n.date)(byDate[n.date]=byDate[n.date]||[]).push(n);});
  let h=(typeof workspaceBannerHtml==='function'?workspaceBannerHtml():'')+'<div class="cal '+(monthMode?'month':'week')+'"><div class="calhead"><h2>'+title+'</h2>'+ 
    '<div class="nav"><button class="iconbtn" id="calPrev">◀</button><button class="iconbtn" id="calNext">▶</button></div>'+ 
    '<button class="todaybtn" id="calToday">오늘</button>'+ 
    '<div class="calmode"><button id="calMonth" class="'+(monthMode?'on':'')+'">월</button><button id="calWeek" class="'+(!monthMode?'on':'')+'">주</button></div>'+ 
    '<span style="font-size:11.5px;color:var(--sub);margin-left:auto">'+(rangeSub?rangeSub+' · ':'')+'D-day/마감임박 표시 · 날짜 클릭 → 유형 선택 → 입력</span></div>'+ 
    '<div class="dow"><div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div></div><div class="calgrid">';
  const tym=todayYmd();
  for(const d of cells){
    const k=ymd(d),hol=HOLIDAYS[k],dow=d.getDay();
    const ents=(byDate[k]||[]).sort((a,b)=>a.done-b.done||duePriority(b)-duePriority(a)||a.createdAt-b.createdAt);
    const cls=['dcell'];
    if(monthMode&&d.getMonth()!==base.getMonth())cls.push('out');
    if(k===tym)cls.push('today');
    if(dow===0)cls.push('sun');if(dow===6)cls.push('sat');if(hol)cls.push('hol');
    const maxPri=ents.reduce((mx,n)=>Math.max(mx,duePriority(n)),0);
    if(maxPri===3)cls.push('has-overdue');else if(maxPri===2)cls.push('has-today');else if(maxPri===1)cls.push('has-soon');
    h+='<div class="'+cls.join(' ')+'" data-d="'+k+'"><div class="dnum">'+(monthMode?d.getDate():fmtMd(d))+ 
       (hol?'<span class="hname">'+hol+'</span>':'')+'</div>';
    const MAX=monthMode?4:12;
    ents.slice(0,MAX).forEach(n=>{
      const di=ddayInfo(n);
      h+='<div class="dent '+di.cls+(n.done?' ddone':'')+'" draggable="true" style="border-left-color:var(--c'+n.color+'s)" data-id="'+n.id+'" data-date="'+k+'">'+
         '<span class="dicon" title="'+kindName(n.kind)+'">'+kindIcon(n.kind)+'</span><input type="checkbox"'+(n.done?' checked':'')+' data-id="'+n.id+'"><span class="dtitle">'+esc(dispTitle(n))+'</span>'+ 
         (di.label?'<b class="dstat '+di.cls+'">'+di.label+'</b>':'')+'</div>';});
    if(ents.length>MAX)h+='<div class="dmore">+'+(ents.length-MAX)+'개 더</div>';
    h+='<div class="dquick" data-d="'+k+'"><select class="dkind">'+kindOptions('task')+'</select><input class="dadd" placeholder="입력 후 Enter" data-d="'+k+'"></div></div>';}
  h+='</div>'+(!monthMode?weekBottomHtml():'')+'</div>';
  if(window.MBCalendarDraft)MBCalendarDraft.capture(m);
  m.innerHTML=h;
  if(window.MBCalendarDraft){MBCalendarDraft.restore(m);MBCalendarDraft.bind(m);}
  $('#calPrev').onclick=()=>{if(monthMode){calCur.setMonth(calCur.getMonth()-1);}else{calCur.setDate(calCur.getDate()-7);}render();};
  $('#calNext').onclick=()=>{if(monthMode){calCur.setMonth(calCur.getMonth()+1);}else{calCur.setDate(calCur.getDate()+7);}render();};
  $('#calToday').onclick=()=>{calCur=new Date();if((window.MBStore&&StoreService.calMode?StoreService.calMode():meta.calMode)==='month')calCur.setDate(1);render();};
  $('#calMonth').onclick=()=>{if(window.MBStore&&StoreService.setCalMode)StoreService.setCalMode('month');else meta.calMode='month';calCur.setDate(1);metaSave();render();};
  $('#calWeek').onclick=()=>{if(window.MBStore&&StoreService.setCalMode)StoreService.setCalMode('week');else meta.calMode='week';calCur=new Date();metaSave();render();};
  m.querySelectorAll('.dcell').forEach(cell=>{
    cell.addEventListener('click',e=>{
      if(e.target.closest('.dent')||e.target.closest('.dquick'))return;
      m.querySelectorAll('.dcell.adding').forEach(c=>c!==cell&&c.classList.remove('adding'));
      cell.classList.add('adding');cell.querySelector('.dadd').focus();});});
  let calDragId=null, calDragFrom=null;
  m.querySelectorAll('.dent[draggable="true"]').forEach(el=>{
    el.addEventListener('dragstart',e=>{calDragId=el.dataset.id;calDragFrom=el.dataset.date;memoDragId=calDragId;memoDragMoved=true;DragService.begin('calendar-note',calDragId,{date:calDragFrom});el.classList.add('cal-dragging');DragService.dataTransfer(e,'calendar-note',calDragId);});
    el.addEventListener('dragend',()=>{$$('#main .cal-dragging,.cal-dragover').forEach(x=>x.classList.remove('cal-dragging','cal-dragover'));calDragId=null;calDragFrom=null;memoDragId=null;});
  });
  m.querySelectorAll('.dcell').forEach(cell=>{
    cell.addEventListener('dragover',e=>{if(!(calDragId||memoDragId))return;e.preventDefault();cell.classList.add('cal-dragover');});
    cell.addEventListener('dragleave',()=>cell.classList.remove('cal-dragover'));
    cell.addEventListener('drop',e=>{const dropId=calDragId||memoDragId;if(!dropId)return;e.preventDefault();cell.classList.remove('cal-dragover');
      const n=notes.find(x=>x.id===dropId);if(!n)return;
      const newDate=cell.dataset.d, oldDate=calDragFrom||n.date;
      DragService.dropNoteToDate(dropId,newDate,oldDate);
      calDragId=null;calDragFrom=null;memoDragId=null;
      toast('날짜를 '+newDate.slice(5).replace('-','/')+'로 연결했습니다');
    });
  });
  m.querySelectorAll('.dadd').forEach(inp=>{
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&inp.value.trim()){
        e.preventDefault();
        const kind=inp.closest('.dquick').querySelector('.dkind').value;
        const due=['task','deadline','report'].includes(kind)?inp.dataset.d:null;
        const n=newNote({title:inp.value.trim(),date:inp.dataset.d,dueDate:due,kind});
        notes.push(n);
        const dateKey=inp.dataset.d;
        if(window.MBCalendarDraft)MBCalendarDraft.clear(dateKey);
        persistNote(n,{skipRender:true}).then(()=>{
          render();
          const c=$('#main').querySelector('.dcell[data-d="'+dateKey+'"]');
          if(c){c.classList.add('adding');const next=c.querySelector('.dadd');if(next)next.focus();}
          toast('달력 메모를 추가했습니다');
        });}
      if(e.key==='Escape'){if(window.MBCalendarDraft)MBCalendarDraft.clear(inp.dataset.d);inp.value='';inp.closest('.dcell').classList.remove('adding');e.stopPropagation();}});});
  m.querySelectorAll('.dent input[type=checkbox]').forEach(cb=>{
    cb.addEventListener('click',e=>e.stopPropagation());
    cb.addEventListener('change',()=>{
      const n=notes.find(x=>x.id===cb.dataset.id);if(!n)return;
      n.done=cb.checked;n.doneAt=cb.checked?Date.now():null;
      touch(n);});});
  m.querySelectorAll('.dent .dtitle').forEach(sp=>{
    sp.addEventListener('click',e=>{e.stopPropagation();openEditor(sp.closest('.dent').dataset.id,'edit');});});
  const addWeekly=$('#addWeeklyNote');
  if(addWeekly)addWeekly.addEventListener('click',createWeeklyNote);
  m.querySelectorAll('.weekbottom .witem[data-id]').forEach(w=>{
    w.addEventListener('click',()=>openEditor(w.dataset.id,'edit'));
  });}
