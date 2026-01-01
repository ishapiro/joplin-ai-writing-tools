import { ChatGPTAPI } from './api';
import { WebviewMessage } from './types';
import { replaceSelectedText, getSelectedText, getCurrentNote, updateNoteContent, getCurrentFolderId } from './utils';

declare const joplin: any;

export class PanelHandler {
  private chatGPTAPI: ChatGPTAPI;
  private panel: string;
  private lastChatGPTResponse: string = '';

  constructor(api: ChatGPTAPI, panel: string) {
    this.chatGPTAPI = api;
    this.panel = panel;
  }
  
  // Getter for lastChatGPTResponse so it can be accessed from outside if needed
  public getLastResponse(): string {
    return this.lastChatGPTResponse;
  }

  // Setter for lastChatGPTResponse
  public setLastResponse(response: string): void {
    this.lastChatGPTResponse = response;
  }

  async handleAction(action: string): Promise<any> {
    try {
      console.log('Handling action:', action);
      
      switch (action) {
        case 'appendToNote':
          if (!this.lastChatGPTResponse) {
            return { success: false, error: 'No ChatGPT response to append. Send a message first.' };
          }
          const note = await getCurrentNote();
          await updateNoteContent(note.id, note.body + '\n\n---\n\n**ChatGPT Response:**\n' + this.lastChatGPTResponse);
          return { success: true, message: 'ChatGPT response appended to note successfully!' };
          
        case 'replaceNote':
          if (!this.lastChatGPTResponse) {
            return { success: false, error: 'No ChatGPT response to replace with. Send a message first.' };
          }
          const noteToReplace = await getCurrentNote();
          await updateNoteContent(noteToReplace.id, this.lastChatGPTResponse);
          return { success: true, message: 'Note replaced with ChatGPT response successfully!' };
          
        case 'insertAtCursor':
          if (!this.lastChatGPTResponse) {
            return { success: false, error: 'No ChatGPT response to insert. Send a message first.' };
          }
          // Check if a note is selected
          try {
            const noteIds = await joplin.workspace.selectedNoteIds();
            if (noteIds.length === 0) {
              return { success: false, error: 'No note selected. Please select a note first.' };
            }
            // Insert the response at the cursor position (replaceSelection works at cursor if no selection)
            await replaceSelectedText(this.lastChatGPTResponse);
            return { success: true, message: 'ChatGPT response inserted at cursor position successfully!' };
          } catch (error: any) {
            return { success: false, error: `Error inserting at cursor: ${error.message}` };
          }
          
        case 'createNewNote':
          if (!this.lastChatGPTResponse) {
            return { success: false, error: 'No ChatGPT response to create note with. Send a message first.' };
          }
          // Create a new note with the ChatGPT response
          const newNote = await joplin.data.post(['notes'], null, {
            title: 'ChatGPT Response - ' + new Date().toLocaleString(),
            body: this.lastChatGPTResponse,
            parent_id: await getCurrentFolderId()
          });
          
          // Make the new note active
          await joplin.commands.execute('openNote', newNote.id);
          
          return { success: true, message: 'New note created and opened successfully!' };
          
        case 'copyNoteToPrompt':
          const currentNote = await getCurrentNote();
          // Send the content directly to the webview
          try {
            console.log('About to send message to webview, panel:', this.panel);
            const result = await joplin.views.panels.postMessage(this.panel, {
              type: 'appendToPrompt',
              content: currentNote.body
            });
            console.log('PostMessage result:', result);
            console.log('Sent note content to webview:', currentNote.body.substring(0, 100) + '...');
          } catch (error: any) {
            console.error('Error sending message to webview:', error);
          }
          return { success: true, message: 'Note content appended to prompt input!' };
          
        case 'copySelectedToPrompt':
          const selectedText = await getSelectedText();
          if (!selectedText || selectedText.trim() === '') {
            return { success: false, error: 'No text selected. Please select some text first.' };
          }
          // Send the content directly to the webview
          try {
            console.log('About to send selected text to webview, panel:', this.panel);
            const result = await joplin.views.panels.postMessage(this.panel, {
              type: 'appendToPrompt',
              content: selectedText
            });
            console.log('PostMessage result for selected text:', result);
            console.log('Sent selected text to webview:', selectedText.substring(0, 100) + '...');
          } catch (error: any) {
            console.error('Error sending selected text to webview:', error);
          }
          return { success: true, message: 'Selected text appended to prompt input!' };
          
        case 'checkGrammar':
          const textToCheck = await getSelectedText();
          if (!textToCheck || textToCheck.trim() === '') {
            return { success: false, error: 'No text selected. Please select some text first.' };
          }
          
          // Show working message
          await joplin.views.panels.postMessage(this.panel, {
            type: 'addMessage',
            sender: 'system',
            content: 'Checking grammar...'
          });
          
          // Use ChatGPT to check grammar
          const grammarResponse = await this.chatGPTAPI.checkGrammar(textToCheck);
          
          // Show modal with corrected text for user approval
          await joplin.views.panels.postMessage(this.panel, {
            type: 'showGrammarModal',
            originalText: textToCheck,
            correctedText: grammarResponse
          });
          
          return { success: true, message: 'Grammar check completed! Please review the changes.' };
          
        case 'showAbout':
          // Send comprehensive help information to the chat
          await joplin.views.panels.postMessage(this.panel, {
            type: 'addMessage',
            sender: 'assistant',
            content: `<strong>🤖 AI Writing Toolkit v1.0.0 - Help & Features</strong><br><br>
<strong>📋 Action Buttons:</strong><br>
• <strong>📝 Append</strong> - Appends the AI response to the end of the current note<br>
• <strong>🔄 Replace</strong> - Replaces the entire current note with the AI response<br>
• <strong>📍 Insert</strong> - Inserts the AI response at your cursor position in the note<br>
• <strong>📄 New Note</strong> - Creates a new note with the AI response<br>
• <strong>📋 Note→Prompt</strong> - Copies the entire current note content to the chat prompt<br>
• <strong>✂️ Selected→Prompt</strong> - Copies your selected text to the chat prompt<br>
• <strong>✅ Grammar</strong> - Checks grammar and spelling of selected text with preview<br>
• <strong>ℹ️ Help</strong> - Shows this help information<br><br>
<strong>✨ Features:</strong><br>
• 💬 Interactive chat with conversation history<br>
• 📝 Copy response to clipboard or Joplin note<br>
• ✅ Grammar and spelling correction with preview<br>
• ✂️ Copy selected text to chat prompt<br>
• 🔒 Secure API key handling<br>
• 🎨 Professional UI<br>
• 📚 Conversation history maintains context across exchanges<br><br>
<strong>🚀 Getting Started:</strong><br>
1. Set your OpenAI API key in <em>Settings → AI Writing Toolkit</em><br>
2. Use the action buttons above or type your questions in the prompt field<br>
3. Select text in notes to use context-aware features like grammar checking<br>
4. Press Enter to send messages, or Shift+Enter for a new line<br><br>
<strong>🛠️ Technical Details:</strong><br>
• <strong>Models Supported:</strong> GPT-5, GPT-4.1, GPT-4o, o1, o3, o4-mini series<br>
• <strong>API:</strong> Latest OpenAI API with reasoning support<br>
• <strong>Security:</strong> Input validation, content sanitization, secure token handling<br>
• <strong>Performance:</strong> Token-aware history trimming, efficient API calls<br><br>
<strong>📚 Resources:</strong><br>
• <a href="https://github.com/ishapiro/joplin-ai-writing-toolkit" target="_blank">GitHub Repository</a> - Documentation, issues, updates<br>
• <a href="https://platform.openai.com/api-keys" target="_blank">Get OpenAI API Key</a><br>
• <a href="https://github.com/ishapiro/joplin-ai-writing-toolkit/issues" target="_blank">Report Issues</a> - Bug reports and feature requests<br>
• <a href="https://joplinapp.org/plugins/" target="_blank">Joplin Plugin Forum</a> - Community support<br><br>
<strong>👨‍💻 Developer:</strong> Irv Shapiro / Cogitations, LLC<br>
<strong>📄 License:</strong> MIT License<br>
<strong>🏷️ Version:</strong> 1.0.0<br>
<strong>🏢 Learn about Cogitations, LLC:</strong> <a href="https://cogitations.com" target="_blank">https://cogitations.com</a><br><br>
<em>Thank you for using AI Writing Toolkit! ⭐ Star the repo if you find it helpful!</em>`
          });
          
          return { success: true, message: 'Help information displayed' };
          
        default:
          return { success: false, error: 'Unknown action: ' + action };
      }
    } catch (error: any) {
      console.error('Error handling action:', error);
      return { success: false, error: error.message };
    }
  }

