/**
 * @fileoverview Import / export of prompt templates and the JSON import modal.
 *
 * Export: opens a modal where the user selects which prompts to download as JSON.
 * File import: reads a JSON file from disk, deduplicates against existing prompts
 *   by ID, then opens a confirmation modal before adding.
 * JSON import modal: lets the user paste a raw JSON prompt definition directly
 *   into a textarea instead of uploading a file.
 *
 * Load order: depends on state.js, promptCrud.js, and utils.js.
 */

/**
 * Entry point for the Export button. Opens the export modal if there are
 * prompts to export.
 */
window.exportPrompts = function () {
    if (prompts.length === 0) { alert('No prompts to export'); return; }
    showExportModal();
};

/**
 * Populates and shows the export modal. The user selects which prompts to
 * include via checkboxes, then clicks Download to trigger a JSON file download.
 * onclick handlers are reassigned each time the modal opens to avoid
 * stacking duplicate listeners.
 */
function showExportModal() {
    const modal = document.getElementById('export-modal');
    const grid = document.getElementById('export-template-grid');
    const fileNameInput = document.getElementById('export-file-name');
    if (!modal || !grid || !fileNameInput) return;

    renderCheckboxGrid(grid, prompts, 'export-tpl');
    fileNameInput.value = `prompts-${Date.now()}.json`;
    modal.style.display = 'flex';

    document.getElementById('export-modal-download').onclick = function () {
        const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const selected = prompts.filter(p => checkedIds.includes(String(p.id)));
        if (selected.length === 0) { alert('Please select at least one template to export.'); return; }
        let fileName = fileNameInput.value.trim() || `prompts-${Date.now()}.json`;
        if (!fileName.endsWith('.json')) fileName += '.json';
        downloadJson(selected, fileName);
        modal.style.display = 'none';
    };
    document.getElementById('export-modal-close').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
}

/** Triggers the hidden file input to open the OS file picker. */
window.importPrompts = function () {
    document.getElementById('import-file').click();
};

