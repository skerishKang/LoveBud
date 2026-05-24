# Stage 88 — editor-memory-form.css Smoke / Audit Hold

## 1. 대상 파일

```
css/editor/editor-memory-form.css
```

## 2. 현재 줄 수

**442 lines** (9,782 bytes)

## 3. 파일 내 책임 분류

이 파일은 **두 개의 독립적인 책임**을 포함하고 있음:

### 책임 A: Memory Form (Sidebar + Modal + Form Fields)
| 섹션 | 라인 | 설명 |
|------|:----:|------|
| Sidebar add-section | 1-66 | `.sidebar`, `.editor-add-section`, `.editor-add-card`, `.editor-add-eyebrow`, `.editor-add-intro`, `.editor-status-card p`, `.editor-sidebar-meta`, `.editor-flow-lead` |
| Canvas suppression | 63-72 | `.canvas-area.is-memory-form-open` → empty guide/topbar 숨김 |
| Form modal | 74-95 | `#addMemoryForm.editor-memory-form-modal.is-open` — 위치, 크기, 배경 |
| Form body | 97-186 | `.editor-memory-form-body`, 스크롤바, 폼 레이블/인풋/텍스트영역/도움말 |
| Video segment | 188-250 | `.editor-video-segment-grid` — named grid, start/end fields |
| Form actions | 251-266 | `.memory-link-preview.is-enhanced`, `.editor-form-actions` sticky footer |
| Mobile form | 268-295 | `@media (max-width: 560px)` — 폼 모달/바디/비디오 그리드/액션 반응형 |

### 책임 B: Memory Node (Canvas Node Cards)
| 섹션 | 라인 | 설명 |
|------|:----:|------|
| Node positioning | 297-301 | `.memory-node` position absolute, z-index, width |
| Structured layout override | 304-312 | `.layout-structured .memory-node` — cursor/transform 제거 |
| Node card | 314-322 | `.node-card` 크기, 배경, 테두리, 그림자, transition |
| Image wrapper | 324-327 | `.node-img-wrapper` 크기 |
| Node info label | 329-339 | `.node-info-label` 위치, 정렬 |
| Node text | 341-375 | `.node-title`, `.node-date`, `.node-mood` |
| User-select guard | 377-380 | `.memory-node, .memory-node * { user-select: none }` |
| Image loading | 382-394 | `.node-img-wrapper img` opacity, `.loaded` |
| Skeleton shimmer | 396-424 | `.node-skeleton`, `@keyframes skeleton-shimmer` |
| Hover/selected | 426-431 | `.memory-node:hover .node-card`, `.selected` |
| New node pulse | 433-442 | `.new-node-highlight`, `@keyframes newNodePulse` |

## 4. Hold 이유

### 4.1 Editor Runtime 상태 연결 (위험)
- `#addMemoryForm.editor-memory-form-modal.is-open` — JS가 `.is-open` 토글
- `.canvas-area.is-memory-form-open` — JS가 canvas에 class 토글
- `.layout-structured .memory-node` — layoutMode 상태에 따라 동작
- `.new-node-highlight` — JS가 new node에 animation class 추가
- `.loaded` — JS가 이미지 로드 완료 후 추가

→ **5개 이상의 JS 파일** (`editor-memory-form.js`, `editor-memory-form-mode.js`, `editor-memory-form-preview.js`, `editor-memory-form-time.js`, `editor-memory-form-payload.js`)과 상태 연결.

### 4.2 두 책임의 강한 결합
- Form 모달과 Node 카드가 **하나의 파일**에 정의됨
- `.canvas-area.is-memory-form-open`이 form open 시 canvas 내 node 요소를 제어
- Form과 Node가 서로 다른 JS 모듈에서 각각 참조

### 4.3 Animation 키프레임 의존성
- `@keyframes skeleton-shimmer` — node 이미지 로딩 중 스켈레톤
- `@keyframes newNodePulse` — 새 노드 생성 애니메이션
- 이 키프레임들이 form 파일에 있음 → split 시 이 파일이 없으면 node 애니메이션 깨짐

### 4.4 !important 사용
- `.editor-flow-lead`, `display: none !important` (line 53)
- `#addMemoryForm.editor-memory-form-modal.is-open`, `display: flex !important` (line 75)
- `.layout-structured .memory-node`, `cursor: default !important`, `transform: none !important`, `box-shadow: none !important` (lines 305-311)
- `.editor-video-segment-field`, `display: contents !important` (line 205)
- `.memory-link-preview.is-enhanced`, `margin-top: 0 !important` (line 253)
- `.new-node-highlight .node-card`, `border-color: ... !important`, `box-shadow: ... !important` (lines 435-436)

