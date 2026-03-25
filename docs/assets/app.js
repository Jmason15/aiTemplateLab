/* === constants.js === */
/**
 * @fileoverview Application-wide constants.
 *
 * Centralises all magic strings so a rename only touches one file.
 * Must be the first JS file loaded (before utils.js).
 */

/** localStorage key names used throughout the app. */
const STORAGE_KEYS = Object.freeze({
    TEMPLATE_GROUPS:         'templateGroups',
    TEMPLATE_GROUP_HISTORY:  'templateGroupHistory',
    CURRENT_TEMPLATE_GROUP:  'currentTemplateGroup',
    CURRENT_PROMPT_ID:       'currentPromptId',
    PROMPT_INPUT_HISTORY:    'promptInputHistory',
    TOAST_DISMISSED:         'toastDismissed',
});

/**
 * ID prefixes for dynamically-created edit-form fields.
 * Each field's DOM id is `${prefix}-${counter}`, e.g. "input-name-1".
 */
const FIELD_PREFIXES = Object.freeze({
    INPUT:      'input',
    CONSTRAINT: 'constraint',
    OUTPUT:     'output',
    SUCCESS:    'success',
});


/* === utils.js === */
/**
 * @fileoverview Shared utility functions available to all scripts.
 * Must be the first JS file loaded.
 */

/**
 * Escapes a string for safe insertion into HTML to prevent XSS.
 * @param {string} text - Raw user-supplied string.
 * @returns {string} HTML-escaped string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

/**
 * Serializes data as JSON and triggers a file download in the browser.
 * @param {*} data - Any JSON-serializable value.
 * @param {string} fileName - Suggested filename for the download.
 */
function downloadJson(data, fileName) {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Download failed: ' + err.message);
    }
}

/**
 * Converts a display name into a URL-friendly slug for use as a template ID.
 * e.g. "My Cool Template!" → "my-cool-template"
 * Falls back to "untitled" if the result would be empty.
 * @param {string} text - The name to slugify.
 * @returns {string} Lowercase hyphen-separated slug.
 */
function slugify(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'untitled';
}

/**
 * Wires the standard dismiss behaviour for a modal:
 *   - clicking cancelBtn hides the modal
 *   - clicking the modal backdrop (the modal element itself) hides the modal
 * @param {HTMLElement} modal - The modal overlay element.
 * @param {HTMLElement|null} cancelBtn - Optional cancel/close button inside the modal.
 */
function wireModalDismiss(modal, cancelBtn) {
    if (cancelBtn) cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
}
window.wireModalDismiss = wireModalDismiss;

/**
 * Measures the bytes used by the app's own localStorage keys and updates the
 * storage meter bar and label in the sidebar.
 *
 * localStorage stores strings as UTF-16, so each character costs 2 bytes.
 * The standard browser quota is 5 MB per origin.
 */
function updateStorageMeter() {
    const QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB
    const usedBytes = Object.values(STORAGE_KEYS).reduce((total, key) => {
        const val = localStorage.getItem(key);
        return total + (val ? val.length * 2 : 0);
    }, 0);

    const pct = Math.min((usedBytes / QUOTA_BYTES) * 100, 100);

    const bar = document.getElementById('storage-meter-bar');
    const label = document.getElementById('storage-meter-label');
    if (!bar || !label) return;

    bar.style.width = pct.toFixed(1) + '%';
    bar.classList.toggle('warn',   pct >= 60 && pct < 85);
    bar.classList.toggle('danger', pct >= 85);

    const usedKb  = (usedBytes / 1024).toFixed(1);
    const quotaMb = (QUOTA_BYTES / (1024 * 1024)).toFixed(0);
    label.textContent = `Storage: ${usedKb} KB / ${quotaMb} MB`;
}
window.updateStorageMeter = updateStorageMeter;

/**
 * Renders a list of items as labelled checkboxes (all checked by default)
 * into a container element. Used by the import and export modals.
 * @param {HTMLElement} container - The element to render into.
 * @param {Array<{id: *, name: string}>} items - Items to render.
 * @param {string} idPrefix - Prefix for checkbox element IDs to avoid collisions.
 */
function renderCheckboxGrid(container, items, idPrefix) {
    container.innerHTML = items.map(item =>
        `<div class="checkbox-row">
            <input type="checkbox" id="${idPrefix}-${item.id}" value="${item.id}" checked>
            <label for="${idPrefix}-${item.id}">${window.escapeHtml(item.name)}</label>
        </div>`
    ).join('');
}


/* === state.js === */
// @ts-check
/**
 * @fileoverview Application state manager.
 *
 * All mutable state is encapsulated in StateManager. Access and mutate state
 * only through the module-level `state` singleton — never via direct variable
 * assignment. Each named setter automatically syncs window.* mirrors so that
 * editPrompt.js (which reads from window.*) always sees current values.
 *
 * Load order: must be first after utils.js.
 */

/**
 * @typedef {{ name: string, description?: string, placeholder?: string }} PromptInput
 * @typedef {{ name: string, type: string, description?: string }} PromptOutput
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description?: string,
 *   objective?: string,
 *   actor?: string,
 *   context?: string,
 *   example?: string,
 *   inputs: PromptInput[],
 *   constraints: string[],
 *   outputs: PromptOutput[],
 *   success: string[]
 * }} Prompt
 * @typedef {{ templateGroups: Record<string, Prompt[]>, history: Record<string, any[]> }} Environment
 */

class StateManager {
    /** Active prompt list for the current template group. */
    #prompts = [];

    /** ID of the prompt currently open in the view/edit tabs. null = none selected. */
    #currentPromptId = null;

    /** Name of the template group currently shown in the sidebar. */
    #currentTemplateGroup = 'Default';

    /**
     * Counters track the highest DOM element ID issued for each dynamic field
     * type in the edit form. They only increment — never reset between edits —
     * so IDs remain unique even after items are deleted and re-added.
     */
    #inputCounter = 0;
    #constraintCounter = 0;
    #outputCounter = 0;
    #successCounter = 0;

    /**
     * Top-level data container.
     * templateGroups: { [groupName]: prompt[] }
     * history:        { [groupName]: inputHistory[] }
     */
    #environment = { templateGroups: {}, history: {} };

    constructor() {
        // Initialise window.* mirrors with the default values.
        this.#syncWindow();
    }

    // ---- Getters ----

