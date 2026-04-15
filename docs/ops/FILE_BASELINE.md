# Lovetree 운영 파일 기준표

> 이 문서는 133-relovetree 프로젝트의 파일들을 사용 현황 기준으로 분류한 기준표입니다.
> 다음 작업 전에 이 표만 보고 방향을 잡을 수 있도록 작성되었습니다.

---

## 1. 핵심 운영 파일 (Core Operating Files)

### 1.1 루트 핵심 파일

| 파일 | 용도 | 상태 |
|------|------|------|
| `index.html` | 메인 랜딩 페이지 (V2) | ✅ 운영 |
| `netlify.toml` | 라우팅/리다이렉트 설정 | ✅ 운영 |
| `package.json` | 프로젝트 의존성 | ✅ 운영 |
| `AGENTS.md` | 개발자 작업 가이드 | ✅ 운영 |
| `README.md` | 프로젝트 문서 | ✅ 운영 |

### 1.2 Pages - 활성 페이지

| 파일 | 용도 | 종속 src |
|------|------|----------|
| `pages/lovetree.html` | 제품 소개 (랜딩) | shared, auth |
| `pages/community.html` | 탐색 광장 (Discovery) | flow-shared |
| `pages/my-trees.html` | 마이 트리 대시보드 | shared, auth |
| `pages/login.html` | 로그인 페이지 | auth |
| `pages/editor.html` | 트리 에디터 (37 스크립트) | **별도 트랙** |
| `pages/owner.html` | 오너 콘솔 | owner-* |
| `pages/admin.html` | 관리자 대시보드 | admin-* |
| `pages/mobile-tree.html` | 모바일 트리 뷰 | mobile-tree.js |
| `pages/community-tree-detail.html` | 커뮤니티 트리 상세 | community-* |

### 1.3 src/shared - 공통 레이어

| 파일 | 용도 | 중요도 |
|------|------|--------|
| `src/shared.js` | 공유 бизнес 로직 (initApp, forkTree) | **핵심** |
| `src/shared-layout.js` | GNB 주입 + Auth UI 초기화 | **핵심** |
| `src/shared-utils.js` | 유틸리티 (debounce, copyTextToClipboard) | **핵심** |
| `src/shared-dom.js` | DOM 조작 유틸 | 중요 |
| `src/shared-theme.js` | 테마 관리 | 중요 |
| `src/shared-storage.js` | 로컬 스토리지 | 중요 |
| `src/auth.js` | Firebase Auth 로직 | **핵심** |
| `src/runtime-config.js` | 런타임 설정 (payment, app-check) | **핵심** |
| `src/postgres-client-browser.js` | 브라우저 PostgreSQL 클라이언트 | **핵심** |
| `src/firebase-firestore-compat.js` | Firestore→PostgreSQL shim | **핵심** |
| `src/concept-state.js` | 페이지 상태 바인딩 | 중요 |
| `src/api.js` | API 호출 래퍼 | 중요 |
| `src/flow-shared.js` | 커뮤니티 탐색 로직 | 중요 |

### 1.4 src/entries - 페이지 진입점

| 파일 | 용도 | 호출 페이지 |
|------|------|-------------|
| `src/entries/index.js` | 메인 페이지 로직 | index.html |
| `src/entries/community.js` | 커뮤니티 진입 (미사용?) | - |
| `src/entries/owner.js` | 오너 콘솔 진입 | pages/owner.html |
| `src/entries/admin.js` | 관리자 페이지 진입 | pages/admin.html |
| `src/entries/editor_ai.js` | 에디터 AI 도우미 | pages/editor.html |

### 1.5 src/index - 메인 페이지 모듈

| 파일 | 용도 |
|------|------|
| `src/index-runtime.js` | 인덱스 런타임 (loadRecentTrees) |
| `src/index-data.js` | 인덱스 데이터 로딩 |
| `src/index-render.js` | 인덱스 렌더링 |
| `src/index-i18n.js` | 다국어 지원 |
| `src/index-artists.js` | 인기 아티스트 데이터 |
| `src/index-utils.js` | 인덱스 유틸리티 |
| `src/index-search.js` | 검색 기능 |
| `src/index-settings.js` | 설정 기능 |

