// App entry point — wires all modules together and starts the app

function init() {
    loadTemplateGroupsFromStorage();
    updateTemplateGroupDropdown();

    const defaultGroup = window.preloadedConfig?.defaultWorkspace || 'Default';
    const defaultTemplateName = window.preloadedConfig?.defaultTemplate || 'Template Builder';

    if (environment.templateGroups[defaultGroup]) {
        currentTemplateGroup = defaultGroup;
        prompts = environment.templateGroups[defaultGroup].map(normalizePrompt);
        const defaultPrompt = prompts.find(p => p.name === defaultTemplateName);
        const startId = (defaultPrompt || prompts[0])?.id;
        if (startId) {
            currentPromptId = startId;
            viewPrompt(currentPromptId);
            setTabActive('Use Template');
            showView();
        } else {
            showWelcome();
        }
    } else if (prompts.length > 0) {
        currentPromptId = prompts[0].id;
        viewPrompt(currentPromptId);
        setTabActive('Use Template');
        showView();
    } else {
        showWelcome();
    }

    syncWindowState();
    renderPromptsList();
}

function setupTabListeners() {
    const editTabBtn = document.getElementById('tab-edit');
    if (editTabBtn) {
        editTabBtn.addEventListener('click', function () {
            if (currentPromptId) editPrompt(currentPromptId);
            else { clearForm(); showEdit(); }
        });
    }
}

function startApp() {
    init();
    setupTabListeners();

    const saveBtn = document.getElementById('save-prompt');
    if (saveBtn) saveBtn.addEventListener('click', savePrompt);
    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    const viewTabBtn = document.getElementById('tab-view');
    if (viewTabBtn) viewTabBtn.addEventListener('click', () => { if (currentPromptId) showView(); });
    const historyTabBtn = document.getElementById('tab-history');
    if (historyTabBtn) historyTabBtn.addEventListener('click', () => { if (currentPromptId) showHistory(); });
    const outputTabBtn = document.getElementById('tab-output');
    if (outputTabBtn) outputTabBtn.addEventListener('click', () => { if (currentPromptId) showPromptOutput(); });

    // Delete modal
    const deleteBtn = document.getElementById('delete-prompt');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-prompt');
    const cancelDeleteBtn = document.getElementById('cancel-delete-prompt');
    if (deleteBtn && deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
        deleteBtn.addEventListener('click', () => { deleteModal.style.display = 'flex'; });
        cancelDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
        confirmDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none';
            if (currentPromptId != null) deletePrompt(currentPromptId);
        });
        deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });
    }

    // Copy button
    const copyBtn = document.getElementById('copy-view-output');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const prompt = prompts.find(p => p.id === currentPromptId);
            if (!prompt) return;
            const inputs = {};
            prompt.inputs.forEach((i, idx) => {
                const field = document.getElementById(`input-value-${idx}`);
                inputs[i.name] = field ? field.value : '';
            });
            savePromptInputHistory(prompt.id, inputs);
            const historyScreen = document.getElementById('history-screen');
            if (historyScreen && historyScreen.classList.contains('active')) renderHistoryList(prompt.id);
            const pre = document.getElementById('view-output-json');
            const modal = document.getElementById('copy-modal');
            if (pre) navigator.clipboard.writeText(pre.value).then(() => { if (modal) modal.style.display = 'flex'; });
        });
    }

    const closeCopyModal = document.getElementById('close-copy-modal');
    const copyModal = document.getElementById('copy-modal');
    if (closeCopyModal) closeCopyModal.addEventListener('click', () => { if (copyModal) copyModal.style.display = 'none'; });
    if (copyModal) copyModal.addEventListener('click', e => { if (e.target === copyModal) copyModal.style.display = 'none'; });

    // Add field buttons
    const addInputBtn = document.getElementById('add-input');
    if (addInputBtn) addInputBtn.addEventListener('click', () => { if (window.addInput) window.addInput(); });
    const addConstraintBtn = document.getElementById('add-constraint');
    if (addConstraintBtn) addConstraintBtn.addEventListener('click', () => { if (window.addConstraint) window.addConstraint(); });
    const addOutputBtn = document.getElementById('add-output');
    if (addOutputBtn) addOutputBtn.addEventListener('click', () => { if (window.addOutput) window.addOutput(); });
    const addSuccessBtn = document.getElementById('add-success');
    if (addSuccessBtn) addSuccessBtn.addEventListener('click', () => { if (window.addSuccess) window.addSuccess(); });

    // Sidebar buttons
    const importJsonBtn = document.getElementById('import-json-btn');
    if (importJsonBtn) importJsonBtn.addEventListener('click', openNewPromptModal);
    const blankPromptBtn = document.getElementById('blank-prompt-btn');
    if (blankPromptBtn) blankPromptBtn.addEventListener('click', startBlankPrompt);

    const importFile = document.getElementById('import-file');
    if (importFile) importFile.addEventListener('change', handleImport);

    setupNewPromptModal();
    setupWorkspaceHandlers();
    setupTemplateGroupHandlers();
    setupAppBarMenu();
}

startApp();
