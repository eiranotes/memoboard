# Memoboard

**Memoboard**는 데스크톱에서 빠르게 메모를 만들고, 구역별로 정리하고, 달력과 체크리스트까지 함께 관리하는 로컬 우선 메모보드 앱입니다.  
메모 앱, 간단한 칸반 보드, 데일리 워크노트, 일정 메모를 하나의 창 안에서 쓰는 것을 목표로 합니다.

> 현재 패키지는 Windows/Tauri 데스크톱 실행을 기준으로 구성되어 있습니다.

## 주요 특징

- **구역형 메모보드**: 업무, 개인, 아이디어처럼 여러 구역을 만들고 메모를 드래그해서 정리할 수 있습니다.
- **같은 구역 내 순서 변경**: 메모 카드끼리 끌어서 순서를 바꿀 수 있고, 순서는 저장됩니다.
- **Markdown 미리보기**: 카드 미리보기와 에디터 미리보기에서 제목, 목록, 체크박스, 굵게, 링크, 표 등 Markdown 문법을 렌더링합니다.
- **체크리스트**: `- [ ]`, `- [x]` 문법을 사용하면 카드에서도 바로 체크할 수 있습니다.
- **달력 보기**: 날짜가 있는 메모를 월간/주간 흐름으로 확인할 수 있습니다.
- **검색과 태그**: 제목, 본문, 태그 기준으로 메모를 빠르게 찾을 수 있습니다.
- **휴지통**: 삭제한 메모를 바로 제거하지 않고 휴지통에서 확인할 수 있습니다.
- **개인/공유 작업함**: 개인 메모는 로컬 IndexedDB에 저장하고, 공유 작업함은 지정한 공유 폴더의 JSON 파일을 사용합니다.
- **로컬 우선 구조**: 서버 없이 로컬 데이터 중심으로 동작합니다.
- **Tauri 기반 데스크톱 앱**: WebView2 + Rust/Tauri로 Electron보다 가벼운 데스크톱 실행을 목표로 합니다.

## 화면 구조

현재 공개 버전은 **v1.0.0**이며, 라이선스는 **MIT License**입니다.

Memoboard는 크게 네 영역으로 구성됩니다.

| 영역 | 설명 |
|---|---|
| 좌측 사이드바 | 메모, 달력, 설정, 구역 목록, 스마트뷰 접근 |
| 상단 헤더 | 검색, 보기 전환, 개인/공유 작업함 전환, 가져오기/내보내기 |
| 메모보드 | 구역별 메모 카드 표시, 드래그 정렬, 체크리스트 빠른 처리 |
| 에디터 | 제목, 본문, 날짜, 구역, 태그, Markdown 미리보기 편집 |

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| 데스크톱 런타임 | Tauri v2 |
| 프론트엔드 | HTML, CSS, Vanilla JavaScript |
| 백엔드/네이티브 기능 | Rust |
| 로컬 저장 | IndexedDB, LocalStorage 일부 설정 |
| 공유 작업함 | 사용자가 지정한 로컬/네트워크 폴더의 JSON 파일 |
| 검사 도구 | Node.js 기반 renderer syntax/static/regression check |

## 프로젝트 구조

```text
.
├─ src/
│  ├─ index.html
│  ├─ css/app.css
│  └─ js/
│     ├─ 00-tauri-native.js
│     ├─ 01-storage.js
│     ├─ 02-store-services.js
│     ├─ 03-backup.js
│     ├─ 04-utils-markdown.js
│     ├─ 05-render-panels.js
│     ├─ 06-calendar.js
│     ├─ 07-editor-trash.js
│     ├─ 08-drag-service.js
│     ├─ 09-main-sidebar-events.js
│     ├─ 10-header-io-notification.js
│     ├─ 11-commands-help-keys.js
│     ├─ 12-init.js
│     └─ 13-shared-board.js
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  ├─ capabilities/default.json
│  └─ src/main.rs
└─ tools/
   ├─ check-renderer-js.js
   ├─ audit-static.js
   └─ regression-scenarios.js
```

## 실행 전 요구 사항

Windows 기준:

1. Node.js / npm
2. Rust toolchain
3. Microsoft C++ Build Tools - Desktop development with C++
4. Microsoft Edge WebView2 Runtime

Windows 11에는 WebView2 Runtime이 기본 설치되어 있는 경우가 많습니다.


## 실행파일 생성 방식

이 저장소에는 보통 `.exe` 실행파일을 직접 커밋하지 않습니다. GitHub에는 소스코드를 올리고, 사용자는 소스코드를 내려받은 뒤 Windows에서 빌드 배치 파일을 실행해 실행파일을 생성하는 방식입니다.

가장 단순한 흐름은 아래와 같습니다.

```text
1. GitHub에서 Source code 또는 ZIP 다운로드
2. 압축 해제
3. 프로젝트 폴더에서 build-tauri.bat 실행
4. 빌드 완료 후 dist/ 폴더에 실행파일 생성
```

생성되는 파일명:

```text
dist/Memoboard-Tauri-1.0.0.exe
```

즉, 처음 받았을 때 루트 폴더에 실행파일이 없어도 정상입니다. 실행파일은 `build-tauri.bat`를 실행한 뒤 `dist/` 폴더에 만들어집니다.

