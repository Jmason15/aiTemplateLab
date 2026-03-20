// main/js/newApp.js

// =========================
// Storage (defined first so init() can call them)
// =========================
function loadTemplateGroupsFromStorage() {
    const rawGroups = localStorage.getItem('templateGroups');
    const rawHistory = localStorage.getItem('templateGroupHistory');
    const rawCurrent = localStorage.getItem('currentTemplateGroup');
    if (rawGroups) {
        try {
            environment.templateGroups = JSON.parse(rawGroups);
            environment.history = rawHistory ? JSON.parse(rawHistory) : {};
            currentTemplateGroup = rawCurrent || Object.keys(environment.templateGroups)[0] || 'Default';
        } catch {
            resetToPreloaded();
        }
    } else {
        resetToPreloaded();
    }
}

function saveTemplateGroupsToStorage() {
    localStorage.setItem('templateGroups', JSON.stringify(environment.templateGroups));
    localStorage.setItem('templateGroupHistory', JSON.stringify(environment.history));
    localStorage.setItem('currentTemplateGroup', currentTemplateGroup);
}

function resetToPreloaded() {
    environment.templateGroups = {
        'Default': window.preloadedWorkspaces['Default'].templates,
        'Jira': window.preloadedWorkspaces['Jira'].templates
    };
    environment.history = {};
    currentTemplateGroup = 'Default';
}

window.savePromptsToLocalStorage = saveTemplateGroupsToStorage;
window.loadPromptsFromLocalStorage = loadTemplateGroupsFromStorage;

// =========================
// State
// =========================
let prompts = [];
let currentPromptId = null;
let isCreatingNewPrompt = false;
let inputCounter = 0;
let constraintCounter = 0;
let outputCounter = 0;
let successCounter = 0;

let environment = { templateGroups: {}, history: {} };
let currentTemplateGroup = 'Default';

// editPrompt.js reads/writes these via window.*
window.prompts = prompts;
window.currentPromptId = currentPromptId;
window.inputCounter = inputCounter;
window.constraintCounter = constraintCounter;
window.outputCounter = outputCounter;
window.successCounter = successCounter;

function syncWindowState() {
    window.prompts = prompts;
    window.currentPromptId = currentPromptId;
    window.inputCounter = inputCounter;
    window.constraintCounter = constraintCounter;
    window.outputCounter = outputCounter;
    window.successCounter = successCounter;
}

// =========================
// Utilities
// =========================
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

function renderCheckboxGrid(container, items, idPrefix) {
    container.innerHTML = items.map(item =>
        `<div class="checkbox-row" style="display:flex;align-items:center;margin-bottom:6px;">
            <input type="checkbox" id="${idPrefix}-${item.id}" value="${item.id}" style="margin-right:8px;" checked>
            <label for="${idPrefix}-${item.id}" style="cursor:pointer;">${window.escapeHtml(item.name)}</label>
        </div>`
    ).join('');
}

// =========================
// Initialization
// =========================
function init() {
    loadTemplateGroupsFromStorage();
    updateTemplateGroupDropdown();

    const defaultGroup = window.preloadedConfig?.defaultWorkspace || 'Default';
    const defaultTemplateName = window.preloadedConfig?.defaultTemplate || 'Template Builder';

    if (environment.templateGroups[defaultGroup]) {
        currentTemplateGroup = defaultGroup;
        prompts = environment.templateGroups[defaultGroup].map(normalizePrompt);
        const defaultPrompt = prompts.find(p => p.name === defaultTemplateName);
        const startId = (defaultPrompt || prompts[0])?.id;
        if (startId) {
            currentPromptId = startId;
            viewPrompt(currentPromptId);
            setTabActive('Use Template');
            showView();
        } else {
            showWelcome();
        }
    } else if (prompts.length > 0) {
        currentPromptId = prompts[0].id;
        viewPrompt(currentPromptId);
        setTabActive('Use Template');
        showView();
    } else {
        showWelcome();
    }

    syncWindowState();
    renderPromptsList();
}

