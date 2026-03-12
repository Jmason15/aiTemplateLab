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

    const div = document.createElement('div');
    const id = `input-${inputCounter}`;
    div.id = id;
    div.className = 'field-group input-item';
    div.draggable = true;

    // drag handle
    const handle = document.createElement('span');
    handle.textContent = '⋮⋮';
    handle.style.cssText = 'cursor: grab; padding: 0.4rem 0.5rem; color: var(--color-text-muted); align-self: center;';

    // name
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `input-name-${inputCounter}`;
    nameInput.placeholder = 'e.g., topic';
    nameInput.value = name;
    nameInput.addEventListener('input', regenerateOutput);

    const nameDiv = document.createElement('div');
    nameDiv.style.flex = '1';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Field Name';
    nameDiv.appendChild(nameLabel);
    nameDiv.appendChild(nameInput);

    // description
    const descInput = document.createElement('textarea');
    descInput.id = `input-desc-${inputCounter}`;
    descInput.placeholder = 'What this field means';
    descInput.value = description;
    descInput.addEventListener('input', regenerateOutput);

    const descDiv = document.createElement('div');
    descDiv.style.flex = '1';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Description';
    descDiv.appendChild(descLabel);
    descDiv.appendChild(descInput);

    // remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger btn-small';
    removeBtn.style.cssText = 'align-self: flex-end; margin-bottom: 1rem;';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeElement(id));

    // assemble
    div.style.display = 'flex';
    div.style.gap = '0.5rem';
    div.appendChild(handle);
    div.appendChild(nameDiv);
    div.appendChild(descDiv);
    div.appendChild(removeBtn);

    container.appendChild(div);

    window.makeInputsSortable(); // attach drag events
};

/**
 * Adds a new constraint field.
 * @param {string} [text=''] - Constraint text.
 */
window.addConstraint = function(text = '') {
    window.constraintCounter++;
    const container = document.getElementById('constraints-container');
    const div = document.createElement('div');
    div.className = 'list-item';
    div.id = `constraint-${constraintCounter}`;

    const textarea = document.createElement('textarea');
    textarea.id = `constraint-text-${constraintCounter}`;
    textarea.placeholder = 'Enter constraint...';
    textarea.value = text;
    textarea.addEventListener('input', regenerateOutput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger btn-small';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeElement(div.id));

    div.appendChild(textarea);
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

    const div = document.createElement('div');
    const id = `output-${window.outputCounter}`;
    div.id = id;
    div.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem;';
    div.classList.add('output-item');
    div.draggable = true;

    // drag handle
    const handle = document.createElement('span');
    handle.textContent = '⋮⋮';
    handle.style.cssText = 'cursor: grab; padding: 0.4rem 0.5rem; color: var(--color-text-muted);';

    // existing inputs...
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `output-name-${window.outputCounter}`;
    nameInput.placeholder = 'e.g., title';
    nameInput.value = name;
    nameInput.addEventListener('input', regenerateOutput);

    const typeInput = document.createElement('input');
    typeInput.type = 'text';
    typeInput.id = `output-type-${window.outputCounter}`;
    typeInput.placeholder = 'string';
    typeInput.value = type;
    typeInput.addEventListener('input', regenerateOutput);

    const descInput = document.createElement('textarea');
    descInput.id = `output-desc-${window.outputCounter}`;
    descInput.placeholder = 'What this property represents';
    descInput.value = description;
    descInput.addEventListener('input', regenerateOutput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger btn-small';
    removeBtn.style.cssText = 'align-self: flex-end; margin-bottom: 0.5rem;';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeElement(id));

    // wrappers (same structure you already use)
    const nameDiv = document.createElement('div');
    nameDiv.style.flex = '1';
    const nameLabel = document.createElement('label');
    nameLabel.style.marginBottom = '0.25rem';
    nameLabel.textContent = 'Property Name';
    nameDiv.appendChild(nameLabel);
    nameDiv.appendChild(nameInput);

    const typeDiv = document.createElement('div');
    typeDiv.style.flex = '0.5';
    const typeLabel = document.createElement('label');
    typeLabel.style.marginBottom = '0.25rem';
    typeLabel.textContent = 'Type';
    typeDiv.appendChild(typeLabel);
    typeDiv.appendChild(typeInput);

    const descDiv = document.createElement('div');
    descDiv.style.flex = '1';
    const descLabel = document.createElement('label');
    descLabel.style.marginBottom = '0.25rem';
    descLabel.textContent = 'Example';
    descDiv.appendChild(descLabel);
    descDiv.appendChild(descInput);

    // assemble
    div.appendChild(handle);
    div.appendChild(nameDiv);
    div.appendChild(typeDiv);
    div.appendChild(descDiv);
    div.appendChild(removeBtn);

    container.appendChild(div);

    // attach drag events
    window.makeOutputsSortable();
};

/**
 * Adds a new success criterion field.
 * @param {string} [text=''] - Success criterion.
 */
window.addSuccess = function(text = '') {
    window.successCounter++;
    const container = document.getElementById('success-container');
    const div = document.createElement('div');
    div.className = 'list-item';
    div.id = `success-${successCounter}`;

    const textarea = document.createElement('textarea');
    textarea.id = `success-text-${successCounter}`;
    textarea.placeholder = 'Enter success criterion...';
    textarea.value = text;
    textarea.addEventListener('input', regenerateOutput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger btn-small';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeElement(div.id));

    div.appendChild(textarea);
    div.appendChild(removeBtn);
    container.appendChild(div);
};