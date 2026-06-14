#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}, process::Command};
use tauri::{Emitter, Manager, WebviewWindow, WindowEvent};

const APP_NAME: &str = "Memoboard";
const AUTO_BACKUP_FILE: &str = "memoboard-autobackup.json";
const CONFIG_FILE: &str = "desktop-config.json";

#[derive(Clone)]
struct AppState {
  app_data_dir: PathBuf,
  config_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct DesktopConfig {
  enabled: bool,
  backup_dir: String,
  shared_dir: String,
  shared_display_name: String,
  snapshot_enabled: bool,
  last_backup_path: String,
  last_snapshot_path: String,
  always_on_top: bool,
  window_opacity: f64,
  minimize_to_tray: bool,
  mini_mode: bool,
  normal_bounds: Option<Value>,
  quick_note_shortcut: String,
  updated_at: Option<String>,
}

impl Default for DesktopConfig {
  fn default() -> Self {
    Self {
      enabled: false,
      backup_dir: String::new(),
      shared_dir: String::new(),
      shared_display_name: String::new(),
      snapshot_enabled: false,
      last_backup_path: String::new(),
      last_snapshot_path: String::new(),
      always_on_top: false,
      window_opacity: 1.0,
      minimize_to_tray: false,
      mini_mode: false,
      normal_bounds: None,
      quick_note_shortcut: "CommandOrControl+Shift+M".to_string(),
      updated_at: None,
    }
  }
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct BackupOptions {
  enabled: Option<bool>,
  snapshot_enabled: Option<bool>,
  snapshot: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SharedOptions {
  display_name: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SharedSaveRequest {
  note: Value,
  expected_updated_at: Option<u64>,
  lock_token: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SharedDeleteRequest {
  id: String,
  expected_updated_at: Option<u64>,
  author: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SharedLockRequest {
  id: String,
  owner: Option<String>,
  token: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowStatePayload {
  is_maximized: bool,
  is_full_screen: bool,
  is_always_on_top: bool,
  opacity: f64,
  native_opacity_supported: bool,
  mini_mode: bool,
  minimize_to_tray: bool,
}

fn now_iso() -> String {
  // Compact dependency-free timestamp. Exact ISO is not required for app logic.
  format!("{}", chrono_like_now_ms())
}

fn chrono_like_now_ms() -> u128 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis()
}

fn app_data_dir() -> PathBuf {
  dirs::data_dir()
    .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    .join(APP_NAME)
}

fn ensure_dir(dir: &Path) -> Result<(), String> {
  fs::create_dir_all(dir).map_err(|e| e.to_string())
}

fn read_json<T: for<'de> Deserialize<'de> + Default>(path: &Path) -> T {
  fs::read_to_string(path)
    .ok()
    .and_then(|raw| serde_json::from_str::<T>(&raw).ok())
    .unwrap_or_default()
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
  if let Some(parent) = path.parent() { ensure_dir(parent)?; }
  let tmp = path.with_extension(format!("tmp-{}", chrono_like_now_ms()));
  let raw = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
  fs::write(&tmp, raw).map_err(|e| e.to_string())?;
  fs::rename(&tmp, path).map_err(|e| e.to_string())?;
  Ok(())
}

impl AppState {
  fn new() -> Self {
    let dir = app_data_dir();
    let config_path = dir.join(CONFIG_FILE);
    Self { app_data_dir: dir, config_path }
  }
  fn load_config(&self) -> DesktopConfig { read_json(&self.config_path) }
  fn save_config(&self, mut cfg: DesktopConfig) -> Result<DesktopConfig, String> {
    cfg.updated_at = Some(now_iso());
    write_json(&self.config_path, &serde_json::to_value(&cfg).map_err(|e| e.to_string())?)?;
    Ok(cfg)
  }
}

fn clamp_opacity(value: f64) -> f64 {
  if value.is_finite() { value.max(0.55).min(1.0) } else { 1.0 }
}

fn safe_file_name(name: &str) -> String {
  let cleaned: String = name.chars().map(|ch| match ch {
    '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
    _ => ch,
  }).collect();
  let compact = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
  let trimmed = compact.trim();
  if trimmed.is_empty() { "untitled".to_string() } else { trimmed.chars().take(120).collect() }
}

fn snapshot_name() -> String {
  format!("memoboard-snapshot-{}.json", chrono_like_now_ms())
}


fn shared_notes_dir(root: &Path) -> PathBuf { root.join("notes") }
fn shared_locks_dir(root: &Path) -> PathBuf { root.join("locks") }
fn shared_trash_dir(root: &Path) -> PathBuf { root.join("trash") }
fn shared_manifest_path(root: &Path) -> PathBuf { root.join("manifest.json") }

fn ensure_shared_layout(root: &Path) -> Result<(), String> {
  ensure_dir(root)?;
  ensure_dir(&shared_notes_dir(root))?;
  ensure_dir(&shared_locks_dir(root))?;
  ensure_dir(&shared_trash_dir(root))?;
  let manifest = shared_manifest_path(root);
  if !manifest.exists() {
    write_json(&manifest, &json!({
      "app":"memoboard-shared-board",
      "version":1,
      "createdAt":chrono_like_now_ms() as u64,
      "layout":"note-per-file"
    }))?;
  }
  Ok(())
}

fn safe_shared_id(id: &str) -> String {
  let cleaned: String = id.chars().filter_map(|ch| {
    if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { Some(ch) } else { None }
  }).collect();
  if cleaned.is_empty() { format!("shared-{}", chrono_like_now_ms()) } else { cleaned.chars().take(80).collect() }
}

fn shared_note_path(root: &Path, id: &str) -> PathBuf {
  shared_notes_dir(root).join(format!("{}.json", safe_shared_id(id)))
}

fn shared_lock_path(root: &Path, id: &str) -> PathBuf {
  shared_locks_dir(root).join(format!("{}.lock.json", safe_shared_id(id)))
}

fn shared_mtime_ms(path: &Path) -> u128 {
  fs::metadata(path).ok()
    .and_then(|m| m.modified().ok())
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|d| d.as_millis())
    .unwrap_or(0)
}

fn shared_root_from_config(state: &AppState) -> Result<PathBuf, String> {
  let cfg = state.load_config();
  if cfg.shared_dir.trim().is_empty() { return Err("Shared folder is not configured".into()); }
  let root = PathBuf::from(cfg.shared_dir);
  ensure_shared_layout(&root)?;
  Ok(root)
}

fn read_value(path: &Path) -> Option<Value> {
  fs::read_to_string(path).ok().and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
}

fn shared_lock_state(root: &Path, id: &str) -> Option<Value> {
  let path = shared_lock_path(root, id);
  let mut v = read_value(&path)?;
  let now = chrono_like_now_ms() as u64;
  let expires = v.get("expiresAt").and_then(Value::as_u64).unwrap_or(0);
  if expires < now {
    let _ = fs::remove_file(path);
    return None;
  }
  if let Some(obj) = v.as_object_mut() { obj.insert("id".into(), Value::String(id.to_string())); }
  Some(v)
}

fn note_updated_at(note: &Value) -> u64 {
  note.get("updatedAt").and_then(Value::as_u64).unwrap_or(0)
}

fn assert_backup_payload(payload: &Value) -> Result<(), String> {
  if payload.get("app").and_then(Value::as_str) != Some("memoboard") {
    return Err("Invalid memoboard backup payload: app".into());
  }
  if !payload.get("notes").map(|v| v.is_array()).unwrap_or(false) {
    return Err("Invalid memoboard backup payload: notes".into());
  }
  Ok(())
}

fn is_path_inside(parent: &Path, child: &Path) -> bool {
  let root = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
  let target = child.canonicalize().unwrap_or_else(|_| child.to_path_buf());
  target == root || target.starts_with(root)
}


#[cfg(target_os = "windows")]
fn native_opacity_available() -> bool { true }
#[cfg(not(target_os = "windows"))]
fn native_opacity_available() -> bool { false }

#[cfg(target_os = "windows")]
fn set_native_window_opacity(window: &WebviewWindow, opacity: f64) -> Result<(), String> {
  use raw_window_handle::{HasWindowHandle, RawWindowHandle};
  use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowLongPtrW, SetLayeredWindowAttributes, SetWindowLongPtrW,
    GWL_EXSTYLE, LWA_ALPHA, WS_EX_LAYERED,
  };

  // Tauri 2.11 no longer exposes the older tauri::window::WindowExtWindows import path
  // used by the first port. Use the stable raw-window-handle interface instead.
  let raw_handle = window.window_handle().map_err(|e| e.to_string())?.as_raw();
  let raw_hwnd = match raw_handle {
    RawWindowHandle::Win32(handle) => handle.hwnd.get() as windows_sys::Win32::Foundation::HWND,
    _ => return Err("Current window is not a Win32 window".into()),
  };

  let alpha = (clamp_opacity(opacity) * 255.0).round().max(140.0).min(255.0) as u8;
  unsafe {
    let style = GetWindowLongPtrW(raw_hwnd, GWL_EXSTYLE);
    SetWindowLongPtrW(raw_hwnd, GWL_EXSTYLE, style | WS_EX_LAYERED as isize);
    if SetLayeredWindowAttributes(raw_hwnd, 0, alpha, LWA_ALPHA) == 0 {
      return Err("SetLayeredWindowAttributes failed".into());
    }
  }
  Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_native_window_opacity(_window: &WebviewWindow, _opacity: f64) -> Result<(), String> { Err("Native opacity is only implemented on Windows".into()) }

fn window_state(window: &WebviewWindow, cfg: &DesktopConfig) -> WindowStatePayload {
  WindowStatePayload {
    is_maximized: window.is_maximized().unwrap_or(false),
    is_full_screen: window.is_fullscreen().unwrap_or(false),
    is_always_on_top: cfg.always_on_top || cfg.mini_mode,
    opacity: clamp_opacity(cfg.window_opacity),
    native_opacity_supported: native_opacity_available(),
    mini_mode: cfg.mini_mode,
    minimize_to_tray: cfg.minimize_to_tray,
  }
}

fn emit_window_state(window: &WebviewWindow, state: &AppState) {
  let cfg = state.load_config();
  let _ = window.emit("memoboard:window-state", window_state(window, &cfg));
}

fn show_and_focus(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.emit("memoboard:focus", json!({}));
  }
}

fn emit_quick_note(app: &tauri::AppHandle) {
  show_and_focus(app);
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.emit("memoboard:quick-note", json!({}));
  }
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
  use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  };

  let open_i = MenuItem::with_id(app, "open", "메모보드 열기", true, None::<&str>)?;
  let quick_i = MenuItem::with_id(app, "quick-note", "빠른 메모", true, None::<&str>)?;
  let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&open_i, &quick_i, &quit_i])?;

