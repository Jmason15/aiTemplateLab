/**
 * @fileoverview Template group management, workspace save/load, and app-bar overflow menu.
 *
 * Terminology:
 *   Workspace     — the full environment: all template groups + their history,
 *                   saved/loaded as a single JSON file.
 *   Template group — a named collection of prompts (e.g. "Default", "Jira").
 *                   Users can create, rename, save, load, and delete groups.
 *
 * Load order: depends on state.js, storage.js, screens.js, and promptCrud.js.
 */

/**
 * Rebuilds the template group <select> dropdown from environment.templateGroups
 * and ensures the currently active group is selected.
 */
function updateTemplateGroupDropdown() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = Object.keys(environment.templateGroups).map(name =>
        `<option value="${name}"${name === currentTemplateGroup ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.value = currentTemplateGroup;
    dropdown.disabled = false;
}

/**
 * Opens the Create Template Group modal with a blank name field.
 * Also called from the app-bar overflow menu.
 */
function openCreateGroupModal() {
    const modal = document.getElementById('create-template-group-modal');
    const nameInput = document.getElementById('create-template-group-name');
    const errorDiv = document.getElementById('create-template-group-error');
    if (!modal || !nameInput || !errorDiv) return;
    nameInput.value = '';
    errorDiv.style.display = 'none';
    modal.style.display = 'flex';
}

/**
 * Wires all template group UI interactions:
 *   - Dropdown change (switch active group)
 *   - Save / Load / Create / Delete group modals and their confirm/cancel buttons
 * Called once during app startup.
 */
function setupTemplateGroupHandlers() {
    // Switch active group when the dropdown changes.
    const dropdown = document.getElementById('template-group-dropdown');
    if (dropdown) {
        dropdown.addEventListener('change', function () {
            currentTemplateGroup = dropdown.value;
            prompts = (environment.templateGroups[currentTemplateGroup] || []).map(normalizePrompt);
            renderPromptsList();
            const infoDisplay = document.getElementById('info-display');
            if (prompts.length > 0) {
                currentPromptId = prompts[0].id;
                viewPrompt(currentPromptId);
                if (infoDisplay) infoDisplay.style.display = '';
            } else {
                currentPromptId = null;
                showWelcome();
            }
            syncWindowState();
        });
    }

    // Save Template Group — exports one group to a JSON file.
    const saveBtn = document.getElementById('save-template-group-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const modal = document.getElementById('save-template-group-modal');
            const select = document.getElementById('save-template-group-select');
            const filenameInput = document.getElementById('save-template-group-filename');
            if (!modal || !select || !filenameInput) return;
            select.innerHTML = Object.keys(environment.templateGroups).map(name =>
                `<option value="${name}">${name}</option>`).join('');
            select.value = currentTemplateGroup;
            filenameInput.value = `${select.value}-template-group-${new Date().toISOString().slice(0, 10)}.json`;
            // Update suggested filename when the group selection changes.
            select.onchange = () => { filenameInput.value = `${select.value}-template-group-${new Date().toISOString().slice(0, 10)}.json`; };
            modal.style.display = 'flex';
        });
    }
    const saveConfirm = document.getElementById('save-template-group-confirm');
    const saveCancel = document.getElementById('save-template-group-cancel');
    if (saveConfirm) {
        saveConfirm.addEventListener('click', () => {
            const select = document.getElementById('save-template-group-select');
            const filenameInput = document.getElementById('save-template-group-filename');
            const groupName = select.value;
            let fileName = filenameInput.value.trim() || `${groupName}-template-group-${new Date().toISOString().slice(0, 10)}.json`;
            if (!fileName.endsWith('.json')) fileName += '.json';
            downloadJson({ name: groupName, templates: environment.templateGroups[groupName], history: environment.history[groupName] || [] }, fileName);
            document.getElementById('save-template-group-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-template-group-modal').style.display = 'none'; });

    // Load Template Group — imports a group file saved by the above.
    const loadBtn = document.getElementById('load-template-group-btn');
    if (loadBtn) loadBtn.addEventListener('click', () => document.getElementById('load-template-group-file').click());
    const loadFile = document.getElementById('load-template-group-file');
    if (loadFile) {
        loadFile.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const loaded = JSON.parse(e.target.result);
                    if (!loaded || !loaded.name || !Array.isArray(loaded.templates)) { alert('Invalid template group file'); return; }
                    if (environment.templateGroups[loaded.name]) { alert('Template group with this name already exists.'); return; }
                    environment.templateGroups[loaded.name] = loaded.templates;
                    environment.history[loaded.name] = loaded.history || [];
                    updateTemplateGroupDropdown();
                    renderPromptsList();
                    alert(`Template group '${loaded.name}' imported successfully!`);
                } catch (err) { alert('Error loading template group: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }

    // Create Template Group — adds a new empty group.
    const createBtn = document.getElementById('create-template-group-btn');
    if (createBtn) createBtn.addEventListener('click', openCreateGroupModal);
    const createConfirm = document.getElementById('create-template-group-confirm');
    const createCancel = document.getElementById('create-template-group-cancel');
    if (createConfirm) {
        createConfirm.addEventListener('click', () => {
            const nameInput = document.getElementById('create-template-group-name');
            const errorDiv = document.getElementById('create-template-group-error');
            const groupName = nameInput.value.trim();
            if (!groupName) { errorDiv.textContent = 'Please enter a name.'; errorDiv.style.display = 'block'; return; }
            if (environment.templateGroups[groupName]) { errorDiv.textContent = 'A group with this name already exists.'; errorDiv.style.display = 'block'; return; }
            environment.templateGroups[groupName] = [];
            environment.history[groupName] = [];
            currentTemplateGroup = groupName;
            currentPromptId = null;
            updateTemplateGroupDropdown();
            renderPromptsList();
            showWelcome();
            document.getElementById('create-template-group-modal').style.display = 'none';
            errorDiv.style.display = 'none';
            alert(`Template group '${groupName}' created successfully!`);
            syncWindowState();
        });
    }
    if (createCancel) {
        createCancel.addEventListener('click', () => {
            document.getElementById('create-template-group-modal').style.display = 'none';
            document.getElementById('create-template-group-error').style.display = 'none';
        });
    }

    // Delete Template Group — guarded: cannot delete the active group or
    // the last remaining group.
    const deleteConfirm = document.getElementById('delete-template-group-confirm');
    const deleteCancel = document.getElementById('delete-template-group-cancel');
    if (deleteConfirm) {
        deleteConfirm.addEventListener('click', () => {
            const select = document.getElementById('delete-template-group-select');
            const errorDiv = document.getElementById('delete-template-group-error');
            const groupName = select.value;
            if (Object.keys(environment.templateGroups).length <= 1) { errorDiv.textContent = 'At least one group must remain.'; errorDiv.style.display = 'block'; return; }
            if (groupName === currentTemplateGroup) { errorDiv.textContent = 'Cannot delete the currently selected group.'; errorDiv.style.display = 'block'; return; }
            delete environment.templateGroups[groupName];
            delete environment.history[groupName];
            document.getElementById('delete-template-group-modal').style.display = 'none';
            updateTemplateGroupDropdown();
            renderPromptsList();
            alert(`Template group '${groupName}' deleted.`);
        });
    }
    if (deleteCancel) {
        deleteCancel.addEventListener('click', () => {
            document.getElementById('delete-template-group-modal').style.display = 'none';
            document.getElementById('delete-template-group-error').style.display = 'none';
        });
    }
}

/**
 * Wires the workspace save and load buttons.
 * Save: downloads the full environment (all groups + history) as one JSON file.
 * Load: replaces the entire environment from a previously saved workspace file.
 *       Shows a warning modal first because this overwrites all current data.
 * Called once during app startup.
 */
function setupWorkspaceHandlers() {
    const saveBtn = document.getElementById('save-workspace-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const modal = document.getElementById('save-workspace-modal');
            const filenameInput = document.getElementById('save-workspace-filename');
            if (!modal || !filenameInput) return;
            filenameInput.value = `workspace-${new Date().toISOString().slice(0, 10)}.json`;
            modal.style.display = 'flex';
        });
    }
    const saveConfirm = document.getElementById('save-workspace-confirm');
    const saveCancel = document.getElementById('save-workspace-cancel');
    if (saveConfirm) {
        saveConfirm.addEventListener('click', () => {
            const filenameInput = document.getElementById('save-workspace-filename');
            let fileName = filenameInput.value.trim() || `workspace-${new Date().toISOString().slice(0, 10)}.json`;
            if (!fileName.endsWith('.json')) fileName += '.json';
            // Include currentTemplateGroup so the workspace reopens on the same group.
            downloadJson({ templateGroups: environment.templateGroups, history: environment.history, currentTemplateGroup }, fileName);
            document.getElementById('save-workspace-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-workspace-modal').style.display = 'none'; });

    // Load — shows a destructive-action warning before opening the file picker.
    const loadBtn = document.getElementById('load-workspace-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const modal = document.getElementById('load-workspace-warning-modal');
            if (modal) modal.style.display = 'flex';
        });
    }
    const loadContinue = document.getElementById('load-workspace-continue');
    const loadCancel = document.getElementById('load-workspace-cancel');
    if (loadContinue) {
        loadContinue.addEventListener('click', () => {
            document.getElementById('load-workspace-warning-modal').style.display = 'none';
            document.getElementById('load-workspace-file').click();
        });
    }
    if (loadCancel) loadCancel.addEventListener('click', () => { document.getElementById('load-workspace-warning-modal').style.display = 'none'; });

    const warningModal = document.getElementById('load-workspace-warning-modal');
    if (warningModal) warningModal.addEventListener('click', e => { if (e.target === warningModal) warningModal.style.display = 'none'; });

    const loadFile = document.getElementById('load-workspace-file');
    if (loadFile) {
        loadFile.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const loaded = JSON.parse(e.target.result);
                    if (!loaded || !loaded.templateGroups) { alert('Invalid workspace file: missing templateGroups'); return; }
                    environment.templateGroups = loaded.templateGroups;
                    environment.history = loaded.history || {};
                    currentTemplateGroup = loaded.currentTemplateGroup || Object.keys(environment.templateGroups)[0] || 'Default';
                    prompts = (environment.templateGroups[currentTemplateGroup] || []).map(normalizePrompt);
                    updateTemplateGroupDropdown();
                    renderPromptsList();
                    if (prompts.length > 0) { currentPromptId = prompts[0].id; viewPrompt(currentPromptId); }
                    else { currentPromptId = null; showWelcome(); }
                    alert('Workspace loaded successfully!');
                    syncWindowState();
                } catch (err) { alert('Error loading workspace: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }
}

/**
 * Wires the Windows-style menu bar (Workspace | Templates | Groups).
 * Each top-level button toggles its dropdown. Hovering over a sibling
 * while any dropdown is open switches immediately (Windows behaviour).
 * Called once during app startup.
 */
function setupMenuBar() {
    const closeAll = () => document.querySelectorAll('.menu-bar-dropdown').forEach(d => d.classList.remove('open'));

    // Toggle on click; switch on hover when any dropdown is already open.
    document.querySelectorAll('.menu-bar-item').forEach(item => {
        const btn = item.querySelector('.menu-bar-btn');
        const dropdown = item.querySelector('.menu-bar-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            closeAll();
            if (!isOpen) dropdown.classList.add('open');
        });

        item.addEventListener('mouseenter', () => {
            if (document.querySelector('.menu-bar-dropdown.open')) {
                closeAll();
                dropdown.classList.add('open');
            }
        });
    });

    // Close on any outside click.
    document.addEventListener('click', () => closeAll());

    // Workspace menu.
    document.getElementById('menu-save-workspace')?.addEventListener('click', () => { closeAll(); document.getElementById('save-workspace-btn').click(); });
    document.getElementById('menu-load-workspace')?.addEventListener('click', () => { closeAll(); document.getElementById('load-workspace-btn').click(); });
    document.getElementById('menu-clear-storage')?.addEventListener('click', () => { closeAll(); document.getElementById('clear-storage-modal').style.display = 'flex'; });

    // Templates menu.
    document.getElementById('menu-new-template')?.addEventListener('click', () => { closeAll(); startBlankPrompt(); });
    document.getElementById('menu-import-templates')?.addEventListener('click', () => { closeAll(); if (typeof openNewPromptModal === 'function') openNewPromptModal(); });
    document.getElementById('menu-export-templates')?.addEventListener('click', () => { closeAll(); if (typeof window.exportPrompts === 'function') window.exportPrompts(); });

    // Groups menu.
    document.getElementById('menu-create-template-group')?.addEventListener('click', () => { closeAll(); openCreateGroupModal(); });
    document.getElementById('menu-save-template-group')?.addEventListener('click', () => { closeAll(); document.getElementById('save-template-group-btn').click(); });
    document.getElementById('menu-load-template-group')?.addEventListener('click', () => { closeAll(); document.getElementById('load-template-group-btn').click(); });
    document.getElementById('menu-delete-template-group')?.addEventListener('click', () => {
        closeAll();
        const modal = document.getElementById('delete-template-group-modal');
        const select = document.getElementById('delete-template-group-select');
        const errorDiv = document.getElementById('delete-template-group-error');
        if (!modal || !select || !errorDiv) return;
        select.innerHTML = Object.keys(environment.templateGroups).map(name => `<option value="${window.escapeHtml(name)}">${window.escapeHtml(name)}</option>`).join('');
        errorDiv.style.display = 'none';
        modal.style.display = 'flex';
    });

    // Clear storage confirmation modal.
    const clearConfirm = document.getElementById('clear-storage-confirm');
    const clearCancel = document.getElementById('clear-storage-cancel');
    const clearModal = document.getElementById('clear-storage-modal');
    if (clearConfirm) clearConfirm.addEventListener('click', () => { localStorage.clear(); location.reload(); });
    if (clearCancel) clearCancel.addEventListener('click', () => { clearModal.style.display = 'none'; });
    if (clearModal) clearModal.addEventListener('click', e => { if (e.target === clearModal) clearModal.style.display = 'none'; });
}
