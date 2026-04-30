# Firestore Rules Source Tracking Scaffold

## Purpose
This document serves as an initial scaffold for tracking Firestore Security Rules as a repository source-of-truth, addressing a part of Issue #281 ([Security] Firestore Rules hardening for private tree access control). It explicitly outlines the current repository state and prerequisites for capturing a verified rules baseline. This document does NOT implement or deploy actual Firestore Rules, make Firebase Console changes, add emulator tests, or introduce new dependencies.

## Current Repository State
-   `firestore.rules`: Not present in the repository.
-   `firebase.json`: Not present in the repository.
-   Emulator/rules test scaffold: Not present.
-   Package scripts for rules tests: Not present in `package.json`.

## Source-of-Truth Target
The long-term objective is to manage Firestore Security Rules as a repository-tracked source-of-truth. This approach aims to minimize reliance on Console-only rule management and establish a robust version control and deployment pipeline for security rules.

## Baseline Capture Prerequisites
Before any `firestore.rules` file can be added to the repository, the following must be verified by the Firebase Console owner:

1.  **Current Deployed Rules Confirmation:** The Firebase Console owner must confirm the current set of deployed Firestore Security Rules.
2.  **Verified Baseline Provision:** A verified copy of the current deployed rules must be provided. The repository will NOT attempt to copy or infer rules without this explicit baseline from the owner.

*Note: Secret or project credential values must never be recorded in this or any public documentation.*

## Future File Candidates
Upon successful baseline capture and subsequent implementation phases, the following files are candidates for addition to the repository:

-   `firestore.rules`: This file will house the version-controlled Firestore Security Rules, starting with the verified baseline.
-   `firebase.json`: Addition of this file would require separate approval due to its implications for deployment semantics and project configuration.
-   Emulator/rules tests: Dedicated test scaffold PRs will introduce files for local Firebase Emulator-based security testing.

## Non-Goals of this PR
This PR specifically excludes the following:

-   No Firestore Rules implementation.
-   No Firebase Console changes.
-   No Rules deployment to any environment.
-   No private read boundary implementation.
-   No `ownerId`/`userId` validation implementation.
-   No Firebase Emulator dependency or `npm` script additions.
-   No CI workflow changes.
-   No runtime/client/backend code changes.
-   No secret value documentation.

## Recommended Follow-up PRs (for phased implementation of Issue #281)

To continue addressing Issue #281, the following subsequent PRs are recommended:

-   **PR A (Verified Baseline Capture):** Add the verified baseline `firestore.rules` file to the repository.
-   **PR B (Testing Infrastructure):** Scaffold Firebase Emulator security tests.
-   **PR C (Create-time Validation):** Implement create-time `ownerId` and `userId` validation for `trees` and `comments` in Firestore Rules.
-   **PR D (Private Read Boundary):** Implement private tree owner/admin read boundary rules, including a migration strategy and staging plan.
-   **PR E (Comments Visibility):** Implement comments visibility inheritance rules.
-   **PR F (Staging/Production Deployment):** Document staging rollout and production deployment procedures for Firestore Rules.

## Safety Guardrails

-   This PR uses `Refs #281` only for issue reference wording.
-   Issue #281 must remain open until all rules implementation, testing, and deployment aspects are finished and verified.
-   Public tree compatibility and a clear migration path must be carefully considered and preserved in all later rules implementation PRs.
-   No production deployment of new rules without a thoroughly documented staging validation and rollback plan.