function initApp() {
    init();
    setupTabListeners();
}

// =========================
// Prompt CRUD
// =========================
window.newPrompt = function () {
    const newId = Date.now();
    const newPromptObj = {
        id: newId, name: '', description: '', objective: '',
        actor: '', context: '', inputs: [], constraints: [], outputs: [], success: []
    };
    prompts.push(newPromptObj);
    window.savePromptsToLocalStorage();
    currentPromptId = newId;
    isCreatingNewPrompt = false;
    editPrompt(newId);
    setTabActive('Edit');
    renderPromptsList();
    syncWindowState();
};

function startBlankPrompt() {
    const newId = Date.now();
    const newPromptObj = {
        id: newId, name: 'New Prompt', description: '', objective: '',
        actor: '', context: '', inputs: [], constraints: [], outputs: [], success: []
    };
    if (!environment.templateGroups[currentTemplateGroup]) return;
    environment.templateGroups[currentTemplateGroup].push(newPromptObj);
    prompts = environment.templateGroups[currentTemplateGroup].map(normalizePrompt);
    window.savePromptsToLocalStorage();
    currentPromptId = newId;
    isCreatingNewPrompt = false;
    editPrompt(newId);
    setTabActive('Edit');
    renderPromptsList();
    syncWindowState();
}
window.startBlankPrompt = startBlankPrompt;

function deletePrompt(id) {
    if (environment.templateGroups[currentTemplateGroup]) {
        environment.templateGroups[currentTemplateGroup] =
            environment.templateGroups[currentTemplateGroup].filter(p => p.id !== id);
        prompts = environment.templateGroups[currentTemplateGroup].map(normalizePrompt);
    } else {
        prompts = prompts.filter(p => p.id !== id);
    }
    window.savePromptsToLocalStorage();
    renderPromptsList();
    if (prompts.length > 0) {
        currentPromptId = prompts[0].id;
        viewPrompt(currentPromptId);
    } else {
        currentPromptId = null;
        showWelcome();
    }
    syncWindowState();
}

function savePrompt() {
    const nameEl = document.getElementById('prompt-name');
    const descEl = document.getElementById('prompt-desc');
    if (!nameEl || !descEl) return;

    const inputs = [];
    document.querySelectorAll('[id^="input-name-"]').forEach(el => {
        const fieldName = el.value.trim();
        const suffix = el.id.split('-')[2];
        const descInput = document.getElementById(`input-desc-${suffix}`);
        if (fieldName) inputs.push({ name: fieldName, description: descInput ? descInput.value.trim() : '' });
    });

    const constraints = [];
    document.querySelectorAll('[id^="constraint-text-"]').forEach(el => {
        if (el.value.trim()) constraints.push(el.value.trim());
    });

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

    const promptData = {
        id: currentPromptId || Date.now(),
        name: nameEl.value.trim(),
        description: descEl.value.trim(),
        objective: document.getElementById('objective')?.value || '',
        actor: document.getElementById('actor')?.value || '',
        context: document.getElementById('context')?.value || '',
        inputs, constraints, outputs, success
    };

    const idx = prompts.findIndex(p => p.id === currentPromptId);
    if (idx !== -1) {
        prompts[idx] = promptData;
        const group = environment.templateGroups[currentTemplateGroup];
        if (group) {
            const gIdx = group.findIndex(p => p.id === currentPromptId);
            if (gIdx !== -1) group[gIdx] = promptData;
        }
    } else {
        prompts.push(promptData);
        currentPromptId = promptData.id;
        if (environment.templateGroups[currentTemplateGroup]) {
            environment.templateGroups[currentTemplateGroup].push(promptData);
        }
    }
    isCreatingNewPrompt = false;
    window.savePromptsToLocalStorage();
    renderPromptsList();
    syncWindowState();
}
window.savePrompt = savePrompt;

function cancelEdit() {
    if (currentPromptId != null) viewPrompt(currentPromptId);
    else showWelcome();
}
window.cancelEdit = cancelEdit;

