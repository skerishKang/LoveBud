# Test Scenarios Index

Single entry point for `docs/test-scenarios/`.
Use this file first when scenario docs feel scattered.

## 1. Start Here

1. [QUICKSTART.md](./QUICKSTART.md)
2. [CURRENT_SCENARIOS.md](./CURRENT_SCENARIOS.md)
3. Open the scenario you want to run

## 2. Primary Scenarios

| ID | File | Goal | Covered Pages |
|---|---|---|---|
| CORE-NEWUSER-001 | [core_newuser_001.md](./core_newuser_001.md) | New user onboarding and first memory flow | login, my-trees, editor, detail |
| CORE-RETURNING-001 | [core_returning_001.md](./core_returning_001.md) | Returning user revisit/edit/add flow | my-trees, editor, detail |
| CORE-BROWSE-001 | [core_browse_001.md](./core_browse_001.md) | Public browse flow | search, detail |
| ACCESS-PUBLIC-PRIVATE-001 | [access_public_private_001.md](./access_public_private_001.md) | Visibility and permission boundaries | search, detail, editor |
| PERSISTENCE-001 | [persistence_001.md](./persistence_001.md) | Save/refresh/re-entry consistency | my-trees, editor, detail |

## 3. Regression Scenario

| ID | File | Use |
|---|---|---|
| REPEAT-NODE-001 | [repeatability-node-creation-test.md](./repeatability-node-creation-test.md) | Historical node/reload/guard regression checks |

## 4. Page Coverage Matrix

| Page | Scenarios |
|---|---|
| pages/login.html | CORE-NEWUSER-001 |
| pages/my-trees.html | CORE-NEWUSER-001, CORE-RETURNING-001, PERSISTENCE-001 |
| pages/editor.html | CORE-NEWUSER-001, CORE-RETURNING-001, ACCESS-PUBLIC-PRIVATE-001, PERSISTENCE-001, REPEAT-NODE-001 |
| pages/detail.html | CORE-BROWSE-001, CORE-RETURNING-001, ACCESS-PUBLIC-PRIVATE-001, PERSISTENCE-001 |
| pages/search.html | CORE-BROWSE-001, ACCESS-PUBLIC-PRIVATE-001 |
| pages/intro.html | Optional start-screen sanity check |
| pages/settings.html | TODO candidate for dedicated scenario |

## 5. Recommended Run Packs

### Release Minimum

1. [core_newuser_001.md](./core_newuser_001.md)
2. [core_browse_001.md](./core_browse_001.md)
3. [persistence_001.md](./persistence_001.md)

### Manual QA Baseline

1. [core_newuser_001.md](./core_newuser_001.md)
2. [core_returning_001.md](./core_returning_001.md)
3. [core_browse_001.md](./core_browse_001.md)
4. [access_public_private_001.md](./access_public_private_001.md)
5. [persistence_001.md](./persistence_001.md)

## 6. Result Storage Rules

- Path: `docs/test-scenarios/results/{scenario}-{group}-YYYY-MM-DD-HHMM/`
- Required: `test-result.md`
- Recommended: `screenshots/`
- Template: [results/common-test-TEMPLATE.md](./results/common-test-TEMPLATE.md)

## 7. Supporting Docs

- [README.md](./README.md): folder structure and operation policy
- [QUICKSTART.md](./QUICKSTART.md): fast execution flow
- [CURRENT_SCENARIOS.md](./CURRENT_SCENARIOS.md): active scenario list
- [test_scenario_todo_2026_04_20.md](./test_scenario_todo_2026_04_20.md): cleanup backlog
- [ACCOUNT_RULES.md](./ACCOUNT_RULES.md): account constraints
