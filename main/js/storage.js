// Template group persistence — depends on state.js

function loadTemplateGroupsFromStorage() {
    const rawGroups = localStorage.getItem('templateGroups');
    const rawHistory = localStorage.getItem('templateGroupHistory');
    const rawCurrent = localStorage.getItem('currentTemplateGroup');
    if (rawGroups) {
        try {
            environment.templateGroups = JSON.parse(rawGroups);
            environment.history = rawHistory ? JSON.parse(rawHistory) : {};
            currentTemplateGroup = rawCurrent || Object.keys(environment.templateGroups)[0] || 'Default';
        } catch {
            resetToPreloaded();
        }
    } else {
        resetToPreloaded();
    }
}

function saveTemplateGroupsToStorage() {
    localStorage.setItem('templateGroups', JSON.stringify(environment.templateGroups));
    localStorage.setItem('templateGroupHistory', JSON.stringify(environment.history));
    localStorage.setItem('currentTemplateGroup', currentTemplateGroup);
}

function resetToPreloaded() {
    environment.templateGroups = {
        'Default': window.preloadedWorkspaces['Default'].templates,
        'Jira': window.preloadedWorkspaces['Jira'].templates
    };
    environment.history = {};
    currentTemplateGroup = 'Default';
}

window.savePromptsToLocalStorage = saveTemplateGroupsToStorage;
window.loadPromptsFromLocalStorage = loadTemplateGroupsFromStorage;