// =========================
// UI Rendering
// =========================
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

    container.querySelectorAll('.prompt-tile').forEach(item => {
        item.addEventListener('click', () => viewPrompt(parseInt(item.getAttribute('data-id'))));
    });

    let draggedIdx = null;
    container.querySelectorAll('.prompt-tile').forEach(item => {
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
                const group = environment.templateGroups[currentTemplateGroup];
                if (group) {
                    const moved = group.splice(draggedIdx, 1)[0];
                    group.splice(targetIdx, 0, moved);
                    prompts = group.map(normalizePrompt);
                    window.savePromptsToLocalStorage();
                    renderPromptsList();
                    syncWindowState();
                }
            }
        });
    });
}
window.renderPromptsList = renderPromptsList;

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

function viewPrompt(id) {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;
    currentPromptId = id;

    showChrome(true);
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) { welcomeScreen.style.display = 'none'; welcomeScreen.classList.remove('active'); }

    const viewName = document.getElementById('view-name');
    const viewDesc = document.getElementById('view-desc');
    if (viewName) viewName.textContent = prompt.name;
    if (viewDesc) viewDesc.textContent = prompt.description;

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
                    <textarea id="input-value-${idx}" class="view-textarea" rows="6"
                        placeholder="${window.escapeHtml(i.description)}"></textarea>
                </div>
            `).join('');
            inputsContainer.querySelectorAll('textarea').forEach(ta => {
                ta.addEventListener('input', generateViewPrompt);
            });
        }
    }

    generateViewPrompt();
    renderPromptsList();
    syncWindowState();
}

function removeElement(id) {
    const el = document.getElementById(id);
    if (el) { el.remove(); regenerateOutput(); }
}
window.removeElement = removeElement;

// =========================
// Drag-and-Drop (Edit Form Fields)
// =========================
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
            const before = e.clientY < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2;
            container.insertBefore(dragged, before ? item : item.nextSibling);
        });
    });
}
window.makeInputsSortable = () => makeFieldsSortable('inputs-container', '.input-item');
window.makeOutputsSortable = () => makeFieldsSortable('outputs-container', '.output-item');

// =========================
// Prompt Output Generation
// =========================
function generateViewPrompt() {
    const prompt = prompts.find(p => p.id === currentPromptId);
    if (!prompt) return;

    const inputs = {};
    prompt.inputs.forEach((i, idx) => {
        const field = document.getElementById(`input-value-${idx}`);
        inputs[i.name] = field ? field.value : '';
    });

    const outputProperties = {};
    const requiredFields = [];
    prompt.outputs.forEach(o => {
        outputProperties[o.name] = { type: o.type, description: o.description || undefined };
        requiredFields.push(o.name);
    });

    const promptJson = {};
    if (prompt.objective) promptJson.objective = prompt.objective;
    if (prompt.actor) promptJson.actor = prompt.actor;
    if (prompt.context) promptJson.context = prompt.context;
    if (Object.keys(inputs).length > 0) promptJson.input = inputs;
    if (prompt.constraints.length > 0) promptJson.constraints = prompt.constraints;
    promptJson.output_schema = { type: 'object', properties: outputProperties, required: requiredFields };
    if (prompt.success.length > 0) promptJson.success_criteria = prompt.success;

    const outputExample = Object.keys(outputProperties).join(', ');
    promptJson.output_instructions = outputExample
        ? `Return only the output exactly as specified by the properties: ${outputExample}. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array`
        : 'Return only the output exactly as specified by the defined properties. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array';

    const outputEl = document.getElementById('view-output-json');
    if (outputEl) outputEl.textContent = JSON.stringify(promptJson, null, 2);
}
window.generateViewPrompt = generateViewPrompt;

window.regenerateOutput = function () {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen || !editScreen.classList.contains('active')) return;

    const objective = document.getElementById('objective')?.value || '';
    const actor = document.getElementById('actor')?.value || '';
    const context = document.getElementById('context')?.value || '';

    const inputs = {};
    document.querySelectorAll('[id^="input-name-"]').forEach(el => {
        const name = el.value.trim();
        const descEl = document.getElementById(`input-desc-${el.id.split('-')[2]}`);
        if (name) inputs[name] = descEl ? descEl.value.trim() : '';
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
        const typeEl = document.getElementById(`output-type-${el.id.split('-')[2]}`);
        const descEl = document.getElementById(`output-desc-${el.id.split('-')[2]}`);
        if (name) {
            outputs[name] = { type: typeEl ? typeEl.value.trim() || 'string' : 'string', description: descEl ? descEl.value.trim() || undefined : undefined };
            requiredFields.push(name);
        }
    });

    const prompt = {};
    if (objective) prompt.objective = objective;
    if (actor) prompt.actor = actor;
    if (context) prompt.context = context;
    if (Object.keys(inputs).length > 0) prompt.input = inputs;
    if (constraints.length > 0) prompt.constraints = constraints;
    prompt.output_schema = { type: 'object', properties: outputs, required: requiredFields };
    if (success.length > 0) prompt.success_criteria = success;
    prompt.output_instructions = `Return only the output exactly as specified by the properties: ${Object.keys(outputs).join(', ')}. Do not include any extra prose, comments, or code fences.`;

    const outputEl = document.getElementById('generated-output');
    if (outputEl) outputEl.textContent = JSON.stringify(prompt, null, 2);

    const viewScreen = document.getElementById('view-screen');
    if (viewScreen && viewScreen.classList.contains('active')) generateViewPrompt();

    savePrompt();
};

// =========================
// Tab and Screen Management
// =========================
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
    setTabActive('Show Prompt');
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

// =========================
// Input History
// =========================
function getPromptInputHistoryAll() {
    const raw = localStorage.getItem('promptInputHistory');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

function savePromptInputHistory(templateId, inputObj) {
    if (!templateId || !inputObj) return;
    if (Object.values(inputObj).every(v => !v)) return;
    let history = getPromptInputHistoryAll();
    history.unshift({ templateId, inputValues: inputObj });
    localStorage.setItem('promptInputHistory', JSON.stringify(history.slice(0, 50)));
}

function getPromptInputHistory(templateId) {
    return getPromptInputHistoryAll().filter(h => h.templateId === templateId).map(h => h.inputValues);
}

function renderHistoryList(promptId) {
    const history = getPromptInputHistory(promptId);
    const container = document.getElementById('history-list');
    if (!container) return;
    if (!history || history.length === 0) {
        container.innerHTML = '<span style="color:#888;font-size:0.95em;">No input history for this prompt.</span>';
        return;
    }
    const allFields = Array.from(new Set(history.flatMap(h => Object.keys(h))));
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
            Object.entries(selected).forEach(([k, v]) => {
                const input = Array.from(document.querySelectorAll('[id^="input-value-"]')).find(el => {
                    const label = el.previousElementSibling;
                    return label && label.textContent.replace(':', '') === k;
                });
                if (input) input.value = v;
            });
            generateViewPrompt();
        });
    });
}

// =========================
// Import / Export
// =========================
window.exportPrompts = function () {
    if (prompts.length === 0) { alert('No prompts to export'); return; }
    showExportModal();
};

function showExportModal() {
    const modal = document.getElementById('export-modal');
    const grid = document.getElementById('export-template-grid');
    const fileNameInput = document.getElementById('export-file-name');
    if (!modal || !grid || !fileNameInput) return;

    renderCheckboxGrid(grid, prompts, 'export-tpl');
    fileNameInput.value = `prompts-${Date.now()}.json`;
    modal.style.display = 'flex';

    document.getElementById('export-modal-download').onclick = function () {
        const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const selected = prompts.filter(p => checkedIds.includes(String(p.id)));
        if (selected.length === 0) { alert('Please select at least one template to export.'); return; }
        let fileName = fileNameInput.value.trim() || `prompts-${Date.now()}.json`;
        if (!fileName.endsWith('.json')) fileName += '.json';
        downloadJson(selected, fileName);
        modal.style.display = 'none';
    };
    document.getElementById('export-modal-close').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
}

window.importPrompts = function () {
    document.getElementById('import-file').click();
};

function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const loaded = JSON.parse(e.target.result);
            const allTemplates = Array.isArray(loaded) ? loaded : [loaded];
            const existingIds = new Set(prompts.map(p => p.id));
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
    event.target.value = '';
}

function showImportModal(templates, allTemplates) {
    const modal = document.getElementById('import-modal');
    const grid = document.getElementById('import-template-grid');
    const alreadyGrid = document.getElementById('import-already-grid');
    const errorDiv = document.getElementById('import-modal-error');
    if (!modal || !grid || !alreadyGrid || !errorDiv) return;

    errorDiv.style.display = 'none';
    const existingIds = new Set(prompts.map(p => p.id));
    const duplicates = (allTemplates || []).filter(t => t.id && existingIds.has(t.id));
    alreadyGrid.innerHTML = duplicates.length > 0
        ? `<strong>Already imported:</strong><ul style="margin:0.3em 0 0.7em 1.2em;">${duplicates.map(t => `<li>${window.escapeHtml(t.name)}</li>`).join('')}</ul>`
        : '';
    renderCheckboxGrid(grid, templates, 'import-tpl');
    modal.style.display = 'flex';

    document.getElementById('import-modal-confirm').onclick = function () {
        const checkedIds = Array.from(grid.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const selected = templates.filter(t => checkedIds.includes(String(t.id)));
        if (selected.length === 0) {
            errorDiv.textContent = 'Please select at least one template to import.';
            errorDiv.style.display = 'block';
            return;
        }
        const newTemplates = selected.filter(t => !existingIds.has(t.id));
        if (newTemplates.length === 0) {
            errorDiv.textContent = 'No new templates to import (all IDs already exist).';
            errorDiv.style.display = 'block';
            return;
        }
        if (environment.templateGroups[currentTemplateGroup]) {
            environment.templateGroups[currentTemplateGroup] =
                environment.templateGroups[currentTemplateGroup].concat(newTemplates);
            prompts = environment.templateGroups[currentTemplateGroup].map(normalizePrompt);
            window.savePromptsToLocalStorage();
            renderPromptsList();
            modal.style.display = 'none';
            errorDiv.style.display = 'none';
            alert(`Imported ${newTemplates.length} template(s) successfully!`);
            syncWindowState();
        }
    };
    document.getElementById('import-modal-cancel').onclick = function () {
        modal.style.display = 'none';
        errorDiv.style.display = 'none';
    };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };
}

function importPromptFromJson(json) {
    let importedPrompts = Array.isArray(json) ? json : (typeof json === 'object' && json !== null ? [json] : null);
    if (!importedPrompts) { alert('Invalid JSON: Must be a prompt object or array of prompt objects'); return; }

    const existingIds = new Set(prompts.map(p => p.id));
    const newPrompts = importedPrompts.map(normalizePrompt).filter(p => p.id && !existingIds.has(p.id));
    if (newPrompts.length === 0) { alert('No new prompts to import (all IDs already exist)'); return; }

    if (environment.templateGroups[currentTemplateGroup]) {
        environment.templateGroups[currentTemplateGroup] =
            environment.templateGroups[currentTemplateGroup].concat(newPrompts);
        prompts = environment.templateGroups[currentTemplateGroup].map(normalizePrompt);
        window.savePromptsToLocalStorage();
        renderPromptsList();
        closeNewPromptModal();
        alert(`Imported ${newPrompts.length} prompt(s) successfully!`);
        syncWindowState();
    }
}
window.importPromptFromJson = importPromptFromJson;

// =========================
// New Prompt Modal (JSON Import)
// =========================
function openNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const textarea = document.getElementById('json-import-textarea');
    if (textarea) setTimeout(() => textarea.focus(), 50);
}
window.openNewPromptModal = openNewPromptModal;

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

function setupNewPromptModal() {
    const modal = document.getElementById('new-prompt-modal');
    const cancelBtn = document.getElementById('new-prompt-cancel');
    const confirmBtn = document.getElementById('json-import-confirm');

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

// =========================
// Template Group Management
// =========================
function updateTemplateGroupDropdown() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = Object.keys(environment.templateGroups).map(name =>
        `<option value="${name}"${name === currentTemplateGroup ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.value = currentTemplateGroup;
    dropdown.disabled = false;
}

