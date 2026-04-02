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
    if (!state.environment.templateGroups[state.currentTemplateGroup]) {
        state.setCurrentTemplateGroup(Object.keys(state.environment.templateGroups)[0] || '');
    }
    state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));

    state.setCurrentPromptId(null);
    showWelcome();
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
            if (state.currentPromptId) editPrompt(state.currentPromptId);
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
    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
    const editBackBtn = document.getElementById('edit-back-btn');
    if (editBackBtn) editBackBtn.addEventListener('click', cancelEdit);

    // ℹ hint toggles in the edit form — delegated on document.
    document.addEventListener('click', e => {
        const btn = e.target.closest('.edit-hint-btn');
        if (!btn) return;
        const hintId = btn.dataset.hint;
        const hint = hintId ? document.getElementById(hintId) : null;
        if (!hint) return;
        const isOpen = hint.classList.contains('open');
        hint.classList.toggle('open', !isOpen);
        btn.classList.toggle('active', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
    });

    // Main tab buttons (Use Template / Template History / Output).
    // Edit Template is handled by setupTabListeners above.
    const viewTabBtn = document.getElementById('tab-view');
    if (viewTabBtn) viewTabBtn.addEventListener('click', () => { if (state.currentPromptId) showView(); });
    const historyTabBtn = document.getElementById('tab-history');
    if (historyTabBtn) historyTabBtn.addEventListener('click', () => { if (state.currentPromptId) showHistory(); });
    const outputTabBtn = document.getElementById('tab-output');
    if (outputTabBtn) outputTabBtn.addEventListener('click', () => { if (state.currentPromptId) showPromptOutput(); });

    // Delete prompt — confirmation modal before destructive action.
    const deleteBtn = document.getElementById('delete-prompt');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-prompt');
    const cancelDeleteBtn = document.getElementById('cancel-delete-prompt');
    if (deleteBtn && deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
        deleteBtn.addEventListener('click', () => { deleteModal.style.display = 'flex'; });
        wireModalDismiss(deleteModal, cancelDeleteBtn);
        confirmDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none';
            // tileMenuTargetId is set when delete is triggered from the sidebar ⋮ menu;
            // fall back to currentPromptId when triggered from the action bar button.
            const idToDelete = window.tileMenuTargetId || state.currentPromptId;
            if (idToDelete != null) deletePrompt(idToDelete);
        });
    }

    // Copy button — saves current inputs to history, copies JSON to clipboard,
    // and shows a confirmation modal.
    const copyBtn = document.getElementById('copy-view-output');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const prompt = state.prompts.find(p => p.id === state.currentPromptId);
            if (!prompt) return;
            // Collect current input values to record in history.
            const inputs = {};
            prompt.inputs.forEach((i, idx) => {
                const field = document.getElementById(`input-value-${idx}`);
                inputs[i.name] = field ? field.value : '';
            });
            savePromptInputHistory(prompt.id, inputs);
            // Refresh inline history dropdown.
            if (typeof renderHistoryDropdown === 'function') renderHistoryDropdown(prompt.id);
            const pre = document.getElementById('view-output-json');
            const modal = document.getElementById('copy-modal');
            if (pre) navigator.clipboard.writeText(pre.value).then(() => { if (modal) modal.style.display = 'flex'; });
        });
    }

    // Template view: Edit button.
    const tvEditBtn = document.getElementById('tv-edit-btn');
    if (tvEditBtn) tvEditBtn.addEventListener('click', () => {
        if (state.currentPromptId) editPrompt(state.currentPromptId);
    });

    // Template view: Clear button — wipes all input textareas and regenerates output.
    const tvClearBtn = document.getElementById('tv-clear-btn');
    if (tvClearBtn) tvClearBtn.addEventListener('click', () => {
        document.querySelectorAll('[id^="input-value-"]').forEach(el => { el.value = ''; });
        if (typeof generateViewPrompt === 'function') generateViewPrompt();
    });

    // Template view: History dropdown toggle.
    const tvHistoryBtn = document.getElementById('tv-history-btn');
    const tvHistoryDropdown = document.getElementById('tv-history-dropdown');
    if (tvHistoryBtn && tvHistoryDropdown) {
        tvHistoryBtn.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = tvHistoryDropdown.style.display === 'block';
            tvHistoryDropdown.style.display = isOpen ? 'none' : 'block';
            tvHistoryBtn.classList.toggle('active', !isOpen);
        });
        document.addEventListener('click', e => {
            if (!tvHistoryBtn.contains(e.target) && !tvHistoryDropdown.contains(e.target)) {
                tvHistoryDropdown.style.display = 'none';
                tvHistoryBtn.classList.remove('active');
            }
        });
    }

    // Copy confirmation modal.
    const closeCopyModal = document.getElementById('close-copy-modal');
    const copyModal = document.getElementById('copy-modal');
    if (copyModal) wireModalDismiss(copyModal, closeCopyModal);

    // Add field buttons in the edit form (inputs / constraints / outputs / success).
    const addInputBtn = document.getElementById('add-input');
    if (addInputBtn) addInputBtn.addEventListener('click', e => { e.stopPropagation(); expandEditAccordion('acc-inputs'); if (window.addInput) window.addInput(); });
    const addConstraintBtn = document.getElementById('add-constraint');
    if (addConstraintBtn) addConstraintBtn.addEventListener('click', e => { e.stopPropagation(); expandEditAccordion('acc-constraints'); if (window.addConstraint) window.addConstraint(); });
    const addOutputBtn = document.getElementById('add-output');
    if (addOutputBtn) addOutputBtn.addEventListener('click', e => { e.stopPropagation(); expandEditAccordion('acc-outputs'); if (window.addOutput) window.addOutput(); });
    const addSuccessBtn = document.getElementById('add-success');
    if (addSuccessBtn) addSuccessBtn.addEventListener('click', e => { e.stopPropagation(); expandEditAccordion('acc-success'); if (window.addSuccess) window.addSuccess(); });

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
    const builderNavTile = document.getElementById('builder-nav-tile');
    if (builderNavTile) builderNavTile.addEventListener('click', showBuilderScreen);
    const blankPromptBtn = document.getElementById('blank-prompt-btn');
    if (blankPromptBtn) blankPromptBtn.addEventListener('click', startBlankPrompt);
    const importBtn = document.getElementById('import-btn');
    if (importBtn) importBtn.addEventListener('click', openNewPromptModal);
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', openQuickExportModal);

    // Hidden file input for JSON template import.
    const importFile = document.getElementById('import-file');
    if (importFile) importFile.addEventListener('change', handleImport);

    // Warning toast — show unless dismissed this session.
    const toast = document.getElementById('toast-warning');
    const toastClose = document.getElementById('toast-close');
    if (toast) {
        if (sessionStorage.getItem(STORAGE_KEYS.TOAST_DISMISSED)) {
            toast.classList.add('hidden');
        } else {
            document.body.classList.add('toast-visible');
        }
        if (toastClose) {
            toastClose.addEventListener('click', () => {
                toast.classList.add('hidden');
                document.body.classList.remove('toast-visible');
                sessionStorage.setItem(STORAGE_KEYS.TOAST_DISMISSED, '1');
            });
        }
    }

    setupQuickExportModal();
    setupEditAccordions();
    setupEditCounts();
    setupEditScreenListener();
    setupNewPromptModal();
    setupBuilderScreen();
    setupTileContextMenu();
    setupWorkspaceHandlers();
    setupTemplateGroupHandlers();
    setupMenuBar();
    updateStorageMeter();
}

