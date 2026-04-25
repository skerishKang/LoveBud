# Publication and Privacy UX Policy

이 문서는 LoveBud / LoveTree의 공개, 비공개, memory visibility, Browse/Search 소개 UX 정책을 정리합니다.

현재 CTO 확정 정책은 **public-first visibility + Plus private storage + separate browse eligibility**입니다. 이 문서는 제품/UX 정책의 canonical source이며, 코드 구현은 별도 frontend/backend 작업으로 분리합니다.

중요: 이 문서는 현재 main 코드가 이미 public-first로 동작한다는 의미가 아닙니다. 코드 변경 전에는 현재 구현 상태를 별도로 확인해야 합니다.

---

## 1. Canonical policy summary

1. **New trees default to public.**
   - 신규 tree의 정책상 기본 visibility는 `public`입니다.
   - frontend payload만 단독으로 바꾸지 않고, frontend/backend/runtime 정책을 함께 전환합니다.

2. **Private storage requires Plus entitlement.**
   - private tree 생성, public tree의 private 전환, 신규 private memory/storage 사용은 Plus entitlement가 필요합니다.
   - canonical entitlement field는 `users/{uid}.privateStorageEnabled`입니다.

3. **Memory visibility omitted inherits parent tree visibility.**
   - memory create/update payload에서 visibility가 생략되면 parent tree visibility를 상속합니다.

4. **Explicit memory visibility may override inheritance when backend policy allows it.**
   - 명시적 memory visibility는 backend policy가 허용하는 범위에서만 상속값을 override할 수 있습니다.
   - override가 허용되더라도 parent tree 접근 권한과 private storage guard를 우회할 수 없습니다.

5. **Public visibility and Browse/Search eligibility are separate.**
   - `visibility: public`은 공개 접근 가능 상태입니다.
   - Browse/Search 소개 가능 여부는 별도 eligibility 조건입니다.

6. **Browse/Search introduction requires `publicMomentCount >= 3`.**
   - public tree라도 공개 순간 수가 3개 미만이면 Browse/Search 소개 대상이 아닙니다.
   - 직접 링크/공개 접근 가능성과 Browse/Search 소개는 같은 뜻이 아닙니다.

7. **Child memory visibility does not by itself make a private tree browseable.**
   - private tree 아래에 public memory가 가능하더라도 Browse/Search 노출은 parent tree visibility와 browse guard를 함께 봅니다.
   - parent tree가 private이면 child public memory만으로 Browse/Search 소개 대상이 될 수 없습니다.

---

## 2. Current implementation note

현재 main 구현은 정책 전환 중간 상태일 수 있습니다. 문서의 canonical policy와 실제 코드 동작이 다를 수 있으므로 구현 작업 전에는 관련 frontend/backend/runtime 파일을 다시 확인해야 합니다.

기존 확인 기준:

- My Trees 생성 모달은 과거 private-first payload를 사용했습니다.
- backend create tree guard는 과거 public 생성 요청을 제한했습니다.
- Editor visibility toggle은 public/private 전환 UI를 제공하되 Plus entitlement guard가 완전히 연결되지 않았을 수 있습니다.
- Settings의 private storage 문구는 정책/결제 구현 상태에 따라 별도 조정이 필요합니다.

정책 전환은 다음을 함께 맞춘 뒤 진행합니다.

- tree create payload / API contract
- Cloudflare Pages Functions route policy
- Modal backend visibility policy
- entitlement check
- memory visibility inheritance
- existing private tree grandfathering
- Browse/Search eligibility filter

---

## 3. Visibility model

### 3.1. Tree visibility

Tree visibility는 해당 tree 자체가 공개 접근 가능한지 결정하는 저장 상태입니다.

정책:

- 신규 tree 기본값은 `public`입니다.
- 기존 private tree는 자동 public 전환하지 않습니다.
- `public -> private` 전환은 Plus private storage entitlement가 필요합니다.
- `private -> public` 전환은 사용자의 명시적 publish/visibility action으로 처리합니다.