### 1.6 src/community - 커뮤니티 모듈

| 파일 | 용도 | 사용 여부 |
|------|------|-----------|
| `src/community-flow.js` | 커뮤니티 플로우 | inline script 사용 |
| `src/community-compose.js` | 글 작성 | inline script 사용 |
| `src/community-entry-flow.js` | 진입 플로우 | inline script 사용 |
| `src/community-render.js` | 렌더링 | inline script 사용 |
| `src/community-ui.js` | UI 헬퍼 | inline script 사용 |
| `src/community-sync.js` | 인증 동기화 | inline script 사용 |
| `src/community-comments.js` | 댓글 기능 | 사용 |
| `src/community-write.js` | 글쓰기 | 사용 |
| `src/community-runtime.js` | 런타임 | 사용 |
| `src/community-moderation.js` | moderation | 사용 |

> **참고**: community.html은 inline script로 직접 처리하고 있어 community-*.js 모듈을 직접 로드하지 않음

### 1.7 src/owner - 오너 콘솔 모듈

| 파일 | 용도 |
|------|------|
| `src/owner-runtime.js` | 오너 런타임 |
| `src/owner-api-client.js` | API 클라이언트 |
| `src/owner-bindings.js` | 이벤트 바인딩 |
| `src/owner-render-helpers.js` | 렌더링 헬퍼 |
| `src/owner-list-ui.js` | 리스트 UI |
| `src/owner-dialogs.js` | 다이어로그 |
| `src/owner-ui-state.js` | UI 상태 |
| `src/owner-fork-cache.js` | 포크 캐시 |
| `src/owner-fork-auto-check.js` | 자동 포크 체크 |

### 1.8 src/admin - 관리자 모듈

| 파일 | 용도 |
|------|------|
| `src/admin-bootstrap.js` | 관리자 부트스트랩 |
| `src/admin-users.js` | 사용자 관리 |
| `src/admin-users-render.js` | 사용자 렌더링 |
| `src/admin-users-util.js` | 사용자 유틸 |
| `src/admin-users-filter.js` | 사용자 필터 |
| `src/admin-stats.js` | 통계 |
| `src/admin-stats-display.js` | 통계 표시 |
| `src/admin-stats-format.js` | 통계 포맷 |
| `src/admin-tree.js` | 트리 관리 |
| `src/admin-tree-render.js` | 트리 렌더링 |
| `src/admin-tree-node-editor.js` | 노드 편집 |
| `src/admin-tree-api.js` | 트리 API |
| `src/admin-ai.js` | AI 설정 |
| `src/admin-ai-settings.js` | AI 설정 |
| `src/admin-ai-request.js` | AI 요청 |
| `src/admin-ai-log.js` | AI 로그 |
| `src/admin-ai-creator.js` | AI 생성 |
| `src/admin-demo.js` | 데모 |
| `src/admin-demo-modal.js` | 데모 모달 |
| `src/admin-demo-templates.js` | 데모 템플릿 |

### 1.9 netlify/functions - 서버리스 API

| 파일 | 용도 |
|------|------|
| `netlify/functions/firestore-api.js` | Firestore shim API (레거시) |
| `netlify/functions/_lib/db-api.js` | PostgreSQL API (권장) |
| `netlify/functions/_lib/firestore-api.js` | Firestore shim 구현 |
| `netlify/functions/_lib/document-store.js` | PostgreSQL Document Store |
| `netlify/functions/_lib/db.js` | DB 클라이언트 |
| `netlify/functions/_lib/firebase-auth.js` | Firebase Auth 검증 |
| `netlify/functions/create-moment.js` | 순간 생성 |
| `netlify/functions/tree-admin.js` | 트리 관리 |
| `netlify/functions/tree-ai.js` | 트리 AI |
| `netlify/functions/ai-helper.js` | AI 도우미 |
| `netlify/functions/payment-verify.js` | 결제 검증 |

---

## 2. 보조 파일 (Supporting Files)

### 2.1 src/mobile - 모바일 (1 활성, 2 ARCHIVE)