    get prompts() { return this.#prompts; }
    get currentPromptId() { return this.#currentPromptId; }
    get currentTemplateGroup() { return this.#currentTemplateGroup; }
    get inputCounter() { return this.#inputCounter; }
    get constraintCounter() { return this.#constraintCounter; }
    get outputCounter() { return this.#outputCounter; }
    get successCounter() { return this.#successCounter; }

    /**
     * Returns the environment object by reference. Mutate its nested properties
     * directly (e.g. state.environment.templateGroups[x] = y) — the reference
     * never changes, so existing code that holds it stays in sync.
     */
    get environment() { return this.#environment; }

    // ---- Named setters (each syncs window.* after mutation) ----

    setPrompts(value) {
        this.#prompts = value;
        this.#syncWindow();
    }

    setCurrentPromptId(id) {
        this.#currentPromptId = id;
        this.#syncWindow();
    }

    setCurrentTemplateGroup(name) {
        this.#currentTemplateGroup = name;
        this.#syncWindow();
    }

    /** Resets all four edit-form field counters to zero in a single call. */
    resetCounters() {
        this.#inputCounter = 0;
        this.#constraintCounter = 0;
        this.#outputCounter = 0;
        this.#successCounter = 0;
        this.#syncWindow();
    }

    /** Increments the input counter and returns the new value. */
    nextInputCounter() {
        this.#inputCounter++;
        this.#syncWindow();
        return this.#inputCounter;
    }

    /** Increments the constraint counter and returns the new value. */
    nextConstraintCounter() {
        this.#constraintCounter++;
        this.#syncWindow();
        return this.#constraintCounter;
    }

    /** Increments the output counter and returns the new value. */
    nextOutputCounter() {
        this.#outputCounter++;
        this.#syncWindow();
        return this.#outputCounter;
    }

    /** Increments the success counter and returns the new value. */
    nextSuccessCounter() {
        this.#successCounter++;
        this.#syncWindow();
        return this.#successCounter;
    }

    // ---- Window sync ----

    /** Keeps window.* mirrors in sync so editPrompt.js window.* reads stay current. */
    #syncWindow() {
        window.prompts = this.#prompts;
        window.currentPromptId = this.#currentPromptId;
        window.inputCounter = this.#inputCounter;
        window.constraintCounter = this.#constraintCounter;
        window.outputCounter = this.#outputCounter;
        window.successCounter = this.#successCounter;
    }
}

/** Singleton — the single source of truth for all app state. */
const state = new StateManager();
window.state = state;

/**
 * Ensures a prompt's constraints and success arrays contain only strings.
 * Older saved data and some imported prompts may have stored these fields
 * as objects (e.g. { rule: '...' } or { criterion: '...' }) — this
 * flattens them to plain strings so the rest of the app can treat them
 * uniformly.
 * @param {Prompt} prompt - A prompt object (mutated in place).
 * @returns {Prompt} The same prompt object, normalised.
 */
function normalizePrompt(prompt) {
    if (Array.isArray(prompt.constraints)) {
        prompt.constraints = prompt.constraints.map(c => typeof c === 'string' ? c : (c.rule || ''));
    } else {
        prompt.constraints = [];
    }
    if (Array.isArray(prompt.success)) {
        prompt.success = prompt.success.map(s => typeof s === 'string' ? s : (s.criterion || ''));
    } else {
        prompt.success = [];
    }
    return prompt;
}


/* === storage.js === */
/**
 * @fileoverview Persistence layer for template groups and input history.
 *
 * All user data is stored in localStorage under three keys:
 *   'templateGroups'       — the full { [groupName]: prompt[] } map
 *   'templateGroupHistory' — per-group input history
 *   'currentTemplateGroup' — name of the last active group
 *
 * window.savePromptsToLocalStorage and window.loadPromptsFromLocalStorage
 * are the names editPrompt.js calls, aliased here to the real functions.
 *
 * Load order: depends on state.js (uses state singleton).
 * preloadedPrompts data (window.preloadedWorkspaces) must be available before
 * resetToPreloaded() is called — guaranteed by script load order in index.html.
 */

/**
 * Loads template groups from localStorage into the environment object.
 * Falls back to the built-in preloaded data if storage is empty or corrupted.
 */
function loadTemplateGroupsFromStorage() {
    const rawGroups = localStorage.getItem(STORAGE_KEYS.TEMPLATE_GROUPS);
    const rawHistory = localStorage.getItem(STORAGE_KEYS.TEMPLATE_GROUP_HISTORY);
    const rawCurrent = localStorage.getItem(STORAGE_KEYS.CURRENT_TEMPLATE_GROUP);
    const rawPromptId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROMPT_ID);
    if (rawGroups) {
        try {
            state.environment.templateGroups = JSON.parse(rawGroups);
            state.environment.history = rawHistory ? JSON.parse(rawHistory) : {};
            // Use the last active group, fall back to the first available, then 'Default'.
            state.setCurrentTemplateGroup(rawCurrent || Object.keys(state.environment.templateGroups)[0] || 'Default');
            // Restore the last open prompt ID if present.
            if (rawPromptId) state.setCurrentPromptId(rawPromptId);
        } catch {
            // Corrupted data — start fresh from preloaded defaults.
            resetToPreloaded();
        }
    } else {
        // First run — no data in storage yet.
        resetToPreloaded();
    }
}

/**
 * Persists the current environment state to localStorage.
 */
function saveTemplateGroupsToStorage() {
    localStorage.setItem(STORAGE_KEYS.TEMPLATE_GROUPS, JSON.stringify(state.environment.templateGroups));
    localStorage.setItem(STORAGE_KEYS.TEMPLATE_GROUP_HISTORY, JSON.stringify(state.environment.history));
    localStorage.setItem(STORAGE_KEYS.CURRENT_TEMPLATE_GROUP, state.currentTemplateGroup);
    if (state.currentPromptId != null) localStorage.setItem(STORAGE_KEYS.CURRENT_PROMPT_ID, state.currentPromptId);
    updateStorageMeter();
}

/**
 * Resets environment to the preloaded workspace data defined in
 * main/config/workspaces.json and main/Prompts/*.json (inlined at build time).
 * Called on first run or when localStorage data is unreadable.
 */
function resetToPreloaded() {
    state.environment.templateGroups = {};
    for (const [name, workspace] of Object.entries(window.preloadedWorkspaces)) {
        state.environment.templateGroups[name] = workspace.templates;
    }
    state.environment.history = {};
    state.setCurrentTemplateGroup(window.preloadedConfig?.defaultWorkspace || 'Default');
}

// Alias to the names editPrompt.js expects on window.
window.savePromptsToLocalStorage = saveTemplateGroupsToStorage;
window.loadPromptsFromLocalStorage = loadTemplateGroupsFromStorage;


/* === screens.js === */
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


/* === editPrompt.js === */
/**
 * @fileoverview Edit form — dynamic field management and auto-save.
 *
 * This file manages the edit screen UI: populating it when a prompt is opened
 * for editing, adding/removing dynamic field cards (inputs, outputs, constraints,
 * success criteria), and auto-saving changes to localStorage as the user types.
 *
 * Auto-save flow:
 *   User types → delegated input listener debounces → saveCurrentPrompt() →
 *   savePromptsToLocalStorage() + renderPromptsList() + regenerateOutput()
 *
 * Event listeners: a single delegated listener on #edit-screen (set up once by
 * setupEditScreenListener in app.js) handles all input/textarea events — no
 * per-field listeners are needed or attached.
 *
 * Load order: depends on state.js and screens.js.
 */

/** Inline SVG used for all delete buttons to avoid repeating markup. */
const DELETE_BTN_SVG = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>`;

// =========================
// Edit Form Population
// =========================

/**
 * Populates the edit form with a prompt's current values and switches to the
 * edit screen. Clears all dynamic field containers and counters first so
 * stale fields from a previous edit session are not left behind.
 * @param {string} id - The ID of the prompt to edit.
 */
function editPrompt(id) {
    const prompt = state.prompts.find(p => p.id === id);
    if (!prompt) {
        console.error('Prompt not found for editing:', id);
        return;
    }

    state.setCurrentPromptId(id);

    // Clear all dynamic field containers before repopulating.
    document.getElementById('inputs-container').innerHTML = '';
    document.getElementById('constraints-container').innerHTML = '';
    document.getElementById('outputs-container').innerHTML = '';
    document.getElementById('success-container').innerHTML = '';

    // Reset counters so new field IDs start from 1.
    state.resetCounters();

    // Populate static fields.
    document.getElementById('prompt-name').value = prompt.name;
    document.getElementById('prompt-desc').value = prompt.description;
    document.getElementById('objective').value = prompt.objective;
    document.getElementById('actor').value = prompt.actor;
    document.getElementById('context').value = prompt.context;

    // Populate static example field.
    const exampleEl = document.getElementById('prompt-example');
    if (exampleEl) exampleEl.value = prompt.example || '';

    // Populate dynamic field cards.
    prompt.inputs.forEach(i => addInput(i.name, i.description, i.placeholder || ''));
    prompt.constraints.forEach(c => addConstraint(c));
    // Preloaded prompts use `example`; saved prompts use `description` — accept both.
    prompt.outputs.forEach(o => addOutput(o.name, o.type, o.description || o.example || ''));
    prompt.success.forEach(s => addSuccess(s));

    window.showEdit();
    window.setTabActive('Edit Template');
}
window.editPrompt = editPrompt;

// =========================
// Dynamic Field Management
// =========================

/**
 * Appends a new input field card (name + description) to the inputs container.
 * Each card gets a unique numeric suffix ID and is made draggable for reordering.
 * @param {string} [name=''] - Pre-fill value for the field name input.
 * @param {string} [description=''] - Pre-fill value for the description textarea.
 * @param {string} [placeholder=''] - Pre-fill value for the placeholder input.
 */
window.addInput = function (name = '', description = '', placeholder = '') {
    const id = state.nextInputCounter();
    const container = document.getElementById('inputs-container');
    const div = document.createElement('div');
    div.className = 'edit-card input-item';
    div.id = `input-item-${id}`;
    div.draggable = true;

    const content = document.createElement('div');
    content.className = 'edit-card-content';

    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', `input-name-${id}`);
    nameLabel.textContent = 'Field Name';
    nameLabel.className = 'edit-card-label';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `input-name-${id}`;
    nameInput.placeholder = 'Input name';
    nameInput.value = name;
    nameInput.setAttribute('aria-label', 'Input name');
    content.appendChild(nameLabel);
    content.appendChild(nameInput);

    const descLabel = document.createElement('label');
    descLabel.setAttribute('for', `input-desc-${id}`);
    descLabel.textContent = 'Description';
    descLabel.className = 'edit-card-label';
    const descInput = document.createElement('textarea');
    descInput.id = `input-desc-${id}`;
    descInput.placeholder = 'Explain what to put in this field (shown as hint text)';
    descInput.value = description;
    descInput.setAttribute('aria-label', 'Input description');
    descInput.className = 'large-textarea';
    content.appendChild(descLabel);
    content.appendChild(descInput);

    const placeholderLabel = document.createElement('label');
    placeholderLabel.setAttribute('for', `input-placeholder-${id}`);
    placeholderLabel.textContent = 'Placeholder Example';
    placeholderLabel.className = 'edit-card-label';
    const placeholderInput = document.createElement('input');
    placeholderInput.type = 'text';
    placeholderInput.id = `input-placeholder-${id}`;
    placeholderInput.placeholder = 'e.g., "The meeting discussed Q3 targets and new hires..."';
    placeholderInput.value = placeholder;
    placeholderInput.setAttribute('aria-label', 'Placeholder example');
    content.appendChild(placeholderLabel);
    content.appendChild(placeholderInput);

    div.appendChild(content);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete input');
    removeBtn.innerHTML = DELETE_BTN_SVG;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    window.makeInputsSortable();
};

/**
 * Shared builder for single-textarea field cards (constraints and success criteria
 * have identical DOM structure, differing only in labels and IDs).
 * @param {Object} opts
 * @param {Function} opts.nextId      - Calls the appropriate state counter increment,
 *                                      returns the new ID.
 * @param {string} opts.containerId   - ID of the container element.
 * @param {string} opts.itemClass     - CSS class added to the card div.
 * @param {string} opts.itemPrefix    - Prefix used for element IDs (e.g. 'constraint').
 * @param {string} opts.placeholder   - Textarea placeholder text.
 * @param {string} opts.deleteLabel   - Accessible label for the delete button.
 * @param {string} opts.value         - Pre-fill value for the textarea.
 */
function addTextareaField({ nextId, containerId, itemClass, itemPrefix, placeholder, deleteLabel, value }) {
    const id = nextId();
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = `edit-card ${itemClass}`;
    div.id = `${itemPrefix}-item-${id}`;

    const textarea = document.createElement('textarea');
    textarea.id = `${itemPrefix}-text-${id}`;
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.setAttribute('aria-label', placeholder);
    textarea.className = 'constraint-textarea';
    div.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', deleteLabel);
    removeBtn.innerHTML = DELETE_BTN_SVG;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
}

/** Appends a new constraint card. @param {string} [text=''] Pre-fill value. */
window.addConstraint = function (text = '') {
    addTextareaField({
        nextId: () => state.nextConstraintCounter(),
        containerId: 'constraints-container',
        itemClass: 'constraint-item',
        itemPrefix: 'constraint',
        placeholder: 'Constraint',
        deleteLabel: 'Delete constraint',
        value: text,
    });
};

/** Appends a new success criterion card. @param {string} [text=''] Pre-fill value. */
window.addSuccess = function (text = '') {
    addTextareaField({
        nextId: () => state.nextSuccessCounter(),
        containerId: 'success-container',
        itemClass: 'success-item',
        itemPrefix: 'success',
        placeholder: 'Success criterion',
        deleteLabel: 'Delete success criterion',
        value: text,
    });
};

/**
 * Appends a new output field card (name + type + description) to the outputs container.
 * @param {string} [name='']        - Property name.
 * @param {string} [type='string']  - Data type (e.g. 'string', 'markdown', 'JSON').
 * @param {string} [description=''] - Example or description text.
 */
window.addOutput = function (name = '', type = 'string', description = '') {
    const id = state.nextOutputCounter();
    const container = document.getElementById('outputs-container');
    const div = document.createElement('div');
    div.className = 'edit-card output-item';
    div.id = `output-item-${id}`;
    div.draggable = true;

    const content = document.createElement('div');
    content.className = 'edit-card-content';

    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', `output-name-${id}`);
    nameLabel.textContent = 'Property Name';
    nameLabel.className = 'edit-card-label';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `output-name-${id}`;
    nameInput.placeholder = 'Output name';
    nameInput.value = name;
    nameInput.setAttribute('aria-label', 'Output name');
    content.appendChild(nameLabel);
    content.appendChild(nameInput);

    const typeLabel = document.createElement('label');
    typeLabel.setAttribute('for', `output-type-${id}`);
    typeLabel.textContent = 'Type';
    typeLabel.className = 'edit-card-label';
    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.id = `output-type-${id}`;
    typeInput.placeholder = 'Type (e.g. string)';
    typeInput.value = type;
    typeInput.setAttribute('aria-label', 'Output type');
    content.appendChild(typeLabel);
    content.appendChild(typeInput);

    const descLabel = document.createElement('label');
    descLabel.setAttribute('for', `output-desc-${id}`);
    descLabel.textContent = 'Example / Description';
    descLabel.className = 'edit-card-label';
    const descInput = document.createElement('textarea');
    descInput.id = `output-desc-${id}`;
    descInput.placeholder = 'Description (optional)';
    descInput.value = description;
    descInput.setAttribute('aria-label', 'Output description');
    descInput.className = 'large-textarea';
    content.appendChild(descLabel);
    content.appendChild(descInput);

    div.appendChild(content);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete output');
    removeBtn.innerHTML = DELETE_BTN_SVG;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    window.makeOutputsSortable();
};

// =========================
// Auto-save
// =========================

/**
 * Returns a debounced version of fn that delays execution until delay ms
 * have passed since the last call. Prevents saveCurrentPrompt from firing
 * on every keypress.
 * @param {Function} fn
 * @param {number} delay - Milliseconds.
 * @returns {Function}
 */
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

const debouncedSaveCurrentPrompt = debounce(saveCurrentPrompt, 200);

/**
 * Attaches a single delegated input listener to #edit-screen so that any
 * input or textarea change triggers the debounced auto-save — regardless of
 * when the element was added to the DOM.
 *
 * Called once during app startup (app.js startApp). No per-field wiring needed.
 */
function setupEditScreenListener() {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen) return;
    editScreen.addEventListener('input', e => {
        if (e.target.matches('input, textarea')) debouncedSaveCurrentPrompt();
    });
}
window.setupEditScreenListener = setupEditScreenListener;

let saveIndicatorTimeout;

/**
 * Briefly shows the "All changes saved" indicator, then fades it out.
 * The indicator element is created on demand and reused on subsequent calls.
 */
function showSaveIndicator() {
    let indicator = document.getElementById('save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.className = 'save-indicator';
        document.body.appendChild(indicator);
    }
    indicator.textContent = 'All changes saved';
    indicator.style.opacity = '1';
    clearTimeout(saveIndicatorTimeout);
    saveIndicatorTimeout = setTimeout(() => { indicator.style.opacity = '0'; }, 1200);
}

/**
 * Reads the current edit form state and writes it directly onto the prompt
 * object in state.prompts, then persists to localStorage.
 *
 * Uses state.inputCounter (and other counters) to iterate field IDs rather
 * than querySelectorAll, because fields may have been deleted and their
 * elements removed from the DOM — the counter tells us the highest ID ever
 * issued, and we skip any that are missing.
 */
function saveCurrentPrompt() {
    if (state.currentPromptId == null || !state.prompts) return;
    const idx = state.prompts.findIndex(p => p.id === state.currentPromptId);
    if (idx === -1) return;

    const prompt = state.prompts[idx];
    prompt.name        = document.getElementById('prompt-name')?.value || '';
    prompt.description = document.getElementById('prompt-desc')?.value || '';
    prompt.objective   = document.getElementById('objective')?.value || '';
    prompt.actor       = document.getElementById('actor')?.value || '';
    prompt.context     = document.getElementById('context')?.value || '';

    prompt.example = document.getElementById('prompt-example')?.value || '';
    prompt.inputs = [];
    for (let i = 1; i <= state.inputCounter; i++) {
        const name = document.getElementById(`input-name-${i}`);
        const desc = document.getElementById(`input-desc-${i}`);
        const ph = document.getElementById(`input-placeholder-${i}`);
        if (name && name.value.trim()) {
            prompt.inputs.push({ name: name.value, description: desc ? desc.value : '', placeholder: ph ? ph.value : '' });
        }
    }
    prompt.constraints = [];
    for (let i = 1; i <= state.constraintCounter; i++) {
        const text = document.getElementById(`constraint-text-${i}`);
        if (text && text.value.trim()) prompt.constraints.push(text.value);
    }
    prompt.outputs = [];
    for (let i = 1; i <= state.outputCounter; i++) {
        const name = document.getElementById(`output-name-${i}`);
        const type = document.getElementById(`output-type-${i}`);
        const desc = document.getElementById(`output-desc-${i}`);
        if (name && name.value.trim()) {
            prompt.outputs.push({ name: name.value, type: type ? type.value : '', description: desc ? desc.value : '' });
        }
    }
    prompt.success = [];
    for (let i = 1; i <= state.successCounter; i++) {
        const text = document.getElementById(`success-text-${i}`);
        if (text && text.value.trim()) prompt.success.push(text.value);
    }

    if (typeof window.savePromptsToLocalStorage === 'function') window.savePromptsToLocalStorage();
    if (typeof window.renderPromptsList === 'function') window.renderPromptsList();
    if (typeof regenerateOutput === 'function') regenerateOutput();
    showSaveIndicator();
}


/* === preloadedPrompts.js === */
// AUTO-GENERATED by build.js — edit files in main/Prompts/ and main/config/workspaces.json instead.

window.preloadedPrompts = [
    {
        "id": "template-builder",
        "name": "Template Builder",
        "description": "Describe what you want an AI prompt to do and it builds a complete, ready-to-use template for you — just paste the result back here to import it.",
        "objective": "Take a single freeform description of what the user wants a prompt to do and guide them to a complete, well-structured JSON spec with all the standard fields used in this system.",
        "actor": "You are a Prompt Specification Assistant that turns a rough idea for a prompt into a structured JSON definition with clear fields.",
        "context": "The user provides a single block of text describing the kind of prompt they want to build (e.g., 'a prompt that creates Jira stories' or 'a prompt that summarizes legal contracts').\n\nFrom that one input, you must:\n- Infer the likely purpose, target user, and usage scenario.\n- Ask a few targeted clarification questions only if truly necessary.\n- Propose concrete values for each JSON field: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.\n\nThe example field must contain a short, plain-English walkthrough showing a realistic sample input and what the AI would return. Write it so a non-technical user immediately understands what the template does and what they will get back.\n\nCRITICAL FIELD STRUCTURES — these must never be plain strings:\n\ninputs must be an array of objects with exactly these three fields:\n  { \"name\": \"Field Label\", \"description\": \"What the user should provide here.\", \"placeholder\": \"A short realistic example value.\" }\n\noutputs must be an array of objects with exactly these three fields:\n  { \"name\": \"Output Name\", \"type\": \"string\", \"description\": \"What the AI returns.\" }\n\nconstraints must be an array of plain strings — each string is one rule.\nSuccess must be an array of plain strings — each string is one criterion.\n\nYour goal is to help the user think through and finalize these fields, not just invent them arbitrarily.",
        "example": "Example idea:\n\"I want a prompt that takes a customer support email and writes a professional, empathetic reply that acknowledges the issue, offers a solution, and ends with a positive closing.\"\n\nWhat you get back:\nA ready-made template called \"Customer Support Email Reply\" — complete with all fields filled in and ready to use.\n\nHow to use this template:\n1. Fill in the input field below with your prompt idea.\n2. Click \"Create Prompt\" — the prompt is automatically copied to your clipboard.\n3. Go to your favorite AI tool and paste the prompt.\n4. Copy the response your AI gives back.\n5. Back in aiTemplateLab, click \"Import Template From AI\" in the sidebar.\n6. Paste the response and click Import — your new template appears instantly in the sidebar.",
        "inputs": [
            {
                "name": "Prompt Idea",
                "description": "Describe in plain language what you want the prompt to do and who would use it. Don't worry about structure — just explain the idea.",
                "placeholder": "e.g., \"A prompt that takes a customer support email and writes a professional, empathetic reply.\""
            }
        ],
        "constraints": [
            "Use clear, concise language for every field.",
            "If something is ambiguous, you may ask up to 3 short clarification questions before drafting the fields.",
            "Limit the number of inputs, constraints, outputs, and success items to what is genuinely useful; avoid filler.",
            "Return exactly one top-level JSON object that directly contains the fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.",
            "The example field must be a plain-English string (not JSON) showing a realistic sample input and what the AI returns. Write it so any user immediately understands the template's value.",
            "inputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"description\": \"...\", \"placeholder\": \"...\" }. Never use a plain string as an input item.",
            "outputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"type\": \"...\", \"description\": \"...\" }. Never use a plain string as an output item.",
            "constraints MUST be an array of plain strings. success MUST be an array of plain strings. Never use objects for these fields.",
            "Respond with only a Markdown code block using ```json ... ``` containing that object, with no other text before or after."
        ],
        "outputs": [
            {
                "name": "Field Suggestions",
                "type": "JSON",
                "example": "{\n  \"id\": \"\",\n  \"name\": \"\",\n  \"description\": \"\",\n  \"objective\": \"\",\n  \"actor\": \"\",\n  \"context\": \"\",\n  \"example\": \"Input — [Field Name]: '[sample value]'\\n\\nWhat you get back: [plain English description of the output]\",\n  \"inputs\": [\n    {\n      \"name\": \"\",\n      \"description\": \"\",\n      \"placeholder\": \"\"\n    }\n  ],\n  \"constraints\": [\n  ],\n  \"outputs\": [\n    {\n      \"name\": \"\",\n      \"type\": \"\",\n      \"description\": \"\"\n    }\n  ],\n  \"success\": [\n  ]\n}"
            }
        ],
        "success": [
            "The assistant returns exactly one valid JSON object with the fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success, and no additional wrapper properties.",
            "The user can copy the whole JSON output and paste it into the prompt editor to create a new prompt with all fields populated.",
            "All suggested content reflects the user's described prompt idea and is specific, not generic."
        ]
    },
    {
        "id": "group-generator",
        "name": "Template Group Generator",
        "description": "Tell the AI your job title or area of work and it builds a complete set of ready-to-use templates covering every task you'd regularly need AI help with — all importable in one click.",
        "objective": "Take a role or domain description and produce a comprehensive set of structured prompt templates covering all the AI-assisted tasks someone in that role would regularly need.",
        "actor": "You are an AI workflow strategist who specialises in identifying the full set of AI use cases for a given role or domain, then designing a complete library of structured prompt templates to support them.",
        "context": "The user will describe a role (e.g. 'TikTok creator', 'real estate agent', 'startup founder') or a domain (e.g. 'email marketing', 'software onboarding'). Your job is to:\n\n1. Identify every recurring task or tool that role uses where AI assistance would add value.\n2. Design one complete prompt template per task.\n3. Return all templates as a single JSON array.\n\nEach template must follow this exact schema:\n{\n  \"id\": \"readable-slug\",\n  \"name\": \"Template Name\",\n  \"description\": \"One sentence describing what this prompt does.\",\n  \"objective\": \"What this prompt accomplishes.\",\n  \"actor\": \"The AI persona or role.\",\n  \"context\": \"Background the AI needs to do its job well.\",\n  \"example\": \"A short plain-English walkthrough showing a realistic sample input and what the AI returns. Write it so any user immediately understands the template's value without technical knowledge.\",\n  \"inputs\": [ { \"name\": \"Field Label\", \"description\": \"What the user should provide here.\", \"placeholder\": \"A short realistic example value.\" } ],\n  \"constraints\": [ \"A plain string rule the AI must follow.\" ],\n  \"outputs\": [ { \"name\": \"Output Name\", \"type\": \"string\", \"description\": \"What the AI returns.\" } ],\n  \"success\": [ \"A plain string criterion for a good response.\" ]\n}\n\nCRITICAL: inputs and outputs must ALWAYS be arrays of objects as shown above — never arrays of plain strings. constraints and success must ALWAYS be arrays of plain strings — never arrays of objects.\n\nGenerate enough templates to cover the role comprehensively — typically 6 to 12. Do not generate filler; every template should solve a real, recurring problem for that role.",
        "example": "Example role: \"Real estate agent\"\n\nWhat you get back:\nA set of 8 ready-made templates covering everything a real estate agent does with AI — things like:\n• Write a property listing description\n• Draft a follow-up email after a showing\n• Summarise buyer feedback from notes\n• Prepare talking points for a listing presentation\n• Write a social media post for a new listing\n\nHow to use this template:\n1. Fill in the input fields below with your role or domain.\n2. Click \"Create Prompt\" — the prompt is automatically copied to your clipboard.\n3. Go to your favorite AI tool and paste the prompt.\n4. Copy the response your AI gives back.\n5. Back in aiTemplateLab, click \"Import Template From AI\" in the sidebar.\n6. Paste the response and click Import — all your new templates appear in the sidebar at once, ready to use.",
        "inputs": [
            {
                "name": "Role or Domain",
                "description": "The role, job title, or domain to generate templates for. Be as specific or broad as you like.",
                "placeholder": "e.g., TikTok creator, B2B sales rep, Shopify store owner, real estate agent"
            },
            {
                "name": "Additional Context",
                "description": "Optional. Any extra detail about the audience, niche, tools, or goals that would help the AI tailor the templates.",
                "placeholder": "e.g., focused on short-form video, sells handmade jewellery, works with enterprise clients"
            }
        ],
        "constraints": [
            "Return only a valid JSON array of template objects with no text before or after the array.",
            "Each template must include all fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.",
            "The example field in each template must be a plain-English string showing a realistic sample input and what the AI returns — written so any non-technical user immediately understands the template's value.",
            "inputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"description\": \"...\", \"placeholder\": \"...\" }. Never use a plain string as an input item.",
            "outputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"type\": \"...\", \"description\": \"...\" }. Never use a plain string as an output item.",
            "constraints MUST be an array of plain strings. success MUST be an array of plain strings. Never use objects for these fields.",
            "Each input object must include a placeholder field containing a short, realistic example value for that field.",
            "IDs must be lowercase hyphen-separated slugs (e.g. 'caption-writer', 'hashtag-research').",
            "Every template must solve a distinct, real task for the given role — no duplicates or filler.",
            "Generate between 6 and 12 templates unless the role clearly warrants more or fewer.",
            "Do not wrap the array in any parent object — the top-level response must be a bare JSON array.",
            "All string values must be valid JSON strings: no literal newlines inside strings (use \\n instead), no unescaped double quotes (use \\\" instead), no trailing commas after the last item in any array or object.",
            "The entire response must pass JSON.parse() without errors. When in doubt, keep string values short and simple rather than risk a syntax error."
        ],
        "outputs": [
            {
                "name": "Template Group",
                "type": "JSON",
                "description": "A JSON array of complete template objects ready to paste into the Import JSON modal."
            }
        ],
        "success": [
            "The response is a valid JSON array that can be pasted directly into the Import JSON modal without modification.",
            "Every template covers a distinct, high-value task for the described role.",
            "Templates are specific and actionable — not generic rewrites of the same idea.",
            "A person in the described role would recognise every template as something they actually need."
        ]
    },
    {
        "id": "workflow-generator",
        "name": "Workflow Generator",
        "description": "Describe a goal and the AI breaks it into a step-by-step set of templates — one for each stage of the process. Run each step in your AI tool and carry the result into the next, all the way to the finish line.",
        "objective": "Take a goal or multi-stage process and produce an ordered sequence of prompt templates, one per step, where the output of each step becomes the input to the next.",
        "actor": "You are an AI process designer who breaks complex goals into clear, sequential AI-assisted steps and designs a structured prompt template for each one.",
        "context": "The user will describe a goal or process (e.g. 'produce a TikTok video from idea to posted', 'write and publish a blog post', 'onboard a new client'). Your job is to:\n\n1. Break the goal into a logical sequence of steps where AI can assist at each stage.\n2. Design one complete prompt template per step.\n3. Each step after the first must include an input field that accepts the output from the previous step.\n4. Return all templates as a single JSON array in workflow order.\n\nEach template must follow this exact schema:\n{\n  \"id\": \"step-N-readable-slug\",\n  \"name\": \"Step N: Step Name\",\n  \"description\": \"One sentence describing what this step does.\",\n  \"objective\": \"What this step accomplishes.\",\n  \"actor\": \"The AI persona or role for this step.\",\n  \"context\": \"Background the AI needs. Mention that this is step N of the workflow and what the previous step produced, if applicable.\",\n  \"example\": \"A short plain-English walkthrough showing a realistic sample input for this step and what the AI returns. Write it so any user immediately understands what this step does without technical knowledge.\",\n  \"inputs\": [ { \"name\": \"Field Label\", \"description\": \"What the user should provide here.\", \"placeholder\": \"A short realistic example value.\" } ],\n  \"constraints\": [ \"A plain string rule the AI must follow.\" ],\n  \"outputs\": [ { \"name\": \"Output Name\", \"type\": \"string\", \"description\": \"What the AI returns and how it feeds into the next step.\" } ],\n  \"success\": [ \"A plain string criterion for a good response.\" ]\n}\n\nCRITICAL: inputs and outputs must ALWAYS be arrays of objects as shown above — never arrays of plain strings. constraints and success must ALWAYS be arrays of plain strings — never arrays of objects.\n\nDesign steps that are genuinely distinct — each step should transform or build on what came before. Avoid steps that could be collapsed into one.",
        "example": "Example goal: \"Write and publish a blog post\"\n\nWhat you get back:\nA set of step-by-step templates that take you from blank page to published post:\n• Step 1: Blog Idea Generator — brainstorm topics for your audience\n• Step 2: Outline Writer — turn your chosen idea into a structured outline\n• Step 3: Draft Writer — write the full post from the outline\n• Step 4: Editor — tighten, improve, and polish the draft\n• Step 5: SEO Title and Meta Writer — write a click-worthy title and meta description\n\nEach step feeds into the next — you run one at a time and carry the output forward.\n\nHow to use this template:\n1. Fill in the input fields below with your workflow goal.\n2. Click \"Create Prompt\" — the prompt is automatically copied to your clipboard.\n3. Go to your favorite AI tool and paste the prompt.\n4. Copy the response your AI gives back.\n5. Back in aiTemplateLab, click \"Import Template From AI\" in the sidebar.\n6. Paste the response and click Import — all steps appear in the sidebar, ready to run in order.",
        "inputs": [
            {
                "name": "Workflow Goal",
                "description": "The end-to-end process or goal to design a workflow for.",
                "placeholder": "e.g., produce and post a TikTok video, write a blog post from idea to published, respond to a sales lead and close the deal"
            },
            {
                "name": "Additional Context",
                "description": "Optional. Any constraints, tools, audience, or style preferences that should shape the workflow.",
                "placeholder": "e.g., videos are under 60 seconds, audience is small business owners, we use HubSpot"
            }
        ],
        "constraints": [
            "Return only a valid JSON array of template objects in workflow order, with no text before or after the array.",
            "Each template must include all fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.",
            "The example field in each template must be a plain-English string showing a realistic sample input for that step and what the AI returns — written so any non-technical user immediately understands what the step does.",
            "inputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"description\": \"...\", \"placeholder\": \"...\" }. Never use a plain string as an input item.",
            "outputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"type\": \"...\", \"description\": \"...\" }. Never use a plain string as an output item.",
            "constraints MUST be an array of plain strings. success MUST be an array of plain strings. Never use objects for these fields.",
            "Each input object must include a placeholder field containing a short, realistic example value for that field.",
            "IDs must follow the pattern 'step-N-readable-slug' (e.g. 'step-1-idea-generator', 'step-2-script-writer').",
            "Names must follow the pattern 'Step N: Step Name' (e.g. 'Step 1: Idea Generator').",
            "Every step after step 1 must have an input field explicitly labelled to receive the previous step's output (e.g. 'Script Draft from Step 1').",
            "Each step must be genuinely distinct — do not split work that belongs in one step or combine work that should be separate.",
            "The output description of each step should note what it produces and how it is used in the next step.",
            "Do not wrap the array in any parent object — the top-level response must be a bare JSON array.",
            "All string values must be valid JSON strings: no literal newlines inside strings (use \\n instead), no unescaped double quotes (use \\\" instead), no trailing commas after the last item in any array or object.",
            "The entire response must pass JSON.parse() without errors. When in doubt, keep string values short and simple rather than risk a syntax error."
        ],
        "outputs": [
            {
                "name": "Workflow Templates",
                "type": "JSON",
                "description": "A JSON array of complete template objects in step order, ready to paste into the Import JSON modal."
            }
        ],
        "success": [
            "The response is a valid JSON array that can be pasted directly into the Import JSON modal without modification.",
            "Steps are in logical order and each builds meaningfully on the previous one.",
            "Every step after the first explicitly accepts the previous step's output as an input.",
            "Running the steps in sequence would take a user from the starting point to the stated goal with no gaps.",
            "A person doing this workflow would find every step genuinely useful and non-redundant."
        ]
    },
    {
        "id": "jira-story-generator",
        "name": "Jira Story and Acceptance Criteria Generator",
        "description": "Transforms unstructured Jira ticket text into a clear Markdown-formatted user story and separate Gherkin-style acceptance criteria block for better readability and team alignment.",
        "objective": "Convert raw Jira ticket details or copied descriptions into a standardized user story template (“As a... I want... so that...”) with accompanying acceptance criteria formatted in Gherkin syntax.",
        "actor": "You are an AI assistant that analyzes Jira ticket text and produces a structured, Markdown-formatted output combining a user story and acceptance criteria.",
        "context": "Product managers, scrum masters, or developers often copy messy Jira descriptions into prompts. The assistant parses key information to produce a clean, developer-friendly story format to speed up backlog grooming and sprint planning.",
        "example": "Input — Jira Text:\n\"Users are getting logged out randomly. Seems to happen after about 30 min. Session token might be expiring too early. Need to fix it. Also the logout message is confusing.\"\n\nOutput — User Story:\nAs a logged-in user, I want my session to remain active as long as I am using the app, so that I am not unexpectedly logged out during normal use.\n\nAcceptance Criteria:\nGiven I am logged in and actively using the app\nWhen 30 minutes pass without a session refresh\nThen my session should be renewed automatically\n\nGiven my session has expired\nWhen I am redirected to login\nThen I see a clear message explaining why I was logged out",
        "inputs": [
            {
                "name": "Jira Text",
                "description": "Paste the raw text from your Jira ticket — title, description, notes, anything you have. It does not need to be clean or formatted.",
                "placeholder": "e.g., \"Users are getting logged out randomly after ~30 min. Session token might be expiring too early. Also the logout message is confusing.\""
            }
        ],
        "constraints": [
            "Always output two clearly labeled Markdown blocks:\n\nUser Story block in “As a..., I want..., so that...” format.\n\nAcceptance Criteria block in Gherkin (Given/When/Then) syntax.",
            "Keep language clear and concise.",
            "Preserve meaning and context from the Jira text without adding assumptions."
        ],
        "outputs": [
            {
                "name": "User Story",
                "type": "markdown",
                "example": "```Markdown format"
            },
            {
                "name": "Acceptance Criteria",
                "type": "markdown",
                "example": "```Markdown Gherkin format."
            },
            {
                "name": "Estimated Storypoints",
                "type": "String",
                "example": "1 – Tiny, very clear, low uncertainty.\n\n2 – Small, still clear, maybe 1–2 edge cases.\n\n3 – Small/medium, some unknowns but manageable.\n\n5 – Medium, visible complexity or dependencies, uncertainty noticeable.\n\n8 – Large, many moving parts or risks; consider splitting.\n\n13 – Very large, high uncertainty; typically should be split.\n\n1 (Tiny): Very clear, low uncertainty.\n\n2 (Small): Clear, maybe 1–2 edge cases.\n\n3 (Small/Medium): Some unknowns but manageable.\n\n5 (Medium): Visible complexity or dependencies; uncertainty noticeable.\n\n8 (Large): Many moving parts or risks; consider splitting.\n\n13 (Very Large): High uncertainty; typically should be split.\n\n21 (Too Big/Very Risky): Strong signal to slice the story."
            },
            {
                "name": "Story point description",
                "type": "string",
                "example": "When explaining estimated story points:\n\nProvide a brief, clear justification for the estimate.\n\nRefer to scope, complexity, uncertainty, and dependencies as the key factors influencing the estimate.\n\nKeep sentences short and action-oriented (1–2 sentences per idea).\n\nIf the estimate is high, identify specific reasons (e.g., unclear acceptance criteria, external dependencies, unknown integrations).\n\nThen, suggest concrete ways to reduce the estimate, such as:\n\nSplitting the story into smaller deliverables\n\nClarifying requirements or assumptions\n\nRemoving unnecessary scope\n\nResolving dependencies early\n\nDo not restate the full scale. Instead, focus on why the story fits that level and how it could move to a smaller category.\nKeep tone professional, objective, and concise — aim for clarity, not detail overload.\n\nQuestions should be in a list most important first."
            }
        ],
        "success": [
            "The user story accurately reflects the intent of the Jira input.",
            "Acceptance criteria are testable, unambiguous, and aligned with the story.",
            "Output is cleanly formatted and ready to paste into Jira or documentation.",
            "Questions needed to reduce uncertainty are asked in the story point description",
            "Estimated story points should be exceptionally larger based on uncertainty or complexity."
        ]
    },
    {
        "id": "improve-function-implementation",
        "name": "Improve Function Implementation with Risk Analysis",
        "description": "A prompt that takes a single self-contained function plus high-level module context, then refactors the function for readability or performance (as specified) while preserving its public behavior and producing a structured risk analysis of potential issues such as null-pointer bugs, correctness problems, and security risks",
        "objective": "Enable a senior-level code assistant to improve an existing function implementation in a specified language, balancing readability and performance according to the caller’s priority, while also returning a concise explanation of key changes and a structured list of potential issues with concrete remediation suggestions\n",
        "actor": "You are a senior software engineer who refactors code, applies idiomatic style for the given language, and performs a focused risk review that identifies likely defects and edge cases without changing the function’s external contract unless explicitly allowed.",
        "context": "The caller supplies the implementation of a single function along with metadata about the surrounding module, the priority between performance and readability, and any constraints such as backward compatibility or dependency limits. Your task is to produce an improved version of that function, explain the main changes and trade-offs, and enumerate potential issues (e.g., null-pointer risks, performance hotspots, correctness concerns) with clear locations and suggested fixes.",
        "example": "Input — Function Source (JavaScript, readability priority):\nfunction calc(a,b,op){if(op=='add'){return a+b}else if(op=='sub'){return a-b}else if(op=='mul'){return a*b}else{return a/b}}\n\nOutput — Improved Function:\nfunction calculate(a, b, operation) {\n  const operations = {\n    add: () => a + b,\n    subtract: () => a - b,\n    multiply: () => a * b,\n    divide: () => a / b,\n  };\n  return operations[operation]?.() ?? null;\n}\n\nExplanation: Replaced if/else chain with a lookup map for clarity. Added null return for unknown operations.\n\nPotential Issues: No divide-by-zero guard — if b is 0 and operation is 'divide', returns Infinity.",
        "inputs": [
            {
                "name": "function_source: The full source code of a single, self-contained function that you will improve and analyze.",
                "description": "Paste the complete function you want improved. Include the full function body — not just a snippet.",
                "placeholder": "e.g., function calcTotal(items) { let t = 0; for (var i=0; i<items.length; i++) { t = t + items[i].price; } return t; }"
            },
            {
                "name": "context.performance_or_readability_priority: Enum value of performance, readability, or both that tells you whether to favor speed, clarity, or a balanced compromise when refactoring.",
                "description": "Enter: performance, readability, or both.",
                "placeholder": "e.g., readability"
            }
        ],
        "constraints": [
            "Keep the public signature and externally observable behavior of the function unchanged unless context.constraints explicitly allows modifications to the contract.",
            "Prefer clear, idiomatic code for the specified language, following common conventions for naming, formatting, and control flow.",
            "Apply the performance_or_readability_priority: if performance, focus on algorithmic and allocation improvements; if readability, emphasize structure, naming, and simplicity; if both, seek a reasonable balance.",
            "Do not introduce new external dependencies or libraries unless context.constraints explicitly permits them.",
            "Use comments sparingly to explain non-obvious logic and important assumptions, avoiding over-commenting straightforward code.",
            "Favor small, single-responsibility helpers and use private/subordinate functions when they improve clarity, while keeping the public function signature unchanged.",
            "Explicitly look for and call out potential null-pointer and other high-impact issues, describing when they occur and their impact.",
            "Keep the explanation of changes concise (around 200 words or less) and focused on the most important improvements and trade-offs."
        ],
        "outputs": [
            {
                "name": "improved_function_source",
                "type": "string",
                "example": "The revised implementation of the function in the same language, preserving the original public behavior under normal inputs while improving readability and/or performance according to the specified priority"
            },
            {
                "name": "explanation:",
                "type": "string",
                "example": "A brief narrative that highlights the key structural, readability, and/or performance changes, including any notable trade-offs made to honor constraints."
            },
            {
                "name": "potential_issues:",
                "type": "string",
                "example": "A list of Issue objects, each describing a detected risk in the original code (or remaining risk in the improved version) with type, description, location, and a concrete suggestion that respects the project constraints."
            }
        ],
        "success": [
            "improved_function_source parses/compiles in the specified language and preserves the original function’s public behavior and backward compatibility under normal inputs.",
            "The resulting code follows idiomatic style for the language and is easier for other engineers to read and maintain, especially when readability is prioritized.",
            "For performance-focused or balanced requests, the explanation clearly calls out the main performance improvements such as reduced allocations, simpler algorithms, or fewer redundant operations.",
            "potential_issues includes likely null-pointer risks and other high-impact concerns, each with clear triggers, impact, and realistic remediation suggestions aligned with context.constraints.",
            "Any refactoring into helpers improves clarity without altering the function’s public contract or breaking existing callers, and obvious edge cases are handled defensively without introducing new undefined behaviors."
        ]
    }
];

window.preloadedWorkspaces = {
    "Template Lab": {
        "templates": [
            {
                "id": "template-builder",
                "name": "Template Builder",
                "description": "Describe what you want an AI prompt to do and it builds a complete, ready-to-use template for you — just paste the result back here to import it.",
                "objective": "Take a single freeform description of what the user wants a prompt to do and guide them to a complete, well-structured JSON spec with all the standard fields used in this system.",
                "actor": "You are a Prompt Specification Assistant that turns a rough idea for a prompt into a structured JSON definition with clear fields.",
                "context": "The user provides a single block of text describing the kind of prompt they want to build (e.g., 'a prompt that creates Jira stories' or 'a prompt that summarizes legal contracts').\n\nFrom that one input, you must:\n- Infer the likely purpose, target user, and usage scenario.\n- Ask a few targeted clarification questions only if truly necessary.\n- Propose concrete values for each JSON field: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.\n\nThe example field must contain a short, plain-English walkthrough showing a realistic sample input and what the AI would return. Write it so a non-technical user immediately understands what the template does and what they will get back.\n\nCRITICAL FIELD STRUCTURES — these must never be plain strings:\n\ninputs must be an array of objects with exactly these three fields:\n  { \"name\": \"Field Label\", \"description\": \"What the user should provide here.\", \"placeholder\": \"A short realistic example value.\" }\n\noutputs must be an array of objects with exactly these three fields:\n  { \"name\": \"Output Name\", \"type\": \"string\", \"description\": \"What the AI returns.\" }\n\nconstraints must be an array of plain strings — each string is one rule.\nSuccess must be an array of plain strings — each string is one criterion.\n\nYour goal is to help the user think through and finalize these fields, not just invent them arbitrarily.",
                "example": "Example idea:\n\"I want a prompt that takes a customer support email and writes a professional, empathetic reply that acknowledges the issue, offers a solution, and ends with a positive closing.\"\n\nWhat you get back:\nA ready-made template called \"Customer Support Email Reply\" — complete with all fields filled in and ready to use.\n\nHow to use this template:\n1. Fill in the input field below with your prompt idea.\n2. Click \"Create Prompt\" — the prompt is automatically copied to your clipboard.\n3. Go to your favorite AI tool and paste the prompt.\n4. Copy the response your AI gives back.\n5. Back in aiTemplateLab, click \"Import Template From AI\" in the sidebar.\n6. Paste the response and click Import — your new template appears instantly in the sidebar.",
                "inputs": [
                    {
                        "name": "Prompt Idea",
                        "description": "Describe in plain language what you want the prompt to do and who would use it. Don't worry about structure — just explain the idea.",
                        "placeholder": "e.g., \"A prompt that takes a customer support email and writes a professional, empathetic reply.\""
                    }
                ],
                "constraints": [
                    "Use clear, concise language for every field.",
                    "If something is ambiguous, you may ask up to 3 short clarification questions before drafting the fields.",
                    "Limit the number of inputs, constraints, outputs, and success items to what is genuinely useful; avoid filler.",
                    "Return exactly one top-level JSON object that directly contains the fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.",
                    "The example field must be a plain-English string (not JSON) showing a realistic sample input and what the AI returns. Write it so any user immediately understands the template's value.",
                    "inputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"description\": \"...\", \"placeholder\": \"...\" }. Never use a plain string as an input item.",
                    "outputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"type\": \"...\", \"description\": \"...\" }. Never use a plain string as an output item.",
                    "constraints MUST be an array of plain strings. success MUST be an array of plain strings. Never use objects for these fields.",
                    "Respond with only a Markdown code block using ```json ... ``` containing that object, with no other text before or after."
                ],
                "outputs": [
                    {
                        "name": "Field Suggestions",
                        "type": "JSON",
                        "example": "{\n  \"id\": \"\",\n  \"name\": \"\",\n  \"description\": \"\",\n  \"objective\": \"\",\n  \"actor\": \"\",\n  \"context\": \"\",\n  \"example\": \"Input — [Field Name]: '[sample value]'\\n\\nWhat you get back: [plain English description of the output]\",\n  \"inputs\": [\n    {\n      \"name\": \"\",\n      \"description\": \"\",\n      \"placeholder\": \"\"\n    }\n  ],\n  \"constraints\": [\n  ],\n  \"outputs\": [\n    {\n      \"name\": \"\",\n      \"type\": \"\",\n      \"description\": \"\"\n    }\n  ],\n  \"success\": [\n  ]\n}"
                    }
                ],
                "success": [
                    "The assistant returns exactly one valid JSON object with the fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success, and no additional wrapper properties.",
                    "The user can copy the whole JSON output and paste it into the prompt editor to create a new prompt with all fields populated.",
                    "All suggested content reflects the user's described prompt idea and is specific, not generic."
                ]
            },
            {
                "id": "group-generator",
                "name": "Template Group Generator",
                "description": "Tell the AI your job title or area of work and it builds a complete set of ready-to-use templates covering every task you'd regularly need AI help with — all importable in one click.",
                "objective": "Take a role or domain description and produce a comprehensive set of structured prompt templates covering all the AI-assisted tasks someone in that role would regularly need.",
                "actor": "You are an AI workflow strategist who specialises in identifying the full set of AI use cases for a given role or domain, then designing a complete library of structured prompt templates to support them.",
                "context": "The user will describe a role (e.g. 'TikTok creator', 'real estate agent', 'startup founder') or a domain (e.g. 'email marketing', 'software onboarding'). Your job is to:\n\n1. Identify every recurring task or tool that role uses where AI assistance would add value.\n2. Design one complete prompt template per task.\n3. Return all templates as a single JSON array.\n\nEach template must follow this exact schema:\n{\n  \"id\": \"readable-slug\",\n  \"name\": \"Template Name\",\n  \"description\": \"One sentence describing what this prompt does.\",\n  \"objective\": \"What this prompt accomplishes.\",\n  \"actor\": \"The AI persona or role.\",\n  \"context\": \"Background the AI needs to do its job well.\",\n  \"example\": \"A short plain-English walkthrough showing a realistic sample input and what the AI returns. Write it so any user immediately understands the template's value without technical knowledge.\",\n  \"inputs\": [ { \"name\": \"Field Label\", \"description\": \"What the user should provide here.\", \"placeholder\": \"A short realistic example value.\" } ],\n  \"constraints\": [ \"A plain string rule the AI must follow.\" ],\n  \"outputs\": [ { \"name\": \"Output Name\", \"type\": \"string\", \"description\": \"What the AI returns.\" } ],\n  \"success\": [ \"A plain string criterion for a good response.\" ]\n}\n\nCRITICAL: inputs and outputs must ALWAYS be arrays of objects as shown above — never arrays of plain strings. constraints and success must ALWAYS be arrays of plain strings — never arrays of objects.\n\nGenerate enough templates to cover the role comprehensively — typically 6 to 12. Do not generate filler; every template should solve a real, recurring problem for that role.",
                "example": "Example role: \"Real estate agent\"\n\nWhat you get back:\nA set of 8 ready-made templates covering everything a real estate agent does with AI — things like:\n• Write a property listing description\n• Draft a follow-up email after a showing\n• Summarise buyer feedback from notes\n• Prepare talking points for a listing presentation\n• Write a social media post for a new listing\n\nHow to use this template:\n1. Fill in the input fields below with your role or domain.\n2. Click \"Create Prompt\" — the prompt is automatically copied to your clipboard.\n3. Go to your favorite AI tool and paste the prompt.\n4. Copy the response your AI gives back.\n5. Back in aiTemplateLab, click \"Import Template From AI\" in the sidebar.\n6. Paste the response and click Import — all your new templates appear in the sidebar at once, ready to use.",
                "inputs": [
                    {
                        "name": "Role or Domain",
                        "description": "The role, job title, or domain to generate templates for. Be as specific or broad as you like.",
                        "placeholder": "e.g., TikTok creator, B2B sales rep, Shopify store owner, real estate agent"
                    },
                    {
                        "name": "Additional Context",
                        "description": "Optional. Any extra detail about the audience, niche, tools, or goals that would help the AI tailor the templates.",
                        "placeholder": "e.g., focused on short-form video, sells handmade jewellery, works with enterprise clients"
                    }
                ],
                "constraints": [
                    "Return only a valid JSON array of template objects with no text before or after the array.",
                    "Each template must include all fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.",
                    "The example field in each template must be a plain-English string showing a realistic sample input and what the AI returns — written so any non-technical user immediately understands the template's value.",
                    "inputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"description\": \"...\", \"placeholder\": \"...\" }. Never use a plain string as an input item.",
                    "outputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"type\": \"...\", \"description\": \"...\" }. Never use a plain string as an output item.",
                    "constraints MUST be an array of plain strings. success MUST be an array of plain strings. Never use objects for these fields.",
                    "Each input object must include a placeholder field containing a short, realistic example value for that field.",
                    "IDs must be lowercase hyphen-separated slugs (e.g. 'caption-writer', 'hashtag-research').",
                    "Every template must solve a distinct, real task for the given role — no duplicates or filler.",
                    "Generate between 6 and 12 templates unless the role clearly warrants more or fewer.",
                    "Do not wrap the array in any parent object — the top-level response must be a bare JSON array.",
                    "All string values must be valid JSON strings: no literal newlines inside strings (use \\n instead), no unescaped double quotes (use \\\" instead), no trailing commas after the last item in any array or object.",
                    "The entire response must pass JSON.parse() without errors. When in doubt, keep string values short and simple rather than risk a syntax error."
                ],
                "outputs": [
                    {
                        "name": "Template Group",
                        "type": "JSON",
                        "description": "A JSON array of complete template objects ready to paste into the Import JSON modal."
                    }
                ],
                "success": [
                    "The response is a valid JSON array that can be pasted directly into the Import JSON modal without modification.",
                    "Every template covers a distinct, high-value task for the described role.",
                    "Templates are specific and actionable — not generic rewrites of the same idea.",
                    "A person in the described role would recognise every template as something they actually need."
                ]
            },
            {
                "id": "workflow-generator",
                "name": "Workflow Generator",
                "description": "Describe a goal and the AI breaks it into a step-by-step set of templates — one for each stage of the process. Run each step in your AI tool and carry the result into the next, all the way to the finish line.",
                "objective": "Take a goal or multi-stage process and produce an ordered sequence of prompt templates, one per step, where the output of each step becomes the input to the next.",
                "actor": "You are an AI process designer who breaks complex goals into clear, sequential AI-assisted steps and designs a structured prompt template for each one.",
                "context": "The user will describe a goal or process (e.g. 'produce a TikTok video from idea to posted', 'write and publish a blog post', 'onboard a new client'). Your job is to:\n\n1. Break the goal into a logical sequence of steps where AI can assist at each stage.\n2. Design one complete prompt template per step.\n3. Each step after the first must include an input field that accepts the output from the previous step.\n4. Return all templates as a single JSON array in workflow order.\n\nEach template must follow this exact schema:\n{\n  \"id\": \"step-N-readable-slug\",\n  \"name\": \"Step N: Step Name\",\n  \"description\": \"One sentence describing what this step does.\",\n  \"objective\": \"What this step accomplishes.\",\n  \"actor\": \"The AI persona or role for this step.\",\n  \"context\": \"Background the AI needs. Mention that this is step N of the workflow and what the previous step produced, if applicable.\",\n  \"example\": \"A short plain-English walkthrough showing a realistic sample input for this step and what the AI returns. Write it so any user immediately understands what this step does without technical knowledge.\",\n  \"inputs\": [ { \"name\": \"Field Label\", \"description\": \"What the user should provide here.\", \"placeholder\": \"A short realistic example value.\" } ],\n  \"constraints\": [ \"A plain string rule the AI must follow.\" ],\n  \"outputs\": [ { \"name\": \"Output Name\", \"type\": \"string\", \"description\": \"What the AI returns and how it feeds into the next step.\" } ],\n  \"success\": [ \"A plain string criterion for a good response.\" ]\n}\n\nCRITICAL: inputs and outputs must ALWAYS be arrays of objects as shown above — never arrays of plain strings. constraints and success must ALWAYS be arrays of plain strings — never arrays of objects.\n\nDesign steps that are genuinely distinct — each step should transform or build on what came before. Avoid steps that could be collapsed into one.",
                "example": "Example goal: \"Write and publish a blog post\"\n\nWhat you get back:\nA set of step-by-step templates that take you from blank page to published post:\n• Step 1: Blog Idea Generator — brainstorm topics for your audience\n• Step 2: Outline Writer — turn your chosen idea into a structured outline\n• Step 3: Draft Writer — write the full post from the outline\n• Step 4: Editor — tighten, improve, and polish the draft\n• Step 5: SEO Title and Meta Writer — write a click-worthy title and meta description\n\nEach step feeds into the next — you run one at a time and carry the output forward.\n\nHow to use this template:\n1. Fill in the input fields below with your workflow goal.\n2. Click \"Create Prompt\" — the prompt is automatically copied to your clipboard.\n3. Go to your favorite AI tool and paste the prompt.\n4. Copy the response your AI gives back.\n5. Back in aiTemplateLab, click \"Import Template From AI\" in the sidebar.\n6. Paste the response and click Import — all steps appear in the sidebar, ready to run in order.",
                "inputs": [
                    {
                        "name": "Workflow Goal",
                        "description": "The end-to-end process or goal to design a workflow for.",
                        "placeholder": "e.g., produce and post a TikTok video, write a blog post from idea to published, respond to a sales lead and close the deal"
                    },
                    {
                        "name": "Additional Context",
                        "description": "Optional. Any constraints, tools, audience, or style preferences that should shape the workflow.",
                        "placeholder": "e.g., videos are under 60 seconds, audience is small business owners, we use HubSpot"
                    }
                ],
                "constraints": [
                    "Return only a valid JSON array of template objects in workflow order, with no text before or after the array.",
                    "Each template must include all fields: id, name, description, objective, actor, context, example, inputs, constraints, outputs, success.",
                    "The example field in each template must be a plain-English string showing a realistic sample input for that step and what the AI returns — written so any non-technical user immediately understands what the step does.",
                    "inputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"description\": \"...\", \"placeholder\": \"...\" }. Never use a plain string as an input item.",
                    "outputs MUST be an array of objects. Every item must be { \"name\": \"...\", \"type\": \"...\", \"description\": \"...\" }. Never use a plain string as an output item.",
                    "constraints MUST be an array of plain strings. success MUST be an array of plain strings. Never use objects for these fields.",
                    "Each input object must include a placeholder field containing a short, realistic example value for that field.",
                    "IDs must follow the pattern 'step-N-readable-slug' (e.g. 'step-1-idea-generator', 'step-2-script-writer').",
                    "Names must follow the pattern 'Step N: Step Name' (e.g. 'Step 1: Idea Generator').",
                    "Every step after step 1 must have an input field explicitly labelled to receive the previous step's output (e.g. 'Script Draft from Step 1').",
                    "Each step must be genuinely distinct — do not split work that belongs in one step or combine work that should be separate.",
                    "The output description of each step should note what it produces and how it is used in the next step.",
                    "Do not wrap the array in any parent object — the top-level response must be a bare JSON array.",
                    "All string values must be valid JSON strings: no literal newlines inside strings (use \\n instead), no unescaped double quotes (use \\\" instead), no trailing commas after the last item in any array or object.",
                    "The entire response must pass JSON.parse() without errors. When in doubt, keep string values short and simple rather than risk a syntax error."
                ],
                "outputs": [
                    {
                        "name": "Workflow Templates",
                        "type": "JSON",
                        "description": "A JSON array of complete template objects in step order, ready to paste into the Import JSON modal."
                    }
                ],
                "success": [
                    "The response is a valid JSON array that can be pasted directly into the Import JSON modal without modification.",
                    "Steps are in logical order and each builds meaningfully on the previous one.",
                    "Every step after the first explicitly accepts the previous step's output as an input.",
                    "Running the steps in sequence would take a user from the starting point to the stated goal with no gaps.",
                    "A person doing this workflow would find every step genuinely useful and non-redundant."
                ]
            }
        ],
        "inputHistory": []
    },
    "Example Templates": {
        "templates": [
            {
                "id": "jira-story-generator",
                "name": "Jira Story and Acceptance Criteria Generator",
                "description": "Transforms unstructured Jira ticket text into a clear Markdown-formatted user story and separate Gherkin-style acceptance criteria block for better readability and team alignment.",
                "objective": "Convert raw Jira ticket details or copied descriptions into a standardized user story template (“As a... I want... so that...”) with accompanying acceptance criteria formatted in Gherkin syntax.",
                "actor": "You are an AI assistant that analyzes Jira ticket text and produces a structured, Markdown-formatted output combining a user story and acceptance criteria.",
                "context": "Product managers, scrum masters, or developers often copy messy Jira descriptions into prompts. The assistant parses key information to produce a clean, developer-friendly story format to speed up backlog grooming and sprint planning.",
                "example": "Input — Jira Text:\n\"Users are getting logged out randomly. Seems to happen after about 30 min. Session token might be expiring too early. Need to fix it. Also the logout message is confusing.\"\n\nOutput — User Story:\nAs a logged-in user, I want my session to remain active as long as I am using the app, so that I am not unexpectedly logged out during normal use.\n\nAcceptance Criteria:\nGiven I am logged in and actively using the app\nWhen 30 minutes pass without a session refresh\nThen my session should be renewed automatically\n\nGiven my session has expired\nWhen I am redirected to login\nThen I see a clear message explaining why I was logged out",
                "inputs": [
                    {
                        "name": "Jira Text",
                        "description": "Paste the raw text from your Jira ticket — title, description, notes, anything you have. It does not need to be clean or formatted.",
                        "placeholder": "e.g., \"Users are getting logged out randomly after ~30 min. Session token might be expiring too early. Also the logout message is confusing.\""
                    }
                ],
                "constraints": [
                    "Always output two clearly labeled Markdown blocks:\n\nUser Story block in “As a..., I want..., so that...” format.\n\nAcceptance Criteria block in Gherkin (Given/When/Then) syntax.",
                    "Keep language clear and concise.",
                    "Preserve meaning and context from the Jira text without adding assumptions."
                ],
                "outputs": [
                    {
                        "name": "User Story",
                        "type": "markdown",
                        "example": "```Markdown format"
                    },
                    {
                        "name": "Acceptance Criteria",
                        "type": "markdown",
                        "example": "```Markdown Gherkin format."
                    },
                    {
                        "name": "Estimated Storypoints",
                        "type": "String",
                        "example": "1 – Tiny, very clear, low uncertainty.\n\n2 – Small, still clear, maybe 1–2 edge cases.\n\n3 – Small/medium, some unknowns but manageable.\n\n5 – Medium, visible complexity or dependencies, uncertainty noticeable.\n\n8 – Large, many moving parts or risks; consider splitting.\n\n13 – Very large, high uncertainty; typically should be split.\n\n1 (Tiny): Very clear, low uncertainty.\n\n2 (Small): Clear, maybe 1–2 edge cases.\n\n3 (Small/Medium): Some unknowns but manageable.\n\n5 (Medium): Visible complexity or dependencies; uncertainty noticeable.\n\n8 (Large): Many moving parts or risks; consider splitting.\n\n13 (Very Large): High uncertainty; typically should be split.\n\n21 (Too Big/Very Risky): Strong signal to slice the story."
                    },
                    {
                        "name": "Story point description",
                        "type": "string",
                        "example": "When explaining estimated story points:\n\nProvide a brief, clear justification for the estimate.\n\nRefer to scope, complexity, uncertainty, and dependencies as the key factors influencing the estimate.\n\nKeep sentences short and action-oriented (1–2 sentences per idea).\n\nIf the estimate is high, identify specific reasons (e.g., unclear acceptance criteria, external dependencies, unknown integrations).\n\nThen, suggest concrete ways to reduce the estimate, such as:\n\nSplitting the story into smaller deliverables\n\nClarifying requirements or assumptions\n\nRemoving unnecessary scope\n\nResolving dependencies early\n\nDo not restate the full scale. Instead, focus on why the story fits that level and how it could move to a smaller category.\nKeep tone professional, objective, and concise — aim for clarity, not detail overload.\n\nQuestions should be in a list most important first."
                    }
                ],
                "success": [
                    "The user story accurately reflects the intent of the Jira input.",
                    "Acceptance criteria are testable, unambiguous, and aligned with the story.",
                    "Output is cleanly formatted and ready to paste into Jira or documentation.",
                    "Questions needed to reduce uncertainty are asked in the story point description",
                    "Estimated story points should be exceptionally larger based on uncertainty or complexity."
                ]
            },
            {
                "id": "improve-function-implementation",
                "name": "Improve Function Implementation with Risk Analysis",
                "description": "A prompt that takes a single self-contained function plus high-level module context, then refactors the function for readability or performance (as specified) while preserving its public behavior and producing a structured risk analysis of potential issues such as null-pointer bugs, correctness problems, and security risks",
                "objective": "Enable a senior-level code assistant to improve an existing function implementation in a specified language, balancing readability and performance according to the caller’s priority, while also returning a concise explanation of key changes and a structured list of potential issues with concrete remediation suggestions\n",
                "actor": "You are a senior software engineer who refactors code, applies idiomatic style for the given language, and performs a focused risk review that identifies likely defects and edge cases without changing the function’s external contract unless explicitly allowed.",
                "context": "The caller supplies the implementation of a single function along with metadata about the surrounding module, the priority between performance and readability, and any constraints such as backward compatibility or dependency limits. Your task is to produce an improved version of that function, explain the main changes and trade-offs, and enumerate potential issues (e.g., null-pointer risks, performance hotspots, correctness concerns) with clear locations and suggested fixes.",
                "example": "Input — Function Source (JavaScript, readability priority):\nfunction calc(a,b,op){if(op=='add'){return a+b}else if(op=='sub'){return a-b}else if(op=='mul'){return a*b}else{return a/b}}\n\nOutput — Improved Function:\nfunction calculate(a, b, operation) {\n  const operations = {\n    add: () => a + b,\n    subtract: () => a - b,\n    multiply: () => a * b,\n    divide: () => a / b,\n  };\n  return operations[operation]?.() ?? null;\n}\n\nExplanation: Replaced if/else chain with a lookup map for clarity. Added null return for unknown operations.\n\nPotential Issues: No divide-by-zero guard — if b is 0 and operation is 'divide', returns Infinity.",
                "inputs": [
                    {
                        "name": "function_source: The full source code of a single, self-contained function that you will improve and analyze.",
                        "description": "Paste the complete function you want improved. Include the full function body — not just a snippet.",
                        "placeholder": "e.g., function calcTotal(items) { let t = 0; for (var i=0; i<items.length; i++) { t = t + items[i].price; } return t; }"
                    },
                    {
                        "name": "context.performance_or_readability_priority: Enum value of performance, readability, or both that tells you whether to favor speed, clarity, or a balanced compromise when refactoring.",
                        "description": "Enter: performance, readability, or both.",
                        "placeholder": "e.g., readability"
                    }
                ],
                "constraints": [
                    "Keep the public signature and externally observable behavior of the function unchanged unless context.constraints explicitly allows modifications to the contract.",
                    "Prefer clear, idiomatic code for the specified language, following common conventions for naming, formatting, and control flow.",
                    "Apply the performance_or_readability_priority: if performance, focus on algorithmic and allocation improvements; if readability, emphasize structure, naming, and simplicity; if both, seek a reasonable balance.",
                    "Do not introduce new external dependencies or libraries unless context.constraints explicitly permits them.",
                    "Use comments sparingly to explain non-obvious logic and important assumptions, avoiding over-commenting straightforward code.",
                    "Favor small, single-responsibility helpers and use private/subordinate functions when they improve clarity, while keeping the public function signature unchanged.",
                    "Explicitly look for and call out potential null-pointer and other high-impact issues, describing when they occur and their impact.",
                    "Keep the explanation of changes concise (around 200 words or less) and focused on the most important improvements and trade-offs."
                ],
                "outputs": [
                    {
                        "name": "improved_function_source",
                        "type": "string",
                        "example": "The revised implementation of the function in the same language, preserving the original public behavior under normal inputs while improving readability and/or performance according to the specified priority"
                    },
                    {
                        "name": "explanation:",
                        "type": "string",
                        "example": "A brief narrative that highlights the key structural, readability, and/or performance changes, including any notable trade-offs made to honor constraints."
                    },
                    {
                        "name": "potential_issues:",
                        "type": "string",
                        "example": "A list of Issue objects, each describing a detected risk in the original code (or remaining risk in the improved version) with type, description, location, and a concrete suggestion that respects the project constraints."
                    }
                ],
                "success": [
                    "improved_function_source parses/compiles in the specified language and preserves the original function’s public behavior and backward compatibility under normal inputs.",
                    "The resulting code follows idiomatic style for the language and is easier for other engineers to read and maintain, especially when readability is prioritized.",
                    "For performance-focused or balanced requests, the explanation clearly calls out the main performance improvements such as reduced allocations, simpler algorithms, or fewer redundant operations.",
                    "potential_issues includes likely null-pointer risks and other high-impact concerns, each with clear triggers, impact, and realistic remediation suggestions aligned with context.constraints.",
                    "Any refactoring into helpers improves clarity without altering the function’s public contract or breaking existing callers, and obvious edge cases are handled defensively without introducing new undefined behaviors."
                ]
            }
        ],
        "inputHistory": []
    }
};

window.preloadedConfig = {};


/* === promptOutput.js === */
/**
 * @fileoverview Prompt JSON generation and input history.
 *
 * generateViewPrompt() reads the current prompt's stored data plus any values
 * the user has typed into the input fields, then builds a structured JSON
 * object that can be copied and pasted directly into an AI tool.
 *
 * Input history is saved to localStorage each time the user copies output,
 * capped at 50 entries, and displayed in the Template History tab.
 *
 * Load order: depends on state.js and screens.js.
 */

/**
 * Builds the prompt JSON from the active prompt's stored definition and the
 * current values in the view-screen input fields, then writes it to the
 * output textarea (#view-output-json).
 *
 * Output shape:
 * {
 *   objective, actor, context,   // from stored prompt (omitted if empty)
 *   input: { fieldName: value }, // from user-filled text areas
 *   constraints: [...],
 *   output_schema: { type, properties, required },
 *   success_criteria: [...],
 *   output_instructions: '...'   // injected instruction for the AI
 * }
 */
function generateViewPrompt() {
    const prompt = state.prompts.find(p => p.id === state.currentPromptId);
    if (!prompt) return;

    // Collect current values from the dynamic input textareas.
    const inputs = {};
    prompt.inputs.forEach((i, idx) => {
        const field = document.getElementById(`input-value-${idx}`);
        inputs[i.name] = field ? field.value : '';
    });

    // Build the output_schema from the prompt's output definitions.
    const outputProperties = {};
    const requiredFields = [];
    prompt.outputs.forEach(o => {
        outputProperties[o.name] = { type: o.type, description: o.description || undefined };
        requiredFields.push(o.name);
    });

    // Assemble the final JSON, omitting empty top-level fields.
    const promptJson = {};
    if (prompt.objective) promptJson.objective = prompt.objective;
    if (prompt.actor) promptJson.actor = prompt.actor;
    if (prompt.context) promptJson.context = prompt.context;
    if (prompt.example) promptJson.example = prompt.example;
    if (Object.keys(inputs).length > 0) promptJson.input = inputs;
    if (prompt.constraints.length > 0) promptJson.constraints = prompt.constraints;
    promptJson.output_schema = { type: 'object', properties: outputProperties, required: requiredFields };
    if (prompt.success.length > 0) promptJson.success_criteria = prompt.success;

    // Append an output instruction that names the expected properties so the
    // AI knows exactly what to return without extra prose.
    const outputExample = Object.keys(outputProperties).join(', ');
    promptJson.output_instructions = outputExample
        ? `Return only the output exactly as specified by the properties: ${outputExample}. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array`
        : 'Return only the output exactly as specified by the defined properties. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array';

    const outputEl = document.getElementById('view-output-json');
    if (outputEl) outputEl.textContent = JSON.stringify(promptJson, null, 2);
}
window.generateViewPrompt = generateViewPrompt;

// =========================
// Input History
// =========================

/**
 * Returns all stored input history entries across all prompts.
 * Each entry is { templateId, inputValues: { fieldName: value } }.
 * @returns {Array}
 */
function getPromptInputHistoryAll() {
    const raw = localStorage.getItem(STORAGE_KEYS.PROMPT_INPUT_HISTORY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Saves a set of input values to history for a given template.
 * Skips saving if all values are empty (user copied without filling anything in).
 * History is capped at 50 entries, newest first.
 * @param {*} templateId - The prompt's id.
 * @param {Object} inputObj - Map of field name to value.
 */
function savePromptInputHistory(templateId, inputObj) {
    if (!templateId || !inputObj) return;
    if (Object.values(inputObj).every(v => !v)) return;
    let history = getPromptInputHistoryAll();
    history.unshift({ templateId, inputValues: inputObj });
    localStorage.setItem(STORAGE_KEYS.PROMPT_INPUT_HISTORY, JSON.stringify(history.slice(0, 50)));
    updateStorageMeter();
}

/**
 * Returns all history entries for a specific template.
 * @param {*} templateId
 * @returns {Array<Object>} Array of inputValues objects.
 */
function getPromptInputHistory(templateId) {
    return getPromptInputHistoryAll().filter(h => h.templateId === templateId).map(h => h.inputValues);
}

/**
 * Renders the input history table for a prompt into #history-list.
 * Columns are derived from the union of all field names seen across history
 * entries so the table handles prompts whose inputs changed over time.
 * Each row has a Restore button that repopulates the view-screen inputs.
 * @param {*} promptId
 */
function renderHistoryList(promptId) {
    const history = getPromptInputHistory(promptId);
    const container = document.getElementById('history-list');
    if (!container) return;
    if (!history || history.length === 0) {
        container.innerHTML = '<span style="color:#888;font-size:0.95em;">No input history for this prompt.</span>';
        return;
    }

    // Build column list from all unique field names across every history entry.
    const allFields = Array.from(new Set(history.flatMap(h => Object.keys(h))));
    // Give the Jira text column extra width via CSS — it tends to be long.
    const jiraIdx = allFields.findIndex(f => f.toLowerCase().includes('jira text'));
    container.style.setProperty('--history-cols', allFields.length + 1);
    container.innerHTML = `
        <div class="history-grid">
            <div class="history-row history-header">
                ${allFields.map(f => `<div class="history-cell history-header-cell${f.toLowerCase().includes('jira text') ? ' jira-text-cell' : ''}">${window.escapeHtml(f)}</div>`).join('')}
                <div class="history-cell history-header-cell">Action</div>
            </div>
            ${history.map((h, idx) => `
                <div class="history-row">
                    ${allFields.map((f, i) => `<div class="history-cell${i === jiraIdx ? ' jira-text-cell' : ''}">${h[f] ? window.escapeHtml(h[f]) : '<em>(empty)</em>'}</div>`).join('')}
                    <div class="history-cell"><button class="restore-btn" data-idx="${idx}">Restore</button></div>
                </div>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.restore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const selected = history[parseInt(btn.getAttribute('data-idx'))];
            if (!selected) return;
            showView();
            // Match each saved field value back to its textarea by label text.
            Object.entries(selected).forEach(([k, v]) => {
                const input = Array.from(document.querySelectorAll('[id^="input-value-"]')).find(el => {
                    const label = el.closest('div')?.querySelector('label');
                    return label && label.textContent.replace(':', '').trim() === k;
                });
                if (input) input.value = v;
            });
            generateViewPrompt();
        });
    });
}


