// Editor Shell Helpers - Entry-only shell utilities
// Provides fallbacks and utilities for editor initialization without affecting runtime behavior
//
// Aggregator: merges all sub-modules into window.LoveBudEditorShellHelpers

(function () {
    'use strict';

    const shellUtils = window.LoveBudEditorShellUtils || {};
    const shellBridges = window.LoveBudEditorShellBridges || {};
    const shellGuards = window.LoveBudEditorShellGuards || {};
    const shellStartup = window.LoveBudEditorShellStartup || {};
    const shellCanvasUI = window.LoveBudEditorShellCanvasUI || {};
    const shellMemory = window.LoveBudEditorShellMemory || {};
    const shellMomentList = window.LoveBudEditorShellMomentList || {};

    window.LoveBudEditorShellHelpers = {
        ...shellUtils,
        ...shellBridges,
        ...shellGuards,
        ...shellStartup,
        ...shellCanvasUI,
        ...shellMemory,
        ...shellMomentList
    };
})();
