// Editor Shell Guards - Startup dependency guards
// Provides dependency guard factories for editor initialization
//
// Sub-module: imported by editor-shell-helpers.js (aggregator)

(function () {
    'use strict';

    window.LoveBudEditorShellGuards = {
    createEditorStartDependencyGuard: function(options) {
        var opts = options || {};
        var reportError = opts.reportError || function() {};

        return function ensureStartEditorDependency(dependency, message) {
            if (typeof dependency === 'function') return true;
            reportError(message);
            return false;
        };
    },

    createEditorStartDependencyChecker: function(options) {
        var opts = options || {};
        var ensureStartEditorDependency = opts.ensureStartEditorDependency || function() { return false; };
        var dependencies = opts.dependencies || [];

        return function checkEditorStartDependencies() {
            for (var i = 0; i < dependencies.length; i += 1) {
                var dependency = dependencies[i];
                if (!ensureStartEditorDependency(dependency.value, dependency.message)) {
                    return false;
                }
            }

            return true;
        };
    },

    createEditorStartupDependencyWaiter: function(options) {
        var opts = options || {};
        var log = opts.log || function() {};
        var reportError = opts.reportError || function() {};
        var windowRef = opts.windowRef || window;
        var wait = opts.wait || function(ms) {
            return new Promise(function(resolve) {
                setTimeout(resolve, ms);
            });
        };
        var maxAttempts = opts.maxAttempts || 100;
        var intervalMs = opts.intervalMs || 50;

        return async function waitForGlobal(name) {
            log('Waiting for ' + name + '...');
            var count = 0;

            while (typeof windowRef[name] !== 'function' && count < maxAttempts) {
                await wait(intervalMs);
                count++;
            }

            if (typeof windowRef[name] !== 'function') {
                reportError(name + ' not found after 5s');
                return false;
            }

            log(name + ' found.');
            return true;
        };
    },

    createEditorRequiredGlobalWaiter: function(options) {
        var opts = options || {};
        var waitForGlobal = opts.waitForGlobal || async function() { return false; };
        var requiredGlobals = opts.requiredGlobals || [
            'createEditorCanvas',
            'createEditorDetailUI',
            'createEditorMemoryActions',
            'createEditorMemoryForm'
        ];

        return async function waitForEditorRequiredGlobals() {
            for (var i = 0; i < requiredGlobals.length; i += 1) {
                if (!await waitForGlobal(requiredGlobals[i])) {
                    return false;
                }
            }

            return true;
        };
    },
    };
})();
