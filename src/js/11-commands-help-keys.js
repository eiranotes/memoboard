'use strict';
/* ================= command palette ================= */
let palSel=0;
function palCommands(){return [
  ['＋ 새 메모','Alt+N',()=>quickNew()],
  ['메모 뷰로','1',()=>setView('memo')],
  ['달력 뷰로','2',()=>setView('cal')],
  ['설정 / 도움말','3',()=>setView('settings')],
  ['개인 작업함으로 전환','',()=>SharedBoard&&SharedBoard.switchWorkspace('personal')],
  ['공유 작업함으로 전환','',()=>SharedBoard&&SharedBoard.switchWorkspace('shared')],
  ['주간 달력으로','',()=>{if(window.MBStore&&StoreService.setCalMode)StoreService.setCalMode('week');else meta.calMode='week';setView('cal');}],
  [(window.MBStore&&StoreService.theme?StoreService.theme():meta.theme)==='light'?'다크 테마':'라이트 테마','',()=>$('#themeBtn').click()],
  ['전체 제목만 보기','Alt+1',()=>bulkSetSize('title')],
  ['전체 작게 보기','Alt+2',()=>bulkSetSize('small')],
  ['전체 보통 보기','Alt+3',()=>bulkSetSize('normal')],
  ['전체 크게 보기','Alt+4',()=>bulkSetSize('large')],
  ['체크리스트 유형만 보기','',()=>{filter.kind='task';setView('memo');}],
  ['회의만 보기','',()=>{filter.kind='meeting';setView('memo');}],
  ['마감만 보기','',()=>{filter.kind='deadline';setView('memo');}],
  ['오늘 패널','',()=>{filter.smart='today';setView('memo');}],
  ['빠른 메모 입력','Ctrl+Shift+M',()=>QuickMemo.open()],
  ['백업 복구 센터','',()=>RestoreCenter.open()],
  ['템플릿 관리자','',()=>TemplateManager.open()],
  ['미니 플로팅 모드','',()=>DesktopWindowManager.toggleMiniMode()],
  ['트레이로 숨기기','',()=>DesktopWindowManager.hideToTray()],
  ['JSON 내보내기 (백업)','',exportJSON],
  ['JSON 가져오기','',()=>$('#impFile').click()],
  ['휴지통 열기','',()=>{filter.smart='trash';render();}],
  ['필터 초기화','',()=>{filter={q:'',tag:null,color:null,smart:'all',folder:null,due:null,zone:null,kind:null};$('#q').value='';render();}],
  ['단축키 도움말','?',openHelp]];}
function openPal(){$('#palWrap').classList.add('open');$('#palInput').value='';palSel=0;renderPal();$('#palInput').focus();}
function closePal(){$('#palWrap').classList.remove('open');}
function palItems(){
  const q=$('#palInput').value.trim();
  const cmds=palCommands().map((c,i)=>({type:'cmd',i,label:c[0],k:c[1],fn:c[2]}))
    .filter(c=>!q||fuzzy(q,c.label)||(isChoQ(q)&&choseong(c.label).includes(q)));
  const ns=liveNotes().filter(n=>!q||matchNote(n,q)||fuzzy(q,dispTitle(n)))
    .sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,12)
    .map(n=>({type:'note',id:n.id,label:dispTitle(n),sub:stripMd(n.body).slice(0,60),color:n.color}));
  return q?[...ns,...cmds]:[...cmds.slice(0,5),...ns];}
function renderPal(){
  const items=palItems();
  if(palSel>=items.length)palSel=Math.max(0,items.length-1);
  let h='',lastType='';
  items.forEach((it,idx)=>{
    if(it.type!==lastType){h+='<div class="palhead">'+(it.type==='note'?'메모':'명령')+'</div>';lastType=it.type;}
    h+='<div class="palitem'+(idx===palSel?' sel':'')+'" data-idx="'+idx+'">'+
      (it.type==='note'?'<span class="dot" style="background:var(--c'+it.color+'s)"></span>':'<span style="opacity:.6">▸</span>')+
      '<span>'+esc(it.label)+'</span>'+
      (it.sub?'<span class="sub">'+esc(it.sub)+'</span>':'')+
      (it.k?'<span class="k">'+it.k+'</span>':'')+'</div>';});
  $('#palList').innerHTML=h||'<div class="empty" style="padding:30px"><b>결과 없음</b></div>';
  const sel=$('#palList .palitem.sel');if(sel&&sel.scrollIntoView)sel.scrollIntoView({block:'nearest'});}
function palRun(idx){
  const it=palItems()[idx];if(!it)return;
  closePal();
  if(it.type==='note')openEditor(it.id);else it.fn();}
$('#palInput').addEventListener('input',()=>{palSel=0;renderPal();});
$('#palInput').addEventListener('keydown',e=>{
  const items=palItems();
  if(e.key==='ArrowDown'){e.preventDefault();palSel=Math.min(items.length-1,palSel+1);renderPal();}
  if(e.key==='ArrowUp'){e.preventDefault();palSel=Math.max(0,palSel-1);renderPal();}
  if(e.key==='Enter'){e.preventDefault();palRun(palSel);}});
