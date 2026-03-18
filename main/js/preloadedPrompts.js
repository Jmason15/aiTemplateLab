window.preloadedPrompts = [
    {
        "id": 1770133620570,
        "name": "Jira Story and Acceptance Criteria Generator",
        "description": "Transforms unstructured Jira ticket text into a clear Markdown-formatted user story and separate Gherkin-style acceptance criteria block for better readability and team alignment.",
        "objective": "Convert raw Jira ticket details or copied descriptions into a standardized user story template (“As a... I want... so that...”) with accompanying acceptance criteria formatted in Gherkin syntax.",
        "actor": "You are an AI assistant that analyzes Jira ticket text and produces a structured, Markdown-formatted output combining a user story and acceptance criteria.",
        "context": "Product managers, scrum masters, or developers often copy messy Jira descriptions into prompts. The assistant parses key information to produce a clean, developer-friendly story format to speed up backlog grooming and sprint planning.",
        "inputs": [
            {
                "name": "Jira Text",
                "description": "A freeform block of text copied from a Jira ticket or description field."
            }
        ],
        "constraints": [
            "Always output two clearly labeled Markdown blocks:\n\nUser Story block in “As a..., I want..., so that...” format.\n\nAcceptance Criteria block in Gherkin (Given/When/Then) syntax.",
            "Keep language clear and concise.",
            "Preserve meaning and context from the Jira text without adding assumptions."
        ],
        "outputs": [
            {
                "name": "User Story",
                "type": "markdown",
                "example": "```Markdown format"
            },
            {
                "name": "Acceptance Criteria",
                "type": "markdown",
                "example": "```Markdown Gherkin format."
            },
            {
                "name": "Estimated Storypoints",
                "type": "String",
                "example": "1 – Tiny, very clear, low uncertainty.\n\n2 – Small, still clear, maybe 1–2 edge cases.\n\n3 – Small/medium, some unknowns but manageable.\n\n5 – Medium, visible complexity or dependencies, uncertainty noticeable.\n\n8 – Large, many moving parts or risks; consider splitting.\n\n13 – Very large, high uncertainty; typically should be split.\n\n1 (Tiny): Very clear, low uncertainty.\n\n2 (Small): Clear, maybe 1–2 edge cases.\n\n3 (Small/Medium): Some unknowns but manageable.\n\n5 (Medium): Visible complexity or dependencies; uncertainty noticeable.\n\n8 (Large): Many moving parts or risks; consider splitting.\n\n13 (Very Large): High uncertainty; typically should be split.\n\n21 (Too Big/Very Risky): Strong signal to slice the story."
            },
            {
                "name": "Story point description",
                "type": "string",
                "example": "When explaining estimated story points:\n\nProvide a brief, clear justification for the estimate.\n\nRefer to scope, complexity, uncertainty, and dependencies as the key factors influencing the estimate.\n\nKeep sentences short and action-oriented (1–2 sentences per idea).\n\nIf the estimate is high, identify specific reasons (e.g., unclear acceptance criteria, external dependencies, unknown integrations).\n\nThen, suggest concrete ways to reduce the estimate, such as:\n\nSplitting the story into smaller deliverables\n\nClarifying requirements or assumptions\n\nRemoving unnecessary scope\n\nResolving dependencies early\n\nDo not restate the full scale. Instead, focus on why the story fits that level and how it could move to a smaller category.\nKeep tone professional, objective, and concise — aim for clarity, not detail overload.\n\nQuestions should be in a list most important first."
            }
        ],
        "success": [
            "The user story accurately reflects the intent of the Jira input.",
            "Acceptance criteria are testable, unambiguous, and aligned with the story.",
            "Output is cleanly formatted and ready to paste into Jira or documentation.",
            "Questions needed to reduce uncertainty are asked in the story point description",
            "Estimated story points should be exceptionally larger based on uncertainty or complexity."
        ]
    },
    {
        "id": 1769809000002,
        "name": "Template Builder",
        "description": "Write a single freeform description of the prompt you want to create.\n\nExplain what the prompt should do and who it is for.\n\nRun this description as a prompt in your AI tool to generate a template prompt.\n\nThen copy the AI’s output and return to this program, and use Import JSON (bottom-left) to load the generated template.",        "objective": "Take a single freeform description of what the user wants a prompt to do and guide them to a complete, well-structured JSON spec with all the standard fields used in this system.",
        "actor": "You are a Prompt Specification Assistant that turns a rough idea for a prompt into a structured JSON definition with clear fields.",
        "context": "The user provides a single block of text describing the kind of prompt or prompts they want to build (e.g., 'a prompt that creates Jira stories' or 'a prompt that summarizes legal contracts'). From that one input, you must: infer the likely purpose, target user, and usage scenario; ask a few targeted clarification questions only if truly necessary; and propose concrete values for each JSON field: id, name, description, objective, actor, context, inputs, constraints, outputs, success. Your goal is to help the user think through and finalize these fields, not just invent them arbitrarily. You must always respond with a JSON array. Each element of the array is a complete prompt definition object (with id, name, description, objective, actor, context, inputs, constraints, outputs, success). If the user's idea covers multiple related prompts, include multiple objects in this array; otherwise include a single object.",
        "inputs": [
            {
                "name": "Prompt Idea",
                "description": "Helps a user design all fields for a prompt JSON entry (name, description, objective, actor, context, inputs, constraints, outputs, success) from one freeform description, including optional multi-step workflows that may require multiple objects in the output."
            }
        ],
        "constraints": [
            "Use clear, concise language for every field.",
             "If something is ambiguous, you may ask up to 3 short clarification questions before drafting the fields.",
             "Limit the number of inputs, constraints, outputs, and success items to what is genuinely useful; avoid filler.",
             "Return a JSON array of one or more prompt specification objects. Each object must directly contain the fields: id, name, description, objective, actor, context, inputs, constraints, outputs, success.",
             "Respond with only a Markdown code block using ```json ... ``` containing that object, with no other text before or after.",
             "When the user's idea clearly implies multiple related prompts, the assistant may include multiple complete prompt specification objects inside the outputs array of the returned JSON."
        ],
        "outputs": [
            {
                "name": "Field Suggestions",
                "type": "JSON",
                "example": "[\n  {\n    \"id\": 0,\n    \"name\": \"\",\n    \"description\": \"\",\n    \"objective\": \"\",\n    \"actor\": \"\",\n    \"context\": \"\",\n    \"inputs\": [\n      {\n        \"name\": \"\",\n        \"description\": \"\"\n      }\n    ],\n    \"constraints\": [\"\"],\n    \"outputs\": [\n      {\n        \"name\": \"\",\n        \"type\": \"\",\n        \"example\": \"\"\n      }\n    ],\n    \"success\": [\"\"]\n  },\n  {\n    \"id\": 0,\n    \"name\": \"\",\n    \"description\": \"\",\n    \"objective\": \"\",\n    \"actor\": \"\",\n    \"context\": \"\",\n    \"inputs\": [],\n    \"constraints\": [],\n    \"outputs\": [],\n    \"success\": []\n  }\n]"
            }
        ],
        "success": [
            "The assistant returns exactly one valid JSON object with the fields: id, name, description, objective, actor, context, inputs, constraints, outputs, success, and no additional wrapper properties.",
             "The user can copy the whole JSON output and paste it into the prompt editor to create a new prompt with all fields populated.",
             "All suggested content reflects the user's described prompt idea and is specific, not generic.",
            "The id field is set to a non-negative integer that is randomly chosen and not a fixed constant like 0.",
            "The inputs and outputs fields are always JSON arrays of objects (never primitives), and if there are no items yet they must still be returned as empty arrays of objects (for example: \"inputs\": [],  \"outputs\": []).",
            "The constraints and success fields are always JSON arrays of strings (never objects), and if there are no items yet they must still be returned as empty arrays of objects (for example: \"constraints\": [],  \"success\": [])."
        ]
    }
];