  TrayIconBuilder::new()
    .tooltip(APP_NAME)
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id.as_ref() {
      "open" => show_and_focus(app),
      "quick-note" => emit_quick_note(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
        show_and_focus(tray.app_handle());
      }
    })
    .build(app)?;
  Ok(())
}

fn setup_window_events(app: &mut tauri::App) {
  if let Some(window) = app.get_webview_window("main") {
    let app_handle = app.handle().clone();
    window.on_window_event(move |event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        let state = app_handle.state::<AppState>();
        if state.load_config().minimize_to_tray {
          api.prevent_close();
          if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.hide();
          }
        }
      }
    });
  }
}

fn setup_shortcut(app: &mut tauri::App) -> Result<(), String> {
  #[cfg(desktop)]
  {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
    let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyM);
    let shortcut_for_handler = shortcut.clone();
    let app_handle = app.handle().clone();
    app.handle().plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |_app, triggered, event| {
          if triggered == &shortcut_for_handler && event.state() == ShortcutState::Pressed {
            emit_quick_note(&app_handle);
          }
        })
        .build(),
    ).map_err(|e| e.to_string())?;
    app.global_shortcut().register(shortcut).map_err(|e| e.to_string())?;
  }
  Ok(())
}

#[tauri::command]
fn get_env(state: tauri::State<AppState>) -> Value {
  json!({
    "appName": APP_NAME,
    "version": env!("CARGO_PKG_VERSION"),
    "platform": std::env::consts::OS,
    "arch": std::env::consts::ARCH,
    "userData": state.app_data_dir.to_string_lossy(),
    "isPackaged": !cfg!(debug_assertions),
    "runtime": "tauri"
  })
}