/* === promptCrud.js === */
/**
 * @fileoverview Prompt CRUD operations, sidebar list rendering, view population,
 * and drag-and-drop reordering for the edit form.
 *
 * Data model note: prompts are stored in two places simultaneously:
 *   - state.prompts[]  — the flat working array for the current group
 *   - state.environment.templateGroups[state.currentTemplateGroup][] — the
 *     authoritative source that gets persisted to localStorage
 * Both must be kept in sync; every mutation writes to both then calls
 * savePromptsToLocalStorage().
 *
 * Load order: depends on state.js, screens.js, and promptOutput.js.
 */

/**
 * Creates a new blank prompt in the current template group and opens it
 * in the edit form.
 */
function startBlankPrompt() {
    // Generate a collision-free slug for the initial "New Prompt" name.
    const base = slugify('New Prompt');
    const existingIds = new Set(state.prompts.map(p => p.id));
    let newId = base;
    let i = 2;
    while (existingIds.has(newId)) newId = `${base}-${i++}`;

    const newPromptObj = {
        id: newId, name: 'New Prompt', description: '', objective: '',
        actor: '', context: '', example: '', inputs: [], constraints: [], outputs: [], success: []
    };
    if (!state.environment.templateGroups[state.currentTemplateGroup]) return;
    state.environment.templateGroups[state.currentTemplateGroup].push(newPromptObj);
    state.setPrompts(state.environment.templateGroups[state.currentTemplateGroup].map(normalizePrompt));
    window.savePromptsToLocalStorage();
    state.setCurrentPromptId(newId);
    editPrompt(newId); // defined in editPrompt.js
    setTabActive('Edit');
    renderPromptsList();
}
window.startBlankPrompt = startBlankPrompt;

