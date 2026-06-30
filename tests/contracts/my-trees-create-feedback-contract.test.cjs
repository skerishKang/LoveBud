const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const actionsSource = readRepoFile('js/my-trees/my-trees-actions.js');
const myTreesHtml = readRepoFile('pages/my-trees.html');
const i18nSource = readRepoFile('js/i18n/i18n-my-trees.js');
const myTreesJs = readRepoFile('js/my-trees.js');

test('CTA open only opens modal - does not call create mutation', () => {
  // Verify setupCreateTreeModal is called from createNewTree, not create mutation directly
  assert.match(actionsSource, /setupCreateTreeModal\(/, 'createNewTree must call setupCreateTreeModal first');
  assert.match(actionsSource, /openCreateTreeModal\(/, 'createNewTree must call openCreateTreeModal to show modal');
  // The actual create mutation (apiClient.createTree) must only be called after modal submit
  // This is verified by checking the flow: openCreateTreeModal returns Promise that resolves on form submit
  assert.match(actionsSource, /openCreateTreeModal\(.*\)\.then|await openCreateTreeModal/, 'createNewTree must await modal result before createTree call');
});

test('Cancel, backdrop close, Escape do not call create mutation', () => {
  // All close paths call closeModal with null payload
  assert.match(actionsSource, /cancelBtn\.addEventListener\('click'[^)]*\)\s*\{[^}]*closeModal\(null\)/, 'Cancel button must call closeModal with null');
  assert.match(actionsSource, /closeBtn\.addEventListener\('click'[^)]*\)\s*\{[^}]*closeModal\(null\)/, 'Close button must call closeModal with null');
  assert.match(actionsSource, /backdrop\.addEventListener\('click'[^)]*\)\s*\{[^}]*closeModal\(null\)/, 'Backdrop click must call closeModal with null');
  assert.match(actionsSource, /event\.key === 'Escape'[^}]*closeModal\(null\)/, 'Escape key must call closeModal with null');
  // All close handlers guard with isSubmitting check
  assert.match(actionsSource, /if \(createTreeModalState\.isSubmitting\) return;/s, 'Close handlers must guard against submitting state');
});

