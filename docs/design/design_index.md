# 디자인 문서 인덱스

이 폴더에는 LoveBud의 **UI/UX 디자인 시스템, 시각 기준, 이미지 생성 프롬프트, prototype/reference 보존 정책, UI polish 로드맵**이 저장됩니다.

## 용도
- 디자인 시스템 및 구현 규칙
- 비주얼 에셋 생성 프롬프트
- 색상, 타이포그래피, 레이아웃 기준
- UI polish 단계 분리 기준
- button / badge / chip tone 기준
- prototype/reference 폴더 보존 기준

## 폴더 구조

```
design/
├── prompts/   # 이미지 생성용 프롬프트 모음
└── index.md   # 이 문서
```

## 파일 목록

| 파일명 | 설명 |
|--------|------|
| [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) | LoveBud UI/UX 디자인 시스템과 화면 기준 |
| [UI_POLISH_ROADMAP.md](UI_POLISH_ROADMAP.md) | PR #49, PR #51 이후 public UI polish 후속 PR3/PR4/PR5 범위 분리 기준 |
| [BUTTON_BADGE_CHIP_BASELINE.md](BUTTON_BADGE_CHIP_BASELINE.md) | PR3 button / badge / chip tone 통일 기준 |
| [PROTOTYPE_REFERENCE_POLICY.md](PROTOTYPE_REFERENCE_POLICY.md) | pages/assets 하위 prototype/reference 폴더 보존 정책 |

### 프롬프트 (Prompts)

| 파일명 | 설명 |
|--------|------|
| [prompts/image-generation-prompts.md](prompts/image-generation-prompts.md) | Lovetree 이미지 생성 프롬프트 모음 (12개 화면) |
| [prompts/home-hero-slide-prompts.txt](prompts/home-hero-slide-prompts.txt) | 홈 히어로 슬라이드 이미지 생성 프롬프트 (5장) |

## Prototype / reference 보존 원칙

아래 경로와 패턴은 repo cleanup 과정에서 자동 삭제/이동/ignore 대상으로 분류하지 않습니다.

- `pages/gpt-v2/`
- `assets/gpt-v2/`
- `pages/gpt-svg-tree/`
- `hotspot-prototype*`
- `scrapbook-demo*`
- `prototype*`
- `reference*`
- `demo*`

삭제, 이동, ignore 처리가 필요하면 CTO 별도 승인이 필요합니다.

## 참조
- 전체 문서 인덱스: `../doc_index.md`
- 대화 기록: `../conversation/`
- 제품 정체성: `../product/PRODUCT_IDENTITY.md`