/**
 * Removes a prompt from the current template group by ID.
 * After deletion, opens the first remaining prompt or the welcome screen.
 * @param {string} id - The prompt's id.
 */
function deletePrompt(id) {
    if (state.environment.templateGroups[state.currentTemplateGroup]) {
        state.environment.templateGroups[state.currentTemplateGroup] =
            state.environment.templateGroups[state.currentTemplateGroup].filter(p => p.id !== id);
        state.setPrompts(state.environment.templateGroups[state.currentTemplateGroup].map(normalizePrompt));
    } else {
        state.setPrompts(state.prompts.filter(p => p.id !== id));
    }
    window.savePromptsToLocalStorage();
    renderPromptsList();
    if (state.prompts.length > 0) {
        state.setCurrentPromptId(state.prompts[0].id);
        viewPrompt(state.currentPromptId);
    } else {
        state.setCurrentPromptId(null);
        showWelcome();
    }
}

/**
 * Reads all edit-form field values from the DOM and saves them to the
 * in-memory prompt array and localStorage.
 *
 * Uses querySelectorAll with ID-prefix patterns rather than the counter
 * variables so that deleted fields are automatically skipped — only elements
 * still present in the DOM get saved.
 */
function savePrompt() {
    const nameEl = document.getElementById('prompt-name');
    const descEl = document.getElementById('prompt-desc');
    if (!nameEl || !descEl) return;

    // Collect inputs — only rows where the name field has a value.
    const inputs = [];
    document.querySelectorAll('[id^="input-name-"]').forEach(el => {
        const fieldName = el.value.trim();
        const suffix = el.id.split('-')[2];
        const descInput = document.getElementById(`input-desc-${suffix}`);
        const phInput = document.getElementById(`input-placeholder-${suffix}`);
        if (fieldName) inputs.push({ name: fieldName, description: descInput ? descInput.value.trim() : '', placeholder: phInput ? phInput.value.trim() : '' });
    });

    const constraints = [];
    document.querySelectorAll('[id^="constraint-text-"]').forEach(el => {
        if (el.value.trim()) constraints.push(el.value.trim());
    });

    // Collect outputs — default type to 'string' if the field is blank.
    const outputs = [];
    document.querySelectorAll('[id^="output-name-"]').forEach(el => {
        const fieldName = el.value.trim();
        const suffix = el.id.split('-')[2];
        const typeEl = document.getElementById(`output-type-${suffix}`);
        const descInput = document.getElementById(`output-desc-${suffix}`);
        if (fieldName) outputs.push({
            name: fieldName,
            type: typeEl ? typeEl.value.trim() || 'string' : 'string',
            description: descInput ? descInput.value.trim() : ''
        });
    });

    const success = [];
    document.querySelectorAll('[id^="success-text-"]').forEach(el => {
        if (el.value.trim()) success.push(el.value.trim());
    });

    // Derive a slug ID from the current name. If another prompt already
    // uses that slug (excluding the current one), append -2, -3, etc.
    const name = nameEl.value.trim();
    const slugBase = slugify(name);
    const otherIds = new Set(state.prompts.filter(p => p.id !== state.currentPromptId).map(p => p.id));
    let newId = slugBase;
    let suffix = 2;
    while (otherIds.has(newId)) newId = `${slugBase}-${suffix++}`;

    const promptData = {
        id: newId,
        name,
        description: descEl.value.trim(),
        objective: document.getElementById('objective')?.value || '',
        actor: document.getElementById('actor')?.value || '',
        context: document.getElementById('context')?.value || '',
        example: document.getElementById('prompt-example')?.value.trim() || '',
        inputs, constraints, outputs, success
    };

    // Update both the flat prompts array and the authoritative templateGroups entry.
    // Also update currentPromptId in case the slug changed (name was edited).
    const idx = state.prompts.findIndex(p => p.id === state.currentPromptId);
    if (idx !== -1) {
        state.prompts[idx] = promptData;
        const group = state.environment.templateGroups[state.currentTemplateGroup];
        if (group) {
            const gIdx = group.findIndex(p => p.id === state.currentPromptId);
            if (gIdx !== -1) group[gIdx] = promptData;
        }
        state.setCurrentPromptId(newId);
    } else {
        // New prompt not yet in the array (edge case).
        state.prompts.push(promptData);
        state.setCurrentPromptId(promptData.id);
        if (state.environment.templateGroups[state.currentTemplateGroup]) {
            state.environment.templateGroups[state.currentTemplateGroup].push(promptData);
        }
    }
    window.savePromptsToLocalStorage();
    renderPromptsList();
}
window.savePrompt = savePrompt;

