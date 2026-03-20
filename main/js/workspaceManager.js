// Template group management, workspace save/load, app-bar menu — depends on state.js, storage.js, screens.js, promptCrud.js

function updateTemplateGroupDropdown() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = Object.keys(environment.templateGroups).map(name =>
        `<option value="${name}"${name === currentTemplateGroup ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.value = currentTemplateGroup;
    dropdown.disabled = false;
}

function openCreateGroupModal() {
    const modal = document.getElementById('create-template-group-modal');
    const nameInput = document.getElementById('create-template-group-name');
    const errorDiv = document.getElementById('create-template-group-error');
    if (!modal || !nameInput || !errorDiv) return;
    nameInput.value = '';
    errorDiv.style.display = 'none';
    modal.style.display = 'flex';
}

function setupTemplateGroupHandlers() {
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

    // Save Template Group
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

    // Load Template Group
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
                    alert(`Template group '${loaded.name}' imported successfully!`);
                } catch (err) { alert('Error loading template group: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }

    // Create Template Group
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

    // Delete Template Group
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
            downloadJson({ templateGroups: environment.templateGroups, history: environment.history, currentTemplateGroup }, fileName);
            document.getElementById('save-workspace-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-workspace-modal').style.display = 'none'; });

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

function setupAppBarMenu() {
    const kebabBtn = document.getElementById('app-bar-kebab');
    const menu = document.getElementById('app-bar-menu');
    if (!kebabBtn || !menu) return;

    const toggleMenu = () => { menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; };
    kebabBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    kebabBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleMenu(); });
    document.addEventListener('click', e => {
        if (menu.style.display === 'block' && !menu.contains(e.target) && e.target !== kebabBtn) menu.style.display = 'none';
    });

    const menuActions = {
        'menu-save-workspace': () => document.getElementById('save-workspace-btn').click(),
        'menu-load-workspace': () => document.getElementById('load-workspace-btn').click(),
        'menu-save-template-group': () => document.getElementById('save-template-group-btn').click(),
        'menu-load-template-group': () => document.getElementById('load-template-group-btn').click(),
        'menu-export-templates': () => window.exportPrompts(),
        'menu-import-templates': () => document.getElementById('import-file').click(),
        'menu-create-template-group': openCreateGroupModal,
        'menu-delete-template-group': () => {
            const modal = document.getElementById('delete-template-group-modal');
            const select = document.getElementById('delete-template-group-select');
            const errorDiv = document.getElementById('delete-template-group-error');
            if (!modal || !select || !errorDiv) return;
            select.innerHTML = Object.keys(environment.templateGroups).map(name => `<option value="${name}">${name}</option>`).join('');
            errorDiv.style.display = 'none';
            modal.style.display = 'flex';
        }
    };

    Object.entries(menuActions).forEach(([id, action]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => { menu.style.display = 'none'; action(); });
    });

    const menuReset = document.getElementById('menu-reset-templates');
    if (menuReset) menuReset.style.display = 'none';
}
