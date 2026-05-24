# Stage 89 — CSS Tail Audit: gemini-v2/home.css Hold + Remaining CSS Landscape

## 1. 대상 파일

```
css/gemini-v2/home.css
```

## 2. 현재 줄 수

**263 lines** (5,553 bytes)

## 3. 경로 성격 — Prototype/Variant

### Directory 구조
```
pages/gemini-v2/
├── detail.css / detail.html
├── index.css / index.html
├── intro.css / intro.html
├── search.css / search.html
```

### CSS 파일 (직접 `<link>`): 
| 페이지 | CSS |
|--------|-----|
| `pages/gemini-v2/index.html` | `css/gemini-v2/home.css` |
| `pages/gemini-v2/intro.html` | `css/gemini-v2/intro.css` |
| `pages/gemini-v2/detail.html` | `css/gemini-v2/detail.css` |
| `pages/gemini-v2/search.html` | `css/gemini-v2/search.css` |

### 판정
**✅ Prototype/Variant 경로**

- CSS 상단 주석: `/* gemini-v2: High Fidelity Design System */`
- `gpt-v2`와 동일한 패턴 — 실험적 디자인 시스템
- 서비스 코드와 분리된 독립 프로토타입
- `css/v2/base.css`(288 lines), `pages/v2/`도 동일한 variant 계열

## 4. 경로 Hold 확인 — gpt-v2/common.css (Stage 87) 일관성

| 항목 | gpt-v2/common.css (Stage 87) | gemini-v2/home.css (Stage 89) |
|------|:---:|:---:|
| variant 경로 | ✅ | ✅ |
| 직접 `<link>` | ✅ (5 pages) | ✅ (4 pages) |
| prototype 성격 | ✅ (`TODO.md` 존재) | ✅ (`설계 시스템` 주석) |
| split 대상 | ❌ hold | ❌ hold |

→ gpt-v2와 동일한 근거로 hold 유지.

## 5. 현재까지 CSS Split 진행 현황 (Stage 89 기준)

| 단계 | 파일 | 결과 |
|:----:|------|:----:|
| Stage 53-58 | editor-canvas.js layout mode 테스트 | ✅ PR merged |
| Stage 63-64 | css/index/index.css → visual, sections | ✅ PR merged |
| Stage 65 | css/login.css split | ✅ PR merged |
| Stage 66 | css/detail.css split | ✅ PR merged |
| Stage 67 | css/settings.css split | ✅ PR merged |
| Stage 68-70 | css/my-trees, visitor-viewer, search preview | ✅ PR merged |
| Stage 71-73 | visitor-viewer-panel, my-trees-preview, search preview | ✅ PR merged |
| Stage 74 | css/editor-canvas-toolbar, 모바일 액션바 | ✅ PR merged |
| Stage 75 | css/editor-memory-form.css → subfiles | ✅ PR merged |
| Stage 76 | css/editor-floating-toolbar.css | ✅ PR merged |
| Stage 77 | css/editor-memory-form.css audit (docs) | ✅ PR merged |
| Stage 78 | css/visitor-viewer-shell.css split | ✅ PR merged |
| Stage 79 | css/editor-overrides.css hold audit | ✅ PR merged |
| Stage 80-85 | editor detail edit, search responsive, editor detail content, floating toolbar, responsive, status settings | ✅ PR merged |
| Stage 86 | CSS tail audit 문서화 | ✅ PR merged |
| Stage 87 | css/gpt-v2/common.css hold audit | ✅ PR merged |
| Stage 88 | css/editor-memory-form.css smoke audit hold | ✅ PR merged |
| **Stage 89** | gemini-v2/home.css hold + remaining audit | ← 여기 |

## 6. 남은 대형 CSS 파일 현황

### Variant / Prototype (Split 금지)
| 파일 | 줄 수 | 상태 |
|------|:-----:|:----:|
| `css/gpt-v2/common.css` | 370 | ✅ Stage 87 hold |
| `css/gemini-v2/home.css` | 263 | ✅ Stage 89 hold |
| `css/gemini-v2/detail.css` | 200 | ✅ variant hold |
| `css/gemini-v2/search.css` | 199 | ✅ variant hold |
| `css/gemini-v3/index.css` | 207 | ✅ variant (gemini 계열) |
| `css/v2/base.css` | 288 | ✅ variant hold |
| `css/v2/home.css` | (N/A) | ✅ variant hold |

### Editor Runtime Risk (Browser smoke 필요)
| 파일 | 줄 수 | 상태 |
|------|:-----:|:----:|
| `css/editor/editor-memory-form.css` | 442 | ✅ Stage 88 hold (smoke 필요) |
| `css/editor/editor-overrides.css` | 385 | ✅ Stage 79 hold |
| `css/editor/editor-canvas.css` | 298 | editor runtime, JS 결합 (미검토) |

### Protected (수정 금지)
| 파일 | 줄 수 | 상태 |
|------|:-----:|:----:|
| `css/global.css` | 556 | ✅ 사용자 지정 보호 |
| `css/global/global-header.css` | 678 | ✅ 사용자 지정 보호 |
| `css/editor/editor-memory-edit.css` | 62 | ✅ 과분리 금지 (200줄 이하) |

### 이미 Split 완료 (Sub-file, 더 이상 분리 불가)
| 파일 | 줄 수 | 비고 |
|------|:-----:|------|
| `css/intro/hero/moments.css` | 316 | 이미 intro/hero/ 하위 파일 |
| `css/intro/intro-value.css` | 242 | 이미 intro/ 하위 파일 |
| `css/search/search-controls.css` | 204 | 이미 search/ 하위 파일 |
| `css/visitor-viewer/visitor-viewer-tree.css` | 294 | 이미 visitor-viewer/ 하위 파일 |

## 7. Hold 판단

> **HOLD — gemini-v2/home.css를 split하지 않는다.**

이유:
1. Prototype/variant 경로 (`gpt-v2`와 동일한 성격)
2. `css/gemini-v2/`는 독립 디자인 시스템 — 현재 서비스 코드와 분리됨
3. 실제 페이지에서 사용되는지 확인 불가 (prototype 상태)
4. `css/v2/base.css`(288 lines)도 동일 variant 계열로 hold

## 8. CSS Split Refactoring 종합 평가 — Stage 89 기준

### 완료된 작업
- **생산 CSS 대형 파일 14개** → 하위 책임 파일로 무손실 분리 완료
- **Audit 문서 7개** (Stage 79, 86, 87, 88, 89) — hold 결정 및 위험 문서화
- 계약 테스트 15개 이상 추가

### 남은 생산 CSS
- Editor runtime 결합 파일 3개 (`editor-memory-form.css`, `editor-overrides.css`, `editor-canvas.css`) — browser smoke 없이 split 불가
- Variant/prototype 경로 7개 — split 불필요
- Protected 파일 2개 (`global.css`, `global-header.css`)
- 100-200줄 sub-file 다수 — 과분리 금지

### 결론
CSS split 리팩터링은 **Stage 89 기준 사실상 완료**에 가까움. 남은 작업은:
1. Editor browser smoke 후 `editor-memory-form.css` split (선택적)
2. `editor-overrides.css` / `editor-canvas.css` 위험 재평가 (장기)
3. `css/intro/intro-value.css`(242 lines) 단일 책임 확인 → split 불필요

## 9. #1505 OPEN 유지

- Issue #1505는 계속 OPEN 상태 유지
- close/fix/resolve keyword 사용하지 않음

## 10. PR #1570 미접촉 메모

- PR #1570은 절대 건드리지 않음
