function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;

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

function renderCheckboxGrid(container, items, idPrefix) {
    container.innerHTML = items.map(item =>
        `<div class="checkbox-row">
            <input type="checkbox" id="${idPrefix}-${item.id}" value="${item.id}" checked>
            <label for="${idPrefix}-${item.id}">${window.escapeHtml(item.name)}</label>
        </div>`
    ).join('');
}
