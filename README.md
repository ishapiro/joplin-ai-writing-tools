# Joplin AI Writing Toolkit

## Overview
The **Joplin AI Writing Toolkit** is designed specifically for writers who use Joplin for drafting and note-taking. It integrates powerful AI capabilities directly into your workflow to help you draft documents, refine your writing, and organize your thoughts.

While currently focused on AI assistance and drafting tools, the roadmap includes comprehensive PDF publishing features to give you full control over your document's final output (title pages, headers, footers, etc.).

## Features

### 🤖 AI Assistance
- **Interactive Chat Panel**: Have a conversation with ChatGPT directly within Joplin. Ask questions, brainstorm ideas, or get feedback without leaving your notes.
- **Grammar & Style Check**: Select any text in your note and instantly check it for grammar, spelling, and stylistic improvements.
- **Note-to-Prompt**: Use your current note as a prompt for the AI to analyze, summarize, or expand upon.
- **Customizable Persona**: Easily edit the "System Prompt" to define how the AI behaves (e.g., as a professional editor, a creative co-writer, or a technical reviewer).

### ✍️ Writing Tools
- **Note Blocks**: Quickly insert a formatted note block to annotate your drafts without breaking flow.
  - Shortcut: `Ctrl+Shift+3` (or `Cmd+Shift+3` on macOS)
  - Inserts:
    ```markdown

    ```note

    ```
    
    ```

### 🔮 Roadmap: PDF Publishing
Future updates will introduce a robust PDF publishing engine allowing you to turn your Markdown drafts into professional documents with:
- Custom Title Pages
- Headers & Footers
- Page Numbers
- Logo Integration
- Advanced Layout Controls

## Usage

### Accessing the Toolkit
- **Tools Menu**: Access key functions under `Tools > AI Writing Toolkit` (if supported) or use the Command Palette.
- **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P`) and type "AI" to see all available commands.

### Chat Panel Buttons
The Chat Panel includes a set of quick-action buttons to streamline your workflow:

| Button | Action | Description |
|--------|--------|-------------|
| **📝 Append** | Append to Note | Appends the AI's last response to the end of your current note. |
| **🔄 Replace** | Replace Note | Replaces the *entire* content of your current note with the AI's last response. |
| **📍 Insert** | Insert at Cursor | Inserts the AI's last response at your current cursor position in the editor. |
| **📄 New Note** | Create New Note | Creates a brand new note containing the AI's last response. |
| **📋 Note→Prompt** | Note to Prompt | Copies the full content of your current note into the chat input field. |
| **✂️ Selected→Prompt** | Selected to Prompt | Copies only the currently selected text into the chat input field. |
| **✅ Grammar** | Check Grammar | Checks the selected text in your note for grammar and style issues. |
| **ℹ️ Help** | Help | Displays information about the plugin and its features. |

### Key Commands
| Command | Description | Shortcut |
|---------|-------------|----------|
| **Toggle AI Writing Toolkit** | Opens/Closes the AI Chat Panel. | `Ctrl+Shift+P` -> Search "Toggle" |
| **Check Grammar** | Checks selected text for errors. | Select text -> Command Palette |
| **Insert Note Block** | Inserts a `note` code block. | `Ctrl+Shift+3` / `Cmd+Shift+3` |
| **Open System Prompt** | Edit the AI's instructions. | Command Palette -> "Open System Prompt File" |

## Configuration
1. Go to **Tools > Options > AI Writing Toolkit** (or **Joplin > Settings** on macOS).
2. Enter your **OpenAI API Key**.
3. Select your preferred **Model** (e.g., gpt-4o, gpt-4-turbo).
4. Adjust other settings like `Max Tokens` or `System Prompt` as needed.

## Testing & Contributing

### How to Test
1. **Clone the Repository**
   ```bash
   git clone https://github.com/ishapiro/joplin-ai-writing-tools.git
   cd joplin-ai-writing-tools
   ```
2. **Install Dependencies**
   ```bash
   npm install
   ```
3. **Build the Plugin**
   ```bash
   npm run dist
   ```
   This will create a `publish/` directory containing the compiled `.jpl` file.
4. **Install in Joplin**
   - Open Joplin.
   - Go to **Tools > Options > Plugins**.
   - Click the **Gear Icon** (Manage your plugins) > **Install from file**.
   - Select the `publish/com.cogitations.ai-writing-toolkit.jpl` file you just built.
   - Restart Joplin to load the changes.

### Contributing
We welcome contributions!
- **Bug Reports & Feature Requests**: Please submit them via the [GitHub Issues](https://github.com/ishapiro/joplin-ai-writing-tools/issues) page.
- **Pull Requests**:
  1. Fork the repository.
  2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
  3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
  4. Push to the branch (`git push origin feature/AmazingFeature`).
  5. Open a Pull Request.

---
*Created by Irv Shapiro*
- [LinkedIn](https://www.linkedin.com/in/irvshapiro/)
- [GitHub Repository](https://github.com/ishapiro/joplin-ai-writing-tools)
- [Personal Website (Cogitations.com)](https://cogitations.com)
