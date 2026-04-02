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

// =========================
// Quick Export modal (sidebar Export / Share button)
// =========================

/**
 * Opens the quick export modal and populates the template row if a prompt
 * is currently selected.
 */
function openQuickExportModal() {
    const modal = document.getElementById('quick-export-modal');
    if (!modal) return;

    const templateRow = document.getElementById('qem-template-row');
    const templateNameEl = document.getElementById('qem-template-name');
    const groupNameEl = document.getElementById('qem-group-name');

    const currentPrompt = state.prompts.find(p => p.id === state.currentPromptId);
    if (currentPrompt && templateRow && templateNameEl) {
        templateRow.style.display = 'flex';
        templateNameEl.textContent = currentPrompt.name;
    } else if (templateRow) {
        templateRow.style.display = 'none';
    }
    if (groupNameEl) groupNameEl.textContent = state.currentTemplateGroup || '';

    modal.style.display = 'flex';
}
window.openQuickExportModal = openQuickExportModal;

/**
 * Attempts to share a file via the Web Share API. Falls back to a plain
 * JSON download if the API is unavailable or the user cancels.
 * @param {object|Array} data - The data to share/download.
 * @param {string} filename   - The suggested filename (e.g. "my-template.json").
 * @param {string} title      - Title passed to navigator.share.
 */
async function shareOrDownload(data, filename, title) {
    const jsonStr = JSON.stringify(data, null, 2);
    const file = new File([jsonStr], filename, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ title, files: [file] });
            return;
        } catch (e) {
            if (e.name === 'AbortError') return; // User dismissed the share sheet — do nothing
        }
    }
    // Fallback: plain download
    downloadJson(data, filename);
}

/** Wires all buttons in the quick export modal. Called once at startup. */
function setupQuickExportModal() {
    const modal = document.getElementById('quick-export-modal');
    if (!modal) return;

    const close = () => { modal.style.display = 'none'; };
    document.getElementById('qem-close')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    // This Template
    document.getElementById('qem-template-download')?.addEventListener('click', () => {
        const p = state.prompts.find(t => t.id === state.currentPromptId);
        if (!p) return;
        downloadJson(p, `${p.id}.json`);
    });
    document.getElementById('qem-template-share')?.addEventListener('click', () => {
        const p = state.prompts.find(t => t.id === state.currentPromptId);
        if (!p) return;
        shareOrDownload(p, `${p.id}.json`, p.name);
    });

    // This Group
    document.getElementById('qem-group-download')?.addEventListener('click', () => {
        const name = state.currentTemplateGroup;
        const data = { name, templates: state.environment.templateGroups[name] || [], history: state.environment.history[name] || [] };
        downloadJson(data, `${name}-group.json`);
    });
    document.getElementById('qem-group-share')?.addEventListener('click', () => {
        const name = state.currentTemplateGroup;
        const data = { name, templates: state.environment.templateGroups[name] || [], history: state.environment.history[name] || [] };
        shareOrDownload(data, `${name}-group.json`, `Group: ${name}`);
    });

    // Everything (workspace)
    document.getElementById('qem-workspace-download')?.addEventListener('click', () => {
        const data = { templateGroups: state.environment.templateGroups, history: state.environment.history, currentTemplateGroup: state.currentTemplateGroup };
        downloadJson(data, `workspace-${new Date().toISOString().slice(0, 10)}.json`);
    });
    document.getElementById('qem-workspace-share')?.addEventListener('click', () => {
        const data = { templateGroups: state.environment.templateGroups, history: state.environment.history, currentTemplateGroup: state.currentTemplateGroup };
        shareOrDownload(data, `workspace-${new Date().toISOString().slice(0, 10)}.json`, 'aiTemplateLab Workspace');
    });
}
window.setupQuickExportModal = setupQuickExportModal;

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
            alert('Invalid template file. Please make sure the file is a valid JSON template exported from aiTemplateLab.');
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
    if (!importedPrompts) { alert('Invalid template format. Expected a template object or an array of templates.'); return; }

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

