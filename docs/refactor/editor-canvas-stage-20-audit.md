# Editor Canvas Runtime Stage 20 Audit

## 배경

- Issue #1505의 목적은 대형 frontend runtime을 무리하게 쪼개는 것이 아니라 책임 단위별로 안전하게 분리하는 것임
- Stage 13~19에서 `editor-canvas.js`의 node drag / canvas pan 주변 저위험 DOM helper extraction을 진행했음
- 이제 남은 코드는 단순 DOM helper라기보다 orchestration, viewport state, render/persist 순서와 결합되어 있으므로 추가 분리 전 hold decision이 필요함

## 완료된 Extraction 요약

| Stage | PR | Extracted responsibility | Risk level | Notes |
|-------|-----|--------------------------|------------|-------|
| 13 | #1523 | node drag start binding | Low | `beginNodeDrag` delegation order preserved |
| 14 | #1524 | canvas pan start guard | Low | DOM target guard only |
| 15 | #1525 | node drag threshold helper | Low | pure dx/dy threshold check |
| 16 | #1526 | dragged node cursor reset | Low | DOM query + cursor reset only |
| 17 | #1527 | moved toast reuse | Low | reused existing `showMovedToast` |
| 18 | #1528 | canvas pan UI reset | Low | panning class + cursor only |
| 19 | #1529 | canvas pan background position update | Low | `backgroundPosition` DOM update only |

## 현재 남은 `editor-canvas.js` 책임 분류

| Area | Responsibility | Current owner | Extraction recommendation |
|------|---------------|---------------|--------------------------|
| Node drag fallback | drag state mutation, dx/dy world position update, `initCanvas` trigger | `editor-canvas.js` | Hold for now |
| Canvas pan fallback | panning state mutation, offsets, UI update helpers | `editor-canvas.js` + `ui-helpers` | Hold after Stage 19 |
| Mouseup completion | drag/pan finalization, `shouldRender`, `persistStoredPositions`, `initCanvas` | `editor-canvas.js` | Hold |
| Viewport controls | zoom/recenter/focus selected orchestration | `editor-canvas.js` + viewport helpers | Evaluate separately |
| Layout mode | structured/free mode class and UI state | `editor-canvas.js` + `ui-helpers` | Already partially extracted |
| Persistence | stored positions persistence boundary | `editor-canvas.js` | Do not move in this phase |

## Hold Decision

`bindCanvasPan()` 내부의 남은 핵심 로직은 이벤트 입력, `viewportState` mutation, render scheduling, position persistence가 강하게 결합되어 있다. 이를 지금 더 작게 분리하면 helper는 많아지지만 실제 책임 경계가 흐려질 수 있다.

아래는 당분간 `editor-canvas.js`에 유지한다:

- `viewportState.isDraggingNode`
- `viewportState.dragNodeId`
- `viewportState.dragMoved`
- `viewportState.isPanning`
- `viewportState.offsetX / offsetY`
- `persistStoredPositions()`
- `initCanvas()`
- `shouldRender` 결정

다음 runtime extraction은 단순 한 줄 helper가 아니라, 테스트 계약과 함께 별도 설계 후 진행한다.

## Next Recommended Slices

무조건 코드 변경을 이어가지 말고, 후보만 제안:

- **Candidate A**: viewport control orchestration audit
- **Candidate B**: render/init lifecycle audit
- **Candidate C**: `editor-canvas.js` line count and responsibility map update
- **Candidate D**: dedicated contract tests for helper exports and ordering
- **Candidate E**: stop splitting `bindCanvasPan` until a higher-level interaction module boundary is defined

## Verification Note

- 이 문서는 runtime behavior를 바꾸지 않는 audit-only PR임
- 따라서 browser smoke는 불필요
- 그래도 `npm run lint`, `npm run build`, `npm test`, `npm run verify`는 실행
