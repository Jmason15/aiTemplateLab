// build.js
// Usage: node build.js
// Inlines CSS and JS source files into a single distributable HTML file.

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'main');
const jsSrcDir = path.join(srcDir, 'js');
const cssSrcDir = path.join(srcDir, 'css');
const distDir = path.join(__dirname, 'dist');
const htmlSrcPath = path.join(srcDir, 'index.html');
const htmlDistPath = path.join(distDir, 'PromptBuilderPro.html');

// Explicit load order — do not change without updating index.html <link> tags too.
const CSS_FILES_ORDERED = [
    'variables.css',
    'base.css',
    'layout.css',
    'sidebar.css',
    'components.css',
    'forms.css',
    'modals.css',
    'screens.css',
];

// Explicit load order — do not change without updating index.html <script> tags too.
const JS_FILES_ORDERED = [
    'utils.js',
    'editPrompt.js',
    'storageManager.js',
    'preloadedPrompts.js',
    'newApp.js',
];

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

let html = fs.readFileSync(htmlSrcPath, 'utf8');

// Resolve HTML partials: <!-- #include "path/to/partial.html" -->
html = html.replace(/<!--\s*#include\s+"([^"]+)"\s*-->/g, (match, includePath) => {
    const fullPath = path.join(srcDir, includePath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: HTML partial not found: ${includePath}`);
        return `<!-- missing: ${includePath} -->`;
    }
    return fs.readFileSync(fullPath, 'utf8');
});

// Inline CSS — replace the entire block of <link> tags with one <style> block
const cssChunks = [];
for (const cssFile of CSS_FILES_ORDERED) {
    const fullPath = path.join(cssSrcDir, cssFile);
    if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: ${cssFile} not found, skipping`);
        continue;
    }
    cssChunks.push(`/* === ${cssFile} === */\n${fs.readFileSync(fullPath, 'utf8')}`);
}
const combinedCss = cssChunks.join('\n\n');

// Replace the first <link rel="stylesheet" ...> through the last one with a single <style>
html = html.replace(
    /(\s*<link rel="stylesheet" href="css\/[^"]+">)+/,
    `\n    <style>\n${combinedCss}\n    </style>`
);

// Inline JS in explicit order
for (const jsFile of JS_FILES_ORDERED) {
    const jsPath = path.join('js', jsFile).replace(/\\/g, '/');
    const fullPath = path.join(jsSrcDir, jsFile);
    if (!fs.existsSync(fullPath)) {
        console.warn(`Warning: ${jsFile} not found, skipping`);
        continue;
    }
    const jsContent = fs.readFileSync(fullPath, 'utf8');
    const scriptRegex = new RegExp(`<script src=["']${jsPath}["']><\\/script>`, 'i');
    html = html.replace(scriptRegex, `<script>\n${jsContent}\n</script>`);
}

fs.writeFileSync(htmlDistPath, html, 'utf8');
console.log('Build complete: dist/PromptBuilderPro.html');
