/**
 * @fileoverview Shared application state and normalization helpers.
 *
 * All mutable state lives here as plain `let` variables so every other script
 * in the same global scope can read and write them directly. After any mutation,
 * call syncWindowState() so that editPrompt.js (which runs in the same scope
 * but was written to read from window.*) sees the latest values.
 *
 * Load order: must be first after utils.js.
 */

// Active prompt list for the currently selected template group.
let prompts = [];

// ID of the prompt currently open in the view/edit tabs. null = none selected.
let currentPromptId = null;

// Counters track the highest DOM element ID issued for each dynamic field type
// in the edit form. They only increment — never reset between edits — so IDs
// remain unique even after items are deleted and re-added.
let inputCounter = 0;
let constraintCounter = 0;
let outputCounter = 0;
let successCounter = 0;

// Top-level data container.
// templateGroups: { [groupName]: prompt[] }
// history:        { [groupName]: inputHistory[] }
let environment = { templateGroups: {}, history: {} };

// Name of the template group currently shown in the sidebar.
let currentTemplateGroup = 'Default';

// Mirror initial values onto window so editPrompt.js can reference them
// before the first syncWindowState() call.
window.prompts = prompts;
window.currentPromptId = currentPromptId;
window.inputCounter = inputCounter;
window.constraintCounter = constraintCounter;
window.outputCounter = outputCounter;
window.successCounter = successCounter;

/**
 * Copies all mutable state variables onto window so that editPrompt.js,
 * which reads/writes via window.*, stays in sync after any state mutation.
 * Call this at the end of any function that changes the variables above.
 */
function syncWindowState() {
    window.prompts = prompts;
    window.currentPromptId = currentPromptId;
    window.inputCounter = inputCounter;
    window.constraintCounter = constraintCounter;
    window.outputCounter = outputCounter;
    window.successCounter = successCounter;
}

/**
 * Ensures a prompt's constraints and success arrays contain only strings.
 * Older saved data and some imported prompts may have stored these fields
 * as objects (e.g. { rule: '...' } or { criterion: '...' }) — this
 * flattens them to plain strings so the rest of the app can treat them
 * uniformly.
 * @param {Object} prompt - A prompt object (mutated in place).
 * @returns {Object} The same prompt object, normalised.
 */
export function normalizePrompt(prompt) {
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
