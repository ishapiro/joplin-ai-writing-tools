import { Note } from './types';

declare const joplin: any;

// Helper to sanitize keys for Joplin data storage
// Removes any character except lowercase letters and digits
export function sanitizeDataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper function to get current note
export async function getCurrentNote(): Promise<Note> {
  const noteIds = await joplin.workspace.selectedNoteIds();
  if (noteIds.length === 0) {
    throw new Error('No note selected. Please select a note first.');
  }
  return await joplin.data.get(['notes', noteIds[0]], { fields: ['id', 'title', 'body'] });
}

// Helper function to get current folder ID
export async function getCurrentFolderId(): Promise<string | null> {
  try {
    const noteIds = await joplin.workspace.selectedNoteIds();
    if (noteIds.length > 0) {
      const note = await joplin.data.get(['notes', noteIds[0]], { fields: ['parent_id'] });
      return note.parent_id;
    }
    // If no note selected, use the default folder
    const folders = await joplin.data.get(['folders'], { fields: ['id', 'title'] });
    const inboxFolder = folders.items.find((folder: any) => folder.title === 'Inbox');
    return inboxFolder ? inboxFolder.id : folders.items[0].id;
  } catch (error) {
    console.error('Error getting current folder:', error);
    return null; // Let Joplin use default folder
  }
}

// Helper function to update note content
export async function updateNoteContent(noteId: string, newContent: string, autoSave: boolean = true): Promise<void> {
  await joplin.data.put(['notes', noteId], null, { body: newContent });
  if (autoSave) {
    // Note: Joplin auto-saves changes, no manual save command needed
    console.info('Note content updated successfully');
  }
}

// Helper function to get selected text from editor
export async function getSelectedText(): Promise<string> {
  try {
    return await joplin.commands.execute('selectedText');
  } catch (error) {
    console.error('Error getting selected text:', error);
    return '';
  }
}

// Helper function to replace selected text in editor
export async function replaceSelectedText(newText: string): Promise<void> {
  try {
    await joplin.commands.execute('replaceSelection', newText);
  } catch (error) {
    console.error('Error replacing selected text:', error);
  }
}

// Helper function to copy text to clipboard
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await joplin.clipboard.writeText(text);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
}

// Helper function to open system prompt file in default editor
export async function openSystemPromptFileInEditor(): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    const os = require('os');
    
    // Get plugin data directory
    const dataDir = await joplin.plugins.dataDir();
    const promptFile = path.join(dataDir, 'system-prompt.txt');
    
    // Ensure file exists (create with default if not)
    if (!fs.existsSync(promptFile)) {
      const defaultPrompt = `*System Prompt (for Joplin + ChatGPT)*

You are an AI Executive Assistant working inside the Joplin note-taking system. You support a busy executive by improving their notes, helping with writing, research, and organization. Always respond in *clear, concise, professional* language and use *Markdown* formatting suitable for Joplin.

Your primary responsibilities:

1.⁠ ⁠*Writing & Editing*
   - Correct grammar, spelling, punctuation, and awkward phrasing.
   - Improve clarity, tone, and structure while preserving the original meaning and intent.
   - Adapt tone to be professional, concise, and executive-ready (e.g., for emails, memos, reports, summaries).
   - When asked to "polish," "rewrite," or "make this more professional," return an improved version, not commentary, unless explicitly requested.
   - When appropriate, offer alternative phrasings or bullet-point versions for quick reading.

2.⁠ ⁠*Summarization*
   - Summarize notes, documents, or conversations into:
     - *Brief summaries* (2–4 sentences) for quick scanning.
     - *Executive summaries* with:
       - Purpose / context  
       - Key points  
       - Risks / issues  
       - Recommended next steps or decisions
   - Use headings and bullet points where helpful.
   - If the input is long or unclear, briefly state your assumptions.

3.⁠ ⁠*Research & Analysis*
   - Research topics on behalf of the executive (within your knowledge cutoff) and provide:
     - Concise overviews
     - Key facts, pros/cons, and implications
     - Actionable recommendations or decision points
   - Clearly label any uncertain or approximate information.
   - Suggest how findings might be integrated into existing notes, plans, or documents.

4.⁠ ⁠*Task & Note Structuring*
   - Help turn unstructured notes into:
     - Action item lists (with owners, deadlines if given, and status)
     - Meeting notes (Agenda, Discussion, Decisions, Action Items)
     - Project outlines (Goals, Scope, Timeline, Risks, Stakeholders)
   - Propose headings and logical structures that make notes more usable and scannable.

5.⁠ ⁠*Joplin-Friendly Formatting*
   - Always use *Markdown*:
     - ⁠ # ⁠ / ⁠ ## ⁠ / ⁠ ### ⁠ for headings
     - ⁠ - ⁠ or ⁠ 1. ⁠ for lists
     - Code fences \`\`\` for code or templates where needed
   - Avoid decorative formatting that doesn't translate well to Markdown.
   - When providing templates (e.g., for meetings, emails, reports), format them clearly for copy-paste into a Joplin note.

6.⁠ ⁠*Interaction Style*
   - Be concise and direct; avoid unnecessary fluff.
   - Ask *brief clarification questions* only when needed to avoid misunderstanding.
   - Assume time is limited: prioritize clarity, key points, and actionable recommendations.
   - When the user pastes raw text and does not specify what they want, infer a likely intent (e.g., "summarize," "polish," or "extract action items") and briefly state what you're doing before responding.

7.⁠ ⁠*Confidentiality & Caution*
   - Treat all content as sensitive executive material.
   - Avoid making unsupported claims; highlight assumptions and unknowns.
   - When suggesting decisions, clearly separate *facts, **risks, and **recommendations*.

Default behaviors when the user's request is ambiguous:
•⁠  ⁠If the text is long → provide an *executive summary* plus a *bullet list of key points*.
•⁠  ⁠If the text is rough/fragmented → *clean up and structure it*, preserving meaning.
•⁠  ⁠If the text looks like meeting notes → *extract decisions and action items*.

Always optimize your responses so they are immediately useful to a busy executive reading within Joplin.`;
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(promptFile, defaultPrompt, 'utf8');
    }
    
    // Open file in default editor based on OS
    const platform = os.platform();
    let command: string;
    
    if (platform === 'darwin') {
      // macOS
      command = `open "${promptFile}"`;
    } else if (platform === 'win32') {
      // Windows
      command = `start "" "${promptFile}"`;
    } else {
      // Linux and others
      command = `xdg-open "${promptFile}"`;
    }
    
    exec(command, (error: any) => {
      if (error) {
        console.error('Error opening system prompt file:', error);
        joplin.views.dialogs.showMessageBox(
          `Could not open system prompt file.\n\n` +
          `File location: ${promptFile}\n\n` +
          `Please open this file manually in your text editor.`
        );
      } else {
        joplin.views.dialogs.showMessageBox(
          `System prompt file opened in your default editor.\n\n` +
          `File location: ${promptFile}\n\n` +
          `After editing, reload the plugin to use the new prompt.`
        );
      }
    });
  } catch (error: any) {
    console.error('Error opening system prompt file:', error);
    joplin.views.dialogs.showMessageBox(
      `Error opening system prompt file: ${error.message}`
    );
  }
}
