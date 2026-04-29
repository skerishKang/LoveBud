# Prototype / Variant Reference Index

이 문서는 LoveBud 저장소의 prototype / variant / demo / reference 계열 파일을 reference artifact로 보존하기 위한 canonical inventory입니다.

공식 사용자-facing 주소는 `https://lovebud.pages.dev/`입니다. 현재 active production route는 운영 `pages/*.html` 구조를 기준으로 판단합니다. 아래 경로는 active production route 또는 active production candidate가 아닙니다.

## 1. Purpose

- prototype / variant / demo / reference 파일을 reference artifact로 보존합니다.
- 운영 사용자-facing 화면과 혼동되지 않도록 분류합니다.
- 향후 cleanup 작업자가 임의로 정리하지 않도록 기준을 제공합니다.
- PR #7 관련 artifact와 prototype / reference / demo / variant 계열 파일은 자동 cleanup 대상이 아님을 명시합니다.

## 2. Operating standard

- 아래 경로들은 현재 공식 운영 navigation에 노출하지 않습니다.
- 아래 경로들은 신규 기능 구현 대상이 아닙니다.
- 아래 경로들은 active production route가 아닙니다.
- 아래 경로들은 active runtime source of truth가 아닙니다.
- 아래 경로들은 자동 cleanup 대상이 아닙니다.
- 직접 URL 접근은 reference 확인 목적상 허용합니다.
- production 사용자-facing 경로로 홍보하거나 연결하지 않습니다.
- 운영 편입이 필요하면 별도 PR에서 current production 구조로 재구현합니다.

## 3. Preservation standard

- PR #7 관련 artifact는 반드시 보존합니다.
- prototype / variant / demo / reference 원본 파일의 변경은 CTO 승인 전까지 금지합니다.
- 원본성 보존을 우선합니다.
- README 또는 `docs/doc_index.md`에서 링크할 경우 `reference only` 라벨을 명시합니다.

## 4. Current preserved reference artifact paths

| Path | Current tree status | Classification | Production status | Policy |
| --- | --- | --- | --- | --- |
| `pages/gpt-v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `css/gpt-v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `assets/gpt-v2/` | Present in current main | Prototype Asset / Design Variant Support | Not active production route | Protected Reference Artifact |
| `pages/gemini-v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `css/gemini-v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `pages/gemini-v3/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `css/gemini-v3/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `pages/v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `css/v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `pages/kimi-v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `assets/css/kimi-v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `assets/js/kimi-v2/` | Present in current main | Prototype Interaction Support / Historical UI Exploration | Not active production route | Protected Reference Artifact |
| `hotspot-prototype/` | Present in current main | Hotspot Interaction / Layout Exploration / Prototype Reference | Not active production route | Protected Reference Artifact |
| `scrapbook-demo/` | Present in current main | Scrapbook Interaction / Visual Storytelling / Demo Reference | Not active production route | Protected Reference Artifact |
| `quiet/` | Present in current main | Quiet Home Landing Visual Experiment / Historical UI Reference | Not active production route | Protected Reference Artifact |
| `quiet/home.html` | Present in current main | Quiet Home Mobile/Narrow Landing Prototype | Not active production route | Protected Reference Artifact |
| `quiet/home-desktop.html` | Present in current main | Quiet Home Desktop Landing Prototype | Not active production route | Protected Reference Artifact |
| `pages/gpt-svg-tree/` | PR #7 preserved artifact | Hidden Tree Visualization Experiment | Not active production route | Protected Reference Artifact / PR #7 untouched |

## 5. Path notes

### `pages/gpt-v2/`, `css/gpt-v2/`, and `assets/gpt-v2/`

GPT v2 page, style, and asset explorations. Preserve as reference artifacts. These paths are not production route sources of truth.

### `pages/gemini-v2/` and `css/gemini-v2/`

Gemini v2 page and style explorations. Preserve as prototype and design variant references. Do not connect to active navigation without a separate production implementation PR.

### `pages/gemini-v3/` and `css/gemini-v3/`

Gemini v3 page and style explorations. Preserve as prototype and design variant references. Do not treat as the canonical current UI.

### `pages/v2/` and `css/v2/`

Generic v2 page and styling explorations. Preserve as design variant references, not as active production routes.

### `pages/kimi-v2/`, `assets/css/kimi-v2/`, and `assets/js/kimi-v2/`

Kimi v2 page, styling, and interaction references. Preserve with the page variant set.

### `hotspot-prototype/`

Hotspot interaction, layout exploration, and prototype reference artifact. It is not an active production route or active runtime source of truth, but it has interaction reference value.

### `scrapbook-demo/`

Scrapbook interaction, visual storytelling, and demo reference artifact. It is not an active production route or active runtime source of truth, but it has visual and interaction reference value.

### `quiet/`

Quiet Home landing visual experiment and historical UI reference artifact. The folder currently includes `quiet/home.html` and `quiet/home-desktop.html`. It is not an active production route or active runtime source of truth. Because its name does not include `prototype`, `demo`, or `variant`, cleanup work must still treat it as a protected reference artifact.

### `pages/gpt-svg-tree/`

PR #7 `experiment: SVG tree prototype` related hidden tree visualization reference. Preserve the PR #7 artifact without touching PR #7 unless CTO gives explicit approval.

## 6. Future change rules

- To promote any prototype into production, open a separate PR with explicit CTO approval.
- Do not wire prototype / reference paths directly into production navigation.
- Reimplement production-bound work in the current production page, CSS, JS, and API structure.
- Reference documents may link to these paths with `reference only` labeling.
- Cleanup PRs must not modify these protected paths without explicit CTO approval.

## 7. One-line rule

```text
Prototype, variant, demo, and reference paths are protected reference artifacts, not active production routes and not automatic cleanup targets.
```