function openCreateGroupModal() {
    const modal = document.getElementById('create-template-group-modal');
    const nameInput = document.getElementById('create-template-group-name');
    const errorDiv = document.getElementById('create-template-group-error');
    if (!modal || !nameInput || !errorDiv) return;
    nameInput.value = '';
    errorDiv.style.display = 'none';
    modal.style.display = 'flex';
}

function setupTemplateGroupHandlers() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (dropdown) {
        dropdown.addEventListener('change', function () {
            currentTemplateGroup = dropdown.value;
            prompts = (environment.templateGroups[currentTemplateGroup] || []).map(normalizePrompt);
            renderPromptsList();
            const infoDisplay = document.getElementById('info-display');
            if (prompts.length > 0) {
                currentPromptId = prompts[0].id;
                viewPrompt(currentPromptId);
                if (infoDisplay) infoDisplay.style.display = '';
            } else {
                currentPromptId = null;
                showWelcome();
            }
            syncWindowState();
        });
    }

    // Save Template Group
    const saveBtn = document.getElementById('save-template-group-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const modal = document.getElementById('save-template-group-modal');
            const select = document.getElementById('save-template-group-select');
            const filenameInput = document.getElementById('save-template-group-filename');
            if (!modal || !select || !filenameInput) return;
            select.innerHTML = Object.keys(environment.templateGroups).map(name =>
                `<option value="${name}">${name}</option>`).join('');
            select.value = currentTemplateGroup;
            filenameInput.value = `${select.value}-template-group-${new Date().toISOString().slice(0, 10)}.json`;
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
            downloadJson({ name: groupName, templates: environment.templateGroups[groupName], history: environment.history[groupName] || [] }, fileName);
            document.getElementById('save-template-group-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-template-group-modal').style.display = 'none'; });

    // Load Template Group
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
                    if (environment.templateGroups[loaded.name]) { alert('Template group with this name already exists.'); return; }
                    environment.templateGroups[loaded.name] = loaded.templates;
                    environment.history[loaded.name] = loaded.history || [];
                    updateTemplateGroupDropdown();
                    alert(`Template group '${loaded.name}' imported successfully!`);
                } catch (err) { alert('Error loading template group: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }

    // Create Template Group
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
            if (environment.templateGroups[groupName]) { errorDiv.textContent = 'A group with this name already exists.'; errorDiv.style.display = 'block'; return; }
            environment.templateGroups[groupName] = [];
            environment.history[groupName] = [];
            currentTemplateGroup = groupName;
            currentPromptId = null;
            updateTemplateGroupDropdown();
            renderPromptsList();
            showWelcome();
            document.getElementById('create-template-group-modal').style.display = 'none';
            errorDiv.style.display = 'none';
            alert(`Template group '${groupName}' created successfully!`);
            syncWindowState();
        });
    }
    if (createCancel) {
        createCancel.addEventListener('click', () => {
            document.getElementById('create-template-group-modal').style.display = 'none';
            document.getElementById('create-template-group-error').style.display = 'none';
        });
    }

    // Delete Template Group
    const deleteConfirm = document.getElementById('delete-template-group-confirm');
    const deleteCancel = document.getElementById('delete-template-group-cancel');
    if (deleteConfirm) {
        deleteConfirm.addEventListener('click', () => {
            const select = document.getElementById('delete-template-group-select');
            const errorDiv = document.getElementById('delete-template-group-error');
            const groupName = select.value;
            if (Object.keys(environment.templateGroups).length <= 1) { errorDiv.textContent = 'At least one group must remain.'; errorDiv.style.display = 'block'; return; }
            if (groupName === currentTemplateGroup) { errorDiv.textContent = 'Cannot delete the currently selected group.'; errorDiv.style.display = 'block'; return; }
            delete environment.templateGroups[groupName];
            delete environment.history[groupName];
            document.getElementById('delete-template-group-modal').style.display = 'none';
            updateTemplateGroupDropdown();
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

// =========================
// Workspace Save / Load
// =========================
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
            downloadJson({ templateGroups: environment.templateGroups, history: environment.history, currentTemplateGroup }, fileName);
            document.getElementById('save-workspace-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-workspace-modal').style.display = 'none'; });

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
                    environment.templateGroups = loaded.templateGroups;
                    environment.history = loaded.history || {};
                    currentTemplateGroup = loaded.currentTemplateGroup || Object.keys(environment.templateGroups)[0] || 'Default';
                    prompts = (environment.templateGroups[currentTemplateGroup] || []).map(normalizePrompt);
                    updateTemplateGroupDropdown();
                    renderPromptsList();
                    if (prompts.length > 0) { currentPromptId = prompts[0].id; viewPrompt(currentPromptId); }
                    else { currentPromptId = null; showWelcome(); }
                    alert('Workspace loaded successfully!');
                    syncWindowState();
                } catch (err) { alert('Error loading workspace: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }
}

// =========================
// App Bar Overflow Menu
// =========================
function setupAppBarMenu() {
    const kebabBtn = document.getElementById('app-bar-kebab');
    const menu = document.getElementById('app-bar-menu');
    if (!kebabBtn || !menu) return;

    const toggleMenu = () => { menu.style.display = menu.style.display === 'block' ? 'none' : 'block'; };
    kebabBtn.addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });
    kebabBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleMenu(); });
    document.addEventListener('click', e => {
        if (menu.style.display === 'block' && !menu.contains(e.target) && e.target !== kebabBtn) menu.style.display = 'none';
    });

    const menuActions = {
        'menu-save-workspace': () => document.getElementById('save-workspace-btn').click(),
        'menu-load-workspace': () => document.getElementById('load-workspace-btn').click(),
        'menu-save-template-group': () => document.getElementById('save-template-group-btn').click(),
        'menu-load-template-group': () => document.getElementById('load-template-group-btn').click(),
        'menu-export-templates': () => window.exportPrompts(),
        'menu-import-templates': () => document.getElementById('import-file').click(),
        'menu-create-template-group': openCreateGroupModal,
        'menu-delete-template-group': () => {
            const modal = document.getElementById('delete-template-group-modal');
            const select = document.getElementById('delete-template-group-select');
            const errorDiv = document.getElementById('delete-template-group-error');
            if (!modal || !select || !errorDiv) return;
            select.innerHTML = Object.keys(environment.templateGroups).map(name => `<option value="${name}">${name}</option>`).join('');
            errorDiv.style.display = 'none';
            modal.style.display = 'flex';
        }
    };

    Object.entries(menuActions).forEach(([id, action]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', () => { menu.style.display = 'none'; action(); });
    });

    const menuReset = document.getElementById('menu-reset-templates');
    if (menuReset) menuReset.style.display = 'none';
}

