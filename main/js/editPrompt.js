/**
 * @fileoverview Prompts Editor
 * @suppress {checkTypes}
 */


/**
 * Loads a prompt into the edit form.
 * @param {number} id - The prompt id to edit.
 */
function editPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) {
        console.error('Prompt not found for editing:', id);
        return;
    }

    window.currentPromptId = id;

    // Clear the form first
    document.getElementById('inputs-container').innerHTML = '';
    document.getElementById('constraints-container').innerHTML = '';
    document.getElementById('outputs-container').innerHTML = '';
    document.getElementById('success-container').innerHTML = '';

    window.inputCounter = 0;
    window.constraintCounter = 0;
    window.outputCounter = 0;
    window.successCounter = 0;

    // Load the prompt data into edit form
    document.getElementById('prompt-name').value = prompt.name;
    var descElem = document.getElementById('prompt-desc');
    descElem.value = prompt.description;
    // Change to textarea if not already
    if (descElem.tagName.toLowerCase() !== 'textarea') {
        var newElem = document.createElement('textarea');
        newElem.id = 'prompt-desc';
        newElem.placeholder = descElem.placeholder;
        newElem.setAttribute('aria-required', 'true');
        newElem.value = descElem.value;
        newElem.setAttribute('rows', '3');
        newElem.style.width = '100%';
        newElem.style.boxSizing = 'border-box';
        newElem.style.display = 'block';
        newElem.style.margin = '0';
        newElem.style.textAlign = 'left';
        descElem.parentNode.replaceChild(newElem, descElem);
        descElem = newElem;
    } else {
        descElem.className = '';
        descElem.removeAttribute('style');
        descElem.setAttribute('rows', '3');
        descElem.style.width = '100%';
        descElem.style.boxSizing = 'border-box';
        descElem.style.display = 'block';
        descElem.style.margin = '0';
        descElem.style.textAlign = 'left';
    }
    document.getElementById('objective').value = prompt.objective;
    document.getElementById('actor').value = prompt.actor;
    document.getElementById('context').value = prompt.context;

    // Clear outputs container before loading
    document.getElementById('outputs-container').innerHTML = '';
    window.outputCounter = 0;

    // Load only this prompt's data
    prompt.inputs.forEach(i => addInput(i.name, i.description));
    prompt.constraints.forEach(c => addConstraint(c));
    prompt.outputs.forEach(o => addOutput(o.name, o.type, o.description));
    prompt.success.forEach(s => addSuccess(s));

    window.showEdit();
    window.setTabActive('Edit');
}
window.editPrompt = editPrompt;

// =========================
// Dynamic Field Management
// =========================
/**
 * Adds a new input field to the edit form.
 * @param {string} [name=''] - Field name.
 * @param {string} [description=''] - Field description.
 */
window.addInput = function (name = '', description = '') {
    window.inputCounter++;
    const container = document.getElementById('inputs-container');
    const id = window.inputCounter;
    const div = document.createElement('div');
    div.className = 'edit-card input-item';
    div.id = `input-item-${id}`;
    div.draggable = true;

    // Card content
    const content = document.createElement('div');
    content.className = 'edit-card-content';
    content.style.flexDirection = 'column';
    content.style.gap = '6px';

    // Name label and input
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

    // Description label and textarea
    const descLabel = document.createElement('label');
    descLabel.setAttribute('for', `input-desc-${id}`);
    descLabel.textContent = 'Description';
    descLabel.className = 'edit-card-label';
    const descInput = document.createElement('textarea');
    descInput.id = `input-desc-${id}`;
    descInput.placeholder = 'Description (optional)';
    descInput.value = description;
    descInput.setAttribute('aria-label', 'Input description');
    descInput.addEventListener('input', regenerateOutput);
    descInput.className = 'large-textarea';
    content.appendChild(descLabel);
    content.appendChild(descInput);

    div.appendChild(content);

    // Trashcan delete button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete input');
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>`;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    window.makeInputsSortable();
};

/**
 * Adds a new constraint field.
 * @param {string} [text=''] - Constraint text.
 */
window.addConstraint = function(text = '') {
    window.constraintCounter++;
    const container = document.getElementById('constraints-container');
    const id = window.constraintCounter;
    const div = document.createElement('div');
    div.className = 'edit-card constraint-item';
    div.id = `constraint-item-${id}`;
    div.style.alignItems = 'center';

    // Remove label for constraint
    // const label = document.createElement('label');
    // label.setAttribute('for', `constraint-text-${id}`);
    // label.textContent = 'Constraint';
    // label.className = 'edit-card-label';
    // label.style.marginRight = '8px';
    // div.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.id = `constraint-text-${id}`;
    textarea.placeholder = 'Constraint';
    textarea.value = text;
    textarea.setAttribute('aria-label', 'Constraint');
    textarea.style.minHeight = '140px';
    textarea.style.maxHeight = '320px';
    textarea.style.fontSize = '1.12em';
    textarea.style.padding = '16px 14px';
    textarea.addEventListener('input', regenerateOutput);
    div.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete constraint');
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>`;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
};

