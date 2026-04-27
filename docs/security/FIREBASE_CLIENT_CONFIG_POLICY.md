# Firebase Client Config Security Policy

This document defines the security posture and management policy for Firebase client-side configuration in the LoveBud project.

## 1. Context: Public Identifiers vs. Secrets

In a standard Firebase Web SDK implementation, the following configuration parameters are intentionally visible to the client browser:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`

**Firebase Web config is a browser-visible identifier, NOT a server secret.** The `apiKey` is used to identify the project on Google's servers, not to authorize administrative access. 

**IMPORTANT**: 
- Moving these values to `.env` variables does NOT hide them in client-side JS; they are still bundled and exposed to the browser.
- The exposure of these identifiers is **standard behavior** and is not a "vulnerability" in itself.

## 2. Security Enforcement Mechanisms

Since the client config is public, security MUST be enforced through the following server-side mechanisms:

1.  **Authorized Domains**: Restricting which domains can use the API key for Authentication (Firebase Console -> Authentication -> Settings -> Authorized Domains). This prevents unauthorized sites from using your project for sign-in.
2.  **Security Rules**: Enforcing granular access control for Firestore and Storage. This is the primary defense against unauthorized data access or modification.
3.  **API Key Restrictions**: Restricting the API key to specific Firebase services in the Google Cloud Console (Google Cloud Console -> APIs & Services -> Credentials).
4.  **App Check**: (Recommended) Protecting against non-app/automated traffic by attesting that requests come from the legitimate app.

## 3. Implementation Policy in LoveBud

- **Location**: `js/firebase-config.js` is the single source of truth for the client.
- **Handling**: Configuration values are hardcoded as public identifiers.
- **Documentation**: Any changes to the Firebase project structure must be reflected in `docs/ops/ENV_DEPENDENCY.md`.
- **Audit Requirement**: Any PR that enables new Firebase services must include a review of the corresponding Security Rules.

## 4. Operational Checklist for Hardening

The following items are managed via the Firebase/Google Cloud Console and must be verified separately from the codebase:

- [ ] **Authorized Domains**: Only `lovebud.pages.dev`, `lovebud.vercel.app`, `lovebud.netlify.app`, and `localhost` should be listed.
- [ ] **Firestore Rules**: Verify that access is restricted based on `resource.data.visibility` and `request.auth.uid`.
- [ ] **Storage Rules**: Verify the bucket access policy. **Note**: Absence of rules in the code does not imply safety; the Console's bucket policy is the final authority.
- [ ] **API Key Restrictions**: Ensure the key is limited to Identity Toolkit and necessary Firebase services.

## 5. Summary of Current State (2026-04-27)

| Item | Status | Wording |
|------|--------|---------|
| `apiKey` | Exposed | Expected (Public Identifier) |
| Auth Usage | Active | Enforced via Authorized Domains |
| Firestore | Active | Enforced via Security Rules |
| Storage | Unknown | Managed via Console/Admin SDK |

*\*Current architecture predominantly uses Firebase Auth for ID token generation, while data operations are proxied through Cloudflare Functions to a Modal backend using service accounts.*
