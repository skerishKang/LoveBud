# LoveTree Private YouTube Playlist OAuth Authority

**Issue:** #4025  
**Parent Epic:** #4024  
**Product parent:** #3897 — Keep OPEN  
**Platform authority:** #4004  
**Planning RFC:** #4023 / `LOVETREE_PRIVATE_YOUTUBE_PLAYLIST_IMPORT_5K_RFC.md`  
**Status:** Implementation-ready authorization contract; runtime implementation is a follow-up.  
**Audited baseline:** LoveBud `main` `ba7d470385f8bf21471cb8d5eeb9a4846df7232d`  
**Last updated:** 2026-08-14

---

## 1. Decision

The account-owned/private-playlist flow uses **Google OAuth 2.0 user authorization**, not the existing YouTube API key.

Minimum requested YouTube scope for V1:

```text
https://www.googleapis.com/auth/youtube.readonly
```

Google documents this scope as “View your YouTube account.” The YouTube Data API requires OAuth 2.0 for private user data, and `playlists.list?mine=true` requires an authorized request.

Primary product flow:

```text
LoveBud/LoveTree authenticated actor
→ explicit “Connect YouTube” action
→ server creates one-time OAuth state bound to that actor
→ browser redirects to Google consent
→ same-origin server callback validates state
→ server exchanges authorization code
→ server verifies usable YouTube account/channel access
→ refresh credential is encrypted at rest if offline access was granted
→ user can discover account-owned playlists, including private playlists
```

The source playlist privacy is unchanged.

---

## 2. Official provider authority

Current official references reviewed for this decision:

- YouTube OAuth guide: `https://developers.google.com/youtube/v3/guides/authentication`
- YouTube server-side web app guide: `https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps`
- Google OAuth web-server guide: `https://developers.google.com/identity/protocols/oauth2/web-server`
- Google OAuth best practices: `https://developers.google.com/identity/protocols/oauth2/resources/best-practices`
- YouTube scopes: `https://developers.google.com/identity/protocols/oauth2/scopes`
- `playlists.list`: `https://developers.google.com/youtube/v3/docs/playlists/list`
- Playlist implementation examples: `https://developers.google.com/youtube/v3/guides/implementation/playlists`
- Google OAuth verification guidance: `https://support.google.com/cloud/answer/13464321`

Provider facts used by this contract:

1. YouTube private user data requires OAuth 2.0.
2. `playlists.list` with `mine=true` is only valid for a properly authorized request.
3. `youtube.readonly` is the read-only YouTube-account scope and is narrower than account-management scopes.
4. Web-server authorization uses an authorization code returned to a registered redirect URI and exchanged server-side.
5. `state` must be validated to mitigate CSRF/login-flow substitution.
6. `access_type=offline` enables refresh-token issuance when the app needs access while the user is no longer present.
7. Refresh tokens can expire or be revoked and the product must recover cleanly.
8. Public apps requesting access to private/sensitive user data may require Google OAuth verification; production launch must satisfy the current Cloud Console classification and verification requirements.

---

## 3. Why the existing API key remains but is not sufficient

Existing public preview:

```text
public playlist URL/ID
→ server API key
→ public read-only preview
```

Owned/private import:

```text
user-owned private playlist
→ user OAuth authorization
→ account-scoped read
```

The API key identifies the application/project. It does not grant permission to read a user's private playlist.

Keep the API-key path for public collection preview/fallback where appropriate. Do not attempt to “upgrade” API-key requests by passing private playlist IDs.

---

## 4. Scope decision

V1 requests only:

```text
https://www.googleapis.com/auth/youtube.readonly
```

Do not request:

```text
https://www.googleapis.com/auth/youtube
https://www.googleapis.com/auth/youtube.force-ssl
https://www.googleapis.com/auth/youtube.upload
```

because V1 does not create, edit, delete, rate, comment on, or upload YouTube content.

Do not add Google profile/email scopes merely to identify the provider account unless a later reviewed requirement proves they are necessary.

Provider identity for V1 should be derived from YouTube-authorized channel/account data available under the YouTube read scope rather than expanding scope solely for display identity.

Use incremental/in-context authorization: request YouTube access when the user explicitly chooses the YouTube import feature, not during ordinary LoveBud sign-in.

---

## 5. Application identity and provider authorization are separate

Never equate:

```text
LoveBud/LoveTree login
=
YouTube authorization
```

