# Prototype Reference Preservation Policy

이 문서는 LoveBud 저장소의 prototype / reference 폴더를 repo cleanup 과정에서 자동 삭제하거나 이동하지 않기 위한 보존 정책입니다.

## 1. Policy summary

Prototype / reference 폴더는 현재 production flow에 직접 연결되어 있지 않더라도 삭제 후보로 단정하지 않습니다.

아래 성격의 파일과 폴더는 LoveBud 디자인 탐색, 둘러보기 경험, 트리 시각화, 랜딩 스타일 비교를 위한 reference asset으로 보존합니다.

- landing / browse / editor visual experiment
- tree visualization prototype
- scrapbook / hotspot / demo interaction reference
- AI-generated or GPT-generated UI prototype
- hidden experiment page
- PR discussion에 남은 design exploration artifact

## 2. Protected prototype/reference paths

다음 경로는 repo hygiene, cleanup, unused-file 정리 과정에서 자동 삭제/이동/ignore 대상이 아닙니다.

```text
pages/gpt-v2/
assets/gpt-v2/
pages/gpt-svg-tree/
```

또한 아래 패턴의 demo/reference 폴더도 파일명만 보고 삭제 후보로 단정하지 않습니다.

```text
hotspot-prototype*
scrapbook-demo*
prototype*
reference*
demo*
```

중요:

- `pages/gpt-svg-tree/` 및 PR #7 관련 prototype은 보존합니다.
- PR #7을 close하거나 branch를 삭제하지 않습니다.
- production artifact 우려가 있더라도 현재 정책은 보존 우선입니다.
- 실제 이동/삭제/ignore 처리가 필요하면 CTO 별도 승인이 필요합니다.

## 3. Repo hygiene rule

Repo hygiene 작업자는 다음을 금지합니다.

- prototype/reference 폴더 자동 삭제
- prototype/reference 폴더 자동 이동
- prototype/reference 폴더 `.gitignore` 추가
- PR #7 관련 파일 삭제
- `pages/gpt-svg-tree/` 삭제 또는 branch cleanup
- 파일명만 보고 unused artifact로 단정

정리가 필요해 보이는 경우에는 먼저 아래 정보를 보고해야 합니다.

1. 대상 경로
2. 현재 production navigation/API와 연결 여부
3. 디자인 reference로 남길 가치
4. production artifact 우려
5. 삭제/이동/보존 중 권장 판단
6. CTO 승인 필요 여부

## 4. Production artifact concern

Prototype/reference 폴더가 `pages/` 또는 `assets/` 아래에 있으면 정적 배포 산출물에 포함될 수 있습니다.

그러나 현재 정책은 다음 순서로 판단합니다.

1. 먼저 보존한다.
2. production 노출 우려를 문서화한다.
3. 숨김 경로, 라우팅 차단, archive 이동, 삭제 중 어떤 처리가 필요한지 별도 검토한다.
4. CTO 승인 전에는 이동/삭제하지 않는다.

즉, production artifact 우려는 삭제의 자동 근거가 아닙니다.

## 5. Specific PR #7 rule

PR #7 `experiment: SVG tree prototype`은 오래된 open/draft PR이지만, tree visualization reference로 보존합니다.

정책:

- PR #7 close 금지
- PR #7 branch 삭제 금지
- PR #7 관련 `pages/gpt-svg-tree/` 파일 삭제 금지
- PR #7을 main에 merge할지, archive할지, close할지는 CTO가 별도 판단합니다.

## 6. Review checklist

Prototype/reference 관련 변경 PR을 검토할 때 아래를 확인합니다.

- 변경 파일에 `pages/gpt-v2/`, `assets/gpt-v2/`, `pages/gpt-svg-tree/`가 포함되어 있는가
- `hotspot-prototype*`, `scrapbook-demo*`, `prototype*`, `reference*`, `demo*` 패턴의 폴더가 포함되어 있는가
- 삭제/이동/ignore가 포함되어 있는가
- CTO 별도 승인이 명시되어 있는가
- production artifact 우려와 design reference 가치가 함께 기록되어 있는가

## 7. One-line rule

```text
Prototype/reference folders are preserved design assets, not automatic cleanup targets.
```
