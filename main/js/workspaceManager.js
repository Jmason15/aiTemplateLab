/**
 * @fileoverview Template group management, workspace save/load, and app-bar overflow menu.
 *
 * Terminology:
 *   Workspace     — the full environment: all template groups + their history,
 *                   saved/loaded as a single JSON file.
 *   Template group — a named collection of prompts (e.g. "Default", "Jira").
 *                   Users can create, rename, save, load, and delete groups.
 *
 * Load order: depends on state.js, storage.js, screens.js, and promptCrud.js.
 */

/**
 * Rebuilds the template group <select> dropdown from state.environment.templateGroups
 * and ensures the currently active group is selected.
 */
function updateTemplateGroupDropdown() {
    const dropdown = document.getElementById('template-group-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = Object.keys(state.environment.templateGroups).map(name =>
        `<option value="${name}"${name === state.currentTemplateGroup ? ' selected' : ''}>${name}</option>`
    ).join('');
    dropdown.value = state.currentTemplateGroup;
    dropdown.disabled = false;
}

/**
 * Opens the Create Template Group modal with a blank name field.
 * Also called from the app-bar overflow menu.
 */
function openCreateGroupModal() {
    const modal = document.getElementById('create-template-group-modal');
    const nameInput = document.getElementById('create-template-group-name');
    const errorDiv = document.getElementById('create-template-group-error');
    if (!modal || !nameInput || !errorDiv) return;
    nameInput.value = '';
    errorDiv.style.display = 'none';
    modal.style.display = 'flex';
}

/**
 * Wires all template group UI interactions:
 *   - Dropdown change (switch active group)
 *   - Save / Load / Create / Delete group modals and their confirm/cancel buttons
 * Called once during app startup.
 */
