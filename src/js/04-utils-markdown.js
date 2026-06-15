'use strict';
/* ================= utils ================= */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const DesktopWindowManager=(()=>{
  const native=()=>!!(window.memoboardNative&&window.memoboardNative.available&&typeof window.memoboardNative.minimizeWindow==='function');
  let applyTimer=null, opacityMetaTimer=null;
  let nativeOpacitySupported=false;
  function patchDesktop(patch){
    if(window.MBStore&&StoreService.setDesktopPatch)StoreService.setDesktopPatch(patch);
    else Object.assign(meta,patch||{});
  }

  function applyVisualOpacity(value, forceCss){
    const opacity=Math.max(.55,Math.min(1,Number(value)||1));
    const visual=(nativeOpacitySupported&&!forceCss)?1:opacity;
    document.documentElement.style.setProperty('--window-opacity', String(opacity));
    document.body.style.opacity=String(visual);
  }
  function scheduleSilentMetaSave(){clearTimeout(opacityMetaTimer);opacityMetaTimer=setTimeout(()=>metaSave({silent:true}),250);}
  function setState(state){
    const btn=$('#winMax');
    if(btn){
      const maximized=!!(state&&state.isMaximized);
      btn.textContent=maximized?'❐':'□';
      btn.title=maximized?'복원':'최대화';
      btn.setAttribute('aria-label',btn.title);
    }
    if(state&&typeof state.nativeOpacitySupported==='boolean')nativeOpacitySupported=state.nativeOpacitySupported;
    const patch={};
    if(state&&typeof state.opacity==='number')patch.windowOpacity=Math.max(.55,Math.min(1,Number(state.opacity)||1));
    if(state&&typeof state.isAlwaysOnTop==='boolean')patch.alwaysOnTop=state.isAlwaysOnTop;
    if(state&&typeof state.miniMode==='boolean')patch.miniMode=state.miniMode;
    if(state&&typeof state.minimizeToTray==='boolean')patch.minimizeToTray=state.minimizeToTray;
    if(Object.keys(patch).length)patchDesktop(patch);
    applyVisualOpacity(meta.windowOpacity);
    document.body.classList.toggle('mini-mode',!!meta.miniMode);
    refreshControls(false);
  }
  function refreshControls(save){
    const top=$('#topBtn');
    if(top)top.classList.toggle('on',!!meta.alwaysOnTop);
    document.body.classList.toggle('mini-mode',!!meta.miniMode);
    const rng=$('#opacityRange'), val=$('#opacityVal');
    const pct=Math.round((Number(meta.windowOpacity)||1)*100);
    if(rng&&document.activeElement!==rng)rng.value=String(pct);
    if(val)val.textContent=pct+'%';
    if(save)metaSave({silent:true});
  }
  function bind(id,fn){const el=$(id);if(el)el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn();});}
  async function applyPrefs(){
    refreshControls(false);
    applyVisualOpacity(meta.windowOpacity);
    if(!native())return;
    clearTimeout(applyTimer);
    applyTimer=setTimeout(async()=>{
      try{
        if(window.memoboardNative.setAlwaysOnTop)await window.memoboardNative.setAlwaysOnTop(!!meta.alwaysOnTop);
        if(window.memoboardNative.setWindowOpacity){const r=await window.memoboardNative.setWindowOpacity(Number(meta.windowOpacity)||1);if(r&&typeof r.nativeOpacitySupported==='boolean')nativeOpacitySupported=r.nativeOpacitySupported;applyVisualOpacity(meta.windowOpacity);}
        if(window.memoboardNative.setMinimizeToTray)await window.memoboardNative.setMinimizeToTray(!!meta.minimizeToTray);
        if(window.memoboardNative.setMiniMode)await window.memoboardNative.setMiniMode(!!meta.miniMode);
      }catch(e){console.warn('[memoboard] window preference apply failed',e);}
    },20);
  }
  async function toggleAlwaysOnTop(){
    patchDesktop({alwaysOnTop:!meta.alwaysOnTop});
    await metaSave({silent:true});
    refreshControls(false);
    if(native()&&window.memoboardNative.setAlwaysOnTop){
      try{const r=await window.memoboardNative.setAlwaysOnTop(meta.alwaysOnTop);setState({isAlwaysOnTop:!!(r&&r.enabled),opacity:meta.windowOpacity});}
      catch(e){toast('항상 최상단 설정 실패');}
    }
    toast(meta.alwaysOnTop?'항상 최상단을 켰습니다':'항상 최상단을 껐습니다');
  }
  async function setOpacity(value){
    const opacity=Math.max(.55,Math.min(1,Number(value)||1));
    patchDesktop({windowOpacity:opacity});
    applyVisualOpacity(opacity);
    refreshControls(false);
    scheduleSilentMetaSave();
    if(native()&&window.memoboardNative.setWindowOpacity){
      try{const r=await window.memoboardNative.setWindowOpacity(opacity);if(r&&typeof r.opacity==='number')patchDesktop({windowOpacity:r.opacity});if(r&&typeof r.nativeOpacitySupported==='boolean')nativeOpacitySupported=r.nativeOpacitySupported;applyVisualOpacity(meta.windowOpacity);refreshControls(false);}
      catch(e){nativeOpacitySupported=false;applyVisualOpacity(meta.windowOpacity,true);toast('투명도 설정 실패');}
    }
  }
  async function toggleMinimizeToTray(){
    patchDesktop({minimizeToTray:!meta.minimizeToTray});
    await metaSave({silent:true});
    if(native()&&window.memoboardNative.setMinimizeToTray){try{await window.memoboardNative.setMinimizeToTray(meta.minimizeToTray);}catch(e){toast('트레이 설정 실패');}}
    toast(meta.minimizeToTray?'닫기 버튼은 트레이로 숨깁니다':'닫기 버튼은 앱을 종료합니다');
  }
  async function hideToTray(){
    if(native()&&window.memoboardNative.hideToTray)await window.memoboardNative.hideToTray();
    else toast('데스크톱 앱에서만 지원합니다');
  }
  async function toggleMiniMode(){
    patchDesktop({miniMode:!meta.miniMode});
    await metaSave({silent:true});
    document.body.classList.toggle('mini-mode',!!meta.miniMode);
    if(native()&&window.memoboardNative.setMiniMode){try{await window.memoboardNative.setMiniMode(meta.miniMode);}catch(e){toast('미니 모드 전환 실패');}}
    toast(meta.miniMode?'미니 플로팅 모드':'일반 창 모드');
  }
  function isWindowDragTarget(event){
    if(!event||event.button!==0)return false;
    const target=event.target&&event.target.closest?event.target:null;
    if(!target)return false;
    if(target.closest('button,input,select,textarea,a,label,[role="button"],.tabs,.workspace-switch,.searchwrap,.dd,.win-controls,[data-no-window-drag]'))return false;
    return !!target.closest('header,.window-drag-region');
  }
  function bindWindowDragRegion(){
    const header=document.querySelector('header');
    if(!header||header.dataset.windowDragBound==='1')return;
    header.dataset.windowDragBound='1';
    header.addEventListener('mousedown',event=>{
      if(!isWindowDragTarget(event))return;
      event.preventDefault();
      if(event.detail===2){
        if(window.memoboardNative&&window.memoboardNative.toggleMaximizeWindow){
          window.memoboardNative.toggleMaximizeWindow().then(setState).catch(()=>{});
        }
        return;
      }
      if(window.memoboardNative&&window.memoboardNative.startWindowDrag){
        window.memoboardNative.startWindowDrag().catch(()=>{});
      }
    });
  }
  function init(){
    if(!native())return;
    document.body.classList.add('desktop-runtime');
    document.documentElement.classList.add('desktop-runtime');
    bindWindowDragRegion();
    bind('#winMin',()=>window.memoboardNative.minimizeWindow());
    bind('#winMax',async()=>{const r=await window.memoboardNative.toggleMaximizeWindow();setState(r);});
    bind('#winClose',()=>window.memoboardNative.closeWindow());
    bind('#topBtn',toggleAlwaysOnTop);
    const rng=$('#opacityRange');
    if(rng)rng.addEventListener('input',()=>setOpacity(Number(rng.value)/100));
    if(window.memoboardNative.getWindowState)window.memoboardNative.getWindowState().then(setState).catch(()=>{});
    if(window.memoboardNative.onWindowState)window.memoboardNative.onWindowState(setState);
    if(window.memoboardNative.onQuickNote)window.memoboardNative.onQuickNote(()=>QuickMemo.open());
    if(window.memoboardNative.onFocus)window.memoboardNative.onFocus(()=>window.focus());
  }
  return {init,applyPrefs,toggleAlwaysOnTop,setOpacity,toggleMinimizeToTray,hideToTray,toggleMiniMode,refreshControls};
})();
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
function choseong(s){let r='';for(const ch of s){const c=ch.charCodeAt(0);
  r+=(c>=0xAC00&&c<=0xD7A3)?CHO[Math.floor((c-0xAC00)/588)]:ch;}return r;}
