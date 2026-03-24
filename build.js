/**
 * build.js
 * Usage: node build.js
 *
 * Produces two outputs:
 *
 *   dist/aiTemplateLab.html   — single self-contained file for offline use / GitHub Release
 *                               Everything (CSS, JS, images) is inlined; no external deps.
 *
 *   docs/                     — multi-file build for GitHub Pages
 *                               HTML shell + docs/assets/app.css + docs/assets/app.js +
 *                               docs/aiTemplateLab.png. Assets are served separately so the
 *                               browser can cache CSS/JS and avoid re-downloading the 2.5MB
 *                               logo on every visit.
 *
 * To add a prompt:    create a JSON file in main/Prompts/ and reference it in workspaces.json.
 * To add a CSS file:  add it to CSS_FILES_ORDERED and to the <link> tags in index.html.
 * To add a JS file:   add it to JS_FILES_ORDERED and to the <script> tags in index.html.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'main');
const jsSrcDir = path.join(srcDir, 'js');
const cssSrcDir = path.join(srcDir, 'css');
const distDir = path.join(__dirname, 'dist');
const docsDir = path.join(__dirname, 'docs');
const htmlSrcPath = path.join(srcDir, 'index.html');
const htmlDistPath = path.join(distDir, 'aiTemplateLab.html');
const htmlDocsPath = path.join(docsDir, 'index.html');
const logoSrcPath = path.join(__dirname, 'images', 'aiTemplateLab.png');
const faviconSrcPath = path.join(__dirname, 'images', 'favicon.png');

// CSS load order — must match the <link> tags in index.html.
const CSS_FILES_ORDERED = [
    'variables.css',  // CSS custom properties (tokens) — must be first
    'base.css',
    'layout.css',
    'sidebar.css',
    'components.css',
    'forms.css',
    'modals.css',
    'screens.css',
];

// JS load order — must match the <script> tags in index.html.
// Each file depends on the ones above it; do not reorder without checking deps.
const JS_FILES_ORDERED = [
    'constants.js',       // STORAGE_KEYS, FIELD_PREFIXES — must be first
    'utils.js',           // escapeHtml, downloadJson, renderCheckboxGrid
    'state.js',           // shared variables, syncWindowState, normalizePrompt
    'storage.js',         // localStorage read/write/reset
    'screens.js',         // screen/tab switching, clearForm
    'editPrompt.js',      // edit form field management, auto-save
    'preloadedPrompts.js',// AUTO-GENERATED — do not create this file manually
    'promptOutput.js',    // generateViewPrompt, input history
    'promptCrud.js',      // CRUD, viewPrompt, renderPromptsList, drag-drop
    'importExport.js',    // import/export modals, JSON paste modal
    'workspaceManager.js',// template groups, workspace save/load, app-bar menu
    'app.js',             // entry point — init + all event wiring
];

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);

// Prevent GitHub Pages from running Jekyll.
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

// =========================
// Images
// =========================

// Logo: base64 for dist (self-contained), relative URL for docs (cached separately).
let logoDataUri = '';
if (fs.existsSync(logoSrcPath)) {
    const logoBase64 = fs.readFileSync(logoSrcPath).toString('base64');
    logoDataUri = `data:image/png;base64,${logoBase64}`;
    // Copy to docs/ root — referenced by the OG meta tag and by the docs HTML shell.
    fs.copyFileSync(logoSrcPath, path.join(docsDir, 'aiTemplateLab.png'));
} else {
    console.warn('Warning: images/aiTemplateLab.png not found — app bar logo will be missing.');
}

// Favicon: base64 for dist, relative URL for docs.
// Must be under ~100KB for browsers to accept a data: URI.
const FAVICON_FALLBACK_URL = 'https://jmason15.github.io/aiTemplateLab/favicon.png';
let faviconDataUri = FAVICON_FALLBACK_URL;
let faviconRelativeUrl = FAVICON_FALLBACK_URL;
if (fs.existsSync(faviconSrcPath)) {
    const faviconBase64 = fs.readFileSync(faviconSrcPath).toString('base64');
    faviconDataUri = `data:image/png;base64,${faviconBase64}`;
    faviconRelativeUrl = 'favicon.png';
    fs.copyFileSync(faviconSrcPath, path.join(docsDir, 'favicon.png'));
    console.log('Favicon: embedded from images/favicon.png');
} else {
    console.log('Favicon: using GitHub Pages URL (add images/favicon.png for offline support)');
}

// =========================
// Step 1: Generate prompt data from source JSON files
// =========================

const promptsDir = path.join(srcDir, 'Prompts');
const workspacesConfigPath = path.join(srcDir, 'config', 'workspaces.json');
const workspacesConfig = JSON.parse(fs.readFileSync(workspacesConfigPath, 'utf8'));

// Load each unique prompt file referenced by workspaces.json.
const loadedPromptFiles = {}; // filename -> prompt[]
for (const fileList of Object.values(workspacesConfig.workspaces)) {
    for (const fileName of fileList) {
        if (loadedPromptFiles[fileName]) continue; // already loaded
        const filePath = path.join(promptsDir, fileName);
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: Prompt file not found: ${fileName}`);
            loadedPromptFiles[fileName] = [];
        } else {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            // Accept either a plain object or an array of objects.
            loadedPromptFiles[fileName] = Array.isArray(data) ? data : [data];
        }
    }
}

// Build the workspace map: { [groupName]: { templates: [...], inputHistory: [] } }
const preloadedWorkspaces = {};
for (const [wsName, fileList] of Object.entries(workspacesConfig.workspaces)) {
    preloadedWorkspaces[wsName] = {
        templates: fileList.flatMap(f => loadedPromptFiles[f] || []),
        inputHistory: []
    };
}

const allPrompts = Object.values(loadedPromptFiles).flat();

// Build the JS content that will be injected in place of preloadedPrompts.js.
const generatedPreloaded = `// AUTO-GENERATED by build.js — edit files in main/Prompts/ and main/config/workspaces.json instead.

window.preloadedPrompts = ${JSON.stringify(allPrompts, null, 4)};

window.preloadedWorkspaces = ${JSON.stringify(preloadedWorkspaces, null, 4)};

window.preloadedConfig = ${JSON.stringify({
    defaultWorkspace: workspacesConfig.defaultWorkspace,
    defaultTemplate: workspacesConfig.defaultTemplate
}, null, 4)};
`;

console.log(`Loaded ${allPrompts.length} prompt(s) across ${Object.keys(preloadedWorkspaces).length} workspace(s)`);

// =========================
// Step 2: Resolve HTML partials
// =========================

// htmlResolved is the base for both dist and docs outputs.
const htmlResolved = fs.readFileSync(htmlSrcPath, 'utf8').replace(
    /<!--\s*#include\s+"([^"]+)"\s*-->/g,
    (match, includePath) => {
        const fullPath = path.join(srcDir, includePath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`Warning: HTML partial not found: ${includePath}`);
            return `<!-- missing: ${includePath} -->`;
        }
        return fs.readFileSync(fullPath, 'utf8');
    }
);

// =========================
// Step 3: Build combined CSS and JS strings (shared by both outputs)
// =========================

const cssChunks = [];
for (const cssFile of CSS_FILES_ORDERED) {
    const fullPath = path.join(cssSrcDir, cssFile);
    if (!fs.existsSync(fullPath)) { console.warn(`Warning: ${cssFile} not found, skipping`); continue; }
    // Section markers make it easy to find a file's rules in browser DevTools.
    cssChunks.push(`/* === ${cssFile} === */\n${fs.readFileSync(fullPath, 'utf8')}`);
}
const combinedCss = cssChunks.join('\n\n');

// jsContents[file] = stripped source content ready for browser use.
const jsContents = {};
for (const jsFile of JS_FILES_ORDERED) {
    const raw = jsFile === 'preloadedPrompts.js'
        ? generatedPreloaded
        : fs.existsSync(path.join(jsSrcDir, jsFile))
            ? fs.readFileSync(path.join(jsSrcDir, jsFile), 'utf8')
            : null;
    if (!raw) { console.warn(`Warning: ${jsFile} not found, skipping`); continue; }
    // Strip ES module `export` keywords — source files use them for Vitest imports,
    // but the browser build uses plain <script> tags (not modules).
    jsContents[jsFile] = raw.replace(/^export\s+/gm, '');
}
const combinedJs = JS_FILES_ORDERED
    .filter(f => jsContents[f])
    .map(f => `/* === ${f} === */\n${jsContents[f]}`)
    .join('\n\n');

// =========================
// Step 4: Write dist — single self-contained HTML file
// =========================

let distHtml = htmlResolved;

// Inline CSS.
distHtml = distHtml.replace(
    /(\s*<link rel="stylesheet" href="css\/[^"]+">)+/,
    `\n    <style>\n${combinedCss}\n    </style>`
);

// Inline each JS file as its own <script> block (preserves source-level stack traces).
for (const jsFile of JS_FILES_ORDERED) {
    if (!jsContents[jsFile]) continue;
    const jsPath = `js/${jsFile}`;
    const scriptRegex = new RegExp(`<script src=["']${jsPath}["']><\\/script>`, 'i');
    distHtml = distHtml.replace(scriptRegex, `<script>\n${jsContents[jsFile]}\n</script>`);
}

