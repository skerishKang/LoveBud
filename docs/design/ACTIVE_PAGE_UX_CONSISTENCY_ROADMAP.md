# Active Page UX Consistency Roadmap

이 문서는 LoveBud active production page의 UX consistency 개선을 PR 단위로 분리하기 위한 roadmap입니다.

## Purpose

- active page UX consistency 개선 범위를 copy, hierarchy, motion, browser smoke로 분리합니다.
- 한 PR에 copy, CSS hierarchy, runtime motion, route behavior를 섞지 않도록 합니다.
- Cloudflare Pages + Modal active runtime을 기준으로 검증 순서를 명확히 합니다.
- Search mobile selected preview / scroll issue, Settings route flicker, Editor smoke는 별도 트랙으로 유지합니다.

## Target active pages

이번 roadmap의 active page 범위는 다음 파일입니다.

```text
index.html
pages/intro.html
pages/search.html
pages/my-trees.html
pages/detail.html
pages/login.html
pages/settings.html
```

## Excluded paths and workstreams

다음 항목은 이 roadmap의 직접 구현 대상이 아닙니다.

```text
pages/editor.html
PR #7
prototype/reference/demo/variant paths
quiet/
hotspot-prototype/
scrapbook-demo/
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
pages/gpt-svg-tree/
```

## Related separate tracks

- `#204` Editor smoke는 별도입니다.
- `#243` Settings route flicker / return navigation은 별도입니다.
- Search mobile selected preview / scroll issue는 별도 UX bug로 분리합니다.
- Search runtime 작업은 open PR `#217` Search event delegation과 충돌 가능성을 확인해야 합니다.

## Recommended sequence

1. Docs roadmap
   - 이 문서와 인덱스 링크만 추가합니다.
   - runtime, HTML, CSS, JS 변경은 금지합니다.

2. Search / MyTrees / Login copy-only pass
   - Home / Intro와 용어, CTA, 안내 문구 흐름을 맞춥니다.
   - CSS 수정은 금지합니다.
   - layout, motion, routing 변경은 금지합니다.

3. Heading / CSS hierarchy pass
   - active page heading scale, section rhythm, CTA hierarchy를 비교합니다.
   - runtime JS 변경은 금지합니다.
   - broad global CSS injection은 금지합니다.

4. Shared opt-in transition / reveal primitive
   - 공통 transition 또는 reveal primitive가 필요하면 opt-in 구조로 설계합니다.
   - `prefers-reduced-motion` 대응은 필수입니다.
   - global default animation 주입은 금지합니다.

5. Home / Intro / Search opt-in
   - 공개 진입 흐름의 motion consistency만 제한적으로 적용합니다.
   - Browse/Search data loading, preview placement, API behavior와 섞지 않습니다.

6. Login / Detail / MyTrees opt-in
   - page-specific smoke가 가능한 단위로 분리합니다.
   - Auth/session behavior, Detail data read, MyTrees owner flow 변경과 섞지 않습니다.

7. Settings navigation / flicker
   - `#243` 별도 트랙에서 진행합니다.
   - 이 roadmap PR과 병합하지 않습니다.

## Guardrails

- copy-only PR은 CSS 수정 금지입니다.
- CSS hierarchy PR은 runtime JS 수정 금지입니다.
- motion PR은 broad global injection 금지입니다.
- motion PR은 `prefers-reduced-motion` 대응이 필수입니다.
- Search runtime 작업은 PR `#217` 및 모바일 selected preview / scroll issue와 충돌 가능성을 먼저 확인합니다.
- Editor, PR #7, prototype/reference/demo/variant 경로는 수정하지 않습니다.
- active runtime source of truth는 Cloudflare Pages + same-origin `/api/*` + Modal 기준입니다.
- Netlify/Vercel legacy artifact 정리는 별도 audit 이후에만 진행합니다.

## Browser smoke checklist

각 implementation PR은 범위에 맞게 아래 항목 중 필요한 smoke를 선택합니다.

### Common active page smoke

- 대상 page가 Cloudflare Preview 또는 fixed test slot에서 로드됩니다.
- fatal console error가 없습니다.
- horizontal overflow가 없습니다.
- desktop 1440px, tablet 1024px, mobile 375px 또는 390px에서 핵심 heading과 CTA가 보입니다.
- keyboard focus가 새로 깨지지 않습니다.
- `prefers-reduced-motion` 환경에서 motion이 과도하게 동작하지 않습니다.

### Copy-only smoke

- 변경된 문구가 Korean / English i18n에서 누락 없이 반영됩니다.
- CTA href는 변경되지 않습니다.
- layout shift나 overflow가 발생하지 않습니다.

### CSS hierarchy smoke

- header, hero, primary CTA, secondary CTA hierarchy가 active page 간 일관됩니다.
- 기존 component owner CSS 범위를 벗어난 override가 없습니다.
- mobile viewport에서 button/card overflow가 없습니다.

### Motion smoke

- initial load reveal이 content visibility를 막지 않습니다.
- user interaction 후 focus 위치가 유지됩니다.
- Search/Browse list scroll position을 불필요하게 변경하지 않습니다.
- reduced motion 환경에서 animation이 축소됩니다.

### Search-specific caution

- card click / keyboard select behavior는 PR `#217`과 충돌 여부를 먼저 확인합니다.
- mobile selected preview placement와 scroll behavior는 별도 UX bug로 처리합니다.
- Search preview, URL state, API data loading 변경은 copy/hierarchy/motion PR에 포함하지 않습니다.

## Non-goals

- Editor UI/JS 개선
- PR #7 prototype 처리
- prototype/reference/demo/variant 정리
- Search mobile selected preview / scroll behavior 수정
- Settings route flicker 수정
- Auth/API/Modal behavior 변경
- broad global CSS or JS restructuring

## One-line rule

```text
Active page UX consistency work must stay staged: copy first, hierarchy second, motion last, with Search mobile preview and Settings navigation tracked separately.
```