function isChoQ(q){return q.length>0&&[...q].every(ch=>CHO.includes(ch)||ch===' ');}
function unquoteSearchValue(v){
  v=String(v||'').trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))return v.slice(1,-1);
  return v;
}
function parseSearch(q){
  const out={terms:[],ops:[]};
  const re=/(?:-?[A-Za-z가-힣]+:"[^"]*"|-?[A-Za-z가-힣]+:'[^']*'|"[^"]+"|'[^']+'|\S+)/g;
  String(q||'').match(re)?.forEach(raw=>{
    let token=raw.trim();
    const neg=token.startsWith('-');
    if(neg)token=token.slice(1);
    const m=token.match(/^([A-Za-z가-힣]+):(.*)$/);
    if(m&&m[2]!==undefined&&m[2]!=='')out.ops.push({not:neg,k:m[1].toLowerCase(),v:unquoteSearchValue(m[2]).toLowerCase()});
    else out.terms.push((neg?'-':'')+unquoteSearchValue(token));
  });
  return out;
}
function matchPlainTerm(n,term){
  if(!term)return true;
  const neg=String(term).startsWith('-');
  if(neg)term=String(term).slice(1);
  const ql=String(term).toLowerCase();
  const hay=(n.title+' '+n.body+' '+noteTags(n).join(' ')+' '+(n.folder||''));
  const hit=hay.toLowerCase().includes(ql)||(isChoQ(term)&&choseong(hay).includes(term));
  return neg?!hit:hit;
}
function textHit(src,v){return String(src||'').toLowerCase().includes(String(v||'').toLowerCase());}
function ymdAlias(v){
  const ty=todayYmd();
  if(v==='today'||v==='오늘')return ty;
  if(v==='tomorrow'||v==='내일')return addDaysYmd(ty,1);
  if(v==='yesterday'||v==='어제')return addDaysYmd(ty,-1);
  return v;
}
function rangeHit(date,v){
  if(!date)return false;
  const ty=todayYmd();
  if(v==='today'||v==='오늘')return date===ty;
  if(v==='tomorrow'||v==='내일')return date===addDaysYmd(ty,1);
  if(v==='week'||v==='주'||v==='이번주')return date>=ty&&date<=addDaysYmd(ty,7);
  if(v==='month'||v==='월'||v==='이번달')return date>=ty&&date<=addDaysYmd(ty,30);
  if(v==='none'||v==='없음'||v==='nodate')return !date;
  return date===v;
}
function matchSearchOp(n,op){
  const k=op.k, v=op.v, d=deriveNote(n), ty=todayYmd(), wk=addDaysYmd(ty,7);
  let ok=true;
  if(k==='title'||k==='제목')ok=textHit(n.title||dispTitle(n),v);
  else if(k==='body'||k==='본문'||k==='text'||k==='내용')ok=textHit(n.body,v);
  else if((k==='tag'||k==='태그') )ok=d.tags.some(t=>String(t).toLowerCase().includes(v));
  else if((k==='folder'||k==='폴더'||k==='f') )ok=String(n.folder||'').toLowerCase().includes(v);
  else if((k==='kind'||k==='type'||k==='유형') )ok=String(n.kind||'memo').toLowerCase()===v;
  else if((k==='priority'||k==='중요도') )ok=String(n.priority||'normal').toLowerCase()===v;
  else if((k==='zone'||k==='구역')){
    const zi=zoneNames().findIndex(z=>String(z).toLowerCase()===v);
    const zn=Number(v);
    ok=zi>=0?n.zone===zi:(Number.isFinite(zn)?(n.zone===zn-1||n.zone===zn):false);
  }else if(k==='color'||k==='색상'){
    const ci=COLOR_NAMES.findIndex(x=>x.toLowerCase()===v);
    const cn=Number(v);
    ok=ci>=0?n.color===ci:(Number.isFinite(cn)?n.color===cn:false);
  }else if(k==='due'||k==='기한'){
    const due=d.dueDate;
    if(v==='overdue'||v==='late'||v==='지남')ok=!!(due&&!n.done&&due<ty);
    else if(v==='today'||v==='오늘')ok=!!(due===ty&&!n.done);
    else if(v==='tomorrow'||v==='내일')ok=!!(due===addDaysYmd(ty,1)&&!n.done);
    else if(v==='week'||v==='주'||v==='이번주')ok=!!(due&&!n.done&&due>=ty&&due<=wk);
    else if(v==='month'||v==='월'||v==='이번달')ok=!!(due&&!n.done&&due>=ty&&due<=addDaysYmd(ty,30));
    else if(v==='none'||v==='nodate'||v==='없음')ok=!due;
    else ok=due===ymdAlias(v);
  }else if(k==='date'||k==='날짜')ok=rangeHit(n.date,ymdAlias(v));
  else if(k==='before'||k==='이전'){
    const date=n.date||d.dueDate;ok=!!(date&&date<ymdAlias(v));
  }else if(k==='after'||k==='이후'){
    const date=n.date||d.dueDate;ok=!!(date&&date>ymdAlias(v));
  }else if(k==='is'||k==='상태'){
    if(v==='done'||v==='완료')ok=!!n.done;
    else if(v==='todo'||v==='open'||v==='미완료')ok=!n.done;
    else if(v==='pinned'||v==='pin'||v==='고정')ok=!!n.pinned;
    else if(v==='locked'||v==='lock'||v==='잠금')ok=!!n.locked;
    else if(v==='archived'||v==='archive'||v==='보관')ok=!!n.archived;
    else if(v==='checklist'||v==='체크')ok=!!d.hasTasks;
    else if(v==='code'||v==='코드')ok=!!d.hasCode;
    else if(v==='long'||v==='긴글')ok=!!d.isLong;
    else ok=false;
  }else ok=matchPlainTerm(n,k+':'+v);
  return op.not?!ok:ok;
}
function matchNote(n,q){
  if(!q)return true;
  const parsed=parseSearch(q);
  return parsed.ops.every(op=>matchSearchOp(n,op))&&parsed.terms.every(t=>matchPlainTerm(n,t));
}
const SearchService={parse:parseSearch,match:matchNote,matchPlain:matchPlainTerm};
window.MBSearch=SearchService;
function fuzzy(q,s){q=q.toLowerCase();s=s.toLowerCase();let i=0;
  for(const ch of s){if(ch===q[i])i++;if(i===q.length)return true;}return q.length===0;}
