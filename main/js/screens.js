// Screen and tab switching — depends on state.js

const SCREENS = ['view-screen', 'edit-screen', 'history-screen', 'output-screen', 'welcome-screen'];

function switchToScreen(activeId) {
    SCREENS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = id === activeId ? 'block' : 'none';
        el.classList.toggle('active', id === activeId);
    });
}

function showChrome(visible) {
    const infoDisplay = document.getElementById('info-display');
    const tabsElem = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    const val = visible ? '' : 'none';
    if (infoDisplay) infoDisplay.style.display = val;
    if (tabsElem) tabsElem.style.display = val;
    if (tabContent) tabContent.style.display = val;
}

function setTabActive(tabName) {
    document.querySelectorAll('#tabs button').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === tabName);
    });
}
window.setTabActive = setTabActive;

function showView() {
    setTabActive('Use Template');
    switchToScreen('view-screen');
    showChrome(true);
}
window.showView = showView;

function showEdit() {
    setTabActive('Edit Template');
    switchToScreen('edit-screen');
    showChrome(true);
}
window.showEdit = showEdit;

function showHistory() {
    setTabActive('Template History');
    switchToScreen('history-screen');
    showChrome(true);
    renderHistoryList(currentPromptId);
}
window.showHistory = showHistory;

function showPromptOutput() {
    setTabActive('Output');
    switchToScreen('output-screen');
    showChrome(true);
}
window.showPromptOutput = showPromptOutput;

function showWelcome() {
    showChrome(false);
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        welcomeScreen.classList.add('active');
    }
}
window.showWelcome = showWelcome;

function clearForm() {
    ['prompt-name', 'prompt-desc', 'objective', 'actor', 'context'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['inputs-container', 'constraints-container', 'outputs-container', 'success-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    inputCounter = constraintCounter = outputCounter = successCounter = 0;
    syncWindowState();
}
