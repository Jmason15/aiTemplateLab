# aiTemplateLab

A browser-based tool for building, managing, and using structured AI prompt templates. Fill in your inputs, copy the generated JSON, and paste it directly into your AI tool of choice.

---

## What It Does

aiTemplateLab helps you create reusable prompt templates with a consistent structure:

- **Objective** — what the prompt should accomplish
- **Actor** — the AI persona or role
- **Context** — background the AI needs
- **Inputs** — fields you fill in each time you use the template
- **Constraints** — rules the AI must follow
- **Outputs** — what the AI should return and in what format
- **Success Criteria** — how to evaluate a good response

When you use a template, the app generates a structured JSON payload ready to paste into any AI tool (ChatGPT, Claude, etc.).

---

## Getting Started

**No install required.** Download `dist/aiTemplateLab.html` and open it in any modern browser. Everything runs locally — no server, no account, no data sent anywhere.

---

## Using Templates

1. Pick a template from the sidebar
2. Fill in the input fields on the **Use Template** tab
3. Click **Copy** to copy the structured JSON to your clipboard
4. Paste it into your AI tool

Your input values are saved to history automatically. Access previous runs from the **Template History** tab.

---

## Managing Templates

### Edit a Template
Click the **Edit Template** tab while a template is selected. Changes auto-save as you type.

### Create a New Template
Click **+ Blank Template** in the sidebar to start from scratch, or use **Import JSON** to paste in a template definition.

### Organize with Template Groups
Templates are organized into groups (workspaces). Use the dropdown in the sidebar to switch between groups. You can create, rename, save, and load groups independently.

### Import / Export
- **Export** — download selected templates as a JSON file to share or back up
- **Import** — load templates from a JSON file exported by this tool
- **Save/Load Workspace** — save or restore your entire environment (all groups and history) as a single file

---

## Building from Source

```bash
npm run build
# produces dist/aiTemplateLab.html
```

Source files live in `main/`. The build step inlines all CSS and JS into a single self-contained HTML file. See [CLAUDE.md](CLAUDE.md) for full developer documentation.

---

## Adding Prompt Templates

1. Create a JSON file in `main/Prompts/` following the template schema
2. Reference it in `main/config/workspaces.json`
3. Run `npm run build`

No JavaScript changes needed. See [CLAUDE.md](CLAUDE.md) for the full data model.
