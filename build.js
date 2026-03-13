// build.js
// Usage: node build.js
// This script inlines app.css and app.js into Prompt Builder Pro.html and outputs to dist/Prompt Builder Pro.html

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'main');
const jsSrcDir = path.join(srcDir, 'js');
const distDir = path.join(__dirname, 'dist');
const htmlSrcPath = path.join(srcDir, 'index.html');
const cssSrcPath = path.join(srcDir, 'app.css');
const htmlDistPath = path.join(distDir, 'PromptBuilderPro.html');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Read HTML
let html = fs.readFileSync(htmlSrcPath, 'utf8');
// Inline CSS
const css = fs.existsSync(cssSrcPath) ? fs.readFileSync(cssSrcPath, 'utf8') : '';
html = html.replace(
    /<link rel="stylesheet" href="app\.css">/i,
    `<style>\n${css}\n</style>`
);
// Inline JS
const jsFiles = fs.readdirSync(jsSrcDir).filter(f => f.endsWith('.js'));
for (const jsFile of jsFiles) {
    const jsPath = path.join('js', jsFile).replace(/\\/g, '/');
    const jsContent = fs.readFileSync(path.join(jsSrcDir, jsFile), 'utf8');
    // Replace the script tag for this file with inlined content
    const scriptRegex = new RegExp(`<script src=["']${jsPath}["']><\\/script>`, 'i');
    html = html.replace(
        scriptRegex,
        `<script>\n${jsContent}\n</script>`
    );
}
// Write output
fs.writeFileSync(htmlDistPath, html, 'utf8');
console.log('Build complete: dist/PromptBuilderPro.html');