function hiText(text,q){const e=esc(text);if(!q||isChoQ(q))return e;
  try{const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');return e.replace(re,'<mark>$1</mark>');}catch(err){return e;}}
function relTime(t){const d=Date.now()-t,m=6e4,h=36e5,day=864e5;
  if(d<m)return'방금';if(d<h)return Math.floor(d/m)+'분 전';if(d<day)return Math.floor(d/h)+'시간 전';
  if(d<day*2)return'어제';if(d<day*7)return Math.floor(d/day)+'일 전';
  const dt=new Date(t);return (dt.getMonth()+1)+'/'+dt.getDate();}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function todayYmd(){return ymd(new Date());}
function noteTags(n){const s=new Set(n.tags||[]);const re=/(^|\s)#([0-9A-Za-z가-힣_\-]+)/g;let m;
  while((m=re.exec(n.body)))s.add(m[2]);return [...s];}
function dispTitle(n){if(n.title.trim())return n.title.trim();
  const l=(n.body||'').split('\n').find(x=>x.trim());return l?l.trim().replace(/^[#>\-*\d.\s[\]x]+/,'').slice(0,40)||'제목 없음':'제목 없음';}
function stripMd(s){return String(s||'').replace(/```[\s\S]*?```/g,'[코드]').replace(/^#{1,6}\s+/gm,'').replace(/[*_~`]|==/g,'')
  .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[\[([^\]]+)\]\]/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/^\s*(?:[-*]|\d+\.)\s\[[ xX]\]\s*/gm,'').trim();}
const SIZE_LABEL={title:'제목만',small:'작게',normal:'보통',large:'크게'};
const SIZE_ORDER=['title','small','normal','large'];
const DEFAULT_ZONES=['수집','진행','검토','참고','완료'];
const MIN_ZONES=1, MAX_ZONES=8;
const CAL_KINDS={memo:['📝','메모'],task:['✅','업무'],meeting:['💬','회의'],appointment:['🤝','약속'],call:['📞','전화'],deadline:['📌','마감'],report:['🧾','보고']};
function kindIcon(k){return (CAL_KINDS[k]||CAL_KINDS.memo)[0];}
function kindName(k){return (CAL_KINDS[k]||CAL_KINDS.memo)[1];}
function kindOptions(sel){return Object.keys(CAL_KINDS).map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+CAL_KINDS[k][0]+' '+CAL_KINDS[k][1]+'</option>').join('');}
function isTaskLike(n){return !!n&&(['task','deadline','report'].includes(n.kind)||!!n.dueDate);}
function deadlineDate(n){if(!n)return null;return n.dueDate? n.dueDate : (isTaskLike(n)?n.date:null);}
function ensureZones(){
  if(window.MBStore&&typeof StoreService.normalize==='function'){StoreService.normalize();return;}
  if(!Array.isArray(meta.memoZones)||!meta.memoZones.length)meta.memoZones=DEFAULT_ZONES.slice();
  meta.memoZones=meta.memoZones.map((z,i)=>String(z||DEFAULT_ZONES[i]||('구역 '+(i+1))).trim()||('구역 '+(i+1)));
  while(meta.memoZones.length<MIN_ZONES)meta.memoZones.push(DEFAULT_ZONES[meta.memoZones.length]||('구역 '+(meta.memoZones.length+1)));
  if(meta.memoZones.length>MAX_ZONES)meta.memoZones=meta.memoZones.slice(0,MAX_ZONES);
  if(!Array.isArray(meta.collapsedZones))meta.collapsedZones=[];
  while(meta.collapsedZones.length<meta.memoZones.length)meta.collapsedZones.push(false);
  if(meta.collapsedZones.length>meta.memoZones.length)meta.collapsedZones=meta.collapsedZones.slice(0,meta.memoZones.length);
}
function zoneCount(){ensureZones();return window.MBStore&&StoreService.zoneCount?StoreService.zoneCount():meta.memoZones.length;}
function zoneNames(){ensureZones();return window.MBStore&&StoreService.zoneNames?StoreService.zoneNames():meta.memoZones.slice();}
function zoneCollapsedList(){ensureZones();return window.MBStore&&StoreService.collapsedZones?StoreService.collapsedZones():meta.collapsedZones.slice();}
function clampZone(z){const cnt=zoneCount();z=Number(z);if(!Number.isInteger(z)||z<0)return 0;return Math.min(z,cnt-1);}
function normalizeNote(n){
  ensureZones();
  // legacy migration: old kanban fields -> clean task fields
  if(n.status==='done'&&n.done!==true)n.done=true;
  if((n.status==='todo'||n.status==='doing'||n.status==='done')&&!n.kind)n.kind='task';
  if(!n.dueDate&&n.date&&(['task','deadline','report'].includes(n.kind)||['todo','doing','done'].includes(n.status)))n.dueDate=n.date;
  if(n.done&&n.doneAt==null)n.doneAt=typeof n.updatedAt==='number'?n.updatedAt:Date.now();
  if(!n.done)n.doneAt=null;
  delete n.status; delete n.korder;
  if(!n.size||!SIZE_LABEL[n.size])n.size=(window.MBStore&&StoreService.defaultSize?StoreService.defaultSize():((meta&&meta.defaultSize)||'title'));
  n.zone=clampZone(n.zone);
  if(typeof n.morder!=='number')n.morder=typeof n.createdAt==='number'?n.createdAt:(typeof n.updatedAt==='number'?n.updatedAt:Date.now());
  if(!n.kind||!CAL_KINDS[n.kind])n.kind='memo';
  if(!PRIORITY_LABEL[n.priority])n.priority='normal';
  if(typeof n.done!=='boolean')n.done=false;
  if(!Array.isArray(n.tags))n.tags=[];
  if(!Array.isArray(n.history))n.history=[];
  if(typeof n.locked!=='boolean')n.locked=false;
  if(typeof n.archived!=='boolean')n.archived=false;
  if(n.weeklyKey!=null&&typeof n.weeklyKey!=='string')n.weeklyKey=String(n.weeklyKey||'');
  if(n.weeklyKey==='')n.weeklyKey=null;
  if(typeof n.body!=='string')n.body=n.body?String(n.body):'';
  if(typeof n.title!=='string')n.title=n.title?String(n.title):'';
  if((!n.zoneId||typeof n.zoneId!=='string')&&window.MBStore&&StoreService.exportZones){
    const z=StoreService.exportZones()[clampZone(n.zone)];
    if(z&&z.id)n.zoneId=String(z.id);
  }
  return n;}
const noteCache=new Map();
let currentIndex=null, dataRevision=0, indexRevision=-1;
function invalidateIndex(){dataRevision++;currentIndex=null;}
function getIndex(){
  if(!currentIndex||indexRevision!==dataRevision){
    currentIndex=buildIndex();
    indexRevision=dataRevision;
  }
  return currentIndex;
}
function deriveNote(n){
  normalizeNote(n);
  const sig=[n.updatedAt,n.body,n.title,(n.tags||[]).join('|'),n.date,n.dueDate,n.done,n.kind,n.priority,n.folder,n.weeklyKey||''].join('\u0001');
  const cached=noteCache.get(n.id);
  if(cached&&cached.sig===sig)return cached.d;
  const tags=noteTags(n);
  const tasks=taskItems(n);
  const plain=stripMd(n.body||'');
  const due=ddayInfo(n);
  const d={tags,tasks,plain,hasTasks:tasks.length>0,hasCode:/```|\bSELECT\b|\bFROM\b|\bWHERE\b|\bSub\b|\bFunction\b/i.test(n.body),isLong:(n.body||'').length>800||((n.body||'').match(/^#{1,4}\s/gm)||[]).length>=2,isTask:isTaskLike(n),dueDate:deadlineDate(n),due,priority:n.priority||'normal'};
  noteCache.set(n.id,{sig,d});
  return d;
}

function taskItems(n,limit){
  const out=[];let inF=false,idx=0;
  (n.body||'').split('\n').forEach(line=>{
    if(/^```/.test(line)){inF=!inF;return;}
    if(inF)return;
    const m=line.match(/^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]\s*(.*)/);
    if(m){out.push({idx:idx++,done:m[1]!==' ',text:m[2].trim()||'체크 항목'});}
  });
  return typeof limit==='number'?out.slice(0,limit):out;
}