/** Opens the import modal and resets it to the initial dropzone state. */
function openNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (!modal) return;
    resetUimFilePanel();
    modal.style.display = 'flex';
}
window.openNewPromptModal = openNewPromptModal;

/** Closes the import modal and resets it. */
function closeNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (!modal) return;
    modal.style.display = 'none';
    resetUimFilePanel();
}
window.closeNewPromptModal = closeNewPromptModal;

/** Resets the modal back to the empty dropzone state. */
function resetUimFilePanel() {
    const fileInput = document.getElementById('uim-file-input');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('uim-file-preview');
    if (preview) preview.style.display = 'none';
    const cancelBar = document.getElementById('uim-cancel-bar');
    if (cancelBar) cancelBar.style.display = 'flex';
    const dropzone = document.getElementById('uim-dropzone');
    if (dropzone) { dropzone.style.display = 'flex'; dropzone.classList.remove('drag-over'); }
    const errEl = document.getElementById('uim-file-error');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    window._uimPendingImport = null;
}

/**
 * Wires the import modal: dropzone drag/drop, browse button, group select, confirm/cancel.
 * Called once during app startup.
 */
function setupNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    const dropzone = document.getElementById('uim-dropzone');
    const fileInput = document.getElementById('uim-file-input');
    const pickBtn = document.getElementById('uim-pick-file-btn');

    // Browse button
    if (pickBtn && fileInput) pickBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) processImportFile(file);
        e.target.value = '';
    });

    // Drag and drop
    if (dropzone) {
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) processImportFile(file);
        });
        // Clicking anywhere on the dropzone (except the button) opens file picker
        dropzone.addEventListener('click', e => {
            if (e.target !== pickBtn && !pickBtn.contains(e.target)) fileInput.click();
        });
    }

    // Group select new-group toggle
    wireNewGroupToggle('uim-group-select', 'uim-new-group-row', 'uim-new-group-name');

    // Cancel / confirm
    document.getElementById('new-prompt-cancel')?.addEventListener('click', closeNewPromptModal);
    document.getElementById('uim-file-cancel')?.addEventListener('click', closeNewPromptModal);
    document.getElementById('uim-file-confirm')?.addEventListener('click', handleUimFileConfirm);

    // Backdrop / Escape
    if (modal) {
        modal.addEventListener('click', e => { if (e.target === modal) closeNewPromptModal(); });
        modal.addEventListener('keydown', e => { if (e.key === 'Escape') closeNewPromptModal(); });
    }
}

/**
 * Parses a File, auto-detects its type, and either shows the group
 * confirmation UI inline or delegates template imports to showImportModal.
 */
function processImportFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const errEl = document.getElementById('uim-file-error');
        const preview = document.getElementById('uim-file-preview');
        const dropzone = document.getElementById('uim-dropzone');
        const cancelBar = document.getElementById('uim-cancel-bar');

        try {
            const data = JSON.parse(e.target.result);
            const isGroup = data && typeof data === 'object' && !Array.isArray(data)
                && typeof data.name === 'string' && Array.isArray(data.templates);

            if (isGroup) {
                // Show inline group confirmation
                const count = data.templates.length;
                document.getElementById('uim-detected-msg').innerHTML =
                    `<strong>Group detected:</strong> "${escapeHtml(data.name)}" &mdash; ${count} template${count !== 1 ? 's' : ''}`;
                document.getElementById('uim-file-group-fields').style.display = 'block';
                populateImportGroupSelect('uim-group-select');
                if (state.environment.templateGroups[data.name]) {
                    const sel = document.getElementById('uim-group-select');
                    if (sel) sel.value = data.name;
                }
                window._uimPendingImport = { type: 'group', data };
                if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                if (dropzone) dropzone.style.display = 'none';
                if (cancelBar) cancelBar.style.display = 'none';
                if (preview) preview.style.display = 'block';
            } else {
                // Template(s) — delegate to existing checkbox modal
                const allTemplates = Array.isArray(data) ? data : [data];
                const existingIds = new Set(state.prompts.map(p => p.id));
                const uniqueTemplates = allTemplates.filter(t => t.id && !existingIds.has(t.id));
                if (uniqueTemplates.length === 0) {
                    if (errEl) { errEl.textContent = 'No new templates found — all IDs already exist.'; errEl.style.display = 'block'; }
                    if (dropzone) dropzone.style.display = 'none';
                    if (cancelBar) cancelBar.style.display = 'none';
                    if (preview) preview.style.display = 'block';
                    return;
                }
                closeNewPromptModal();
                showImportModal(uniqueTemplates, allTemplates);
            }
        } catch (err) {
            if (errEl) { errEl.textContent = 'Invalid file. Please make sure the file is a valid JSON template or group exported from aiTemplateLab.'; errEl.style.display = 'block'; }
            if (dropzone) dropzone.style.display = 'none';
            if (cancelBar) cancelBar.style.display = 'none';
            if (preview) preview.style.display = 'block';
        }
    };
    reader.readAsText(file);
}

