# Stage 24 — Viewport Helper Contract Coverage Gap Audit

## 1. 목적
본 문서는 Stage 23에서 추가된 `tests/contracts/editor-viewport-math-contracts.test.cjs` (Math Contract Tests) 이후 남은 `editor-canvas-viewport.js` 헬퍼들의 테스트 공백(Coverage Gap)을 식별하기 위한 목적을 가집니다. 
이 오딧 문서는 향후 뷰포트 관련 런타임 추출(Runtime Extraction)을 수행하기 전, 안전망을 강화하기 위한 지표로 활용됩니다.

## 2. 현재 커버된 함수 목록
Stage 23에서 커버된 순수 수학 및 상태 변이(pure math/state mutation) 헬퍼 목록은 다음과 같습니다.
- `getNearestZoom(scale)`
- `getFitZoom(scale)`
- `getNextZoom(scale, direction)`
- `getScale(viewportState)`
- `setScale(viewportState, nextScale)`
- `setFitScale(viewportState, nextScale)`
- `projectWorldPosition(world, viewportState)`
- `applyViewport(viewportState, nextViewport, useFitScale)`
- `isAlreadyAtFit(viewportState, fitViewport)`
- `getFitViewport(options)` — (no-target fallback 케이스만 커버됨)

## 3. 아직 contract coverage가 부족한 영역 (Coverage Gap)
실제 `js/editor/editor-canvas-viewport.js`에 정의된 함수 중 아직 커버되지 않은 함수와 그 분류입니다.

### Math / Pure Bounds Calculation
- `getFitViewport(options)`: 부분 커버 (타깃 노드들이 존재하는 케이스의 바운딩 박스 및 스케일 계산 로직 미커버)
- `getReadableViewportOffset(options, preferredScale)`: 노드 위치 기반 중심 오프셋 계산 (미커버)
- `isStoredViewportExtreme(options)`: 화면 밖 극단적 좌표 여부 판별 로직 (미커버)
- `getViewportTargets(options)`: 타깃 필터링 (순수 함수에 가까우나 DI 모킹 필요)

### Viewport State Mutation & Logic
- `prepareInitialViewport(options)`: 초기 진입 시 전체 핏(Fit) 적용 여부 결정 로직
- `zoomBy(options)`: metrics와 현재 위치를 기반으로 줌을 변경하고 중심 좌표를 보정하는 로직
- `recenterViewport(options)`: 타깃 유무 및 이미 핏 상태인지 여부에 따라 뷰포트를 중앙 정렬하는 로직

### DOM-facing & Interaction Helper (Browser Smoke 필요 영역)
- `showAlreadyAtFitFeedback()`: `window.LoveBudUI.showToast` 호출
- `drawBranch(svg, startPos, endPos)`: SVG `<path>` 요소 생성 및 DOM Append
- `bindControls(options)`: `mousedown`, `touchstart`, `click` 이벤트 리스너 바인딩, 포커스 애니메이션(flashButton) 등

### RAF / Event / Interaction Helper (Browser Smoke 필요 영역)
- `focusNodeById(options)`: 특정 노드 ID로 뷰포트 이동 후 `requestAnimationFrame`을 통해 DOM 포커스 애니메이션(`focus-animate`) 클래스 토글

## 4. 위험도 분류 (Risk Assessment)
각 미커버 영역의 특성에 따른 테스트 난이도 및 런타임 추출 위험도 분류입니다.

### Low Risk (단위 테스트 확장에 용이)
- **대상**: `getFitViewport` (타깃 존재 케이스), `getReadableViewportOffset`, `isStoredViewportExtreme`, `getViewportTargets`, `zoomBy`
- **사유**: `options`를 통해 DI(Dependency Injection)된 `getWorldPosition`, `getMetrics`, `getTreeMemories` 등을 모킹(Mocking)하여 샌드박스 환경(Node.js 등)에서 순수 로직으로 테스트가 가능합니다.

### Medium Risk (DOM Mock 또는 제한적 계약 테스트 필요)
- **대상**: `prepareInitialViewport`, `recenterViewport`
- **사유**: 순수 상태 변이 로직이지만 내부에서 `showAlreadyAtFitFeedback` 같은 DOM/UI 피드백 로직이나 `initCanvas`를 호출하는 등 부수 효과(Side-effect)와 엮여 있어 제한적인 Contract 테스트가 필요합니다.

### High Risk (실제 브라우저 환경 및 Smoke 테스트 의존)
- **대상**: `focusNodeById`, `bindControls`, `drawBranch`, `showAlreadyAtFitFeedback`
- **사유**: 실제 브라우저 레이아웃 연산(`offsetWidth` 강제 리플로우), 이벤트 전파 방지(`stopPropagation`), 터치 및 포인터 이벤트, `requestAnimationFrame` 흐름, Auth-gated Editor Flow 등에 직접적으로 의존합니다. JSDOM이나 순수 Contract Test로는 신뢰성 있는 검증이 어렵고 실제 브라우저 Smoke Checklist가 필수적입니다.

## 5. 다음 Stage 25 후보 제안
위 분석을 바탕으로 향후 진행할 Narrow Slice 리팩터링 및 안전망 강화 후보 3가지를 제안합니다.

- **Candidate A**: `getFitViewport` 타깃 바운딩 박스(target-bounds) Contract Tests 추가 (Low Risk 영역의 안전망 완성)
- **Candidate B**: `getReadableViewportOffset` 및 `zoomBy` 등 뷰포트 중심 보정 관련 Math/State Contract Tests 추가
- **Candidate C**: Editor Viewport Controls 전용 Browser Smoke Checklist 보강 (High Risk 영역의 UI/DOM 변경 전 검증 기준 수립)

## 6. Hold Decision
**현재 `js/editor/editor-canvas-viewport.js`의 Viewport Runtime Extraction(런타임 코드 분리 및 재배치)은 보류합니다.**

- **이유**: Stage 23을 통해 Math Helper에 대한 1차적인 안전망은 구축되었으나, `bindControls`나 `focusNodeById` 같은 DOM/RAF/Interaction 경계에 대한 명확한 테스트 계약 및 Browser Smoke 기준이 아직 부족합니다.
- **방향**: 다음 PR에서도 런타임 파일 구조를 변경하기보다는, Candidate A~C와 같이 Contract Test 범위 확장이나 Smoke Checklist 보강을 우선하여 안전망을 더욱 두껍게 만드는 데 집중해야 합니다.
