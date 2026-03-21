/**
 * @fileoverview App entry point — initializes state and wires all UI events.
 *
 * Startup sequence:
 *   1. loadTemplateGroupsFromStorage() — restore saved data (or load preloaded defaults)
 *   2. Show the home screen
 *   3. Wire every button, tab, and modal to its handler
 *
 * This file depends on every other script being already loaded.
 * It must be the last JS file in the load order.
 */

/**
 * Initializes the app state and shows the home screen.
 */
function init() {
    loadTemplateGroupsFromStorage();

    // Ensure the stored active group still exists (may have been deleted).
    if (!environment.templateGroups[currentTemplateGroup]) {
        currentTemplateGroup = Object.keys(environment.templateGroups)[0] || '';
    }
    prompts = (environment.templateGroups[currentTemplateGroup] || []).map(normalizePrompt);

    currentPromptId = null;
    showWelcome();
    syncWindowState();
    renderPromptsList();
}

/**
 * Wires the Edit Template tab button.
 * Separated from startApp so it can be called after init() without
 * being entangled with the full button-wiring pass.
 */
function setupTabListeners() {
    const editTabBtn = document.getElementById('tab-edit');
    if (editTabBtn) {
        editTabBtn.addEventListener('click', function () {
            // Open the current prompt in edit mode, or show a blank form if none is selected.
            if (currentPromptId) editPrompt(currentPromptId);
            else { clearForm(); showEdit(); }
        });
    }
}

/**
 * Full app startup: runs init(), wires all buttons and modals, then
 * delegates to the setup functions in workspaceManager.js and importExport.js.
 * Called immediately at the bottom of this file.
 */
function startApp() {
    init();
    setupTabListeners();

    // Edit form action buttons.
    const saveBtn = document.getElementById('save-prompt');
    if (saveBtn) saveBtn.addEventListener('click', savePrompt);
    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    // Main tab buttons (Use Template / Template History / Output).
    // Edit Template is handled by setupTabListeners above.
    const viewTabBtn = document.getElementById('tab-view');
    if (viewTabBtn) viewTabBtn.addEventListener('click', () => { if (currentPromptId) showView(); });
    const historyTabBtn = document.getElementById('tab-history');
    if (historyTabBtn) historyTabBtn.addEventListener('click', () => { if (currentPromptId) showHistory(); });
    const outputTabBtn = document.getElementById('tab-output');
    if (outputTabBtn) outputTabBtn.addEventListener('click', () => { if (currentPromptId) showPromptOutput(); });

    // Delete prompt — confirmation modal before destructive action.
    const deleteBtn = document.getElementById('delete-prompt');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-prompt');
    const cancelDeleteBtn = document.getElementById('cancel-delete-prompt');
    if (deleteBtn && deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
        deleteBtn.addEventListener('click', () => { deleteModal.style.display = 'flex'; });
        cancelDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
        confirmDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none';
            // tileMenuTargetId is set when delete is triggered from the sidebar ⋮ menu;
            // fall back to currentPromptId when triggered from the action bar button.
            const idToDelete = window.tileMenuTargetId || currentPromptId;
            if (idToDelete != null) deletePrompt(idToDelete);
        });
        deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });
    }

    // Copy button — saves current inputs to history, copies JSON to clipboard,
    // and shows a confirmation modal.
    const copyBtn = document.getElementById('copy-view-output');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const prompt = prompts.find(p => p.id === currentPromptId);
            if (!prompt) return;
            // Collect current input values to record in history.
            const inputs = {};
            prompt.inputs.forEach((i, idx) => {
                const field = document.getElementById(`input-value-${idx}`);
                inputs[i.name] = field ? field.value : '';
            });
            savePromptInputHistory(prompt.id, inputs);
            // Refresh the history tab if it's currently visible.
            const historyScreen = document.getElementById('history-screen');
            if (historyScreen && historyScreen.classList.contains('active')) renderHistoryList(prompt.id);
            const pre = document.getElementById('view-output-json');
            const modal = document.getElementById('copy-modal');
            if (pre) navigator.clipboard.writeText(pre.value).then(() => { if (modal) modal.style.display = 'flex'; });
        });
    }

    // Copy confirmation modal.
    const closeCopyModal = document.getElementById('close-copy-modal');
    const copyModal = document.getElementById('copy-modal');
    if (closeCopyModal) closeCopyModal.addEventListener('click', () => { if (copyModal) copyModal.style.display = 'none'; });
    if (copyModal) copyModal.addEventListener('click', e => { if (e.target === copyModal) copyModal.style.display = 'none'; });

    // Add field buttons in the edit form (inputs / constraints / outputs / success).
    const addInputBtn = document.getElementById('add-input');
    if (addInputBtn) addInputBtn.addEventListener('click', () => { if (window.addInput) window.addInput(); });
    const addConstraintBtn = document.getElementById('add-constraint');
    if (addConstraintBtn) addConstraintBtn.addEventListener('click', () => { if (window.addConstraint) window.addConstraint(); });
    const addOutputBtn = document.getElementById('add-output');
    if (addOutputBtn) addOutputBtn.addEventListener('click', () => { if (window.addOutput) window.addOutput(); });
    const addSuccessBtn = document.getElementById('add-success');
    if (addSuccessBtn) addSuccessBtn.addEventListener('click', () => { if (window.addSuccess) window.addSuccess(); });

    // Mobile sidebar toggle.
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    function openSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.add('open'); }
    function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('open'); }
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);
    // Close sidebar when a template tile is clicked on mobile.
    document.addEventListener('click', e => {
        if (window.innerWidth <= 768 && e.target.closest('.prompt-tile')) closeSidebar();
    });

    // Sidebar search — re-render list on every keystroke.
    const sidebarSearch = document.getElementById('sidebar-search');
    if (sidebarSearch) sidebarSearch.addEventListener('input', renderPromptsList);

    // Sidebar action buttons.
    const importJsonBtn = document.getElementById('import-json-btn');
    if (importJsonBtn) importJsonBtn.addEventListener('click', openNewPromptModal);
    const blankPromptBtn = document.getElementById('blank-prompt-btn');
    if (blankPromptBtn) blankPromptBtn.addEventListener('click', startBlankPrompt);

    // Hidden file input for JSON template import.
    const importFile = document.getElementById('import-file');
    if (importFile) importFile.addEventListener('change', handleImport);

    // Warning toast — show unless dismissed this session.
    const toast = document.getElementById('toast-warning');
    const toastClose = document.getElementById('toast-close');
    if (toast) {
        if (sessionStorage.getItem('toastDismissed')) {
            toast.classList.add('hidden');
        } else {
            document.body.classList.add('toast-visible');
        }
        if (toastClose) {
            toastClose.addEventListener('click', () => {
                toast.classList.add('hidden');
                document.body.classList.remove('toast-visible');
                sessionStorage.setItem('toastDismissed', '1');
            });
        }
    }

    setupNewPromptModal();
    setupTileContextMenu();
    setupWorkspaceHandlers();
    setupTemplateGroupHandlers();
    setupMenuBar();
}

startApp();