  async handleMessage(message: WebviewMessage): Promise<any> {
    try {
      if (message.type === 'sendChatMessage') {
        const response = await this.chatGPTAPI.sendMessage(message.message || '');
        this.lastChatGPTResponse = response; // Store for later use
        return { success: true, content: response };
      } else if (message.type === 'getCurrentModel') {
        // Return the current model setting
        const currentModel = await joplin.settings.value('openaiModel') || 'gpt-5.1';
        return { success: true, model: currentModel };
      } else if (message.type === 'updateModel') {
        // Update the model setting
        const modelToSet = (message as any).model || message.content;
        // Allow empty string for auto-select
        await joplin.settings.setValue('openaiModel', modelToSet || '');
        // Mark as user-set when changed from UI (even if blank, user explicitly chose it)
        await joplin.settings.setValue('openaiModelUserSet', true);
        // Reload settings in the API instance
        await this.chatGPTAPI.loadSettings();
        return { success: true, message: modelToSet ? `Model updated to ${modelToSet}` : 'Model set to auto-select latest' };
      } else if (message.type === 'clearHistory') {
        this.chatGPTAPI.clearConversationHistory();
        return { success: true, message: 'Conversation history cleared' };
      } else if (message.type === 'closePanel') {
        // Send a nicely formatted close message to the panel before closing
        await joplin.views.panels.postMessage(this.panel, {
          type: 'showCloseMessage'
        });
        return { success: true, message: 'Close message sent' };
      } else if (message.type === 'confirmClose') {
        // Actually close the panel after user confirms
        await joplin.views.panels.hide(this.panel);
        return { success: true, message: 'Panel closed' };
      } else if (message.type === 'acceptGrammarChanges') {
        // Replace the selected text with the corrected version
        if (message.correctedText) {
          await replaceSelectedText(message.correctedText);
          
          // Send confirmation message to the panel
          await joplin.views.panels.postMessage(this.panel, {
            type: 'addMessage',
            sender: 'system',
            content: 'Grammar corrections applied successfully!'
          });
          
          return { success: true, message: 'Grammar changes applied' };
        } else {
          return { success: false, error: 'No corrected text provided' };
        }
      } else if (message.type === 'executeAction') {
        return await this.handleAction(message.action || '');
      }
      return { success: false, error: 'Unknown message type' };
    } catch (error: any) {
      console.error('Error handling webview message:', error);
      return { success: false, error: error.message };
    }
  }
}