function buildIndex(){
  const live=liveNotes().map(normalizeNote);
  const ty=todayYmd(), wk=addDaysYmd(ty,7);
  const idx={live,byId:new Map(),derived:new Map(),zoneCounts:Array(zoneCount()).fill(0),dueCounts:{overdue:0,today:0,week:0,nodate:0,done:0},kindCounts:{},smartCounts:{all:live.filter(n=>!n.archived).length,today:0,pinned:0,unfiled:0,checklist:0,code:0,long:0,archive:0,locked:0,trash:notes.filter(n=>n.deletedAt).length},folders:{},tags:{},colors:{}};
  live.forEach(n=>{
    const d=deriveNote(n);idx.byId.set(n.id,n);idx.derived.set(n.id,d);
    if(n.archived)idx.smartCounts.archive++;
    if(n.locked)idx.smartCounts.locked++;
    if(!n.archived)idx.zoneCounts[n.zone||0]++;
    if(n.pinned&&!n.archived)idx.smartCounts.pinned++;
    const isTodayRelated=(n.date===ty||d.dueDate===ty);
    if(isTodayRelated&&!n.archived)idx.smartCounts.today++;
    if(!n.archived){
      if(!n.folder&&!d.tags.length&&!d.dueDate&&!n.date)idx.smartCounts.unfiled++;
      if(d.hasTasks)idx.smartCounts.checklist++;
      if(d.hasCode)idx.smartCounts.code++;
      if(d.isLong)idx.smartCounts.long++;
      if(n.folder)idx.folders[n.folder]=(idx.folders[n.folder]||0)+1;
      d.tags.forEach(t=>idx.tags[t]=(idx.tags[t]||0)+1);
      idx.colors[n.color]=(idx.colors[n.color]||0)+1;
      idx.kindCounts[n.kind]=(idx.kindCounts[n.kind]||0)+1;
      const due=d.dueDate;
      if(n.done)idx.dueCounts.done++;
      else if(due&&due<ty)idx.dueCounts.overdue++;
      else if(due===ty)idx.dueCounts.today++;
      else if(due&&due>=ty&&due<=wk)idx.dueCounts.week++;
      else if(!due&&d.isTask)idx.dueCounts.nodate++;
    }
  });
  return idx;
}
function visibleTags(n,max){const tags=deriveNote(n).tags;return {shown:tags.slice(0,max),more:Math.max(0,tags.length-max)};}
function setEdMode(mode){
  $$('#edModes button').forEach(x=>x.classList.toggle('on',x.dataset.m===mode));
  $('#edBox').classList.remove('m-prev','m-split');
  if(mode==='prev')$('#edBox').classList.add('m-prev');
  if(mode==='split')$('#edBox').classList.add('m-split');
  if(mode!=='edit')renderEdPrev();
}
function uid(){return 'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function download(name,content,type){const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:type||'text/plain;charset=utf-8'}));
  a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);}