### 3.2. Memory visibility inheritance

Memory visibility는 다음 순서로 결정합니다.

1. payload에 explicit visibility가 있고 backend policy가 허용하면 그 값을 사용합니다.
2. payload visibility가 생략되면 parent tree visibility를 상속합니다.
3. parent tree access policy와 private storage policy를 우회하는 explicit override는 허용하지 않습니다.

예시:

```text
parent tree visibility = public
memory visibility omitted
=> effective memory visibility = public
```

```text
parent tree visibility = private
memory visibility omitted
=> effective memory visibility = private
```

```text
parent tree visibility = private
memory visibility = public
=> backend policy가 허용한 경우에만 public memory가 될 수 있음
=> 그래도 parent tree가 private이면 Browse/Search 소개 대상은 아님
```

---

## 4. Browse/Search eligibility

Browse/Search eligibility는 공개 접근 가능 여부가 아니라 **소개 가능 여부**입니다.

Browse/Search introduction 조건:

- parent tree visibility가 `public`
- `publicMomentCount >= 3`
- Browse/Search display filter 또는 quality filter를 통과

따라서 다음을 명확히 구분합니다.

| 상태 | 의미 |
|------|------|
| public visibility | direct/public read policy상 공개 접근 가능한 상태 |
| browse/search eligible | Browse/Search 화면에서 소개될 수 있는 상태 |
| publicMomentCount | Browse/Search 소개 기준으로 계산된 공개 순간 수 |

중요 원칙:

- public tree라고 해서 즉시 Browse/Search에 노출되지 않습니다.
- `publicMomentCount >= 3`은 Browse/Search introduction guard입니다.
- `publicMomentCount >= 3`을 tree visibility 전환 조건으로 사용하지 않습니다.
- private tree 아래 public memory가 있더라도 parent tree가 private이면 Browse/Search에 노출하지 않습니다.

---

## 5. Existing private tree grandfathering

기존 private tree는 자동으로 public 전환하지 않습니다.

이유:

1. 기존 사용자는 private-first UX 아래에서 tree를 만들었을 수 있습니다.
2. 자동 public 전환은 사용자 기대와 신뢰를 훼손할 수 있습니다.
3. production 데이터 visibility 일괄 변경은 별도 승인 없이 금지합니다.

정책:

- 기존 private tree는 owner에게 계속 private으로 보입니다.
- 기존 private tree는 grandfathered private으로 유지할 수 있습니다.
- non-Plus grandfathered owner는 기존 private content를 열람/수정할 수 있습니다.
- non-Plus grandfathered owner의 신규 private storage 사용은 Plus entitlement가 필요합니다.
- grandfathered private tree를 public으로 전환하는 UX는 별도 승인 후 제공합니다.

---

## 6. UX copy guidance

사용자-facing 문구는 공개 접근과 Browse/Search 소개를 혼동시키지 않아야 합니다.

권장 문구:

> 새 러브트리는 공개 상태로 시작해요.

> 공개 상태여도 바로 둘러보기에 소개되지는 않아요.

> 공개된 순간이 3개 이상 쌓이면 둘러보기에서 소개될 수 있어요.

> 비공개 보관은 Plus에서 사용할 수 있어요.

> 순간의 공개 범위를 따로 고르지 않으면, 러브트리의 공개 상태를 따라가요.

> 공개는 링크로 볼 수 있는 상태이고, 둘러보기 소개는 충분히 자란 러브트리를 조용히 보여주는 기준이에요.

짧은 UI label 후보:

- 공개로 시작
- 둘러보기 소개 준비 중
- 공개 순간 3개부터 소개 가능
- 비공개 보관은 Plus 기능

---

## 7. Editor / My Trees state labels

Visibility badge와 Browse/Search eligibility badge는 분리합니다.

