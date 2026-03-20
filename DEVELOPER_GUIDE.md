# Prompt Builder Pro — Developer Guide

## What This App Does

A single-page browser app for creating, managing, and exporting structured AI prompt templates. Templates follow a 7-section schema (Objective, Actor, Context, Inputs, Constraints, Outputs, Success Criteria) and are persisted to `localStorage`. The build step compiles everything into one distributable HTML file with no external dependencies.

---

## Project Structure

```
aiTemplateLab_claude/
├── build.js                    # Build script: inlines CSS + JS into dist HTML
├── package.json                # npm config; run `npm run build` to compile
├── main/                       # Source files (edit these)
│   ├── index.html              # App shell: HTML structure + modal definitions
│   ├── app.css                 # All styles (~1,200 lines)
│   └── js/
│       ├── utils.js            # Pure helpers (escapeHtml, etc.)
│       ├── storageManager.js   # localStorage read/write for prompts + history
│       ├── preloadedPrompts.js # Default template definitions on first load
│       ├── editPrompt.js       # Edit form population and field rendering (~516 lines)
│       └── newApp.js           # Everything else (~2,034 lines) — see note below
└── dist/
    └── PromptBuilderPro.html   # Compiled output (auto-generated, don't edit directly)
```

**Load order** (defined in `index.html`):
```
utils.js → storageManager.js → preloadedPrompts.js → editPrompt.js → newApp.js
```

Cross-file communication happens through `window.*` globals (see State section).

---

## How to Work on It

```bash
# Edit source files in main/
# Then compile:
npm run build

# Open dist/PromptBuilderPro.html in a browser to test
```

There is no dev server. Open `main/index.html` directly in a browser for local development (relative script tags will work), then build when ready to distribute.

---

## Data Model

Every template ("prompt") has this shape:

```json
{
  "id": "uuid-string",
  "name": "Template name",
  "description": "Short description",
  "objective": "What this prompt accomplishes",
  "actor": "AI persona/role",
  "context": "Background context for the AI",
  "inputs": [
    { "name": "fieldName", "description": "what to provide", "type": "text" }
  ],
  "constraints": ["rule 1", "rule 2"],
  "outputs": [
    { "name": "outputName", "description": "what comes back", "type": "string" }
  ],
  "success": ["criterion 1", "criterion 2"]
}
```

**Storage keys:**
- `localStorage['prompts']` — serialized array of all templates
- `localStorage['promptInputHistory']` — past input values per template

**Workspace/group structure** lives in the `environment` global:
```javascript
environment = {
  templateGroups: {
    "Default": ["id1", "id2"],
    "Jira": ["id3"]
  }
}
```

---

## State Management

State is global — no framework. Key globals (all on `window`):

| Variable | Lives in | Purpose |
|---|---|---|
| `prompts` | newApp.js | Full array of all templates |
| `currentPromptId` | newApp.js | Which template is selected |
| `currentTemplateGroup` | newApp.js | Active workspace name |
| `environment` | newApp.js | Workspace group → ID mappings + history |

If you change state, you must call `savePromptsToLocalStorage()` to persist it.

---

## Known Issues & Debt

This section exists so you don't have to rediscover these problems.

### Actual Bug

**`main/js/newApp.js` line ~465:**
```javascript
window.makeInputsSortable = makeOutputsSortable; // wrong assignment!
```
`makeInputsSortable` points to `makeOutputsSortable`. Input drag-and-drop silently uses the wrong function.

### Dead Code

- `renderInputField()`, `renderConstraintField()`, `renderOutputField()`, `renderSuccessField()` in `editPrompt.js` — defined but never called
- `main/Prompts/codeCleaner.json` — exists but never loaded
- Several commented-out blocks in `index.html` (lines ~126-148, ~377-386) including a duplicate delete modal

### Code Duplication Hotspots

1. **Delete button SVG** — identical SVG string copy-pasted into `addInput()`, `addConstraint()`, `addOutput()`, `addSuccess()`. Extract to a `makeDeleteButton()` helper.

2. **Tab switching** — `showView()`, `showEdit()`, `showHistory()`, `showPromptOutput()` all follow the exact same show/hide pattern across 4 screens. Could be one `showScreen(name)` function.

3. **Sortable field lists** — `makeInputsSortable()` and `makeOutputsSortable()` are 95% identical. One parameterized function would cover both.

