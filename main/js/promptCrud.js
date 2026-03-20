// Prompt CRUD, list rendering, view, and edit-form drag-drop — depends on state.js, screens.js, promptOutput.js

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
    window.savePromptsToLocalStorage();
    renderPromptsList();
    syncWindowState();
}
window.savePrompt = savePrompt;

window.regenerateOutput = function () {
    const editScreen = document.getElementById('edit-screen');
    if (!editScreen || !editScreen.classList.contains('active')) return;
    savePrompt();
};

function cancelEdit() {
    if (currentPromptId != null) viewPrompt(currentPromptId);
    else showWelcome();
}
window.cancelEdit = cancelEdit;

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
