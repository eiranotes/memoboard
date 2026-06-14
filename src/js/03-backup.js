'use strict';
/* ================= backup manager (manual export + browser/desktop auto backup) ================= */
const BackupManager=(()=>{
  let dirHandle=null, timer=null, busy=false, nativeConfig=null;
  const native=()=>!!(window.memoboardNative&&window.memoboardNative.available);
  const supported=()=>native()||!!window.showDirectoryPicker&&!useLS;
  function patchBackup(patch){
    if(window.MBStore&&StoreService.setBackupPatch)StoreService.setBackupPatch(patch);
    else Object.assign(meta,patch||{});
  }
  const payload=(type)=>({
    app:'memoboard',version:BACKUP_FORMAT_VERSION,backupType:type||'auto',exportedAt:new Date().toISOString(),
    meta:exportMeta(),notes
  });
  const snapshotName=()=>{
    const d=new Date();
    const pad=n=>String(n).padStart(2,'0');
    return 'memoboard-snapshot-'+d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+'.json';
  };
  async function load(){
    if(native()){
      try{
        nativeConfig=await window.memoboardNative.getBackupConfig();
        patchBackup({autoBackupEnabled:!!(nativeConfig&&nativeConfig.enabled&&nativeConfig.backupDir),autoBackupSnapshots:!!(nativeConfig&&nativeConfig.snapshotEnabled)});
      }catch(e){
        console.warn('[memoboard] native backup config load failed',e);
        patchBackup({autoBackupEnabled:false});
      }
      return;
    }
    dirHandle=await handleGet('autoBackupDir');
    if(!dirHandle)patchBackup({autoBackupEnabled:false});
  }
  async function permission(handle,mode){
    if(!handle)return false;
    const opt={mode:mode||'readwrite'};
    try{
      if(handle.queryPermission&&await handle.queryPermission(opt)==='granted')return true;
      if(handle.requestPermission&&await handle.requestPermission(opt)==='granted')return true;
    }catch(e){}
    return false;
  }
  async function writeNative(reason,opts){
    if(!meta.autoBackupEnabled){if(opts.toast)toast('자동 백업 폴더가 지정되지 않았습니다');return false;}
    const shouldSnapshot=!!(meta.autoBackupSnapshots&&Date.now()-(Number(meta.lastSnapshotBackupAt)||0)>=AUTO_BACKUP_SNAPSHOT_INTERVAL);
    const result=await window.memoboardNative.writeBackup(payload(shouldSnapshot?'snapshot':'auto'),{
      reason:reason||'auto',snapshot:shouldSnapshot
    });
    if(!result||!result.ok)throw new Error(result&&result.error?result.error:'native backup failed');
    patchBackup(Object.assign({lastAutoBackupAt:Date.now(),lastAutoBackupErrorAt:0,changeCountSinceAutoBackup:0},shouldSnapshot?{lastSnapshotBackupAt:Date.now()}:{}));
    nativeConfig=Object.assign({},nativeConfig||{},result.config||{});
    await metaSave({silent:true});
    updateStorageInfo();
    if(opts.toast)toast('자동 백업 저장 완료: '+(result.fileName||AUTO_BACKUP_FILE));
    return true;
  }
  async function writeBrowser(reason,opts){
    if(!meta.autoBackupEnabled||!dirHandle){if(opts.toast)toast('자동 백업 폴더가 지정되지 않았습니다');return false;}
    if(!await permission(dirHandle,'readwrite'))throw new Error('backup folder permission denied');
    const file=await dirHandle.getFileHandle(AUTO_BACKUP_FILE,{create:true});
    const writable=await file.createWritable();
    await writable.write(JSON.stringify(payload('auto'),null,1));
    await writable.close();
    if(meta.autoBackupSnapshots&&Date.now()-(Number(meta.lastSnapshotBackupAt)||0)>=AUTO_BACKUP_SNAPSHOT_INTERVAL){
      const snap=await dirHandle.getFileHandle(snapshotName(),{create:true});
      const sw=await snap.createWritable();
      await sw.write(JSON.stringify(payload('snapshot'),null,1));
      await sw.close();
      patchBackup({lastSnapshotBackupAt:Date.now()});
    }
    patchBackup({lastAutoBackupAt:Date.now(),lastAutoBackupErrorAt:0,changeCountSinceAutoBackup:0});
    await metaSave({silent:true});
    updateStorageInfo();
    if(opts.toast)toast('자동 백업 저장 완료: '+AUTO_BACKUP_FILE);
    return true;
  }
  async function write(reason,opts){
    opts=opts||{};
    if(busy)return false;
    busy=true;
    try{
      return native()?await writeNative(reason,opts):await writeBrowser(reason,opts);
    }catch(e){
      console.error('[memoboard] auto backup failed',e);
      patchBackup({lastAutoBackupErrorAt:Date.now()});
      await metaSave({silent:true});
      if(opts.toast||Date.now()-(meta.lastBackupNudgeAt||0)>BACKUP_NUDGE_COOLDOWN){
        patchBackup({lastBackupNudgeAt:Date.now()});
        toast('자동 백업 실패: 폴더 권한을 다시 지정하세요',setup,'폴더 지정');
      }
      return false;
    }finally{busy=false;}
  }
  function onDataWrite(){
    if(!meta.autoBackupEnabled)return;
    if(!native()&&!dirHandle)return;
    const since=Date.now()-(Number(meta.lastAutoBackupAt)||0);
    const changes=Number(meta.changeCountSinceAutoBackup)||0;
    if(changes<AUTO_BACKUP_MIN_CHANGES&&since<AUTO_BACKUP_MIN_INTERVAL)return;
    clearTimeout(timer);
    timer=setTimeout(()=>write('auto'),AUTO_BACKUP_DEBOUNCE);
  }
  async function setup(){
    if(native()){
      try{
        const res=await window.memoboardNative.pickBackupDir({snapshotEnabled:!!meta.autoBackupSnapshots});
        if(!res||!res.ok)return;
        nativeConfig=res.config||res;
        patchBackup({autoBackupEnabled:!!nativeConfig.backupDir,autoBackupSnapshots:!!nativeConfig.snapshotEnabled,changeCountSinceAutoBackup:Number(meta.changeCountSinceAutoBackup)||0});
        await metaSave({silent:true});
        updateStorageInfo();
        await write('setup',{toast:true});
      }catch(e){console.error('[memoboard] native auto backup setup failed',e);toast('자동 백업 폴더 지정 실패');}
      return;
    }
    if(!window.showDirectoryPicker){toast('이 브라우저는 자동 백업 폴더 지정을 지원하지 않습니다. Chrome/Edge에서 사용하세요.');return;}
    if(useLS){toast('IndexedDB를 사용할 수 없어 자동 백업 폴더를 저장할 수 없습니다');return;}
    try{
      const handle=await window.showDirectoryPicker({mode:'readwrite'});
      if(!await permission(handle,'readwrite')){toast('자동 백업 폴더 권한이 허용되지 않았습니다');return;}
      await handlePut('autoBackupDir',handle);
      dirHandle=handle;
      patchBackup({autoBackupEnabled:true,changeCountSinceAutoBackup:Number(meta.changeCountSinceAutoBackup)||0});
      await metaSave({silent:true});
      updateStorageInfo();
      await write('setup',{toast:true});
    }catch(e){
      if(e&&e.name==='AbortError')return;
      console.error('[memoboard] auto backup setup failed',e);
      toast('자동 백업 폴더 지정 실패');
    }
  }
  async function runNow(){
    if(!meta.autoBackupEnabled||(!native()&&!dirHandle)){await setup();return;}
    await write('manual',{toast:true});
  }
  async function toggleSnapshot(){
    patchBackup({autoBackupSnapshots:!meta.autoBackupSnapshots});
    if(native()){
      try{nativeConfig=await window.memoboardNative.setBackupOptions({enabled:!!meta.autoBackupEnabled,snapshotEnabled:!!meta.autoBackupSnapshots});}
      catch(e){console.warn('[memoboard] native backup option update failed',e);}
    }
    await metaSave({silent:true});
    updateStorageInfo();
    toast(meta.autoBackupSnapshots?'자동 백업 스냅샷을 켰습니다':'자동 백업 스냅샷을 껐습니다');
    if(meta.autoBackupSnapshots&&meta.autoBackupEnabled)await write('snapshot-toggle',{toast:true});
  }
  async function disable(){
    clearTimeout(timer);
    dirHandle=null;
    patchBackup({autoBackupEnabled:false,changeCountSinceAutoBackup:0});
    if(native()){
      try{nativeConfig=await window.memoboardNative.disableBackup();}catch(e){console.warn('[memoboard] native backup disable failed',e);}
    }else{
      await handleDelete('autoBackupDir');
    }
    await metaSave();
    updateStorageInfo();
    toast('자동 백업을 해제했습니다');
  }

  function health(){
    const liveCount=notes.filter(n=>!n.deletedAt).length;
    const changes=Number(meta.changeCountSinceBackup)||0;
    const days=daysSince(Number(meta.lastBackupAt)||0);
    const autoEnabled=!!meta.autoBackupEnabled;
    const autoError=!!meta.lastAutoBackupErrorAt;
    const autoAge=daysSince(Number(meta.lastAutoBackupAt)||0);
    if(!liveCount)return {level:'ok',label:'백업 상태 정상',detail:'아직 보존할 메모가 없습니다'};
    if(autoError)return {level:'bad',label:'자동백업 오류',detail:'자동백업 폴더 권한을 다시 지정하세요'};
    if(!autoEnabled&&days===Infinity)return {level:'bad',label:'백업 없음',detail:'자동백업 폴더 지정 또는 JSON 내보내기를 권장합니다'};
    if(!autoEnabled&&(days>=BACKUP_WARN_DAYS||changes>=BACKUP_WARN_CHANGES))return {level:'warn',label:'백업 권장',detail:'최근 수정이 쌓였습니다. 수동 백업 또는 자동백업을 켜세요'};
    if(autoEnabled&&autoAge>=2)return {level:'warn',label:'자동백업 대기',detail:'최근 자동백업이 오래되었습니다. 지금 실행을 권장합니다'};
    return {level:'ok',label:'백업 상태 정상',detail:autoEnabled?'자동백업이 켜져 있습니다':'최근 수동 백업이 있습니다'};
  }
  function statusText(){
    if(native()){
      if(!meta.autoBackupEnabled)return '꺼짐(데스크톱)';
      if(meta.lastAutoBackupErrorAt)return '오류(데스크톱)';
      const snap=meta.autoBackupSnapshots?' +스냅샷':'';
      return (meta.lastAutoBackupAt?'켜짐(데스크톱) '+relTime(meta.lastAutoBackupAt):'켜짐(데스크톱)')+snap;
    }
    if(!window.showDirectoryPicker)return '미지원';
    if(useLS)return '불가(localStorage)';
    if(!meta.autoBackupEnabled)return '꺼짐';
    if(meta.lastAutoBackupErrorAt)return '오류';
    const snap=meta.autoBackupSnapshots?' +스냅샷':'';
    return (meta.lastAutoBackupAt?'켜짐 '+relTime(meta.lastAutoBackupAt):'켜짐')+snap;
  }
  window.addEventListener('beforeunload',()=>{if(timer)clearTimeout(timer);});
  return {init:load,onDataWrite,setup,runNow,toggleSnapshot,disable,statusText,supported,health};
})();
window.MBBackup=BackupManager;