/* ================= 한국 공휴일 (2026–2028 내장) ================= */
const HOLIDAYS={
'2026-01-01':'신정','2026-02-16':'설날 연휴','2026-02-17':'설날','2026-02-18':'설날 연휴',
'2026-03-01':'삼일절','2026-03-02':'대체공휴일','2026-05-05':'어린이날','2026-05-24':'부처님오신날',
'2026-05-25':'대체공휴일','2026-06-06':'현충일','2026-08-15':'광복절','2026-08-17':'대체공휴일',
'2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴','2026-10-03':'개천절',
'2026-10-05':'대체공휴일','2026-10-09':'한글날','2026-12-25':'성탄절',
'2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날','2027-02-08':'설날 연휴',
'2027-02-09':'대체공휴일','2027-03-01':'삼일절','2027-05-05':'어린이날','2027-05-13':'부처님오신날',
'2027-06-06':'현충일','2027-08-15':'광복절','2027-08-16':'대체공휴일','2027-09-14':'추석 연휴',
'2027-09-15':'추석','2027-09-16':'추석 연휴','2027-10-03':'개천절','2027-10-04':'대체공휴일',
'2027-10-09':'한글날','2027-10-11':'대체공휴일','2027-12-25':'성탄절','2027-12-27':'대체공휴일',
'2028-01-01':'신정','2028-01-25':'설날 연휴','2028-01-26':'설날','2028-01-27':'설날 연휴',
'2028-03-01':'삼일절','2028-05-02':'부처님오신날','2028-05-05':'어린이날','2028-06-06':'현충일',
'2028-08-15':'광복절','2028-10-02':'추석 연휴','2028-10-03':'추석·개천절','2028-10-04':'추석 연휴',
'2028-10-05':'대체공휴일','2028-10-09':'한글날','2028-12-25':'성탄절'
};