#[tauri::command]
fn get_backup_config(state: tauri::State<AppState>) -> DesktopConfig { state.load_config() }

#[tauri::command]
fn pick_backup_dir(state: tauri::State<AppState>, options: Option<BackupOptions>) -> Result<Value, String> {
  let Some(dir) = rfd::FileDialog::new().set_title("메모보드 자동 백업 폴더 선택").pick_folder() else {
    return Ok(json!({"ok":false,"canceled":true}));
  };
  let mut cfg = state.load_config();
  cfg.enabled = true;
  cfg.backup_dir = dir.to_string_lossy().to_string();
  if let Some(opts) = options { if let Some(v) = opts.snapshot_enabled { cfg.snapshot_enabled = v; } }
  let saved = state.save_config(cfg)?;
  Ok(json!({"ok":true,"config":saved}))
}

#[tauri::command]
fn set_backup_options(state: tauri::State<AppState>, options: Option<BackupOptions>) -> Result<DesktopConfig, String> {
  let mut cfg = state.load_config();
  if let Some(opts) = options {
    if let Some(v) = opts.enabled { cfg.enabled = v; }
    if let Some(v) = opts.snapshot_enabled { cfg.snapshot_enabled = v; }
  }
  state.save_config(cfg)
}

#[tauri::command]
fn disable_backup(state: tauri::State<AppState>) -> Result<DesktopConfig, String> {
  let mut cfg = state.load_config();
  cfg.enabled = false;
  state.save_config(cfg)
}

