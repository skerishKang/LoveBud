# Firebase Console and Secret Posture Verification Checklist

## Purpose
This document provides a docs-only checklist for verifying the Firebase Console and deployment secret posture, specifically addressing Issue #266 (Ops: Firebase Console and deployment secret posture verification). This document does NOT make any Firebase Console changes, display secret values, deploy Firebase Rules, or modify runtime code.

## Verification Ownership
Successful verification requires collaboration and input from the following roles:
-   **Firebase Console Owner:** Responsible for direct access and verification within the Firebase Console.
-   **Google Cloud Project/IAM Owner:** Responsible for Google Cloud project settings and IAM policies if Firebase is linked to a GCP project.
-   **Modal Secret Owner:** Responsible for managing secrets deployed to the Modal backend.
-   **Legacy Netlify Environment Owner (if applicable):** Responsible for verifying any residual configurations in legacy Netlify environments.
-   **Repository/Security Reviewer:** Responsible for reviewing this documentation and the findings.

## Firebase Console Checklist (to be verified by Firebase Console Owner)

1.  **Firebase Project Identity:**
    *   Confirm the correct Firebase project is being reviewed.
    *   Record Project ID and Project Number (not sensitive).

2.  **Enabled Services:**
    *   Verify which Firebase services are currently enabled (e.g., Authentication, Firestore, Storage, Hosting, Cloud Functions, Remote Config).
    *   Document any unexpected enabled services.

3.  **Project Members and Roles:**
    *   Audit all members listed under "Users and permissions" in the Firebase Console (or IAM in GCP).
    *   Confirm that all members and their assigned roles are appropriate and follow the principle of least privilege.
    *   Document any unknown or overly permissive roles.

4.  **Google Cloud Project Linkage:**
    *   Confirm the Firebase project is correctly linked to an underlying Google Cloud Project.
    *   Verify that IAM policies for the linked GCP project are also reviewed as part of this posture.

5.  **Authorized Domains (Authentication):**
    *   Review the list of authorized domains for Firebase Authentication to prevent unauthorized redirects.

6.  **App Check Usage:**
    *   Verify if Firebase App Check is enabled and configured for critical services (e.g., Firestore, Storage).
    *   Note: Actual App Check implementation is a follow-up task, not part of this verification.

## Firestore / Storage Posture (to be verified by Firebase Console Owner)

1.  **Deployed Firestore Security Rules Ownership:**
    *   Identify the owner responsible for the currently deployed Firestore Security Rules.
    *   Confirm these rules align with expected data access policies.

2.  **Current Rules Baseline Capture:**
    *   Determine if a current, verified baseline of deployed Firestore Rules needs to be captured into repository source control for version tracking and future hardening (related to #281).

3.  **Storage Usage:**
    *   Verify if Firebase Storage is actively used by the application.

4.  **Storage Inactivity Posture:**
    *   If Firebase Storage is NOT actively used, confirm its inactivity and consider steps for disabling unused buckets or services to reduce attack surface.

5.  **Storage Security Rules Review:**
    *   If Firebase Storage IS actively used, review its deployed Security Rules to ensure proper access control for stored objects.

## API Key Restriction Checklist (to be verified by Google Cloud Project/IAM Owner)

1.  **Firebase Web API Key Restrictions:**
    *   Review the Firebase Web API key(s) in the Google Cloud Console (`APIs & Services -> Credentials`).
    *   Verify existing restrictions.

2.  **HTTP Referrer Restriction:**
    *   Confirm if HTTP referrer restrictions are configured to limit API key usage to known domains.

3.  **API Usage Restriction:**
    *   Confirm if API usage restrictions are applied, limiting the key to only necessary Firebase/Google Cloud APIs.

*Note: The actual Firebase Web API key values must NEVER be recorded in this document or any other public/repository file. The client-side Web API key used for Firebase client bootstrap is generally not considered a standalone secret blocker, but its restrictions are still critical.*

## Modal Secret Posture Checklist (to be verified by Modal Secret Owner)

1.  **`FIREBASE_SERVICE_ACCOUNT_JSON` Secret Existence:**
    *   Confirm the `FIREBASE_SERVICE_ACCOUNT_JSON` secret exists in the Modal environment.

2.  **Secret Ownership:**
    *   Identify the owner of this secret.

3.  **Access Control:**
    *   Verify appropriate access control is in place for the secret in the Modal environment (e.g., who can read, modify, or deploy it).

4.  **Rotation Status & Cadence:**
    *   Confirm the rotation status and established rotation cadence for this secret.
    *   The exact last rotation date is not a sensitive value and can be recorded by the owner separately, but the JSON key material itself must NOT be recorded.

## Legacy Netlify Environment Posture (if applicable, to be verified by Legacy Netlify Env Owner)

1.  **Legacy Netlify Firebase Service-Account Environment Existence:**
    *   Confirm if any legacy Netlify deployments still exist that utilize Firebase service account environment variables.

2.  **Active Runtime Confirmation:**
    *   Confirm that the active production runtime for LoveBud is Cloudflare Pages + Modal, and not any legacy Netlify deployment.

3.  **Legacy Secret Follow-up:**
    *   If legacy secrets remain in Netlify, define follow-up actions for their removal, rotation, or disablement.

*Note: Secret values must NOT be recorded in this document.*

## Evidence Recording Policy
When documenting verification findings, adhere strictly to the following:
-   **OK to record:** Owner name/role, date of verification, high-level status (e.g., `VERIFIED_OK`, `PENDING_ACTION`), follow-up issue/PR links.
-   **NOT OK to record (Forbidden):** Actual secret values, JSON key material, token values, cookie/session values, raw credential screenshots, partial key prefixes/suffixes, or any other sensitive data.

## Follow-up Outcomes (for Issue #266)
Based on the verification, one or more of the following outcomes will apply:
-   `VERIFIED_NO_ACTION`: All posture checks passed, no further immediate action required.
-   `NEEDS_ROTATION`: A secret requires rotation.
-   `NEEDS_RESTRICTION`: An API key or resource access requires stricter restrictions.
-   `NEEDS_RULES_BASELINE_CAPTURE`: Firestore Security Rules need to be brought into repository source control (#281 related).
-   `NEEDS_STORAGE_DECISION`: Firebase Storage usage needs to be clarified or inactive services disabled.
-   `NEEDS_LEGACY_SECRET_REMOVAL`: Legacy secrets in old environments need to be removed.
-   `BLOCKED_BY_OWNER_ACCESS`: Verification is blocked due to lack of appropriate owner access.

## Relationship to Issue #281
-   Firebase Console and secret posture verification (Issue #266) is a prerequisite for some of the baseline and rules implementation follow-ups planned under Issue #281.
-   Issue #281's Firestore Rules implementation remains a separate task; no `firestore.rules` file is added or modified in this PR.

## Safety Guardrails
-   This PR uses `Refs #266` only for issue reference wording.
-   Issue #266 must remain open until all verification tasks are completed and documented.
-   No Firebase Console changes are to be made via this documentation PR.
-   No secret values or partial values are to be recorded.
-   No runtime/config/workflow changes are allowed.
