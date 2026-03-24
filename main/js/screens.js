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
const SCREENS = ['view-screen', 'edit-screen', 'history-screen', 'output-screen', 'welcome-screen'];

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

/** Switches to the Use Template (view) screen. */
function showView() {
    setTabActive('Use Template');
    switchToScreen('view-screen');
    showChrome(true);
}
window.showView = showView;

/** Switches to the Edit Template screen. */
function showEdit() {
    setTabActive('Edit Template');
    switchToScreen('edit-screen');
    showChrome(true);
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

/** Switches to the Output screen. */
function showPromptOutput() {
    setTabActive('Output');
    switchToScreen('output-screen');
    showChrome(true);
}
window.showPromptOutput = showPromptOutput;

/**
 * Shows the welcome screen and hides the chrome.
 * Displayed when no prompt is selected (empty workspace or after deletion).
 */
function showWelcome() {
    showChrome(false);
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        welcomeScreen.classList.add('active');
    }
}
window.showWelcome = showWelcome;

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
