# Task Status

## 목적

이 문서는 LoveBud project 작업 상태를 기록하기 위한 전용 문서입니다.

## 상태 필드

- **완료**: 검증 및 병합이 완료되어 실서비스에 반영되거나 TF 작업이 종료된 상태
- **진행 중**: 현재 작업이 진행 중이거나 PR이 열려 있는 상태
- **대기**: 설계 중이거나 다음 단계로 예정된 작업
- **보류**: 작업이 중단되거나 지연된 상태

## 원칙

- 상태 필드 기준으로만 관리합니다.
- 정책이나 상세 운영 가이드는 이 문서에 포함하지 않습니다. (관련 문서 링크 활용)
- 수정, 검증, 추정은 구분하여 기록합니다.
- 세부 검증 기준은 [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)를 따릅니다.

---

## 현재 상태 스냅샷

- 기준일: 2026-04-26
- 기준 main 커밋: `0da436d57c9628e1e72d960d9d814844f4079d98`

| 구분 | 상태 | 기준/대상 | 현재 기록 |
|------|------|-----------|-----------|
| PR #76 | 완료 | docs-only 7 files | Merge 완료 및 문서 정합성 cleanup 완료 |
| PR #77 | 완료 | docs/ops 3 files | Merge 완료 및 preview slot verification rules 정리 완료 |
| PR #80 | 진행 중 | pages/search.html only | Search inline style reduction pass 1, Cloudflare Preview verification PASS, production verification pending |
| Issue #65 | 진행 중 | backlog | Selected tree deep link, Search JS responsibility split, broader Search CSS extraction |
| Issue #72 | 보류 | JS architecture cleanup | paused 상태 유지 |
| Issue #78 | 진행 중 | Auth audit | Auth architecture, global exports, token cache cleanup audit, docs-only audit note / security PR 후보 |
| Issue #79 | 진행 중 | Runtime guardrails | Runtime ownership and legacy folder guardrails, active/legacy runtime marker docs 후보 |
| PR #7 | 진행 중 | open / draft | untouched 유지 |

---

## CI / E2E

- Netlify dev: local harness
- Production truth: Cloudflare Pages same-origin /api/* → Pages Functions → Modal

---

## Notes

- TASK_STATUS.md docs-only refresh after PR #80
- PR #80 production verification pending
- No code / CSS / JS / HTML changes
- PR #7 untouched
- Issue #65 / #72 / #78 / #79 status preserved