#[tauri::command]
fn write_backup(state: tauri::State<AppState>, payload: Value, options: Option<BackupOptions>) -> Result<Value, String> {
  assert_backup_payload(&payload)?;
  let mut cfg = state.load_config();
  if !cfg.enabled || cfg.backup_dir.is_empty() { return Err("Backup directory is not configured".into()); }
  let root = PathBuf::from(&cfg.backup_dir);
  ensure_dir(&root)?;
  let rolling_path = root.join(AUTO_BACKUP_FILE);
  write_json(&rolling_path, &payload)?;
  let mut snapshot_path = PathBuf::new();
  if options.and_then(|o| o.snapshot).unwrap_or(false) {
    let snapshot_dir = root.join("snapshots");
    ensure_dir(&snapshot_dir)?;
    snapshot_path = snapshot_dir.join(snapshot_name());
    let mut snap = payload.clone();
    if let Some(obj) = snap.as_object_mut() { obj.insert("backupType".into(), Value::String("snapshot".into())); }
    write_json(&snapshot_path, &snap)?;
  }
  cfg.last_backup_path = rolling_path.to_string_lossy().to_string();
  if !snapshot_path.as_os_str().is_empty() { cfg.last_snapshot_path = snapshot_path.to_string_lossy().to_string(); }
  let saved = state.save_config(cfg)?;
  Ok(json!({"ok":true,"fileName":AUTO_BACKUP_FILE,"backupPath":rolling_path,"snapshotPath":snapshot_path,"config":saved}))
}

#[tauri::command]
fn export_json(payload: Value, suggested_name: Option<String>) -> Result<Value, String> {
  assert_backup_payload(&payload)?;
  let default_name = suggested_name.unwrap_or_else(|| format!("memoboard-backup-{}.json", chrono_like_now_ms()));
  let Some(path) = rfd::FileDialog::new().set_title("메모보드 JSON 백업 저장").set_file_name(&default_name).add_filter("JSON", &["json"]).save_file() else {
    return Ok(json!({"ok":false,"canceled":true}));
  };
  write_json(&path, &payload)?;
  Ok(json!({"ok":true,"filePath":path}))
}

#[tauri::command]
fn import_json() -> Result<Value, String> {
  let Some(path) = rfd::FileDialog::new().set_title("메모보드 JSON 백업 가져오기").add_filter("JSON", &["json"]).pick_file() else {
    return Ok(json!({"ok":false,"canceled":true}));
  };
  let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
  Ok(json!({"ok":true,"filePath":path,"raw":raw}))
}

#[tauri::command]
fn list_backups(state: tauri::State<AppState>) -> Result<Value, String> {
  let cfg = state.load_config();
  if cfg.backup_dir.is_empty() { return Ok(json!({"ok":true,"backups":[],"config":cfg})); }
  let root = PathBuf::from(&cfg.backup_dir);
  let mut backups: Vec<Value> = Vec::new();
  let mut push_file = |path: PathBuf, kind: &str| {
    if let Ok(meta) = fs::metadata(&path) {
      if meta.is_file() && path.extension().map(|e| e.to_string_lossy().eq_ignore_ascii_case("json")).unwrap_or(false) {
        let mtime = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis()).unwrap_or(0);
        backups.push(json!({"filePath":path,"name":path.file_name().unwrap_or_default().to_string_lossy(),"type":kind,"size":meta.len(),"mtime":mtime}));
      }
    }
  };
  push_file(root.join(AUTO_BACKUP_FILE), "rolling");
  if let Ok(entries) = fs::read_dir(root.join("snapshots")) {
    for entry in entries.flatten() { push_file(entry.path(), "snapshot"); }
  }
  backups.sort_by(|a,b| b.get("mtime").and_then(Value::as_u64).cmp(&a.get("mtime").and_then(Value::as_u64)));
  Ok(json!({"ok":true,"backups":backups,"config":cfg}))
}

