// Shared application state — must load before all other app scripts

let prompts = [];
let currentPromptId = null;
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