4. **Import/export modals** — `showExportModal()` and `showImportModal()` duplicate checkbox generation, button wiring, and error handling.

5. **Dynamic field rendering** — two separate systems exist:
   - `addInput()` etc. in `newApp.js` use `createElement` (currently active)
   - `renderInputField()` etc. in `editPrompt.js` return HTML strings (unused)
   Pick one and delete the other.

### Architecture Sprawl in `newApp.js`

`newApp.js` at 2,034 lines does too much. It handles:
- CRUD for templates
- UI rendering for all screens
- Import/export logic
- Workspace management
- Template group management
- Input history management
- Modal wiring
- Event binding

This isn't a blocker but makes the file hard to navigate. If you're adding a feature, search for related functions before adding new ones — they likely already exist.

### Style Chaos

Colors are defined in three places and can conflict:
- CSS custom properties in `app.css` (source of truth, ideally)
- Hardcoded hex values in `app.css` (bypassing variables)
- Inline `.style.background = '#232a36'` assignments scattered in JS

There are 114+ inline `.style.*` assignments in JS. These override CSS and make theming hard. When adding new UI, use CSS classes instead.

### Mixed Event Patterns

The codebase uses three different event binding styles:
- Inline HTML attributes: `oninput="generateViewPrompt()"`
- Direct assignment: `element.onclick = function() {}`
- `addEventListener('click', ...)`

Pick `addEventListener` for new code.

### No Input Validation on DOM Access

Many functions do `document.getElementById('some-id').value` with no null check. If the element doesn't exist (e.g., wrong screen is active), this throws. Guard any DOM reads where the element may be absent.

---

## How the Build Works

`build.js` does simple text replacement:
1. Reads `main/index.html`
2. Replaces `<link rel="stylesheet" href="app.css">` with inlined `<style>` block
3. Replaces each `<script src="js/...">` with an inlined `<script>` block
4. Writes result to `dist/PromptBuilderPro.html`

The build script uses string matching, not a proper parser. If you rename files or change the `<link>`/`<script>` tag format, update `build.js` too.

---

## Refactoring Priorities

If you want to clean this up, here's a suggested order of impact vs. effort:

**Quick wins (low effort, high clarity):**
1. Fix the `makeInputsSortable` bug (one-line fix)
2. Delete dead code: unused render functions, `codeCleaner.json` reference, commented-out HTML
3. Extract delete button SVG into a shared `makeDeleteButton()` helper
4. Collapse the 4 tab-switching functions into one

**Medium effort:**
5. Consolidate field creation — pick `createElement` approach, delete HTML-string approach
6. Split `newApp.js` into logical modules:
   - `promptCRUD.js` (create/read/update/delete)
   - `uiRender.js` (rendering functions)
   - `importExport.js` (import/export + workspace save/load)
   - `modals.js` (modal lifecycle)
7. Move inline JS color/style values to CSS classes

**Larger effort:**
8. Replace `window.*` globals with a simple module pattern or a shared state object
9. Debounce `regenerateOutput()` (currently fires on every keystroke)
10. Replace `alert()`/`confirm()` dialogs with custom modal UI

---

## Adding a New Template Section

To add a new section to the prompt schema (e.g., "Examples"):

1. Add the field to the data model (it just gets stored in the template object)
2. Add HTML for the section in `index.html` (edit form area)
3. Add a corresponding `add<Section>()` function in `newApp.js` following the pattern of `addConstraint()`
4. Update `savePrompt()` in `newApp.js` to read the new fields
5. Update `viewPrompt()` to display the new fields
6. Update `generateViewPrompt()` to include the new fields in JSON output
7. Rebuild: `npm run build`

---

## Adding a New Preloaded Template

Either:
- Create a JSON file in `main/Prompts/` following the data model above
- Update `preloadedPrompts.js` to include it in the default set

Or add the template object directly to the `preloadedPrompts` array in `preloadedPrompts.js`.

---

## Gotchas

- `dist/PromptBuilderPro.html` is committed to the repo. After any source change, rebuild and commit both the source and the dist file together.
- There is no linter, formatter, or test suite. Be careful with refactors.
- `localStorage` is per-origin. Testing `main/index.html` directly (file://) and `dist/PromptBuilderPro.html` share the same origin, so they share storage state.
- The app has no undo. Deleting a template is permanent.
