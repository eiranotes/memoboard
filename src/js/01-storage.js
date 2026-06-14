'use strict';
/* ================= storage (IndexedDB + localStorage fallback) ================= */
let DB=null, useLS=false;
function idbOpen(){return new Promise((res,rej)=>{
  let r; try{ r=indexedDB.open('memoboard',3); }catch(e){ return rej(e); }
  r.onupgradeneeded=e=>{const d=e.target.result;
    if(!d.objectStoreNames.contains('notes'))d.createObjectStore('notes',{keyPath:'id'});
    if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
    if(!d.objectStoreNames.contains('handles'))d.createObjectStore('handles');};
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
});}
function dbPut(n,opts){
  opts=Object.assign({entityId:n&&n.id,entityUpdatedAt:n&&n.updatedAt},opts||{});
  const work=useLS?lsFlush({silent:true}):new Promise((res,rej)=>{try{const r=DB.transaction('notes','readwrite').objectStore('notes').put(n);r.onsuccess=res;r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
  return work.then(()=>afterDataWrite('note',opts)).catch(reportSaveError);
}
function dbPutMany(arr,opts){
  opts=Object.assign({entityId:null,bulkCount:Array.isArray(arr)?arr.length:0},opts||{});
  const work=useLS?lsFlush({silent:true}):new Promise((res,rej)=>{
    try{
      const tx=DB.transaction('notes','readwrite');
      const st=tx.objectStore('notes');
      arr.forEach(n=>st.put(n));
      tx.oncomplete=()=>res();
      tx.onerror=()=>rej(tx.error);
    }catch(e){rej(e);}
  });
  return work.then(()=>afterDataWrite('notes',opts)).catch(reportSaveError);
}
function dbDelete(id,opts){
  opts=Object.assign({entityId:id},opts||{});
  const work=useLS?lsFlush({silent:true}):new Promise((res,rej)=>{try{const r=DB.transaction('notes','readwrite').objectStore('notes').delete(id);r.onsuccess=res;r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
  return work.then(()=>afterDataWrite('delete',opts)).catch(reportSaveError);
}
function dbAll(){if(useLS){try{return Promise.resolve(JSON.parse(localStorage.getItem('mb-notes')||'[]'));}catch(e){return Promise.resolve([]);}}
  return new Promise(res=>{const r=DB.transaction('notes','readonly').objectStore('notes').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>res([]);});}
function dbGet(id){if(useLS){try{return Promise.resolve((JSON.parse(localStorage.getItem('mb-notes')||'[]')||[]).find(n=>n.id===id)||null);}catch(e){return Promise.resolve(null);}}
  return new Promise(res=>{try{const r=DB.transaction('notes','readonly').objectStore('notes').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);}catch(e){res(null);}});}
function metaSave(opts){
  opts=opts||{};
  if(window.MBStore&&StoreService.normalize)StoreService.normalize();
  const persisted=(window.MBStore&&StoreService.persistable)?StoreService.persistable():meta;
  const work=useLS?new Promise((res,rej)=>{try{localStorage.setItem('mb-meta',JSON.stringify(persisted));res();}catch(e){rej(e);}}):new Promise((res,rej)=>{try{const r=DB.transaction('meta','readwrite').objectStore('meta').put(persisted,'meta');r.onsuccess=res;r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
  return work.then(()=>{if(!opts.silent)broadcastStorageChange('meta');return true;}).catch(reportSaveError);
}
function metaLoad(){if(useLS){try{return Promise.resolve(JSON.parse(localStorage.getItem('mb-meta')||'null'));}catch(e){return Promise.resolve(null);}}
  return new Promise(res=>{try{const r=DB.transaction('meta','readonly').objectStore('meta').get('meta');r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);}catch(e){res(null);}});}
function handleGet(key){if(useLS||!DB)return Promise.resolve(null);return new Promise(res=>{try{const r=DB.transaction('handles','readonly').objectStore('handles').get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);}catch(e){res(null);}});}
function handlePut(key,val){if(useLS||!DB)return Promise.reject(new Error('IndexedDB handle store unavailable'));return new Promise((res,rej)=>{try{const r=DB.transaction('handles','readwrite').objectStore('handles').put(val,key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
function handleDelete(key){if(useLS||!DB)return Promise.resolve();return new Promise((res,rej)=>{try{const r=DB.transaction('handles','readwrite').objectStore('handles').delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
function lsFlush(opts){return new Promise((res,rej)=>{try{localStorage.setItem('mb-notes',JSON.stringify(notes));res();}catch(e){rej(e);}}).then(()=>{if(!(opts&&opts.silent))return afterDataWrite('notes',opts);return true;});}