// =========================
// Tab Setup
// =========================
function setupTabListeners() {
    const editTabBtn = document.getElementById('tab-edit');
    if (editTabBtn) {
        editTabBtn.addEventListener('click', function () {
            if (currentPromptId) editPrompt(currentPromptId);
            else { clearForm(); showEdit(); }
        });
    }
}

// =========================
// App Startup
// =========================
function startApp() {
    initApp();

    const saveBtn = document.getElementById('save-prompt');
    if (saveBtn) saveBtn.addEventListener('click', savePrompt);
    const cancelBtn = document.getElementById('cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    // Tab buttons (onclick attrs removed from HTML, wired here)
    const viewTabBtn = document.getElementById('tab-view');
    if (viewTabBtn) viewTabBtn.addEventListener('click', () => { if (currentPromptId) showView(); });
    const historyTabBtn = document.getElementById('tab-history');
    if (historyTabBtn) historyTabBtn.addEventListener('click', () => { if (currentPromptId) showHistory(); });
    const outputTabBtn = document.getElementById('tab-output');
    if (outputTabBtn) outputTabBtn.addEventListener('click', () => { if (currentPromptId) showPromptOutput(); });

    // Delete modal
    const deleteBtn = document.getElementById('delete-prompt');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-prompt');
    const cancelDeleteBtn = document.getElementById('cancel-delete-prompt');
    if (deleteBtn && deleteModal && confirmDeleteBtn && cancelDeleteBtn) {
        deleteBtn.addEventListener('click', () => { deleteModal.style.display = 'flex'; });
        cancelDeleteBtn.addEventListener('click', () => { deleteModal.style.display = 'none'; });
        confirmDeleteBtn.addEventListener('click', () => {
            deleteModal.style.display = 'none';
            if (currentPromptId != null) deletePrompt(currentPromptId);
        });
        deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.style.display = 'none'; });
    }

    // Copy button
    const copyBtn = document.getElementById('copy-view-output');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const prompt = prompts.find(p => p.id === currentPromptId);
            if (!prompt) return;
            const inputs = {};
            prompt.inputs.forEach((i, idx) => {
                const field = document.getElementById(`input-value-${idx}`);
                inputs[i.name] = field ? field.value : '';
            });
            savePromptInputHistory(prompt.id, inputs);
            const historyScreen = document.getElementById('history-screen');
            if (historyScreen && historyScreen.classList.contains('active')) renderHistoryList(prompt.id);
            const pre = document.getElementById('view-output-json');
            const modal = document.getElementById('copy-modal');
            if (pre) navigator.clipboard.writeText(pre.value).then(() => { if (modal) modal.style.display = 'flex'; });
        });
    }

    // Copy modal close
    const closeCopyModal = document.getElementById('close-copy-modal');
    const copyModal = document.getElementById('copy-modal');
    if (closeCopyModal) closeCopyModal.addEventListener('click', () => { if (copyModal) copyModal.style.display = 'none'; });
    if (copyModal) copyModal.addEventListener('click', e => { if (e.target === copyModal) copyModal.style.display = 'none'; });

    // Add field buttons
    const addInputBtn = document.getElementById('add-input');
    if (addInputBtn) addInputBtn.addEventListener('click', () => { if (window.addInput) window.addInput(); });
    const addConstraintBtn = document.getElementById('add-constraint');
    if (addConstraintBtn) addConstraintBtn.addEventListener('click', () => { if (window.addConstraint) window.addConstraint(); });
    const addOutputBtn = document.getElementById('add-output');
    if (addOutputBtn) addOutputBtn.addEventListener('click', () => { if (window.addOutput) window.addOutput(); });
    const addSuccessBtn = document.getElementById('add-success');
    if (addSuccessBtn) addSuccessBtn.addEventListener('click', () => { if (window.addSuccess) window.addSuccess(); });

    // Sidebar buttons
    const importJsonBtn = document.getElementById('import-json-btn');
    if (importJsonBtn) importJsonBtn.addEventListener('click', openNewPromptModal);
    const blankPromptBtn = document.getElementById('blank-prompt-btn');
    if (blankPromptBtn) blankPromptBtn.addEventListener('click', startBlankPrompt);

    // File import
    const importFile = document.getElementById('import-file');
    if (importFile) importFile.addEventListener('change', handleImport);

    setupNewPromptModal();
    setupWorkspaceHandlers();
    setupTemplateGroupHandlers();
    setupAppBarMenu();
}

startApp();
