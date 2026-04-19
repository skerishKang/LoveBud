# LoveTree 실운영 엔트리 맵

이 문서는 **현재 배포 기준으로 실제 사용자 진입 경로와 직접 로드 자산**만 빠르게 찾기 위한 문서입니다.

## 우선 판단 기준
1. `netlify.toml`의 alias / redirect
2. 각 HTML 엔트리 파일이 직접 로드하는 CSS/JS
3. 그 다음 참고용으로 `FILE_BASELINE.md`

## 루트 alias
- `/intro.html` -> `/pages/intro.html`
- `/login.html` -> `/pages/login.html`
- `/search.html` -> `/pages/search.html`
- `/detail.html` -> `/pages/detail.html`
- `/editor.html` -> `/pages/editor.html`
- `/my-trees.html` -> `/pages/my-trees.html`

## 실제 운영 엔트리

### `index.html`
- 역할: 랜딩
- 핵심 자산: 페이지 내 직접 로드 스크립트 및 공통 CSS

### `pages/search.html`
- 역할: 공개 러브트리 둘러보기
- 핵심 CSS: `../css/global.css`
- 핵심 JS:
  - `../js/search.js`
  - `../js/search-data-adapter.js`
  - `../js/search-card-renderer.js`
  - `../js/search-preview-renderer.js`
  - `../js/postgres-client.js`
  - `../js/page-shell.js`

### `pages/detail.html`
- 역할: 메모리 상세
- 핵심 CSS: `../css/global.css`
- 핵심 JS: detail/auth/i18n 관련 직접 로드 파일

### `pages/editor.html`
- 역할: 트리 에디터
- 핵심 CSS/JS: editor 페이지가 직접 로드하는 자산 일체
- 주의: 별도 트랙으로 취급

### `pages/my-trees.html`
- 역할: 내 트리 대시보드
- 핵심 CSS: `../css/global.css`
- 핵심 JS: my-trees/auth/i18n 관련 직접 로드 파일

### `pages/login.html`
- 역할: 로그인
- 핵심 JS: firebase/auth 관련 직접 로드 파일

## 주의
- `FILE_BASELINE.md`는 분류 참고용 문서입니다.
- 실제 운영 파일 여부는 이 문서와 HTML 직접 로드 경로를 우선합니다.