/**
 * Called by editPrompt.js on every field input event to auto-save.
 * Guards against running when the edit screen is not visible (e.g. during
 * initial page load when events fire before the screen is shown).
 */
window.regenerateOutput = function () {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen || !editScreen.classList.contains('active')) return;
    savePrompt();
};

/**
 * Cancels the current edit and returns to the view screen.
 * If no prompt was previously open, falls back to the welcome screen.
 */
function cancelEdit() {
    if (state.currentPromptId != null) viewPrompt(state.currentPromptId);
    else showWelcome();
}
window.cancelEdit = cancelEdit;

/**
 * Re-renders the sidebar showing all template groups as collapsible sections.
 * The active group's section is open by default. Clicking a tile in any group
 * switches the active group and opens that prompt.
 */
function renderPromptsList() {
    const container = document.getElementById('prompts-list');
    if (!container) return;

    const searchEl = document.getElementById('sidebar-search');
    const query = searchEl ? searchEl.value.trim().toLowerCase() : '';

    const groups = Object.entries(state.environment.templateGroups);

    if (query) {
        // Search mode: show all groups that have matches, all sections open.
        let anyMatch = false;
        const html = groups.map(([groupName, templates]) => {
            const matched = templates.filter(p => p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query));
            if (matched.length === 0) return '';
            anyMatch = true;
            const tilesHtml = matched.map((p, idx) =>
                `<div class="prompt-tile${state.currentPromptId === p.id ? ' selected' : ''}" data-id="${p.id}" data-group="${window.escapeHtml(groupName)}" draggable="false" data-index="${idx}">
                    <span class="prompt-tile-name">${window.escapeHtml(p.name)}</span>
                    <button class="prompt-tile-move-btn" draggable="false" aria-label="Options" data-id="${p.id}" data-group="${window.escapeHtml(groupName)}">⋮</button>
                </div>`
            ).join('');
            return `<details class="group-section" open data-group="${window.escapeHtml(groupName)}">
                <summary class="group-header">${window.escapeHtml(groupName)}</summary>
                <div class="group-templates">${tilesHtml}</div>
            </details>`;
        }).join('');
        container.innerHTML = anyMatch ? html : `<div class="group-empty" style="padding:1rem 0.75rem; color:#aaa;">No templates match "${window.escapeHtml(query)}"</div>`;
    } else {
        // Normal mode: all groups, active group open.
        container.innerHTML = groups.map(([groupName, templates]) => {
            const isActive = groupName === state.currentTemplateGroup;
            const tilesHtml = templates.length === 0
                ? `<div class="group-empty">No templates yet</div>`
                : templates.map((p, idx) =>
                    `<div class="prompt-tile${state.currentPromptId === p.id ? ' selected' : ''}" data-id="${p.id}" data-group="${window.escapeHtml(groupName)}" draggable="true" data-index="${idx}">
                        <span class="prompt-tile-name">${window.escapeHtml(p.name)}</span>
                        <button class="prompt-tile-move-btn" draggable="false" aria-label="Options" data-id="${p.id}" data-group="${window.escapeHtml(groupName)}">⋮</button>
                    </div>`
                ).join('');
            return `<details class="group-section" ${isActive ? 'open' : ''} data-group="${window.escapeHtml(groupName)}">
                <summary class="group-header">${window.escapeHtml(groupName)}</summary>
                <div class="group-templates">${tilesHtml}</div>
            </details>`;
        }).join('');
    }

    // Tile clicks — switch active group if needed, then open the prompt.
    container.querySelectorAll('.prompt-tile').forEach(item => {
        item.addEventListener('click', e => {
            if (e.target.closest('.prompt-tile-move-btn')) return;
            const group = item.getAttribute('data-group');
            if (group !== state.currentTemplateGroup) {
                state.setCurrentTemplateGroup(group);
                state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));
                window.savePromptsToLocalStorage();
            }
            viewPrompt(item.getAttribute('data-id'));
        });
    });

    // ⋮ buttons — switch group context if needed, then open the tile menu.
    container.querySelectorAll('.prompt-tile-move-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const group = btn.getAttribute('data-group');
            if (group !== state.currentTemplateGroup) {
                state.setCurrentTemplateGroup(group);
                state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));
                window.savePromptsToLocalStorage();
            }
            openTileMenu(btn.getAttribute('data-id'), btn);
        });
    });

    // Drag-to-reorder within each group section.
    container.querySelectorAll('.group-section').forEach(section => {
        const groupName = section.getAttribute('data-group');
        let draggedIdx = null;
        section.querySelectorAll('.prompt-tile').forEach(item => {
            item.addEventListener('dragstart', e => {
                draggedIdx = parseInt(item.getAttribute('data-index'));
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggedIdx = null; });
            item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
            item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
            item.addEventListener('drop', e => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const targetIdx = parseInt(item.getAttribute('data-index'));
                if (draggedIdx !== null && draggedIdx !== targetIdx) {
                    const group = state.environment.templateGroups[groupName];
                    if (group) {
                        const moved = group.splice(draggedIdx, 1)[0];
                        group.splice(targetIdx, 0, moved);
                        if (groupName === state.currentTemplateGroup) {
                            state.setPrompts(group.map(normalizePrompt));
                        }
                        window.savePromptsToLocalStorage();
                        renderPromptsList();
                    }
                }
            });
        });
    });
}
window.renderPromptsList = renderPromptsList;

