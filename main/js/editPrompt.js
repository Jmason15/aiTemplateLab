/**
 * @fileoverview Edit form — dynamic field management and auto-save.
 *
 * This file manages the edit screen UI: populating it when a prompt is opened
 * for editing, adding/removing dynamic field cards (inputs, outputs, constraints,
 * success criteria), and auto-saving changes to localStorage as the user types.
 *
 * Auto-save flow:
 *   User types → attachFieldListeners debounces → saveCurrentPrompt() →
 *   savePromptsToLocalStorage() + renderPromptsList() + regenerateOutput()
 *
 * Note on window.*: this file reads/writes state via window.* (e.g.
 * window.inputCounter) because it was written independently of state.js.
 * syncWindowState() in state.js keeps both in sync.
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
 * @param {number} id - The ID of the prompt to edit.
 */
function editPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) {
        console.error('Prompt not found for editing:', id);
        return;
    }

    window.currentPromptId = id;

    // Clear all dynamic field containers before repopulating.
    document.getElementById('inputs-container').innerHTML = '';
    document.getElementById('constraints-container').innerHTML = '';
    document.getElementById('outputs-container').innerHTML = '';
    document.getElementById('success-container').innerHTML = '';

    // Reset counters so new field IDs start from 1.
    window.inputCounter = 0;
    window.constraintCounter = 0;
    window.outputCounter = 0;
    window.successCounter = 0;

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

    // Defer listener attachment so all DOM insertions above are complete first.
    setTimeout(attachFieldListeners, 0);
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
 */
window.addInput = function (name = '', description = '', placeholder = '') {
    window.inputCounter++;
    const container = document.getElementById('inputs-container');
    const id = window.inputCounter;
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
    nameInput.addEventListener('input', regenerateOutput);
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
    descInput.addEventListener('input', regenerateOutput);
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
    placeholderInput.addEventListener('input', regenerateOutput);
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
    attachFieldListeners();
};

/**
 * Shared builder for single-textarea field cards (constraints and success criteria
 * have identical DOM structure, differing only in labels and IDs).
 * @param {Object} opts
 * @param {string} opts.counterKey    - window property name for this field's counter.
 * @param {string} opts.containerId   - ID of the container element.
 * @param {string} opts.itemClass     - CSS class added to the card div.
 * @param {string} opts.itemPrefix    - Prefix used for element IDs (e.g. 'constraint').
 * @param {string} opts.placeholder   - Textarea placeholder text.
 * @param {string} opts.deleteLabel   - Accessible label for the delete button.
 * @param {string} opts.value         - Pre-fill value for the textarea.
 */
function addTextareaField({ counterKey, containerId, itemClass, itemPrefix, placeholder, deleteLabel, value }) {
    window[counterKey]++;
    const id = window[counterKey];
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
    textarea.addEventListener('input', regenerateOutput);
    div.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', deleteLabel);
    removeBtn.innerHTML = DELETE_BTN_SVG;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    attachFieldListeners();
}

/** Appends a new constraint card. @param {string} [text=''] Pre-fill value. */
window.addConstraint = function (text = '') {
    addTextareaField({
        counterKey: 'constraintCounter',
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
        counterKey: 'successCounter',
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
    window.outputCounter++;
    const container = document.getElementById('outputs-container');
    const id = window.outputCounter;
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
    nameInput.addEventListener('input', regenerateOutput);
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
    typeInput.addEventListener('input', regenerateOutput);
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
    descInput.addEventListener('input', regenerateOutput);
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
    attachFieldListeners();
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
 * object in window.prompts, then persists to localStorage.
 *
 * Uses window.inputCounter (and other counters) to iterate field IDs rather
 * than querySelectorAll, because fields may have been deleted and their
 * elements removed from the DOM — the counter tells us the highest ID ever
 * issued, and we skip any that are missing.
 */
function saveCurrentPrompt() {
    if (window.currentPromptId == null || !window.prompts) return;
    const idx = window.prompts.findIndex(p => p.id === window.currentPromptId);
    if (idx === -1) return;

    const prompt = window.prompts[idx];
    prompt.name        = document.getElementById('prompt-name')?.value || '';
    prompt.description = document.getElementById('prompt-desc')?.value || '';
    prompt.objective   = document.getElementById('objective')?.value || '';
    prompt.actor       = document.getElementById('actor')?.value || '';
    prompt.context     = document.getElementById('context')?.value || '';

    prompt.example = document.getElementById('prompt-example')?.value || '';
    prompt.inputs = [];
    for (let i = 1; i <= window.inputCounter; i++) {
        const name = document.getElementById(`input-name-${i}`);
        const desc = document.getElementById(`input-desc-${i}`);
        const ph = document.getElementById(`input-placeholder-${i}`);
        if (name && name.value.trim()) {
            prompt.inputs.push({ name: name.value, description: desc ? desc.value : '', placeholder: ph ? ph.value : '' });
        }
    }
    prompt.constraints = [];
    for (let i = 1; i <= window.constraintCounter; i++) {
        const text = document.getElementById(`constraint-text-${i}`);
        if (text && text.value.trim()) prompt.constraints.push(text.value);
    }
    prompt.outputs = [];
    for (let i = 1; i <= window.outputCounter; i++) {
        const name = document.getElementById(`output-name-${i}`);
        const type = document.getElementById(`output-type-${i}`);
        const desc = document.getElementById(`output-desc-${i}`);
        if (name && name.value.trim()) {
            prompt.outputs.push({ name: name.value, type: type ? type.value : '', description: desc ? desc.value : '' });
        }
    }
    prompt.success = [];
    for (let i = 1; i <= window.successCounter; i++) {
        const text = document.getElementById(`success-text-${i}`);
        if (text && text.value.trim()) prompt.success.push(text.value);
    }

    if (typeof window.savePromptsToLocalStorage === 'function') window.savePromptsToLocalStorage();
    if (typeof window.renderPromptsList === 'function') window.renderPromptsList();
    if (typeof regenerateOutput === 'function') regenerateOutput();
    showSaveIndicator();
}

/**
 * Attaches the debounced save handler to every input and textarea in the edit
 * screen. Called after each dynamic field is added so new fields are covered.
 * Removes the previous handler before re-adding to avoid duplicate listeners
 * accumulating across multiple calls.
 */
function attachFieldListeners() {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen) return;
    editScreen.querySelectorAll('input, textarea').forEach(field => {
        field.removeEventListener('input', field._debouncedSave || (() => {}));
        field._debouncedSave = () => debouncedSaveCurrentPrompt();
        field.addEventListener('input', field._debouncedSave);
    });
}