#[tauri::command]
fn read_backup(state: tauri::State<AppState>, file_path: String) -> Result<Value, String> {
  let cfg = state.load_config();
  let root = PathBuf::from(&cfg.backup_dir);
  let target = PathBuf::from(&file_path);
  if !is_path_inside(&root, &target) { return Ok(json!({"ok":false,"error":"Path outside backup dir"})); }
  let raw = fs::read_to_string(&target).map_err(|e| e.to_string())?;
  Ok(json!({"ok":true,"raw":raw,"filePath":target}))
}

#[tauri::command]
fn export_markdown_folder(request: Value) -> Result<Value, String> {
  let files = request.get("files").and_then(Value::as_array).cloned().unwrap_or_default();
  let manifest = request.get("manifest").cloned().unwrap_or_else(|| json!({"app":"memoboard","version":16,"exportedAt":chrono_like_now_ms(),"count":files.len()}));
  let Some(base) = rfd::FileDialog::new().set_title("Markdown 내보내기 폴더 선택").pick_folder() else {
    return Ok(json!({"ok":false,"canceled":true}));
  };
  let root = base.join(format!("Memoboard-Markdown-{}", chrono_like_now_ms()));
  let notes_dir = root.join("notes");
  ensure_dir(&notes_dir)?;
  write_json(&root.join("manifest.json"), &manifest)?;
  let count = files.len();
  for file in &files {
    let name = file.get("fileName").and_then(Value::as_str).unwrap_or("untitled.md");
    let content = file.get("content").and_then(Value::as_str).unwrap_or("");
    let mut file_name = safe_file_name(name);
    if !file_name.to_lowercase().ends_with(".md") { file_name.push_str(".md"); }
    fs::write(notes_dir.join(file_name), content).map_err(|e| e.to_string())?;
  }
  Ok(json!({"ok":true,"root":root,"count":count}))
}

#[tauri::command]
fn import_markdown_folder() -> Result<Value, String> {
  let Some(root) = rfd::FileDialog::new().set_title("Markdown 가져오기 폴더 선택").pick_folder() else {
    return Ok(json!({"ok":false,"canceled":true}));
  };
  let manifest_path = root.join("manifest.json");
  let manifest: Option<Value> = fs::read_to_string(&manifest_path).ok().and_then(|raw| serde_json::from_str(&raw).ok());
  let notes_dir = if root.join("notes").exists() { root.join("notes") } else { root.clone() };
  let mut files = Vec::new();
  for entry in fs::read_dir(&notes_dir).map_err(|e| e.to_string())?.flatten() {
    let path = entry.path();
    if path.extension().map(|e| e.to_string_lossy().eq_ignore_ascii_case("md")).unwrap_or(false) && path.is_file() {
      let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
      files.push(json!({"fileName":path.file_name().unwrap_or_default().to_string_lossy(),"content":content}));
    }
  }
  Ok(json!({"ok":true,"root":root,"manifest":manifest,"files":files}))
}


#[tauri::command]
fn get_shared_config(state: tauri::State<AppState>) -> DesktopConfig { state.load_config() }

#[tauri::command]
fn pick_shared_dir(state: tauri::State<AppState>, options: Option<SharedOptions>) -> Result<Value, String> {
  let Some(dir) = rfd::FileDialog::new().set_title("메모보드 공유 보드 폴더 선택").pick_folder() else {
    return Ok(json!({"ok":false,"canceled":true}));
  };
  ensure_shared_layout(&dir)?;
  let mut cfg = state.load_config();
  cfg.shared_dir = dir.to_string_lossy().to_string();
  if let Some(opts) = options {
    if let Some(name) = opts.display_name {
      let name = name.trim().chars().take(40).collect::<String>();
      if !name.is_empty() { cfg.shared_display_name = name; }
    }
  }
  if cfg.shared_display_name.trim().is_empty() {
    cfg.shared_display_name = std::env::var("USERNAME").or_else(|_| std::env::var("USER")).unwrap_or_else(|_| "익명".to_string());
  }
  let saved = state.save_config(cfg)?;
  Ok(json!({"ok":true,"config":saved}))
}

