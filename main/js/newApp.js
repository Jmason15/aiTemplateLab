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

// Environment state
let environment = {
    templateGroups: {}, // { groupName: [templates] }
    history: {} // { groupName: [history] }
};
let currentTemplateGroup = 'Default';

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

// Initialize template groups from preloadedWorkspaces
if (window.preloadedWorkspaces) {
    environment.templateGroups = {
        "Default": window.preloadedWorkspaces["Default"].templates,
        "Jira": window.preloadedWorkspaces["Jira"].templates
    };
    currentTemplateGroup = "Default";
    // Removed early updateTemplateGroupDropdown() call
}

// Ensure dropdown is populated after DOM is ready
window.addEventListener('DOMContentLoaded', function() {
    updateTemplateGroupDropdown();
});

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
 * Creates a new blank prompt and switches to edit mode.
 */
function startBlankPrompt() {
    const newId = Date.now();
    const newPrompt = {
        id: newId,
        name: 'New Prompt',
        description: '',
        objective: '',
        actor: '',
        context: '',
        inputs: [],
        constraints: [],
        outputs: [],
        success: []
    };
    // Add to current workspace
    if (workspaces[currentWorkspace]) {
        workspaces[currentWorkspace].templates.push(newPrompt);
        prompts = workspaces[currentWorkspace].templates.map(normalizePrompt);
        window.savePromptsToLocalStorage();
        currentPromptId = newId;
        isCreatingNewPrompt = false;
        editPrompt(newId);
        setTabActive('Edit');
        renderPromptsList();
    }
}
window.startBlankPrompt = startBlankPrompt;

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
    const templates = environment.templateGroups[currentTemplateGroup] || [];
    if (templates.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No Templates Yet</h3><p>Create your first template to get started</p></div>`;
        return;
    }
    container.innerHTML = templates.map((p, idx) =>
        `<div class="prompt-tile${currentPromptId === p.id ? ' selected' : ''}" data-id="${p.id}" draggable="true" data-index="${idx}">${window.escapeHtml(p.name)}</div>`
    ).join('');
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
    // Show info-display, tabs, and tab-content
    const infoDisplay = document.getElementById('info-display');
    const tabsElem = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    if (infoDisplay) infoDisplay.style.display = '';
    if (tabsElem) tabsElem.style.display = '';
    if (tabContent) tabContent.style.display = '';
    // Hide welcome-screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
        welcomeScreen.classList.remove('active');
    }
    // Switch tab to View Prompt
    const tabButtons = document.querySelectorAll('#tabs button');
    tabButtons.forEach(btn => {
        if (btn.textContent.includes('View')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const viewName = document.getElementById('view-name');
    const viewDesc = document.getElementById('view-desc');
    if (viewName) viewName.textContent = prompt.name;
    if (viewDesc) viewDesc.textContent = prompt.description;
    // Add meta info (objective, actor, context)
    const meta = [];
    if (prompt.objective) meta.push(`<div><strong>Objective:</strong> ${window.escapeHtml(prompt.objective)}</div>`);
    if (prompt.actor) meta.push(`<div><strong>Actor:</strong> ${window.escapeHtml(prompt.actor)}</div>`);
    if (prompt.context) meta.push(`<div><strong>Context:</strong> ${window.escapeHtml(prompt.context)}</div>`);
    const viewMeta = document.getElementById('view-meta');
    if (viewMeta) viewMeta.innerHTML = meta.join('');
    const inputsContainer = document.getElementById('view-inputs');
    if (inputsContainer) {
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
    }
    generateViewPrompt();
    renderPromptsList();
    if (infoDisplay) infoDisplay.style.display = '';
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
    showExportModal();
};

function showExportModal() {
    const modal = document.getElementById('export-modal');
    const grid = document.getElementById('export-template-grid');
    const fileNameInput = document.getElementById('export-file-name');
    if (!modal || !grid || !fileNameInput) return;

    // Render grid of checkboxes
    grid.innerHTML = prompts.map(p =>
        `<div style='display:flex;align-items:center;margin-bottom:6px;'>
            <input type='checkbox' id='export-tpl-${p.id}' value='${p.id}' style='margin-right:8px;' checked>
            <label for='export-tpl-${p.id}' style='cursor:pointer;'>${window.escapeHtml(p.name)}</label>
        </div>`
    ).join('');

    // Set default file name
    fileNameInput.value = `prompts-${Date.now()}.json`;

    modal.style.display = 'flex';

    // Download button
    const downloadBtn = document.getElementById('export-modal-download');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            // Collect checked templates
            const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
            const selectedPrompts = prompts.filter(p => checkedIds.includes(String(p.id)));
            if (selectedPrompts.length === 0) {
                alert('Please select at least one template to export.');
                return;
            }
            let fileName = fileNameInput.value.trim();
            if (!fileName) fileName = `prompts-${Date.now()}.json`;
            if (!fileName.endsWith('.json')) fileName += '.json';
            try {
                const blob = new Blob([JSON.stringify(selectedPrompts, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                modal.style.display = 'none';
            } catch (err) {
                alert('Download failed: ' + err.message);
            }
        };
    }
    // Close button
    const closeBtn = document.getElementById('export-modal-close');
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
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loaded = JSON.parse(e.target.result);
            let allTemplates = Array.isArray(loaded) ? loaded : [loaded];
            // Filter out templates with duplicate ids
            const existingIds = new Set(prompts.map(p => p.id));
            const uniqueTemplates = allTemplates.filter(t => t.id && !existingIds.has(t.id));
            if (uniqueTemplates.length === 0) {
                alert('No new templates to import (all IDs already exist or invalid).');
                event.target.value = '';
                return;
            }
            showImportModal(uniqueTemplates, allTemplates);
        } catch (err) {
            alert('Error parsing JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function showImportModal(templates, allTemplates) {
    const modal = document.getElementById('import-modal');
    const grid = document.getElementById('import-template-grid');
    const alreadyGrid = document.getElementById('import-already-grid');
    const errorDiv = document.getElementById('import-modal-error');
    if (!modal || !grid || !alreadyGrid || !errorDiv) return;
    errorDiv.style.display = 'none';

    // Show already imported templates
    const existingIds = new Set(prompts.map(p => p.id));
    const duplicates = (allTemplates || []).filter(t => t.id && existingIds.has(t.id));
    if (duplicates.length > 0) {
        alreadyGrid.innerHTML = `<strong>Already imported templates:</strong><ul style='margin:0.3em 0 0.7em 1.2em;'>` +
            duplicates.map(t => `<li>${window.escapeHtml(t.name)}</li>`).join('') + '</ul>';
    } else {
        alreadyGrid.innerHTML = '';
    }

    // Render grid of checkboxes for unique templates
    grid.innerHTML = templates.map(t =>
        `<div style='display:flex;align-items:center;margin-bottom:6px;'>
            <input type='checkbox' id='import-tpl-${t.id}' value='${t.id}' style='margin-right:8px;' checked>
            <label for='import-tpl-${t.id}' style='cursor:pointer;'>${window.escapeHtml(t.name)}</label>
        </div>`
    ).join('');
    modal.style.display = 'flex';
    // Confirm button
    const confirmBtn = document.getElementById('import-modal-confirm');
    if (confirmBtn) {
        confirmBtn.onclick = function() {
            const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
            const selectedTemplates = templates.filter(t => checkedIds.includes(String(t.id)));
            if (selectedTemplates.length === 0) {
                errorDiv.textContent = 'Please select at least one template to import.';
                errorDiv.style.display = 'block';
                return;
            }
            // Add only unique templates
            const existingIds = new Set(prompts.map(p => p.id));
            const newTemplates = selectedTemplates.filter(t => t.id && !existingIds.has(t.id));
            if (newTemplates.length === 0) {
                errorDiv.textContent = 'No new templates to import (all IDs already exist).';
                errorDiv.style.display = 'block';
                return;
            }
            // Add to current workspace
            if (workspaces[currentWorkspace]) {
                workspaces[currentWorkspace].templates = workspaces[currentWorkspace].templates.concat(newTemplates);
                prompts = workspaces[currentWorkspace].templates.map(normalizePrompt);
                window.savePromptsToLocalStorage();
                renderPromptsList();
                modal.style.display = 'none';
                errorDiv.style.display = 'none';
                alert(`Imported ${newTemplates.length} template(s) successfully!`);
            }
        };
    }
    // Cancel button
    const cancelBtn = document.getElementById('import-modal-cancel');
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.style.display = 'none';
            errorDiv.style.display = 'none';
        };
    }
    // Optional: close modal when clicking outside
    modal.onclick = function(e) {
        if (e.target === modal) modal.style.display = 'none';
    };
}

/**
 * Sets up the new prompt modal and its event handlers.
 */
function setupNewPromptModal() {
    // Only reference elements that exist in the new modal
    const modal = document.getElementById('new-prompt-modal');
    const cancelBtn = document.getElementById('new-prompt-cancel');
    const confirmBtn = document.getElementById('json-import-confirm');
    const textarea = document.getElementById('json-import-textarea');
    const errorDiv = document.getElementById('json-import-error');

    // Cancel button
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            if (modal) modal.style.display = 'none';
            if (textarea) textarea.value = '';
            if (errorDiv) errorDiv.textContent = '';
        };
    }
    // Confirm button
    if (confirmBtn) {
        confirmBtn.onclick = function() {
            if (!textarea) return;
            if (!errorDiv) return;
            errorDiv.style.display = 'none';
            try {
                const json = JSON.parse(textarea.value);
                importPromptFromJson(json);
            } catch (e) {
                errorDiv.textContent = 'Invalid JSON: ' + e.message;
                errorDiv.style.display = 'block';
            }
        };
    }
    // Modal background click closes
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
        modal.onkeydown = function(e) {
            if (e.key === 'Escape') modal.style.display = 'none';
        };
    }
}

/**
 * Closes the New Prompt modal and clears fields.
 */
function closeNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (modal) {
        modal.style.display = 'none';
        const textarea = document.getElementById('json-import-textarea');
        if (textarea) textarea.value = '';
        const errorDiv = document.getElementById('json-import-error');
        if (errorDiv) errorDiv.textContent = '';
    }
}
window.closeNewPromptModal = closeNewPromptModal;

// Update modal event bindings
const jsonImportConfirmBtn = document.getElementById('json-import-confirm');
if (jsonImportConfirmBtn) {
    jsonImportConfirmBtn.onclick = function() {
        var textarea = document.getElementById('json-import-textarea');
        var errorDiv = document.getElementById('json-import-error');
        errorDiv.style.display = 'none';
        try {
            var json = JSON.parse(textarea.value);
            importPromptFromJson(json);
        } catch (e) {
            errorDiv.textContent = 'Invalid JSON: ' + e.message;
            errorDiv.style.display = 'block';
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
    // Show info-display, tabs, and tab-content
    const infoDisplay = document.getElementById('info-display');
    const tabsElem = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    if (infoDisplay) infoDisplay.style.display = '';
    if (tabsElem) tabsElem.style.display = '';
    if (tabContent) tabContent.style.display = '';
    // Hide welcome-screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
        welcomeScreen.classList.remove('active');
    }
    // Switch tab to View Prompt
    const tabButtons = document.querySelectorAll('#tabs button');
    tabButtons.forEach(btn => {
        if (btn.textContent.includes('View')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    const viewName = document.getElementById('view-name');
    const viewDesc = document.getElementById('view-desc');
    if (viewName) viewName.textContent = prompt.name;
    if (viewDesc) viewDesc.textContent = prompt.description;
    // Add meta info (objective, actor, context)
    const meta = [];
    if (prompt.objective) meta.push(`<div><strong>Objective:</strong> ${window.escapeHtml(prompt.objective)}</div>`);
    if (prompt.actor) meta.push(`<div><strong>Actor:</strong> ${window.escapeHtml(prompt.actor)}</div>`);
    if (prompt.context) meta.push(`<div><strong>Context:</strong> ${window.escapeHtml(prompt.context)}</div>`);
    const viewMeta = document.getElementById('view-meta');
    if (viewMeta) viewMeta.innerHTML = meta.join('');
    const inputsContainer = document.getElementById('view-inputs');
    if (inputsContainer) {
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
    }
    generateViewPrompt();
    renderPromptsList();
    if (infoDisplay) infoDisplay.style.display = '';
}

// In showWelcome(), ensure info-display is hidden
function showWelcome() {
    // Hide info-display, tabs, and tab-content
    const infoDisplay = document.getElementById('info-display');
    const tabs = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    if (infoDisplay) infoDisplay.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (tabContent) tabContent.style.display = 'none';
    // Show welcome-screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        welcomeScreen.classList.add('active');
    }
}

// Template Group Persistence
function saveTemplateGroupsToStorage() {
    localStorage.setItem('templateGroups', JSON.stringify(environment.templateGroups));
    localStorage.setItem('templateGroupHistory', JSON.stringify(environment.history));
    localStorage.setItem('currentTemplateGroup', currentTemplateGroup);
}
function loadTemplateGroupsFromStorage() {
    const rawGroups = localStorage.getItem('templateGroups');
    const rawHistory = localStorage.getItem('templateGroupHistory');
    const rawCurrent = localStorage.getItem('currentTemplateGroup');
    if (rawGroups && rawHistory) {
        try {
            environment.templateGroups = JSON.parse(rawGroups);
            environment.history = JSON.parse(rawHistory);
            currentTemplateGroup = rawCurrent || Object.keys(environment.templateGroups)[0] || 'Default';
        } catch {
            // fallback to preloadedWorkspaces
            environment.templateGroups = {
                "Default": window.preloadedWorkspaces["Default"].templates,
                "Jira": window.preloadedWorkspaces["Jira"].templates
            };
            environment.history = {};
            currentTemplateGroup = 'Default';
        }
    } else {
        // fallback to preloadedWorkspaces
        environment.templateGroups = {
            "Default": window.preloadedWorkspaces["Default"].templates,
            "Jira": window.preloadedWorkspaces["Jira"].templates
        };
        environment.history = {};
        currentTemplateGroup = 'Default';
    }
}
// On app load, initialize template groups
loadTemplateGroupsFromStorage();
updateTemplateGroupDropdown();
renderPromptsList();
// Update savePromptsToLocalStorage to persist template groups
window.savePromptsToLocalStorage = function() {
    saveTemplateGroupsToStorage();
};

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

/**
 * Opens the New Prompt modal (Import JSON).
 */
function openNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Focus textarea for accessibility
        const textarea = document.getElementById('json-import-textarea');
        if (textarea) setTimeout(() => textarea.focus(), 50);
    }
}
window.openNewPromptModal = openNewPromptModal;

/**
 * Imports prompt(s) from JSON pasted in the modal.
 * Accepts a single prompt object or an array of prompt objects.
 * Adds only prompts with unique IDs (does not overwrite existing ones).
 * Normalizes imported prompts for structure.
 */
function importPromptFromJson(json) {
    let importedPrompts = [];
    if (Array.isArray(json)) {
        importedPrompts = json;
    } else if (typeof json === 'object' && json !== null) {
        importedPrompts = [json];
    } else {
        alert('Invalid JSON: Must be a prompt object or array of prompt objects');
        return;
    }
    // Filter out prompts with duplicate IDs
    const existingIds = new Set(prompts.map(p => p.id));
    const newPrompts = importedPrompts
        .map(normalizePrompt)
        .filter(p => p.id && !existingIds.has(p.id));
    if (newPrompts.length === 0) {
        alert('No new prompts to import (all IDs already exist)');
        return;
    }
    // Add to current workspace
    if (workspaces[currentWorkspace]) {
        workspaces[currentWorkspace].templates = workspaces[currentWorkspace].templates.concat(newPrompts);
        prompts = workspaces[currentWorkspace].templates.map(normalizePrompt);
        window.savePromptsToLocalStorage();
        renderPromptsList();
        closeNewPromptModal();
        showWelcome();
        alert(`Imported ${newPrompts.length} prompt(s) successfully!`);
    }
}
window.importPromptFromJson = importPromptFromJson;

// =========================
// Workspace Save/Load
// =========================

// Save Workspace button handler
const saveWorkspaceBtn = document.getElementById('save-workspace-btn');
if (saveWorkspaceBtn) {
    saveWorkspaceBtn.onclick = function() {
        const modal = document.getElementById('save-workspace-modal');
        const filenameInput = document.getElementById('save-workspace-filename');
        if (modal && filenameInput) {
            filenameInput.value = `workspace-${new Date().toISOString().slice(0,10)}.json`;
            modal.style.display = 'flex';
        }
    };
}

// Save Workspace modal confirm/cancel
const saveWorkspaceConfirm = document.getElementById('save-workspace-confirm');
const saveWorkspaceCancel = document.getElementById('save-workspace-cancel');
if (saveWorkspaceConfirm) {
    saveWorkspaceConfirm.onclick = function() {
        const filenameInput = document.getElementById('save-workspace-filename');
        let fileName = filenameInput.value.trim();
        if (!fileName) fileName = `workspace-${new Date().toISOString().slice(0,10)}.json`;
        if (!fileName.endsWith('.json')) fileName += '.json';
        // Collect all template groups, history, and current group
        const workspaceData = {
            templateGroups: environment.templateGroups,
            history: environment.history,
            currentTemplateGroup: currentTemplateGroup
        };
        try {
            const blob = new Blob([JSON.stringify(workspaceData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            document.getElementById('save-workspace-modal').style.display = 'none';
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };
}
if (saveWorkspaceCancel) {
    saveWorkspaceCancel.onclick = function() {
        document.getElementById('save-workspace-modal').style.display = 'none';
    };
}

// Load Workspace button handler
const loadWorkspaceBtn = document.getElementById('load-workspace-btn');
if (loadWorkspaceBtn) {
    loadWorkspaceBtn.onclick = function() {
        const modal = document.getElementById('load-workspace-warning-modal');
        if (modal) modal.style.display = 'flex';
    };
}
// Wire up warning modal buttons
const loadWorkspaceContinue = document.getElementById('load-workspace-continue');
const loadWorkspaceCancel = document.getElementById('load-workspace-cancel');
if (loadWorkspaceContinue) {
    loadWorkspaceContinue.onclick = function() {
        document.getElementById('load-workspace-warning-modal').style.display = 'none';
        document.getElementById('load-workspace-file').click();
    };
}
if (loadWorkspaceCancel) {
    loadWorkspaceCancel.onclick = function() {
        document.getElementById('load-workspace-warning-modal').style.display = 'none';
    };
}
// Optional: close modal when clicking outside
const loadWorkspaceWarningModal = document.getElementById('load-workspace-warning-modal');
if (loadWorkspaceWarningModal) {
    loadWorkspaceWarningModal.onclick = function(e) {
        if (e.target === loadWorkspaceWarningModal) loadWorkspaceWarningModal.style.display = 'none';
    };
}

// Enhanced Load Workspace file input handler
const loadWorkspaceFile = document.getElementById('load-workspace-file');
if (loadWorkspaceFile) {
    loadWorkspaceFile.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const loaded = JSON.parse(e.target.result);
                // Validate structure
                if (!loaded || typeof loaded !== 'object') {
                    alert('Invalid workspace file: not a valid JSON object');
                    return;
                }
                if (!loaded.templateGroups || typeof loaded.templateGroups !== 'object') {
                    alert('Invalid workspace file: missing templateGroups');
                    return;
                }
                environment.templateGroups = loaded.templateGroups;
                environment.history = loaded.history || {};
                currentTemplateGroup = loaded.currentTemplateGroup || Object.keys(environment.templateGroups)[0] || 'Default';
                updateTemplateGroupDropdown();
                renderPromptsList();
                // Show first prompt or welcome
                const templates = environment.templateGroups[currentTemplateGroup] || [];
                if (templates.length > 0) {
                    currentPromptId = templates[0].id;
                    viewPrompt(currentPromptId);
                } else {
                    currentPromptId = null;
                    showWelcome();
                }
                alert('Workspace loaded successfully!');
            } catch (err) {
                alert('Error loading workspace: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
}

// Project (all workspaces) save/load
const saveProjectBtn = document.getElementById('save-project-btn');
if (saveProjectBtn) {
    saveProjectBtn.onclick = function() {
        const modal = document.getElementById('save-project-modal');
        const filenameInput = document.getElementById('save-project-filename');
        if (modal && filenameInput) {
            filenameInput.value = `project-${new Date().toISOString().slice(0,10)}.json`;
            modal.style.display = 'flex';
        }
    };
}
const saveProjectConfirm = document.getElementById('save-project-confirm');
const saveProjectCancel = document.getElementById('save-project-cancel');
if (saveProjectConfirm) {
    saveProjectConfirm.onclick = function() {
        const filenameInput = document.getElementById('save-project-filename');
        let fileName = filenameInput.value.trim();
        if (!fileName) fileName = `project-${new Date().toISOString().slice(0,10)}.json`;
        if (!fileName.endsWith('.json')) fileName += '.json';
        // Save all workspaces and their histories
        const projectData = {
            workspaces,
            globalInputHistory: localStorage.getItem('promptInputHistory') || []
        };
        try {
            const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            document.getElementById('save-project-modal').style.display = 'none';
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };
}
if (saveProjectCancel) {
    saveProjectCancel.onclick = function() {
        document.getElementById('save-project-modal').style.display = 'none';
    };
}
// Load Project
const loadProjectBtn = document.getElementById('load-project-btn');
if (loadProjectBtn) {
    loadProjectBtn.onclick = function() {
        const modal = document.getElementById('load-project-warning-modal');
        if (modal) modal.style.display = 'flex';
    };
}
const loadProjectContinue = document.getElementById('load-project-continue');
const loadProjectCancel = document.getElementById('load-project-cancel');
if (loadProjectContinue) {
    loadProjectContinue.onclick = function() {
        document.getElementById('load-project-warning-modal').style.display = 'none';
        document.getElementById('load-project-file').click();
    };
}
if (loadProjectCancel) {
    loadProjectCancel.onclick = function() {
        document.getElementById('load-project-warning-modal').style.display = 'none';
    };
}
const loadProjectFile = document.getElementById('load-project-file');
if (loadProjectFile) {
    loadProjectFile.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const loaded = JSON.parse(e.target.result);
                if (!loaded || typeof loaded !== 'object' || !loaded.workspaces) {
                    alert('Invalid project file: missing workspaces');
                    return;
                }
                workspaces = loaded.workspaces;
                saveWorkspacesToStorage();
                // Restore global input history
                if (loaded.globalInputHistory) {
                    localStorage.setItem('promptInputHistory', loaded.globalInputHistory);
                } else {
                    localStorage.removeItem('promptInputHistory');
                }
                // Switch to default workspace
                currentWorkspace = Object.keys(workspaces)[0] || 'Default';
                switchWorkspace(currentWorkspace);
                alert('Project loaded successfully!');
            } catch (err) {
                alert('Error loading project: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
}

// App Bar Overflow Menu Logic
const kebabBtn = document.getElementById('app-bar-kebab');
const menu = document.getElementById('app-bar-menu');
if (kebabBtn && menu) {
    kebabBtn.onclick = function(e) {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    };
    // Close menu on outside click
    document.addEventListener('click', function(e) {
        if (menu.style.display === 'block' && !menu.contains(e.target) && e.target !== kebabBtn) {
            menu.style.display = 'none';
        }
    });
    // Keyboard accessibility
    kebabBtn.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        }
    };
}
// Menu actions
const menuSaveWorkspace = document.getElementById('menu-save-workspace');
const menuLoadWorkspace = document.getElementById('menu-load-workspace');
const menuSaveTemplateGroup = document.getElementById('menu-save-template-group');
const menuLoadTemplateGroup = document.getElementById('menu-load-template-group');
const menuDeleteTemplateGroup = document.getElementById('menu-delete-template-group');
const menuExportTemplates = document.getElementById('menu-export-templates');
const menuImportTemplates = document.getElementById('menu-import-templates');
const menuResetTemplates = document.getElementById('menu-reset-templates');
const menuCreateTemplateGroup = document.getElementById('menu-create-template-group');
if (menuSaveWorkspace) menuSaveWorkspace.onclick = function() {
    menu.style.display = 'none';
    document.getElementById('save-workspace-btn').click();
};
if (menuLoadWorkspace) menuLoadWorkspace.onclick = function() {
    menu.style.display = 'none';
    document.getElementById('load-workspace-btn').click();
};
if (menuSaveTemplateGroup) menuSaveTemplateGroup.onclick = function() {
    menu.style.display = 'none';
    document.getElementById('save-template-group-btn').click();
};
if (menuLoadTemplateGroup) menuLoadTemplateGroup.onclick = function() {
    menu.style.display = 'none';
    document.getElementById('load-template-group-btn').click();
};
// Delete Template Group Modal logic
if (menuDeleteTemplateGroup) menuDeleteTemplateGroup.onclick = function() {
    menu.style.display = 'none';
    const modal = document.getElementById('delete-template-group-modal');
    const select = document.getElementById('delete-template-group-select');
    const errorDiv = document.getElementById('delete-template-group-error');
    if (modal && select && errorDiv) {
        // Populate dropdown with all template groups except current
        const groups = Object.keys(environment.templateGroups);
        select.innerHTML = groups.map(name => `<option value="${name}">${name}</option>`).join('');
        errorDiv.style.display = 'none';
        modal.style.display = 'flex';
    }
};
// Ensure Create Template Group menu opens modal directly
if (menuCreateTemplateGroup) menuCreateTemplateGroup.onclick = function() {
    menu.style.display = 'none';
    // Open modal directly
    const modal = document.getElementById('create-template-group-modal');
    const nameInput = document.getElementById('create-template-group-name');
    const errorDiv = document.getElementById('create-template-group-error');
    if (modal && nameInput && errorDiv) {
        nameInput.value = '';
        errorDiv.style.display = 'none';
        modal.style.display = 'flex';
    }
};
const deleteTemplateGroupConfirm = document.getElementById('delete-template-group-confirm');
const deleteTemplateGroupCancel = document.getElementById('delete-template-group-cancel');
if (deleteTemplateGroupConfirm) {
    deleteTemplateGroupConfirm.onclick = function() {
        const select = document.getElementById('delete-template-group-select');
        const errorDiv = document.getElementById('delete-template-group-error');
        const groupName = select.value;
        // Prevent deleting if only one group left
        if (Object.keys(environment.templateGroups).length <= 1) {
            errorDiv.textContent = 'At least one template group must remain.';
            errorDiv.style.display = 'block';
            return;
        }
        // Prevent deleting current group
        if (groupName === currentTemplateGroup) {
            errorDiv.textContent = 'Cannot delete the currently selected template group.';
            errorDiv.style.display = 'block';
            return;
        }
        delete environment.templateGroups[groupName];
        delete environment.history[groupName];
        document.getElementById('delete-template-group-modal').style.display = 'none';
        updateTemplateGroupDropdown();
        alert(`Template group '${groupName}' deleted successfully!`);
    };
}
if (deleteTemplateGroupCancel) {
    deleteTemplateGroupCancel.onclick = function() {
        document.getElementById('delete-template-group-modal').style.display = 'none';
        document.getElementById('delete-template-group-error').style.display = 'none';
    };
}
if (menuExportTemplates) menuExportTemplates.onclick = function() {
    menu.style.display = 'none';
    window.exportPrompts();
};
if (menuImportTemplates) menuImportTemplates.onclick = function() {
    menu.style.display = 'none';
    document.getElementById('import-file').click();
};
if (menuResetTemplates) menuResetTemplates.style.display = 'none';

// Sidebar actions: Import JSON and Blank Prompt
window.addEventListener('DOMContentLoaded', function() {
    var importJsonBtn = document.getElementById('import-json-btn');
    if (importJsonBtn) {
        importJsonBtn.onclick = function() {
            openNewPromptModal();
        };
    }
    var blankPromptBtn = document.getElementById('blank-prompt-btn');
    if (blankPromptBtn) {
        blankPromptBtn.onclick = function() {
            startBlankPrompt();
        };
    }
});

// Rename workspace to environment, project to template group
let environments = {};
let currentEnvironment = 'Default';

function getInitialEnvironments() {
    if (window.preloadedEnvironments) {
        return JSON.parse(JSON.stringify(window.preloadedEnvironments));
    }
    return {};
}
function loadEnvironmentsFromStorage() {
    const raw = localStorage.getItem('environments');
    if (raw) {
        try {
            environments = JSON.parse(raw);
        } catch {
            environments = getInitialEnvironments();
        }
    } else {
        environments = getInitialEnvironments();
    }
    if (!environments['Default']) {
        environments['Default'] = { templateGroups: [], inputHistory: [] };
    }
}
function saveEnvironmentsToStorage() {
    localStorage.setItem('environments', JSON.stringify(environments));
}
function switchEnvironment(name) {
    if (!environments[name]) return;
    currentEnvironment = name;
    prompts = environments[name].templateGroups.map(normalizePrompt);
    renderPromptsList();
    if (Array.isArray(environments[name].inputHistory)) {
        localStorage.setItem('promptInputHistory', JSON.stringify(environments[name].inputHistory));
    } else {
        localStorage.removeItem('promptInputHistory');
    }
    if (prompts.length > 0) {
        currentPromptId = prompts[0].id;
        viewPrompt(currentPromptId);
    } else {
        currentPromptId = null;
        showWelcome();
    }
    updateEnvironmentDropdown();
}
function updateEnvironmentDropdown() {
    const dropdown = document.getElementById('environment-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = Object.keys(environments).map(name =>
        `<option value="${name}"${name === currentEnvironment ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.disabled = false;
}
const environmentDropdown = document.getElementById('environment-dropdown');
if (environmentDropdown) {
    environmentDropdown.onchange = function() {
        switchEnvironment(environmentDropdown.value);
    };
}
loadEnvironmentsFromStorage();
switchEnvironment(currentEnvironment);
window.savePromptsToLocalStorage = function() {
    if (!environments[currentEnvironment]) return;
    environments[currentEnvironment].templateGroups = prompts;
    environments[currentEnvironment].inputHistory = getPromptInputHistoryAll();
    saveEnvironmentsToStorage();
};

/**
 * Shows the welcome screen and hides other screens.
 */
function showWelcome() {
    // Hide info-display, tabs, and tab-content
    const infoDisplay = document.getElementById('info-display');
    const tabs = document.getElementById('tabs');
    const tabContent = document.querySelector('.tab-content');
    if (infoDisplay) infoDisplay.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (tabContent) tabContent.style.display = 'none';
    // Show welcome-screen
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'block';
        welcomeScreen.classList.add('active');
    }
}

