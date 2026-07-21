> **Superseded note (2026-07-21):** Current product layout policy is defined in `docs/product/LAYOUT_MODES_CONTRACT.md` (#3581). This audit remains a historical investigation record and must not be treated as current runtime truth.

# LoveBud Tree Layout Persistence and Viewer Ownership Audit

**Issue:** #3055  
**Status:** Audit-Only — Decision Record  
**Date:** 2026-06-30  
**Branch:** audit/tree-layout-persistence-ownership  
**Author:** Automated audit (static code analysis only)

Refs #3054  
Refs #1882

---

## 1. 범위와 비목표

### 범위

이 문서는 **#3055 audit-only** 작업의 결과물이다.

- LoveBud editor free-layout, structured mode, localStorage, read-only viewer, My Trees, Browse의 **실제 코드상 저장·조회 경계**를 정적으로 조사한다.
- 이후 #3057 / #3056 / #3058 / #3059 / #3060으로 이어지는 **신뢰 가능한 decision record**를 만드는 것이 목적이다.

### 비목표

- **DB/API/schema migration 없음**: Neon, Firebase, 또는 기타 서버 스토리지에 대한 schema 변경 없음.
- **runtime behavior 변경 없음**: editor, viewer, My Trees, Browse의 기존 동작 변경 없음.
- **브라우저·실계정 검증은 이번 작업에서 수행하지 않음**: 수동 검증 매트릭스는 문서 섹션 6으로 분리 작성.
- CSS, HTML, editor UI, Cloudflare, Modal 변경 없음.

---

## 2. 조사 근거 표

코드 근거를 기반으로 surface별 read/write 경로를 정리한다.

| surface / 기능 | 파일 경로 | 함수 / 코드 boundary | 읽는 key | 쓰는 key | 코드상 관찰 | 신뢰 수준 |
|---|---|---|---|---|---|---|
| Owner Editor — 초기 로드 | `js/editor/editor-canvas.js` L30–31, 151–179 | `createEditorCanvas()` → `loadStoredLayout()`, `loadLayoutMode()` | `lovebud_tree_layout_v2_<treeId>`, `lovebud_tree_layout_mode_<treeId>` | 없음 | `canEdit` 파라미터 없이 read만 수행. `viewportState` 초기화에 사용됨. | 코드로 확인됨 |
| Owner Editor — drag 완료 | `js/editor/editor-canvas.js` L759–771, `js/editor/editor-canvas-layout-storage.js` L45–63 | `bindCanvasPan()` → `persistStoredPositions()` | 없음 | `lovebud_tree_layout_v2_<treeId>` | `canEdit === false`면 즉시 return. `layoutMode === 'structured'`이면 persist 건너뜀. | 코드로 확인됨 |
| Owner Editor — 줌/패닝 | `js/editor/editor-canvas.js` L717–738, L788–799 | `bindWheelZoom()`, `zoomBy()` → `persistStoredPositions()` | 없음 | `lovebud_tree_layout_v2_<treeId>` | wheel zoom, zoom button 이벤트 완료 시마다 persist. | 코드로 확인됨 |
| Owner Editor — resize | `js/editor/editor-canvas.js` L307–312 | `bindResizeHandling()` → `persistStoredPositions()` | 없음 | `lovebud_tree_layout_v2_<treeId>` | window resize handler 완료 후 persist. | 코드로 확인됨 |
| Owner Editor — viewport recenter | `js/editor/editor-canvas.js` L683–696 | `recenterViewport()` → `persistStoredPositions()` | 없음 | `lovebud_tree_layout_v2_<treeId>` | recenter 완료 시 persist. | 코드로 확인됨 |
| Owner Editor — layout mode 전환 | `js/editor/editor-canvas.js` L144–148, `js/editor/editor-canvas-layout-storage.js` L38–43 | `persistLayoutMode(mode)` | 없음 | `lovebud_tree_layout_mode_<treeId>` | `canEdit === false`면 즉시 return. `free`/`structured` 두 값만 허용. | 코드로 확인됨 |
| Public/read-only viewer | `js/viewer/public-canvas-init.js` L355–358, L370 | `buildEditorCanvasOptions()` → `canEdit: false`, `installPublicCanvasReadOnlyState()` | `lovebud_tree_layout_v2_<treeId>` (읽기만) | 없음 | `canEdit: false`로 고정되어 `persistStoredPositions`, `persistLayoutMode` 모두 skip됨. 그러나 `loadStoredLayout()`은 호출됨 → **같은 브라우저라면 owner local draft를 읽을 수 있음.** | 코드로 확인됨 |
| Public/read-only viewer — mobile | `js/viewer/public-canvas-mobile-layout.js` L10–21 | `installMobileStructuredLayoutDefault()` | `lovebud_tree_layout_v2_<treeId>` (읽음) | 없음 | portrait mobile(≤560px)이면 `loadLayoutMode`만 monkey-patch하여 항상 `'structured'`를 반환합니다. 그러나 `loadStoredLayout()`은 바이패스하지 않고 먼저 호출하므로, `lovebud_tree_layout_v2_<treeId>`의 positions와 viewport offset, scale을 여전히 읽게 됩니다. | 코드로 확인됨 |
| My Trees — selected-tree hub | `js/my-trees.js` L354–366, `js/my-trees/my-trees-preview-hub.js` | `bootMyTrees()` → `LoveBudMyTreesPreviewHub.init()` | 없음 | 없음 | My Trees hub는 canvas(`createEditorCanvas`)를 호출하지 않음. tree metadata(title, moment count, flow preview)를 DOM에 렌더링하는 UI-only module임. layout key read/write 없음. | 코드로 확인됨 |
| Browse — selected-tree hub | `js/search.js`, `js/search/search-preview-hub-dom-patch.js` | Browse preview renderer | 없음 | 없음 | Browse hub도 My Trees hub와 동일 구조: canvas 미사용, layout key read/write 없음. | 코드로 확인됨 |
| Visitor Viewer (SVG render) | `js/visitor-viewer/visitor-viewer-render-tree.js` | `buildHierarchyLayout()`, SVG render | 없음 | 없음 | pre-computed data(`branch.startY`, `branch.endY`, 등)에서 위치를 직접 계산. localStorage를 읽거나 쓰지 않음. 완전히 독립된 renderer. | 코드로 확인됨 |
| logout / clearPrivateCaches | `js/auth.js` L675–676, `js/auth/auth-firebase.js` L388–389 | `clearPrivateCaches()` call site | 없음 | 없음 | `clearPrivateCaches`는 call site만 있고 정의체 없음 (undefined window function). `lovebud_tree_layout_*` key를 명시적으로 `removeItem`하는 코드 없음. logout 시 layout key는 그대로 잔존함. | 코드로 확인됨 |
| tree switch | `js/editor/editor-canvas.js` L27–31 | `createEditorCanvas()` init 시 `treeId` 결정 | `lovebud_tree_layout_v2_<새 treeId>` | 없음 | treeId는 `window.currentTreeData.id` 또는 URLParam으로 결정. tree switch 시 새 canvas 인스턴스가 생성되어 해당 treeId의 layout key를 독립적으로 읽음. | 코드로 확인됨 |

---

## 3. 현재 persistence 계약

### 3.1 `lovebud_tree_layout_v2_<treeId>`

**payload 구조** (코드 근거: `editor-canvas-layout.js` L47–51, `editor-canvas-layout-storage.js` L55–61):

```json
{
  "positions": { "<memoryId>": { "x": number, "y": number } },
  "offsetX": number,
  "offsetY": number,
  "scale": number
}
```

**사용 목적:**

| 필드 | 목적 | 성격 |
|---|---|---|
| `positions` | node별 free-drag 좌표 | owner-local browser draft |
| `offsetX`, `offsetY` | viewport pan offset | device-specific, browser-local |
| `scale` | viewport zoom level | device-specific, browser-local |

**중요 경계:**

- write: `canEdit !== false` AND `layoutMode !== 'structured'` 인 경우에만 기록.
- read: `canEdit` 값과 무관하게 항상 읽음 → **public viewer가 같은 브라우저라면 owner draft를 읽을 수 있다.**
- fallback: `null`, `'null'`, parse error → `{ positions: {}, offsetX: 0, offsetY: 0, scale: 1 }` 기본값 반환.
- **relationship topology와의 차이**: `positions`는 visual 좌표만 저장. 노드 간 부모-자식 관계(relationship topology)는 DB에 저장되며 이 key와 무관.
- **appreciation order와의 차이**: moment의 감상 순서(appreciation order)는 별도 계약(#3061)으로 정의. 이 key와 무관.

### 3.2 `lovebud_tree_layout_mode_<treeId>`

**payload:** 문자열 `'free'` 또는 `'structured'` (코드 근거: `editor-canvas-layout-storage.js` L30–36)

**사용 목적:**

| 값 | 목적 | 성격 |
|---|---|---|
| `'free'` (default) | drag-enabled, stored positions 사용 | owner-local mode preference |
| `'structured'` | auto-computed layout, drag disabled, stored positions 보존 | owner-local mode preference |

**중요 경계:**

- write: `canEdit !== false`인 경우에만 기록.
- read: 항상 읽음 (`canEdit` 무관).
- **Portrait Mobile 특이사항**: portrait mobile은 `loadLayoutMode()` 만 monkey-patch하여 `'structured'`를 강제로 반환하므로 mode key(`lovebud_tree_layout_mode_<treeId>`)의 값은 사용하지 않고 무시하지만, payload key(`lovebud_tree_layout_v2_<treeId>`) 자체는 바이패스하지 않고 그대로 먼저 읽어들입니다.
- fallback: key 없거나 인식 불가 → `'free'` 반환.

---

## 4. surface ownership matrix

| Surface | browser-local draft read | browser-local draft write | deterministic fallback | shared/published snapshot 사용 | 현재 위험 또는 불명확성 |
|---|---|---|---|---|---|
| **Owner Editor** | ✅ 읽음 | ✅ 씀 (canEdit 보장, structured 제외) | ✅ `{positions:{}, offsetX:0, offsetY:0, scale:1}` | ❌ 없음 | 단일 로컬 브라우저에만 존재. 다른 기기에서는 빈 레이아웃으로 시작함. |
| **Owner read-only tree view** | ⚠️ 읽음 (canEdit: false로 전달되나 read는 수행) | ❌ 쓰지 않음 | ✅ 기본값 fallback | ❌ 없음 | **코드만으로 확인 불가**: owner가 같은 브라우저에서 read-only mode로 자신의 트리를 볼 때 자신의 local draft를 읽는지, 또는 별도 route가 있는지 확인 필요. |
| **Public/read-only viewer** | ⚠️ 읽음 (같은 브라우저라면 owner draft의 positions 및 viewport offset/scale이 반영될 수 있음) | ❌ 쓰지 않음 | ✅ 기본값 fallback | ❌ 없음 | **현재 위험**: 공개 viewer에 owner의 browser-local positions(free 모드 한정) 및 viewport pan/zoom이 반영될 수 있음. |
| **Public/read-only viewer — portrait mobile** | ⚠️ 읽음 (mode는 structured로 고정되나 loadStoredLayout은 계속 실행되어 viewport offset/scale이 반영됨) | ❌ 쓰지 않음 | ✅ 기본값 fallback | ❌ 없음 | **현재 위험**: Portrait mobile의 경우, 노드의 월드 좌표 자체는 structured에 의해 무시되나, localStorage의 viewport offset/scale 및 zoom 정보가 투영(projection) 시점에 결합되어 렌더링에 영향을 줄 수 있습니다. |
| **My Trees selected-tree hub** | ❌ 읽지 않음 | ❌ 쓰지 않음 | N/A (canvas 미사용) | ❌ 없음 | hub는 tree metadata 요약만 렌더링. layout key와 완전 무관. |
| **Browse selected-tree hub** | ❌ 읽지 않음 | ❌ 쓰지 않음 | N/A (canvas 미사용) | ❌ 없음 | hub는 tree metadata 요약만 렌더링. layout key와 완전 무관. |
| **Same browser profile (owner)** | ✅ 읽음 | ✅ 씀 | ✅ | ❌ | 정상 동작 범위. |
| **Different browser/device** | ❌ 읽지 못함 | ❌ 쓰지 못함 | ✅ 기본값 (0,0,scale=1) | ❌ 없음 | **현재 구현상 경계 불명확**: 다른 기기에서 항상 기본 레이아웃으로 시작함. |

---

## 5. 현재 automatic layout 분석

### 5.1 실제 지원되는 automatic/structured layout

1. **Editor canvas `structured` mode** (`editor-canvas-layout-storage.js`, `editor-canvas.js`):
   - mode = `'structured'`이면 `persistStoredPositions`가 skip됨.
   - `getWorldPosition()`은 `layoutMode: viewportState.layoutMode`를 `editor-canvas-utils.js`로 전달하여 structured 좌표를 계산함.
   - 실제 structured 위치 계산은 `EditorCanvasGeometry.getMetrics`, `LoveBudEditorCanvasLayoutHelpers.*` (radial/hierarchical 알고리즘)에서 수행됨.

2. **Public/read-only viewer — portrait mobile** (`public-canvas-mobile-layout.js`):
   - portrait mobile(≤560px)에서는 monkey-patch로 `loadLayoutMode`가 항상 `'structured'`를 반환합니다.
   - 하지만 `loadStoredLayout()`은 계속 작동하므로 `lovebud_tree_layout_v2_<treeId>`의 데이터 로드는 이루어집니다.
   - 즉, **Portrait mobile forces the layout-mode result to structured, but does not bypass loadStoredLayout(). Stored free positions are not used for structured node world positions, while stored viewport offset and scale can still affect projected rendering.**

3. **Visitor Viewer (SVG renderer)** (`visitor-viewer-render-tree.js`):
   - `buildHierarchyLayout()`: branch-moment topology에서 좌표를 계산하는 별도 SVG renderer.
   - localStorage와 완전 무관.

### 5.2 layout 한계

| 트리 유형 | 예상 한계 | 코드 근거 |
|---|---|---|
| linear (1-depth chain) | radial 알고리즘이 1개 자식이면 baseAngle 방향 단일 배치. 노드가 많아지면 겹칠 수 있음. | `editor-canvas-layout-helpers.js` L30–40 `distributeAngles()` |
| shallow branch (L1 많음) | L1 count 기반으로 totalSpread가 최대 220°로 제한. count > 6이면 간격 좁아짐. | `distributeAngles()`: `min(220, max(90, (count-1)*36))` |
| deep branch (L2+) | L2+는 `getRadiusL2()`(130–190px)로 부모 기준 배치. 손자까지만 명시적 처리. 더 깊은 depth는 코드만으로 확인 불가. | `editor-canvas-layout-helpers.js` L26–28 |
| 8-port-created tree | 8개 포트로 생성된 트리의 포트별 위치 처리가 structured layout에 반영되는지 코드만으로 확인 불가. | **코드만으로 확인 불가 — 향후 수동 검증 필요** |

### 5.3 structured layout이 기존 free positions를 overwrite하는지

**코드로 확인됨 — overwrite하지 않는다.**

`editor-canvas-layout-storage.js` L45–46:
```js
function persistStoredPositions(viewportState, ..., canEdit) {
    if (viewportState.layoutMode === 'structured') return;  // ← structured이면 persist skip
```

structured mode에서 drag도 비활성화됨 (`editor-canvas.js` L393):
```js
nodeEl.style.cursor = canEdit !== false && viewportState.layoutMode === 'structured' ? 'default' : 'grab';
```

즉, structured mode는 pure read-only display. free positions는 localStorage에 보존됨.

### 5.4 향후 첫 automatic template recommendation

코드만으로 확인 가능한 현재 상태에서, 향후 첫 automatic template 구현 방향으로:

- **radial depth-aware layout**: `distributeAngles()` 개선으로 deep tree에서도 겹침 방지.
- **단, 구현은 이번 #3055 범위가 아님.** 후속 작업(#3057-#3060) 이후에 별도 이슈로 처리.

---

## 6. 수동 검증 매트릭스

**이 매트릭스는 실행하지 않는다. 향후 수동 검증 담당자를 위한 참고용이다.**

| scenario | 기대 관찰값 | 실제 실행 여부 | 후속 owner |
|---|---|---|---|
| drag 후 reload | drag 완료 위치가 복원됨. `lovebud_tree_layout_v2_<id>` key에 positions 저장 확인. | **미실행** | #3059 담당 |
| tree switch 후 재진입 | 각 treeId 별 독립 key → 이전 트리 위치 복원. | **미실행** | #3059 담당 |
| logout / login | layout key가 그대로 잔존함 (removeItem 코드 없음). 재로그인 후 동일 key 읽음. | **미실행** | #3057 담당 |
| cache clear (브라우저) | localStorage 삭제 → 기본값(0,0,scale=1). | **미실행** | #3057 담당 |
| private browsing | localStorage가 세션 범위. 페이지 닫으면 소멸. | **미실행** | #3057 담당 |
| localStorage disabled/quota failure | catch(e){} 블록으로 fallback. 기본값 반환. persist 실패 무시. | **미실행** | #3059 담당 |
| same browser owner editor → read-only viewer | public-canvas-init.js `canEdit: false` 적용. read는 수행하므로 owner draft positions/viewport가 viewer에 반영될 수 있음. | **미실행** | #3057 담당 |
| second browser/device | layout key 없음 → 기본값(0,0,scale=1) 렌더링. | **미실행** | #3056 담당 |
| My Trees preview | canvas 미사용. tree metadata만 표시. layout key 무관. | **미실행** | #3059 담당 |
| Browse preview | canvas 미사용. tree metadata만 표시. layout key 무관. | **미실행** | #3059 담당 |
| public viewer | canEdit:false. read 가능. write 불가. portrait mobile은 structured가 강제되나 viewportState 오프셋은 local draft가 유입될 수 있음. | **미실행** | #3057 담당 |
| free ↔ structured 전환 | 전환 시 free positions 보존. structured → free 복귀 시 기존 positions 복원. | **미실행** | #3059 담당 |
| branch depth / 8-port tree | 깊은 depth 또는 8-port 트리에서 structured auto-layout 결과 확인 필요. | **미실행** | #3058 담당 |

---

## 7. decision matrix

| 레이어 | storage owner | visibility | revision 필요성 | migration rule | risk |
|---|---|---|---|---|---|
| **private working-canvas layout** (`lovebud_tree_layout_v2_<id>`) | browser-local only | owner browser만 | 없음 (자동 덮어쓰기) | 미래 shared snapshot 도입 시 **명시적 분리 필요** | ⚠️ 현재 public viewer가 같은 브라우저에서 owner draft(positions 및 pan/zoom)를 읽을 수 있음 |
| **published/shared hub-layout snapshot** | **현재 없음** | — | — | Neon/shared 도입 시 별도 key/table 사용 (local draft 불침범 원칙) | ❌ 미구현 — #3056, #3058에서 설계 필요 |
| **automatic layout preference** (`lovebud_tree_layout_mode_<id>`) | browser-local only | owner browser만 | 없음 | 미래 서버 저장 시 별도 field | ⚠️ 다른 기기에서는 항상 `'free'` (기본값) |
| **manual layout preference** (drag 좌표) | browser-local only | owner browser만 | 없음 | local draft 보존 원칙 유지 | ⚠️ 다른 기기·공유 URL에서 재현 불가 |
| **snapshot missing/invalid fallback** | N/A | N/A | N/A | parse error → `{positions:{}, offsetX:0, offsetY:0, scale:1}` | ✅ 현재 안전 |

---

## 8. migration guardrails

향후 Neon/shared snapshot 또는 서버 저장을 도입할 때 **반드시 지켜야 하는 원칙**:

1. **future Neon/shared snapshot이 기존 localStorage free layout을 삭제·덮어쓰기·자동 migrate하지 않는다.**  
   → owner가 명시적으로 "공유 저장"을 승인하는 UI 없이는 local draft를 서버에 쓰지 않는다.

2. **local draft와 shared snapshot은 명시적으로 구분한다.**  
   → key namespace, storage layer, UI 표현 모두 분리. 같은 변수명·key명을 공유하지 않는다.

3. **public/read-only surface는 local draft를 공유된 결과처럼 표시하지 않는다.**  
   → 현재 `canEdit: false`로 write는 막혀있으나, desktop 및 portrait mobile 양쪽 모두에서 payload key read가 일어납니다 → #3057 격리 대상에 portrait mobile도 반드시 포함하여 격리해야 합니다.

4. **pointer move마다 DB write를 하지 않는다.**  
   → drag 완료 시 1회 persist 패턴 유지. 실시간 sync는 미래 scope.

5. **device-specific viewport는 shared snapshot에 포함하지 않는다.**  
   → `offsetX`, `offsetY`, `scale`은 device/browser 환경에 종속. shared snapshot에서 분리.

6. **relationship map, appreciation order, hub layout을 동일 데이터로 강제하지 않는다.**  
   → 각각의 persistence 계약은 독립적:
   - relationship map → DB (부모-자식 관계, branch topology)
   - appreciation order → #3061 계약
   - hub layout (canvas positions/viewport) → 현재 localStorage, 미래 shared snapshot

---

## 9. 후속 순서

아래 순서와 dependency를 명확히 정의한다:

| 순서 | Issue | 제목 | dependency |
|---|---|---|---|
| 1 | **#3057** | read-only surface의 browser-local layout 차단 | 이 audit (#3055) 완료 후 |
| 2 | **#3056** | draft-first / Neon checkpoint contract | #3057 완료 후 |
| 3 | **#3058** | revisioned snapshot API | #3056 완료 후 |
| 4 | **#3059** | owner local draft / save / sync UI | #3057 완료 후 |
| 5 | **#3060** | confirmed snapshot viewer rendering | #3058 완료 후 |
| 6 | **#3061** | appreciation order contract | #3060 완료 후 |

---

## 10. 코드로 확인 불가한 항목 (향후 수동 검증 필요)

아래 항목은 정적 코드 분석만으로 결론을 내리지 않는다:

1. **owner read-only view에서 local draft read 여부**: `public-canvas-init.js`에 `canEdit: false`로 canvas를 만드는 경로가 있으나, owner가 같은 브라우저에서 read-only로 자신의 트리를 볼 때 실제로 `loadStoredLayout()`이 호출되는지 확인 필요.
2. **portrait mobile에서의 viewportState 유입 영향**: mode는 structured로 강제되지만, payload read에 의해 pre-stored viewport offset/scale이 projectWorldPosition 연산 시 미치는 실질적인 시각적 영향도 수동 확인 필요.
3. **deep branch (L3+) structured layout 결과**: `editor-canvas-layout-helpers.js`는 L2+를 부모 기준 배치하나, 더 깊은 depth에서의 실제 렌더링 결과는 수동 확인 필요.
4. **8-port tree structured layout**: 8개 포트 사용 트리에서 structured auto-layout이 포트 정보를 반영하는지 코드만으로 불명확.
5. **logout 후 layout key 잔존 영향**: `clearPrivateCaches`는 정의체가 없음. layout key 잔존이 실제 UX 문제를 만드는지 수동 검증 필요.
6. **다른 기기 기본값 렌더링 UX**: `{offsetX:0, offsetY:0, scale:1}` 기본값으로 렌더링될 때 사용자 경험이 수용 가능한지 수동 검증 필요.
7. **My Trees / Browse hub → editor 전환 시 layout 복원**: hub에서 editor로 이동(`window.location.href = basePath + 'editor?treeId='`) 시 layout key가 정상적으로 읽히는지 수동 확인 필요.

---

## 부록: 조사 대상 파일 목록

| 파일 | 역할 |
|---|---|
| `js/editor/editor-canvas.js` | canvas 인스턴스 생성, treeId/key 결정, persist/load call site |
| `js/editor/editor-canvas-layout.js` | `LoveBudEditorCanvasLayout.createLayoutStore` — primary localStorage read/write |
| `js/editor/editor-canvas-layout-storage.js` | `LoveBudEditorCanvasLayoutStorage` — adapter for load/persist with canEdit guard |
| `js/editor/editor-canvas-layout-helpers.js` | radial/hierarchical geometry helpers |
| `js/viewer/public-canvas-init.js` | public canvas 생성, `canEdit: false` 주입 |
| `js/viewer/public-canvas-mobile-layout.js` | portrait mobile → structured 강제 monkey-patch |
| `js/viewer/public-viewer-canvas-adapter.js` | public canvas factory bridge |
| `js/visitor-viewer/visitor-viewer-render-tree.js` | SVG-based visitor renderer (localStorage 무관) |
| `js/my-trees.js` | My Trees hub init |
| `js/my-trees/my-trees-preview-hub.js` | My Trees hub renderer (canvas 미사용) |
| `js/search.js` | Browse page (canvas 미사용 확인) |
| `js/auth.js` | `clearPrivateCaches` call site (정의체 없음) |
| `docs/product/LAYOUT_MODES_CONTRACT.md` | 기존 layout mode contract 문서 (#1037) |
