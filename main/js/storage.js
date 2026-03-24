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
 * Load order: depends on state.js (uses state singleton).
 * preloadedPrompts data (window.preloadedWorkspaces) must be available before
 * resetToPreloaded() is called — guaranteed by script load order in index.html.
 */

/**
 * Loads template groups from localStorage into the environment object.
 * Falls back to the built-in preloaded data if storage is empty or corrupted.
 */
function loadTemplateGroupsFromStorage() {
    const rawGroups = localStorage.getItem(STORAGE_KEYS.TEMPLATE_GROUPS);
    const rawHistory = localStorage.getItem(STORAGE_KEYS.TEMPLATE_GROUP_HISTORY);
    const rawCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT_TEMPLATE_GROUP);
    const rawPromptId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROMPT_ID);
    if (rawGroups) {
        try {
            state.environment.templateGroups = JSON.parse(rawGroups);
            state.environment.history = rawHistory ? JSON.parse(rawHistory) : {};
            // Use the last active group, fall back to the first available, then 'Default'.
            state.setCurrentTemplateGroup(rawCurrent || Object.keys(state.environment.templateGroups)[0] || 'Default');
            // Restore the last open prompt ID if present.
            if (rawPromptId) state.setCurrentPromptId(rawPromptId);
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
    localStorage.setItem(STORAGE_KEYS.TEMPLATE_GROUPS, JSON.stringify(state.environment.templateGroups));
    localStorage.setItem(STORAGE_KEYS.TEMPLATE_GROUP_HISTORY, JSON.stringify(state.environment.history));
    localStorage.setItem(STORAGE_KEYS.CURRENT_TEMPLATE_GROUP, state.currentTemplateGroup);
    if (state.currentPromptId != null) localStorage.setItem(STORAGE_KEYS.CURRENT_PROMPT_ID, state.currentPromptId);
}

/**
 * Resets environment to the preloaded workspace data defined in
 * main/config/workspaces.json and main/Prompts/*.json (inlined at build time).
 * Called on first run or when localStorage data is unreadable.
 */
function resetToPreloaded() {
    state.environment.templateGroups = {};
    for (const [name, workspace] of Object.entries(window.preloadedWorkspaces)) {
        state.environment.templateGroups[name] = workspace.templates;
    }
    state.environment.history = {};
    state.setCurrentTemplateGroup(window.preloadedConfig?.defaultWorkspace || 'Default');
}

// Alias to the names editPrompt.js expects on window.
window.savePromptsToLocalStorage = saveTemplateGroupsToStorage;
window.loadPromptsFromLocalStorage = loadTemplateGroupsFromStorage;
