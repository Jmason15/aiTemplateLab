// @ts-check
/**
 * @fileoverview Application state manager.
 *
 * All mutable state is encapsulated in StateManager. Access and mutate state
 * only through the module-level `state` singleton — never via direct variable
 * assignment. Each named setter automatically syncs window.* mirrors so that
 * editPrompt.js (which reads from window.*) always sees current values.
 *
 * Load order: must be first after utils.js.
 */

/**
 * @typedef {{ name: string, description?: string, placeholder?: string }} PromptInput
 * @typedef {{ name: string, type: string, description?: string }} PromptOutput
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description?: string,
 *   objective?: string,
 *   actor?: string,
 *   context?: string,
 *   example?: string,
 *   inputs: PromptInput[],
 *   constraints: string[],
 *   outputs: PromptOutput[],
 *   success: string[]
 * }} Prompt
 * @typedef {{ templateGroups: Record<string, Prompt[]>, history: Record<string, any[]> }} Environment
 */

class StateManager {
    /** Active prompt list for the current template group. */
    #prompts = [];

    /** ID of the prompt currently open in the view/edit tabs. null = none selected. */
    #currentPromptId = null;

    /** Name of the template group currently shown in the sidebar. */
    #currentTemplateGroup = 'Default';

    /**
     * Counters track the highest DOM element ID issued for each dynamic field
     * type in the edit form. They only increment — never reset between edits —
     * so IDs remain unique even after items are deleted and re-added.
     */
    #inputCounter = 0;
    #constraintCounter = 0;
    #outputCounter = 0;
    #successCounter = 0;

    /**
     * Top-level data container.
     * templateGroups: { [groupName]: prompt[] }
     * history:        { [groupName]: inputHistory[] }
     */
    #environment = { templateGroups: {}, history: {} };

    constructor() {
        // Initialise window.* mirrors with the default values.
        this.#syncWindow();
    }

    // ---- Getters ----

    get prompts() { return this.#prompts; }
    get currentPromptId() { return this.#currentPromptId; }
    get currentTemplateGroup() { return this.#currentTemplateGroup; }
    get inputCounter() { return this.#inputCounter; }
    get constraintCounter() { return this.#constraintCounter; }
    get outputCounter() { return this.#outputCounter; }
    get successCounter() { return this.#successCounter; }

    /**
     * Returns the environment object by reference. Mutate its nested properties
     * directly (e.g. state.environment.templateGroups[x] = y) — the reference
     * never changes, so existing code that holds it stays in sync.
     */
    get environment() { return this.#environment; }

    // ---- Named setters (each syncs window.* after mutation) ----

    setPrompts(value) {
        this.#prompts = value;
        this.#syncWindow();
    }

    setCurrentPromptId(id) {
        this.#currentPromptId = id;
        this.#syncWindow();
    }

    setCurrentTemplateGroup(name) {
        this.#currentTemplateGroup = name;
        this.#syncWindow();
    }

    /** Resets all four edit-form field counters to zero in a single call. */
    resetCounters() {
        this.#inputCounter = 0;
        this.#constraintCounter = 0;
        this.#outputCounter = 0;
        this.#successCounter = 0;
        this.#syncWindow();
    }

    /** Increments the input counter and returns the new value. */
    nextInputCounter() {
        this.#inputCounter++;
        this.#syncWindow();
        return this.#inputCounter;
    }

    /** Increments the constraint counter and returns the new value. */
    nextConstraintCounter() {
        this.#constraintCounter++;
        this.#syncWindow();
        return this.#constraintCounter;
    }

    /** Increments the output counter and returns the new value. */
    nextOutputCounter() {
        this.#outputCounter++;
        this.#syncWindow();
        return this.#outputCounter;
    }

    /** Increments the success counter and returns the new value. */
    nextSuccessCounter() {
        this.#successCounter++;
        this.#syncWindow();
        return this.#successCounter;
    }

    // ---- Window sync ----

    /** Keeps window.* mirrors in sync so editPrompt.js window.* reads stay current. */
    #syncWindow() {
        window.prompts = this.#prompts;
        window.currentPromptId = this.#currentPromptId;
        window.inputCounter = this.#inputCounter;
        window.constraintCounter = this.#constraintCounter;
        window.outputCounter = this.#outputCounter;
        window.successCounter = this.#successCounter;
    }
}

/** Singleton — the single source of truth for all app state. */
export const state = new StateManager();
window.state = state;

/**
 * Ensures a prompt's constraints and success arrays contain only strings.
 * Older saved data and some imported prompts may have stored these fields
 * as objects (e.g. { rule: '...' } or { criterion: '...' }) — this
 * flattens them to plain strings so the rest of the app can treat them
 * uniformly.
 * @param {Prompt} prompt - A prompt object (mutated in place).
 * @returns {Prompt} The same prompt object, normalised.
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