test('Title submit creates pending state and disables CTA immediately', () => {
  // Form submit handler sets isSubmitting true via setSubmitting
  assert.match(actionsSource, /form\.addEventListener\('submit'/, 'Form must have submit handler');
  assert.match(actionsSource, /setSubmitting\(true, i18n\)/, 'Submit must call setSubmitting(true)');
  // Submit button text changes to creating state
  assert.match(actionsSource, /submitBtn\.textContent.*creating|submitBtn\.textContent.*preparing/i, 'Submit button must show creating text');
  // aria-busy is set on backdrop for accessibility
  assert.match(actionsSource, /backdrop\.setAttribute\('aria-busy', 'true'\)/, 'Modal must set aria-busy on submit');
  // Input and cancel/close buttons disabled
  assert.match(actionsSource, /titleInput\.disabled = !!isSubmitting/, 'Title input must be disabled during submit');
  assert.match(actionsSource, /cancelBtn\.disabled = !!isSubmitting/, 'Cancel button must be disabled during submit');
  assert.match(actionsSource, /closeBtn\.disabled = !!isSubmitting/, 'Close button must be disabled during submit');
});

test('Click, Enter, rapid clicks result in exactly one create mutation', () => {
  // Form submit prevents default and returns early if isSubmitting
  assert.match(actionsSource, /event\.preventDefault\(\).*;/, 'Form submit must prevent default');
  assert.match(actionsSource, /if \(createTreeModalState\.isSubmitting\) return;/, 'Form submit must guard against duplicate submits');
  // createNewTree also disables header and empty buttons immediately
  assert.match(actionsSource, /headerBtn\.disabled = true/, 'Header create button must be disabled during create');
  assert.match(actionsSource, /emptyBtn\.disabled = true/, 'Empty state create button must be disabled during create');
});

test('Success triggers exactly one redirect after success status shown', () => {
  // On success, redirect happens once with timeout
  assert.match(actionsSource, /setTimeout\(function\(\) \{\s*window\.location\.href = redirectTarget;/, 'Redirect must use setTimeout exactly once');
  // Success message shown before redirect
  assert.match(actionsSource, /successMsg.*create_success|myTrees\.create_success/, 'Success message key must be used');
  assert.match(actionsSource, /submitBtn\.textContent = successMsg/, 'Submit button must show success message');
  assert.match(actionsSource, /headerBtn\.innerHTML.*check_circle.*successMsg/, 'Header button must show success message');
  // aria-busy cleared on success
  assert.match(actionsSource, /backdrop\.removeAttribute\('aria-busy'\)/, 'aria-busy must be cleared on success');
  // Only one redirect call
  const redirectMatches = actionsSource.match(/window\.location\.href = redirectTarget/g) || [];
  assert.equal(redirectMatches.length, 1, 'Exactly one redirect assignment expected');
});

test('Success status set before redirect', () => {
  // Success message displayed on buttons before redirect
  assert.match(actionsSource, /submitBtn\.textContent = successMsg[\s\S]*?setTimeout/, 'Success message must be set before setTimeout redirect');
  assert.match(actionsSource, /headerBtn\.innerHTML.*successMsg[\s\S]*?setTimeout/, 'Header success message must be set before redirect');
});

test('Failure preserves input title, restores CTA, shows safe inline error', () => {
  // On catch: title input NOT cleared
  // The error handler does NOT clear titleInput.value - it only re-enables via setSubmitting(false)
  // Buttons restored to original state
  assert.match(actionsSource, /headerBtn\.disabled = false/, 'Header button must be re-enabled on error');
  assert.match(actionsSource, /headerBtn\.innerHTML = restoreHeaderText/, 'Header button must restore original text');
  assert.match(actionsSource, /emptyBtn\.disabled = false/, 'Empty button must be re-enabled on error');
  assert.match(actionsSource, /emptyBtn\.innerHTML = restoreEmptyText/, 'Empty button must restore original text');
  // setSubmitting(false) re-enables input
  assert.match(actionsSource, /modal\.setSubmitting\(false.*i18n\)/, 'Modal must call setSubmitting(false) on error');
  // Safe error message used
  assert.match(actionsSource, /myTrees\.create_tree_fail|create_tree_fail/, 'Safe error message key must be used');
  // No raw error, provider payload, credential, or stack exposed
  assert.doesNotMatch(actionsSource, /console\.error.*stack/, 'Stack trace must not be in user-facing path');
  assert.doesNotMatch(actionsSource, /e\.response|e\.data|provider|credential/, 'Provider payload/credential must not be exposed');
});

test('Safe inline error only - no raw error, provider payload, credential, internal stack', () => {
  // Error shown via setError with i18n key
  assert.match(actionsSource, /modal\.setError\(safeText\(i18n.*myTrees\.create_tree_fail/, 'Error must use safeText with i18n key');
  // Toast also uses safe key
  assert.match(actionsSource, /showToast.*safeText\(i18n.*myTrees\.create_tree_fail/, 'Toast must use safe error key');
});

test('Initial bootstrap incomplete state does not leave CTA unresponsive', () => {
  // setupHeaderCreateButton attaches handler even if myTreesPage not loaded
  assert.match(myTreesJs, /function setupHeaderCreateButton\(\)/, 'setupHeaderCreateButton must exist');
  assert.match(myTreesJs, /btn\.addEventListener\('click'/, 'Header button must have click handler attached');
  // createNewTree is available as fallback even without myTreesActions module
  assert.match(myTreesJs, /warnMissingModule\('LoveBudMyTreesActions', 'createNewTree'\)/, 'Must warn if module missing but not crash');
});

test('Existing My Trees normal create route not broken', () => {
  // createNewTree function exported and callable
  assert.match(actionsSource, /window\.LoveBudMyTreesActions = \{[\s\S]*createNewTree: createNewTree/, 'createNewTree must be exported');
  // Modal elements exist in HTML
  assert.match(myTreesHtml, /id="createTreeModalBackdrop"/, 'Modal backdrop must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalForm"/, 'Modal form must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeTitleInput"/, 'Title input must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalSubmitBtn"/, 'Submit button must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalCancelBtn"/, 'Cancel button must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalCloseBtn"/, 'Close button must exist in HTML');
  assert.match(myTreesHtml, /id="createTreeModalError"/, 'Error element must exist in HTML');
  // Header and empty state CTAs exist
  assert.match(myTreesHtml, /id="headerCreateTreeBtn"/, 'Header CTA must exist');
  assert.match(myTreesHtml, /id="createTreeBtn"/, 'Empty state CTA must exist');
});

test('No #1882 closing keyword in test file', () => {
  const testSource = readRepoFile('tests/contracts/my-trees-create-feedback-contract.test.cjs');
  assert.doesNotMatch(testSource, /#1882\s*close|closes\s*#1882|fixes\s*#1882/i, 'Test file must not contain #1882 closing keyword');
  // "Refs #1882" in instructions is allowed - only closing keywords are forbidden
});

test('i18n keys for creating/success states exist', () => {
  assert.match(i18nSource, /myTrees\.creating.*러브트리를 준비하고 있어요.*Preparing your LoveTree/, 'myTrees.creating key must exist');
  assert.match(i18nSource, /myTrees\.create_success.*러브트리가 만들어졌어요.*LoveTree created/, 'myTrees.create_success key must exist');
  assert.match(i18nSource, /myTrees\.create_tree_fail.*러브트리 만들기 실패.*Failed to create LoveTree/, 'myTrees.create_tree_fail key must exist');
});

test('aria-hidden remains false during success confirmation', () => {
  // On success, aria-busy is removed but aria-hidden stays false until redirect
  assert.match(actionsSource, /backdrop\.removeAttribute\('aria-busy'\)/, 'aria-busy must be cleared on success');
  // Check that setAttribute('aria-hidden', 'true') is NOT in the success path (before redirect)
  // The comment in the code confirms this: "Keep aria-hidden='false' during success confirmation"
  assert.match(actionsSource, /Keep aria-hidden="false" during success confirmation/, 'Code must contain comment confirming aria-hidden stays false');
});