| 상태 | 의미 |
|------|------|
| 공개 러브트리 | tree visibility가 public |
| 둘러보기 준비 중 | public이지만 `publicMomentCount < 3` |
| 둘러보기 소개 가능 | public이고 `publicMomentCount >= 3` |
| 비공개 보관 | Plus private 또는 grandfathered private |

기본 Editor 작업 화면에는 visibility 설명을 과도하게 노출하지 않습니다. 공개/비공개 전환은 설정 패널, My Trees card menu 등 기본 감정 흐름을 방해하지 않는 위치에 둡니다.

---

## 8. Engineering handoff policy

개발자-facing canonical 문구:

```text
Policy: New trees default to public.

Newly created trees should use `visibility: public` as the default product policy. This must be implemented through coordinated frontend and backend changes, not by changing frontend payloads alone.
```

```text
Policy: Private storage requires Plus entitlement.

Creating a private tree, switching a public tree to private, or using private storage for new private content requires `users/{uid}.privateStorageEnabled === true`.
```

```text
Policy: Omitted memory visibility inherits parent tree visibility.

When memory visibility is omitted in a create/update payload, the effective memory visibility inherits the parent tree visibility.
```

```text
Policy: Explicit memory visibility may override inheritance when backend policy allows it.

Explicit memory visibility may override inherited visibility only within backend-approved policy boundaries.
```

```text
Policy: Public visibility and Browse/Search eligibility are separate.

`visibility: public` means the tree or memory is publicly accessible according to read policy. It does not automatically mean the tree is eligible for Browse/Search introduction.
```

```text
Policy: Browse/Search introduction requires publicMomentCount >= 3.

A public tree becomes eligible for Browse/Search introduction only when `publicMomentCount >= 3`. Trees below this threshold may remain public and directly accessible, but should not be introduced in Browse/Search surfaces.
```

```text
Policy: Parent tree visibility remains a browse/search guard.

A public memory under a private tree does not make the parent tree Browse/Search eligible. Browse/Search introduction must check parent tree visibility and browse guard together.
```

---

## 9. Prohibited implementation shortcuts

- createTree payload만 단독으로 `public`으로 바꾸지 않습니다.
- frontend-only lock으로 Plus private enforcement 완료를 선언하지 않습니다.
- backend guard 없이 private storage를 UI에서만 제한하지 않습니다.
- `publicMomentCount >= 3`을 visibility publication guard로 재사용하지 않습니다.
- public memory가 존재한다는 이유만으로 private parent tree를 Browse/Search에 노출하지 않습니다.
- 기존 private tree를 자동 public 전환하지 않습니다.
- 결제/권한 로직 확정 전 Plus private을 과도하게 홍보하지 않습니다.

---

## 10. Implementation split

### Frontend

- My Trees 생성 UX public-first copy/IA
- private 선택 Plus 안내
- memory visibility omitted/inherited copy 정리
- Editor badge: visibility와 Browse/Search eligibility 분리
- Settings private storage 안내 조정
- i18n key 정리

### Backend / runtime

- create tree default visibility policy 반영
- private storage entitlement guard
- memory visibility inheritance 처리
- explicit memory visibility override policy guard
- Browse/Search eligibility query에서 `publicMomentCount >= 3` 반영
- parent tree visibility + browse guard 동시 적용

### Docs

- API contract update
- backend docs update
- Modal runtime docs update
- Browse/Search eligibility 용어 정리

---

## 11. Application status

이 문서는 canonical policy를 고정합니다.

현재 main 코드가 이미 다음을 모두 구현했다는 뜻은 아닙니다.

- 신규 tree public default
- Plus private storage guard
- memory visibility inheritance
- explicit memory visibility override guard
- Browse/Search `publicMomentCount >= 3` eligibility
- private parent tree + public child memory browse guard

실제 구현은 별도 PR에서 진행합니다.
