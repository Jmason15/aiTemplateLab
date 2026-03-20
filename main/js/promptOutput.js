// Prompt JSON generation and input history — depends on state.js, screens.js

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