function setupTemplateGroupHandlers() {
    // Switch active group when the dropdown changes.
    const dropdown = document.getElementById('template-group-dropdown');
    if (dropdown) {
        dropdown.addEventListener('change', function () {
            state.setCurrentTemplateGroup(dropdown.value);
            state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));
            renderPromptsList();
            const infoDisplay = document.getElementById('info-display');
            if (state.prompts.length > 0) {
                state.setCurrentPromptId(state.prompts[0].id);
                viewPrompt(state.currentPromptId);
                if (infoDisplay) infoDisplay.style.display = '';
            } else {
                state.setCurrentPromptId(null);
                showWelcome();
            }
        });
    }

    // Save Template Group — exports one group to a JSON file.
    const saveBtn = document.getElementById('save-template-group-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const modal = document.getElementById('save-template-group-modal');
            const select = document.getElementById('save-template-group-select');
            const filenameInput = document.getElementById('save-template-group-filename');
            if (!modal || !select || !filenameInput) return;
            select.innerHTML = Object.keys(state.environment.templateGroups).map(name =>
                `<option value="${name}">${name}</option>`).join('');
            select.value = state.currentTemplateGroup;
            filenameInput.value = `${select.value}-template-group-${new Date().toISOString().slice(0, 10)}.json`;
            // Update suggested filename when the group selection changes.
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
            downloadJson({ name: groupName, templates: state.environment.templateGroups[groupName], history: state.environment.history[groupName] || [] }, fileName);
            document.getElementById('save-template-group-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-template-group-modal').style.display = 'none'; });

    // Load Template Group — imports a group file saved by the above.
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
                    if (state.environment.templateGroups[loaded.name]) { alert('Template group with this name already exists.'); return; }
                    state.environment.templateGroups[loaded.name] = loaded.templates;
                    state.environment.history[loaded.name] = loaded.history || [];
                    updateTemplateGroupDropdown();
                    renderPromptsList();
                    alert(`Template group '${loaded.name}' imported successfully!`);
                } catch (err) { alert('Error loading template group: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }

    // Create Template Group — adds a new empty group.
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
            if (state.environment.templateGroups[groupName]) { errorDiv.textContent = 'A group with this name already exists.'; errorDiv.style.display = 'block'; return; }
            state.environment.templateGroups[groupName] = [];
            state.environment.history[groupName] = [];
            state.setCurrentTemplateGroup(groupName);
            state.setCurrentPromptId(null);
            updateTemplateGroupDropdown();
            renderPromptsList();
            showWelcome();
            document.getElementById('create-template-group-modal').style.display = 'none';
            errorDiv.style.display = 'none';
            alert(`Template group '${groupName}' created successfully!`);
        });
    }
    if (createCancel) {
        createCancel.addEventListener('click', () => {
            document.getElementById('create-template-group-modal').style.display = 'none';
            document.getElementById('create-template-group-error').style.display = 'none';
        });
    }

    // Delete Template Group — guarded: cannot delete the active group or
    // the last remaining group.
    const deleteConfirm = document.getElementById('delete-template-group-confirm');
    const deleteCancel = document.getElementById('delete-template-group-cancel');
    if (deleteConfirm) {
        deleteConfirm.addEventListener('click', () => {
            const select = document.getElementById('delete-template-group-select');
            const errorDiv = document.getElementById('delete-template-group-error');
            const groupName = select.value;
            if (Object.keys(state.environment.templateGroups).length <= 1) { errorDiv.textContent = 'At least one group must remain.'; errorDiv.style.display = 'block'; return; }
            if (groupName === state.currentTemplateGroup) { errorDiv.textContent = 'Cannot delete the currently selected group.'; errorDiv.style.display = 'block'; return; }
            delete state.environment.templateGroups[groupName];
            delete state.environment.history[groupName];
            document.getElementById('delete-template-group-modal').style.display = 'none';
            updateTemplateGroupDropdown();
            renderPromptsList();
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

/**
 * Wires the workspace save and load buttons.
 * Save: downloads the full environment (all groups + history) as one JSON file.
 * Load: replaces the entire environment from a previously saved workspace file.
 *       Shows a warning modal first because this overwrites all current data.
 * Called once during app startup.
 */
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
            // Include currentTemplateGroup so the workspace reopens on the same group.
            downloadJson({ templateGroups: state.environment.templateGroups, history: state.environment.history, currentTemplateGroup: state.currentTemplateGroup }, fileName);
            document.getElementById('save-workspace-modal').style.display = 'none';
        });
    }
    if (saveCancel) saveCancel.addEventListener('click', () => { document.getElementById('save-workspace-modal').style.display = 'none'; });

    // Load — shows a destructive-action warning before opening the file picker.
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
                    state.environment.templateGroups = loaded.templateGroups;
                    state.environment.history = loaded.history || {};
                    state.setCurrentTemplateGroup(loaded.currentTemplateGroup || Object.keys(state.environment.templateGroups)[0] || 'Default');
                    state.setPrompts((state.environment.templateGroups[state.currentTemplateGroup] || []).map(normalizePrompt));
                    updateTemplateGroupDropdown();
                    renderPromptsList();
                    if (state.prompts.length > 0) {
                        state.setCurrentPromptId(state.prompts[0].id);
                        viewPrompt(state.currentPromptId);
                    } else {
                        state.setCurrentPromptId(null);
                        showWelcome();
                    }
                    alert('Workspace loaded successfully!');
                } catch (err) { alert('Error loading workspace: ' + err.message); }
            };
            reader.readAsText(file);
            event.target.value = '';
        });
    }
}

/**
 * Wires the Windows-style menu bar (Workspace | Templates | Groups).
 * Each top-level button toggles its dropdown. Hovering over a sibling
 * while any dropdown is open switches immediately (Windows behaviour).
 * Called once during app startup.
 */
