/**
 * relationship-hints-ui-controller.js
 *
 * UI-only relationship hints accept/dismiss controller for the editor/canvas.
 * This slice wires the #2460 state machine to a non-persistent hint surface.
 */

(function () {
  'use strict';

  const RELATIONSHIP_HINTS_UI_PANEL_ID = 'relationshipHintsPanel';
  const RELATIONSHIP_HINTS_UI_TITLE_ID = 'relationshipHintsTitle';
  const RELATIONSHIP_HINTS_UI_BODY_ID = 'relationshipHintsBody';
  const RELATIONSHIP_HINTS_UI_ACCEPT_ID = 'relationshipHintsAcceptBtn';
  const RELATIONSHIP_HINTS_UI_DISMISS_ID = 'relationshipHintsDismissBtn';
  const RELATIONSHIP_HINTS_UI_HIDE_ID = 'relationshipHintsHideBtn';
  const RELATIONSHIP_HINTS_UI_RETRY_ID = 'relationshipHintsRetryBtn';

  const BLOCKED_UI_EVENTS = Object.freeze([
    'confirm_save_relationship',
    'automatic_relationship_creation',
    'draw_relationship_edge'
  ]);

  const DEFAULT_TEXT = Object.freeze({
    eyebrow: 'Relationship hint',
    presentedTitle: 'Possible next connection',
    presentedBody: 'This is a suggested relationship only. Review it before deciding what to do next.',
    acceptedTitle: 'Ready for review',
    acceptedBody: 'You accepted the suggestion for review. No relationship has been saved yet.',
    errorTitle: 'Relationship hint unavailable',
    errorBody: 'The suggestion could not be prepared for review.',
    accept: 'Review',
    dismiss: 'Dismiss',
    hide: 'Close',
    retry: 'Retry'
  });

  function hasDocument(documentRef) {
    return Boolean(documentRef && typeof documentRef.createElement === 'function' && typeof documentRef.getElementById === 'function');
  }

  function text(opts, key, fallback) {
    const i18n = opts.i18n;
    if (typeof i18n === 'function') {
      const translated = i18n(key);
      return translated && translated !== key ? translated : fallback;
    }
    return fallback;
  }

  function createButton(documentRef, id, className, label) {
    const button = documentRef.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    return button;
  }

  function createPanelElement(documentRef, opts) {
    const panel = documentRef.createElement('section');
    const title = documentRef.createElement('h3');
    const body = documentRef.createElement('p');
    const acceptButton = createButton(documentRef, RELATIONSHIP_HINTS_UI_ACCEPT_ID, 'relationship-hints-ui__button relationship-hints-ui__button--primary', text(opts, 'relationship_hints_accept', DEFAULT_TEXT.accept));
    const dismissButton = createButton(documentRef, RELATIONSHIP_HINTS_UI_DISMISS_ID, 'relationship-hints-ui__button relationship-hints-ui__button--secondary', text(opts, 'relationship_hints_dismiss', DEFAULT_TEXT.dismiss));
    const retryButton = createButton(documentRef, RELATIONSHIP_HINTS_UI_RETRY_ID, 'relationship-hints-ui__button relationship-hints-ui__button--secondary', text(opts, 'relationship_hints_retry', DEFAULT_TEXT.retry));
    const hideButton = createButton(documentRef, RELATIONSHIP_HINTS_UI_HIDE_ID, 'relationship-hints-ui__button relationship-hints-ui__button--ghost', text(opts, 'relationship_hints_hide', DEFAULT_TEXT.hide));

    panel.id = opts.panelElementId || RELATIONSHIP_HINTS_UI_PANEL_ID;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-label', text(opts, 'relationship_hints_panel_label', 'Relationship hints panel'));
    panel.className = 'relationship-hints-ui is-hidden';

    title.id = opts.titleElementId || RELATIONSHIP_HINTS_UI_TITLE_ID;
    body.id = opts.bodyElementId || RELATIONSHIP_HINTS_UI_BODY_ID;

    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(acceptButton);
    panel.appendChild(dismissButton);
    panel.appendChild(retryButton);
    panel.appendChild(hideButton);

    return panel;
  }

  function getElementById(documentRef, id) {
    if (!hasDocument(documentRef) || typeof documentRef.getElementById !== 'function') return null;
    return documentRef.getElementById(id);
  }

  function createRejectedResult(from, event, reason) {
    return Object.freeze({
      accepted: false,
      from: from || 'not_shown',
      event: event,
      to: null,
      reason: reason || 'Relationship hints UI controller has no state machine.',
      persistenceEffect: 'none'
    });
  }

  function createRelationshipHintsUIController(options) {
    const opts = options || {};
    const documentRef = opts.documentRef || (typeof document !== 'undefined' ? document : null);
    const hasExplicitStateMachineFactory = Object.prototype.hasOwnProperty.call(opts, 'stateMachineFactory');
    const stateMachineFactory = hasExplicitStateMachineFactory
      ? opts.stateMachineFactory
      : (typeof globalThis !== 'undefined' && globalThis.LoveBudRelationshipHintStateMachine && globalThis.LoveBudRelationshipHintStateMachine.createRelationshipHintStateMachine);
    let stateMachine = null;
    let currentHint = null;
    let currentVisualState = opts.initialState || 'not_shown';
    let transitionLog = [];
    let destroyed = false;

    if (typeof stateMachineFactory === 'function') {
      stateMachine = stateMachineFactory({
        initialState: currentVisualState,
        onTransition: function (result) {
          transitionLog.push(result);
          if (typeof opts.onTransition === 'function') {
            opts.onTransition(result);
          }
        }
      });
    }

    const rootElement = opts.rootElement || (hasDocument(documentRef) ? getElementById(documentRef, opts.rootElementId || 'canvasArea') : null) || (documentRef && documentRef.body) || null;
    const panel = opts.panelElement || (hasDocument(documentRef) ? getElementById(documentRef, opts.panelElementId || RELATIONSHIP_HINTS_UI_PANEL_ID) : null) || (hasDocument(documentRef) ? createPanelElement(documentRef, opts) : null);
    const title = opts.titleElement || (panel && panel.querySelector ? panel.querySelector('#' + (opts.titleElementId || RELATIONSHIP_HINTS_UI_TITLE_ID)) : null);
    const body = opts.bodyElement || (panel && panel.querySelector ? panel.querySelector('#' + (opts.bodyElementId || RELATIONSHIP_HINTS_UI_BODY_ID)) : null);
    const acceptButton = opts.acceptButton || (panel && panel.querySelector ? panel.querySelector('#' + (opts.acceptButtonId || RELATIONSHIP_HINTS_UI_ACCEPT_ID)) : null);
    const dismissButton = opts.dismissButton || (panel && panel.querySelector ? panel.querySelector('#' + (opts.dismissButtonId || RELATIONSHIP_HINTS_UI_DISMISS_ID)) : null);
    const hideButton = opts.hideButton || (panel && panel.querySelector ? panel.querySelector('#' + (opts.hideButtonId || RELATIONSHIP_HINTS_UI_HIDE_ID)) : null);
    const retryButton = opts.retryButton || (panel && panel.querySelector ? panel.querySelector('#' + (opts.retryButtonId || RELATIONSHIP_HINTS_UI_RETRY_ID)) : null);
    const handlers = [];

    if (panel && !panel.parentNode && rootElement && typeof rootElement.appendChild === 'function') {
      rootElement.appendChild(panel);
    }

    function getState() {
      if (stateMachine && typeof stateMachine.getState === 'function') {
        return stateMachine.getState();
      }
      return currentVisualState;
    }

    function getCurrentHint() {
      return currentHint;
    }

    function getTransitionLog() {
      return transitionLog.slice();
    }

    function bindButton(button, handler) {
      if (!button || typeof button.addEventListener !== 'function') return;
      button.addEventListener('click', handler);
      handlers.push([button, handler]);
    }

    function setHidden(element, hidden) {
      if (!element) return;
      element.hidden = Boolean(hidden);
      if (element.classList && typeof element.classList.toggle === 'function') {
        element.classList.toggle('is-hidden', Boolean(hidden));
      }
    }

    function render() {
      if (!panel) return;
      const state = getState();
      const isPresented = state === 'presented';
      const isAccepted = state === 'accepted_pending_save';
      const isError = state === 'error';
      const shouldShow = isPresented || isAccepted || isError;

      setHidden(panel, !shouldShow);
      if (title) {
        title.textContent = isAccepted
          ? text(opts, 'relationship_hints_accepted_title', DEFAULT_TEXT.acceptedTitle)
          : (isError ? text(opts, 'relationship_hints_error_title', DEFAULT_TEXT.errorTitle) : text(opts, 'relationship_hints_presented_title', DEFAULT_TEXT.presentedTitle));
      }
      if (body) {
        body.textContent = isAccepted
          ? text(opts, 'relationship_hints_accepted_body', DEFAULT_TEXT.acceptedBody)
          : (isError ? text(opts, 'relationship_hints_error_body', DEFAULT_TEXT.errorBody) : text(opts, 'relationship_hints_presented_body', DEFAULT_TEXT.presentedBody));
      }

      if (acceptButton) {
        setHidden(acceptButton, !isPresented);
        acceptButton.disabled = !isPresented;
      }
      if (dismissButton) {
        setHidden(dismissButton, !(isPresented || isAccepted));
        dismissButton.disabled = !(isPresented || isAccepted);
      }
      if (retryButton) {
        setHidden(retryButton, !isError);
        retryButton.disabled = !isError;
      }
      if (hideButton) {
        setHidden(hideButton, false);
        hideButton.disabled = !(isPresented || isAccepted || isError);
      }
    }

    function transition(event, transitionOptions) {
      if (isBlockedUIEvent(event)) {
        return createRejectedResult(currentVisualState, event, 'Relationship save/edge creation is out of scope for this UI-only slice.');
      }

      if (!stateMachine || typeof stateMachine.transition !== 'function') {
        return createRejectedResult(currentVisualState, event, 'Relationship hints state machine is unavailable.');
      }

      const result = stateMachine.transition(event, transitionOptions);
      if (result.accepted) {
        currentVisualState = result.to;
        render();
      }
      return result;
    }

    function canTransition(event, transitionOptions) {
      if (isBlockedUIEvent(event)) return false;
      if (!stateMachine || typeof stateMachine.canTransition !== 'function') return false;
      return stateMachine.canTransition(event, transitionOptions);
    }

    function isBlockedUIEvent(event) {
      return BLOCKED_UI_EVENTS.indexOf(event) !== -1;
    }

    function presentRelationshipHint(hint) {
      if (destroyed) return createRejectedResult(getState(), 'present_hint', 'Controller is destroyed.');
      const from = getState();
      const event = from === 'dismissed' ? 'present_new_hint' : 'present_hint';
      const result = canTransition(event) ? transition(event) : createRejectedResult(from, event, 'Cannot present relationship hint from current state.');

      if (result.accepted) {
        currentHint = hint || null;
        render();
        if (typeof opts.onPresent === 'function') {
          opts.onPresent(currentHint, result);
        }
      }

      return result;
    }

    function acceptRelationshipHint() {
      if (destroyed) return createRejectedResult(getState(), 'accept_for_review', 'Controller is destroyed.');
      const result = canTransition('accept_for_review') ? transition('accept_for_review') : createRejectedResult(getState(), 'accept_for_review', 'Accept is not available.');
      if (result.accepted && typeof opts.onAccept === 'function') {
        opts.onAccept(currentHint, result);
      }
      return result;
    }

    function dismissRelationshipHint() {
      if (destroyed) return createRejectedResult(getState(), 'dismiss_hint', 'Controller is destroyed.');
      const event = getState() === 'accepted_pending_save' ? 'dismiss_pending_hint' : 'dismiss_hint';
      const result = canTransition(event) ? transition(event) : createRejectedResult(getState(), event, 'Dismiss is not available.');
      if (result.accepted && typeof opts.onDismiss === 'function') {
        opts.onDismiss(currentHint, result);
      }
      return result;
    }

    function hideRelationshipHint() {
      if (destroyed) return createRejectedResult(getState(), 'hide_hint_surface', 'Controller is destroyed.');
      const state = getState();
      const event = state === 'accepted_pending_save'
        ? 'hide_pending_hint'
        : (state === 'dismissed' ? 'hide_dismissed_hint' : (state === 'error' ? 'hide_after_error' : 'hide_hint_surface'));
      const result = canTransition(event) ? transition(event) : createRejectedResult(state, event, 'Hide is not available.');
      if (result.accepted && typeof opts.onHide === 'function') {
        opts.onHide(currentHint, result);
      }
      return result;
    }

    function retryRelationshipHint() {
      if (destroyed) return createRejectedResult(getState(), 'retry_hint', 'Controller is destroyed.');
      const result = canTransition('retry_hint') ? transition('retry_hint') : createRejectedResult(getState(), 'retry_hint', 'Retry is not available.');
      if (result.accepted && typeof opts.onRetry === 'function') {
        opts.onRetry(currentHint, result);
      }
      return result;
    }

    function resetRelationshipHints() {
      if (destroyed) return createRejectedResult(getState(), 'reset_hint_lifecycle', 'Controller is destroyed.');
      const state = getState();
      const event = (state === 'dismissed' || state === 'hidden') ? 'reset_hint_lifecycle' : null;
      if (!event) return createRejectedResult(state, 'reset_hint_lifecycle', 'Reset is only available from dismissed or hidden states.');
      const result = transition(event);
      if (result.accepted && typeof opts.onReset === 'function') {
        opts.onReset(currentHint, result);
      }
      return result;
    }

    function showError(error) {
      if (destroyed) return createRejectedResult(getState(), 'hint_error', 'Controller is destroyed.');
      currentHint = error && error.hint ? error.hint : currentHint;
      const result = canTransition('hint_error') ? transition('hint_error') : createRejectedResult(getState(), 'hint_error', 'Error state is not available.');
      if (result.accepted && typeof opts.onError === 'function') {
        opts.onError(currentHint, result);
      }
      return result;
    }

    function destroy() {
      destroyed = true;
      handlers.slice().forEach(function (entry) {
        const button = entry[0];
        const handler = entry[1];
        if (button && typeof button.removeEventListener === 'function') {
          button.removeEventListener('click', handler);
        }
      });
      handlers.length = 0;
      setHidden(panel, true);
    }

    bindButton(acceptButton, acceptRelationshipHint);
    bindButton(dismissButton, dismissRelationshipHint);
    bindButton(hideButton, hideRelationshipHint);
    bindButton(retryButton, retryRelationshipHint);
    render();

    return Object.freeze({
      getState,
      getCurrentHint,
      getTransitionLog,
      presentRelationshipHint,
      acceptRelationshipHint,
      dismissRelationshipHint,
      hideRelationshipHint,
      retryRelationshipHint,
      resetRelationshipHints,
      showError,
      canTransition,
      transition,
      destroy,
      render,
      isDestroyed: function () { return destroyed; }
    });
  }

  const api = Object.freeze({
    createRelationshipHintsUIController,
    RELATIONSHIP_HINTS_UI_PANEL_ID,
    RELATIONSHIP_HINTS_UI_TITLE_ID,
    RELATIONSHIP_HINTS_UI_BODY_ID,
    RELATIONSHIP_HINTS_UI_ACCEPT_ID,
    RELATIONSHIP_HINTS_UI_DISMISS_ID,
    RELATIONSHIP_HINTS_UI_HIDE_ID,
    RELATIONSHIP_HINTS_UI_RETRY_ID
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.LoveBudRelationshipHintsUIController = api;
  }
})();
