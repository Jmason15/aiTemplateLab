// main/js/newApp.js

/**
 * Prompt Management App
 * Handles CRUD, UI, drag-and-drop, import/export, and modal logic for prompts.
 */

// =========================
// State Variables
// =========================
let prompts = [...window.preloadedPrompts];

let currentPromptId = null;
let isCreatingNewPrompt = false;
let inputCounter = 0;
let constraintCounter = 0;
let outputCounter = 0;
let successCounter = 0;

// Ensure these are initialized on window for global access
window.prompts = prompts;
window.currentPromptId = currentPromptId;
window.inputCounter = inputCounter;
window.constraintCounter = constraintCounter;
window.outputCounter = outputCounter;
window.successCounter = successCounter;

// =========================
// Initialization
// =========================
/**
 * Initializes the application, sets up event listeners, and renders the initial UI.
 */
function initApp() {
    // setupCollapsibleSection();
    init();
    setupTabListeners();
}

/**
 * Sets up the collapsible section for prompt toggling.
 */
function setupCollapsibleSection() {
    const btn = document.getElementById('togglePrompt');
    const section = document.getElementById('myCollapsibleSection');
    if (btn && section) {
        btn.addEventListener('click', () => {
            const isOpen = section.classList.toggle('show');
            btn.setAttribute('aria-expanded', isOpen);
        });
    }
}

/**
 * Loads prompts, renders the list, and shows the first prompt or welcome screen.
 */
function init() {
    window.loadPromptsFromLocalStorage();
    prompts = prompts.map(normalizePrompt);
    renderPromptsList();
    if (prompts.length > 0) {
        viewPrompt(prompts[0].id);
    } else {
        showWelcome();
    }
}

// =========================
// Prompt CRUD
// =========================
/**
 * Creates a new prompt and switches to edit mode.
 */
window.newPrompt = function () {
    // Create a new prompt object with a unique id and empty fields
    const newId = Date.now();
    const newPrompt = {
        id: newId,
        name: '',
        description: '',
        objective: '',
        actor: '',
        context: '',
        inputs: [],
        constraints: [],
        outputs: [],
        success: []
    };
    prompts.push(newPrompt);
    window.savePromptsToLocalStorage();
    currentPromptId = newId;
    isCreatingNewPrompt = false;
    editPrompt(newId);
    setTabActive('Edit');
    renderPromptsList();
};

/**
 * Deletes a prompt by id after confirmation.
 * @param {number} id - The prompt id to delete.
 */
function deletePrompt(id) {
    prompts = prompts.filter(p => p.id !== id);
    window.savePromptsToLocalStorage();
    renderPromptsList();

    // If there are prompts left, select the first one
    if (prompts.length > 0) {
        currentPromptId = prompts[0].id;
        viewPrompt(currentPromptId);
    } else {
        currentPromptId = null;
        showWelcome();
    }
}

/**
 * Saves the current prompt from the edit form.
 */
function savePrompt() {
    const name = document.getElementById('prompt-name').value.trim();
    const description = document.getElementById('prompt-desc').value.trim();

    const inputs = [];
    document.querySelectorAll('[id^="input-name-"]').forEach((el, i) => {
        const name = el.value.trim();
        const desc = document.getElementById(`input-desc-${el.id.split('-')[2]}`).value.trim();
        if (name) {
            inputs.push({ name, description: desc });
        }
    });

    const constraints = [];
    document.querySelectorAll('[id^="constraint-text-"]').forEach(el => {
        if (el.value.trim()) {
            constraints.push(el.value.trim());
        }
    });

    const outputs = [];
    document.querySelectorAll('[id^="output-name-"]').forEach((el, i) => {
        const name = el.value.trim();
        const type = document.getElementById(`output-type-${el.id.split('-')[2]}`).value.trim();
        const desc = document.getElementById(`output-desc-${el.id.split('-')[2]}`).value.trim();
        if (name) {
            outputs.push({ name, type: type || 'string', description: desc });
        }
    });

    const success = [];
    document.querySelectorAll('[id^="success-text-"]').forEach(el => {
        if (el.value.trim()) {
            success.push(el.value.trim());
        }
    });

    const promptData = {
        id: currentPromptId || Date.now(),
        name,
        description,
        objective: document.getElementById('objective').value,
        actor: document.getElementById('actor').value,
        context: document.getElementById('context').value,
        inputs,
        constraints,
        outputs,
        success
    };

    if (currentPromptId) {
        const index = prompts.findIndex(p => p.id === currentPromptId);
        prompts[index] = promptData;
    } else {
        prompts.push(promptData);
        currentPromptId = promptData.id;
    }
    isCreatingNewPrompt = false;
    window.savePromptsToLocalStorage();
    renderPromptsList();
    // alert('Prompt saved successfully!');

    // // Switch to view mode after saving
    // viewPrompt(currentPromptId);
}
window.savePrompt = savePrompt;

