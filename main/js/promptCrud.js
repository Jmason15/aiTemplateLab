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