#[tauri::command]
fn set_shared_options(state: tauri::State<AppState>, options: Option<SharedOptions>) -> Result<Value, String> {
  let mut cfg = state.load_config();
  if let Some(opts) = options {
    if let Some(name) = opts.display_name {
      cfg.shared_display_name = name.trim().chars().take(40).collect::<String>();
    }
  }
  let saved = state.save_config(cfg)?;
  Ok(json!({"ok":true,"config":saved}))
}

#[tauri::command]
fn shared_load_board(state: tauri::State<AppState>) -> Result<Value, String> {
  let cfg = state.load_config();
  if cfg.shared_dir.trim().is_empty() {
    return Ok(json!({"ok":true,"configured":false,"notes":[],"locks":[],"config":cfg}));
  }
  let root = PathBuf::from(&cfg.shared_dir);
  ensure_shared_layout(&root)?;
  let mut notes: Vec<Value> = Vec::new();
  let mut locks: Vec<Value> = Vec::new();
  if let Ok(entries) = fs::read_dir(shared_notes_dir(&root)) {
    for entry in entries.flatten() {
      let path = entry.path();
      if !path.is_file() || !path.extension().map(|e| e.to_string_lossy().eq_ignore_ascii_case("json")).unwrap_or(false) { continue; }
      if let Some(mut note) = read_value(&path) {
        if note.get("id").and_then(Value::as_str).is_none() { continue; }
        if let Some(obj) = note.as_object_mut() {
          obj.insert("_sharedFile".into(), Value::String(path.file_name().unwrap_or_default().to_string_lossy().to_string()));
          obj.insert("_sharedMtime".into(), Value::Number(serde_json::Number::from(shared_mtime_ms(&path) as u64)));
          let id = obj.get("id").and_then(Value::as_str).unwrap_or("").to_string();
          if let Some(lock) = shared_lock_state(&root, &id) { locks.push(lock); }
        }
        notes.push(note);
      }
    }
  }
  notes.sort_by(|a,b| note_updated_at(b).cmp(&note_updated_at(a)));
  Ok(json!({"ok":true,"configured":true,"root":root,"notes":notes,"locks":locks,"config":cfg,"loadedAt":chrono_like_now_ms() as u64}))
}

#[tauri::command]
fn shared_save_note(state: tauri::State<AppState>, request: SharedSaveRequest) -> Result<Value, String> {
  let root = shared_root_from_config(&state)?;
  let mut note = request.note;
  let id = note.get("id").and_then(Value::as_str).unwrap_or("").trim().to_string();
  if id.is_empty() { return Err("Shared note id is required".into()); }
  let path = shared_note_path(&root, &id);
  if let Some(lock) = shared_lock_state(&root, &id) {
    let expected_token = request.lock_token.clone().unwrap_or_default();
    let lock_token = lock.get("token").and_then(Value::as_str).unwrap_or("");
    if expected_token.is_empty() || expected_token != lock_token {
      let owner = lock.get("owner").and_then(Value::as_str).unwrap_or("").to_string();
      return Ok(json!({"ok":false,"locked":true,"lock":lock,"owner":owner}));
    }
  }
  let expected = request.expected_updated_at.unwrap_or(0);
  if path.exists() {
    if let Some(current) = read_value(&path) {
      let current_updated = note_updated_at(&current);
      if expected > 0 && current_updated > expected {
        return Ok(json!({"ok":false,"conflict":true,"current":current,"filePath":path,"currentUpdatedAt":current_updated}));
      }
    }
  }
  let now = chrono_like_now_ms() as u64;
  if let Some(obj) = note.as_object_mut() {
    obj.insert("id".into(), Value::String(id.clone()));
    obj.insert("updatedAt".into(), Value::Number(serde_json::Number::from(now)));
    if obj.get("createdAt").and_then(Value::as_u64).unwrap_or(0) == 0 {
      obj.insert("createdAt".into(), Value::Number(serde_json::Number::from(now)));
    }
    obj.insert("sharedSchema".into(), Value::Number(serde_json::Number::from(1)));
  }
  write_json(&path, &note)?;
  Ok(json!({"ok":true,"note":note,"filePath":path,"mtime":shared_mtime_ms(&path)}))
}