The first answers:

> Which LoveBud/LoveTree actor is making this request?

The second answers:

> Which YouTube account/channel has this actor authorized LoveBud/LoveTree to read?

The canonical binding must be:

```text
application_actor_id
↔ provider_connection_id
↔ youtube authorized account/channel identity
```

The implementation must follow the current #4004 application-identity authority at implementation time. It must not hard-code Firebase identity as the permanent provider-binding schema merely because current LoveBud private routes still use Firebase verification.

---

## 6. Selected OAuth flow

Use the **server-side authorization-code flow**.

### 6.1 Start

Candidate same-origin product route:

```text
POST /api/integrations/youtube/oauth/start
```

Requirements:

- require current LoveBud/LoveTree actor authentication;
- create cryptographically random, high-entropy `state`;
- persist only a safe state verifier/hash plus actor binding and expiry;
- single use;
- short TTL, recommended design target <= 10 minutes;
- record intended safe post-connect return target as an internal route identifier, not arbitrary external URL;
- return a Google authorization URL or a same-origin redirect response;
- request `youtube.readonly` only;
- request `access_type=offline` because import jobs may outlive the interactive browser session and future imports should not require consent every time;
- use incremental authorization support where applicable.

Do not put application access tokens, user IDs, refresh tokens or provider secrets into the OAuth query string.

### 6.2 Google authorization

The browser leaves LoveBud/LoveTree and visits Google's authorization endpoint.

The user sees and explicitly grants YouTube read access.

Denial is a normal recoverable product outcome, not an internal error.

### 6.3 Callback

Candidate same-origin callback:

```text
GET /api/integrations/youtube/oauth/callback
```

Requirements:

1. require `state` and provider response parameters;
2. look up the one-time state record;
3. reject unknown, expired, already-used or mismatched state;
4. mark/consume state atomically before or as part of successful exchange handling so replay cannot bind twice;
5. exchange the authorization code **server-side** using the OAuth client credential;
6. never render the authorization code into application HTML/logs;
7. verify the granted scope set includes the required YouTube read permission;
8. make a bounded YouTube “mine” identity/read check before marking the provider connection usable;
9. bind the resulting provider connection to the actor stored in the state record;
10. redirect to an internal success/failure page without tokens in the URL.

The callback does not require the browser to attach an application Bearer token because the actor binding comes from the previously authenticated, one-time server-side state record.

### 6.4 Provider connection check

After token exchange, make a bounded authorized YouTube request sufficient to establish that the token can act for a YouTube account/channel.

Do not mark a connection `active` merely because token exchange returned HTTP 200.

Candidate state:

```text
pending
active
reauth_required
revoked
 disconnected
error
```

Exact enum names belong to schema implementation.

---

## 7. Redirect URI authority

Production redirect URI must be an exact registered HTTPS URI on the LoveBud/LoveTree product domain/same-origin API surface.

Candidate current-production shape:

```text
https://lovebud.pages.dev/api/integrations/youtube/oauth/callback
```

The implementation PR must confirm the actual selected canonical production host before Cloud Console configuration. Do not register a temporary preview hostname as the production redirect authority.

Preview/staging must use separately registered redirect URIs and must not silently share Production OAuth state or encrypted provider credentials.

Localhost may be used only for local developer testing according to Google's allowed redirect rules.

No deprecated out-of-band OAuth flow.

---

## 8. OAuth client secret and token storage

### 8.1 OAuth client credential

OAuth client secret:

- server-side only;
- managed through the selected runtime secret store;
- never committed to Git;
- never sent to the browser;
- never printed in tests/logs/issues.

### 8.2 Access token

Prefer not to persist access tokens as the durable credential if a refresh token is available.

If cached/persisted for operational reasons, it receives the same encryption/redaction boundary as refresh credentials and a short explicit lifetime.

### 8.3 Refresh token

A refresh token is a long-lived bearer credential and must be treated as high sensitivity.

Selected storage direction:

```text
encrypted refresh credential in canonical shared DB
+
versioned server-side encryption key from runtime secret store
```

Required encryption properties:

- authenticated encryption, e.g. AES-GCM or an equivalent reviewed primitive;
- unique random nonce/IV per encrypted value;
- key version identifier to permit rotation;
- associated-data binding to at least provider connection identity and actor/account context where practical;
- plaintext refresh token never stored in logs or ordinary telemetry;
- decrypt only inside the server runtime immediately before provider token refresh/use;
- key rotation and re-encryption plan.

