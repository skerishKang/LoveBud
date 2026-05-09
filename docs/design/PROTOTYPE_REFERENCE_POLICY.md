# Prototype Reference Preservation Policy

이 문서는 LoveBud 저장소의 prototype / reference / demo / variant 폴더를 repo cleanup 과정에서 자동 정리하지 않기 위한 보존 정책입니다.

Detailed prototype / variant / demo / reference path inventory is maintained in [`docs/reference/PROTOTYPE_INDEX.md`](../reference/PROTOTYPE_INDEX.md) as the canonical reference-only inventory.

## 1. Policy summary

Prototype / reference / demo / variant 폴더는 현재 production flow에 직접 연결되어 있지 않더라도 cleanup 후보로 단정하지 않습니다.

아래 성격의 파일과 폴더는 LoveBud 디자인 탐색, 둘러보기 경험, 트리 시각화, 랜딩 스타일 비교, 인터랙션 비교를 위한 reference asset으로 보존합니다.

- landing / browse / editor visual experiment
- tree visualization prototype
- scrapbook / hotspot / demo interaction reference
- AI-generated or GPT-generated UI prototype
- quiet home landing visual experiment
- hidden experiment page
- PR discussion에 남은 design exploration artifact

## 2. Protected prototype/reference paths

다음 경로는 repo hygiene, cleanup, unused-file 정리 과정에서 자동 cleanup 대상이 아닙니다.

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

또한 아래 패턴의 demo/reference 폴더도 파일명만 보고 cleanup 후보로 단정하지 않습니다.

```text
hotspot-prototype*
scrapbook-demo*
prototype*
reference*
demo*
variant*
```

중요:

- `hotspot-prototype/`는 hotspot interaction / layout exploration / prototype reference artifact입니다.
- `scrapbook-demo/`는 scrapbook interaction / visual storytelling / demo reference artifact입니다.
- `quiet/`는 quiet home landing visual experiment / historical UI reference artifact입니다.
- `quiet/`는 이름에 `prototype`, `demo`, `variant`가 없더라도 보존 대상입니다.
- `pages/gpt-svg-tree/` 및 PR #7 관련 prototype은 보존합니다.
- PR #7을 close하거나 branch를 정리하지 않습니다.
- production artifact 우려가 있더라도 현재 정책은 보존 우선입니다.
- 실제 정리가 필요하면 CTO 별도 승인이 필요합니다.

## 3. Repo hygiene rule

Repo hygiene 작업자는 다음을 금지합니다.

- prototype/reference/demo/variant 폴더 자동 cleanup
- protected reference artifact를 파일명만 보고 unused artifact로 단정
- protected reference artifact를 `.gitignore`에 추가
- protected reference artifact를 route 차단 또는 hide 처리
- PR #7 관련 파일 정리
- `hotspot-prototype/`, `scrapbook-demo/`, `quiet/`를 이름만 보고 unused artifact로 단정

정리가 필요해 보이는 경우에는 먼저 아래 정보를 보고해야 합니다.

1. 대상 경로
2. 현재 production navigation/API와 연결 여부
3. 디자인 reference로 남길 가치
4. production artifact 우려
5. 보존 또는 별도 정리 중 권장 판단
6. CTO 승인 필요 여부

## 4. Production artifact concern

Prototype/reference/demo/variant 폴더가 `pages/`, `assets/`, `css/`, 또는 top-level static folder 아래에 있으면 정적 배포 산출물에 포함될 수 있습니다.

그러나 현재 정책은 다음 순서로 판단합니다.

1. 먼저 보존한다.
2. production 노출 우려를 문서화한다.
3. 숨김 경로, 라우팅 차단, archive 이동, 삭제 중 어떤 처리가 필요한지 별도 검토한다.
4. CTO 승인 전에는 정리하지 않는다.

즉, production artifact 우려는 자동 cleanup의 근거가 아닙니다.

## 5. Specific PR #7 rule

PR #7 `experiment: SVG tree prototype`은 오래된 open/draft PR이지만, tree visualization reference로 보존합니다.

정책:

- PR #7 close 금지
- PR #7 branch cleanup 금지
- PR #7 관련 `pages/gpt-svg-tree/` 파일 cleanup 금지
- PR #7을 main에 merge할지, archive할지, close할지는 CTO가 별도 판단합니다.

## 6. Production promotion rule

보존 reference artifact를 운영에 편입하려면 다음 기준을 따릅니다.

- prototype/reference/demo/variant 경로를 그대로 production navigation에 연결하지 않습니다.
- current production page, CSS, JS, API 구조에 맞춰 별도 production implementation PR에서 재구현합니다.
- 해당 PR에는 CTO의 명시 승인이 필요합니다.
- active runtime source of truth는 운영 `pages/*.html`, active CSS/JS, Cloudflare Pages Functions, Modal runtime 기준으로 판단합니다.

## 7. Review checklist

Prototype/reference 관련 변경 PR을 검토할 때 아래를 확인합니다.

- 변경 파일에 protected reference artifact 경로가 포함되어 있는가
- `hotspot-prototype*`, `scrapbook-demo*`, `prototype*`, `reference*`, `demo*`, `variant*` 패턴의 폴더가 포함되어 있는가
- `quiet/`가 포함되어 있는가
- cleanup/route-block/hide 처리가 포함되어 있는가
- CTO 별도 승인이 명시되어 있는가
- production artifact 우려와 design reference 가치가 함께 기록되어 있는가
- `docs/reference/PROTOTYPE_INDEX.md`의 canonical inventory와 충돌하지 않는가

## 8. One-line rule

```text
Prototype/reference/demo/variant folders are preserved design assets, not automatic cleanup targets.
```
