'use strict';
/* ================= init ================= */
async function init(){
  DesktopWindowManager.init();
  try{DB=await idbOpen();}catch(e){useLS=true;}
  setupMultiTabSync();
  const m=await metaLoad();if(m)Object.assign(meta,m);sanitizeMeta();
  document.documentElement.dataset.theme=(window.MBStore&&StoreService.theme?StoreService.theme():meta.theme);
  DesktopWindowManager.applyPrefs();
  notes=(await dbAll()).map(normalizeNote);
  await BackupManager.init();
  if(window.SharedBoard)await SharedBoard.init();
  if((window.MBStore&&StoreService.workspace?StoreService.workspace():meta.workspace)==='shared'&&window.SharedBoard){
    if(SharedBoard.state.configured){await SharedBoard.refresh(true);notes=SharedBoard.currentNotes();}
    else {if(window.MBStore&&StoreService.setWorkspace)StoreService.setWorkspace('personal');else meta.workspace='personal';await metaSave({silent:true});}
  }
  /* purge trash > 30d */
  const cut=Date.now()-30*864e5;
  notes.filter(n=>n.deletedAt&&n.deletedAt<cut).forEach(n=>removeStoredNote(n.id,{skipRender:true}));
  notes=notes.filter(n=>!(n.deletedAt&&n.deletedAt<cut));
  updateStorageInfo();
  if((window.MBStore&&StoreService.workspace?StoreService.workspace():meta.workspace)!=='shared'&&!notes.length){
    const demo=newNote({title:'메모보드에 오신 걸 환영합니다 👋',pinned:true,color:2,tags:['시작하기'],
      body:'자주 보는 메모는 **고정**해 두면 항상 맨 위에 표시됩니다.\n\n## 빠른 시작\n- [ ] `Alt+N` 으로 새 메모 만들기\n- [ ] `Ctrl+K` 팔레트로 점프하기\n- [ ] 카드에 마우스를 올려 ↕ 크기 바꿔보기\n- [ ] 메모를 5개 구역 사이로 드래그해 보기\n- [ ] 달력 탭에서 날짜를 클릭해 업무/회의/약속 아이콘으로 일정 적기\n\n#태그 는 본문에 쓰면 자동으로 수집됩니다.\n[[SQL 모음]] 처럼 위키링크로 메모를 연결할 수 있어요.\n\n> 백업: 우측 상단 ⋯ → JSON 내보내기'});
    notes.push(demo);persistNote(demo,{skipRender:true});}
  render();checkReminders();maybeSuggestBackup(false);}
init();
