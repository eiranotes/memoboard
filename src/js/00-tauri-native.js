"use strict";
/* ================= Tauri native bridge =================
   Provides the same window.memoboardNative surface used by the Electron build.
   Keep this file first in index.html script order. */
(function(){
  const tauri = window.__TAURI__;
  const core = tauri && tauri.core;
  if(!core || typeof core.invoke !== 'function') return;
  const invoke = (cmd, payload) => core.invoke(cmd, payload || {});
  const listen = (eventName, handler) => {
    if(!tauri.event || typeof tauri.event.listen !== 'function' || typeof handler !== 'function') return Promise.resolve(()=>{});
    return tauri.event.listen(eventName, (event) => handler(event && event.payload ? event.payload : {}));
  };
  window.memoboardNative = Object.freeze({
    available: true,
    runtime: 'tauri',
    getEnv: () => invoke('get_env'),
    getBackupConfig: () => invoke('get_backup_config'),
    pickBackupDir: (options) => invoke('pick_backup_dir', { options: options || {} }),
    setBackupOptions: (options) => invoke('set_backup_options', { options: options || {} }),
    disableBackup: () => invoke('disable_backup'),
    writeBackup: (payload, options) => invoke('write_backup', { payload, options: options || {} }),
    exportJson: (payload, suggestedName) => invoke('export_json', { payload, suggested_name: suggestedName }),
    importJson: () => invoke('import_json'),
    exportMarkdownFolder: (payload) => invoke('export_markdown_folder', { request: payload || {} }),
    importMarkdownFolder: () => invoke('import_markdown_folder'),
    openPath: (targetPath) => invoke('open_path', { target_path: targetPath }),
    minimizeWindow: () => invoke('window_minimize'),
    toggleMaximizeWindow: () => invoke('window_toggle_maximize'),
    closeWindow: () => invoke('window_close'),
    startWindowDrag: () => invoke('window_start_drag'),
    setAlwaysOnTop: (enabled) => invoke('window_set_always_on_top', { enabled: !!enabled }),
    setWindowOpacity: (opacity) => invoke('window_set_opacity', { opacity }),
    getWindowState: () => invoke('window_get_state'),
    setMinimizeToTray: (enabled) => invoke('tray_set_minimize_to_tray', { enabled: !!enabled }),
    hideToTray: () => invoke('tray_hide_to_tray'),
    showQuickNote: () => invoke('quick_note_show'),
    setMiniMode: (enabled) => invoke('window_set_mini_mode', { enabled: !!enabled }),
    listBackups: () => invoke('list_backups'),
    readBackup: (filePath) => invoke('read_backup', { file_path: filePath }),
    getSharedConfig: () => invoke('get_shared_config'),
    pickSharedDir: (options) => invoke('pick_shared_dir', { options: options || {} }),
    setSharedOptions: (options) => invoke('set_shared_options', { options: options || {} }),
    sharedLoadBoard: () => invoke('shared_load_board'),
    sharedInspectBoard: () => invoke('shared_inspect_board'),
    sharedUpdateManifest: (request) => invoke('shared_update_manifest', { request: request || {} }),
    sharedSaveNote: (request) => invoke('shared_save_note', { request: request || {} }),
    sharedDeleteNote: (request) => invoke('shared_delete_note', { request: request || {} }),
    sharedAcquireLock: (request) => invoke('shared_acquire_lock', { request: request || {} }),
    sharedRenewLock: (request) => invoke('shared_renew_lock', { request: request || {} }),
    sharedReleaseLock: (request) => invoke('shared_release_lock', { request: request || {} }),
    sharedCompactBoard: (request) => invoke('shared_compact_board', { request: request || {} }),
    onWindowState: (handler) => listen('memoboard:window-state', handler),
    onQuickNote: (handler) => listen('memoboard:quick-note', handler),
    onFocus: (handler) => listen('memoboard:focus', handler)
  });
})();