| 파일 | 상태 | 설명 |
|------|------|------|
| `src/mobile-tree.js` | ✅ KEEP | mobile-tree.html에서 사용 |
| `src/mobile-add-memory.js` | 📦 ARCHIVE | archive/recovered-legacy/로 이동 - 더 이상 사용되지 않음 |
| `src/mobile-add-branch.js` | 📦 ARCHIVE | archive/recovered-legacy/로 이동 - 더 이상 사용되지 않음 |

### 2.2 src/editor - 에디터 모듈 (별도 트랙)

| 파일 | 중요도 |
|------|--------|
| `src/editor-bootstrap.js` | **핵심** - DB 할당 |
| `src/editor-runtime.js` | **핵심** - 런타임 |
| `src/editor-data.js` | **핵심** - 데이터 (FieldValue 사용) |
| `src/editor-actions.js` | **핵심** - 액션 (FieldValue 사용) |
| `src/editor-comments.js` | 중요 - 댓글 |
| `src/editor-page-init.js` | 중요 - 페이지 초기화 |
| `src/editor-orchestration.js` | 중요 - 오케스트레이션 |
| `src/editor-render-main.js` | 중요 - 메인 렌더링 |
| `src/editor-render-ui.js` | 중요 - UI 렌더링 |
| `src/editor-ui.js` | 중요 - UI |
| `src/editor-header.js` | 중요 - 헤더 |
| `src/editor-detail.js` | 중요 - 상세 |
| `src/editor-detail-media.js` | 중요 - 미디어 |
| `src/editor-tree-view.js` | 중요 - 트리 뷰 |
| `src/editor-timeline.js` | 중요 - 타임라인 |
| `src/editor-minimap.js` | 중요 - 미니맵 |
| `src/editor-pointer.js` | 중요 - 포인터 |
| `src/editor-ai-logic.js` | 중요 - AI 로직 |
| `src/editor-ai-ui.js` | 중요 - AI UI |
| `src/editor-ai-utils.js` | 중요 - AI 유틸 |
| `src/editor-ai-actions.js` | 중요 - AI 액션 |
| `src/editor-ai-tree-editor.js` | 중요 - AI 트리 에디터 |

### 2.3 assets/css - 운영 CSS

| 파일 | 용도 |
|------|------|
| `assets/css/app.css` | 공통 앱 |
| `assets/css/app-base.css` | 베이스 |
| `assets/css/app-buttons.css` | 버튼 |
| `assets/css/app-modal.css` | 모달 |
| `assets/css/app-nav.css` | 내비게이션 |
| `assets/css/app-utils.css` | 유틸 |
| `assets/css/app-feedback.css` | 피드백 |
| `assets/css/editor-core.css` | 에디터 코어 |
| `assets/css/editor-canvas.css` | 에디터 캔버스 |
| `assets/css/editor-detail.css` | 에디터 상세 |
| `assets/css/index.css` | 인덱스 |
| `assets/css/index-hero.css` | 인덱스 히어로 |
| `assets/css/index-sections.css` | 인덱스 섹션 |
| `assets/css/community-*.css` | 커뮤니티 스타일 |

---

## 3. 레거시/보류 파일 (Legacy/Pending Files)

### 3.1 Archive 4분류 (아카이브 폴더 구조)

| 폴더 | 내용 | archive 정책 | 정리 주기 |
|------|------|--------------|-----------|
| `archive/recovered-legacy/` | 복구된 레거시 파일, css/ 이동본 | **유지** - 복구된 소스이므로 삭제 금지 | 수동 검토 |
| `archive/old-ui/` | 이전 UI 디자인 컨셉 | **삭제 후보** - 주기적으로 정리 검토 | 3개월마다 |
| `archive/prototype/` | 초기 개발 프로토타입 | **참조용** - 운영 미사용 | 수동 검토 |
| `archive/reference-only/` | 기술 문서 및 참고용 데이터 | **참조용** - 운영 미사용 | 수동 검토 |

> **Archive 정책**: 삭제보다 archive 우선. 단, `old-ui`는 정리 대상이며 정기적으로 검토.

### 3.2 상태 용어 및 분류 정의

