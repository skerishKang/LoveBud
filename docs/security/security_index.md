# Security Docs Index

This folder contains LoveBud security policy, posture, and rollout planning documents.

## Files

| File | Description |
|---|---|
| [FIREBASE_CLIENT_CONFIG_POLICY.md](FIREBASE_CLIENT_CONFIG_POLICY.md) | Firebase client config exposure policy and security model |
| [FIRESTORE_RULES_HARDENING_ROLLOUT_PLAN.md](FIRESTORE_RULES_HARDENING_ROLLOUT_PLAN.md) | Planning-only Firestore Rules hardening rollout, test matrix, compatibility, and rollback requirements |
| [SECURITY_ISSUES_266_281_DISPOSITION.md](SECURITY_ISSUES_266_281_DISPOSITION.md) | Disposition document for Firebase Console/secret posture verification (#266) and Firestore Rules hardening (#281) |
| [FIRESTORE_RULES_SOURCE_TRACKING.md](FIRESTORE_RULES_SOURCE_TRACKING.md) | Scaffold for Firestore Rules source tracking and baseline capture prerequisites (Related to #281) |
| [FIREBASE_CONSOLE_SECRET_POSTURE_CHECKLIST.md](FIREBASE_CONSOLE_SECRET_POSTURE_CHECKLIST.md) | Checklist for Firebase Console and deployment secret posture verification (#266) |
| [ISSUE_266_REMAINING_OPS_POSTURE_GAPS.md](ISSUE_266_REMAINING_OPS_POSTURE_GAPS.md) | Tracker for remaining #266 ops posture gaps after partial verification |

## Guardrails

- Do not commit credentials, tokens, cookies, session values, or private keys.
- Do not change Firebase Console settings from documentation PRs.
- Do not deploy Firestore Rules without an approved rollout, test matrix, and rollback owner.
- Keep planning documents separate from implementation PRs.

## References

- Overall docs index: `../doc_index.md`
- Operations docs: `../ops/ops_index.md`