/**
 * Populates the view screen with a prompt's data and regenerates its output JSON.
 * Also updates the sidebar selection highlight.
 * @param {string} id - The prompt's id.
 */
function viewPrompt(id) {
    const prompt = state.prompts.find(p => p.id === id);
    if (!prompt) return;
    state.setCurrentPromptId(id);

    showView();
    // Hide the welcome screen in case it was showing.
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) { welcomeScreen.style.display = 'none'; welcomeScreen.classList.remove('active'); }

    const viewName = document.getElementById('view-name');
    const viewDesc = document.getElementById('view-desc');
    if (viewName) viewName.textContent = prompt.name;
    if (viewDesc) viewDesc.textContent = prompt.description;

    // Build the collapsible metadata block (objective / actor / context).
    const meta = [];
    if (prompt.objective) meta.push(`<div><strong>Objective:</strong> ${window.escapeHtml(prompt.objective)}</div>`);
    if (prompt.actor) meta.push(`<div><strong>Actor:</strong> ${window.escapeHtml(prompt.actor)}</div>`);
    if (prompt.context) meta.push(`<div><strong>Context:</strong> ${window.escapeHtml(prompt.context)}</div>`);
    const viewMeta = document.getElementById('view-meta');
    if (viewMeta) viewMeta.innerHTML = meta.join('');

    // Show or hide the example section.
    const exampleSection = document.getElementById('view-example-section');
    const exampleContent = document.getElementById('view-example-content');
    if (exampleSection && exampleContent) {
        if (prompt.example) {
            exampleContent.textContent = prompt.example;
            exampleSection.style.display = '';
        } else {
            exampleSection.style.display = 'none';
        }
    }

    // Render input fields as labelled textareas. Each change regenerates the output JSON.
    const inputsContainer = document.getElementById('view-inputs');
    if (inputsContainer) {
        if (prompt.inputs.length === 0) {
            inputsContainer.innerHTML = '<p class="section-desc">No input fields defined</p>';
        } else {
            inputsContainer.innerHTML = prompt.inputs.map((i, idx) => `
                <div style="margin-bottom: 1rem;">
                    <label for="input-value-${idx}">${window.escapeHtml(i.name)}:</label>
                    ${i.description ? `<p class="input-hint">${window.escapeHtml(i.description)}</p>` : ''}
                    <textarea id="input-value-${idx}" class="view-textarea" rows="6"
                        placeholder="${window.escapeHtml(i.placeholder || i.description || '')}"></textarea>
                </div>
            `).join('');
            inputsContainer.querySelectorAll('textarea').forEach(ta => {
                ta.addEventListener('input', generateViewPrompt);
            });
        }
    }

    generateViewPrompt();
    renderPromptsList();
}

