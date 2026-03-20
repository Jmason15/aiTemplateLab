/**
 * @fileoverview Prompts Editor — dynamic field management and auto-save
 */

// Shared SVG for delete buttons (avoids repeating the same markup 4 times)
const DELETE_BTN_SVG = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 8V15M10 8V15M14 8V15M3 5H17M8 5V3H12V5" stroke="#b91c1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="12" height="9" rx="2" stroke="#b91c1c" stroke-width="1.5"/></svg>`;

// =========================
// Edit Form Population
// =========================
function editPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) {
        console.error('Prompt not found for editing:', id);
        return;
    }

    window.currentPromptId = id;

    document.getElementById('inputs-container').innerHTML = '';
    document.getElementById('constraints-container').innerHTML = '';
    document.getElementById('outputs-container').innerHTML = '';
    document.getElementById('success-container').innerHTML = '';

    window.inputCounter = 0;
    window.constraintCounter = 0;
    window.outputCounter = 0;
    window.successCounter = 0;

    document.getElementById('prompt-name').value = prompt.name;
    document.getElementById('prompt-desc').value = prompt.description;
    document.getElementById('objective').value = prompt.objective;
    document.getElementById('actor').value = prompt.actor;
    document.getElementById('context').value = prompt.context;

    prompt.inputs.forEach(i => addInput(i.name, i.description));
    prompt.constraints.forEach(c => addConstraint(c));
    prompt.outputs.forEach(o => addOutput(o.name, o.type, o.description));
    prompt.success.forEach(s => addSuccess(s));

    window.showEdit();
    window.setTabActive('Edit Template');

    setTimeout(attachFieldListeners, 0);
}
window.editPrompt = editPrompt;

// =========================
// Dynamic Field Management
// =========================
window.addInput = function (name = '', description = '') {
    window.inputCounter++;
    const container = document.getElementById('inputs-container');
    const id = window.inputCounter;
    const div = document.createElement('div');
    div.className = 'edit-card input-item';
    div.id = `input-item-${id}`;
    div.draggable = true;

    const content = document.createElement('div');
    content.className = 'edit-card-content';
    content.style.flexDirection = 'column';
    content.style.gap = '6px';

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
    descInput.placeholder = 'Description (optional)';
    descInput.value = description;
    descInput.setAttribute('aria-label', 'Input description');
    descInput.addEventListener('input', regenerateOutput);
    descInput.className = 'large-textarea';
    content.appendChild(descLabel);
    content.appendChild(descInput);

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

window.addConstraint = function (text = '') {
    window.constraintCounter++;
    const container = document.getElementById('constraints-container');
    const id = window.constraintCounter;
    const div = document.createElement('div');
    div.className = 'edit-card constraint-item';
    div.id = `constraint-item-${id}`;
    div.style.alignItems = 'center';

    const textarea = document.createElement('textarea');
    textarea.id = `constraint-text-${id}`;
    textarea.placeholder = 'Constraint';
    textarea.value = text;
    textarea.setAttribute('aria-label', 'Constraint');
    textarea.className = 'constraint-textarea';
    textarea.addEventListener('input', regenerateOutput);
    div.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete constraint');
    removeBtn.innerHTML = DELETE_BTN_SVG;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    attachFieldListeners();
};

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

window.addSuccess = function (text = '') {
    window.successCounter++;
    const container = document.getElementById('success-container');
    const id = window.successCounter;
    const div = document.createElement('div');
    div.className = 'edit-card success-item';
    div.id = `success-item-${id}`;
    div.style.alignItems = 'center';

    const textarea = document.createElement('textarea');
    textarea.id = `success-text-${id}`;
    textarea.placeholder = 'Success criterion';
    textarea.value = text;
    textarea.setAttribute('aria-label', 'Success criterion');
    textarea.className = 'constraint-textarea';
    textarea.addEventListener('input', regenerateOutput);
    div.appendChild(textarea);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'delete-btn';
    removeBtn.setAttribute('aria-label', 'Delete success criterion');
    removeBtn.innerHTML = DELETE_BTN_SVG;
    removeBtn.onclick = () => removeElement(div.id);
    div.appendChild(removeBtn);

    container.appendChild(div);
    attachFieldListeners();
};

// =========================
// Auto-save
// =========================
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

const debouncedSaveCurrentPrompt = debounce(saveCurrentPrompt, 200);

let saveIndicatorTimeout;
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

function saveCurrentPrompt() {
    if (window.currentPromptId == null || !window.prompts) return;
    const idx = window.prompts.findIndex(p => p.id === window.currentPromptId);
    if (idx === -1) return;

    const prompt = window.prompts[idx];
    prompt.name = document.getElementById('prompt-name')?.value || '';
    prompt.description = document.getElementById('prompt-desc')?.value || '';
    prompt.objective = document.getElementById('objective')?.value || '';
    prompt.actor = document.getElementById('actor')?.value || '';
    prompt.context = document.getElementById('context')?.value || '';

    prompt.inputs = [];
    for (let i = 1; i <= window.inputCounter; i++) {
        const name = document.getElementById(`input-name-${i}`);
        const desc = document.getElementById(`input-desc-${i}`);
        if (name && name.value.trim()) {
            prompt.inputs.push({ name: name.value, description: desc ? desc.value : '' });
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

function attachFieldListeners() {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen) return;
    editScreen.querySelectorAll('input, textarea').forEach(field => {
        field.removeEventListener('input', field._debouncedSave || (() => {}));
        field._debouncedSave = () => debouncedSaveCurrentPrompt();
        field.addEventListener('input', field._debouncedSave);
    });
}
