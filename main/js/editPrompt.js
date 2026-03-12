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
    document.getElementById('prompt-desc').value = prompt.description;
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