GitHub Releases를 사용할 경우에는 로컬에서 생성한 `dist/Memoboard-Tauri-1.0.0.exe`를 `v1.0.0` 릴리즈에 첨부하면 됩니다. 저장소 본문에는 소스코드를 두고, 실제 배포용 실행파일은 Releases에 올리는 방식을 권장합니다.

## 개발 실행

```bash
npm install
npm run tauri:dev
```

또는 Windows 배치 파일을 사용할 수 있습니다.

```bat
run-tauri-dev.bat
```

## 검사

```bash
npm run check
```

현재 검사 항목:

- renderer JavaScript 문법 검사
- 외부 참조/정적 구조 검사
- 주요 회귀 시나리오 검사

## 빌드

일반 npm 빌드:

```bash
npm run build
```

Windows에서는 배치 파일을 실행하는 쪽이 더 편합니다. 이 파일은 의존성 설치, 정적 검사, Tauri 릴리즈 빌드, 실행파일 복사까지 한 번에 수행합니다.

```bat
build-tauri.bat
```

빌드가 성공하면 아래 위치에 실행파일이 생성됩니다.

```text
dist/Memoboard-Tauri-1.0.0.exe
```

이미 `node_modules`가 있고 의존성 설치를 건너뛰고 싶다면:

```bat
build-tauri-no-install.bat
```

`build-tauri-no-install.bat`도 빌드 성공 시 같은 위치에 실행파일을 복사합니다.


## 빌드 오류 메모

Tauri 2의 기본 feature에는 asset `compression`이 포함됩니다. 이 기능은 Rust `brotli` crate를 끌고 오는데, 일부 fresh Windows 빌드에서 `brotli 8.0.3`과 `alloc-no-stdlib` 2.x/3.x가 함께 잡히며 `StandardAlloc: Allocator<u8>` 오류가 날 수 있습니다.

이 프로젝트는 앱 자산이 작고 별도 압축 이점이 크지 않으므로, `src-tauri/Cargo.toml`에서 Tauri 기본 feature를 끄고 필요한 기능만 명시했습니다. 핵심은 `compression`을 사용하지 않는 것입니다.

```toml
tauri-build = { version = "2", default-features = false }
tauri = { version = "2", default-features = false, features = ["wry", "custom-protocol", "tray-icon", "image-png", "image-ico", "common-controls-v6", "dynamic-acl"] }
```

기존 실패 폴더에서 계속 빌드하는 경우에는 캐시를 정리하세요.

```powershell
Remove-Item -Recurse -Force .\src-tauri\target -ErrorAction SilentlyContinue
Remove-Item .\src-tauri\Cargo.lock -Force -ErrorAction SilentlyContinue
npm run build
```

정상 상태라면 새 빌드 로그에 `Compiling brotli v8.0.3`가 나오지 않아야 합니다.

## 데이터 저장 방식

### 개인 작업함

개인 작업함의 메모는 브라우저/WebView의 IndexedDB에 저장됩니다. 서버 전송을 전제로 하지 않습니다.

### 공유 작업함

공유 작업함은 사용자가 지정한 폴더를 데이터 저장소로 사용합니다.

```text
공유폴더/
├─ manifest.json
├─ notes/
│  └─ sxxxx.json
├─ locks/
│  └─ sxxxx.lock.json
└─ trash/
```

네트워크 드라이브, 동기화 폴더, NAS 폴더 등을 지정하면 여러 사용자가 같은 공유 보드를 볼 수 있습니다. 동시 편집 충돌을 줄이기 위해 lock 파일과 `updatedAt` 비교를 사용합니다.

## Markdown 지원

카드 미리보기와 에디터 미리보기에서 다음 문법을 지원합니다.

```markdown
# 제목
## 소제목
**굵게**
_기울임_
~~취소선~~
==형광펜==

- 목록
1. 번호 목록
- [ ] 할 일
- [x] 완료한 일

> 인용문

[링크](https://example.com)
[[위키링크]]

| 항목 | 설명 |
|---|---|
| A | B |
```

## 설계 메모

- 앱 상태의 기준은 `meta.store`입니다.
- 구형 `meta.theme`, `meta.view` 같은 top-level 값은 migration 호환을 위해 흡수되며, 저장 기준은 `meta.store`로 정리되어 있습니다.
- 카드 Markdown 미리보기는 기존 editor preview의 `md2html()` 계열 변환을 재사용합니다.
- 공유 작업함은 서버 없는 협업을 목표로 하며, 완전한 실시간 협업 편집 도구는 아닙니다.

## 공개 전 확인할 사항

이 저장소를 그대로 공개하기 전에 아래를 확인하세요.

- 라이선스: MIT License
- 스크린샷 추가: README 상단이나 `screenshots/` 폴더에 실제 화면 이미지 추가 권장
- `src-tauri/tauri.conf.json`의 `identifier`를 본인 도메인/브랜드에 맞게 변경 권장
- 배포용 release를 만들 경우 `bundle.active` 설정 검토 필요
- `Cargo.lock`, `package-lock.json`은 실제 설치/빌드 환경에서 생성 후 커밋하는 것을 권장

## 라이선스

MIT License입니다. 자세한 내용은 루트의 `LICENSE` 파일을 확인하세요.
