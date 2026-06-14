'use strict';
/* ================= filtering & rendering ================= */
function liveNotes(){return notes.filter(n=>!n.deletedAt);}
function addDaysYmd(base,days){const d=new Date(base+'T00:00:00');d.setDate(d.getDate()+days);return ymd(d);}
function diffDaysYmd(a,b){return Math.round((new Date(a+'T00:00:00')-new Date(b+'T00:00:00'))/864e5);}
function ddayInfo(n){
  const due=deadlineDate(n);
  if(!n||!due||n.done)return {label:'',cls:''};
  const d=diffDaysYmd(due,todayYmd());
  if(d<0)return {label:'D+'+Math.abs(d),cls:'due-overdue'};
  if(d===0)return {label:'D-day',cls:'due-today'};
  if(d<=3)return {label:'D-'+d,cls:'due-soon'};
  if(d<=7)return {label:'D-'+d,cls:'due-week'};
  return {label:'D-'+d,cls:'due-future'};
}
function duePriority(n){const info=ddayInfo(n);return info.cls==='due-overdue'?3:info.cls==='due-today'?2:info.cls==='due-soon'?1:0;}
function weekStart(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-x.getDay());return x;}
function fmtMd(d){return (d.getMonth()+1)+'/'+d.getDate();}
function memoOrderValue(n){
  const v=Number(n&&n.morder);
  return Number.isFinite(v)?v:(Number(n&&n.createdAt)||Number(n&&n.updatedAt)||0);
}
function compareMemoOrder(a,b){
  return (memoOrderValue(a)-memoOrderValue(b))||((b.pinned?1:0)-(a.pinned?1:0))||((Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
}
function visible(){
  const idx=getIndex();
  let arr=idx.live.slice();
  const ty=todayYmd(), wk=addDaysYmd(ty,7);
  if(filter.smart==='archive')arr=arr.filter(n=>n.archived);
  else arr=arr.filter(n=>!n.archived);
  if(filter.zone!==null)arr=arr.filter(n=>n.zone===filter.zone);
  if(filter.kind)arr=arr.filter(n=>n.kind===filter.kind);
  if(filter.due==='overdue')arr=arr.filter(n=>{const d=idx.derived.get(n.id).dueDate;return d&&!n.done&&d<ty;});
  if(filter.due==='today')arr=arr.filter(n=>{const d=idx.derived.get(n.id).dueDate;return d===ty&&!n.done;});
  if(filter.due==='week')arr=arr.filter(n=>{const d=idx.derived.get(n.id).dueDate;return d&&!n.done&&d>=ty&&d<=wk;});
  if(filter.due==='done')arr=arr.filter(n=>n.done);
  if(filter.due==='nodate')arr=arr.filter(n=>{const d=idx.derived.get(n.id);return !d.dueDate&&d.isTask&&!n.done;});
  if(filter.smart==='today')arr=arr.filter(n=>n.date===ty||idx.derived.get(n.id).dueDate===ty);
  if(filter.smart==='pinned')arr=arr.filter(n=>n.pinned);
  if(filter.smart==='unfiled')arr=arr.filter(n=>{const d=idx.derived.get(n.id);return !n.folder&&!d.tags.length&&!d.dueDate&&!n.date;});
  if(filter.smart==='checklist')arr=arr.filter(n=>idx.derived.get(n.id).hasTasks);
  if(filter.smart==='code')arr=arr.filter(n=>idx.derived.get(n.id).hasCode);
  if(filter.smart==='long')arr=arr.filter(n=>idx.derived.get(n.id).isLong);
  if(filter.smart==='locked')arr=arr.filter(n=>n.locked);
  if(filter.folder)arr=arr.filter(n=>(n.folder||'')===filter.folder);
  if(filter.tag)arr=arr.filter(n=>idx.derived.get(n.id).tags.includes(filter.tag));
  if(filter.color!==null)arr=arr.filter(n=>n.color===filter.color);
  if(filter.q)arr=arr.filter(n=>matchNote(n,filter.q));
  return arr.sort((a,b)=>(clampZone(a.zone)-clampZone(b.zone))||compareMemoOrder(a,b));}

function render(){currentIndex=getIndex();updateStorageInfo();renderSidebar();updateWorkspaceSwitch();
  const m=$('#main');
  if(window.SharedBoard&&SharedBoard.isActive&&SharedBoard.isActive()&&!SharedBoard.state.configured&&(window.MBStore&&StoreService.view?StoreService.view():meta.view)!=='settings'){m.innerHTML=SharedBoard.setupHtml();updateViewTabs();return;}
  if(filter.smart==='trash'){renderTrash(m);updateViewTabs();return;}
  if(filter.smart==='today'&&(window.MBStore&&StoreService.view?StoreService.view():meta.view)!=='settings'){renderTodayPanel(m);updateViewTabs();return;}
  if((window.MBStore&&StoreService.view?StoreService.view():meta.view)==='settings')renderSettings(m);
  else if((window.MBStore&&StoreService.view?StoreService.view():meta.view)==='cal')renderCal(m);
  else renderMemo(m);
  updateViewTabs();}
function updateViewTabs(){ $$('#viewTabs button').forEach(b=>b.classList.toggle('on',b.dataset.view===(window.MBStore&&StoreService.view?StoreService.view():meta.view))); }

function navItemHtml(attrs,icon,label,count,on){
  const attr=Object.entries(attrs||{}).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('');
  return '<button class="navitem'+(on?' on':'')+'"'+attr+'><span class="nav-ico">'+icon+'</span><span class="nav-label">'+esc(label)+'</span>'+(count!==undefined&&count!==null?'<span class="cnt">'+esc(count)+'</span>':'')+'</button>';
}
function normalizeSidebarOrder(){
  if(window.MBStore&&StoreService.sidebarOrder)return StoreService.sidebarOrder();
  meta.sidebarOrder=normalizeSidebarOrderList(meta.sidebarOrder);
  return meta.sidebarOrder;
}
function applySidebarOrder(){
  const order=normalizeSidebarOrder();
  const side=$('#side');if(!side)return;
  order.forEach(key=>{
    const sec=side.querySelector('.sec[data-sec="'+key+'"]');
    if(sec){
      side.appendChild(sec);
      sec.dataset.order=String(order.indexOf(key));
      sec.draggable=false;
      const head=sec.querySelector('[data-sec-toggle]');if(head)head.draggable=false;
      const handle=sec.querySelector('.sec-drag');if(handle){handle.draggable=false;handle.removeAttribute('draggable');handle.setAttribute('title','카테고리 순서 변경');}
    }
  });
}
function applySidebarCollapsed(){
  ensureZones();
  const collapsed=window.MBStore&&StoreService.normalize?StoreService.normalize().uiState.sidebarCollapsed:(meta.sidebarCollapsed||{});
  applySidebarOrder();
  $$('#side .sec[data-sec]').forEach(sec=>sec.classList.toggle('collapsed',!!collapsed[sec.dataset.sec]));
}

function renderSidebar(){
  ensureZones();
  const idx=getIndex(), live=idx.live;
  $('#workList').innerHTML=[
    ['all','📚','전체',idx.smartCounts.all],
    ['new','＋','새 메모','Alt+N'],
    ['quick','⚡','빠른 입력','Ctrl+Shift+M'],
    ['calendar','📅','월간 달력','Ctrl+2'],
    ['weekcal','🗓','주간 달력','']
  ].map(([a,ic,nm,k])=>navItemHtml({'data-action':a},ic,nm,k,false)).join('');
  if(filter.zone!==null&&(filter.zone<0||filter.zone>=zoneCount()))filter.zone=null;
  const znames=zoneNames();
  $('#zoneList').innerHTML=znames.map((z,i)=>
    navItemHtml({'data-zone-filter':i},String(i+1),z||('구역 '+(i+1)),idx.zoneCounts[i]||0,filter.zone===i)
  ).join('')+navItemHtml({'data-zone-filter':'all'},'∑','전체 구역',live.length,filter.zone===null)+
  (znames.length<MAX_ZONES?navItemHtml({'data-zone-add':'1'},'＋','구역 추가',znames.length+'/'+MAX_ZONES,false):'');
  const dues=[
    ['overdue','🔴','기한초과',idx.dueCounts.overdue],
    ['today','🟡','오늘 마감',idx.dueCounts.today],
    ['week','🟢','7일 이내',idx.dueCounts.week],
    ['nodate','⚪','기한 없는 업무',idx.dueCounts.nodate],
    ['done','✅','완료됨',idx.dueCounts.done]
  ];
  $('#dueList').innerHTML=dues.map(([k,ic,nm,c])=>
    navItemHtml({'data-due':k},ic,nm,c,filter.due===k)
  ).join('')+(filter.due?navItemHtml({'data-due':'clear'},'⌫','기한 필터 해제',null,false):'');
  const kindRows=Object.keys(CAL_KINDS).map(k=>[k,CAL_KINDS[k][0],CAL_KINDS[k][1],idx.kindCounts[k]||0]);
  $('#kindList').innerHTML=kindRows.map(([k,ic,nm,c])=>
    navItemHtml({'data-kind-filter':k},ic,nm,c,filter.kind===k)
  ).join('')+(filter.kind?navItemHtml({'data-kind-filter':'clear'},'⌫','유형 필터 해제',null,false):'');
  const smarts=[
    ['all','📋','전체 메모',idx.smartCounts.all],
    ['today','☀️','오늘 패널',idx.smartCounts.today],
    ['pinned','📌','고정됨',idx.smartCounts.pinned],
    ['unfiled','🧹','미정리',idx.smartCounts.unfiled],
    ['checklist','☑','체크리스트',idx.smartCounts.checklist],
    ['code','💻','코드/SQL',idx.smartCounts.code],
    ['long','📄','긴 문서',idx.smartCounts.long],
    ['archive','📦','보관함',idx.smartCounts.archive],
    ['locked','🔐','잠금 메모',idx.smartCounts.locked],
    ['trash','🗑','휴지통',idx.smartCounts.trash]
  ];
  $('#smartList').innerHTML=smarts.map(([k,ic,nm,c])=>
    navItemHtml({'data-smart':k},ic,nm,c,filter.smart===k&&!filter.folder)).join('');
  const fkeys=Object.keys(idx.folders).sort();
  $('#folderSec').style.display=fkeys.length?'':'none';
  $('#folderList').innerHTML=fkeys.map(f=>
    navItemHtml({'data-folder':f},'📁',f,idx.folders[f],filter.folder===f)).join('');
  const tkeys=Object.keys(idx.tags).sort((a,b)=>idx.tags[b]-idx.tags[a]).slice(0,30);
  $('#tagList').innerHTML=tkeys.length?tkeys.map(t=>
    '<span class="tagchip'+(filter.tag===t?' on':'')+'" data-tag="'+esc(t)+'">#'+esc(t)+' '+idx.tags[t]+'</span>').join('')
    :'<span style="font-size:12px;color:var(--sub)">본문에 #태그를 쓰면 자동 수집됩니다</span>';
  $('#colorFilter').innerHTML=COLORS.map(c=>
    '<div class="cdot'+(filter.color===c?' on':'')+'" data-cf="'+c+'" title="'+COLOR_NAMES[c]+'" style="background:var(--c'+c+'s)"></div>').join('');
  applySidebarCollapsed();}

function badgeHtml(n){
  const d=deriveNote(n), due=d.dueDate;
  let h='';
  if(n._shared)h+='<span class="badge shared-source">공유 '+(window.SharedBoard?SharedBoard.statusLabel(n._sharedStatus):'')+'</span>';
  if(n._shared&&n.createdBy)h+='<span class="badge shared-author">작성 '+esc(n.createdBy)+'</span>';
  if(n._sharedLockOwner)h+='<span class="badge shared-lock">🔒 '+esc(n._sharedLockOwner)+'</span>';
  if(n.assignee)h+='<span class="badge">담당 '+esc(n.assignee)+'</span>';
  if(n.date)h+='<span class="badge">'+kindIcon(n.kind)+' '+n.date.slice(5).replace('-','/')+'</span>';
  if(due){const di=ddayInfo(n);const overdue=!n.done&&due<todayYmd();
    h+='<span class="badge'+(overdue?' due':'')+'">⏳ '+due.slice(5).replace('-','/')+'</span>';
    if(di.label)h+='<span class="badge dday '+di.cls+'">'+di.label+'</span>';}
  if(n.done)h+='<span class="badge st-done">완료</span>';
  if(n.priority&&n.priority!=='normal')h+='<span class="badge priority pri-'+n.priority+'">'+PRIORITY_ICON[n.priority]+' '+PRIORITY_LABEL[n.priority]+'</span>';
  if(n.remind&&!n.reminded)h+='<span class="badge">⏰</span>';
  if(n.folder)h+='<span class="badge">📁 '+esc(n.folder)+'</span>';
  if(n.locked)h+='<span class="badge">🔒 잠금</span>';
  if(n.archived)h+='<span class="badge">📦 보관</span>';
  return h;}
function actsHtml(n){return '<div class="acts">'+
  '<button data-a="pin" class="'+(n.pinned?'pin-on':'')+'" title="고정">📌</button>'+ 
  '<button data-a="lock" class="'+(n.locked?'on':'')+'" title="잠금">'+(n.locked?'🔒':'🔓')+'</button>'+ 
  '<button data-a="archive" class="'+(n.archived?'on':'')+'" title="보관">📦</button>'+ 
  '<button data-a="size" title="표시 크기">↕</button>'+ 
  '<button data-a="color" title="색상">🎨</button>'+ 
  '<button data-a="del" title="휴지통">🗑</button></div>';}
function compactMetaHtml(n,d){
  d=d||deriveNote(n);
  const parts=[];
  if(n.priority&&n.priority!=='normal')parts.push('<span class="tm" title="중요도: '+PRIORITY_LABEL[n.priority]+'">'+PRIORITY_ICON[n.priority]+'</span>');
  parts.push('<span class="tm" title="유형: '+kindName(n.kind)+'">'+kindIcon(n.kind)+'</span>');
  if(d.due&&d.due.label)parts.push('<span class="tm '+d.due.cls+'" title="마감: '+(d.dueDate||'')+'">'+d.due.label+'</span>');
  if(d.tasks&&d.tasks.length){const done=d.tasks.filter(t=>t.done).length;parts.push('<span class="tm" title="체크리스트 진행률">☑ '+done+'/'+d.tasks.length+'</span>');}
  return parts.length?'<div class="titlemeta">'+parts.join('')+'</div>':'';
}

function highlightRenderedHtml(html,q){
  q=String(q||'').trim();
  if(!q||isChoQ(q))return html;
  let re;
  try{re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');}
  catch(err){return html;}
  const tpl=document.createElement('template');
  tpl.innerHTML=html;
  const skip=new Set(['SCRIPT','STYLE','CODE','PRE','INPUT','TEXTAREA','BUTTON']);
  const walk=node=>{
    if(node.nodeType===Node.TEXT_NODE){
      const v=node.nodeValue;
      if(!v||!re.test(v)){re.lastIndex=0;return;}
      re.lastIndex=0;
      const frag=document.createDocumentFragment();
      let last=0;
      v.replace(re,(m,_g,idx)=>{
        if(idx>last)frag.appendChild(document.createTextNode(v.slice(last,idx)));
        const mark=document.createElement('mark');
        mark.textContent=m;
        frag.appendChild(mark);
        last=idx+m.length;
        return m;
      });
      if(last<v.length)frag.appendChild(document.createTextNode(v.slice(last)));
      node.parentNode.replaceChild(frag,node);
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE||skip.has(node.tagName))return;
    [...node.childNodes].forEach(walk);
  };
  [...tpl.content.childNodes].forEach(walk);
  return tpl.innerHTML;
}
function clipCardMarkdown(src,size){
  const maxLines=size==='large'?18:(size==='normal'?8:3);
  const maxChars=size==='large'?900:(size==='normal'?420:160);
  const lines=String(src||'').split(/\r?\n/);
  const out=[];
  let shown=0,chars=0,inFence=false,clipped=false,taskIdx=0;
  for(const raw of lines){
    const isFence=/^```/.test(raw);
    if(isFence){
      if(!inFence&&shown>=maxLines){clipped=true;break;}
      out.push(raw);
      inFence=!inFence;
      continue;
    }
    if(inFence){
      if(chars<maxChars&&shown<maxLines){
        const remain=Math.max(0,maxChars-chars);
        const cut=raw.length>remain?raw.slice(0,remain)+'…':raw;
        out.push(cut);
        chars+=raw.length;
        shown++;
      }else clipped=true;
      continue;
    }
    if(!raw.trim()){
      if(out.length&&out[out.length-1]!==''&&shown<maxLines)out.push('');
      continue;
    }
    const plain=stripMd(raw).trim()||raw.trim();
    if(shown>=maxLines||chars>=maxChars){clipped=true;break;}
    const remain=Math.max(0,maxChars-chars);
    let line=raw;
    if(plain.length>remain){
      const rawLimit=Math.max(0,remain);
      line=raw.slice(0,rawLimit)+'…';
      clipped=true;
    }
    const tm=raw.match(/^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]/);
    if(tm)taskIdx++;
    out.push(line);
    chars+=plain.length;
    shown++;
  }
  if(inFence)out.push('```');
  return {markdown:out.join('\n').trim(),clipped};
}
function cardPreviewHtml(n,q,size){
  const clipped=clipCardMarkdown(n.body,size);
  if(!clipped.markdown)return '';
  let html=md2html(clipped.markdown);
  html=html.replace(/data-ti="(\d+)"/g,'data-task="$1"');
  html=html.replace(/<li class="task/g,'<li class="checkitem card-taskline task');
  html=highlightRenderedHtml(html,q);
  if(clipped.clipped)html+='<div class="card-more">…</div>';
  return html;
}
function noteCardMarkup(n,q,opts){
  opts=opts||{};q=q||'';
  const src=n;
  n=opts.sizeOverride?Object.assign({},n,{size:opts.sizeOverride}):n;
  normalizeNote(n);
  const d=deriveNote(src||n);
  const size=n.size||'normal';
  const bodyHtml=size!=='title'?cardPreviewHtml(src||n,q,size):'';
  const tags=visibleTags(src||n,3);
  const tagHtml=tags.shown.length?'<div class="tags">'+tags.shown.map(t=>'<span class="minitag" data-tag="'+esc(t)+'">#'+esc(t)+'</span>').join('')+(tags.more?'<span class="minitag">+'+tags.more+'</span>':'')+'</div>':'';
  const titleMeta=size==='title'?compactMetaHtml(src||n,d):'';
  return '<div class="card c'+n.color+' sz-'+size+(n._shared?' shared-note':'')+(n.pinned?' pinned':'')+(n.locked?' locked':'')+(n.archived?' archived':'')+'" data-id="'+n.id+'" tabindex="0" title="'+SIZE_LABEL[size]+' 카드 · 핸들을 잡고 구역 이동"><div class="titleline"><span class="draghandle" title="구역 이동/순서 변경">⠿</span><div class="t">'+hiText(dispTitle(n),q)+'</div>'+titleMeta+'</div>'+(bodyHtml?'<div class="b card-preview">'+bodyHtml+'</div>':'')+(size!=='title'?tagHtml:'')+'<div class="foot">'+badgeHtml(n)+'<span class="reltime">'+relTime(n.updatedAt)+'</span></div>'+actsHtml(n)+'</div>';
}


function updateCardDom(noteId){
  const n=notes.find(x=>x.id===noteId&&!x.deletedAt);
  const card=document.querySelector('.card[data-id="'+noteId+'"]');
  if(!n||!card){return false;}
  const html=noteCardMarkup(n,filter.q||'',filter.zone!==null?{sizeOverride:'large'}:{});
  const box=document.createElement('div');
  box.innerHTML=html;
  const next=box.firstElementChild;
  if(next){card.replaceWith(next);return true;}
  return false;
}

function quickComposerHtml(){return '<div class="quickcomposer compact" id="quickComposer"><span>＋</span><span class="qc-placeholder">빠르게 메모 입력...</span><span style="font-size:11px;color:var(--sub)">Keep식 빠른 입력</span></div>';}
function bindQuickComposer(root){
  const box=root.querySelector('#quickComposer');
  if(!box)return;

  function close(){
    box.className='quickcomposer compact';
    box.innerHTML='<span>＋</span><span class="qc-placeholder">빠르게 메모 입력...</span><span style="font-size:11px;color:var(--sub)">Keep식 빠른 입력</span>';
    bindQuickComposer(root);
  }

  function open(){
    box.className='quickcomposer open';
    box.innerHTML=[
      '<input id="qcTitle" placeholder="제목은 선택 입력" autocomplete="off">',
      '<textarea id="qcBody" placeholder="메모를 바로 적고 Ctrl+Enter로 저장"></textarea>',
      '<div class="qc-actions">',
      '<label>유형 <select id="qcKind">'+kindOptions('memo')+'</select></label>',
      '<label><input type="checkbox" id="qcPinned"> 고정</label>',
      '<label><input type="checkbox" id="qcTask"> 업무/마감</label>',
      '<div class="hspace"></div>',
      '<button class="qc-btn" id="qcCancel">닫기</button>',
      '<button class="qc-btn primary2" id="qcSave">저장</button>',
      '</div>'
    ].join('');

    const save=()=>{
      const title=box.querySelector('#qcTitle').value.trim();
      const bodyVal=box.querySelector('#qcBody').value.trim();
      if(!title&&!bodyVal){close();return;}
      if(typeof workspaceWritable==='function'&&!workspaceWritable())return;
      const kind=box.querySelector('#qcTask').checked?'task':box.querySelector('#qcKind').value;
      const targetZone=filter.zone!==null?clampZone(filter.zone):0;
      const n=newNote({
        title,
        body:bodyVal,
        kind,
        pinned:box.querySelector('#qcPinned').checked,
        zone:targetZone,
        morder:memoTopOrder(targetZone),
        size:(window.MBStore&&StoreService.defaultSize?StoreService.defaultSize():(meta.defaultSize||'title'))
      });
      if(kind==='task'&&!n.dueDate)n.dueDate=todayYmd();
      notes.push(n);
      persistNote(n,{skipRender:true}).then(()=>{
        toast('메모를 추가했습니다');
        render();
        openEditor(n.id,'edit');
      });
    };

    box.querySelector('#qcSave').onclick=save;
    box.querySelector('#qcCancel').onclick=close;
    box.querySelector('#qcBody').focus();
    box.querySelector('#qcBody').addEventListener('keydown',e=>{
      if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();save();}
      if(e.key==='Escape'){e.preventDefault();close();}
    });
    box.querySelector('#qcTitle').addEventListener('keydown',e=>{
      if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();save();}
    });
  }

  box.addEventListener('click',open,{once:true});
}

function renderMemo(m){
  ensureZones();
  const arr=visible(),q=filter.q;
  const wb=typeof workspaceBannerHtml==='function'?workspaceBannerHtml():'';
  const card=n=>noteCardMarkup(n,q);
  if(!arr.length){m.innerHTML='<div class="viewpad">'+wb+quickComposerHtml()+'<div class="empty"><b>'+(q||filter.tag||filter.color!==null?'조건에 맞는 메모가 없습니다':'아직 메모가 없습니다')+'</b>'+(q?'다른 검색어로 시도해 보세요.':'바로 위 입력창이나 Alt+N으로 시작하세요.')+'</div></div>';bindQuickComposer(m);return;}
  const zc=zoneCount();
  if(filter.zone!==null){
    const z=clampZone(filter.zone);
    const list=arr.slice().sort(compareMemoOrder);
    const names=zoneNames();
    const zoneName=names[z]||('구역 '+(z+1));
    const focusCard=n=>noteCardMarkup(n,q,{sizeOverride:'large'});
    let h='<div class="zone-focus">'+wb+quickComposerHtml()+'<div class="zone-focus-head"><button class="zoneadd" data-zone-filter="all">← 전체 구역</button><h2>'+esc(zoneName)+'</h2><span class="hint">'+list.length+'개 메모 · 2단 펼침 보기</span></div><div class="mzonelist zone-focus-list" data-zone="'+z+'">'+list.map(focusCard).join('')+'</div></div>';
    m.innerHTML=h;bindQuickComposer(m);return;
  }
  const by=Array.from({length:zc},()=>[]);arr.forEach(n=>{normalizeNote(n);by[clampZone(n.zone)].push(n);});
  by.forEach(list=>list.sort(compareMemoOrder));
  const names=zoneNames(), collapsedList=zoneCollapsedList();
  const minCol=zc<=5?260:240;
  let h='<div class="viewpad">'+wb+quickComposerHtml()+'<div class="zonebar"><button class="zoneadd" id="addZoneBtn">＋ 구역 추가</button><span class="hint">구역은 1~8개까지 가능 · 제목은 바로 수정</span></div><div class="memozones" style="grid-template-columns:repeat('+zc+',minmax('+minCol+'px,1fr));min-width:'+Math.max(0,zc*minCol)+'px">';
  for(let z=0;z<zc;z++){const collapsed=!!collapsedList[z];const canDelete=zc>MIN_ZONES;h+='<section class="mzone'+(collapsed?' collapsed':'')+'" data-zone="'+z+'"><div class="mzonehead"><button class="mzonefold" data-zone-fold="'+z+'" title="구역 접기/펼치기">'+(collapsed?'▶':'▼')+'</button><input data-zone-name="'+z+'" value="'+esc(names[z]||('구역 '+(z+1)))+'" title="구역 이름 수정"><span class="cnt">'+by[z].length+'</span>'+(canDelete?'<button class="zoneDel" data-zone-del="'+z+'" title="구역 삭제">×</button>':'')+'</div><div class="mzonelist" data-zone="'+z+'">'+by[z].map(card).join('')+'</div></section>';}
  h+='</div></div>';m.innerHTML=h;bindQuickComposer(m);
}

/* ================= v6 productivity panels ================= */
const WORK_MODES={
  default:{label:'기본',folder:null,kind:null,smart:'all',zone:null,q:''},
  work:{label:'업무',folder:null,kind:'task',smart:'all',zone:null,q:''},
  writing:{label:'집필',folder:'집필',kind:null,smart:'all',zone:null,q:''},
  project:{label:'프로젝트',folder:'프로젝트',kind:null,smart:'all',zone:null,q:''}
};
function setWorkMode(mode){
  if(!WORK_MODES[mode])mode='default';
  if(window.MBStore&&StoreService.setWorkMode)StoreService.setWorkMode(mode); else meta.workMode=mode;
  const cfg=WORK_MODES[mode];
  filter={q:cfg.q||'',tag:null,color:null,smart:cfg.smart||'all',folder:cfg.folder,due:null,zone:cfg.zone,kind:cfg.kind};
  const q=$('#q');if(q)q.value=filter.q;
  metaSave({silent:true});
  render();
  toast('작업 모드: '+cfg.label);
}
function smallNoteRow(n,opts){
  opts=opts||{};const d=deriveNote(n);const date=opts.due?d.dueDate:n.date;
  return '<div class="todayitem" data-id="'+n.id+'"><span>'+kindIcon(n.kind)+'</span><span class="tt">'+esc(dispTitle(n))+'</span>'+(date?'<span class="td">'+date.slice(5).replace('-','/')+'</span>':'')+'</div>';
}
function todayPanelBlock(title,items,empty,opts){
  const rows=items.slice(0,(opts&&opts.limit)||10).map(n=>smallNoteRow(n,opts)).join('');
  return '<section class="todaypanel"><h3>'+title+'</h3>'+(rows||'<div class="wempty">'+empty+'</div>')+'</section>';
}
function renderTodayPanel(m){
  const idx=getIndex();const live=idx.live.filter(n=>!n.archived);const ty=todayYmd(), wk=addDaysYmd(ty,7);
  const today=live.filter(n=>n.date===ty).sort((a,b)=>a.done-b.done||duePriority(b)-duePriority(a)||b.updatedAt-a.updatedAt);
  const dueToday=live.filter(n=>deriveNote(n).dueDate===ty&&!n.done).sort((a,b)=>duePriority(b)-duePriority(a));
  const soon=live.filter(n=>{const d=deriveNote(n).dueDate;return d&&!n.done&&d>ty&&d<=wk;}).sort((a,b)=>deriveNote(a).dueDate.localeCompare(deriveNote(b).dueDate));
  const pinned=live.filter(n=>n.pinned).sort((a,b)=>b.updatedAt-a.updatedAt);
  const modes=Object.entries(WORK_MODES).map(([k,v])=>'<button class="modebtn '+((window.MBStore&&StoreService.workMode?StoreService.workMode():meta.workMode)===k?'on':'')+'" data-mode="'+k+'">'+v.label+'</button>').join('');
  m.innerHTML='<div class="todaydash"><div class="grouplabel">☀️ 오늘 패널 · '+ty+'</div><div class="modebar">'+modes+'</div><div class="todaygrid">'+
    todayPanelBlock('오늘 일정',today,'오늘 날짜 메모 없음')+
    todayPanelBlock('오늘 마감',dueToday,'오늘 마감 없음',{due:true})+
    todayPanelBlock('7일 이내',soon,'임박 마감 없음',{due:true})+
    todayPanelBlock('고정 메모',pinned,'고정 메모 없음')+
    '</div></div>';
  m.querySelectorAll('.todayitem[data-id]').forEach(x=>x.onclick=()=>openEditor(x.dataset.id,'edit'));
  m.querySelectorAll('.modebtn[data-mode]').forEach(x=>x.onclick=()=>setWorkMode(x.dataset.mode));
}

function backupHealthMarkup(){
  const h=(window.MBBackup&&window.MBBackup.health)?window.MBBackup.health():{level:'warn',label:'백업 상태 확인 불가',detail:'백업 모듈을 초기화하지 못했습니다'};
  const cls=h.level==='bad'?'bad':(h.level==='warn'?'warn':'ok');
  return '<div class="backup-health '+cls+'"><b>'+esc(h.label)+'</b><span>'+esc(h.detail||'')+'</span></div>';
}

function markdownShortcutHelpMarkup(){
  const rows=[
    ['Ctrl+B','선택 영역을 굵게 표시합니다. 예: **텍스트**'],
    ['Ctrl+I','선택 영역을 기울임으로 표시합니다. 예: *텍스트*'],
    ['Ctrl+`','선택 영역을 인라인 코드로 감쌉니다. 예: `코드`'],
    ['Ctrl+Shift+X','선택 영역에 취소선을 적용합니다. 예: ~~텍스트~~'],
    ['Ctrl+Shift+H','현재 줄을 제목으로 전환합니다. 반복하면 단계가 바뀝니다.'],
    ['Ctrl+Shift+K','선택 줄을 체크리스트 항목으로 바꿉니다.'],
    ['Ctrl+Shift+8','선택 줄을 불릿 목록으로 바꿉니다.'],
    ['Ctrl+Shift+7','선택 줄을 번호 목록으로 바꿉니다.'],
    ['Ctrl+Shift+Q','선택 줄을 인용문으로 바꿉니다.'],
    ['Ctrl+Shift+C','SQL 코드블록을 삽입합니다.'],
    ['Ctrl+Shift+L','링크 문법을 삽입합니다.'],
    ['Ctrl+Shift+T','2열 기본 표를 삽입합니다.']
  ];
  return '<div class="md-help"><h4>에디터 전용 마크다운 단축키</h4><div class="shortcut-table">'+rows.map(r=>
    '<div class="shortcut-row"><kbd>'+esc(r[0])+'</kbd><span>'+esc(r[1])+'</span></div>'
  ).join('')+'</div></div>';
}
function markdownSyntaxHelpMarkup(){
  const rows=(window.MBMarkdown&&window.MBMarkdown.help)||[];
  return '<div class="md-help"><h4>지원 마크다운 문법</h4><div class="md-syntax-grid">'+rows.map(r=>
    '<div class="md-syntax"><b>'+esc(r.name)+'</b><code>'+esc(r.syntax)+'</code><span>'+esc(r.desc)+'</span></div>'
  ).join('')+'</div><p class="md-note">HTML 직접 입력, 스크립트 실행, 파일 첨부형 이미지 저장은 지원하지 않습니다. 이미지 문법은 참조 배지로 표시합니다.</p></div>';
}
function renderSettings(m){
  const desktop=!!(window.memoboardNative&&window.memoboardNative.available);
  const pct=Math.round((Number((window.MBStore&&StoreService.desktop?StoreService.desktop().windowOpacity:meta.windowOpacity))||1)*100);
  m.innerHTML='<div class="settings"><h2>설정 / 도움말</h2><div class="settings-grid">'+
    '<section class="setting-card"><h3>창</h3><div class="setting-actions">'+
      '<button data-settings-act="always-on-top" class="'+((window.MBStore&&StoreService.desktop?StoreService.desktop().alwaysOnTop:meta.alwaysOnTop)?'on':'')+'">📍 항상 최상단</button><button data-settings-act="mini-mode" class="'+((window.MBStore&&StoreService.desktop?StoreService.desktop().miniMode:meta.miniMode)?'on':'')+'">🪟 미니 모드</button><button data-settings-act="hide-to-tray">🗕 트레이 숨김</button><button data-settings-act="minimize-to-tray" class="'+((window.MBStore&&StoreService.desktop?StoreService.desktop().minimizeToTray:meta.minimizeToTray)?'on':'')+'">닫기→트레이</button></div>'+
      '<div class="setting-row"><span>투명도</span><input type="range" id="settingsOpacity" min="55" max="100" step="5" value="'+pct+'"><b id="settingsOpacityVal">'+pct+'%</b></div><p>'+(desktop?'데스크톱 창 기능 사용 중':'브라우저 모드에서는 창 기능 일부가 비활성화됩니다')+'</p></section>'+
    '<section class="setting-card"><h3>백업 / 복구</h3>'+backupHealthMarkup()+'<div class="setting-actions"><button data-settings-act="export">JSON 내보내기</button><button data-settings-act="import">JSON 가져오기</button><button data-settings-act="md-export-folder">Markdown 폴더 내보내기</button><button data-settings-act="md-import-folder">Markdown 폴더 가져오기</button><button data-settings-act="autobackup-setup">자동백업 폴더 지정</button><button data-settings-act="autobackup-run">자동백업 지금 실행</button><button data-settings-act="autobackup-snapshot">스냅샷 켜기/끄기</button><button data-settings-act="autobackup-off">자동백업 해제</button><button data-settings-act="restore-center">복구 센터</button></div></section>'+
    '<section class="setting-card"><h3>공유 작업함</h3><div class="setting-list"><div class="line"><b>현재 모드</b><span>'+(((window.MBStore&&StoreService.workspace?StoreService.workspace():meta.workspace)==='shared'?'공유':'개인'))+'</span></div><div class="line"><b>공유폴더</b><span>'+(window.SharedBoard&&SharedBoard.state.root?esc(SharedBoard.state.root):'미지정')+'</span></div></div><div class="setting-row"><span>표시 이름</span><input id="sharedDisplayName" value="'+escAttr(window.SharedBoard?SharedBoard.author():'익명')+'" placeholder="이름"><button class="softbtn" data-shared-name-save="1">저장</button></div><div class="setting-actions"><button data-workspace="personal">개인 작업함</button><button data-workspace="shared">공유 작업함</button><button data-shared-pick="1">공유폴더 선택/변경</button><button data-shared-refresh="1">공유 새로고침</button></div><p>실행파일은 각자 로컬에 두고, 같은 공유폴더만 바라보면 됩니다. 공유 모드에서는 기존 메모/달력 화면이 공유 데이터 기준으로 동작합니다.</p></section>'+
    '<section class="setting-card"><h3>메모 / 보기</h3><div class="setting-actions"><button data-settings-act="quick-note">빠른 메모</button><button data-settings-act="template-manager">템플릿 관리자</button><button data-settings-act="notif">알림 권한</button><button data-settings-act="trash">휴지통</button><button data-settings-act="bulk-size" data-size="large">전체 크게</button></div></section>'+
    '<section class="setting-card full"><h3>도움말 / 기능 설명</h3><div class="helpgrid">'+
      '<div class="helpitem"><b>메모</b><span>구역별 카드 보드입니다. 카드의 ⠿ 핸들을 잡고 구역과 순서를 바꿉니다.</span></div>'+ 
      '<div class="helpitem"><b>검색</b><span><code>tag:</code> <code>folder:</code> <code>kind:</code> <code>due:</code> <code>date:</code> <code>title:</code> <code>body:</code> <code>is:</code> 조합 검색을 지원합니다.</span></div>'+ 
      '<div class="helpitem"><b>주간 메모</b><span>주간 달력 하단에서 일반 메모를 생성합니다. 날짜 셀 일정과 별도이며, 해당 주차 패널에만 모입니다.</span></div>'+ 
      '<div class="helpitem"><b>장문 편집</b><span>에디터 상단의 넓게 버튼으로 긴 문서 편집 영역을 확장합니다.</span></div>'+ 
      '<div class="helpitem"><b>공유 작업함</b><span>상단 개인/공유 토글로 데이터 소스를 전환합니다. 같은 공유폴더를 지정하면 기존 메모/달력 화면이 공유 메모/공유 일정 화면으로 바뀝니다.</span></div>'+ 
    '</div><div class="setting-list">'+
      '<div class="line"><b>Alt + N</b><span>새 메모</span></div>'+ 
      '<div class="line"><b>Ctrl + K</b><span>명령 팔레트 / 메모 이동</span></div>'+ 
      '<div class="line"><b>Ctrl + 1 / 2 / 3</b><span>메모 / 달력 / 설정 탭 전환</span></div>'+ 
      '<div class="line"><b>공유 보드</b><span>상단 개인/공유 토글에서 공유를 선택해 폴더를 지정합니다. 공유폴더에는 <code>notes</code>, <code>locks</code>, <code>trash</code>, <code>manifest.json</code>이 생성됩니다.</span></div>'+ 
      '<div class="line"><b>Alt + 1 / 2 / 3 / 4</b><span>전체 카드 크기: 제목만 / 작게 / 보통 / 크게</span></div>'+ 
      '<div class="line"><b>검색 예시</b><span><code>tag:업무 due:week -is:done</code> <code>title:회의 body:SQL</code> <code>before:2026-07-01</code></span></div>'+ 
    '</div>'+markdownShortcutHelpMarkup()+markdownSyntaxHelpMarkup()+
    '<div class="setting-actions" style="margin-top:10px"><button data-settings-act="reset-sidebar-order">좌측 순서 초기화</button></div></section>'+ 
    '<section class="setting-card full copyright"><span>© GSP reserved</span><small>Local-first Memoboard desktop utility</small></section>'+
  '</div></div>';
  m.querySelectorAll('[data-settings-act]').forEach(b=>b.addEventListener('click',()=>executeAppAction(b.dataset.settingsAct,b)));
  const ro=m.querySelector('#settingsOpacity');
  if(ro)ro.addEventListener('input',()=>{const v=Number(ro.value);const out=$('#settingsOpacityVal');if(out)out.textContent=v+'%';DesktopWindowManager.setOpacity(v/100);});
}