$('#palList').addEventListener('click',e=>{
  const it=e.target.closest('.palitem');if(it)palRun(+it.dataset.idx);});
$('#palWrap').addEventListener('mousedown',e=>{if(e.target===$('#palWrap'))closePal();});

/* ================= help ================= */
function openHelp(){
  const rows=[['Alt + N','새 메모'],['Ctrl + K','명령 팔레트 / 메모 점프'],['Ctrl + 1 · 2 · 3','메모 / 달력 / 설정 탭'],['개인/공유 토글','상단 토글 또는 명령 팔레트로 데이터 소스 전환'],['Alt + 1 · 2 · 3 · 4','전체 카드 크기: 제목만 · 작게 · 보통 · 크게'],['/','검색창 포커스'],
    ['드래그','메모 카드 이동 · 달력 일정 날짜 이동 · 좌측 카테고리 순서 변경'],['Ctrl + Shift + M','전역 빠른 메모 입력창'],['📍/투명도/미니','항상 최상단 · 창 투명도 · 미니 플로팅'],['⋯ 메뉴','트레이 숨김 · 복구 센터 · 템플릿 관리자 · 자동 백업'],
    ['?','이 도움말'],['Esc','에디터 취소/닫기'],['Ctrl + S','(에디터) 즉시 저장'],['Tab','(에디터) 들여쓰기'],
    ['','— 검색 연산자 —'],['tag:업무 folder:프로젝트 kind:task priority:high'],['due:today · due:week · due:overdue · date:today · before:2026-07-01'],['title:회의 body:SQL · is:done · is:pinned · is:locked · is:archived'],
    ['','— 마크다운 문법 —'],['# 제목 · ## 소제목 · --- 구분선'],['**굵게** · *기울임* · ~~취소~~ · ==형광펜== · `인라인 코드`'],['- [ ] 체크리스트 · - 목록 · 1. 번호 목록 · > 인용문'],['```sql 코드블록``` · [링크](example.com) · [[위키링크]] · | 표 |'],
    ['','— 에디터 전용 마크다운 단축키 —'],['Ctrl+B / Ctrl+I / Ctrl+`','굵게 · 기울임 · 인라인 코드'],['Ctrl+Shift+X / H / K','취소선 · 제목 · 체크리스트'],['Ctrl+Shift+7 / 8 / Q','번호 목록 · 불릿 목록 · 인용문'],['Ctrl+Shift+C / L / T','코드블록 · 링크 · 표']];
  $('#helpBody').innerHTML=rows.map(r=>r.length===2
    ?'<div class="kbdrow"><kbd>'+r[0]+'</kbd><span>'+r[1]+'</span></div>'
    :'<div class="kbdrow"><span>'+r[0]+'</span></div>').join('');
  $('#helpWrap').classList.add('open');}
$$('.ovl [data-close]').forEach(b=>b.onclick=()=>b.closest('.ovl').classList.remove('open'));
$$('#helpWrap,#histWrap,#restoreWrap,#tplWrap').forEach(w=>w.addEventListener('mousedown',e=>{if(e.target===w)w.classList.remove('open');}));

/* ================= global keys ================= */
document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if(e.key==='Escape'){
    if($('#palWrap').classList.contains('open')){closePal();return;}
    if($('#histWrap').classList.contains('open')){$('#histWrap').classList.remove('open');return;}
    if($('#helpWrap').classList.contains('open')){$('#helpWrap').classList.remove('open');return;}
    if($('#quickWrap').classList.contains('open')){QuickMemo.close();return;}
    if($('#restoreWrap').classList.contains('open')){$('#restoreWrap').classList.remove('open');return;}
    if($('#tplWrap').classList.contains('open')){$('#tplWrap').classList.remove('open');return;}
    if($('#edWrap').classList.contains('open')){if(window.MBEditor&&MBEditor.cancel)MBEditor.cancel();else closeEditor();return;}
    if(filter.q){filter.q='';$('#q').value='';render();return;}}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPal();return;}
  if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='m'){e.preventDefault();QuickMemo.open();return;}
  if(e.altKey&&e.key.toLowerCase()==='n'){e.preventDefault();quickNew();return;}
  if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&['1','2','3','4'].includes(e.key)){e.preventDefault();applySizeShortcut(SIZE_ORDER[Number(e.key)-1]);return;}
  if((e.ctrlKey||e.metaKey)&&['1','2','3'].includes(e.key)){e.preventDefault();setView(e.key==='1'?'memo':e.key==='2'?'cal':'settings');return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&$('#edWrap').classList.contains('open')){
    e.preventDefault();saveEditorManual(false);return;}
  if(typing)return;
  if(e.key==='/'){e.preventDefault();$('#q').focus();}
  if(e.key==='?')openHelp();});

/* ================= toast ================= */
function toast(msg,actionFn,actionLabel){
  const el=document.createElement('div');el.className='toast';
  el.innerHTML='<span>'+esc(msg)+'</span>'+(actionFn?'<button>'+(actionLabel||'실행 취소')+'</button>':'');
  if(actionFn)el.querySelector('button').onclick=()=>{actionFn();el.remove();};
  $('#toasts').appendChild(el);
  setTimeout(()=>el.remove(),actionFn?6000:3000);}