/**
 * Removes a dynamic field card from the edit form by element ID,
 * then triggers an auto-save so the deletion is persisted.
 * @param {string} id - The element ID of the card to remove.
 */
function removeElement(id) {
    const el = document.getElementById(id);
    if (el) { el.remove(); regenerateOutput(); }
}
window.removeElement = removeElement;

// =========================
// Drag-and-Drop (Edit Form Fields)
// =========================

/**
 * Attaches drag-and-drop reordering to all items matching itemClass inside
 * a container. Uses live DOM insertion (insertBefore) for a smooth drag feel.
 * Triggers regenerateOutput on dragend so the new order is persisted.
 * @param {string} containerId - The container element's ID.
 * @param {string} itemClass - CSS selector for draggable child items.
 */
function makeFieldsSortable(containerId, itemClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let dragged = null;
    container.querySelectorAll(itemClass).forEach(item => {
        item.addEventListener('dragstart', e => {
            dragged = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            if (dragged) { dragged.classList.remove('dragging'); dragged = null; regenerateOutput(); }
        });
        item.addEventListener('dragover', e => {
            e.preventDefault();
            if (!dragged || dragged === item) return;
            // Insert before or after the target based on cursor position.
            const before = e.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2;
            container.insertBefore(dragged, before ? item : item.nextSibling);
        });
    });
}
window.makeInputsSortable = () => makeFieldsSortable('inputs-container', '.input-item');
window.makeOutputsSortable = () => makeFieldsSortable('outputs-container', '.output-item');

// =========================
// Tile Context Menu (⋮)
// =========================

// ID of the template the context menu was opened for.
let tileMenuTargetId = null;
// Expose so app.js delete handler can read it.
Object.defineProperty(window, 'tileMenuTargetId', { get: () => tileMenuTargetId });

/** Positions and shows the context menu next to the given button element. */
function openTileMenu(templateId, btn) {
    const menu = document.getElementById('tile-context-menu');
    if (!menu) return;
    tileMenuTargetId = templateId;
    const rect = btn.getBoundingClientRect();
    // Align left edge of menu with button; appear below it.
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.display = 'block';
}

/** Hides the context menu and clears the target ID. */
function closeTileMenu() {
    const menu = document.getElementById('tile-context-menu');
    if (menu) menu.style.display = 'none';
    tileMenuTargetId = null;
}

/**
 * Moves a template from the current group into the target group.
 * If the moved template was selected, opens the next available template.
 * @param {string} templateId - ID of the template to move.
 * @param {string} targetGroup - Name of the destination group.
 */
function moveTemplateToGroup(templateId, targetGroup) {
    const sourceGroup = state.environment.templateGroups[state.currentTemplateGroup];
    const templateIdx = sourceGroup.findIndex(p => p.id === templateId);
    if (templateIdx === -1 || !state.environment.templateGroups[targetGroup]) return;

    const [template] = sourceGroup.splice(templateIdx, 1);
    state.environment.templateGroups[targetGroup].push(template);
    state.setPrompts(state.environment.templateGroups[state.currentTemplateGroup].map(normalizePrompt));

    if (state.currentPromptId === templateId) {
        if (state.prompts.length > 0) {
            state.setCurrentPromptId(state.prompts[0].id);
            viewPrompt(state.currentPromptId);
        } else {
            state.setCurrentPromptId(null);
            showWelcome();
        }
    }

    window.savePromptsToLocalStorage();
    renderPromptsList();
}

/**
 * Renames a template and updates its slug ID to match the new name.
 * @param {string} templateId - Current ID of the template.
 * @param {string} newName - The new display name.
 */
function renameTemplate(templateId, newName) {
    const slugBase = slugify(newName);
    const otherIds = new Set(state.prompts.filter(p => p.id !== templateId).map(p => p.id));
    let newId = slugBase;
    let suffix = 2;
    while (otherIds.has(newId)) newId = `${slugBase}-${suffix++}`;

    const group = state.environment.templateGroups[state.currentTemplateGroup];
    const gIdx = group ? group.findIndex(p => p.id === templateId) : -1;
    if (gIdx === -1) return;

    group[gIdx] = { ...group[gIdx], id: newId, name: newName };
    state.setPrompts(group.map(normalizePrompt));

    if (state.currentPromptId === templateId) {
        state.setCurrentPromptId(newId);
        // Update the visible name in the view header without a full viewPrompt reload.
        const viewName = document.getElementById('view-name');
        if (viewName) viewName.textContent = newName;
    }

    window.savePromptsToLocalStorage();
    renderPromptsList();
}

/**
 * Wires the tile context menu and all three action modals (move, rename, delete).
 * Called once during app startup.
 */
function setupTileContextMenu() {
    // Close menu on any outside click.
    document.addEventListener('click', e => {
        const menu = document.getElementById('tile-context-menu');
        if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
            closeTileMenu();
        }
    });

    // Move to Group — open modal populated with other groups.
    const moveBtn = document.getElementById('tile-menu-move');
    if (moveBtn) {
        moveBtn.addEventListener('click', () => {
            const templateId = tileMenuTargetId;
            closeTileMenu();
            const modal = document.getElementById('move-template-modal');
            const select = document.getElementById('move-template-group-select');
            const nameEl = document.getElementById('move-template-name');
            if (!modal || !select) return;
            const template = state.prompts.find(p => p.id === templateId);
            if (!template) return;
            const otherGroups = Object.keys(state.environment.templateGroups).filter(g => g !== state.currentTemplateGroup);
            if (nameEl) nameEl.textContent = template.name;
            select.innerHTML = otherGroups.map(g => `<option value="${g}">${window.escapeHtml(g)}</option>`).join('');
            select.innerHTML += `<option value="__new__">New Group...</option>`;
            const newGroupRow = document.getElementById('move-template-new-group-row');
            const newGroupInput = document.getElementById('move-template-new-group-name');
            if (newGroupRow) newGroupRow.style.display = 'none';
            if (newGroupInput) newGroupInput.value = '';
            modal.dataset.templateId = templateId;
            document.getElementById('move-template-error').style.display = 'none';
            modal.style.display = 'flex';
        });
    }

    // Move modal confirm/cancel.
    const moveModal = document.getElementById('move-template-modal');
    const moveConfirm = document.getElementById('move-template-confirm');
    const moveCancel = document.getElementById('move-template-cancel');
    // Toggle the new group name input when "New Group..." is selected.
    const moveSelect = document.getElementById('move-template-group-select');
    if (moveSelect) {
        moveSelect.addEventListener('change', () => {
            const newGroupRow = document.getElementById('move-template-new-group-row');
            const newGroupInput = document.getElementById('move-template-new-group-name');
            const isNew = moveSelect.value === '__new__';
            if (newGroupRow) newGroupRow.style.display = isNew ? 'flex' : 'none';
            if (isNew && newGroupInput) setTimeout(() => newGroupInput.focus(), 0);
        });
    }

    if (moveConfirm) {
        moveConfirm.addEventListener('click', () => {
            const select = document.getElementById('move-template-group-select');
            const errorDiv = document.getElementById('move-template-error');
            const templateId = moveModal.dataset.templateId;
            if (!templateId) return;

            let targetGroup = select.value;

            if (targetGroup === '__new__') {
                const newName = document.getElementById('move-template-new-group-name').value.trim();
                if (!newName) {
                    errorDiv.textContent = 'Please enter a group name.';
                    errorDiv.style.display = 'block';
                    return;
                }
                if (state.environment.templateGroups[newName]) {
                    errorDiv.textContent = 'A group with that name already exists.';
                    errorDiv.style.display = 'block';
                    return;
                }
                // Create the new group then move into it.
                state.environment.templateGroups[newName] = [];
                state.environment.history[newName] = [];
                if (typeof updateTemplateGroupDropdown === 'function') updateTemplateGroupDropdown();
                targetGroup = newName;
            }

            moveTemplateToGroup(templateId, targetGroup);
            moveModal.style.display = 'none';
        });
    }
    if (moveCancel) moveCancel.addEventListener('click', () => { moveModal.style.display = 'none'; });
    if (moveModal) moveModal.addEventListener('click', e => { if (e.target === moveModal) moveModal.style.display = 'none'; });

    // Rename — open modal pre-filled with current name.
    const renameBtn = document.getElementById('tile-menu-rename');
    if (renameBtn) {
        renameBtn.addEventListener('click', () => {
            const templateId = tileMenuTargetId;
            closeTileMenu();
            const modal = document.getElementById('rename-template-modal');
            const input = document.getElementById('rename-template-input');
            const errorDiv = document.getElementById('rename-template-error');
            if (!modal || !input) return;
            const template = state.prompts.find(p => p.id === templateId);
            if (!template) return;
            input.value = template.name;
            errorDiv.style.display = 'none';
            modal.dataset.templateId = templateId;
            modal.style.display = 'flex';
            setTimeout(() => input.select(), 50);
        });
    }

    // Rename modal confirm/cancel.
    const renameModal = document.getElementById('rename-template-modal');
    const renameConfirm = document.getElementById('rename-template-confirm');
    const renameCancel = document.getElementById('rename-template-cancel');
    if (renameConfirm) {
        renameConfirm.addEventListener('click', () => {
            const input = document.getElementById('rename-template-input');
            const errorDiv = document.getElementById('rename-template-error');
            const newName = input.value.trim();
            if (!newName) { errorDiv.textContent = 'Please enter a name.'; errorDiv.style.display = 'block'; return; }
            renameTemplate(renameModal.dataset.templateId, newName);
            renameModal.style.display = 'none';
        });
    }
    if (renameCancel) renameCancel.addEventListener('click', () => { renameModal.style.display = 'none'; });
    if (renameModal) renameModal.addEventListener('click', e => { if (e.target === renameModal) renameModal.style.display = 'none'; });

    // Delete — show existing delete confirmation modal.
    const deleteBtn = document.getElementById('tile-menu-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            closeTileMenu();
            const modal = document.getElementById('delete-modal');
            if (modal) modal.style.display = 'flex';
        });
    }
}
window.setupTileContextMenu = setupTileContextMenu;


/* === importExport.js === */
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


/* === workspaceManager.js === */
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
 * Rebuilds the template group <select> dropdown from state.environment.templateGroups
 * and ensures the currently active group is selected.
 */
