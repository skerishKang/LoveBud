# Editor Canvas Viewport Controls Stage 22 Audit

## 배경

- Issue #1505는 대형 frontend runtime을 무리하게 쪼개는 것이 아니라, 책임 단위를 식별하고 안정적인 narrow slice로 분리하는 상위 이슈임
- Stage 13~19에서는 node drag / canvas pan 주변 저위험 DOM helper extraction을 완료했음
- Stage 20에서는 `bindCanvasPan` 내부 추가 분리를 HOLD하기로 문서화했음
- Stage 21에서는 canvas UI helper contract tests를 보강했음
- 다음 후보는 viewport control orchestration이지만, zoom/recenter/focus selected는 viewport math, selected node state, DOM control binding, init/render 흐름과 연결되어 있어 바로 분리하면 위험할 수 있음

## 현재 Viewport Control 책임 분류

| Area | Responsibility | Current owner | Risk | Recommendation |
|------|---------------|---------------|------|----------------|
| Focus selected | selected node id 확인 후 해당 node로 viewport 이동 | `editor-canvas.js` + viewport helper | **Medium** | Audit before extraction |
| Recenter canvas | offset/scale 초기화 또는 중앙 복귀 | `editor-canvas.js` + viewport helper | **Medium** | Hold until lifecycle contract is clear |
| Zoom controls | scale 변경, background/canvas transform 반영 | `editor-canvas.js` + viewport helper | **Medium** | Do not split without math tests |
| Control button binding | focus/recenter/zoom button event binding | `ui-helpers` partially | **Low** | Candidate for later narrow slice |
| Propagation guards | viewport controls mousedown/touchstart propagation 방지 | `ui-helpers` | **Low** | Already partially extracted |
| Render sync | viewport changes after `initCanvas`/render | `editor-canvas.js` | **Medium/High** | Hold |

## 위험도 분석

- Viewport controls는 단순 DOM 조작이 아니라 `viewportState.scale`, `offsetX`, `offsetY`, selected node position, canvas background/transform 계산과 연결된다.
- 버튼 이벤트 바인딩만 보면 Low risk지만, 실제 control action은 viewport math와 render lifecycle에 연결되어 **Medium risk**다.
- Stage 13~19처럼 한 줄 DOM helper로 빼기 쉬운 영역은 이미 대부분 정리됐다.
- 이제부터는 contract test 없이 runtime 코드를 움직이면 회귀 위험이 커진다.

## Hold Decision

- **Stage 22에서는 runtime 코드를 변경하지 않는다.**
- Viewport control action 로직은 당장 분리하지 않는다.
- 다음 extraction을 하려면 먼저 다음 중 하나가 필요하다:
  1. Viewport math contract tests
  2. Selected node focus behavior tests
  3. Zoom/recenter smoke checklist
  4. Current viewport helper API map
- 단순히 line count를 줄이기 위한 extraction은 하지 않는다.

## Next Recommended Slices

후보만 제안:

- **Candidate A**: viewport math contract tests
- **Candidate B**: focus selected behavior smoke checklist document
- **Candidate C**: zoom/recenter helper API map
- **Candidate D**: viewport control button binding audit
- **Candidate E**: render/init lifecycle audit
- **Candidate F**: stop runtime extraction until viewport contract is documented

## Verification Note

- 이 문서는 audit-only PR이다.
- Runtime behavior를 바꾸지 않는다.
- Browser smoke는 불필요하다.
- `npm run lint`, `npm run build`, `npm test`, `npm run verify`는 실행한다.
