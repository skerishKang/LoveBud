# 디자인 문서 인덱스

이 폴더에는 LoveBud의 **UI/UX 디자인 시스템, 시각 기준, 이미지 생성 프롬프트, prototype/reference 보존 정책, UI polish 로드맵**이 저장됩니다.

## 용도
- 디자인 시스템 및 구현 규칙
- 비주얼 에셋 생성 프롬프트
- 색상, 타이포그래피, 레이아웃 기준
- UI polish 단계 분리 기준
- button / badge / chip tone 기준
- prototype/reference/demo/variant 폴더 보존 기준

## 폴더 구조

```
design/
├── design_index.md   # 이 문서
├── prompts/          # 이미지 생성용 프롬프트 모음
└── stitch_image_to_website/  # Stitch/image-to-website reference design notes
```

## 파일 목록

| 파일명 | 설명 |
|--------|------|
| [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) | LoveBud UI/UX 디자인 시스템과 화면 기준 |
| [UI_POLISH_ROADMAP.md](UI_POLISH_ROADMAP.md) | PR #49, #51, #62, #63, #66, #67, #69, #70 이후 public UI polish와 Search 후속 작업 범위 분리 기준 |
| [PAGE_TRANSITION_REVEAL_COVERAGE.md](PAGE_TRANSITION_REVEAL_COVERAGE.md) | active page transition / upward reveal coverage, risk levels, and future opt-in smoke criteria |
| [BUTTON_BADGE_CHIP_BASELINE.md](BUTTON_BADGE_CHIP_BASELINE.md) | button / badge / chip tone 통일 기준 |
| [BUTTON_BASELINE_CONSOLIDATION_PLAN.md](BUTTON_BASELINE_CONSOLIDATION_PLAN.md) | global.css button baseline 중복 정의 정리 계획 |
| [PRIMARY_COLOR_TOKEN_CLEANUP_PLAN.md](PRIMARY_COLOR_TOKEN_CLEANUP_PLAN.md) | `rgba(144, 73, 81, X)` 반복을 `--primary-rgb` token 기반으로 단계 정리하기 위한 계획 |
| [PROTOTYPE_REFERENCE_POLICY.md](PROTOTYPE_REFERENCE_POLICY.md) | pages/assets/css 및 top-level prototype/reference/demo/variant 폴더 보존 정책 |

### 프롬프트 (Prompts)

| 파일명 | 설명 |
|--------|------|
| [prompts/image-generation-prompts.md](prompts/image-generation-prompts.md) | Lovetree 이미지 생성 프롬프트 모음 (12개 화면) |
| [prompts/home-hero-slide-prompts.txt](prompts/home-hero-slide-prompts.txt) | 홈 히어로 슬라이드 이미지 생성 프롬프트 (5장) |

### Reference / candidate design notes

| 파일명 | 설명 |
|--------|------|
| [stitch_image_to_website/DESIGN.md](stitch_image_to_website/DESIGN.md) | Stitch image-to-website 관련 reference design note. 현재 active UI polish source of truth는 아니며, 필요 시 reference/archive 후보로 별도 판단합니다. |

## Prototype / reference 보존 원칙

Prototype / reference / demo / variant 계열의 canonical inventory는 `../reference/PROTOTYPE_INDEX.md`입니다.

보존 대상 예시는 아래와 같습니다.

```text
pages/gpt-v2/
css/gpt-v2/
assets/gpt-v2/
pages/gemini-v2/
css/gemini-v2/
pages/gemini-v3/
css/gemini-v3/
pages/v2/
css/v2/
pages/kimi-v2/
assets/css/kimi-v2/
assets/js/kimi-v2/
hotspot-prototype/
scrapbook-demo/
quiet/
pages/gpt-svg-tree/
```

특히 `hotspot-prototype/`, `scrapbook-demo/`, `quiet/`는 active production route가 아니지만 디자인·인터랙션·랜딩 실험 레퍼런스로 보존합니다. 운영 편입이 필요하면 current production 구조에 맞춰 별도 implementation PR에서 재구현합니다.

## 참조
- 전체 문서 인덱스: `../doc_index.md`
- Prototype / reference 보존 정책: `./PROTOTYPE_REFERENCE_POLICY.md`
- Prototype / variant canonical inventory: `../reference/PROTOTYPE_INDEX.md`
- 대화 기록: `../conversation/`
- 제품 정체성: `../product/PRODUCT_IDENTITY.md`