/**
 * Handles the file-input change event after the user selects a JSON file.
 * Parses the file, checks for duplicates, and opens the import confirmation
 * modal. Resets the file input so the same file can be re-selected later.
 * @param {Event} event - The file input change event.
 */
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const loaded = JSON.parse(e.target.result);
            // Accept either a single object or an array.
            const allTemplates = Array.isArray(loaded) ? loaded : [loaded];
            const existingIds = new Set(prompts.map(p => p.id));
            const uniqueTemplates = allTemplates.filter(t => t.id && !existingIds.has(t.id));
            if (uniqueTemplates.length === 0) {
                alert('No new templates to import (all IDs already exist or invalid).');
                return;
            }
            showImportModal(uniqueTemplates, allTemplates);
        } catch (err) {
            alert('Error parsing JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
    // Reset so selecting the same file again fires the change event.
    event.target.value = '';
}

/**
 * Populates and shows the import confirmation modal.
 * @param {Array} templates - New prompts not yet in the library (shown with checkboxes).
 * @param {Array} allTemplates - Full list from the file (used to show already-imported names).
 */
function showImportModal(templates, allTemplates) {
    const modal = document.getElementById('import-modal');
    const grid = document.getElementById('import-template-grid');
    const alreadyGrid = document.getElementById('import-already-grid');
    const errorDiv = document.getElementById('import-modal-error');
    if (!modal || !grid || !alreadyGrid || !errorDiv) return;

    errorDiv.style.display = 'none';
    const existingIds = new Set(prompts.map(p => p.id));
    const duplicates = (allTemplates || []).filter(t => t.id && existingIds.has(t.id));
    // Show which prompts from the file are already present.
    alreadyGrid.innerHTML = duplicates.length > 0
        ? `<strong>Already imported:</strong><ul style="margin:0.3em 0 0.7em 1.2em;">${duplicates.map(t => `<li>${window.escapeHtml(t.name)}</li>`).join('')}</ul>`
        : '';
    renderCheckboxGrid(grid, templates, 'import-tpl');
    modal.style.display = 'flex';

    document.getElementById('import-modal-confirm').onclick = function () {
        const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const selected = templates.filter(t => checkedIds.includes(String(t.id)));
        if (selected.length === 0) {
            errorDiv.textContent = 'Please select at least one template to import.';
            errorDiv.style.display = 'block';
            return;
        }
        const newTemplates = selected.filter(t => !existingIds.has(t.id));
        if (newTemplates.length === 0) {
            errorDiv.textContent = 'No new templates to import (all IDs already exist).';
            errorDiv.style.display = 'block';
            return;
        }
        if (environment.templateGroups[currentTemplateGroup]) {
            environment.templateGroups[currentTemplateGroup] =
                environment.templateGroups[currentTemplateGroup].concat(newTemplates);
            prompts = environment.templateGroups[currentTemplateGroup].map(normalizePrompt);
            window.savePromptsToLocalStorage();
            renderPromptsList();
            modal.style.display = 'none';
            errorDiv.style.display = 'none';
            alert(`Imported ${newTemplates.length} template(s) successfully!`);
            syncWindowState();
        }
    };
    document.getElementById('import-modal-cancel').onclick = function () {
        modal.style.display = 'none';
        errorDiv.style.display = 'none';
    };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
}

/**
 * Imports prompts from a parsed JSON value (object or array).
 * Called by the JSON import modal after the user pastes and confirms.
 * @param {Object|Array} json - A single prompt object or array of prompt objects.
 */
function importPromptFromJson(json) {
    let importedPrompts = Array.isArray(json) ? json : (typeof json === 'object' && json !== null ? [json] : null);
    if (!importedPrompts) { alert('Invalid JSON: Must be a prompt object or array of prompt objects'); return; }

    const existingIds = new Set(prompts.map(p => p.id));
    const newPrompts = importedPrompts.map(normalizePrompt).filter(p => p.id && !existingIds.has(p.id));
    if (newPrompts.length === 0) { alert('No new prompts to import (all IDs already exist)'); return; }

    if (environment.templateGroups[currentTemplateGroup]) {
        environment.templateGroups[currentTemplateGroup] =
            environment.templateGroups[currentTemplateGroup].concat(newPrompts);
        prompts = environment.templateGroups[currentTemplateGroup].map(normalizePrompt);
        window.savePromptsToLocalStorage();
        renderPromptsList();
        closeNewPromptModal();
        alert(`Imported ${newPrompts.length} prompt(s) successfully!`);
        syncWindowState();
    }
}
window.importPromptFromJson = importPromptFromJson;

// =========================
// New Prompt Modal (JSON paste import)
// =========================

/**
 * Opens the JSON import modal and focuses the textarea.
 * The small setTimeout ensures focus works after the display change.
 */
function openNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const textarea = document.getElementById('json-import-textarea');
    if (textarea) setTimeout(() => textarea.focus(), 50);
}
window.openNewPromptModal = openNewPromptModal;

/** Closes the JSON import modal and clears its textarea and error message. */
function closeNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (!modal) return;
    modal.style.display = 'none';
    const textarea = document.getElementById('json-import-textarea');
    if (textarea) textarea.value = '';
    const errorDiv = document.getElementById('json-import-error');
    if (errorDiv) errorDiv.textContent = '';
}
window.closeNewPromptModal = closeNewPromptModal;

/**
 * Wires the confirm / cancel buttons and backdrop-click / Escape behaviour
 * for the JSON import modal. Called once during app startup.
 */
function setupNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    const cancelBtn = document.getElementById('new-prompt-cancel');
    const confirmBtn = document.getElementById('json-import-confirm');

    if (cancelBtn) cancelBtn.addEventListener('click', closeNewPromptModal);
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
            const textarea = document.getElementById('json-import-textarea');
            const errorDiv = document.getElementById('json-import-error');
            if (!textarea || !errorDiv) return;
            errorDiv.style.display = 'none';
            try {
                importPromptFromJson(JSON.parse(textarea.value));
            } catch (e) {
                errorDiv.textContent = 'Invalid JSON: ' + e.message;
                errorDiv.style.display = 'block';
            }
        });
    }
    if (modal) {
        modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
        modal.addEventListener('keydown', e => { if (e.key === 'Escape') modal.style.display = 'none'; });
    }
}