| 용어 | 상세 기준 | 대응 상태 |
|------|-----------|-----------|
| **Active (운영)** | 현재 프로덕션에서 로드 및 사용됨 | ✅ KEEP |
| **INACTIVE (비활성)** | 파일은 존재하나 참조/리다이렉트 안 됨 | ⚠️ INACTIVE |
| **Legacy (레거시)** | 사용 중이나 대체 대상 (Shim 의존 등) | 🗑️ DEPRECATED |
| **Archive (아카이브)** | `archive/` 폴더로 이동되어 참조 불가 | 📦 ARCHIVE |

> **Archive 4분류**: `recovered-legacy` (복구본) / `prototype` (초기안) / `old-ui` (이전디자인) / `reference-only` (참고문서)

### 3.3 css/ - 레거시 CSS (이미 ARCHIVE로 이동)

| 파일 | 상태 |
|------|------|
| `css/` 폴더 전체 | 📦 ARCHIVE (archive/recovered-legacy/css/로 이동됨) |

### 3.4 pages/ - 비활성/Inactive 페이지

| 파일 | 상태 | 현재 동작 |
|------|------|----------|
| `pages/home.html` | ⚠️ INACTIVE | 리다이렉트 가능성 확인 필요 |
| `pages/about.html` | ⚠️ INACTIVE | 정적 페이지, 운영 미사용 |
| `pages/settings.html` | ⚠️ INACTIVE | 설정 페이지, 운영 미사용 |
| `pages/video-search.html` | ⚠️ INACTIVE | 비디오 검색, 운영 미사용 |
| `pages/story-view.html` | ⚠️ INACTIVE | 스토리 뷰, 운영 미사용 |
| `pages/empty-state.html` | ⚠️ INACTIVE | 빈 상태, 운영 미사용 |
| `pages/album-view.html` | ⚠️ INACTIVE | 앨범 뷰, 운영 미사용 |
| `pages/memory-detail.html` | ⚠️ INACTIVE | `mobile-tree.html`로 리다이렉트 |
| `pages/mobile-add-memory.html` | ⚠️ INACTIVE | 레거시 페이지 – redirect to `/pages/mobile-tree.html` 유지 |
| `pages/mobile-add-branch.html` | ⚠️ INACTIVE | 레거시 페이지 - 아카이브 또는 리다이렉트 필요 |
| `pages/editor-desktop.html` | ⚠️ INACTIVE | `editor.html`로 리다이렉트 |
| `pages/editor-desktop-empty.html` | ⚠️ INACTIVE | 에디터 데스크톱 빈, 미사용 |

### 3.5 src/ - DEPRECATED / PENDING 모듈

| 파일 | 상태 | 설명 |
|------|------|------|
| `src/add-memory.js` | ⏳ PENDING | mobile로 리다이렉트, 사용 여부 확인 필요 |
| `src/payment.js` | ⏳ PENDING | payment config 있을 때만 활성화 (조건부) |
| `src/postgres-client.js` | 🗑️ DEPRECATED | 서버 전용, 브라우저는 postgres-client-browser.js 사용 |

---

## 4. Editor 별도 트랙 (Editor Separate Track)

### 4.1 위험 파일 (DO NOT TOUCH)

| 파일 | 줄 | 이유 |
|------|-----|------|
| `src/editor-bootstrap.js` | 18 | `runtime.db = window.postgresDB` - DB 할당 |
| `src/editor-data.js` | 전역 | FieldValue 사용 |
| `src/editor-actions.js` | 전역 | FieldValue 사용 |
| `src/editor-comments.js` | 전역 | FieldValue 사용 |
| `src/editor-runtime.js` | 전역 | runtime getter |

### 4.2 Editor Smoke Test 대상

| 테스트 파일 | 검증 내용 |
|------------|-----------|
| `tests/editor-smoke.spec.js` | 공통 script 변경 시 에디터 쉘 무결성 |
| `tests/editor-fieldvalue.spec.js` | FieldValue shim 변환 검증 |

---

## 5. 테스트 보호 대상 (Test Protected Files)

| 파일 | 테스트 |
|------|--------|
| `src/shared.js` | smoke.spec.js |
| `src/shared-layout.js` | smoke.spec.js |
| `src/editor-bootstrap.js` | editor-smoke.spec.js |
| `src/editor-runtime.js` | editor-smoke.spec.js |
| `src/editor-data.js` | editor-fieldvalue.spec.js |
| `src/editor-comments.js` | editor-fieldvalue.spec.js |
| `src/editor-actions.js` | editor-fieldvalue.spec.js |