// Inject logo and favicon as base64 data URIs so the file works offline.
if (logoDataUri) distHtml = distHtml.replace(/__LOGO_SRC__/g, logoDataUri);
distHtml = distHtml.replace(/__FAVICON_SRC__/g, faviconDataUri);

fs.writeFileSync(htmlDistPath, distHtml, 'utf8');
console.log(`Build complete: ${htmlDistPath}`);

// =========================
// Step 5: Write docs — multi-file build for GitHub Pages
// =========================

const docsAssetsDir = path.join(docsDir, 'assets');
if (!fs.existsSync(docsAssetsDir)) fs.mkdirSync(docsAssetsDir, { recursive: true });

// Write standalone CSS and JS asset files.
fs.writeFileSync(path.join(docsAssetsDir, 'app.css'), combinedCss, 'utf8');
fs.writeFileSync(path.join(docsAssetsDir, 'app.js'), combinedJs, 'utf8');

let docsHtml = htmlResolved;

// Replace <link> stylesheet tags with a single reference to the asset file.
docsHtml = docsHtml.replace(
    /(\s*<link rel="stylesheet" href="css\/[^"]+">)+/,
    '\n    <link rel="stylesheet" href="assets/app.css">'
);

// Replace all JS <script src="js/..."> tags with a single bundled reference.
docsHtml = docsHtml.replace(
    /(\s*<script src="js\/[^"]+"><\/script>)+/,
    '\n    <script src="assets/app.js"></script>'
);

// Inject logo and favicon as URLs — the browser caches these separately.
docsHtml = docsHtml.replace(/__LOGO_SRC__/g, logoDataUri ? 'aiTemplateLab.png' : '');
docsHtml = docsHtml.replace(/__FAVICON_SRC__/g, faviconRelativeUrl);

fs.writeFileSync(htmlDocsPath, docsHtml, 'utf8');
console.log(`GitHub Pages:  ${htmlDocsPath}`);