/**
 * Handles file selection in the "From File" tab.
 * Auto-detects whether the file is a group or individual template(s).
 */
function handleUimFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const nameEl = document.getElementById('uim-file-name');
    if (nameEl) nameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        const errEl = document.getElementById('uim-file-error');
        const preview = document.getElementById('uim-file-preview');
        const detectedMsg = document.getElementById('uim-detected-msg');
        const groupFields = document.getElementById('uim-file-group-fields');

        try {
            const data = JSON.parse(e.target.result);
            event.target.value = '';

            // Detect type: group file has { name: string, templates: array }
            const isGroup = data && typeof data === 'object' && !Array.isArray(data)
                && typeof data.name === 'string' && Array.isArray(data.templates);

            if (isGroup) {
                // Group import — handle inline
                const groupName = data.name;
                const count = data.templates.length;
                const nameExists = !!state.environment.templateGroups[groupName];
                detectedMsg.innerHTML = `<strong>Group detected:</strong> "${escapeHtml(groupName)}" &mdash; ${count} template${count !== 1 ? 's' : ''}`;
                groupFields.style.display = 'block';
                populateImportGroupSelect('uim-group-select');
                // Pre-select the group if it exists, else set to the current group
                const sel = document.getElementById('uim-group-select');
                if (sel && nameExists) sel.value = groupName;
                window._uimPendingImport = { type: 'group', data };
                if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                preview.style.display = 'block';
            } else {
                // Template(s) — close unified modal and open the existing import-modal
                const allTemplates = Array.isArray(data) ? data : [data];
                const existingIds = new Set(state.prompts.map(p => p.id));
                const uniqueTemplates = allTemplates.filter(t => t.id && !existingIds.has(t.id));
                if (uniqueTemplates.length === 0) {
                    if (errEl) { errEl.textContent = 'No new templates found (all IDs already exist).'; errEl.style.display = 'block'; }
                    preview.style.display = 'block';
                    return;
                }
                closeNewPromptModal();
                showImportModal(uniqueTemplates, allTemplates);
            }
        } catch (err) {
            if (errEl) { errEl.textContent = 'Invalid file. Please make sure the file is a valid JSON template or group exported from aiTemplateLab.'; errEl.style.display = 'block'; }
            if (preview) preview.style.display = 'block';
        }
    };
    reader.readAsText(file);
}

/**
 * Handles the Import confirm button in the "From File" tab (group imports only —
 * template imports are handed off to showImportModal immediately on file selection).
 */
function handleUimFileConfirm() {
    const pending = window._uimPendingImport;
    if (!pending) return;
    const errEl = document.getElementById('uim-file-error');

    if (pending.type === 'group') {
        const targetGroup = resolveImportGroup('uim-group-select', 'uim-new-group-name', errEl);
        if (!targetGroup) return;

        const groupData = pending.data;
        const existingIds = new Set((state.environment.templateGroups[targetGroup] || []).map(p => p.id));
        const newTemplates = (groupData.templates || []).map(normalizePrompt).filter(p => p.id && !existingIds.has(p.id));

        if (newTemplates.length === 0) {
            errEl.textContent = 'No new templates to import — all IDs already exist in that group.';
            errEl.style.display = 'block';
            return;
        }

        state.environment.templateGroups[targetGroup] = (state.environment.templateGroups[targetGroup] || []).concat(newTemplates);
        if (groupData.history) state.environment.history[targetGroup] = groupData.history;
        if (targetGroup === state.currentTemplateGroup) {
            state.setPrompts(state.environment.templateGroups[targetGroup].map(normalizePrompt));
        }
        window.savePromptsToLocalStorage();
        if (typeof updateTemplateGroupDropdown === 'function') updateTemplateGroupDropdown();
        renderPromptsList();
        closeNewPromptModal();
        alert(`Imported ${newTemplates.length} template(s) into "${targetGroup}" successfully!`);
    }
}

