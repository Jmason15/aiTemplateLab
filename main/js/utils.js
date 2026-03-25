/**
 * @fileoverview Shared utility functions available to all scripts.
 * Must be the first JS file loaded.
 */

/**
 * Escapes a string for safe insertion into HTML to prevent XSS.
 * @param {string} text - Raw user-supplied string.
 * @returns {string} HTML-escaped string.
 */
export function escapeHtml(text) {
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
 * Converts a display name into a URL-friendly slug for use as a template ID.
 * e.g. "My Cool Template!" → "my-cool-template"
 * Falls back to "untitled" if the result would be empty.
 * @param {string} text - The name to slugify.
 * @returns {string} Lowercase hyphen-separated slug.
 */
export function slugify(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'untitled';
}

/**
 * Wires the standard dismiss behaviour for a modal:
 *   - clicking cancelBtn hides the modal
 *   - clicking the modal backdrop (the modal element itself) hides the modal
 * @param {HTMLElement} modal - The modal overlay element.
 * @param {HTMLElement|null} cancelBtn - Optional cancel/close button inside the modal.
 */
export function wireModalDismiss(modal, cancelBtn) {
    if (cancelBtn) cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
}
window.wireModalDismiss = wireModalDismiss;

/**
 * Measures the bytes used by the app's own localStorage keys and updates the
 * storage meter bar and label in the sidebar.
 *
 * localStorage stores strings as UTF-16, so each character costs 2 bytes.
 * The standard browser quota is 5 MB per origin.
 */
function updateStorageMeter() {
    const QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB
    const usedBytes = Object.values(STORAGE_KEYS).reduce((total, key) => {
        const val = localStorage.getItem(key);
        return total + (val ? val.length * 2 : 0);
    }, 0);

    const pct = Math.min((usedBytes / QUOTA_BYTES) * 100, 100);

    const bar = document.getElementById('storage-meter-bar');
    const label = document.getElementById('storage-meter-label');
    if (!bar || !label) return;

    bar.style.width = pct.toFixed(1) + '%';
    bar.classList.toggle('warn',   pct >= 60 && pct < 85);
    bar.classList.toggle('danger', pct >= 85);

    const usedKb  = (usedBytes / 1024).toFixed(1);
    const quotaMb = (QUOTA_BYTES / (1024 * 1024)).toFixed(0);
    label.textContent = `Storage: ${usedKb} KB / ${quotaMb} MB`;
}
window.updateStorageMeter = updateStorageMeter;

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