/**
 * Adds a new output field.
 * @param {string} [name=''] - Output name.
 * @param {string} [type='string'] - Output type.
 * @param {string} [description=''] - Output description.
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
    content.style.flexDirection = 'column';
    content.style.gap = '6px';

    // Name label and input
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

    // Type label and input
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

    // Description label and textarea
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
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>`;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    window.makeOutputsSortable();
};

/**
 * Adds a new success criterion field.
 * @param {string} [text=''] - Success criterion.
 */
window.addSuccess = function(text = '') {
    window.successCounter++;
    const container = document.getElementById('success-container');
    const id = window.successCounter;
    const div = document.createElement('div');
    div.className = 'edit-card success-item';
    div.id = `success-item-${id}`;
    div.style.alignItems = 'center';

    // Remove label for success
    // const label = document.createElement('label');
    // label.setAttribute('for', `success-text-${id}`);
    // label.textContent = 'Success Criterion';
    // label.className = 'edit-card-label';
    // label.style.marginRight = '8px';
    // div.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.id = `success-text-${id}`;
    textarea.placeholder = 'Success criterion';
    textarea.value = text;
    textarea.setAttribute('aria-label', 'Success criterion');
    textarea.style.minHeight = '140px';
    textarea.style.maxHeight = '320px';
    textarea.style.fontSize = '1.12em';
    textarea.style.padding = '16px 14px';
    textarea.addEventListener('input', regenerateOutput);
    div.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete success criterion');
    removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>`;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
};

function renderInputField(id, name = '', desc = '') {
    return `
    <div class="edit-card input-item" draggable="true" id="input-item-${id}">
        <div class="edit-card-content">
            <input type="text" id="input-name-${id}" placeholder="Input name" value="${name}" aria-label="Input name">
            <textarea id="input-desc-${id}" placeholder="Description (optional)" aria-label="Input description">${desc}</textarea>
        </div>
        <button type="button" class="delete-btn" aria-label="Delete input" onclick="removeElement('input-item-${id}')">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>
        </button>
    </div>`;
}

function renderConstraintField(id, value = '') {
    return `
    <div class="edit-card constraint-item" id="constraint-item-${id}">
        <textarea id="constraint-text-${id}" placeholder="Constraint" aria-label="Constraint">${value}</textarea>
        <button type="button" class="delete-btn" aria-label="Delete constraint" onclick="removeElement('constraint-item-${id}')">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>
        </button>
    </div>`;
}

function renderOutputField(id, name = '', type = '', desc = '') {
    return `
    <div class="edit-card output-item" draggable="true" id="output-item-${id}">
        <div class="edit-card-content">
            <input type="text" id="output-name-${id}" placeholder="Output name" value="${name}" aria-label="Output name">
            <input type="text" id="output-type-${id}" placeholder="Type (e.g. string)" value="${type}" aria-label="Output type">
            <textarea id="output-desc-${id}" placeholder="Description (optional)" aria-label="Output description">${desc}</textarea>
        </div>
        <button type="button" class="delete-btn" aria-label="Delete output" onclick="removeElement('output-item-${id}')">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>
        </button>
    </div>`;
}

function renderSuccessField(id, value = '') {
    return `
    <div class="edit-card success-item" id="success-item-${id}">
        <textarea id="success-text-${id}" placeholder="Success criterion" aria-label="Success criterion">${value}</textarea>
        <button type="button" class="delete-btn" aria-label="Delete success criterion" onclick="removeElement('success-item-${id}')">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>
        </button>
    </div>`;
}

// Debounce utility
function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Debounced save
const debouncedSaveCurrentPrompt = debounce(saveCurrentPrompt, 200);

// Remove any local prompts array, always use window.prompts
// Remove savePrompts usage, always use window.savePromptsToLocalStorage
// Add a save indicator
let saveIndicatorTimeout;
function showSaveIndicator() {
    let indicator = document.getElementById('save-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.style.position = 'fixed';
        indicator.style.bottom = '24px';
        indicator.style.right = '32px';
        indicator.style.background = '#2563eb';
        indicator.style.color = '#fff';
        indicator.style.padding = '10px 22px';
        indicator.style.borderRadius = '6px';
        indicator.style.fontWeight = 'bold';
        indicator.style.boxShadow = '0 2px 8px rgba(30,41,59,0.12)';
        indicator.style.zIndex = '9999';
        document.body.appendChild(indicator);
    }
    indicator.textContent = 'All changes saved';
    indicator.style.opacity = '1';
    clearTimeout(saveIndicatorTimeout);
    saveIndicatorTimeout = setTimeout(() => {
        indicator.style.opacity = '0';
    }, 1200);
}

function saveCurrentPrompt() {
    if (window.currentPromptId == null) return;
    if (!window.prompts) return;
    const idx = window.prompts.findIndex(p => p.id === window.currentPromptId);
    if (idx === -1) return;
    // Gather values from the form
    const prompt = window.prompts[idx];
    prompt.name = document.getElementById('prompt-name').value;
    prompt.description = document.getElementById('prompt-desc').value;
    prompt.objective = document.getElementById('objective').value;
    prompt.actor = document.getElementById('actor').value;
    prompt.context = document.getElementById('context').value;
    // Inputs
    prompt.inputs = [];
    for (let i = 1; i <= window.inputCounter; i++) {
        const name = document.getElementById(`input-name-${i}`);
        const desc = document.getElementById(`input-desc-${i}`);
        if (name && name.value.trim()) {
            prompt.inputs.push({ name: name.value, description: desc ? desc.value : '' });
        }
    }
    // Constraints
    prompt.constraints = [];
    for (let i = 1; i <= window.constraintCounter; i++) {
        const text = document.getElementById(`constraint-text-${i}`);
        if (text && text.value.trim()) {
            prompt.constraints.push(text.value);
        }
    }
    // Outputs
    prompt.outputs = [];
    for (let i = 1; i <= window.outputCounter; i++) {
        const name = document.getElementById(`output-name-${i}`);
        const type = document.getElementById(`output-type-${i}`);
        const desc = document.getElementById(`output-desc-${i}`);
        if (name && name.value.trim()) {
            prompt.outputs.push({ name: name.value, type: type ? type.value : '', description: desc ? desc.value : '' });
        }
    }
    // Success
    prompt.success = [];
    for (let i = 1; i <= window.successCounter; i++) {
        const text = document.getElementById(`success-text-${i}`);
        if (text && text.value.trim()) {
            prompt.success.push(text.value);
        }
    }
    if (typeof window.savePromptsToLocalStorage === 'function') {
        window.savePromptsToLocalStorage();
    }
    if (typeof window.renderPromptsList === 'function') {
        window.renderPromptsList();
    } else if (typeof renderPromptsList === 'function') {
        renderPromptsList();
    }
    if (typeof regenerateOutput === 'function') regenerateOutput();
    showSaveIndicator();
}

// Attach debounced save to all input/textarea fields in the edit screen
function attachFieldListeners() {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen) return;
    // Attach to all input and textarea fields
    const fields = editScreen.querySelectorAll('input, textarea');
    fields.forEach(field => {
        // Remove previous listener if any
        field.removeEventListener('input', field._debouncedSaveListenerReal || (() => {}));
        // Attach new debounced save
        field._debouncedSaveListenerReal = function(e) {
            debouncedSaveCurrentPrompt();
        };
        field.addEventListener('input', field._debouncedSaveListenerReal);
    });
}

// Patch dynamic field adders to call attachFieldListeners after adding
const _origAddInput = window.addInput;
window.addInput = function(...args) {
    _origAddInput.apply(this, args);
    attachFieldListeners();
};
const _origAddConstraint = window.addConstraint;
window.addConstraint = function(...args) {
    _origAddConstraint.apply(this, args);
    attachFieldListeners();
};
const _origAddOutput = window.addOutput;
window.addOutput = function(...args) {
    _origAddOutput.apply(this, args);
    attachFieldListeners();
};
const _origAddSuccess = window.addSuccess;
window.addSuccess = function(...args) {
    _origAddSuccess.apply(this, args);
    attachFieldListeners();
};

// Call attachFieldListeners after loading a prompt for editing
const _origEditPrompt = window.editPrompt;
window.editPrompt = function(...args) {
    _origEditPrompt.apply(this, args);
    setTimeout(attachFieldListeners, 0); // Ensure DOM is updated before attaching
};

// Remove the global editScreen input/change listener from attachAutoSave
function attachAutoSave() {
    // No-op: now handled by attachFieldListeners
}

// Call attachAutoSave when edit screen is shown
window.showEdit = function() {
    document.getElementById('edit-screen').style.display = '';
    document.getElementById('view-screen').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('tab-edit').classList.add('active');
    document.getElementById('tab-view').classList.remove('active');
    attachAutoSave();
};