// =========================
// Builder Screen — Build a New Template
// =========================

/** Looks up one of the three generator templates from preloadedPrompts by type key. */
function getBuilderTemplate(type) {
    const ids = { single: 'template-builder', group: 'group-generator', workflow: 'workflow-generator' };
    return (window.preloadedPrompts || []).find(p => p.id === ids[type]) || null;
}

/**
 * Generates the full structured prompt text for a generator template + user inputs.
 * Mirrors the output shape of generateViewPrompt() in promptOutput.js.
 */
function generateBuilderPromptText(template, inputValues) {
    const outputProperties = {};
    const requiredFields = [];
    (template.outputs || []).forEach(o => {
        outputProperties[o.name] = { type: o.type, description: o.description || undefined };
        requiredFields.push(o.name);
    });
    const promptJson = {};
    if (template.objective) promptJson.objective = template.objective;
    if (template.actor)     promptJson.actor     = template.actor;
    if (template.context)   promptJson.context   = template.context;
    if (template.example)   promptJson.example   = template.example;
    if (Object.keys(inputValues).length > 0) promptJson.input = inputValues;
    if ((template.constraints || []).length > 0) promptJson.constraints = template.constraints;
    promptJson.output_schema = { type: 'object', properties: outputProperties, required: requiredFields };
    if ((template.success || []).length > 0) promptJson.success_criteria = template.success;
    const names = Object.keys(outputProperties).join(', ');
    promptJson.output_instructions = names
        ? `Return only the output exactly as specified by the properties: ${names}. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array`
        : 'Return only the output exactly as specified. Do not include any extra prose, comments, or code fences.';
    return JSON.stringify(promptJson, null, 2);
}

/** Renders the input textareas in #builder-inputs for the given type. */
function renderBuilderInputs(type) {
    const template = getBuilderTemplate(type);
    const container = document.getElementById('builder-inputs');
    if (!container) return;
    if (!template) { container.innerHTML = ''; return; }
    container.innerHTML = template.inputs.map((inp, i) => `
        <div class="builder-input-group">
            <label class="builder-input-label" for="builder-input-${i}">
                ${escapeHtml(inp.name)}${i > 0 ? ' <span class="builder-input-optional">(optional)</span>' : ''}
            </label>
            <p class="builder-input-hint">${escapeHtml(inp.description || '')}</p>
            <textarea id="builder-input-${i}" class="builder-textarea" placeholder="${escapeHtml(inp.placeholder || '')}"></textarea>
        </div>
    `).join('');
}
window.renderBuilderInputs = renderBuilderInputs;

/** Copies text to clipboard with a fallback for browsers that don't support the async API. */
function builderCopy(text, onCopied) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onCopied).catch(() => builderCopyFallback(text, onCopied));
    } else {
        builderCopyFallback(text, onCopied);
    }
}

function builderCopyFallback(text, onCopied) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onCopied(); } catch { alert('Copy failed — please copy the text manually.'); }
    document.body.removeChild(ta);
}

/** Populates the builder group select and resets the new-group input. */
function refreshBuilderGroupSelect() {
    populateImportGroupSelect('builder-group-select');
    const sel = document.getElementById('builder-group-select');
    if (sel && state.environment.templateGroups['Template Lab']) sel.value = 'Template Lab';
    const newGroupRow = document.getElementById('builder-new-group-row');
    const newGroupInput = document.getElementById('builder-new-group-name');
    if (newGroupRow) newGroupRow.style.display = 'none';
    if (newGroupInput) newGroupInput.value = '';
}
window.refreshBuilderGroupSelect = refreshBuilderGroupSelect;

