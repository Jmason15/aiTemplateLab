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
 * ID prefixes for dynamically-created edit-form fields.
 * Each field's DOM id is `${prefix}-${counter}`, e.g. "input-name-1".
 */
const FIELD_PREFIXES = Object.freeze({
    INPUT:      'input',
    CONSTRAINT: 'constraint',
    OUTPUT:     'output',
    SUCCESS:    'success',
});
