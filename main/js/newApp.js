// --- LocalStorage helpers ---





let prompts = [...window.preloadedPrompts];

let currentPromptId = null;
let isCreatingNewPrompt = false;
let inputCounter = 0;
let constraintCounter = 0;
let outputCounter = 0;
let successCounter = 0;

function initApp() {
    // Hide tab bar on load
    setTabBarVisible(false);

    const btn = document.getElementById('togglePrompt');
    const section = document.getElementById('myCollapsibleSection');
    if (btn && section) {
        btn.addEventListener('click', () => {
            const isOpen = section.classList.toggle('show');
            btn.setAttribute('aria-expanded', isOpen);
        });
    }

    // Initialize
    function init() {
        window.loadPromptsFromLocalStorage();
        renderPromptsList();
        if (prompts.length > 0) {
            viewPrompt(prompts[0].id);
        } else {
            showWelcome();
        }
    }

    function renderPromptsList() {
        const container = document.getElementById('prompts-list');
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
        setTabBarVisible(true);
        renderPromptsList();
    }

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

    function viewPrompt(id) {
        const prompt = prompts.find(p => p.id === id);
        if (!prompt) return;

        currentPromptId = id;
        showView();
        setTabActive('View');

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

    function editPrompt(id) {
        const prompt = prompts.find(p => p.id === id);
        if (!prompt) {
            console.error('Prompt not found for editing:', id);
            return;
        }

        console.log('Editing prompt:', prompt);
        currentPromptId = id;

        // Clear the form first
        document.getElementById('inputs-container').innerHTML = '';
        document.getElementById('constraints-container').innerHTML = '';
        document.getElementById('outputs-container').innerHTML = '';
        document.getElementById('success-container').innerHTML = '';

        inputCounter = 0;
        constraintCounter = 0;
        outputCounter = 0;
        successCounter = 0;

        // Load the prompt data into edit form
        document.getElementById('prompt-name').value = prompt.name;
        document.getElementById('prompt-desc').value = prompt.description;
        document.getElementById('objective').value = prompt.objective;
        document.getElementById('actor').value = prompt.actor;
        document.getElementById('context').value = prompt.context;

        // Clear outputs container before loading
        document.getElementById('outputs-container').innerHTML = '';
        outputCounter = 0;

        // Load only this prompt's data
        prompt.inputs.forEach(i => addInput(i.name, i.description));
        prompt.constraints.forEach(c => addConstraint(c));
        prompt.outputs.forEach(o => addOutput(o.name, o.type, o.description));
        prompt.success.forEach(s => addSuccess(s));

        showEdit();
        setTabActive('Edit');
    }


    function deletePrompt(id) {
        if (!confirm('Delete this prompt?')) return;
        prompts = prompts.filter(p => p.id !== id);
        window.savePromptsToLocalStorage();
        renderPromptsList();

        // If we're viewing the deleted prompt, go back to welcome
        if (currentPromptId === id) {
            currentPromptId = null;
            showWelcome();
        }
    }

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

    // window.copyViewOutput = function() {
    //     const output = document.getElementById('view-output-json').textContent;
    //     navigator.clipboard.writeText(output).then(() => {
    //         alert('Copied to clipboard!');
    //     });
    // }

    // window.downloadViewOutput = function() {
    //     const output = document.getElementById('view-output-json').textContent;
    //     const blob = new Blob([output], { type: 'application/json' });
    //     const url = URL.createObjectURL(blob);
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = 'prompt.json';
    //     a.click();
    //     URL.revokeObjectURL(url);
    // }

    window.addInput = function (name = '', description = '') {
        inputCounter++;
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

        makeInputsSortable(); // attach drag events
    }

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

    window.addConstraint = function(text = '') {
        constraintCounter++;
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
    }

    window.addOutput= function (name = '', type = 'string', description = '') {
        outputCounter++;
        const container = document.getElementById('outputs-container');

        const div = document.createElement('div');
        const id = `output-${outputCounter}`;
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
        nameInput.id = `output-name-${outputCounter}`;
        nameInput.placeholder = 'e.g., title';
        nameInput.value = name;
        nameInput.addEventListener('input', regenerateOutput);

        const typeInput = document.createElement('input');
        typeInput.type = 'text';
        typeInput.id = `output-type-${outputCounter}`;
        typeInput.placeholder = 'string';
        typeInput.value = type;
        typeInput.addEventListener('input', regenerateOutput);

        const descInput = document.createElement('textarea');
        descInput.id = `output-desc-${outputCounter}`;
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
        descLabel.textContent = 'Description';
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
        makeOutputsSortable();
    }

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
    window.addSuccess = function(text = '') {
        successCounter++;
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
    }

    function removeElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.remove();
            regenerateOutput();
        }
    }

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
        savePrompt()
    }

    function setTabActive(tabName) {
        const tabs = document.querySelectorAll('#tabs button');
        tabs.forEach(btn => {
            if (tabName && btn.textContent.includes(tabName)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function setTabBarVisible(visible) {
        const tabs = document.getElementById('tabs');
        if (tabs) {
            tabs.style.display = visible ? 'flex' : 'none';
        }
    }

    function showWelcome() {
        isCreatingNewPrompt = false;
        document.getElementById('welcome-screen').classList.add('active');
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('view-screen').classList.remove('active');
        document.getElementById('view-screen').style.display = 'none';
        document.getElementById('edit-screen').classList.remove('active');
        document.getElementById('edit-screen').style.display = 'none';
        setTabActive(null); // No tab active
        setTabBarVisible(false); // Hide tabs
        renderPromptsList();
    }

    function showView() {
        if (!currentPromptId) {
            showWelcome();
            return;
        }
        var welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.classList.remove('active');
            welcomeScreen.style.display = 'none';
        }
        document.getElementById('view-screen').classList.add('active');
        document.getElementById('view-screen').style.display = 'block';
        document.getElementById('edit-screen').classList.remove('active');
        document.getElementById('edit-screen').style.display = 'none';
        setTabActive('View');
        setTabBarVisible(true); // Show tabs
    }

    function showEdit() {
        if (!currentPromptId && !isCreatingNewPrompt) {
            showWelcome();
            return;
        }
        document.getElementById('welcome-screen').classList.remove('active');
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('view-screen').classList.remove('active');
        document.getElementById('view-screen').style.display = 'none';
        document.getElementById('edit-screen').classList.add('active');
        document.getElementById('edit-screen').style.display = 'flex';
        hideValidation(); // Clear any previous validation messages
        setTabActive('Edit');
        setTabBarVisible(true); // Show tabs
        renderPromptsList();
    }

    window.editPrompt = editPrompt;
    window.showEdit = showEdit;
    window.showView = showView;

    window.cancelEdit = function() {
        if (currentPromptId) {
            isCreatingNewPrompt = false;
            viewPrompt(currentPromptId);
            setTabActive('View');
        } else {
            isCreatingNewPrompt = false;
            showWelcome();
            setTabActive(null);
        }
    }

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
    }

    function showExportModal(data) {
        const modal = document.getElementById('export-modal');
        const textarea = document.getElementById('export-modal-textarea');
        textarea.value = data;
        modal.style.display = 'flex';
        textarea.select();

        document.getElementById('export-modal-copy').onclick = function() {
            textarea.select();
            document.execCommand('copy');
        };
        document.getElementById('export-modal-close').onclick = function() {
            modal.style.display = 'none';
        };
        // Optional: close modal when clicking outside
        modal.onclick = function(e) {
            if (e.target === modal) modal.style.display = 'none';
        };
    }

    // function copyExportData() {
    //     const textarea = document.querySelector('[readonly]');
    //     textarea.select();
    //     document.execCommand('copy');
    //     alert('Copied to clipboard! Paste into a text editor and save as .json');
    // }

    // function closeExportModal() {
    //     const modal = document.querySelector('[style*="position: fixed"]');
    //     if (modal) modal.remove();
    // }

    window.importPrompts = function() {
        document.getElementById('import-file').click();
    }

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



    init();

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

    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        // Add event listeners for Save and Cancel buttons
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
    });
}

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
        textarea.value = '';
        fileInput.value = '';
        filenameSpan.textContent = '';
        errorDiv.textContent = '';
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
    uploadBtn.onclick = function() {
        fileInput.click();
    };
    fileInput.onchange = function() {
        const file = fileInput.files[0];
        if (!file) return;
        filenameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = function(ev) {
            textarea.value = ev.target.result;
        };
        reader.readAsText(file);
    };
    confirmBtn.onclick = function() {
        let json;
        try {
            json = JSON.parse(textarea.value);
        } catch (err) {
            errorDiv.textContent = 'Invalid JSON: ' + err.message;
            return;
        }
        let promptObj = null;
        if (Array.isArray(json)) {
            if (json.length === 0) {
                errorDiv.textContent = 'JSON array is empty.';
                return;
            }
            promptObj = json[0];
        } else {
            promptObj = json;
        }
        if (!promptObj || typeof promptObj !== 'object') {
            errorDiv.textContent = 'JSON must be a prompt object or array.';
            return;
        }
        const newPrompt = {
            id: Date.now(),
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
        window.savePromptsToLocalStorage();
        currentPromptId = newPrompt.id;
        isCreatingNewPrompt = false;
        editPrompt(newPrompt.id);
        setTabActive('Edit');
        setTabBarVisible(true);
        renderPromptsList();
        closeModal();
        setTimeout(() => alert('Prompt loaded!'), 100);
    };
}


