# LoveBud Engineering 臾몄꽌 ?몃뜳??
??臾몄꽌??LoveBud ?붿??덉뼱留?臾몄꽌???꾩옱 湲곗? ?쎄린 ?쒖꽌瑜??뺣━?⑸땲??

?꾩옱 ?댁쁺 ?꾩젣???꾨옒? 媛숈뒿?덈떎.

- ?ㅼ꽌鍮꾩뒪 ?꾨줎?? `https://lovebud.pages.dev/`
- ?명봽???곗꽑?쒖쐞: **Modal > Cloudflare Pages > Vercel > Netlify**
- Cloudflare Pages??怨듭떇 user-facing entry?댁옄 same-origin `/api` router?낅땲??
- Modal? active compute/runtime ?곗꽑 寃쎈줈?낅땲??
- Vercel? upstream / secondary / transitional fallback 怨꾩링?낅땲??
- Netlify??legacy artifact / removal candidate?낅땲?? active production fallback???꾨떃?덈떎.
- 釉뚮씪?곗???媛?ν븯硫?**same-origin `/api`** 留??ъ슜?⑸땲??
- browse display filter ? publication guard ???ㅻⅨ 臾몄젣濡??ㅻ９?덈떎.

---

## 癒쇱? ?쎄린

1. [API_CONTRACT.md](./API_CONTRACT.md) - API ?묐떟 怨꾩빟 (flat camelCase)
2. [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./BROWSE_FILTER_VS_PUBLICATION_GUARD.md) - browse filter / publication guard 援щ텇
3. [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md) - module size, thin entrypoint, browser-global split, large file refactor safety policy
4. [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) - stylesheet import hub, split ownership, visual verification 湲곗?
5. [SCRIPT_LOAD_ORDER.md](./SCRIPT_LOAD_ORDER.md) - pages/*.html script order runtime contract, Auth/Login dependency order, reorder checklist
6. [SEARCH_RUNTIME_CONTRACT.md](./SEARCH_RUNTIME_CONTRACT.md) - Search/Browse runtime script order, globals, submodule boundary
7. [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md) - Auth/Login active provider transition ?④퀎, 湲덉? 議고빀, fixed test slot 寃利?湲곗?
8. [CSS_HTML_CLEANUP_STATUS_MAP.md](./CSS_HTML_CLEANUP_STATUS_MAP.md) - #137 CSS/HTML cleanup backlog ?곹깭? ?⑥? ?묒뾽 ?쒖꽌
9. [EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md](./EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md) - Editor fallback factories? global state cleanup path 媛먯궗 怨꾪쉷
10. [AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md](./AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md) - #224 Auth/Editor fallback findings??#78/#223/#225 ownership mapping
11. [SHARED_HEADER_CONFIG_HELPER_DECISION.md](./SHARED_HEADER_CONFIG_HELPER_DECISION.md) - Shared header config/helper extraction defer 寃곗젙怨?follow-up trigger
12. [REVIEW_GUARDRAILS.md](./REVIEW_GUARDRAILS.md) - 諛섎났 false positive 諛⑹? 洹쒖튃
13. [RECENT_REFACTORING.md](./RECENT_REFACTORING.md) - 理쒓렐 由ы뙥?곕쭅 湲곕줉
14. [EDITOR_OVERRIDES_RELOCATION_AUDIT.md](./EDITOR_OVERRIDES_RELOCATION_AUDIT.md) - css/editor/overrides.css role-based relocation ?꾨낫 audit (援ы쁽 ?놁쓬, #137 ?꾩냽)

---

## ?듭떖 臾몄꽌

| 臾몄꽌 | ?ㅻ챸 |
|------|------|
| [API_CONTRACT.md](./API_CONTRACT.md) | ?꾨줎?몄? API媛 ?곕Ⅴ??flat camelCase 怨꾩빟 |
| [BROWSE_FILTER_VS_PUBLICATION_GUARD.md](./BROWSE_FILTER_VS_PUBLICATION_GUARD.md) | browse ?쒖떆 ?뺤콉怨?publication guard 遺꾨━ 湲곗? |
| [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md) | ?뚯씪 ?ш린, thin entrypoint, browser-global module split, ????뚯씪 由ы뙥?곕쭅 ?덉쟾 ?쒖꽌 |
| [CSS_ARCHITECTURE.md](./CSS_ARCHITECTURE.md) | CSS import hub, split ownership, import order, visual verification 湲곗? |
| [SCRIPT_LOAD_ORDER.md](./SCRIPT_LOAD_ORDER.md) | pages/*.html script load order runtime contract, Auth/Login dependency order, reorder checklist |
| [SEARCH_RUNTIME_CONTRACT.md](./SEARCH_RUNTIME_CONTRACT.md) | Search/Browse runtime script order, globals, submodule boundary, smoke checklist |
| [SEARCH_PREVIEW_CONTROLLER_SPLIT_AUDIT.md](./SEARCH_PREVIEW_CONTROLLER_SPLIT_AUDIT.md) | Search/Browse preview controller split 以鍮?audit? ?꾩냽 援ы쁽 guardrail |
| [AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md](./AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md) | Auth/Login active provider transition ?④퀎, file ownership, forbidden combinations, fixed slot smoke 湲곗? |
| [REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md](./REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md) | Issue #223 repository structure follow-up bucket disposition, active blockers, and closure conditions |
| [EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md](./EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md) | Editor fallback factories, `window.currentTreeMemories`, `window.currentTreeData`, compatibility aliases, future store migration 湲곗? |
| [AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md](./AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md) | Auth fallback cleanup, Editor fallback factories, and `window.currentTreeMemories/currentTreeData` ownership mapping for #224/#78/#223/#225 |
| [SHARED_HEADER_CONFIG_HELPER_DECISION.md](./SHARED_HEADER_CONFIG_HELPER_DECISION.md) | Shared header render/mobile nav/language/Auth/path helper 梨낆엫怨?config/helper extraction defer 湲곗? |
| [EDITOR_OVERRIDES_RELOCATION_AUDIT.md](./EDITOR_OVERRIDES_RELOCATION_AUDIT.md) | `css/editor/overrides.css` role-based relocation ?꾨낫 audit ??援ы쁽 ?놁쓬, cascade ?꾪뿕 臾몄꽌?? future PR split 怨꾪쉷 (#137 ?꾩냽) |
| [SUPABASE_FREE_POC_PLAN.md](./SUPABASE_FREE_POC_PLAN.md) | Supabase Free PoC 湲곕컲 ?κ린 backend 援ъ“ ?⑥닚??寃利?怨꾪쉷 |
| [REVIEW_GUARDRAILS.md](./REVIEW_GUARDRAILS.md) | 諛섎났 false positive 諛⑹?? 由щ럭 洹쒖튃 |
| [RECENT_REFACTORING.md](./RECENT_REFACTORING.md) | 理쒓렐 肄붾뱶 援ъ“ ?뺣━ ?댁뿭 |
| [UTIL_USAGE_POLICY.md](./UTIL_USAGE_POLICY.md) | 怨듯넻 ?좏떥 ?ъ슜 ?뺤콉 |
| [COMMON_CODE_CANDIDATES.md](./COMMON_CODE_CANDIDATES.md) | 怨듯넻???꾨낫 |
| [FIREBASE_CONFIG_GLOBAL_MIGRATION_STRATEGY.md](./FIREBASE_CONFIG_GLOBAL_MIGRATION_STRATEGY.md) | Firebase config/global migration staged strategy |
| [FIREBASE_CONFIG_CONTRACT.md](./FIREBASE_CONFIG_CONTRACT.md) | Firebase config/init global contract |
| [CTO_REPORT_20260418.md](./CTO_REPORT_20260418.md) | ?뱀젙 ?쒖젏 ?붿??덉뼱留??붿빟 |

---

## ?쎌쓣 ??二쇱쓽????
- ???대뜑???쒗뭹 泥좏븰 臾몄꽌???泥대Ъ???꾨떃?덈떎.
- ?쒗뭹 / 釉뚮옖??/ UI ?먮떒? 癒쇱? ?꾨옒 臾몄꽌瑜?遊낅땲??
  - `../product/PRODUCT_IDENTITY.md`
  - `../product/BRAND_EXPERIENCE.md`
  - `../design/UI_DESIGN_SYSTEM.md`
- ?붿??덉뼱留?臾몄꽌???꾩옱 怨꾩빟, 援ъ“, 遺꾨━ 湲곗?, ?꾪솚 ?먯튃???ㅻ챸?섎뒗 ?⑸룄濡??ъ슜?⑸땲??
- ?고???/ 諛고룷 ?먮떒? `../ops/OPERATIONS.md`? `../migration/VERCEL_MODAL_MIGRATION_RUNBOOK.md`???꾩옱 湲곗????곗꽑?⑸땲??
- 諛섎났?섎뒗 ?ㅽ뙋 諛⑹???`REVIEW_GUARDRAILS.md`瑜?湲곗??쇰줈 ?⑸땲??
- ?좉퇋 肄붾뱶 援ъ“, thin entrypoint, browser-global split, ????뚯씪 由ы뙥?곕쭅 ?쒖꽌??`CODE_ARCHITECTURE.md`瑜?湲곗??쇰줈 ?⑸땲??
- pages/*.html script order 蹂寃??먮떒? `SCRIPT_LOAD_ORDER.md`瑜?癒쇱? 蹂닿퀬, Auth/Login active provider ?꾪솚? `AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md`? ?④퍡 遊낅땲??
- Auth/Login active provider ?꾪솚? `AUTH_LOGIN_ACTIVE_PROVIDER_TRANSITION_PLAN.md`??phase gate? 湲덉? 議고빀??湲곗??쇰줈 ?⑸땲??
- CSS import hub, split ownership, visual verification ?먮떒? `CSS_ARCHITECTURE.md`? `../ops/BROWSER_VERIFICATION_URL_POLICY.md`瑜??④퍡 遊낅땲??
- #223 repository structure follow-up closure ?먮떒? `REPOSITORY_STRUCTURE_FOLLOWUP_STATUS_MAP.md`?먯꽌 active blockers and closure conditions瑜?癒쇱? ?뺤씤?⑸땲??
- Editor fallback factory, `window.currentTreeMemories`, `window.currentTreeData`, compatibility alias ?뺣━??`EDITOR_FALLBACK_GLOBAL_STATE_AUDIT.md`??audit gate瑜?癒쇱? ?듦낵?댁빞 ?⑸땲??
- #224 Auth/Editor fallback checklist ?먮떒? `AUTH_EDITOR_FALLBACK_CHECKLIST_MAPPING.md`?먯꽌 #78/#223/#225 ownership mapping??癒쇱? ?뺤씤?⑸땲??
- Shared header config/path helper extraction ?먮떒? `SHARED_HEADER_CONFIG_HELPER_DECISION.md`??defer 議곌굔怨?follow-up trigger瑜?癒쇱? ?뺤씤?⑸땲??
- `css/editor/overrides.css` relocation ?먮떒? `EDITOR_OVERRIDES_RELOCATION_AUDIT.md`??cascade risk 諛?future implementation gate瑜?癒쇱? ?뺤씤?⑸땲??

---

## ?묒꽦 洹쒖튃

1. ?덈줈??湲곗닠 臾몄꽌?????대뜑???앹꽦?⑸땲??
2. ?앹꽦 ??`docs/doc_index.md`?먮룄 異붽??⑸땲??
3. API 怨꾩빟?대굹 寃쎈줈 ?꾨왂??諛붾뚮㈃ 愿???댁쁺 臾몄꽌? ?④퍡 媛깆떊?⑸땲??
