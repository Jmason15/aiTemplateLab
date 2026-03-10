// build.js
// Usage: node build.js
// This script inlines app.css and app.js into Prompt Builder Pro.html and outputs to dist/Prompt Builder Pro.html

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'Prompt Builder Pro.html');
const cssPath = path.join(__dirname, 'app.css');
const jsPath = path.join(__dirname, 'app.js');
const distDir = path.join(__dirname, 'dist');
const distHtmlPath = path.join(distDir, 'Prompt Builder Pro.html');

// Read source files
const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';

// Inline CSS
let inlined = html.replace(
    /<link rel="stylesheet" href="app\.css">/i,
    `<style>\n${css}\n</style>`
);

// Inline JS (replace <script src="app.js"></script> only, not other scripts)
inlined = inlined.replace(
    /<script src="app\.js"><\/script>/i,
    `<script>\n${js}\n</script>`
);

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Write output
fs.writeFileSync(distHtmlPath, inlined, 'utf8');
console.log('Build complete: dist/Prompt Builder Pro.html');