Do not store the refresh token in localStorage, sessionStorage, ordinary cookies, or client-visible application state.

The exact crypto library/runtime implementation is a follow-up security implementation decision and must use maintained platform/library primitives rather than home-grown cryptography.

---

## 9. Offline access decision

V1 should request offline access.

Reason:

- a large import is a server-side async job;
- the user may close the browser after submitting;
- access tokens expire;
- subsequent owned-playlist imports should not require a full consent round-trip every time.

Google documents `access_type=offline` for server applications that need refresh capability while the user is absent.

Do not force `prompt=consent` on every connection attempt. Use explicit reconnect/re-consent UX only when a refresh credential is missing, revoked, expired or scope upgrade is required.

---

## 10. Private playlist discovery contract

After an active provider connection exists, candidate route:

```text
GET /api/integrations/youtube/playlists?cursor=...
```

The server calls YouTube using OAuth:

```text
playlists.list
mine=true
part=snippet,contentDetails,status
maxResults=50
pageToken=<provider token when present>
```

Return a normalized application envelope, not the raw provider response.

Candidate fields:

```text
providerPlaylistRef     opaque application/provider reference
provider                youtube
name                    playlist title for the owner UI only
itemCount
privacyStatus           normalized owner-visible provider state
thumbnail               optional safe representative thumbnail if available
nextCursor               opaque application cursor
```

Do not expose refresh/access credentials, provider raw error payloads or unnecessary account metadata.

### Pagination

The API supports provider pagination. LoveBud/LoveTree must preserve it; do not assume a user owns <= 50 playlists.

The UI may progressively fetch pages or search/filter client-side over fetched normalized pages.

---

## 11. Selected-playlist item read contract

A selected private playlist must be chosen from an active actor-owned provider connection or validated against that connection.

Candidate backend operation:

```text
playlistItems.list
playlistId=<selected owned playlist>
part=snippet,contentDetails,status
maxResults=50
pageToken=...
```

For 5,000 items this can require up to roughly 100 item pages, which is why enumeration belongs to the async import job after authorization/domain authority is established.

The interactive discovery endpoint must not synchronously fetch all 5,000 items before returning ordinary playlist-selection UI.

A small first-page preview is allowed but must be labeled as partial unless it is complete.

---

## 12. Error normalization

Browser-visible errors are typed and recovery-oriented.

Candidate categories:

```text
YOUTUBE_NOT_CONNECTED
YOUTUBE_REAUTH_REQUIRED
YOUTUBE_AUTH_DENIED
YOUTUBE_SCOPE_MISSING
YOUTUBE_ACCOUNT_UNAVAILABLE
YOUTUBE_PLAYLIST_NOT_FOUND_OR_NOT_OWNED
YOUTUBE_RATE_OR_QUOTA_LIMITED
YOUTUBE_PROVIDER_UNAVAILABLE
YOUTUBE_CONFIGURATION_REQUIRED
```

Do not relay raw Google OAuth/provider error descriptions if they can expose implementation or user/account data.

Internally preserve category-level diagnostics only.

---

## 13. Revocation, expiry and disconnect

### Refresh failure

If provider refresh returns an invalid/revoked credential outcome:

```text
connection → reauth_required
```

Do not repeatedly retry a known-invalid refresh credential.

### User disconnect

Candidate route:

```text
DELETE /api/integrations/youtube/connection
```

Requirements:

- authenticated owner only;
- atomically disable the provider connection;
- revoke provider access when supported/appropriate;
- delete or cryptographically render unusable stored refresh credentials;
- cancel or fail queued jobs that still require provider access according to #4027;
- preserve already-created LoveTree/Moment canonical data unless the user separately requests Tree/content deletion;
- preserve only minimal non-secret audit metadata required by policy/operations.

Disconnecting YouTube does not automatically delete a LoveTree that was already snapshot-imported.

### Account deletion

Account deletion must include provider credential deletion and must coordinate with canonical Tree/Moment deletion/retention authority.

---

## 14. Google verification / consent-screen release gate

Before public Production rollout:

