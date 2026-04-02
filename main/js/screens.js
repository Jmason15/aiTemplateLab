/**
 * @fileoverview Screen and tab switching, chrome visibility, and form clearing.
 *
 * "Chrome" refers to the info bar and tab strip that appear above the main
 * content area whenever a prompt is selected. They are hidden on the welcome
 * screen where no prompt is active.
 *
 * Load order: depends on state.js. Referenced by promptOutput.js (renderHistoryList
 * calls showView) so must load before promptOutput.js.
 */

/** All content panel IDs managed by switchToScreen. */
const SCREENS = ['view-screen', 'edit-screen', 'history-screen', 'output-screen', 'welcome-screen', 'builder-screen'];

/**
 * Shows one screen and hides all others. Also sets the `active` CSS class
 * so CSS rules can style the visible panel.
 * @param {string} activeId - The element ID of the screen to show.
 */
function switchToScreen(activeId) {
    SCREENS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = id === activeId ? 'block' : 'none';
        el.classList.toggle('active', id === activeId);
    });
    // Keep the builder nav tile active only when the builder screen is showing.
    const tile = document.getElementById('builder-nav-tile');
    if (tile) tile.classList.toggle('active', activeId === 'builder-screen');
}

/**
 * Shows or hides the info bar and tab strip above the main content area.
 * Pass false when showing the welcome screen (no prompt selected).
 * @param {boolean} visible
 */
function showChrome(visible) {
    const infoDisplay = document.getElementById('info-display');
    const tabsElem = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    const val = visible ? '' : 'none';
    if (infoDisplay) infoDisplay.style.display = val;
    if (tabsElem) tabsElem.style.display = val;
    if (tabContent) tabContent.style.display = val;
}

/**
 * Marks the tab button whose text matches tabName as active,
 * clearing the active state from all other tab buttons.
 * @param {string} tabName - Exact text content of the tab button to activate.
 */
function setTabActive(tabName) {
    document.querySelectorAll('#tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === tabName);
    });
}
window.setTabActive = setTabActive;

/**
 * Shows the new compact template view (#template-view) and hides chrome + all tab screens.
 */
function showTemplateView() {
    const tv = document.getElementById('template-view');
    if (tv) tv.style.display = 'block';
    showChrome(false);
    SCREENS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'none';
        el.classList.remove('active');
    });
    const tile = document.getElementById('builder-nav-tile');
    if (tile) tile.classList.remove('active');
}
window.showTemplateView = showTemplateView;

/** Switches to the template view (new compact single-page layout). */
function showView() {
    showTemplateView();
}
window.showView = showView;

/** Switches to the Edit Template screen — no tab bar, no info header. */
function showEdit() {
    const tv = document.getElementById('template-view');
    if (tv) tv.style.display = 'none';
    // Hide the tab strip and info header; only show the edit form.
    const infoDisplay = document.getElementById('info-display');
    const tabsElem = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    if (infoDisplay) infoDisplay.style.display = 'none';
    if (tabsElem) tabsElem.style.display = 'none';
    if (tabContent) tabContent.style.display = '';
    switchToScreen('edit-screen');
}
window.showEdit = showEdit;

/**
 * Switches to the Template History screen and re-renders the history list
 * for the currently active prompt.
 */
function showHistory() {
    setTabActive('Template History');
    switchToScreen('history-screen');
    showChrome(true);
    renderHistoryList(state.currentPromptId); // defined in promptOutput.js
}
window.showHistory = showHistory;

/** Switches to the Output — now shows template-view where output is always visible. */
function showPromptOutput() {
    showTemplateView();
}
window.showPromptOutput = showPromptOutput;

/**
 * Shows the welcome screen and hides the chrome.
 * Displayed when no prompt is selected (empty workspace or after deletion).
 */
function showWelcome() {
    const tv = document.getElementById('template-view');
    if (tv) tv.style.display = 'none';
    showChrome(false);
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        welcomeScreen.classList.add('active');
    }
}
window.showWelcome = showWelcome;

/**
 * Shows the Build a New Template screen and hides the chrome.
 * Resets the screen to its initial state each time it opens.
 */
function showBuilderScreen() {
    const tv = document.getElementById('template-view');
    if (tv) tv.style.display = 'none';
    showChrome(false);
    switchToScreen('builder-screen');
    // Reset to step 1 state — lower steps hidden, type defaulted to single.
    const lower = document.getElementById('builder-lower');
    if (lower) lower.style.display = 'none';
    document.querySelectorAll('.builder-type-tab').forEach((btn, i) => btn.classList.toggle('active', i === 0));
    if (typeof renderBuilderInputs === 'function') renderBuilderInputs('single');
    const copyBtn = document.getElementById('builder-copy-btn');
    if (copyBtn) { copyBtn.textContent = 'Copy Prompt for AI'; copyBtn.style.background = ''; copyBtn.disabled = false; }
    const pasteArea = document.getElementById('builder-paste');
    if (pasteArea) pasteArea.value = '';
    const errorDiv = document.getElementById('builder-error');
    if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
    if (typeof refreshBuilderGroupSelect === 'function') refreshBuilderGroupSelect();
}
window.showBuilderScreen = showBuilderScreen;

/**
 * Clears all edit-form fields and resets the dynamic field counters.
 * Called when opening a blank new prompt form with no existing prompt loaded.
 */
function clearForm() {
    ['prompt-name', 'prompt-desc', 'objective', 'actor', 'context'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['inputs-container', 'constraints-container', 'outputs-container', 'success-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    state.resetCounters();
}