---

## 6. 파일 분류표 (KEEP / DEPRECATED / ARCHIVE / PENDING / DELETE LATER)

### 6.1 KEEP - 핵심 운영 파일 (절대 삭제 금지)

| 파일/폴더 | 이유 |
|----------|------|
| `src/shared.js`, `src/shared-layout.js`, `src/auth.js` | 핵심 공유/인증 |
| `src/firebase-firestore-compat.js` | 브라우저 shim 핵심 |
| `src/postgres-client-browser.js` | 브라우저 PostgreSQL 클라이언트 |
| `src/runtime-config.js` | 런타임 설정 |
| `src/concept-state.js`, `src/flow-shared.js` | 페이지 상태/탐색 |
| `src/entries/*.js` | 페이지 진입점 |
| `src/index-*.js` | 메인 페이지 모듈 |
| `src/owner-*.js` | 오너 콘솔 모듈 |
| `src/admin-*.js` | 관리자 모듈 |
| `src/editor-*.js` | 에디터 전체 (별도 트랙) |
| `pages/editor.html` | 에디터 핵심 |
| `pages/community.html`, `pages/my-trees.html`, `pages/login.html` | 주요 페이지 |
| `netlify/functions/_lib/db-api.js` | 서버 API 권장 진입점 |
| `netlify/functions/_lib/document-store.js` | PostgreSQL store |
| `tests/editor-*.spec.js`, `tests/smoke.spec.js` | 테스트 |
| `assets/css/*` | 운영 CSS |

### 6.2 DEPRECATED - 사용 권장 안 함

| 파일/폴더 | 이유 |
|----------|------|
| `src/postgres-client.js` | 서버 전용, 브라우저는 postgres-client-browser.js |
| `src/api.js` | netlify/functions로 대체됨 |

### 6.3 ARCHIVE - 보관됨 (이미 이동됨)

| 파일/폴더 | 이유 |
|----------|------|
| `archive/recovered-legacy/` | ✅ 이동 완료 - 복구된 레거시 파일 |
| `archive/pages-old-20260413/` | 이전 페이지 백업 |
| `archive/legacy-ui-20260413/` | 레거시 UI 컨셉 |
| `archive/prototype-snapshots-20260413/` | 프로토타입 스냅샷 |

### 6.4 PENDING - 판단 보류

| 파일/폴더 | 이유 |
|----------|------|
| `src/add-memory.js` | mobile로 리다이렉트, 사용 여부 확인 필요 |
| `src/payment.js` | payment config 있을 때만 활성화 |
| `pages/home.html` | minimal animation only |
| `pages/about.html` | 정적 페이지 |
| `pages/settings.html` | 설정 페이지 |
| `netlify/functions/payment-verify.js` | 조건부 사용 |

### 6.5 DELETE LATER - 향후 삭제 검토

| 파일/폴더 | 이유 |
|----------|------|
| `archive/` (recovered-legacy 제외) | 운영 미사용, 백업만 있음 |

---

## 7. 핵심 파일 Top 50

다음 작업 전 반드시 확인할 파일 순위:

1. `src/shared.js` - 공유 로직
2. `src/shared-layout.js` - GNB + Auth UI
3. `src/auth.js` - 인증
4. `src/firebase-firestore-compat.js` - 브라우저 shim
5. `src/postgres-client-browser.js` - 브라우저 DB 클라이언트
6. `src/runtime-config.js` - 런타임 설정
7. `src/concept-state.js` - 페이지 상태
8. `pages/community.html` - 커뮤니티 페이지
9. `pages/my-trees.html` - 마이 트리
10. `pages/editor.html` - 에디터 (37 스크립트)
11. `src/editor-bootstrap.js` - 에디터 부트 (위험)
12. `src/editor-runtime.js` - 에디터 런타임 (위험)
13. `src/editor-data.js` - 에디터 데이터 (위험)
14. `src/editor-actions.js` - 에디터 액션 (위험)
15. `src/editor-comments.js` - 에디터 댓글
16. `src/flow-shared.js` - 커뮤니티 탐색
17. `src/entries/index.js` - 메인 진입
18. `src/entries/owner.js` - 오너 진입
19. `src/entries/admin.js` - 관리자 진입
20. `src/index-runtime.js` - 메인 런타임
21. `src/index-data.js` - 메인 데이터
22. `src/index-render.js` - 메인 렌더링
23. `src/owner-runtime.js` - 오너 런타임
24. `src/owner-api-client.js` - 오너 API
25. `src/admin-bootstrap.js` - 관리자 부트
26. `src/admin-users.js` - 사용자 관리
27. `src/admin-stats.js` - 통계
28. `netlify/functions/_lib/db-api.js` - 서버 API
29. `netlify/functions/_lib/document-store.js` - PostgreSQL store
30. `netlify/functions/_lib/firebase-auth.js` - Auth 검증
31. `netlify/functions/firestore-api.js` - API shim
32. `assets/css/app.css` - 앱 스타일
33. `assets/css/editor-core.css` - 에디터 코어 스타일
34. `tests/editor-smoke.spec.js` - 에디터 무결성 테스트
35. `tests/editor-fieldvalue.spec.js` - FieldValue 테스트
36. `tests/smoke.spec.js` - 페이지 회귀 테스트
37. `docs/ops/PR_CHECKLIST.md` - PR 체크리스트
38. `docs/ops/EDITOR_ARCHITECTURE.md` - 에디터 아키텍처
39. `AGENTS.md` - 개발자 가이드
40. `README.md` - 프로젝트 문서
41. `src/shared-utils.js` - 유틸리티
42. `src/shared-dom.js` - DOM 유틸
43. `src/shared-theme.js` - 테마
44. `src/shared-storage.js` - 스토리지
45. `src/index-i18n.js` - 다국어
46. `src/index-artists.js` - 아티스트 데이터
47. `src/community-compose.js` - 커뮤니티 작성
48. `src/community-render.js` - 커뮤니티 렌더링
49. `src/community-ui.js` - 커뮤니티 UI
50. `netlify/functions/ai-helper.js` - AI 도우미

---

## 8. 분류 기준

| 용어 | 정의 | 예시 |
|------|------|------|
| ✅ KEEP | 핵심 운영 파일, 절대 삭제 금지 | `src/shared.js`, `pages/community.html` |
| ⚠️ INACTIVE | 파일은 존재하지만 리다이렉트/미사용 | `pages/editor-desktop.html` |
| 🗑️ DEPRECATED | 사용 권장 안 함 (코드에서 참조 안 함) | `src/postgres-client.js` |
| 📦 ARCHIVE | 파일系统中移动, 백업으로 보관됨 | `archive/recovered-legacy/` |
| ⏳ PENDING | 판단 보류, 사용 여부 확인 필요 | `src/payment.js` |
| 🗑️ DELETE LATER | 향후 삭제 검토 대상 | `archive/old-ui/` 일부 |

---

## 9. 다음 작업 전 확인 체크리스트

### Shared/Standard 페이지 수정 시 (필수)
- [ ] `smoke.spec.js` 실행 → UI element presence 통과
- [ ] `architecture-v2.spec.js` 실행 → app-loaded + auth UI + 에러 마스킹 통과
- [ ] `editor-smoke.spec.js` 실행 → 에디터 쉘 무결성 확인

### Editor 수정 시 (필수)
- [ ] `editor-smoke.spec.js` 실행 → shell 무결성
- [ ] FieldValue 관련 수정 시: `editor-fieldvalue.spec.js` 실행 → shim 변환 검증 (소스 패턴 + network payload)

### Archive/비활성 파일 정리 시 (선택)
- [ ] `archive/old-ui/` 정리 검토 (3개월마다)
- [ ] pages/ INACTIVE 페이지 리다이렉트 동작 확인
- [ ] `src/add-memory.js` 사용 여부 확인 필요 (PENDING)
- [ ] `src/payment.js` 조건부 사용 여부 확인 필요 (PENDING)

---

**최종 업데이트**: 2026-04-13
**작성자**: Sisyphus
**용도**: Lovetree 프로젝트 파일 분류 및 작업 가이드