- YouTube Data API v3 enabled in the selected Google Cloud project;
- OAuth consent configuration matches the actual product domain/name/privacy policy;
- exact requested scope registered;
- authorized redirect URI exact-match configured;
- application verification completed if required by Google's current scope/app classification;
- demo/justification material accurately shows the YouTube-connect/private-playlist feature if verification requires it;
- staging/test configuration separated from Production when needed;
- privacy policy discloses YouTube API data access, use, storage and disconnect/deletion handling;
- app complies with current YouTube API Services Terms and Developer Policies.

Do not deploy a public feature that leaves ordinary users behind an “unverified app” wall without an explicit product-owner release decision and current Google-policy review.

---

## 15. Current LoveBud runtime mapping

Current production pattern is:

```text
browser
→ same-origin Cloudflare Pages Function
→ backend compute
→ Neon
```

Implementation direction:

```text
same-origin OAuth start/callback routes
→ shared server-side provider-auth module
→ canonical provider-connection persistence
→ YouTube API
```

The exact backend runtime must be revalidated immediately before implementation because #4004 is actively converging the LoveBud/LoveTree backend.

Do not create provider credential persistence in a second `lovetree-limone` database.

---

## 16. Candidate persistence concepts

Schema implementation is not authorized here, but the domain needs equivalents of:

```text
provider_connections
- id
- actor_id
- provider = youtube
- provider_account_ref / channel_ref
- encrypted_refresh_credential
- encryption_key_version
- granted_scopes
- status
- connected_at
- last_verified_at
- revoked/disconnected_at

provider_oauth_states
- state_hash
- actor_id
- provider
- expires_at
- consumed_at
- safe_return_target
```

Required invariants:

- one-time state cannot be replayed;
- provider connection ownership cannot be client-controlled;
- encrypted credential never appears in ordinary reads;
- indexes support actor/provider lookup;
- uniqueness policy for reconnect/multiple YouTube identities is explicit before migration.

Whether one LoveTree actor may connect multiple YouTube identities is a later product decision; V1 may deliberately support one active YouTube connection per actor if that keeps the contract safer and simpler.

---

## 17. Security test matrix required for implementation

At minimum:

1. unauthenticated OAuth start rejected;
2. valid start creates one short-lived state;
3. guessed state rejected;
4. expired state rejected;
5. replayed state rejected;
6. callback code without state rejected;
7. provider denial produces safe recovery;
8. missing required scope produces `reauth_required`/scope failure;
9. callback binds only to actor captured at start;
10. provider connection for actor A inaccessible to actor B;
11. encrypted credential never returned by normal API;
12. revoked refresh credential transitions to reauth state without retry storm;
13. disconnect makes stored credential unusable;
14. logs do not contain code/access token/refresh token/client secret;
15. Preview credentials/state cannot bind to Production actor data;
16. playlist discovery can return owned private playlist metadata after valid authorization;
17. public API-key preview remains independent/non-regressed.

---

## 18. Non-goals

- no YouTube write scope;
- no playlist privacy mutation;
- no OAuth during ordinary app login;
- no browser-owned refresh credential;
- no service-account authorization for YouTube user data;
- no raw provider response passthrough;
- no 5K import execution in the OAuth implementation PR;
- no Tree/Moment schema/order changes in the OAuth implementation PR;
- no AI processing;
- no Production credential setup via Git commit.

---

## 19. Implementation split after this authority

Recommended narrow runtime sequence:

1. provider OAuth state + encrypted-credential schema/migration contract, coordinated with #4004;
2. server-side OAuth start/callback + disconnect;
3. normalized `my playlists` read endpoint;
4. private selected-playlist first-page/read adapter;
5. handoff to #4027 async enumeration/import job.

Each PR must revalidate current #4004 runtime ownership and exact `main` before source changes.

---

## 20. Authority verdict

```text
PRIVATE_YOUTUBE_AUTHORITY = SELECTED
PROVIDER_AUTH = GOOGLE_OAUTH_2_SERVER_SIDE_AUTH_CODE
MIN_SCOPE = youtube.readonly
OFFLINE_REFRESH = REQUIRED_FOR_ASYNC_PRODUCT_FLOW
SOURCE_PLAYLIST_VISIBILITY_MUTATION = PROHIBITED
BROWSER_REFRESH_TOKEN_STORAGE = PROHIBITED
PUBLIC_API_KEY_PREVIEW = RETAINED_AS_SEPARATE_SECONDARY_PATH
RUNTIME_IMPLEMENTATION = NOT_YET_PERFORMED
```