/* ================= markdown ================= */
const KWRE=new RegExp('\\b(SELECT|FROM|WHERE|GROUP|ORDER|BY|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|AS|AND|OR|NOT|IN|IS|CASE|WHEN|THEN|ELSE|END|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|WITH|UNION|ALL|DISTINCT|NULL|LIKE|BETWEEN|EXISTS|HAVING|OVER|PARTITION|ROWNUM|CONNECT|PRIOR|START|function|return|const|let|var|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|of|async|await|try|catch|finally|throw|typeof|this|true|false|null|undefined|def|print|lambda|Dim|Sub|Function|End|Then|Next|Each|Loop|Set|Call|ByVal|ByRef|As|String|Long|Integer|Double|Boolean|Nothing)\\b','g');
const MARKDOWN_HELP=[
  {name:'제목',syntax:'# 제목 / ## 소제목',desc:'긴 메모를 섹션으로 나눕니다. 1~6단계 제목을 지원합니다.'},
  {name:'굵게',syntax:'**중요**',desc:'핵심 단어를 강조합니다. 에디터에서 Ctrl+B로 삽입합니다.'},
  {name:'기울임',syntax:'*참고*',desc:'보조 강조입니다. 에디터에서 Ctrl+I로 삽입합니다.'},
  {name:'취소선',syntax:'~~폐기~~',desc:'완료/폐기된 문장을 표시합니다. Ctrl+Shift+X로 삽입합니다.'},
  {name:'형광펜',syntax:'==강조==',desc:'눈에 띄게 표시할 문장에 씁니다.'},
  {name:'체크리스트',syntax:'- [ ] 할 일 / - [x] 완료',desc:'카드와 미리보기에서 바로 체크 가능한 항목으로 표시합니다.'},
  {name:'목록',syntax:'- 항목 / 1. 항목',desc:'일반 bullet 목록과 번호 목록을 지원합니다.'},
  {name:'인용',syntax:'> 인용문',desc:'회의 내용, 원문, 참고사항을 구분합니다.'},
  {name:'인라인 코드',syntax:'`Alt+N`',desc:'단축키, 함수명, 짧은 SQL 조각을 표시합니다.'},
  {name:'코드블록',syntax:'```sql\nSELECT *\n```',desc:'SQL, VBA, 프롬프트를 보관합니다. 기본 문법 강조를 적용합니다.'},
  {name:'링크',syntax:'[문서](example.com)',desc:'외부/내부 참고 링크를 표시합니다. 위험한 스킴은 차단합니다.'},
  {name:'위키링크',syntax:'[[프로젝트명]]',desc:'같은 제목의 메모로 이동하고, 없으면 새 메모를 만듭니다.'},
  {name:'구분선',syntax:'---',desc:'문서 내 구간을 나눕니다.'},
  {name:'표',syntax:'| A | B |\n|---|---|\n| 1 | 2 |',desc:'간단한 표를 렌더링합니다.'},
  {name:'이미지 참조',syntax:'![설명](path-or-url)',desc:'파일 저장 구조가 없으므로 실제 삽입 대신 이미지 참조 배지로 표시합니다.'}
];
function escAttr(s){return esc(String(s||'')).replace(/'/g,'&#39;');}
function hl(code){let s=esc(code);
  return s.replace(/(\/\*[\s\S]*?\*\/|--[^\n]*|\/\/[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")|\b(\d+(?:\.\d+)?)\b|((?:[A-Za-z_][A-Za-z0-9_]*))/g,
   (m,c,st,nu,w)=>{
    if(c)return '<span class="cm">'+c+'</span>';
    if(st)return '<span class="st">'+st+'</span>';
    if(nu)return '<span class="nu">'+nu+'</span>';
    if(w){KWRE.lastIndex=0;return KWRE.test(w)?'<span class="kw">'+w+'</span>':w;}
    return m;});}
function safeLinkTarget(href){
  href=String(href||'').trim();
  if(!href||/[\u0000-\u001f\u007f]/.test(href))return '';
  if(/^\/\//.test(href))return '';
  if(/^[a-z][a-z0-9+.-]*:/i.test(href)){
    return /^(https?:|mailto:)/i.test(href)?href:'';
  }
  return href;
}
function inlineMd(s){
  const codes=[];
  s=esc(s);
  s=s.replace(/`([^`]+)`/g,(m,c)=>{codes.push(c);return '\u0002'+(codes.length-1)+'\u0002';});
  s=s.replace(/!\[([^\]\n]*)\]\(([^)\s]+)\)/g,(m,alt,src)=>{
    const safe=safeLinkTarget(src);
    return safe?'<span class="md-image" title="'+escAttr(safe)+'">🖼 '+(alt||'이미지')+'</span>':esc(m);
  });
  s=s.replace(/\[\[([^\]\n]+)\]\]/g,(m,t)=>'<a class="wiki" data-t="'+escAttr(t)+'">'+t+'</a>');
  s=s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g,(m,label,href)=>{
    const safe=safeLinkTarget(href);
    return safe?'<a href="'+escAttr(safe)+'" target="_blank" rel="noopener">'+label+'</a>':label;
  });
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>');
  s=s.replace(/__([^_\n]+)__/g,'<b>$1</b>');
  s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<i>$2</i>');
  s=s.replace(/(^|[^_])_([^_\n]+)_/g,'$1<i>$2</i>');
  s=s.replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
  s=s.replace(/==([^=\n]+)==/g,'<mark>$1</mark>');
  s=s.replace(/(^|\s)#([0-9A-Za-z가-힣_\-]+)/g,'$1<span class="htag">#$2</span>');
  s=s.replace(/\u0002(\d+)\u0002/g,(m,i)=>'<code>'+codes[+i]+'</code>');
  return s;
}
function parseTableRow(line){return line.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c=>c.trim());}
function isTableDivider(line){return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);}
function legacyMd2Html(src){
  const fences=[];
  src=String(src||'').replace(/```([^\n`]*)\n([\s\S]*?)(?:```|$)/g,(m,lang,code)=>{
    fences.push({lang:String(lang||'').trim(),code});
    return '\u0001F'+(fences.length-1)+'\u0001';
  });
  const lines=src.split('\n');
  let out='',i=0,taskIdx=0;
  while(i<lines.length){
    const L=lines[i];
    const fm=L.match(/^\u0001F(\d+)\u0001\s*$/);
    if(fm){
      const f=fences[+fm[1]]||{lang:'',code:''};
      if(String(f.lang||'').toLowerCase()==='mermaid')out+=mermaidPlaceholder(f.code);
      else {
        const lang=f.lang?'<div class="code-lang">'+esc(f.lang)+'</div>':'';
        out+='<pre>'+lang+'<code class="hl">'+hl(f.code)+'</code></pre>';
      }
      i++;continue;
    }
    if(/^\s*$/.test(L)){i++;continue;}
    let m;
    if((m=L.match(/^(#{1,6})\s+(.*)/))){out+='<h'+m[1].length+'>'+inlineMd(m[2])+'</h'+m[1].length+'>';i++;continue;}
    if(/^\s*(-{3,}|\*{3,})\s*$/.test(L)){out+='<hr>';i++;continue;}
    if(/^>\s?/.test(L)){
      let q='';
      while(i<lines.length&&/^>\s?/.test(lines[i])){q+=inlineMd(lines[i].replace(/^>\s?/,''))+'<br>';i++;}
      out+='<blockquote>'+q.replace(/<br>$/,'')+'</blockquote>';continue;
    }
    if(/^\s*\|/.test(L)&&i+1<lines.length&&isTableDivider(lines[i+1])){
      const head=parseTableRow(L).map(c=>'<th>'+inlineMd(c)+'</th>').join('');
      i+=2;let rows='';
      while(i<lines.length&&/^\s*\|/.test(lines[i])){
        rows+='<tr>'+parseTableRow(lines[i]).map(c=>'<td>'+inlineMd(c)+'</td>').join('')+'</tr>';i++;
      }
      out+='<table><thead><tr>'+head+'</tr></thead><tbody>'+rows+'</tbody></table>';continue;
    }
    if(/^\s*([-*]|\d+\.)\s+/.test(L)){
      const ordered=/^\s*\d+\.\s+/.test(L);
      let items='';
      let expectedNo=null;
      const firstNo=ordered?Number((L.match(/^\s*(\d+)\.\s+/)||[])[1]||1):null;
      while(i<lines.length){
        const ln=lines[i];
        const om=ordered?ln.match(/^\s*(\d+)\.\s+(.*)/):null;
        const um=!ordered?ln.match(/^\s*([-*])\s+(.*)/):null;
        if((ordered&&!om)||(!ordered&&!um))break;
        const rawText=ordered?om[2]:um[2];
        let liAttr='';
        if(ordered){
          const no=Number(om[1]);
          if(expectedNo===null)expectedNo=no;
          if(no!==expectedNo)liAttr+=' value="'+no+'"';
          expectedNo=no+1;
        }
        const tm=rawText.match(/^\[( |x|X)\]\s*(.*)/);
        if(tm){const done=tm[1]!==' ';
          items+='<li'+liAttr+' class="task'+(done?' done':'')+'"><input type="checkbox" data-ti="'+taskIdx+'"'+(done?' checked':'')+'><span>'+inlineMd(tm[2]||'체크 항목')+'</span></li>';
          taskIdx++;
        }else items+='<li'+liAttr+'>'+inlineMd(rawText)+'</li>';
        i++;
      }
      const startAttr=ordered&&firstNo&&firstNo!==1?' start="'+firstNo+'"':'';
      out+=(ordered?'<ol'+startAttr+'>':'<ul>')+items+(ordered?'</ol>':'</ul>');continue;
    }
    let p='';
    while(i<lines.length&&lines[i].trim()&&!/^(#{1,6}\s|>|\s*\||\s*([-*]|\d+\.)\s|\u0001F)/.test(lines[i])&&!/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])){
      p+=inlineMd(lines[i])+'<br>';i++;
    }
    if(p)out+='<p>'+p.replace(/<br>$/,'')+'</p>';else i++;
  }
  return out||'<p style="color:var(--sub)">미리볼 내용이 없습니다.</p>';
}

let markdownItRenderer=null;
let mermaidSeq=0;
let mermaidInitialized=false;
let mermaidRenderToken=0;
function mermaidPlaceholder(src){
  return '<div class="mermaid-block" data-mermaid-status="pending"><pre class="mermaid-source"><div class="code-lang">mermaid</div><code class="language-mermaid">'+esc(src||'')+'</code></pre></div>';
}
function sanitizeMermaidSvgFallback(svg){
  return String(svg||'')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi,'')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi,'')
    .replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'')
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi,'')
    .replace(/\s+(?:href|xlink:href|src)\s*=\s*javascript:[^\s>]+/gi,'')
    .replace(/\s+style\s*=\s*(["'])[\s\S]*?javascript:[\s\S]*?\1/gi,'');
}
function sanitizeMermaidSvg(svg){
  svg=String(svg||'');
  if(!svg)return '';
  if(typeof document==='undefined'||!document||typeof document.createElement!=='function')return sanitizeMermaidSvgFallback(svg);
  const tpl=document.createElement('template');
  tpl.innerHTML=svg;
  tpl.content.querySelectorAll('script,foreignObject').forEach(el=>el.remove());
  tpl.content.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(attr=>{
      const name=String(attr.name||'');
      const lower=name.toLowerCase();
      const value=String(attr.value||'');
      if(lower.startsWith('on')||/javascript:/i.test(value))el.removeAttribute(name);
      else if((lower==='href'||lower==='xlink:href'||lower==='src')&&value&&!value.startsWith('#')&&!safeLinkTarget(value))el.removeAttribute(name);
    });
  });
  return tpl.innerHTML;
}
function getMermaidRenderer(){
  const m=window.mermaid;
  if(!m||typeof m.render!=='function')return null;
  if(!mermaidInitialized&&typeof m.initialize==='function'){
    try{
      m.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',logLevel:'fatal'});
      mermaidInitialized=true;
    }catch(e){console.warn('[memoboard] mermaid init failed',e);return null;}
  }
  return m;
}
function mermaidUnavailable(block){
  if(!block||block.dataset.mermaidStatus==='unavailable')return;
  block.dataset.mermaidStatus='unavailable';
  block.insertAdjacentHTML('afterbegin','<div class="mermaid-note">Mermaid 렌더러를 불러오지 못했습니다.</div>');
}
async function renderMermaidIn(root){
  root=root||document;
  const m=getMermaidRenderer();
  const blocks=[...root.querySelectorAll('.mermaid-block')].filter(x=>x.dataset.mermaidStatus!=='rendered'&&x.dataset.mermaidStatus!=='rendering');
  if(!blocks.length)return;
  if(!m){blocks.forEach(mermaidUnavailable);return;}
  const token=++mermaidRenderToken;
  for(const block of blocks){
    const code=block.querySelector('code.language-mermaid');
    const src=code?code.textContent:'';
    if(!src.trim()){block.dataset.mermaidStatus='empty';continue;}
    block.dataset.mermaidStatus='rendering';
    try{
      const id='mb_mermaid_'+Date.now().toString(36)+'_'+(mermaidSeq++);
      const res=await m.render(id,src);
      if(token!==mermaidRenderToken||!document.body.contains(block))continue;
      const svg=typeof res==='string'?res:(res&&res.svg)||'';
      if(!svg)throw new Error('Mermaid rendered an empty SVG');
      const safeSvg=sanitizeMermaidSvg(svg);
      if(!safeSvg||!/<svg[\s>]/i.test(safeSvg))throw new Error('Mermaid rendered an unsafe SVG');
      block.innerHTML='<div class="mermaid-diagram">'+safeSvg+'</div>';
      block.dataset.mermaidStatus='rendered';
    }catch(e){
      const msg=esc((e&&e.message)||String(e)||'Mermaid render failed');
      block.dataset.mermaidStatus='error';
      block.innerHTML='<div class="mermaid-error">Mermaid 문법 오류: '+msg+'</div><pre class="mermaid-source"><div class="code-lang">mermaid</div><code class="language-mermaid">'+esc(src)+'</code></pre>';
    }
  }
}
function hydrateMarkdownPreview(root){
  if(!root)return;
  renderMermaidIn(root);
}
function resetMermaidRender(){mermaidRenderToken++;}
function getMarkdownItRenderer(){
  if(markdownItRenderer!==null)return markdownItRenderer||null;
  const factory=window.markdownit||window.MarkdownIt||window.markdownIt;
  if(typeof factory!=='function'){markdownItRenderer=false;return null;}
  try{
    const md=factory({html:false,linkify:true,typographer:false,breaks:false});
    md.validateLink=function(url){return !!safeLinkTarget(url);};
    md.renderer.rules.link_open=function(tokens,idx,options,env,self){
      const token=tokens[idx];
      const hrefIdx=token.attrIndex('href');
      if(hrefIdx>=0){
        const safe=safeLinkTarget(token.attrs[hrefIdx][1]);
        if(safe)token.attrs[hrefIdx][1]=safe;
      }
      token.attrSet('target','_blank');
      token.attrSet('rel','noopener noreferrer');
      return self.renderToken(tokens,idx,options);
    };
    md.renderer.rules.fence=function(tokens,idx){
      const token=tokens[idx];
      const info=String(token.info||'').trim();
      const lang=(info.split(/\s+/)[0]||'').toLowerCase();
      if(lang==='mermaid')return mermaidPlaceholder(token.content||'');
      const label=lang?'<div class="code-lang">'+esc(lang)+'</div>':'';
      const cls=lang?' language-'+escAttr(lang):'';
      return '<pre>'+label+'<code class="hl'+cls+'">'+hl(token.content||'')+'</code></pre>';
    };
    md.renderer.rules.code_block=function(tokens,idx){
      return '<pre><code class="hl">'+hl(tokens[idx].content||'')+'</code></pre>';
    };
    markdownItRenderer=md;
    return markdownItRenderer;
  }catch(e){console.warn('[memoboard] markdown-it init failed; fallback renderer will be used',e);markdownItRenderer=false;return null;}
}
function transformOutsideCode(html,fn){
  const kept=[];
  html=String(html||'').replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>/gi,m=>{
    kept.push(m);
    return '\u0003K'+(kept.length-1)+'\u0003';
  });
  html=fn(html);
  return html.replace(/\u0003K(\d+)\u0003/g,(m,i)=>kept[+i]||'');
}
function enhanceMarkdownHtml(html){
  let taskIdx=0;
  html=String(html||'').replace(/<li>\s*<p>\[( |x|X)\]\s*([\s\S]*?)<\/p>\s*<\/li>/g,(m,mark,body)=>{
    const done=mark!==' ';
    return '<li class="task'+(done?' done':'')+'"><input type="checkbox" data-ti="'+(taskIdx++)+'"'+(done?' checked':'')+'><span>'+body+'</span></li>';
  });
  html=html.replace(/<li>\s*\[( |x|X)\]\s*([\s\S]*?)<\/li>/g,(m,mark,body)=>{
    const done=mark!==' ';
    return '<li class="task'+(done?' done':'')+'"><input type="checkbox" data-ti="'+(taskIdx++)+'"'+(done?' checked':'')+'><span>'+body+'</span></li>';
  });
  return transformOutsideCode(html,body=>body
    .replace(/\[\[([^\]<>\n]+)\]\]/g,(m,t)=>'<a class="wiki" data-t="'+escAttr(t)+'">'+esc(t)+'</a>')
    .replace(/==([^=<>\n]+)==/g,'<mark>$1</mark>')
    .replace(/(^|[\s>])#([0-9A-Za-z가-힣_\-]+)/g,'$1<span class="htag">#$2</span>')
  );
}
function orderedNumberRuns(src){
  const runs=[];
  const lines=String(src||'').split(/\r?\n/);
  let inFence=false,current=null;
  for(const line of lines){
    if(/^```/.test(line.trim())){inFence=!inFence;current=null;continue;}
    if(inFence)continue;
    const m=line.match(/^\s{0,3}(\d+)\.\s+/);
    if(m){
      if(!current){current=[];runs.push(current);}
      current.push(Number(m[1]));
    }else if(line.trim()===''){
      continue;
    }else current=null;
  }
  return runs.filter(r=>r.length);
}
function restoreOrderedListValues(src,html){
  const runs=orderedNumberRuns(src);
  if(!runs.length)return html;
  let runIdx=0;
  return String(html||'').replace(/<ol([^>]*)>([\s\S]*?)<\/ol>/g,(m,attrs,body)=>{
    const nums=runs[runIdx++];
    if(!nums||!nums.length)return m;
    if(nums[0]!==1&&!/\sstart=/.test(attrs))attrs+=' start="'+nums[0]+'"';
    let i=0,expected=nums[0];
    body=body.replace(/<li(?![^>]*\svalue=)([^>]*)>/g,(lm,liAttrs)=>{
      const no=nums[i++];
      let extra='';
      if(Number.isFinite(no)&&no!==expected)extra=' value="'+no+'"';
      expected=Number.isFinite(no)?no+1:expected+1;
      return '<li'+extra+liAttrs+'>';
    });
    return '<ol'+attrs+'>'+body+'</ol>';
  });
}
function markdownItHtml(src){
  const md=getMarkdownItRenderer();
  if(!md)return null;
  let html=md.render(String(src||''));
  html=restoreOrderedListValues(src,html);
  html=enhanceMarkdownHtml(html).trim();
  return html||'<p style="color:var(--sub)">미리볼 내용이 없습니다.</p>';
}
function md2html(src){
  try{
    const html=markdownItHtml(src);
    if(html!==null)return html;
  }catch(e){console.warn('[memoboard] markdown-it render failed; fallback renderer will be used',e);}
  return legacyMd2Html(src);
}
function renderMarkdownPreview(src){return md2html(src);}
function toggleTaskInBody(n,k){
  const lines=n.body.split('\n');let inF=false,c=0;
  for(let i=0;i<lines.length;i++){
    if(/^```/.test(lines[i])){inF=!inF;continue;}
    if(inF)continue;
    const m=lines[i].match(/^(\s*(?:[-*]|\d+\.)\s+\[)( |x|X)(\]\s*.*)/);
    if(m){if(c===k){lines[i]=m[1]+(m[2]===' '?'x':' ')+m[3];n.body=lines.join('\n');return true;}c++;}
  }return false;
}
const MarkdownShortcuts=(()=>{
  function touchInput(t){t.dispatchEvent(new Event('input',{bubbles:true}));}
  function selection(t){return {a:t.selectionStart||0,b:t.selectionEnd||0,text:t.value.slice(t.selectionStart||0,t.selectionEnd||0)};}
  function replace(t,a,b,text){t.value=t.value.slice(0,a)+text+t.value.slice(b);t.selectionStart=a;t.selectionEnd=a+text.length;touchInput(t);}
  function wrap(t,left,right,placeholder){
    const s=selection(t);const body=s.text||placeholder;
    replace(t,s.a,s.b,left+body+right);
    if(!s.text){t.selectionStart=s.a+left.length;t.selectionEnd=t.selectionStart+placeholder.length;}
  }
  function lineBounds(t){
    const a=t.selectionStart||0,b=t.selectionEnd||0;
    const start=t.value.lastIndexOf('\n',Math.max(0,a-1))+1;
    let end=t.value.indexOf('\n',b);if(end<0)end=t.value.length;
    return {start,end,text:t.value.slice(start,end)};
  }
  function prefixLines(t,prefix,stripRe){
    const r=lineBounds(t);
    const lines=r.text.split('\n').map(line=>stripRe&&stripRe.test(line)?line.replace(stripRe,''):prefix+line);
    replace(t,r.start,r.end,lines.join('\n'));
  }
  function heading(t){
    const r=lineBounds(t);
    const lines=r.text.split('\n').map(line=>{
      const m=line.match(/^(#{1,6})\s+(.*)$/);
      if(!m)return '# '+line;
      const lv=m[1].length>=6?1:m[1].length+1;
      return '#'.repeat(lv)+' '+m[2];
    });
    replace(t,r.start,r.end,lines.join('\n'));
  }
  function checklist(t){prefixLines(t,'- [ ] ',/^\s*(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?/);}
  function bullet(t){prefixLines(t,'- ',/^\s*(?:[-*]|\d+\.)\s+/);}
  function ordered(t){
    const r=lineBounds(t);let no=1;
    const lines=r.text.split('\n').map(line=>String(no++)+'. '+line.replace(/^\s*(?:[-*]|\d+\.)\s+/,''));
    replace(t,r.start,r.end,lines.join('\n'));
  }
  function quote(t){prefixLines(t,'> ',/^\s*>\s?/);}
  function codeBlock(t){
    const s=selection(t);const body=s.text||'SELECT *\n  FROM table_name\n WHERE 1=1';
    replace(t,s.a,s.b,'```sql\n'+body+'\n```');
  }
  function link(t){wrap(t,'[','](example.com)','링크명');}
  function table(t){
    const s=selection(t);
    replace(t,s.a,s.b,'| 항목 | 내용 |\n|---|---|\n|  |  |');
  }
  function handle(e){
    const t=e.target;if(!t||t.id!=='edText'||!(e.ctrlKey||e.metaKey)||e.altKey)return false;
    const key=(e.key||'').toLowerCase();
    let fn=null;
    if(!e.shiftKey&&key==='b')fn=()=>wrap(t,'**','**','굵게');
    else if(!e.shiftKey&&key==='i')fn=()=>wrap(t,'*','*','기울임');
    else if(!e.shiftKey&&(key==='`'||e.code==='Backquote'))fn=()=>wrap(t,'`','`','코드');
    else if(e.shiftKey&&key==='x')fn=()=>wrap(t,'~~','~~','취소선');
    else if(e.shiftKey&&key==='h')fn=()=>heading(t);
    else if(e.shiftKey&&key==='k')fn=()=>checklist(t);
    else if(e.shiftKey&&key==='8')fn=()=>bullet(t);
    else if(e.shiftKey&&key==='7')fn=()=>ordered(t);
    else if(e.shiftKey&&key==='q')fn=()=>quote(t);
    else if(e.shiftKey&&key==='c')fn=()=>codeBlock(t);
    else if(e.shiftKey&&key==='l')fn=()=>link(t);
    else if(e.shiftKey&&key==='t')fn=()=>table(t);
    if(!fn)return false;
    e.preventDefault();e.stopPropagation();fn();return true;
  }
  return {handle,help:MARKDOWN_HELP};
})();
window.MBMarkdown=Object.assign(window.MBMarkdown||{}, {
  render:renderMarkdownPreview,
  hydrate:hydrateMarkdownPreview,
  renderMermaidIn:renderMermaidIn,
  resetMermaid:resetMermaidRender,
  shortcuts:MarkdownShortcuts,
  help:MARKDOWN_HELP,
  engine:()=>getMarkdownItRenderer()?'markdown-it':'legacy-fallback',
  mermaid:()=>getMermaidRenderer()?'mermaid':'unavailable'
});
