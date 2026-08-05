// #3887 — Editor i18n dictionary extension, externalized from the inline
// block that previously lived in pages/editor.html so the Editor HTML no
// longer carries an executable inline i18n dictionary (CSP inline-block
// avoidance). Loaded immediately after js/i18n/i18n-editor.js and before
// the i18n consumers (i18n-my-trees.js / i18n-index.js / i18n.js). The six
// keys below are byte- and semantic-equivalent to the removed inline block;
// no other surface copy changes.
window.i18nEditor = Object.assign(window.i18nEditor || {}, {
  editor_sidebar_public_tree: { ko: "공개", en: "Public" },
  editor_sidebar_private_tree: { ko: "비공개", en: "Private" },
  detail_empty_title: {
    ko: "아직 선택한 순간이 없어요",
    en: "No moment selected yet.",
  },
  detail_empty_desc: {
    ko: "첫 순간은 가운데에서 시작하세요.",
    en: "Start the first moment from the canvas.",
  },
  editor_current_moment_empty_title: {
    ko: "아직 선택한 순간이 없어요",
    en: "No moment selected yet.",
  },
  editor_current_moment_empty_hint: {
    ko: "첫 순간은 가운데 캔버스에서 시작하세요.",
    en: "Start the first moment from the center canvas.",
  },
});
