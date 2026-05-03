# LARGE_RUNTIME_FILE_AUDIT

Refs #656

## 기준
- 대상: 500줄 이상 또는 그에 준하는 책임 밀집 runtime 파일
- 목적: 리팩터링이 아니라 boundary 정의용 audit

## 기준 SHA
- main: dd33f93689340fbcb03d8e8237437478e549cb83

---

## 후보 파일

### js/editor.js
- 상태: 500+ (confirmed)
- 역할: bootstrap + auth + data + UI orchestration
- 문제: multi-responsibility
- 분리: entry / auth / data / orchestration

### js/editor/editor-canvas.js
- 상태: 500+ (confirmed)
- 역할: layout + render + interaction
- 문제: mixed concern
- 분리: layout / render / interaction / viewport

### js/editor/editor-detail-ui.js
- 상태: near-threshold
- 역할: detail UI + edit
- 문제: render + edit 혼합

### js/my-trees.js
- 상태: near-threshold
- 역할: auth + data + render
- 문제: page bootstrap 혼합

### modal_compute/app.py
- 상태: reduced (post #710)
- 판단: thin entrypoint 방향

### js/detail.js
- 상태: small (post #714)
- 판단: split 완료

---

## 결론
HIGH:
- editor.js
- editor-canvas.js

MEDIUM:
- editor-detail-ui.js
- my-trees.js

LOW:
- modal app
- detail.js

---

## 주의
- audit only
- code change 없음
- 실제 split은 별도 PR
