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
    if (state.prompts.length === 0) { alert('No prompts to export'); return; }
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

    renderCheckboxGrid(grid, state.prompts, 'export-tpl');
    fileNameInput.value = `prompts-${Date.now()}.json`;
    modal.style.display = 'flex';

    document.getElementById('export-modal-download').onclick = function () {
        const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const selected = state.prompts.filter(p => checkedIds.includes(String(p.id)));
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
            const existingIds = new Set(state.prompts.map(p => p.id));
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
    const existingIds = new Set(state.prompts.map(p => p.id));
    const duplicates = (allTemplates || []).filter(t => t.id && existingIds.has(t.id));
    alreadyGrid.innerHTML = duplicates.length > 0
        ? `<strong>Already imported:</strong><ul style="margin:0.3em 0 0.7em 1.2em;">${duplicates.map(t => `<li>${window.escapeHtml(t.name)}</li>`).join('')}</ul>`
        : '';
    renderCheckboxGrid(grid, templates, 'import-tpl');
    populateImportGroupSelect('import-group-select');
    const newGroupRow = document.getElementById('import-new-group-row');
    const newGroupInput = document.getElementById('import-new-group-name');
    if (newGroupRow) newGroupRow.style.display = 'none';
    if (newGroupInput) newGroupInput.value = '';
    wireNewGroupToggle('import-group-select', 'import-new-group-row', 'import-new-group-name');
    modal.style.display = 'flex';

    document.getElementById('import-modal-confirm').onclick = function () {
        const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const selected = templates.filter(t => checkedIds.includes(String(t.id)));
        if (selected.length === 0) {
            errorDiv.textContent = 'Please select at least one template to import.';
            errorDiv.style.display = 'block';
            return;
        }
        const targetGroup = resolveImportGroup('import-group-select', 'import-new-group-name', errorDiv);
        if (!targetGroup) return;
        const groupExistingIds = new Set((state.environment.templateGroups[targetGroup] || []).map(p => p.id));
        const newTemplates = selected.filter(t => !groupExistingIds.has(t.id));
        if (newTemplates.length === 0) {
            errorDiv.textContent = 'No new templates to import (all IDs already exist in that group).';
            errorDiv.style.display = 'block';
            return;
        }
        state.environment.templateGroups[targetGroup] = (state.environment.templateGroups[targetGroup] || []).concat(newTemplates);
        if (targetGroup === state.currentTemplateGroup) {
            state.setPrompts(state.environment.templateGroups[targetGroup].map(normalizePrompt));
        }
        window.savePromptsToLocalStorage();
        renderPromptsList();
        modal.style.display = 'none';
        errorDiv.style.display = 'none';
        alert(`Imported ${newTemplates.length} template(s) into "${targetGroup}" successfully!`);
    };
    document.getElementById('import-modal-cancel').onclick = function () {
        modal.style.display = 'none';
        errorDiv.style.display = 'none';
    };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
}

/**
 * Builds the group <select> options for an import modal, defaulting to the
 * currently active group, with a "New Group..." sentinel at the bottom.
 * @param {string} selectId - ID of the <select> element to populate.
 */
function populateImportGroupSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = Object.keys(state.environment.templateGroups)
        .map(g => `<option value="${g}"${g === state.currentTemplateGroup ? ' selected' : ''}>${window.escapeHtml(g)}</option>`)
        .join('');
    select.innerHTML += `<option value="__new__">New Group...</option>`;
}

/**
 * Wires the "New Group..." toggle on a group select so the name input
 * appears/disappears when the sentinel option is chosen.
 * @param {string} selectId   - ID of the <select> element.
 * @param {string} rowId      - ID of the new-group row div to show/hide.
 * @param {string} inputId    - ID of the new-group name <input>.
 */
function wireNewGroupToggle(selectId, rowId, inputId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.addEventListener('change', () => {
        const row = document.getElementById(rowId);
        const input = document.getElementById(inputId);
        const isNew = select.value === '__new__';
        if (row) row.style.display = isNew ? 'flex' : 'none';
        if (isNew && input) setTimeout(() => input.focus(), 0);
    });
}

/**
 * Resolves the target group name from a group select, creating a new group
 * if the "__new__" sentinel is selected. Returns null and shows an error if
 * validation fails.
 * @param {string} selectId  - ID of the <select> element.
 * @param {string} inputId   - ID of the new-group name <input>.
 * @param {HTMLElement} errorDiv - Element to display error messages in.
 * @returns {string|null} The resolved group name, or null on validation failure.
 */
function resolveImportGroup(selectId, inputId, errorDiv) {
    const select = document.getElementById(selectId);
    if (!select) return state.currentTemplateGroup;

    if (select.value !== '__new__') return select.value;

    const newName = document.getElementById(inputId)?.value.trim();
    if (!newName) {
        errorDiv.textContent = 'Please enter a group name.';
        errorDiv.style.display = 'block';
        return null;
    }
    if (state.environment.templateGroups[newName]) {
        errorDiv.textContent = 'A group with that name already exists.';
        errorDiv.style.display = 'block';
        return null;
    }
    state.environment.templateGroups[newName] = [];
    state.environment.history[newName] = [];
    if (typeof updateTemplateGroupDropdown === 'function') updateTemplateGroupDropdown();
    return newName;
}

/**
 * Imports prompts from a parsed JSON value (object or array) into the group
 * selected in the JSON import modal.
 * @param {Object|Array} json - A single prompt object or array of prompt objects.
 */
function importPromptFromJson(json) {
    let importedPrompts = Array.isArray(json) ? json : (typeof json === 'object' && json !== null ? [json] : null);
    if (!importedPrompts) { alert('Invalid JSON: Must be a prompt object or array of prompt objects'); return; }

    const errorDiv = document.getElementById('json-import-error');
    const targetGroup = resolveImportGroup('json-import-group-select', 'json-import-new-group-name', errorDiv);
    if (!targetGroup) return;

    const existingIds = new Set((state.environment.templateGroups[targetGroup] || []).map(p => p.id));
    const newPrompts = importedPrompts.map(normalizePrompt).filter(p => p.id && !existingIds.has(p.id));
    if (newPrompts.length === 0) { alert('No new prompts to import (all IDs already exist)'); return; }

    state.environment.templateGroups[targetGroup] = (state.environment.templateGroups[targetGroup] || []).concat(newPrompts);
    // Refresh the working prompts array only if importing into the active group.
    if (targetGroup === state.currentTemplateGroup) {
        state.setPrompts(state.environment.templateGroups[targetGroup].map(normalizePrompt));
    }
    window.savePromptsToLocalStorage();
    renderPromptsList();
    closeNewPromptModal();
    alert(`Imported ${newPrompts.length} prompt(s) into "${targetGroup}" successfully!`);
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
    populateImportGroupSelect('json-import-group-select');
    const newGroupRow = document.getElementById('json-import-new-group-row');
    const newGroupInput = document.getElementById('json-import-new-group-name');
    if (newGroupRow) newGroupRow.style.display = 'none';
    if (newGroupInput) newGroupInput.value = '';
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

    wireNewGroupToggle('json-import-group-select', 'json-import-new-group-row', 'json-import-new-group-name');
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