function setupMenuBar() {
    const closeAll = () => {
        document.querySelectorAll('.menu-bar-dropdown').forEach(d => d.classList.remove('open'));
        const mobilePanel = document.getElementById('mobile-menu-panel');
        if (mobilePanel) mobilePanel.classList.remove('open');
    };

    // Toggle on click; switch on hover when any dropdown is already open.
    document.querySelectorAll('.menu-bar-item').forEach(item => {
        const btn = item.querySelector('.menu-bar-btn');
        const dropdown = item.querySelector('.menu-bar-dropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            closeAll();
            if (!isOpen) dropdown.classList.add('open');
        });

        item.addEventListener('mouseenter', () => {
            if (document.querySelector('.menu-bar-dropdown.open')) {
                closeAll();
                dropdown.classList.add('open');
            }
        });
    });

    // Close on any outside click.
    document.addEventListener('click', () => closeAll());

    // Workspace menu.
    document.getElementById('menu-save-workspace')?.addEventListener('click', () => { closeAll(); document.getElementById('save-workspace-btn').click(); });
    document.getElementById('menu-load-workspace')?.addEventListener('click', () => { closeAll(); document.getElementById('load-workspace-btn').click(); });
    document.getElementById('menu-clear-storage')?.addEventListener('click', () => { closeAll(); document.getElementById('clear-storage-modal').style.display = 'flex'; });
    const liveSiteBtn = document.getElementById('menu-live-site');
    if (liveSiteBtn) {
        if (window.location.hostname === 'jmason15.github.io') {
            liveSiteBtn.style.display = 'none';
        } else {
            liveSiteBtn.addEventListener('click', () => { closeAll(); window.open('https://jmason15.github.io/aiTemplateLab/', '_blank', 'noopener'); });
        }
    }
    document.getElementById('menu-download-app')?.addEventListener('click', () => { closeAll(); window.open('https://github.com/Jmason15/aiTemplateLab/releases/latest/download/aiTemplateLab.html', '_blank', 'noopener'); });

    // Templates menu.
    document.getElementById('menu-new-template')?.addEventListener('click', () => { closeAll(); startBlankPrompt(); });
    document.getElementById('menu-import-templates')?.addEventListener('click', () => { closeAll(); if (typeof openNewPromptModal === 'function') openNewPromptModal(); });
    document.getElementById('menu-export-templates')?.addEventListener('click', () => { closeAll(); if (typeof window.exportPrompts === 'function') window.exportPrompts(); });

    // Groups menu.
    document.getElementById('menu-create-template-group')?.addEventListener('click', () => { closeAll(); openCreateGroupModal(); });
    document.getElementById('menu-save-template-group')?.addEventListener('click', () => { closeAll(); document.getElementById('save-template-group-btn').click(); });
    document.getElementById('menu-load-template-group')?.addEventListener('click', () => { closeAll(); document.getElementById('load-template-group-btn').click(); });
    document.getElementById('menu-delete-template-group')?.addEventListener('click', () => {
        closeAll();
        const modal = document.getElementById('delete-template-group-modal');
        const select = document.getElementById('delete-template-group-select');
        const errorDiv = document.getElementById('delete-template-group-error');
        if (!modal || !select || !errorDiv) return;
        select.innerHTML = Object.keys(state.environment.templateGroups).map(name => `<option value="${window.escapeHtml(name)}">${window.escapeHtml(name)}</option>`).join('');
        errorDiv.style.display = 'none';
        modal.style.display = 'flex';
    });

    // Clear storage confirmation modal.
    const clearConfirm = document.getElementById('clear-storage-confirm');
    const clearCancel = document.getElementById('clear-storage-cancel');
    const clearModal = document.getElementById('clear-storage-modal');
    if (clearConfirm) clearConfirm.addEventListener('click', () => { localStorage.clear(); location.reload(); });
    if (clearCancel) clearCancel.addEventListener('click', () => { clearModal.style.display = 'none'; });
    if (clearModal) clearModal.addEventListener('click', e => { if (e.target === clearModal) clearModal.style.display = 'none'; });

    // Help menu.
    const helpContent = {
        'help-what-is-template': {
            title: 'What is a Template?',
            content: `<p>A <strong>template</strong> is a pre-built AI prompt designed for a specific task.</p>
                <p>Instead of figuring out what to say to an AI from scratch every time, a template does the hard work for you. It knows the right structure, the right instructions, and the right questions to ask — you just fill in your specific details.</p>
                <p><strong>Example:</strong> The "Jira Story Generator" template already knows how to turn messy ticket notes into a clean user story with acceptance criteria. You paste in your notes, click Create Prompt, and paste the result into your favorite AI tool.</p>
                <p>Think of templates like smart forms — they turn your raw information into a polished, professional AI prompt every time.</p>`
        },
        'help-what-is-group': {
            title: 'What is a Template Group?',
            content: `<p>A <strong>template group</strong> is a folder of related templates kept together.</p>
                <p>As you build up a library of templates, groups keep things organised. You might have a group for your development work, another for writing, and another for customer service — each with its own set of templates tailored to that area.</p>
                <p><strong>Example:</strong> A marketing team might have a "Social Media" group with templates for captions, hashtags, and post ideas — and a separate "Email" group for subject lines and newsletters.</p>
                <p>You can switch between groups from the sidebar, and save or share a whole group as a single file.</p>`
        },
        'help-how-to-use': {
            title: 'How to use this app',
            content: `<ol style="padding-left:1.25rem; margin:0; display:flex; flex-direction:column; gap:0.75rem;">
                <li><strong>Pick a template from the sidebar.</strong> Each template is built for a specific task. If you don't see one you need, use the Template Builder to create one.</li>
                <li><strong>Fill in the fields under "Use Template".</strong> Each field tells you exactly what to provide — just type in your information.</li>
                <li><strong>Click "Create Prompt".</strong> The app assembles everything into a complete, structured AI prompt.</li>
                <li><strong>Copy and paste into your AI tool.</strong> Paste the result into your favorite AI tool and get a high-quality response.</li>
                <li><strong>Come back and reuse it.</strong> Next time you need the same kind of result, your template is already here waiting.</li>
            </ol>`
        },
        'help-why-important': {
            title: 'Why is this app important?',
            content: `<p>Most people type a quick message to an AI and hope for the best — then wonder why the results are inconsistent or off-target.</p>
                <p>The truth is, <strong>the quality of your AI output is only as good as the quality of your prompt.</strong> A vague question gets a vague answer. A well-structured prompt gets a precise, useful result.</p>
                <p>aiTemplateLab solves this by letting you:</p>
                <ul style="padding-left:1.25rem; margin:0.5rem 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li><strong>Build prompts once</strong> and reuse them forever.</li>
                    <li><strong>Get consistent results</strong> every time, not just when you happen to phrase things well.</li>
                    <li><strong>Share your best prompts</strong> with your team so everyone benefits.</li>
                    <li><strong>Stop starting from scratch</strong> — your prompt library grows with you.</li>
                </ul>
                <p style="margin-top:0.75rem;">Whether you use AI daily or occasionally, having the right template means less frustration and better results — every single time.</p>`
        },
        'help-template-lab': {
            title: 'Using the Template Lab',
            content: `<p>The <strong>Template Lab</strong> group contains three tools that let you build new templates using an AI. Switch to the Template Lab group in the sidebar to get started.</p>
                <p><strong>Template Builder</strong> — Creates a single new template from a plain-English idea.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li>Pick <em>Template Builder</em> from the sidebar and open <em>Use Template</em>.</li>
                    <li>Describe what you want — e.g. <em>"A prompt that turns meeting notes into action items."</em></li>
                    <li>Click <strong>Create Prompt</strong> and copy the result.</li>
                    <li>Paste it into your favorite AI tool. It will return a complete template as JSON.</li>
                    <li>Copy the response, then click the green <strong>Import Template From AI</strong> button in the sidebar, paste it in, and click Import.</li>
                </ol>
                <p><strong>Template Group Generator</strong> — Creates a full set of templates for a specific job or role.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li>Enter your job title or area of work — e.g. <em>"Marketing Manager"</em>.</li>
                    <li>Run it through your AI tool. You'll get a whole group of templates covering every common task for that role.</li>
                    <li>Copy the response, click <strong>Import Template From AI</strong> in the sidebar, paste it in, and click Import — your whole group appears at once.</li>
                </ol>
                <p><strong>Workflow Generator</strong> — Breaks a multi-step goal into a sequence of templates, one per stage.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 0 0; display:flex; flex-direction:column; gap:0.4rem;">
                    <li>Describe your goal — e.g. <em>"Write and publish a blog post."</em></li>
                    <li>The AI generates a chain of templates where the output of each step feeds into the next.</li>
                    <li>Copy the response, click <strong>Import Template From AI</strong> in the sidebar, paste it in, and click Import — all steps appear ready to run in order.</li>
                </ol>`
        },
        'help-create-from-scratch': {
            title: 'Creating a template from scratch',
            content: `<p>You can build a template entirely by hand — no AI needed — using the blank template editor.</p>
                <ol style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.5rem;">
                    <li><strong>Open a blank template.</strong> Click <em>New Blank Template</em> in the sidebar, or go to <em>Templates → New</em> in the menu bar.</li>
                    <li><strong>Give it a name and description.</strong> The name appears in the sidebar; the description helps you remember what the template is for.</li>
                    <li><strong>Fill in the sections.</strong> Work through Objective, Actor, Context, and the rest at your own pace. You don't need to fill in every section — just what's useful for your task.</li>
                    <li><strong>Add inputs.</strong> Inputs are the fields you fill in each time you use the template. Click <em>Add Input</em>, give each one a clear label, and optionally add a placeholder example so you remember what to type.</li>
                    <li><strong>Click Save.</strong> Your template appears in the sidebar immediately, ready to use.</li>
                </ol>
                <p><strong>Tip:</strong> If you're not sure what to write, open the <em>See an Example</em> section on any existing template to see how it's structured — then model yours on that.</p>`
        },
        'help-edit-screen': {
            title: 'What does the Edit screen do?',
            content: `<p>The <strong>Edit Template</strong> tab lets you modify any template. Click it while a template is selected to open the editor.</p>
                <p><strong>Sections you can edit:</strong></p>
                <ul style="padding-left:1.25rem; margin:0.5rem 0 1rem 0; display:flex; flex-direction:column; gap:0.5rem;">
                    <li><strong>Name &amp; Description</strong> — What appears in the sidebar and at the top of the template view.</li>
                    <li><strong>Example</strong> — An optional plain-English walkthrough that appears in the "See an Example" section when using the template. Great for helping others understand what the template is for.</li>
                    <li><strong>Objective</strong> — What the prompt is trying to achieve.</li>
                    <li><strong>Actor</strong> — The role or persona the AI should take on (e.g. "a senior software engineer").</li>
                    <li><strong>Context</strong> — Background information the AI needs to know before it starts.</li>
                    <li><strong>Inputs</strong> — The fields you fill in each time you use the template. Each input has a label, a description, and an optional placeholder example. Use the <em>Add Input</em> button to add more.</li>
                    <li><strong>Constraints</strong> — Rules the AI must follow (e.g. "Keep the response under 200 words"). Use <em>Add Constraint</em> to add more.</li>
                    <li><strong>Outputs</strong> — What the AI should return, and in what format. Use <em>Add Output</em> to add more.</li>
                    <li><strong>Success Criteria</strong> — How you know the result is good. Use <em>Add Success Criterion</em> to add more.</li>
                </ul>
                <p><strong>Auto-save:</strong> Changes are saved automatically as you type — no need to click Save unless you want to force a save immediately.</p>`
        }
    };

    const helpModal = document.getElementById('help-modal');
    const helpTitle = document.getElementById('help-modal-title');
    const helpBody = document.getElementById('help-modal-content');
    const helpClose = document.getElementById('help-modal-close');

    // Expose globally so home screen chips can open the modal by key.
    window.showHelpModal = function(key) {
        const data = helpContent[key];
        if (!data || !helpModal) return;
        helpTitle.textContent = data.title;
        helpBody.innerHTML = data.content;
        helpModal.style.display = 'flex';
    };

    Object.entries(helpContent).forEach(([id, data]) => {
        document.getElementById(id)?.addEventListener('click', () => {
            closeAll();
            window.showHelpModal(id);
        });
    });

    // Wire home screen help chips (delegated, chips may not exist yet).
    document.addEventListener('click', e => {
        const chip = e.target.closest('.home-help-chip');
        if (chip && chip.dataset.help) {
            window.showHelpModal(chip.dataset.help);
        }
    });

    if (helpClose) helpClose.addEventListener('click', () => { helpModal.style.display = 'none'; });
    if (helpModal) helpModal.addEventListener('click', e => { if (e.target === helpModal) helpModal.style.display = 'none'; });

    // Home button — navigate to the welcome/home screen.
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) homeBtn.addEventListener('click', () => { closeAll(); state.setCurrentPromptId(null); showWelcome(); });

    // Mobile menu toggle.
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobilePanel = document.getElementById('mobile-menu-panel');
    if (mobileMenuBtn && mobilePanel) {
        mobileMenuBtn.addEventListener('click', e => {
            e.stopPropagation();
            mobilePanel.classList.toggle('open');
        });
    }

    // Wire mobile menu buttons — proxy to the same handlers as desktop.
    const mob = (id, fn) => document.getElementById(id)?.addEventListener('click', () => { closeAll(); fn(); });
    mob('mob-save-workspace',   () => document.getElementById('save-workspace-btn').click());
    mob('mob-load-workspace',   () => document.getElementById('load-workspace-btn').click());
    mob('mob-live-site',        () => window.open('https://jmason15.github.io/aiTemplateLab/', '_blank', 'noopener'));
    mob('mob-download-app',     () => window.open('https://github.com/Jmason15/aiTemplateLab/releases/latest/download/aiTemplateLab.html', '_blank', 'noopener'));
    mob('mob-clear-storage',    () => { document.getElementById('clear-storage-modal').style.display = 'flex'; });
    mob('mob-create-group',     () => openCreateGroupModal());
    mob('mob-save-group',       () => document.getElementById('save-template-group-btn').click());
    mob('mob-load-group',       () => document.getElementById('load-template-group-btn').click());
    mob('mob-delete-group',     () => document.getElementById('menu-delete-template-group').click());
    mob('mob-new-template',     () => startBlankPrompt());
    mob('mob-import-template',  () => { if (typeof openNewPromptModal === 'function') openNewPromptModal(); });
    mob('mob-export-templates', () => { if (typeof window.exportPrompts === 'function') window.exportPrompts(); });
    mob('mob-help-what-is-template',    () => window.showHelpModal('help-what-is-template'));
    mob('mob-help-what-is-group',       () => window.showHelpModal('help-what-is-group'));
    mob('mob-help-how-to-use',          () => window.showHelpModal('help-how-to-use'));
    mob('mob-help-why-important',       () => window.showHelpModal('help-why-important'));
    mob('mob-help-template-lab',        () => window.showHelpModal('help-template-lab'));
    mob('mob-help-create-from-scratch', () => window.showHelpModal('help-create-from-scratch'));
    mob('mob-help-edit-screen',         () => window.showHelpModal('help-edit-screen'));

    // Hide "Try Live Version" on the live site.
    const mobLiveSite = document.getElementById('mob-live-site');
    if (mobLiveSite && window.location.hostname === 'jmason15.github.io') mobLiveSite.style.display = 'none';
}