/** Wires all events on the builder screen. Called once at startup. */
function setupBuilderScreen() {
    const screen = document.getElementById('builder-screen');
    if (!screen) return;

    // Initial render
    renderBuilderInputs('single');

    // Group select — wire new-group toggle
    wireNewGroupToggle('builder-group-select', 'builder-new-group-row', 'builder-new-group-name');

    // Type tab switching
    screen.addEventListener('click', e => {
        const tab = e.target.closest('.builder-type-tab');
        if (!tab) return;
        document.querySelectorAll('.builder-type-tab').forEach(b => b.classList.remove('active'));
        tab.classList.add('active');
        renderBuilderInputs(tab.dataset.type);
        setTimeout(() => { const f = document.getElementById('builder-input-0'); if (f) f.focus(); }, 0);
    });

    // Copy button
    const copyBtn = document.getElementById('builder-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const type = document.querySelector('.builder-type-tab.active')?.dataset.type || 'single';
            const template = getBuilderTemplate(type);
            if (!template) { alert('Template data not found.'); return; }

            const inputValues = {};
            template.inputs.forEach((inp, i) => {
                const field = document.getElementById(`builder-input-${i}`);
                inputValues[inp.name] = field ? field.value : '';
            });

            builderCopy(generateBuilderPromptText(template, inputValues), () => {
                copyBtn.textContent = '\u2713 Copied!';
                copyBtn.style.background = 'var(--color-success-dark, #15803d)';
                // Reveal steps 3-5
                const lower = document.getElementById('builder-lower');
                if (lower) lower.style.display = 'block';
                // Reset button after delay, focus paste area
                setTimeout(() => {
                    copyBtn.textContent = 'Copy Prompt for AI';
                    copyBtn.style.background = '';
                }, 3000);
                setTimeout(() => {
                    const paste = document.getElementById('builder-paste');
                    if (paste) { paste.scrollIntoView({ behavior: 'smooth', block: 'center' }); paste.focus(); }
                }, 400);
            });
        });
    }

    // Import button
    const importBtn = document.getElementById('builder-import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const textarea  = document.getElementById('builder-paste');
            const errorDiv  = document.getElementById('builder-error');
            if (!textarea || !errorDiv) return;
            errorDiv.style.display = 'none';

            const raw = textarea.value.trim();
            if (!raw) { errorDiv.textContent = 'Please paste the AI\u2019s response first.'; errorDiv.style.display = 'block'; return; }

            let parsed;
            try { parsed = JSON.parse(raw); }
            catch (e) { errorDiv.textContent = 'Invalid template format. Please check the AI\'s response and try again.'; errorDiv.style.display = 'block'; return; }

            const templates  = Array.isArray(parsed) ? parsed : [parsed];
            const targetGroup = resolveImportGroup('builder-group-select', 'builder-new-group-name', errorDiv);
            if (!targetGroup) return;

            if (!state.environment.templateGroups[targetGroup]) state.environment.templateGroups[targetGroup] = [];
            const existingIds = new Set(state.environment.templateGroups[targetGroup].map(p => p.id));
            const newTemplates = templates.map(normalizePrompt).filter(p => p.id && !existingIds.has(p.id));
            if (newTemplates.length === 0) {
                errorDiv.textContent = 'No new templates to import \u2014 all IDs already exist in this group.';
                errorDiv.style.display = 'block';
                return;
            }

            state.environment.templateGroups[targetGroup] = state.environment.templateGroups[targetGroup].concat(newTemplates);
            state.setCurrentTemplateGroup(targetGroup);
            state.setPrompts(state.environment.templateGroups[targetGroup].map(normalizePrompt));
            window.savePromptsToLocalStorage();
            renderPromptsList();

            // Navigate directly to the first new template
            viewPrompt(newTemplates[0].id);
        });
    }
}
window.setupBuilderScreen = setupBuilderScreen;
