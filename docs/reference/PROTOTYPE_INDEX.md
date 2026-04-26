# Prototype / Variant Reference Index

이 문서는 LoveBud 저장소에 남아 있는 prototype / variant 계열 파일을 삭제하거나 차단하지 않고, reference artifact로 보존하기 위한 canonical index입니다.

공식 사용자-facing 주소는 `https://lovebud.pages.dev/`입니다. 현재 active production route는 운영 `pages/*.html` 구조를 기준으로 판단하며, 아래 prototype / variant 경로는 active production route 또는 active production candidate가 아닙니다.

## 1. Purpose

- prototype / variant 파일을 삭제하지 않고 reference artifact로 보존합니다.
- 운영 사용자-facing 화면과 혼동되지 않도록 분류합니다.
- 향후 cleanup 작업자가 임의로 삭제, 이동, 이름 변경, route 차단, ignore 처리하지 않도록 기준을 제공합니다.
- PR #7 관련 artifact와 prototype / reference / demo / variant 계열 파일은 자동 cleanup 대상이 아님을 명시합니다.

## 2. Operating standard

- 아래 경로들은 현재 공식 운영 navigation에 노출하지 않습니다.
- 아래 경로들은 신규 기능 구현 대상이 아닙니다.
- 아래 경로들은 active production route가 아닙니다.
- 아래 경로들은 자동 삭제 또는 cleanup 대상이 아닙니다.
- 직접 URL 접근은 reference 확인 목적상 허용합니다.
- production 사용자-facing 경로로 홍보하거나 연결하지 않습니다.
- 운영 편입이 필요하면 별도 PR에서 current production 구조로 재구현합니다.
- 운영 편입 시 prototype 경로를 그대로 production route로 사용하지 않습니다.

## 3. Preservation standard

- PR #7 관련 artifact는 반드시 보존합니다.
- prototype / variant 원본 파일의 이동, 삭제, 이름 변경은 CTO 승인 전까지 금지합니다.
- 원본성 보존을 우선합니다.
- 배너 삽입, route 차단, archive 이동, 리네임도 별도 CTO 승인 필요 항목입니다.
- README 또는 `docs/doc_index.md`에서 링크할 경우 `reference only` 라벨을 명시합니다.

## 4. Current prototype / variant paths

| Path | Current tree status | Classification | Production status | Policy |
| --- | --- | --- | --- | --- |
| `pages/gemini-v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `pages/gemini-v3/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `pages/gpt-v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `pages/kimi-v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `pages/v2/` | Present in current main | Prototype / Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `css/gemini-v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `css/gemini-v3/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `css/gpt-v2/` | Requested but not confirmed in current tree | Design Variant, if restored or found later | Not active production route | Do not infer existence; verify before changing |
| `css/v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `assets/css/kimi-v2/` | Present in current main | Design Variant / Historical UI Exploration | Not active production route | Reference Artifact |
| `assets/gpt-v2/` | Present in current main | Prototype asset / Design Variant support | Not active production route | Reference Artifact |
| `assets/js/kimi-v2/` | Present in current main | Prototype interaction support / Historical UI Exploration | Not active production route | Reference Artifact |

## 5. Path notes

### `pages/gemini-v2/`

Gemini v2 page explorations. Preserve as prototype and design variant reference. Do not connect to active navigation without a separate production implementation PR.

### `pages/gemini-v3/`

Gemini v3 page explorations. Preserve as prototype and design variant reference. Do not treat as the canonical current UI.

### `pages/gpt-v2/`

GPT v2 page explorations and related notes. Preserve as reference artifact. This path is not a production route source of truth.

### `pages/kimi-v2/`

Kimi v2 page explorations. Preserve as prototype and historical UI exploration.

### `pages/v2/`

Generic v2 page explorations. Preserve as design variant reference, not as active production route.

### `css/gemini-v2/` and `css/gemini-v3/`

Gemini variant styling references. Preserve with the matching page variants. Do not migrate, deduplicate, or remove automatically.

### `css/gpt-v2/`

This path was requested for tracking, but it was not confirmed in the current main tree during this documentation pass. Do not claim it exists without a fresh tree/listing check. If it appears later, classify it as Design Variant / Historical UI Exploration / Reference Artifact unless CTO directs otherwise.

### `css/v2/`

Generic v2 styling reference. Preserve as design variant support.

### `assets/css/kimi-v2/` and `assets/js/kimi-v2/`

Kimi v2 asset and interaction references. Preserve with the page variant set.

### `assets/gpt-v2/`

GPT v2 asset reference. Preserve as prototype support artifact.

## 6. Future change rules

- To promote any prototype into production, open a separate PR with explicit CTO approval.
- Do not wire prototype paths directly into production navigation.
- Reimplement production-bound work in the current production page, CSS, JS, and API structure.
- Reference documents may link to these paths with `reference only` labeling.
- Cleanup PRs must not delete, move, rename, hide, or route-block these paths without explicit CTO approval.

## 7. One-line rule

```text
Prototype and variant paths are reference artifacts, not active production routes and not automatic cleanup targets.
```