#[tauri::command]
fn shared_delete_note(state: tauri::State<AppState>, request: SharedDeleteRequest) -> Result<Value, String> {
  let root = shared_root_from_config(&state)?;
  let id = request.id.trim().to_string();
  if id.is_empty() { return Err("Shared note id is required".into()); }
  let path = shared_note_path(&root, &id);
  if !path.exists() { return Ok(json!({"ok":true,"missing":true})); }
  let mut current = read_value(&path).ok_or_else(|| "Cannot read shared note".to_string())?;
  let expected = request.expected_updated_at.unwrap_or(0);
  let current_updated = note_updated_at(&current);
  if expected > 0 && current_updated > expected {
    return Ok(json!({"ok":false,"conflict":true,"current":current,"currentUpdatedAt":current_updated}));
  }
  let now = chrono_like_now_ms() as u64;
  if let Some(obj) = current.as_object_mut() {
    obj.insert("deletedAt".into(), Value::Number(serde_json::Number::from(now)));
    obj.insert("updatedAt".into(), Value::Number(serde_json::Number::from(now)));
    if let Some(author) = request.author {
      obj.insert("deletedBy".into(), Value::String(author));
    }
  }
  write_json(&path, &current)?;
  Ok(json!({"ok":true,"note":current}))
}

#[tauri::command]
fn shared_acquire_lock(state: tauri::State<AppState>, request: SharedLockRequest) -> Result<Value, String> {
  let root = shared_root_from_config(&state)?;
  let id = request.id.trim().to_string();
  if id.is_empty() { return Err("Shared note id is required".into()); }
  let path = shared_lock_path(&root, &id);
  let now = chrono_like_now_ms() as u64;
  if let Some(lock) = read_value(&path) {
    let expires = lock.get("expiresAt").and_then(Value::as_u64).unwrap_or(0);
    if expires > now {
      let owner = lock.get("owner").and_then(Value::as_str).unwrap_or("");
      return Ok(json!({"ok":false,"locked":true,"owner":owner,"lock":lock}));
    }
  }
  let token = format!("lock-{}-{}", now, safe_shared_id(&id));
  let owner = request.owner.unwrap_or_else(|| "익명".to_string());
  let lock = json!({"id":id,"owner":owner,"token":token,"createdAt":now,"expiresAt":now+10*60*1000});
  write_json(&path, &lock)?;
  Ok(json!({"ok":true,"lock":lock,"token":token}))
}

#[tauri::command]
fn shared_release_lock(state: tauri::State<AppState>, request: SharedLockRequest) -> Result<Value, String> {
  let root = shared_root_from_config(&state)?;
  let id = request.id.trim().to_string();
  if id.is_empty() { return Ok(json!({"ok":true})); }
  let path = shared_lock_path(&root, &id);
  if let Some(lock) = read_value(&path) {
    let old = lock.get("token").and_then(Value::as_str).unwrap_or("");
    let token = request.token.unwrap_or_default();
    if !token.is_empty() && old != token { return Ok(json!({"ok":false,"locked":true,"lock":lock})); }
  }
  let _ = fs::remove_file(path);
  Ok(json!({"ok":true}))
}

#[tauri::command]
fn open_path(target_path: String) -> Result<Value, String> {
  if target_path.is_empty() || !PathBuf::from(&target_path).exists() { return Ok(json!({"ok":false,"error":"Path not found"})); }
  #[cfg(target_os = "windows")]
  let status = Command::new("cmd").args(["/C", "start", "", &target_path]).status();
  #[cfg(not(target_os = "windows"))]
  let status = Command::new("xdg-open").arg(&target_path).status();
  Ok(json!({"ok":status.map(|s| s.success()).unwrap_or(false)}))
}

#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<Value, String> { window.minimize().map_err(|e| e.to_string())?; Ok(json!({"ok":true})) }

#[tauri::command]
fn window_toggle_maximize(window: WebviewWindow, state: tauri::State<AppState>) -> Result<Value, String> {
  if window.is_maximized().unwrap_or(false) { window.unmaximize().map_err(|e| e.to_string())?; }
  else { window.maximize().map_err(|e| e.to_string())?; }
  emit_window_state(&window, &state);
  Ok(json!({"ok":true,"isMaximized":window.is_maximized().unwrap_or(false)}))
}

#[tauri::command]
fn window_close(window: WebviewWindow) -> Result<Value, String> { window.close().map_err(|e| e.to_string())?; Ok(json!({"ok":true})) }

#[tauri::command]
fn window_set_always_on_top(window: WebviewWindow, state: tauri::State<AppState>, enabled: bool) -> Result<Value, String> {
  window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
  let mut cfg = state.load_config(); cfg.always_on_top = enabled; let saved = state.save_config(cfg)?;
  emit_window_state(&window, &state);
  Ok(json!({"ok":true,"enabled":enabled,"config":saved}))
}

