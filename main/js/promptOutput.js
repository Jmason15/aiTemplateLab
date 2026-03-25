/**
 * @fileoverview Prompt JSON generation and input history.
 *
 * generateViewPrompt() reads the current prompt's stored data plus any values
 * the user has typed into the input fields, then builds a structured JSON
 * object that can be copied and pasted directly into an AI tool.
 *
 * Input history is saved to localStorage each time the user copies output,
 * capped at 50 entries, and displayed in the Template History tab.
 *
 * Load order: depends on state.js and screens.js.
 */

/**
 * Builds the prompt JSON from the active prompt's stored definition and the
 * current values in the view-screen input fields, then writes it to the
 * output textarea (#view-output-json).
 *
 * Output shape:
 * {
 *   objective, actor, context,   // from stored prompt (omitted if empty)
 *   input: { fieldName: value }, // from user-filled text areas
 *   constraints: [...],
 *   output_schema: { type, properties, required },
 *   success_criteria: [...],
 *   output_instructions: '...'   // injected instruction for the AI
 * }
 */
function generateViewPrompt() {
    const prompt = state.prompts.find(p => p.id === state.currentPromptId);
    if (!prompt) return;

    // Collect current values from the dynamic input textareas.
    const inputs = {};
    prompt.inputs.forEach((i, idx) => {
        const field = document.getElementById(`input-value-${idx}`);
        inputs[i.name] = field ? field.value : '';
    });

    // Build the output_schema from the prompt's output definitions.
    const outputProperties = {};
    const requiredFields = [];
    prompt.outputs.forEach(o => {
        outputProperties[o.name] = { type: o.type, description: o.description || undefined };
        requiredFields.push(o.name);
    });

    // Assemble the final JSON, omitting empty top-level fields.
    const promptJson = {};
    if (prompt.objective) promptJson.objective = prompt.objective;
    if (prompt.actor) promptJson.actor = prompt.actor;
    if (prompt.context) promptJson.context = prompt.context;
    if (prompt.example) promptJson.example = prompt.example;
    if (Object.keys(inputs).length > 0) promptJson.input = inputs;
    if (prompt.constraints.length > 0) promptJson.constraints = prompt.constraints;
    promptJson.output_schema = { type: 'object', properties: outputProperties, required: requiredFields };
    if (prompt.success.length > 0) promptJson.success_criteria = prompt.success;

    // Append an output instruction that names the expected properties so the
    // AI knows exactly what to return without extra prose.
    const outputExample = Object.keys(outputProperties).join(', ');
    promptJson.output_instructions = outputExample
        ? `Return only the output exactly as specified by the properties: ${outputExample}. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array`
        : 'Return only the output exactly as specified by the defined properties. Do not include any extra prose, comments, or code fences. Do not wrap the answer in an object or array';

    const outputEl = document.getElementById('view-output-json');
    if (outputEl) outputEl.textContent = JSON.stringify(promptJson, null, 2);
}
window.generateViewPrompt = generateViewPrompt;

// =========================
// Input History
// =========================

/**
 * Returns all stored input history entries across all prompts.
 * Each entry is { templateId, inputValues: { fieldName: value } }.
 * @returns {Array}
 */
function getPromptInputHistoryAll() {
    const raw = localStorage.getItem(STORAGE_KEYS.PROMPT_INPUT_HISTORY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Saves a set of input values to history for a given template.
 * Skips saving if all values are empty (user copied without filling anything in).
 * History is capped at 50 entries, newest first.
 * @param {*} templateId - The prompt's id.
 * @param {Object} inputObj - Map of field name to value.
 */
function savePromptInputHistory(templateId, inputObj) {
    if (!templateId || !inputObj) return;
    if (Object.values(inputObj).every(v => !v)) return;
    let history = getPromptInputHistoryAll();
    history.unshift({ templateId, inputValues: inputObj });
    localStorage.setItem(STORAGE_KEYS.PROMPT_INPUT_HISTORY, JSON.stringify(history.slice(0, 50)));
    updateStorageMeter();
}

/**
 * Returns all history entries for a specific template.
 * @param {*} templateId
 * @returns {Array<Object>} Array of inputValues objects.
 */
function getPromptInputHistory(templateId) {
    return getPromptInputHistoryAll().filter(h => h.templateId === templateId).map(h => h.inputValues);
}

/**
 * Renders the input history table for a prompt into #history-list.
 * Columns are derived from the union of all field names seen across history
 * entries so the table handles prompts whose inputs changed over time.
 * Each row has a Restore button that repopulates the view-screen inputs.
 * @param {*} promptId
 */
function renderHistoryList(promptId) {
    const history = getPromptInputHistory(promptId);
    const container = document.getElementById('history-list');
    if (!container) return;
    if (!history || history.length === 0) {
        container.innerHTML = '<span style="color:#888;font-size:0.95em;">No input history for this prompt.</span>';
        return;
    }

    // Build column list from all unique field names across every history entry.
    const allFields = Array.from(new Set(history.flatMap(h => Object.keys(h))));
    // Give the Jira text column extra width via CSS — it tends to be long.
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
            // Match each saved field value back to its textarea by label text.
            Object.entries(selected).forEach(([k, v]) => {
                const input = Array.from(document.querySelectorAll('[id^="input-value-"]')).find(el => {
                    const label = el.closest('div')?.querySelector('label');
                    return label && label.textContent.replace(':', '').trim() === k;
                });
                if (input) input.value = v;
            });
            generateViewPrompt();
        });
    });
}