function updateTemplateGroupDropdown() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = Object.keys(state.environment.templateGroups).map(name =>
        `<option value="${name}"${name === state.currentTemplateGroup ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.value = state.currentTemplateGroup;
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
            state.setCurrentTemplateGroup(dropdown.value);
            state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));
            renderPromptsList();
            const infoDisplay = document.getElementById('info-display');
            if (state.prompts.length > 0) {
                state.setCurrentPromptId(state.prompts[0].id);
                viewPrompt(state.currentPromptId);
                if (infoDisplay) infoDisplay.style.display = '';
            } else {
                state.setCurrentPromptId(null);
                showWelcome();
            }
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
            select.innerHTML = Object.keys(state.environment.templateGroups).map(name =>
                `<option value="${name}">${name}</option>`).join('');
            select.value = state.currentTemplateGroup;
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
            downloadJson({ name: groupName, templates: state.environment.templateGroups[groupName], history: state.environment.history[groupName] || [] }, fileName);
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
                    if (state.environment.templateGroups[loaded.name]) { alert('Template group with this name already exists.'); return; }
                    state.environment.templateGroups[loaded.name] = loaded.templates;
                    state.environment.history[loaded.name] = loaded.history || [];
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
            if (state.environment.templateGroups[groupName]) { errorDiv.textContent = 'A group with this name already exists.'; errorDiv.style.display = 'block'; return; }
            state.environment.templateGroups[groupName] = [];
            state.environment.history[groupName] = [];
            state.setCurrentTemplateGroup(groupName);
            state.setCurrentPromptId(null);
            updateTemplateGroupDropdown();
            renderPromptsList();
            showWelcome();
            document.getElementById('create-template-group-modal').style.display = 'none';
            errorDiv.style.display = 'none';
            alert(`Template group '${groupName}' created successfully!`);
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
            if (Object.keys(state.environment.templateGroups).length <= 1) { errorDiv.textContent = 'At least one group must remain.'; errorDiv.style.display = 'block'; return; }
            if (groupName === state.currentTemplateGroup) { errorDiv.textContent = 'Cannot delete the currently selected group.'; errorDiv.style.display = 'block'; return; }
            delete state.environment.templateGroups[groupName];
            delete state.environment.history[groupName];
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
            downloadJson({ templateGroups: state.environment.templateGroups, history: state.environment.history, currentTemplateGroup: state.currentTemplateGroup }, fileName);
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
                    state.environment.templateGroups = loaded.templateGroups;
                    state.environment.history = loaded.history || {};
                    state.setCurrentTemplateGroup(loaded.currentTemplateGroup || Object.keys(state.environment.templateGroups)[0] || 'Default');
                    state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));
                    updateTemplateGroupDropdown();
                    renderPromptsList();
                    if (state.prompts.length > 0) {
                        state.setCurrentPromptId(state.prompts[0].id);
                        viewPrompt(state.currentPromptId);
                    } else {
                        state.setCurrentPromptId(null);
                        showWelcome();
                    }
                    alert('Workspace loaded successfully!');
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
    const closeAll = () => {
        document.querySelectorAll('.menu-bar-dropdown').forEach(d => d.classList.remove('open'));
        const mobilePanel = document.getElementById('mobile-menu-panel');
        if (mobilePanel) mobilePanel.classList.remove('open');
    };

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
    const liveSiteBtn = document.getElementById('menu-live-site');
    if (liveSiteBtn) {
        if (window.location.hostname === 'jmason15.github.io') {
            liveSiteBtn.style.display = 'none';
        } else {
            liveSiteBtn.addEventListener('click', () => { closeAll(); window.open('https://jmason15.github.io/aiTemplateLab/', '_blank', 'noopener'); });
        }
    }
    document.getElementById('menu-download-app')?.addEventListener('click', () => { closeAll(); window.open('https://github.com/Jmason15/aiTemplateLab/releases/latest/download/aiTemplateLab.html', '_blank', 'noopener'); });

    // Templates menu.
    document.getElementById('menu-new-template')?.addEventListener('click', () => { closeAll(); startBlankPrompt(); });
    document.getElementById('menu-import-templates')?.addEventListener('click', () => { closeAll(); if (typeof openNewPromptModal === 'function') openNewPromptModal(); });
    document.getElementById('menu-import-from-file')?.addEventListener('click', () => { closeAll(); if (typeof window.importPrompts === 'function') window.importPrompts(); });
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
        select.innerHTML = Object.keys(state.environment.templateGroups).map(name => `<option value="${window.escapeHtml(name)}">${window.escapeHtml(name)}</option>`).join('');
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

    // Help menu.
    const helpContent = {
        'help-what-is-template': {
            title: 'What is a Template?',
            content: `<p>A <strong>template</strong> is a pre-built AI prompt designed for a specific task.</p>
                <p>Instead of figuring out what to say to an AI from scratch every time, a template does the hard work for you. It knows the right structure, the right instructions, and the right questions to ask — you just fill in your specific details.</p>
                <p><strong>Example:</strong> The "Jira Story Generator" template already knows how to turn messy ticket notes into a clean user story with acceptance criteria. You paste in your notes, click Create Prompt, and paste the result into your favorite AI tool.</p>
                <p>Think of templates like smart forms — they turn your raw information into a polished, professional AI prompt every time.</p>`
        },
        'help-what-is-group': {
            title: 'What is a Template Group?',
            content: `<p>A <strong>template group</strong> is a folder of related templates kept together.</p>
                <p>As you build up a library of templates, groups keep things organised. You might have a group for your development work, another for writing, and another for customer service — each with its own set of templates tailored to that area.</p>
                <p><strong>Example:</strong> A marketing team might have a "Social Media" group with templates for captions, hashtags, and post ideas — and a separate "Email" group for subject lines and newsletters.</p>
                <p>You can switch between groups from the sidebar, and save or share a whole group as a single file.</p>`
        },
        'help-how-to-use': {
            title: 'How to use this app',
            content: `<ol style="padding-left:1.25rem; margin:0; display:flex; flex-direction:column; gap:0.75rem;">
                <li><strong>Pick a template from the sidebar.</strong> Each template is built for a specific task. If you don't see one you need, use the Template Builder to create one.</li>
                <li><strong>Fill in the fields under "Use Template".</strong> Each field tells you exactly what to provide — just type in your information.</li>
                <li><strong>Click "Create Prompt".</strong> The app assembles everything into a complete, structured AI prompt.</li>
                <li><strong>Copy and paste into your AI tool.</strong> Paste the result into your favorite AI tool and get a high-quality response.</li>
                <li><strong>Come back and reuse it.</strong> Next time you need the same kind of result, your template is already here waiting.</li>
            </ol>`
        },
        'help-why-important': {
            title: 'Why is this app important?',
            content: `<p>Most people type a quick message to an AI and hope for the best — then wonder why the results are inconsistent or off-target.</p>
                <p>The truth is, <strong>the quality of your AI output is only as good as the quality of your prompt.</strong> A vague question gets a vague answer. A well-structured prompt gets a precise, useful result.</p>
                <p>aiTemplateLab solves this by letting you:</p>
                <ul style="padding-left:1.25rem; margin:0.5rem 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li><strong>Build prompts once</strong> and reuse them forever.</li>
                    <li><strong>Get consistent results</strong> every time, not just when you happen to phrase things well.</li>
                    <li><strong>Share your best prompts</strong> with your team so everyone benefits.</li>
                    <li><strong>Stop starting from scratch</strong> — your prompt library grows with you.</li>
                </ul>
                <p style="margin-top:0.75rem;">Whether you use AI daily or occasionally, having the right template means less frustration and better results — every single time.</p>`
        },
        'help-template-lab': {
            title: 'Using the Template Lab',
            content: `<p>The <strong>Template Lab</strong> group contains three tools that let you build new templates using an AI. Switch to the Template Lab group in the sidebar to get started.</p>
                <p><strong>Template Builder</strong> — Creates a single new template from a plain-English idea.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li>Pick <em>Template Builder</em> from the sidebar and open <em>Use Template</em>.</li>
                    <li>Describe what you want — e.g. <em>"A prompt that turns meeting notes into action items."</em></li>
                    <li>Click <strong>Create Prompt</strong> and copy the result.</li>
                    <li>Paste it into your favorite AI tool. It will return a complete template as JSON.</li>
                    <li>Copy the response, then click the green <strong>Import Template From AI</strong> button in the sidebar, paste it in, and click Import.</li>
                </ol>
                <p><strong>Template Group Generator</strong> — Creates a full set of templates for a specific job or role.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li>Enter your job title or area of work — e.g. <em>"Marketing Manager"</em>.</li>
                    <li>Run it through your AI tool. You'll get a whole group of templates covering every common task for that role.</li>
                    <li>Copy the response, click <strong>Import Template From AI</strong> in the sidebar, paste it in, and click Import — your whole group appears at once.</li>
                </ol>
                <p><strong>Workflow Generator</strong> — Breaks a multi-step goal into a sequence of templates, one per stage.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 0 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li>Describe your goal — e.g. <em>"Write and publish a blog post."</em></li>
                    <li>The AI generates a chain of templates where the output of each step feeds into the next.</li>
                    <li>Copy the response, click <strong>Import Template From AI</strong> in the sidebar, paste it in, and click Import — all steps appear ready to run in order.</li>
                </ol>`
        },
        'help-create-from-scratch': {
            title: 'Creating a template from scratch',
            content: `<p>You can build a template entirely by hand — no AI needed — using the blank template editor.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.5rem;">
                    <li><strong>Open a blank template.</strong> Click <em>New Blank Template</em> in the sidebar, or go to <em>Templates → New</em> in the menu bar.</li>
                    <li><strong>Give it a name and description.</strong> The name appears in the sidebar; the description helps you remember what the template is for.</li>
                    <li><strong>Fill in the sections.</strong> Work through Objective, Actor, Context, and the rest at your own pace. You don't need to fill in every section — just what's useful for your task.</li>
                    <li><strong>Add inputs.</strong> Inputs are the fields you fill in each time you use the template. Click <em>Add Input</em>, give each one a clear label, and optionally add a placeholder example so you remember what to type.</li>
                    <li><strong>Click Save.</strong> Your template appears in the sidebar immediately, ready to use.</li>
                </ol>
                <p><strong>Tip:</strong> If you're not sure what to write, open the <em>See an Example</em> section on any existing template to see how it's structured — then model yours on that.</p>`
        },
        'help-edit-screen': {
            title: 'What does the Edit screen do?',
            content: `<p>The <strong>Edit Template</strong> tab lets you modify any template. Click it while a template is selected to open the editor.</p>
                <p><strong>Sections you can edit:</strong></p>
                <ul style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.5rem;">
                    <li><strong>Name &amp; Description</strong> — What appears in the sidebar and at the top of the template view.</li>
                    <li><strong>Example</strong> — An optional plain-English walkthrough that appears in the "See an Example" section when using the template. Great for helping others understand what the template is for.</li>
                    <li><strong>Objective</strong> — What the prompt is trying to achieve.</li>
                    <li><strong>Actor</strong> — The role or persona the AI should take on (e.g. "a senior software engineer").</li>
                    <li><strong>Context</strong> — Background information the AI needs to know before it starts.</li>
                    <li><strong>Inputs</strong> — The fields you fill in each time you use the template. Each input has a label, a description, and an optional placeholder example. Use the <em>Add Input</em> button to add more.</li>
                    <li><strong>Constraints</strong> — Rules the AI must follow (e.g. "Keep the response under 200 words"). Use <em>Add Constraint</em> to add more.</li>
                    <li><strong>Outputs</strong> — What the AI should return, and in what format. Use <em>Add Output</em> to add more.</li>
                    <li><strong>Success Criteria</strong> — How you know the result is good. Use <em>Add Success Criterion</em> to add more.</li>
                </ul>
                <p><strong>Auto-save:</strong> Changes are saved automatically as you type — no need to click Save unless you want to force a save immediately.</p>`
        }
    };

    const helpModal = document.getElementById('help-modal');
    const helpTitle = document.getElementById('help-modal-title');
    const helpBody = document.getElementById('help-modal-content');
    const helpClose = document.getElementById('help-modal-close');

    // Expose globally so home screen chips can open the modal by key.
    window.showHelpModal = function(key) {
        const data = helpContent[key];
        if (!data || !helpModal) return;
        helpTitle.textContent = data.title;
        helpBody.innerHTML = data.content;
        helpModal.style.display = 'flex';
    };

    Object.entries(helpContent).forEach(([id, data]) => {
        document.getElementById(id)?.addEventListener('click', () => {
            closeAll();
            window.showHelpModal(id);
        });
    });

    // Wire home screen help chips (delegated, chips may not exist yet).
    document.addEventListener('click', e => {
        const chip = e.target.closest('.home-help-chip');
        if (chip && chip.dataset.help) {
            window.showHelpModal(chip.dataset.help);
        }
    });

    if (helpClose) helpClose.addEventListener('click', () => { helpModal.style.display = 'none'; });
    if (helpModal) helpModal.addEventListener('click', e => { if (e.target === helpModal) helpModal.style.display = 'none'; });

    // Home button — navigate to the welcome/home screen.
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) homeBtn.addEventListener('click', () => { closeAll(); state.setCurrentPromptId(null); showWelcome(); });

    // Mobile menu toggle.
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobilePanel = document.getElementById('mobile-menu-panel');
    if (mobileMenuBtn && mobilePanel) {
        mobileMenuBtn.addEventListener('click', e => {
            e.stopPropagation();
            mobilePanel.classList.toggle('open');
        });
    }

    // Wire mobile menu buttons — proxy to the same handlers as desktop.
    const mob = (id, fn) => document.getElementById(id)?.addEventListener('click', () => { closeAll(); fn(); });
    mob('mob-save-workspace',   () => document.getElementById('save-workspace-btn').click());
    mob('mob-load-workspace',   () => document.getElementById('load-workspace-btn').click());
    mob('mob-live-site',        () => window.open('https://jmason15.github.io/aiTemplateLab/', '_blank', 'noopener'));
    mob('mob-download-app',     () => window.open('https://github.com/Jmason15/aiTemplateLab/releases/latest/download/aiTemplateLab.html', '_blank', 'noopener'));
    mob('mob-clear-storage',    () => { document.getElementById('clear-storage-modal').style.display = 'flex'; });
    mob('mob-create-group',     () => openCreateGroupModal());
    mob('mob-save-group',       () => document.getElementById('save-template-group-btn').click());
    mob('mob-load-group',       () => document.getElementById('load-template-group-btn').click());
    mob('mob-delete-group',     () => document.getElementById('menu-delete-template-group').click());
    mob('mob-new-template',     () => startBlankPrompt());
    mob('mob-import-template',  () => { if (typeof openNewPromptModal === 'function') openNewPromptModal(); });
    mob('mob-import-from-file', () => { if (typeof window.importPrompts === 'function') window.importPrompts(); });
    mob('mob-export-templates', () => { if (typeof window.exportPrompts === 'function') window.exportPrompts(); });
    mob('mob-help-what-is-template',    () => window.showHelpModal('help-what-is-template'));
    mob('mob-help-what-is-group',       () => window.showHelpModal('help-what-is-group'));
    mob('mob-help-how-to-use',          () => window.showHelpModal('help-how-to-use'));
    mob('mob-help-why-important',       () => window.showHelpModal('help-why-important'));
    mob('mob-help-template-lab',        () => window.showHelpModal('help-template-lab'));
    mob('mob-help-create-from-scratch', () => window.showHelpModal('help-create-from-scratch'));
    mob('mob-help-edit-screen',         () => window.showHelpModal('help-edit-screen'));

    // Hide "Try Live Version" on the live site.
    const mobLiveSite = document.getElementById('mob-live-site');
    if (mobLiveSite && window.location.hostname === 'jmason15.github.io') mobLiveSite.style.display = 'none';
}


/* === app.js === */
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
    const saveBtn = document.getElementById('save-prompt');
    if (saveBtn) saveBtn.addEventListener('click', savePrompt);
    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

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
    if (copyModal) wireModalDismiss(copyModal, closeCopyModal);

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

    setupEditScreenListener();
    setupNewPromptModal();
    setupTileContextMenu();
    setupWorkspaceHandlers();
    setupTemplateGroupHandlers();
    setupMenuBar();
    updateStorageMeter();
}

startApp();
