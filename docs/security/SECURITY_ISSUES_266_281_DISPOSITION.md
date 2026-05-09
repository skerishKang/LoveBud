# Disposition for Security Issues #266 and #281

## Purpose
This document serves as a disposition for Issue #266 (Ops: Firebase Console and deployment secret posture verification) and Issue #281 ([Security] Firestore Rules hardening for private tree access control). It is not intended to complete these issues but rather to delineate completed planning from remaining operational and security implementation work. This document explicitly avoids making changes to runtime code, Firebase Console configurations, Firestore Rules deployments, or secret handling.

## Status of Issue #266: Firebase Console and Deployment Secret Posture Verification

### Completed Planning (Repository-level audit/planning)
- Initial assessment of Firebase-related files in the repository.
- Identified areas where Firebase services are used.

### Remaining Verification and Operational Work
The following items require verification by the credential owner or further operational/security implementation:

1.  **Firebase Console Verification:**
    *   Confirm current Firebase project settings in the console.
    *   Verify active Firebase services (Authentication, Firestore, Storage, Hosting, etc.).
    *   Audit Firebase project members and their roles/permissions.
    *   Confirm Firebase Project is linked to a Google Cloud Project for IAM management.

2.  **Firestore Security Rules Verification:**
    *   Review currently deployed Firestore Security Rules via Firebase Console.
    *   Ensure rules align with intended data access policies for public and private data.

3.  **Storage Security Rules / Inactivity Verification:**
    *   Review currently deployed Firebase Storage Security Rules via Firebase Console.
    *   If Firebase Storage is not actively used, verify its inactivity and consider disabling/removing unused buckets.

4.  **Firebase API Key Restrictions:**
    *   Verify API key restrictions (e.g., HTTP referrers, IP addresses, API usage) in the Google Cloud Console.

5.  **Modal FIREBASE_SERVICE_ACCOUNT_JSON Secret Posture:**
    *   Confirm existence, ownership, and rotation status of the `FIREBASE_SERVICE_ACCOUNT_JSON` secret used by the Modal backend.
    *   Ensure proper access control for this secret in the Modal environment.

6.  **Legacy Netlify Firebase Service-Account Environment Posture:**
    *   Audit the environment variable posture for any legacy Netlify deployments using Firebase service accounts.
    *   Confirm deprecation or secure handling for these legacy configurations.

7.  **Secret Rotation Cadence and Owner Documentation:**
    *   Document the established rotation cadence for all Firebase-related secrets (API keys, service accounts).
    *   Clearly identify the owner responsible for each secret's management and rotation.

## Status of Issue #281: Firestore Rules Hardening for Private Tree Access Control

### Completed Planning (from #300, #376 and other related docs PRs)
- Design considerations for private tree ownership and access.
- Initial mapping of required access control rules.
- Identified key data entities: `trees`, `moments`, `comments`.

### Remaining Implementation and Testing Work
The following items require actual code implementation, rule deployment, and testing:

1.  **Firestore Rules Source-of-Truth Tracking:**
    *   Establish a clear source-of-truth for Firestore Security Rules (e.g., a specific file in the repository, a dedicated management process).
    *   Implement version control and deployment pipeline for these rules.

2.  **Private Tree Owner/Admin Read Boundary:**
    *   Implement Firestore Rules to enforce read access only for the tree owner or designated administrators for private trees.
    *   Ensure no unauthorized read access to private tree data.

3.  **Tree Create OwnerId Validation:**
    *   Implement Firestore Rules to validate that the `ownerId` field during tree creation matches the authenticated user's ID.

4.  **Comment Create UserId Validation:**
    *   Implement Firestore Rules to validate that the `userId` field during comment creation matches the authenticated user's ID.

5.  **Comments Read Visibility Inheritance:**
    *   Implement Firestore Rules to ensure comment visibility inherits from the parent tree's visibility (e.g., comments on a private tree are only readable by the private tree's authorized users).

6.  **Public Tree Compatibility:**
    *   Ensure new rules for private trees do not negatively impact public tree access and functionality.

7.  **Migration Path:**
    *   Define and document a migration path for existing data if rule changes require data structure adjustments (e.g., adding `ownerId` to existing trees).

8.  **Emulator/Security Tests:**
    *   Develop comprehensive Firebase Emulator test suites for Firestore Security Rules to validate all access control scenarios.
    *   Integrate these tests into the CI/CD pipeline.

9.  **Staging Validation:**
    *   Establish a process for deploying and validating new Firestore Rules in a staging environment before production rollout.

10. **Rollback/Monitoring Plan:**
    *   Develop a rollback plan in case of issues with new rule deployments.
    *   Implement monitoring and alerting for Firestore Security Rules-related errors.

## Recommended Follow-up PRs (Categorized for Phased Implementation)

To address the remaining work for #266 and #281, the following PRs are recommended for phased implementation:

*   **PR A (Rules Management):** Establish Firestore Rules baseline source tracking and CI/CD integration.
*   **PR B (Testing Infrastructure):** Scaffold Firebase Emulator security tests.
*   **PR C (Create-time Validation):** Implement create-time `ownerId` and `userId` validation for `trees` and `comments`.
*   **PR D (Private Read Boundary):** Implement private tree read boundary rules, including a migration strategy and staging plan.
*   **PR E (Comments Visibility):** Implement comments visibility inheritance rules.
*   **PR F (Console Posture):** Document Firebase Console and secret owner verification notes (by respective credential owner).

## Closure Policy

-   **Issue #266:** Must remain open until all Firebase Console, Storage, API Key, and secret ownership/rotation verifications are completed by the respective credential owners and documented.
-   **Issue #281:** Must remain open until Firestore Rules implementation, comprehensive emulator/security testing, and staging environment verification are completed.
-   This PR uses `Refs #266` and `Refs #281` to link to the issues using non-completing issue references.