/**
 * @fileoverview Application-wide constants.
 *
 * Centralises all magic strings so a rename only touches one file.
 * Must be the first JS file loaded (before utils.js).
 */

/** localStorage key names used throughout the app. */
const STORAGE_KEYS = Object.freeze({
    TEMPLATE_GROUPS:         'templateGroups',
    TEMPLATE_GROUP_HISTORY:  'templateGroupHistory',
    CURRENT_TEMPLATE_GROUP:  'currentTemplateGroup',
    CURRENT_PROMPT_ID:       'currentPromptId',
    PROMPT_INPUT_HISTORY:    'promptInputHistory',
    TOAST_DISMISSED:         'toastDismissed',
});

/**
 * IDs of the built-in generator templates that power the builder screen.
 * These are hidden from the sidebar so users interact with them only through
 * the Build a New Template flow.
 */
const BUILDER_IDS = Object.freeze(new Set(['template-builder', 'group-generator', 'workflow-generator']));

/**
 * ID prefixes for dynamically-created edit-form fields.
 * Each field's DOM id is `${prefix}-${counter}`, e.g. "input-name-1".
 */
const FIELD_PREFIXES = Object.freeze({
    INPUT:      'input',
    CONSTRAINT: 'constraint',
    OUTPUT:     'output',
    SUCCESS:    'success',
});
