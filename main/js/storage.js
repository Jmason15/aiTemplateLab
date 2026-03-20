/**
 * @fileoverview Persistence layer for template groups and input history.
 *
 * All user data is stored in localStorage under three keys:
 *   'templateGroups'       — the full { [groupName]: prompt[] } map
 *   'templateGroupHistory' — per-group input history
 *   'currentTemplateGroup' — name of the last active group
 *
 * window.savePromptsToLocalStorage and window.loadPromptsFromLocalStorage
 * are the names editPrompt.js calls, aliased here to the real functions.
 *
 * Load order: depends on state.js (uses environment, currentTemplateGroup).
 * preloadedPrompts data (window.preloadedWorkspaces) must be available before
 * resetToPreloaded() is called — guaranteed by script load order in index.html.
 */

/**
 * Loads template groups from localStorage into the environment object.
 * Falls back to the built-in preloaded data if storage is empty or corrupted.
 */
function loadTemplateGroupsFromStorage() {
    const rawGroups = localStorage.getItem('templateGroups');
    const rawHistory = localStorage.getItem('templateGroupHistory');
    const rawCurrent = localStorage.getItem('currentTemplateGroup');
    const rawPromptId = localStorage.getItem('currentPromptId');
    if (rawGroups) {
        try {
            environment.templateGroups = JSON.parse(rawGroups);
            environment.history = rawHistory ? JSON.parse(rawHistory) : {};
            // Use the last active group, fall back to the first available, then 'Default'.
            currentTemplateGroup = rawCurrent || Object.keys(environment.templateGroups)[0] || 'Default';
            // Restore the last open prompt ID if present.
            if (rawPromptId) currentPromptId = rawPromptId;
        } catch {
            // Corrupted data — start fresh from preloaded defaults.
            resetToPreloaded();
        }
    } else {
        // First run — no data in storage yet.
        resetToPreloaded();
    }
}

/**
 * Persists the current environment state to localStorage.
 */
function saveTemplateGroupsToStorage() {
    localStorage.setItem('templateGroups', JSON.stringify(environment.templateGroups));
    localStorage.setItem('templateGroupHistory', JSON.stringify(environment.history));
    localStorage.setItem('currentTemplateGroup', currentTemplateGroup);
    if (currentPromptId != null) localStorage.setItem('currentPromptId', currentPromptId);
}

/**
 * Resets environment to the preloaded workspace data defined in
 * main/config/workspaces.json and main/Prompts/*.json (inlined at build time).
 * Called on first run or when localStorage data is unreadable.
 */
function resetToPreloaded() {
    environment.templateGroups = {};
    for (const [name, workspace] of Object.entries(window.preloadedWorkspaces)) {
        environment.templateGroups[name] = workspace.templates;
    }
    environment.history = {};
    currentTemplateGroup = window.preloadedConfig?.defaultWorkspace || 'Default';
}

// Alias to the names editPrompt.js expects on window.
window.savePromptsToLocalStorage = saveTemplateGroupsToStorage;
window.loadPromptsFromLocalStorage = loadTemplateGroupsFromStorage;
