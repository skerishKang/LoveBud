# Auth Runtime Audit

This document inventories the responsibilities, lifecycle boundaries, and extraction opportunities inside `js/auth.js`. This audit was conducted to identify safe modularization paths without altering runtime behavior or UI.

## 1. Responsibility Inventory

`js/auth.js` currently serves as a central orchestration hub for authentication-related activities. Its responsibilities can be categorized into:

*   **Auth Bootstrap Lifecycle & State Management**:
    *   Initializes authentication on `DOMContentLoaded` (`initAuth`).
    *   Manages loading state UI transitions (`markAuthLoading`, `markAuthReady`).
    *   Coordinates compatibility bridges (`__authBootstrapCompat`) to resolve initialization callbacks (`resolveAuthBootstrap`).
*   **Session Persistence & Storage**:
    *   Maintains the auth cache keys (`AUTH_CACHE_KEY`, `AUTH_CONFIRMED_KEY`, `AUTH_TOKEN_KEY`).
    *   Leverages `LoveBudAuthCache` to get/set user data and clear stale sessions.
*   **Firebase Integration & Delegation**:
    *   Provides global sign-in/sign-out methods (`signInWithGoogle`, `signOut`).
    *   Delegates heavy lifting to `LoveBudAuthFirebase` (the Firebase boundary module) via `__authProtectedRouteBridge`.
    *   Determines environmental constraints (`getEnvironmentCheckError`) and human-readable error messages.
*   **Route Protection & Redirect Handling**:
    *   Identifies page contexts (`isLoginPage`).
    *   Determines post-login redirection logic (`getRedirectTarget`).
    *   Executes fire-and-forget preloading for target routes (`preloadRedirectTargetData` for fetching `getTrees` and initial `getTree` data).
*   **UI Synchronization**:
    *   Replaces the top-right navigation UI (`updateNavUI`, `buildUserDropdown`, `buildLoginButton`) using `innerHTML`.
    *   Attaches a singleton document-level listener for user dropdowns (`attachDropdownListener`).
    *   Manages Email Auth Form / Signup Form setup via `LoveBudAuthLoginPage` delegates (`syncEmailAuthModeUi`).

## 2. Coupling Risk Analysis

*   **Global Module Bridges**: The file heavily depends on the existence of global modules (`window.LoveBudAuthState`, `window.LoveBudAuthUI`, `window.LoveBudAuthSession`, `window.LoveBudAuthFirebase`, etc.). Any extraction must preserve this bridge pattern or resolve dependencies explicitly before execution.
*   **DOM State Coupling**: `updateNavUI` directly relies on `#auth-nav` and `#auth-nav-container` existing in the DOM, expecting them to be persistently available for `innerHTML` replacement.
*   **Event Lifecycle (Dropdown)**: `attachDropdownListener` is a document-wide listener utilizing a singleton flag (`DROPDOWN_LISTENER_ATTACHED`). Extracting this requires strict adherence to this singleton flag pattern to prevent multiple click events from stacking.
*   **Data Preloading Race Condition**: `preloadRedirectTargetData` calls `apiClient.getTrees` immediately after a successful login without awaiting completion. Modifying this could slow down the redirect or disrupt caching mechanics on the target page.

## 3. Safest Extraction Order

To stabilize and modularize `auth.js` safely, the extraction should follow an outside-in approach, extracting pure UI and stateless logic first:

1.  **UI & Template Builders (COMPLETED in #1467)**: Extracted `buildUserDropdown`, `buildLoginButton`, `escapeHtml`, and `getUserAvatarInitial` into a UI rendering module (`js/auth/auth-ui-templates.js`). `auth.js` now bridges this via `__authUiTemplates`.
2.  **Auth Form & Auth Mode Config**: Extract the email form configurations (`syncEmailAuthModeUi`, `setupLoginPageAuthUi`) and UI setup triggers (`setupEmailAuthForm`, `setupSignupForm`) into a login-page specific module (e.g., `js/auth/auth-login-forms.js`).
3.  **Redirect & Session Management**: Extract `getRedirectTarget` and `preloadRedirectTargetData` into a session routing module (e.g., `js/auth/auth-redirects.js`).
4.  **Core Orchestration**: Keep the remaining `initAuth`, `updateNavUI` (the DOM replacement part), `signInWithGoogle`, and `signOut` orchestration inside `auth.js`.

## 4. High-Risk Regression Boundaries

When performing future extractions, these boundaries must remain intact:

*   **`initAuth` / `DOMContentLoaded` Hook**: Do NOT defer the execution of `initAuth`. It must fire precisely when `DOMContentLoaded` occurs to prevent the page from flickering between logged-out and logged-in states.
*   **Dropdown Listener Attachment**: The `attachDropdownListener` MUST only bind the document click listener once. If the singleton state check is lost, clicking outside the dropdown might cause ghost clicks or infinite toggling loops.
*   **UI Container Mutation**: `auth-nav` and `auth-nav-container` must NOT be destroyed/replaced entirely. Only their `innerHTML` should be modified to avoid breaking external references.
*   **Firebase API Loading Sequence**: Methods like `signInWithGoogle` gracefully fall back to checking if `firebase.apps` exists. The extraction must not disrupt the lazy-load checking of Firebase.

## 5. Recommended Future Module Map

```text
js/auth/
  ├── auth-ui-templates.js      # Pure HTML string builders (buildUserDropdown, buildLoginButton)
  ├── auth-login-forms.js       # Form state/DOM wiring (Email signup/login mode sync)
  ├── auth-redirects.js         # Post-login destination calculation & data preloading
  ├── auth-events.js            # Document-level global click delegations (Dropdown behavior)
  └── auth.js (Root)            # State boundary, __authProtectedRouteBridge delegation, global API exports
```
