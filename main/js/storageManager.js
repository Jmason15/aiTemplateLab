function loadPromptsFromLocalStorage() {

    try {
        const data = localStorage.getItem('prompts');
        if (data) {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                prompts = parsed;
            }
        }
    } catch (e) {
        console.warn('Failed to load prompts from localStorage:', e);
    }
}

function savePromptsToLocalStorage() {
    try {
        localStorage.setItem('prompts', JSON.stringify(prompts));
    } catch (e) {
        console.warn('Failed to save prompts to localStorage:', e);
    }
}

function resetPrompts() {
    if (confirm('This will erase all your current prompts and restore the default set. Continue?')) {
        localStorage.removeItem('prompts');
        location.reload();
    }
}

window.storageManager = { loadPromptsFromLocalStorage, savePromptsToLocalStorage, resetPrompts};