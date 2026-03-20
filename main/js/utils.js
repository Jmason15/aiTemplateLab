/**
 * @fileoverview Shared utility functions available to all scripts.
 * Must be the first JS file loaded.
 */

/**
 * Escapes a string for safe insertion into HTML to prevent XSS.
 * @param {string} text - Raw user-supplied string.
 * @returns {string} HTML-escaped string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

/**
 * Serializes data as JSON and triggers a file download in the browser.
 * @param {*} data - Any JSON-serializable value.
 * @param {string} fileName - Suggested filename for the download.
 */
function downloadJson(data, fileName) {
    try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Download failed: ' + err.message);
    }
}

/**
 * Renders a list of items as labelled checkboxes (all checked by default)
 * into a container element. Used by the import and export modals.
 * @param {HTMLElement} container - The element to render into.
 * @param {Array<{id: *, name: string}>} items - Items to render.
 * @param {string} idPrefix - Prefix for checkbox element IDs to avoid collisions.
 */
function renderCheckboxGrid(container, items, idPrefix) {
    container.innerHTML = items.map(item =>
        `<div class="checkbox-row">
            <input type="checkbox" id="${idPrefix}-${item.id}" value="${item.id}" checked>
            <label for="${idPrefix}-${item.id}">${window.escapeHtml(item.name)}</label>
        </div>`
    ).join('');
}