→ 8회 `!important` 사용. 분리 시 우선순위 충돌 위험.

### 4.5 Browser Smoke 없이 Split 금지
직접 확인이 필요한 항목:
- Form 모달 open → canvas suppression
- Form 모달 close → canvas 복원
- Add section 렌더링
- Form field 입력/전환
- Video segment grid CRUD
- Memory node 카드 렌더링
- Node skeleton shimmer 애니메이션
- New node pulse 애니메이션
- Structured layout node 동작
- 모바일 반응형 (560px 이하)

## 5. 필요한 Browser Smoke Checklist

### 5.1 Memory Form Open/Close
- [ ] `#addMemoryForm`에 `.is-open` 추가 시 모달 표시
- [ ] 모달이 canvas 중앙에 위치 (`left: 50%; transform: translateX(-50%)`)
- [ ] Form body scroll 동작
- [ ] Form close 시 `.is-open` 제거 → 모달 숨김
- [ ] `.canvas-area`에서 `.is-memory-form-open` 제거 → empty guide/topbar 복원

### 5.2 Add Section
- [ ] `.editor-add-section`이 sidebar 하단에 sticky
- [ ] `.editor-add-card` gradient 배경 정상 렌더링
- [ ] `.editor-add-eyebrow` (ADD MEMORY) 표시
- [ ] `.editor-flow-lead` → `display: none` 확인

### 5.3 Form Field / Modal / State
- [ ] `.editor-modal-eyebrow`, `.editor-form-label` pill 스타일
- [ ] `.editor-form-input`, `.editor-form-textarea` placeholder 색상
- [ ] `.editor-form-help` 텍스트 표시
- [ ] `.editor-memory-mode-group` mode 전환 버튼 레이아웃
- [ ] `.editor-form-actions` sticky bottom (form 내용이 길 때)

### 5.4 Video Segment Grid
- [ ] 2컬럼 그리드 레이아웃 (start/end label + input)
- [ ] 모바일에서 1컬럼 전환
- [ ] `.editor-video-segment-help` 표시

### 5.5 Canvas Suppression
- [ ] Form open 시 `.editor-canvas-empty-guide` 숨김
- [ ] Form open 시 `.editor-canvas-topbar` → `visibility: hidden; opacity: 0`
- [ ] Form close 후 모두 복원

### 5.6 Skeleton Shimmer / newNodePulse Animation
- [ ] node 이미지 로딩 중 `.node-skeleton`에 `skeleton-shimmer` 애니메이션 동작
- [ ] 이미지 로드 완료 후 `.loaded` 추가 → opacity 1
- [ ] 새 노드 생성 시 `.new-node-highlight` 추가 → `newNodePulse` 3회 재생
- [ ] `.node-skeleton.error` → 애니메이션 중지, fallback icon 표시

### 5.7 Mobile Layout
- [ ] 560px 이하에서 modal top/width/border-radius 변경
- [ ] Form body padding 축소
- [ ] Video segment grid 1컬럼 전환
- [ ] Form actions padding 축소

## 6. Split 가능 조건

아래 조건이 **모두** 충족될 때만 split 검토:

1. Browser smoke checklist **전체 통과**
2. Editor 5개 JS 파일 변경 없이 CSS만 분리 가능
3. `.canvas-area.is-memory-form-open` class를 form CSS에서 처리
4. `@keyframes skeleton-shimmer`, `newNodePulse`를 분리된 animation 파일 또는 node CSS 파일로 이동
5. `.layout-structured` 의존성을 해결 (layout mode CSS와의 관계 명확화)
6. 200줄 이상의 책임 단위로만 split (과분리 금지)

## 7. Split 금지 조건

다음 중 하나라도 해당되면 split하지 않는다:

- Browser smoke checklist 통과 못함
- JS runtime 수정 필요
- Form open/close 시 canvas 요소 깜빡임 발생
- Animation 깨짐
- 모바일 반응형 불일치

## 8. Editor-Overrides.css 계속 보류 메모

`css/editor/editor-overrides.css` (385 lines) — **Stage 79 hold 유지.**
- Cascade override 위험 높음 (`body` prefix, `!important`)
- 이 Stage에서도 split하지 않음

## 9. Editor-Memory-Edit.css 과분리 금지 메모

`css/editor/editor-memory-edit.css` (62 lines) — **Split하지 않음.**
- Stage 86 결론 "200줄 이하 과분리 금지" 적용
- Stage 88 split 후보에서 제외

## 10. #1505 OPEN 유지

- Issue #1505는 계속 OPEN 상태 유지
- close/fix/resolve keyword 사용하지 않음

## 11. PR #1570 미접촉 메모

- PR #1570은 절대 건드리지 않음