// =========================
// UI Rendering
// =========================
/**
 * Renders the list of prompts in the sidebar.
 */
function renderPromptsList() {
    const container = document.getElementById('prompts-list');
    if (!container) return;
    if (prompts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No Prompts Yet</h3>
                <p>Create your first prompt to get started</p>
            </div>
        `;
        return;
    }
    container.innerHTML = prompts.map((p, idx) => `
        <div class="prompt-tile${currentPromptId === p.id ? ' selected' : ''}" data-id="${p.id}" draggable="true" data-index="${idx}">
            ${window.escapeHtml(p.name)}
        </div>
    `).join('');
    // Add event listeners for tile selection
    container.querySelectorAll('.prompt-tile').forEach(item => {
        const id = parseInt(item.getAttribute('data-id'));
        item.addEventListener('click', () => {
            viewPrompt(id);
        });
    });
    // Drag-and-drop reordering
    let draggedIdx = null;
    container.querySelectorAll('.prompt-tile').forEach(item => {
        item.addEventListener('dragstart', e => {
            draggedIdx = parseInt(item.getAttribute('data-index'));
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedIdx = null;
        });
        item.addEventListener('dragover', e => {
            e.preventDefault();
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', e => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const targetIdx = parseInt(item.getAttribute('data-index'));
            if (draggedIdx !== null && draggedIdx !== targetIdx) {
                const moved = prompts.splice(draggedIdx, 1)[0];
                prompts.splice(targetIdx, 0, moved);
                window.savePromptsToLocalStorage();
                renderPromptsList();
            }
        });
    });
}
window.renderPromptsList = renderPromptsList;

/**
 * Clears the edit form fields and containers.
 */
function clearForm() {
    // Clear all fields
    document.getElementById('prompt-name').value = '';
    document.getElementById('prompt-desc').value = '';
    document.getElementById('objective').value = '';
    document.getElementById('actor').value = '';
    document.getElementById('context').value = '';

    // Clear all dynamic containers
    document.getElementById('inputs-container').innerHTML = '';
    document.getElementById('constraints-container').innerHTML = '';
    document.getElementById('outputs-container').innerHTML = '';
    document.getElementById('success-container').innerHTML = '';

    // Reset counters
    inputCounter = 0;
    constraintCounter = 0;
    outputCounter = 0;
    successCounter = 0;
}

/**
 * Shows the prompt in view mode.
 * @param {number} id - The prompt id to view.
 */
function viewPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;

    currentPromptId = id;
    showView();
    setTabActive('Use Template');

    // Switch tab to View Prompt
    const tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(btn => {
        if (btn.textContent.includes('View')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('view-name').textContent = prompt.name;
    document.getElementById('view-desc').textContent = prompt.description;
    // Add meta info (objective, actor, context)
    const meta = [];
    if (prompt.objective) meta.push(`<div><strong>Objective:</strong> ${window.escapeHtml(prompt.objective)}</div>`);
    if (prompt.actor) meta.push(`<div><strong>Actor:</strong> ${window.escapeHtml(prompt.actor)}</div>`);
    if (prompt.context) meta.push(`<div><strong>Context:</strong> ${window.escapeHtml(prompt.context)}</div>`);
    document.getElementById('view-meta').innerHTML = meta.join('');

    const inputsContainer = document.getElementById('view-inputs');
    if (prompt.inputs.length === 0) {
        inputsContainer.innerHTML = '<p class="section-desc">No input fields defined</p>';
    } else {
        inputsContainer.innerHTML = prompt.inputs.map((i, idx) => `
            <div style="margin-bottom: 1rem;">
                <label for="input-value-${idx}">${window.escapeHtml(i.name)}:</label>
                  <textarea
                    id="input-value-${idx}"
                    class="view-textarea"
                    rows="6"
                    placeholder="${window.escapeHtml(i.description)}"
                    oninput="generateViewPrompt()"
                ></textarea>
            </div>
        `).join('');
    }

    generateViewPrompt();
    renderPromptsList();
}



/**
 * Removes a dynamic field by id.
 * @param {string} id - Element id to remove.
 */
function removeElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
        regenerateOutput();
    }
}

// =========================
// Drag-and-Drop Sorting
// =========================
/**
 * Makes input fields sortable via drag-and-drop.
 */
function makeInputsSortable() {
    const container = document.getElementById('inputs-container');
    let dragged = null;

    container.querySelectorAll('.input-item').forEach(item => {
        item.addEventListener('dragstart', e => {
            dragged = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            if (dragged) {
                dragged.classList.remove('dragging');
                dragged = null;
                regenerateOutput(); // update JSON order
            }
        });

        item.addEventListener('dragover', e => {
            e.preventDefault();
            if (!dragged || dragged === item) return;

            const rect = item.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            if (before) {
                container.insertBefore(dragged, item);
            } else {
                container.insertBefore(dragged, item.nextSibling);
            }
        });
    });
}

window.makeInputsSortable = makeOutputsSortable;

/**
 * Makes output fields sortable via drag-and-drop.
 */
function makeOutputsSortable() {
    const container = document.getElementById('outputs-container');
    let dragged = null;

    container.querySelectorAll('.output-item').forEach(item => {
        item.addEventListener('dragstart', e => {
            dragged = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            if (dragged) {
                dragged.classList.remove('dragging');
                dragged = null;
                regenerateOutput(); // update JSON order
            }
        });

        item.addEventListener('dragover', e => {
            e.preventDefault();
            if (!dragged || dragged === item) return;

            const rect = item.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            if (before) {
                container.insertBefore(dragged, item);
            } else {
                container.insertBefore(dragged, item.nextSibling);
            }
        });
    });
}

// =========================
// Prompt Output Generation
// =========================
/**
 * Generates the prompt JSON for the view screen.
 */
function generateViewPrompt() {
    const prompt = prompts.find(p => p.id === currentPromptId);
    if (!prompt) return;

    const inputs = {};
    prompt.inputs.forEach((i, idx) => {
        const inputField = document.getElementById(`input-value-${idx}`);
        inputs[i.name] = inputField ? inputField.value : '';
    });

    const outputProperties = {};
    const requiredFields = [];

    prompt.outputs.forEach(o => {
        outputProperties[o.name] = {
            type: o.type,
            description: o.description || undefined
        };
        requiredFields.push(o.name);
    });

    const promptJson = {};

    if (prompt.objective) promptJson.objective = prompt.objective;
    if (prompt.actor) promptJson.actor = prompt.actor;
    if (prompt.context) promptJson.context = prompt.context;
    if (Object.keys(inputs).length > 0) promptJson.input = inputs;
    if (prompt.constraints.length > 0) promptJson.constraints = prompt.constraints;

    promptJson.output_schema = {
        type: 'object',
        properties: outputProperties,
        required: requiredFields
    };

    if (prompt.success.length > 0) promptJson.success_criteria = prompt.success;
    const outputExample = Object.keys(outputProperties).join(', ');
    if (outputExample) {
        promptJson.output_instructions = `Return only the output exactly as specified by the properties: ${outputExample}. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array`;
    } else {
        promptJson.output_instructions = 'Return only the output exactly as specified by the defined properties. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array';
    }

    document.getElementById('view-output-json').textContent = JSON.stringify(promptJson, null, 2);
}

/**
 * Regenerates the output JSON in the edit screen.
 */
window.regenerateOutput = function () {
    // Check if we're in edit screen
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen.classList.contains('active')) {
        return;
    }

    const objective = document.getElementById('objective').value;
    const actor = document.getElementById('actor').value;
    const context = document.getElementById('context').value;

    const inputs = {};
    document.querySelectorAll('[id^="input-name-"]').forEach(el => {
        const name = el.value.trim();
        const desc = document.getElementById(`input-desc-${el.id.split('-')[2]}`).value.trim();
        if (name) {
            inputs[name] = desc || '';
        }
    });

    const constraints = [];
    document.querySelectorAll('[id^="constraint-text-"]').forEach(el => {
        if (el.value.trim()) constraints.push(el.value.trim());
    });

    const success = [];
    document.querySelectorAll('[id^="success-text-"]').forEach(el => {
        if (el.value.trim()) success.push(el.value.trim());
    });

    const outputs = {};
    const requiredFields = [];
    document.querySelectorAll('[id^="output-name-"]').forEach(el => {
        const name = el.value.trim();
        const type = document.getElementById(`output-type-${el.id.split('-')[2]}`).value.trim();
        const desc = document.getElementById(`output-desc-${el.id.split('-')[2]}`).value.trim();
        if (name) {
            outputs[name] = {
                type: type || 'string',
                description: desc || undefined
            };
            requiredFields.push(name);
        }
    });

    const prompt = {};

    if (objective) prompt.objective = objective;
    if (actor) prompt.actor = actor;
    if (context) prompt.context = context;
    if (Object.keys(inputs).length > 0) prompt.input = inputs;
    if (constraints.length > 0) prompt.constraints = constraints;

    prompt.output_schema = {
        type: 'object',
        properties: outputs,
        required: requiredFields
    };

    if (success.length > 0) prompt.success_criteria = success;
    const outputExample = Object.keys(outputs).join(', '); // e.g. "USER STORY, ACCEPTANCE CRITERIA, DESCRIPTION"

    prompt.output_instructions = `Return only the output exactly as specified by the properties: ${outputExample}. Do not include any extra prose, comments, or code fences.`;

    const outputElement = document.getElementById('generated-output');
    if (outputElement) {
        outputElement.textContent = JSON.stringify(prompt, null, 2);
    }
    if (document.getElementById('view-screen').classList.contains('active')) {
        generateViewPrompt();
    }
    savePrompt();
};

// =========================
// Tab and Screen Management
// =========================
/**
 * Sets the active tab by name.
 * @param {string|null} tabName - Tab name to activate.
 */
function setTabActive(tabName) {
    // Remove 'active' from all tab buttons
    const tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(btn => btn.classList.remove('active'));
    // Add 'active' to the selected tab
    if (tabName) {
        const selectedBtn = Array.from(tabs).find(btn => btn.textContent.trim() === tabName);
        if (selectedBtn) selectedBtn.classList.add('active');
    }
}

function showView() {
    setTabActive('Use Template');
    // Hide all screens
    document.getElementById('view-screen').style.display = 'block';
    document.getElementById('edit-screen').style.display = 'none';
    document.getElementById('history-screen').style.display = 'none';
    document.getElementById('output-screen').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'none';
    // Set active class
    document.getElementById('view-screen').classList.add('active');
    document.getElementById('edit-screen').classList.remove('active');
    document.getElementById('history-screen').classList.remove('active');
    document.getElementById('output-screen').classList.remove('active');
    document.getElementById('welcome-screen').classList.remove('active');
}

function showEdit() {
    setTabActive('Edit Template');
    document.getElementById('view-screen').style.display = 'none';
    document.getElementById('edit-screen').style.display = 'block';
    document.getElementById('history-screen').style.display = 'none';
    document.getElementById('output-screen').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('view-screen').classList.remove('active');
    document.getElementById('edit-screen').classList.add('active');
    document.getElementById('history-screen').classList.remove('active');
    document.getElementById('output-screen').classList.remove('active');
}

function showHistory() {
    setTabActive('Template History');
    document.getElementById('view-screen').style.display = 'none';
    document.getElementById('edit-screen').style.display = 'none';
    document.getElementById('history-screen').style.display = 'block';
    document.getElementById('output-screen').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('view-screen').classList.remove('active');
    document.getElementById('edit-screen').classList.remove('active');
    document.getElementById('history-screen').classList.add('active');
    document.getElementById('output-screen').classList.remove('active');
    document.getElementById('welcome-screen').classList.remove('active');
    renderHistoryList(currentPromptId);
}

function showPromptOutput() {
    setTabActive('Show Prompt');
    document.getElementById('view-screen').style.display = 'none';
    document.getElementById('edit-screen').style.display = 'none';
    document.getElementById('history-screen').style.display = 'none';
    document.getElementById('output-screen').style.display = 'block';
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('view-screen').classList.remove('active');
    document.getElementById('edit-screen').classList.remove('active');
    document.getElementById('history-screen').classList.remove('active');
    document.getElementById('output-screen').classList.add('active');
    document.getElementById('welcome-screen').classList.remove('active');
}
window.showPromptOutput = showPromptOutput;
window.showView = showView;
window.showEdit = showEdit;
window.showHistory = showHistory;
window.setTabActive = setTabActive;

// =========================
// Import/Export
// =========================
/**
 * Exports all prompts as a JSON file.
 */
window.exportPrompts = function() {
    if (prompts.length === 0) {
        alert('No prompts to export');
        return;
    }

    const dataStr = JSON.stringify(prompts, null, 2);

    // Try normal download first
    try {
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompts-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show fallback option
        setTimeout(() => {
            if (confirm('Download started. If the file did not download, click OK to see the data to copy manually.')) {
                showExportModal(dataStr);
            }
        }, 1000);
    } catch (err) {
        // Fallback: show in modal
        showExportModal(dataStr);
    }
};

/**
 * Shows the export modal with prompt data.
 * @param {string} data - JSON string to show.
 */
function showExportModal(data) {
    const modal = document.getElementById('export-modal');
    const textarea = document.getElementById('export-modal-textarea');
    if (!modal || !textarea) return;
    textarea.value = data;
    modal.style.display = 'flex';
    textarea.select();

    const copyBtn = document.getElementById('export-modal-copy');
    const closeBtn = document.getElementById('export-modal-close');
    if (copyBtn) {
        copyBtn.onclick = function() {
            textarea.select();
            document.execCommand('copy');
        };
    }
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };
    }
    // Optional: close modal when clicking outside
    modal.onclick = function(e) {
        if (e.target === modal) modal.style.display = 'none';
    };
}

/**
 * Opens the file input for importing prompts.
 */
window.importPrompts = function() {
    document.getElementById('import-file').click();
};

/**
 * Handles importing prompts from a file.
 * @param {Event} event - File input change event.
 */
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (prompts.length > 0 && !confirm('This will replace all current prompts. Continue?')) {
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loaded = JSON.parse(e.target.result);
            if (!Array.isArray(loaded)) {
                alert('Invalid format: Expected array of prompts');
                return;
            }
            prompts = loaded;
            window.savePromptsToLocalStorage();
            renderPromptsList();
            showWelcome();
            alert(`Imported ${loaded.length} prompt(s) successfully!`);
        } catch (err) {
            alert('Error parsing JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// =========================
// Modal Logic
// =========================
/**
 * Sets up the new prompt modal and its event handlers.
 */
function setupNewPromptModal() {
    const openBtn = document.getElementById('new-prompt-main');
    const modal = document.getElementById('new-prompt-modal');
    const modalContent = document.getElementById('new-prompt-modal-content');
    const choiceScreen = document.getElementById('new-prompt-choice');
    const jsonScreen = document.getElementById('new-prompt-json-import');
    const blankBtn = document.getElementById('start-blank-prompt');
    const jsonBtn = document.getElementById('start-json-prompt');
    const cancelBtn = document.getElementById('new-prompt-cancel');
    const backBtn = document.getElementById('json-import-back');
    const jsonImportCancel = document.getElementById('json-import-cancel');
    const uploadBtn = document.getElementById('json-import-upload');
    const fileInput = document.getElementById('json-import-file');
    const filenameSpan = document.getElementById('json-import-filename');
    const textarea = document.getElementById('json-import-textarea');
    const errorDiv = document.getElementById('json-import-error');
    const confirmBtn = document.getElementById('json-import-confirm');

    function showModal() {
        modal.style.display = 'flex';
        choiceScreen.style.display = 'block';
        jsonScreen.style.display = 'none';
        setTimeout(() => blankBtn.focus(), 50);
    }
    function closeModal() {
        modal.style.display = 'none';
        if (textarea) textarea.value = '';
        if (fileInput) fileInput.value = '';
        if (filenameSpan) filenameSpan.textContent = '';
        if (errorDiv) errorDiv.textContent = '';
    }
    openBtn.onclick = function(e) {
        e.preventDefault();
        showModal();
    };
    cancelBtn.onclick = closeModal;
    jsonImportCancel.onclick = closeModal;
    modal.onclick = function(e) {
        if (e.target === modal) closeModal();
    };
    modal.onkeydown = function(e) {
        if (e.key === 'Escape') closeModal();
    };
    blankBtn.onclick = function(e) {
        e.preventDefault();
        closeModal();
        window.newPrompt();
    };
    jsonBtn.onclick = function(e) {
        e.preventDefault();
        choiceScreen.style.display = 'none';
        jsonScreen.style.display = 'flex';
        setTimeout(() => textarea.focus(), 50);
    };
    backBtn.onclick = function(e) {
        e.preventDefault();
        jsonScreen.style.display = 'none';
        choiceScreen.style.display = 'block';
        setTimeout(() => blankBtn.focus(), 50);
    };
    // Remove uploadBtn and fileInput logic if not needed
    if (uploadBtn && fileInput) {
        uploadBtn.onclick = function() {
            fileInput.click();
        };
        fileInput.onchange = function() {
            const file = fileInput.files[0];
            if (!file) return;
            if (filenameSpan) filenameSpan.textContent = file.name;
            const reader = new FileReader();
            reader.onload = function(ev) {
                if (textarea) textarea.value = ev.target.result;
            };
            reader.readAsText(file);
        };
    }
    confirmBtn.onclick = function() {
        let json;
        try {
            json = JSON.parse(textarea.value);
        } catch (err) {
            errorDiv.textContent = 'Invalid JSON: ' + err.message;
            return;
        }
        let incomingPrompts = [];
        if (Array.isArray(json)) {
            if (json.length === 0) {
                errorDiv.textContent = 'JSON array is empty.';
                return;
            }
            incomingPrompts = json;
        } else if (typeof json === 'object') {
            // Check for nested templates in outputs
            if (Array.isArray(json.outputs) && json.outputs.length > 0 && json.outputs.every(t => typeof t === 'object')) {
                // Import each template in outputs as a separate prompt
                incomingPrompts = json.outputs;
                // Optionally, add the parent suite as a prompt too
                incomingPrompts.unshift(json);
            } else {
                incomingPrompts = [json];
            }
        } else {
            errorDiv.textContent = 'JSON must be a prompt object or array.';
            return;
        }
        // Check for existing IDs
        const existingIds = prompts.map(p => p.id);
        let addedCount = 0;
        incomingPrompts.forEach(promptObj => {
            if (!promptObj || typeof promptObj !== 'object') return;
            if (existingIds.includes(promptObj.id)) return; // skip if ID exists
            const newPrompt = {
                id: promptObj.id || Date.now(),
                name: promptObj.name || '',
                description: promptObj.description || '',
                objective: promptObj.objective || '',
                actor: promptObj.actor || '',
                context: promptObj.context || '',
                inputs: Array.isArray(promptObj.inputs) ? promptObj.inputs : [],
                constraints: Array.isArray(promptObj.constraints) ? promptObj.constraints : [],
                outputs: Array.isArray(promptObj.outputs) ? promptObj.outputs : [],
                success: Array.isArray(promptObj.success) ? promptObj.success : []
            };
            prompts.push(newPrompt);
            addedCount++;
        });
        if (addedCount > 0) {
            window.savePromptsToLocalStorage();
            renderPromptsList();
            currentPromptId = prompts[prompts.length - 1].id;
            isCreatingNewPrompt = false;
            editPrompt(currentPromptId);
            setTabActive('Edit');
            closeModal();
            setTimeout(() => alert(`Imported ${addedCount} new prompt(s)!`), 100);
        } else {
            errorDiv.textContent = 'No new prompts were added (all IDs already exist).';
        }
    };
}

/**
 * Sets up tab button event listeners.
 */
function setupTabListeners() {
    // Add event listeners for Edit tab
    const editTabBtn = document.querySelector('#tabs button:nth-child(2)');
    if (editTabBtn) {
        editTabBtn.addEventListener('click', function() {
            if (currentPromptId) {
                editPrompt(currentPromptId);
            } else {
                clearForm();
                showEdit();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        initApp();
        // Add event listeners for Save and Cancel buttons
        const saveBtn = document.getElementById('save-prompt');
        if (saveBtn) saveBtn.addEventListener('click', savePrompt);
        const cancelBtn = document.getElementById('cancel-edit');
        if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
        // Add event listeners for both tab buttons
        const viewTabBtn = document.querySelector('#tabs button:nth-child(1)');
        if (viewTabBtn) {
            viewTabBtn.addEventListener('click', function() {
                if (currentPromptId) {
                    showView();
                }
            });
        }
        const editTabBtn = document.querySelector('#tabs button:nth-child(2)');
        if (editTabBtn) {
            editTabBtn.addEventListener('click', function() {
                if (currentPromptId) {
                    editPrompt(currentPromptId);
                }
            });
        }
        var addSuccessBtn = document.getElementById('add-success');
        if (addSuccessBtn) {
            addSuccessBtn.addEventListener('click', function() {
                window.addSuccess();
            });
        }
    });
}

// =========================
// App Startup
// =========================
/**
 * Starts the app and attaches all necessary event listeners.
 */
function startApp() {
    initApp();
    // Add event listeners for Save and Cancel buttons
    const saveBtn = document.getElementById('save-prompt');
    if (saveBtn) saveBtn.addEventListener('click', savePrompt);
    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
    // Add event listeners for both tab buttons
    const viewTabBtn = document.querySelector('#tabs button:nth-child(1)');
    if (viewTabBtn) {
        viewTabBtn.addEventListener('click', function() {
            if (currentPromptId) {
                showView();
            }
        });
    }
    const editTabBtn = document.querySelector('#tabs button:nth-child(2)');
    if (editTabBtn) {
        editTabBtn.addEventListener('click', function() {
            if (currentPromptId) {
                editPrompt(currentPromptId);
            }
        });
    }
    // Attach delete modal logic here so it always works
    var deleteBtn = document.getElementById('delete-prompt');
    var deleteModal = document.getElementById('delete-modal');
    var confirmDeleteBtn = document.getElementById('confirm-delete-prompt');
    var cancelDeleteBtn = document.getElementById('cancel-delete-prompt');
    if (deleteBtn && deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
        deleteBtn.onclick = function() {
            deleteModal.style.display = 'flex';
        };
        cancelDeleteBtn.onclick = function() {
            deleteModal.style.display = 'none';
        };
        confirmDeleteBtn.onclick = function() {
            deleteModal.style.display = 'none';
            if (typeof currentPromptId !== 'undefined' && currentPromptId !== null) {
                deletePrompt(currentPromptId);
            }
        };
        deleteModal.addEventListener('click', function(e) {
            if (e.target === deleteModal) deleteModal.style.display = 'none';
        });
    }
    // Attach new prompt modal logic after DOM is ready
    setupNewPromptModal();
}

// Call startApp() directly since script is at end of body
startApp();

// Toast logic: show session storage warning on load
function showSessionStorageToast() {
    const toast = document.getElementById('toast-warning');
    if (!toast) return;
    toast.classList.add('show');
    toast.style.display = 'block';
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.style.display = 'none'; }, 400);
    }, 4000); // Show for 4 seconds
}
// Call toast on app load
window.addEventListener('DOMContentLoaded', showSessionStorageToast);

// Input history management (global table)
function getPromptInputHistoryAll() {
    const raw = localStorage.getItem('promptInputHistory');
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}
function savePromptInputHistory(templateId, inputObj) {
    if (!templateId || !inputObj) return;
    let history = getPromptInputHistoryAll();
    // Only store non-empty input sets
    if (Object.values(inputObj).every(v => !v)) return;
    history.unshift({ templateId, inputValues: inputObj });
    // Limit history to last 50
    history = history.slice(0, 50);
    localStorage.setItem('promptInputHistory', JSON.stringify(history));
}
function getPromptInputHistory(templateId) {
    const all = getPromptInputHistoryAll();
    const filtered = all.filter(h => h.templateId === templateId).map(h => h.inputValues);
    return filtered;
}
function renderHistoryList(promptId) {
    const history = getPromptInputHistory(promptId);
    const container = document.getElementById('history-list');
    if (!container) { return; }
    if (!history || history.length === 0) {
        container.innerHTML = '<span style="color:#888;font-size:0.95em;">No input history for this prompt.</span>';
        return;
    }
    // Collect all unique field names for header
    const allFields = Array.from(new Set(history.flatMap(h => Object.keys(h))));
    // Find index of Jira Text column
    const jiraIdx = allFields.findIndex(f => f.toLowerCase().includes('jira text'));
    // Set CSS variable for columns
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
        btn.onclick = function() {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const selected = history[idx];
            if (!selected) return;
            showView();
            Object.entries(selected).forEach(([k,v]) => {
                const input = Array.from(document.querySelectorAll('[id^="input-value-"]')).find(el => el.previousElementSibling && el.previousElementSibling.textContent.replace(':','') === k);
                if (input) input.value = v;
            });
            generateViewPrompt();
        };
    });
}

// Update Create Prompt button handler to save input history
const copyBtn = document.getElementById('copy-view-output');
if (copyBtn) {
    copyBtn.onclick = function() {
        const prompt = prompts.find(p => p.id === currentPromptId);
        if (!prompt) {
            return;
        }
        // Save input history
        const inputs = {};
        prompt.inputs.forEach((i, idx) => {
            const inputField = document.getElementById(`input-value-${idx}`);
            inputs[i.name] = inputField ? inputField.value : '';
        });
        savePromptInputHistory(prompt.id, inputs);
        // Immediately update history tab if visible
        if (document.getElementById('history-screen').classList.contains('active')) {
            renderHistoryList(prompt.id);
        }
        // ...existing code for copying...
        const pre = document.getElementById('view-output-json');
        const modal = document.getElementById('copy-modal');
        if (pre) {
            navigator.clipboard.writeText(pre.value).then(function() {
                if (modal) modal.style.display = 'flex';
            });
        }
    };
}

// Render input history dropdown in viewPrompt
function viewPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;

    currentPromptId = id;
    showView();
    setTabActive('Use Template');

    // Switch tab to View Prompt
    const tabs = document.querySelectorAll('#tabs button');
    tabs.forEach(btn => {
        if (btn.textContent.includes('View')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.getElementById('view-name').textContent = prompt.name;
    document.getElementById('view-desc').textContent = prompt.description;
    // Add meta info (objective, actor, context)
    const meta = [];
    if (prompt.objective) meta.push(`<div><strong>Objective:</strong> ${window.escapeHtml(prompt.objective)}</div>`);
    if (prompt.actor) meta.push(`<div><strong>Actor:</strong> ${window.escapeHtml(prompt.actor)}</div>`);
    if (prompt.context) meta.push(`<div><strong>Context:</strong> ${window.escapeHtml(prompt.context)}</div>`);
    document.getElementById('view-meta').innerHTML = meta.join('');

    const inputsContainer = document.getElementById('view-inputs');
    if (prompt.inputs.length === 0) {
        inputsContainer.innerHTML = '<p class="section-desc">No input fields defined</p>';
    } else {
        inputsContainer.innerHTML = prompt.inputs.map((i, idx) => `
            <div style="margin-bottom: 1rem;">
                <label for="input-value-${idx}">${window.escapeHtml(i.name)}:</label>
                  <textarea
                    id="input-value-${idx}"
                    class="view-textarea"
                    rows="6"
                    placeholder="${window.escapeHtml(i.description)}"
                    oninput="generateViewPrompt()"
                ></textarea>
            </div>
        `).join('');
    }

    generateViewPrompt();
    renderPromptsList();
}

// =========================
// Global Functions
// =========================
/**
 * Cancels the current edit and switches to view mode for the current prompt, or shows the welcome screen if no prompt is selected.
 */
function cancelEdit() {
    if (typeof currentPromptId !== 'undefined' && currentPromptId !== null) {
        viewPrompt(currentPromptId);
    } else {
        showWelcome();
    }
}
window.cancelEdit = cancelEdit;

/**
 * Normalizes a prompt object to ensure consistent structure.
 * @param {Object} prompt - The prompt object to normalize.
 * @returns {Object} The normalized prompt object.
 */
function normalizePrompt(prompt) {
    // Ensure constraints and success are always arrays of strings
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