#[tauri::command]
fn window_set_opacity(window: WebviewWindow, state: tauri::State<AppState>, opacity: f64) -> Result<Value, String> {
  let next = clamp_opacity(opacity);
  let native_ok = set_native_window_opacity(&window, next).is_ok();
  let mut cfg = state.load_config();
  cfg.window_opacity = next;
  let _ = state.save_config(cfg)?;
  emit_window_state(&window, &state);
  Ok(json!({"ok":true,"opacity":next,"nativeOpacitySupported":native_ok}))
}

#[tauri::command]
fn window_get_state(window: WebviewWindow, state: tauri::State<AppState>) -> WindowStatePayload { window_state(&window, &state.load_config()) }

#[tauri::command]
fn tray_set_minimize_to_tray(window: WebviewWindow, state: tauri::State<AppState>, enabled: bool) -> Result<Value, String> {
  let mut cfg = state.load_config(); cfg.minimize_to_tray = enabled; let saved = state.save_config(cfg)?;
  emit_window_state(&window, &state);
  Ok(json!({"ok":true,"enabled":enabled,"config":saved}))
}

#[tauri::command]
fn tray_hide_to_tray(window: WebviewWindow) -> Result<Value, String> { window.hide().map_err(|e| e.to_string())?; Ok(json!({"ok":true})) }

#[tauri::command]
fn quick_note_show(window: WebviewWindow) -> Result<Value, String> {
  window.unminimize().ok(); window.show().ok(); window.set_focus().ok();
  window.emit("memoboard:quick-note", json!({})).map_err(|e| e.to_string())?;
  Ok(json!({"ok":true}))
}

#[tauri::command]
fn window_set_mini_mode(window: WebviewWindow, state: tauri::State<AppState>, enabled: bool) -> Result<Value, String> {
  use tauri::{LogicalSize, Size};
  let mut cfg = state.load_config(); cfg.mini_mode = enabled;
  if enabled {
    let _ = window.set_min_size(Some(Size::Logical(LogicalSize::new(420.0, 560.0))));
    let _ = window.set_always_on_top(true);
    let _ = window.set_size(Size::Logical(LogicalSize::new(520.0, 680.0)));
    let _ = window.center();
  } else {
    let _ = window.set_min_size(Some(Size::Logical(LogicalSize::new(980.0, 640.0))));
    let _ = window.set_always_on_top(cfg.always_on_top);
    let _ = window.set_size(Size::Logical(LogicalSize::new(1280.0, 820.0)));
    let _ = window.center();
  }
  let saved = state.save_config(cfg)?;
  emit_window_state(&window, &state);
  Ok(json!({"ok":true,"enabled":enabled,"config":saved}))
}

fn main() {
  let state = AppState::new();
  tauri::Builder::default()
    .manage(state)
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| show_and_focus(app)))
    .setup(|app| {
      setup_tray(app)?;
      setup_window_events(app);
      if let Err(e) = setup_shortcut(app) { eprintln!("[memoboard] global shortcut setup failed: {}", e); }
      if let Some(window) = app.get_webview_window("main") {
        let state = app.state::<AppState>();
        let cfg = state.load_config();
        if cfg.always_on_top || cfg.mini_mode { let _ = window.set_always_on_top(true); }
        let _ = set_native_window_opacity(&window, cfg.window_opacity);
        if cfg.mini_mode {
          use tauri::{LogicalSize, Size};
          let _ = window.set_min_size(Some(Size::Logical(LogicalSize::new(420.0, 560.0))));
          let _ = window.set_size(Size::Logical(LogicalSize::new(520.0, 680.0)));
        }
        window.show().ok();
        emit_window_state(&window, &state);
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_env,
      get_backup_config,
      pick_backup_dir,
      set_backup_options,
      disable_backup,
      write_backup,
      export_json,
      import_json,
      export_markdown_folder,
      import_markdown_folder,
      open_path,
      window_minimize,
      window_toggle_maximize,
      window_close,
      window_set_always_on_top,
      window_set_opacity,
      window_get_state,
      tray_set_minimize_to_tray,
      tray_hide_to_tray,
      quick_note_show,
      window_set_mini_mode,
      list_backups,
      read_backup,
      get_shared_config,
      pick_shared_dir,
      set_shared_options,
      shared_load_board,
      shared_save_note,
      shared_delete_note,
      shared_acquire_lock,
      shared_release_lock
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