// Save Template Group modal logic
const saveTemplateGroupBtn = document.getElementById('save-template-group-btn');
if (saveTemplateGroupBtn) {
    saveTemplateGroupBtn.onclick = function() {
        const modal = document.getElementById('save-template-group-modal');
        const select = document.getElementById('save-template-group-select');
        const filenameInput = document.getElementById('save-template-group-filename');
        if (modal && select && filenameInput) {
            // Populate dropdown with all template groups
            select.innerHTML = Object.keys(environment.templateGroups).map(name =>
                `<option value="${name}">${name}</option>`
            ).join('');
            // Set default selection to current group
            select.value = currentTemplateGroup;
            // Set filename based on selected group
            filenameInput.value = `${select.value}-template-group-${new Date().toISOString().slice(0,10)}.json`;
            modal.style.display = 'flex';
            // Update filename when dropdown changes
            select.onchange = function() {
                filenameInput.value = `${select.value}-template-group-${new Date().toISOString().slice(0,10)}.json`;
            };
        }
    };
}
const saveTemplateGroupConfirm = document.getElementById('save-template-group-confirm');
const saveTemplateGroupCancel = document.getElementById('save-template-group-cancel');
if (saveTemplateGroupConfirm) {
    saveTemplateGroupConfirm.onclick = function() {
        const select = document.getElementById('save-template-group-select');
        const filenameInput = document.getElementById('save-template-group-filename');
        let groupName = select.value;
        let fileName = filenameInput.value.trim();
        if (!fileName) fileName = `${groupName}-template-group-${new Date().toISOString().slice(0,10)}.json`;
        if (!fileName.endsWith('.json')) fileName += '.json';
        // Export only the selected template group and its history
        const groupData = {
            name: groupName,
            templates: environment.templateGroups[groupName],
            history: environment.history[groupName] || []
        };
        try {
            const blob = new Blob([JSON.stringify(groupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            document.getElementById('save-template-group-modal').style.display = 'none';
        } catch (err) {
            alert('Save failed: ' + err.message);
        }
    };
}
if (saveTemplateGroupCancel) {
    saveTemplateGroupCancel.onclick = function() {
        document.getElementById('save-template-group-modal').style.display = 'none';
    };
}
// Load Template Group logic
const loadTemplateGroupBtn = document.getElementById('load-template-group-btn');
if (loadTemplateGroupBtn) {
    loadTemplateGroupBtn.onclick = function() {
        document.getElementById('load-template-group-file').click();
    };
}
const loadTemplateGroupFile = document.getElementById('load-template-group-file');
if (loadTemplateGroupFile) {
    loadTemplateGroupFile.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const loaded = JSON.parse(e.target.result);
                if (!loaded || typeof loaded !== 'object' || !loaded.name || !Array.isArray(loaded.templates)) {
                    alert('Invalid template group file: missing name or templates');
                    return;
                }
                // Prevent duplicate group name
                if (environment.templateGroups[loaded.name]) {
                    alert('Template group with this name already exists. Please rename before importing.');
                    return;
                }
                environment.templateGroups[loaded.name] = loaded.templates;
                environment.history[loaded.name] = loaded.history || [];
                updateTemplateGroupDropdown();
                alert(`Template group '${loaded.name}' imported successfully!`);
            } catch (err) {
                alert('Error loading template group: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };
}

// Create Template Group modal logic
const createTemplateGroupBtn = document.getElementById('create-template-group-btn');
if (createTemplateGroupBtn) {
    createTemplateGroupBtn.onclick = function() {
        const modal = document.getElementById('create-template-group-modal');
        const nameInput = document.getElementById('create-template-group-name');
        const errorDiv = document.getElementById('create-template-group-error');
        if (modal && nameInput && errorDiv) {
            nameInput.value = '';
            errorDiv.style.display = 'none';
            modal.style.display = 'flex';
        }
    };
}
const createTemplateGroupConfirm = document.getElementById('create-template-group-confirm');
const createTemplateGroupCancel = document.getElementById('create-template-group-cancel');
if (createTemplateGroupConfirm) {
    createTemplateGroupConfirm.onclick = function() {
        const nameInput = document.getElementById('create-template-group-name');
        const errorDiv = document.getElementById('create-template-group-error');
        let groupName = nameInput.value.trim();
        if (!groupName) {
            errorDiv.textContent = 'Please enter a name for the new template group.';
            errorDiv.style.display = 'block';
            return;
        }
        if (environment.templateGroups[groupName]) {
            errorDiv.textContent = 'A template group with this name already exists.';
            errorDiv.style.display = 'block';
            return;
        }
        environment.templateGroups[groupName] = [];
        environment.history[groupName] = [];
        currentTemplateGroup = groupName;
        updateTemplateGroupDropdown();
        renderPromptsList();
        document.getElementById('create-template-group-modal').style.display = 'none';
        errorDiv.style.display = 'none';
        alert(`Template group '${groupName}' created successfully!`);
    };
}
if (createTemplateGroupCancel) {
    createTemplateGroupCancel.onclick = function() {
        document.getElementById('create-template-group-modal').style.display = 'none';
        document.getElementById('create-template-group-error').style.display = 'none';
    };
}

// =========================
// State and UI Management Functions
// =========================
/**
 * Updates the template group dropdown in the UI.
 */
function updateTemplateGroupDropdown() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (!dropdown) return;
    const groups = Object.keys(environment.templateGroups);
    dropdown.innerHTML = groups.map(name =>
        `<option value="${name}"${name === currentTemplateGroup ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.value = currentTemplateGroup;
    dropdown.disabled = false;
    // Optionally, update other UI elements if needed
}

// Call updateTemplateGroupDropdown on DOMContentLoaded to ensure it's set up initially
window.addEventListener('DOMContentLoaded', function() {
    updateTemplateGroupDropdown();
});

const templateGroupDropdown = document.getElementById('template-group-dropdown');
if (templateGroupDropdown) {
    templateGroupDropdown.onchange = function() {
        currentTemplateGroup = templateGroupDropdown.value;
        prompts = (environment.templateGroups[currentTemplateGroup] || []).map(normalizePrompt);
        renderPromptsList();
        const templates = prompts;
        const infoDisplay = document.getElementById('info-display');
        if (templates.length > 0) {
            currentPromptId = templates[0].id;
            viewPrompt(currentPromptId);
            if (infoDisplay) infoDisplay.style.display = '';
        } else {
            currentPromptId = null;
            showWelcome();
            if (infoDisplay) infoDisplay.style.display = 'none';
        }
    };
}