/**
 * Wires accordion toggle behaviour on the edit screen.
 * Clicking a header expands/collapses its body; clicking the "+ Add" button
 * inside the header is handled separately (stopPropagation prevents double-toggle).
 */
function setupEditAccordions() {
    document.querySelectorAll('.edit-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const accordion = header.closest('.edit-accordion');
            if (accordion) accordion.classList.toggle('open');
        });
    });
}

/**
 * Expands the accordion whose body has the given id, if it isn't already open.
 * @param {string} bodyId - The id of the `.edit-accordion-body` element.
 */
function expandEditAccordion(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const accordion = body.closest('.edit-accordion');
    if (accordion) accordion.classList.add('open');
}
window.expandEditAccordion = expandEditAccordion;

/**
 * Keeps the count badge in each accordion header in sync with the number of
 * items in the corresponding container. Uses MutationObserver so counts update
 * whenever items are added or removed without needing explicit calls.
 */
function setupEditCounts() {
    const sections = [
        { countId: 'inputs-count',      containerId: 'inputs-container' },
        { countId: 'constraints-count', containerId: 'constraints-container' },
        { countId: 'outputs-count',     containerId: 'outputs-container' },
        { countId: 'success-count',     containerId: 'success-container' },
    ];
    sections.forEach(({ countId, containerId }) => {
        const countEl = document.getElementById(countId);
        const container = document.getElementById(containerId);
        if (!countEl || !container) return;
        const update = () => {
            const n = container.children.length;
            countEl.textContent = n > 0 ? String(n) : '';
        };
        update();
        new MutationObserver(update).observe(container, { childList: true });
    });
}

startApp();
