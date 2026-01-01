// AI Writing Toolkit Plugin - TypeScript Implementation

// Type definitions for Joplin API
declare const joplin: any;

// Setting types enum
enum SettingItemType {
  Int = 1,
  String = 2,
  Bool = 3
}

// Toolbar button location enum
enum ToolbarButtonLocation {
  NoteToolbar = 'noteToolbar',
  EditorToolbar = 'editorToolbar'
}

// Note: MenuItemLocation values updated to match current Joplin API (strings instead of numbers)
enum MenuItemLocation {
  File = 'file',
  Edit = 'edit',
  View = 'view',
  Note = 'note',
  Tools = 'tools',
  Help = 'help',
  Context = 'context',
  EditorContextMenu = 'editorContextMenu'
}

// Type definitions for our plugin
interface ChatGPTAPISettings {
  openaiApiKey: string;
  openaiModel: string;
  maxTokens: number;
  systemPrompt: string;
  autoSave: boolean;
  reasoningEffort: string;
  verbosity: string;
}

interface WebviewMessage {
  type: string;
  content?: string;
  sender?: string;
  action?: string;
  message?: string;
  correctedText?: string;
}

interface Note {
  id: string;
  title: string;
  body: string;
  parent_id?: string;
}

interface ChatGPTResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

// Helper to sanitize keys for Joplin data storage
// Removes any character except lowercase letters and digits
function sanitizeDataKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ChatGPT API class with proper typing
class ChatGPTAPI {
  private settings: ChatGPTAPISettings;
  private conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];

  constructor() {
    this.settings = {
      openaiApiKey: '',
      openaiModel: 'gpt-5.1',
      maxTokens: 1000,
      systemPrompt: `*System Prompt (for Joplin + ChatGPT)*

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

Always optimize your responses so they are immediately useful to a busy executive reading within Joplin.`,
      autoSave: true,
      reasoningEffort: 'low',
      verbosity: 'low'
    };
  }

  async loadSettings(): Promise<void> {
    this.settings.openaiApiKey = await joplin.settings.value('openaiApiKey');
    const modelValue = await joplin.settings.value('openaiModel');
    
        // Validate model if not blank
        if (modelValue && modelValue.trim() !== '') {
          const isValid = await this.validateModel(modelValue);
          if (!isValid.valid) {
            console.warn('Model validation failed for:', modelValue);
            console.warn('Valid models found:', isValid.validModels.join(', '));
            
            // Just warn, don't reset. This allows new models or models not yet in our list to be used.
            // If the model is truly invalid, the OpenAI API call will fail later with a clear error.
            /* 
            await joplin.views.dialogs.showMessageBox(
              `Warning: Model "${modelValue}" not found in current list.\n\n` +
              `Attempting to use it anyway. If it fails, please select a valid model from settings.`
            );
            */
           this.settings.openaiModel = modelValue;
          } else {
            this.settings.openaiModel = modelValue;
          }
        } else {
          this.settings.openaiModel = '';
        }
    
    this.settings.maxTokens = await joplin.settings.value('maxTokens');
    
    // Load system prompt from file (always returns a default if file doesn't exist)
    try {
      this.settings.systemPrompt = await this.loadSystemPromptFromFile();
      // Ensure we always have a non-empty system prompt
      if (!this.settings.systemPrompt || this.settings.systemPrompt.trim().length === 0) {
        console.warn('[ChatGPT API] System prompt was empty, using default');
        this.settings.systemPrompt = `*System Prompt (for Joplin + ChatGPT)*

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
      }
    } catch (error: any) {
      console.error('[ChatGPT API] Error loading system prompt, using default:', error);
      // Fallback to hardcoded default
      this.settings.systemPrompt = `*System Prompt (for Joplin + ChatGPT)*

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
    }
    
    this.settings.autoSave = await joplin.settings.value('autoSave');
    this.settings.reasoningEffort = await joplin.settings.value('reasoningEffort');
    this.settings.verbosity = await joplin.settings.value('verbosity');
  }

  // Load system prompt from file (similar to Joplin's styles)
  async loadSystemPromptFromFile(): Promise<string> {
    // Default prompt - always use this as fallback
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
    
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Get plugin data directory
      const dataDir = await joplin.plugins.dataDir();
      const promptFile = path.join(dataDir, 'system-prompt.txt');
      
      // Check if file exists and has content
      if (fs.existsSync(promptFile)) {
        try {
          const content = fs.readFileSync(promptFile, 'utf8');
          // Only use file content if it's not empty after trimming
          if (content && content.trim().length > 0) {
            console.info('[ChatGPT API] Loaded system prompt from file:', promptFile);
            // Update path in settings
            try {
              await joplin.settings.setValue('systemPromptFile', promptFile);
            } catch (settingsError: any) {
              console.warn('[ChatGPT API] Could not update system prompt file path in settings:', settingsError);
            }
            return content.trim();
          } else {
            console.warn('[ChatGPT API] System prompt file exists but is empty, using default');
          }
        } catch (readError: any) {
          console.error('[ChatGPT API] Error reading system prompt file:', readError);
          // Continue to create/use default
        }
      }
      
      // File doesn't exist, is empty, or couldn't be read - use default
      console.info('[ChatGPT API] Using default system prompt (file not found or empty)');
      
      // Ensure directory exists before writing
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Write default prompt to file for future use
        fs.writeFileSync(promptFile, defaultPrompt, 'utf8');
        console.info('[ChatGPT API] Created default system prompt file:', promptFile);
        
        // Store file path in settings for reference
        try {
          await joplin.settings.setValue('systemPromptFile', promptFile);
        } catch (settingsError: any) {
          console.warn('[ChatGPT API] Could not save system prompt file path to settings:', settingsError);
          // Non-critical, continue
        }
      } catch (writeError: any) {
        console.error('[ChatGPT API] Could not create system prompt file:', writeError);
        // Non-critical, we'll still use the default prompt
      }
      
      // Always return default if file doesn't exist or is empty
      return defaultPrompt;
    } catch (error: any) {
      console.error('[ChatGPT API] Error loading system prompt from file:', error);
      // Always return default on any error
      return defaultPrompt;
    }
  }

  // Get system prompt file path
  async getSystemPromptFilePath(): Promise<string> {
    const path = require('path');
    const dataDir = await joplin.plugins.dataDir();
    return path.join(dataDir, 'system-prompt.txt');
  }

    async validateModel(modelId: string): Promise<{valid: boolean, validModels: string[]}> {
    // Get available models from storage
    let availableModels: ModelInfo[] = [];
    try {
      console.debug(`[ChatGPT API] Reading models from settings cache`);
      const storedModelsStr = await joplin.settings.value('modelCache');
      if (storedModelsStr) {
        availableModels = JSON.parse(storedModelsStr);
      }
    } catch (e) {
      // Models not in storage, use defaults
      console.warn('Error reading model cache:', e);
    }
    
    // If no stored models, use default list
    if (availableModels.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      availableModels = [
        { id: 'gpt-5.1', created: now },
        { id: 'gpt-5', created: now - 86400 },
        { id: 'gpt-5-mini', created: now - 172800 },
        { id: 'gpt-5-nano', created: now - 259200 },
        { id: 'gpt-4.1', created: now - 345600 },
        { id: 'gpt-4.1-mini', created: now - 432000 },
        { id: 'gpt-4.1-nano', created: now - 518400 },
        { id: 'gpt-4o', created: now - 604800 },
        { id: 'gpt-4o-mini', created: now - 691200 },
        { id: 'o1', created: now - 1036800 },
        { id: 'o1-preview', created: now - 1123200 },
        { id: 'o3', created: now - 1209600 },
        { id: 'o3-mini', created: now - 1296000 },
        { id: 'o4-mini', created: now - 1382400 }
      ];
    }
    
    const validModelIds = availableModels.map(m => m.id);
    let isValid = validModelIds.includes(modelId);
    
    // If not valid, try fetching fresh models from API to be sure
    if (!isValid && this.settings.openaiApiKey) {
      console.info(`Model '${modelId}' not found in cache, fetching fresh list from OpenAI...`);
      const freshModels = await fetchAvailableModels(this.settings.openaiApiKey);
      
      if (freshModels.length > 0) {
        // Update local list
        availableModels = freshModels;
        const freshValidIds = freshModels.map(m => m.id);
        isValid = freshValidIds.includes(modelId);
        
        // Update storage
        try {
          console.debug(`[ChatGPT API] Saving models to settings cache`);
          await joplin.settings.setValue('modelCache', JSON.stringify(freshModels));
          
          // Update fetched flag - we can reuse the boolean setting if needed or just rely on cache presence
          const modelsFetchedKey = sanitizeDataKey('models_fetched');
           // Keep this for now or remove if not needed elsewhere
          try {
             const pluginId = sanitizeDataKey('com.cogitations.ai-writing-toolkit');
             await joplin.data.put(['plugins', pluginId, 'data', modelsFetchedKey], null, { value: 'true' });
          } catch (e) {
              // Ignore data put error for now as we have the setting cache
          }

          console.info('Updated model cache with fresh list');
        } catch (e) {
          console.warn('Failed to update model storage:', e);
        }
        
        return {
          valid: isValid,
          validModels: freshValidIds.sort()
        };
      }
    }
    
    return {
      valid: isValid,
      validModels: validModelIds.sort()
    };
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
    console.info(`[ChatGPT API] Conversation history cleared`);
  }

  // Validate API key format
  private validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    // Check for basic OpenAI API key format (sk- or sk-proj- prefix)
    if (!apiKey.startsWith('sk-')) {
      console.warn('API key validation: Key should start with "sk-"');
      return true; // Allow anyway, just warn
    }
    
    // Current API keys are typically 150+ characters
    if (apiKey.length < 20 || apiKey.length > 200) {
      return false;
    }
    
    // Allow letters, numbers, hyphens, underscores, and periods
    // Modern OpenAI API keys follow format: sk-proj-[long alphanumeric string]
    if (!/^sk-[A-Za-z0-9\-_\.]+$/.test(apiKey)) {
      return false;
    }
    
    return true;
  }

  // Estimate token count for a message (rough approximation: 1 token ≈ 4 characters)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Get conversation history limited by token count
  private getLimitedHistory(maxTokens: number): Array<{role: 'user' | 'assistant', content: string}> {
    if (this.conversationHistory.length === 0) {
      return [];
    }

    let totalTokens = 0;
    const limitedHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    // Start from the most recent messages and work backwards
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const message = this.conversationHistory[i];
      const messageTokens = this.estimateTokens(message.content);
      
      if (totalTokens + messageTokens <= maxTokens) {
        limitedHistory.unshift(message); // Add to beginning to maintain order
        totalTokens += messageTokens;
      } else {
        break; // Stop if adding this message would exceed the limit
      }
    }
    
    console.info(`[ChatGPT API] History limited to ${limitedHistory.length} messages (estimated ${totalTokens} tokens, max ${maxTokens})`);
    return limitedHistory;
  }

  // Trim conversation history to stay within token limits
  private trimHistoryToTokenLimit(maxTokens: number): void {
    if (this.conversationHistory.length === 0) {
      return;
    }

    let totalTokens = 0;
    const trimmedHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    // Start from the most recent messages and work backwards
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      const message = this.conversationHistory[i];
      const messageTokens = this.estimateTokens(message.content);
      
      if (totalTokens + messageTokens <= maxTokens) {
        trimmedHistory.unshift(message); // Add to beginning to maintain order
        totalTokens += messageTokens;
      } else {
        break; // Stop if adding this message would exceed the limit
      }
    }
    
    this.conversationHistory = trimmedHistory;
    console.info(`[ChatGPT API] History trimmed to ${trimmedHistory.length} messages (estimated ${totalTokens} tokens, max ${maxTokens})`);
  }

  async sendMessage(userMessage: string): Promise<string> {
    await this.loadSettings();

    if (!this.settings.openaiApiKey) {
      throw new Error('OpenAI API key is not set. Please configure it in Settings → Plugins → AI Writing Toolkit.');
    }

    console.info(`[ChatGPT API] Starting request to model: ${this.settings.openaiModel}`);
    console.info(`[ChatGPT API] User message length: ${userMessage.length} characters`);
    console.info(`[ChatGPT API] Max tokens: ${this.settings.maxTokens}`);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error(`[ChatGPT API] Request timeout after 60 seconds for model: ${this.settings.openaiModel}`);
      controller.abort();
    }, 60000); // 60 second timeout

    try {
      // Determine the correct endpoint and parameter name based on model type
      const endpoint = (this.settings.openaiModel.startsWith('o3') || this.settings.openaiModel === 'o4-mini') 
        ? 'https://api.openai.com/v1/responses'
        : 'https://api.openai.com/v1/chat/completions';
      
      const isResponsesEndpoint = endpoint.includes('/responses');
      
      // Build messages array with conversation history
      const messages = [
        { role: 'system', content: this.settings.systemPrompt + '\n\nPlease format your responses using Markdown syntax for better readability.' }
      ];
      
      // Add conversation history, but limit to 1/2 of max tokens
      const maxHistoryTokensForRequest = Math.floor(this.settings.maxTokens / 2);
      const recentHistory = this.getLimitedHistory(maxHistoryTokensForRequest);
      messages.push(...recentHistory);
      
      // Add current user message
      messages.push({ role: 'user', content: userMessage });
      
      const requestBody: any = {
        model: this.settings.openaiModel,
        [isResponsesEndpoint ? 'input' : 'messages']: messages,
        ...(this.settings.openaiModel.includes('gpt-5') || this.settings.openaiModel.includes('gpt-4.1') || this.settings.openaiModel.startsWith('o')
          ? { max_completion_tokens: this.settings.maxTokens }
          : { max_tokens: this.settings.maxTokens }
        ),
        stream: false
      };

      // Add new parameters for newer models
      if (this.settings.openaiModel.includes('gpt-5') || this.settings.openaiModel.startsWith('o')) {
        requestBody.reasoning_effort = this.settings.reasoningEffort; // low, medium, high
        requestBody.verbosity = this.settings.verbosity; // low, medium, high
      }

      console.info(`[ChatGPT API] Request body:`, JSON.stringify(requestBody, null, 2));
      console.info(`[ChatGPT API] Using endpoint: ${endpoint}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.openaiApiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.info(`[ChatGPT API] Response status: ${response.status} ${response.statusText}`);
      console.info(`[ChatGPT API] Response headers:`, {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
        'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining')
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          const errorText = await response.text();
          console.error(`[ChatGPT API] Error response body:`, errorText);
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          console.error(`[ChatGPT API] Failed to parse error response:`, parseError);
        }
        
        const errorMessage = `OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || errorData.error?.code || 'Unknown error'}`;
        console.error(`[ChatGPT API] Full error:`, errorMessage);
        throw new Error(errorMessage);
      }

      // Handle non-streaming response
      const responseText = await response.text();
      console.info(`[ChatGPT API] Response body length: ${responseText.length} characters`);
      
      let data: ChatGPTResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[ChatGPT API] Failed to parse response JSON:`, parseError);
        console.error(`[ChatGPT API] Raw response:`, responseText);
        throw new Error('Invalid JSON response from OpenAI API');
      }

      console.info(`[ChatGPT API] Parsed response:`, {
        choices: data.choices?.length || 0,
        usage: data.usage,
        model: data.model
      });

      if (!data.choices || data.choices.length === 0) {
        console.error(`[ChatGPT API] No choices in response:`, data);
        throw new Error('No response choices received from ChatGPT');
      }

      const content = data.choices[0]?.message?.content;
      if (!content) {
        console.error(`[ChatGPT API] No content in first choice:`, data.choices[0]);
        throw new Error('No content in ChatGPT response');
      }

      console.info(`[ChatGPT API] Success! Response length: ${content.length} characters`);
      
      // Store the conversation exchange in history
      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: content });
      
      // Trim history to stay within token limits (keep it under 1/2 of max tokens)
      const maxHistoryTokensForStorage = Math.floor(this.settings.maxTokens / 2);
      this.trimHistoryToTokenLimit(maxHistoryTokensForStorage);
      
      console.info(`[ChatGPT API] Conversation history now has ${this.conversationHistory.length} messages`);
      
      return content;

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error(`[ChatGPT API] Request was aborted (timeout) for model: ${this.settings.openaiModel}`);
        throw new Error(`Request timeout after 60 seconds. This may indicate the model '${this.settings.openaiModel}' is not available or experiencing issues.`);
      }
      
      console.error(`[ChatGPT API] Request failed:`, error);
      
      if (error.message.includes('fetch')) {
        throw new Error(`Network error: ${error.message}. Please check your internet connection and try again.`);
      }
      
      throw error;
    }
  }

  async improveNote(noteContent: string): Promise<string> {
    const prompt = `Please improve the following note content by enhancing clarity, structure, and readability while preserving the original meaning and key information:

${noteContent}

Please provide only the improved version without any additional commentary.`;
    
    return await this.sendMessage(prompt);
  }

  async summarizeNote(noteContent: string): Promise<string> {
    const prompt = `Please provide a concise summary of the following note content, highlighting the key points and main ideas:

${noteContent}

Please provide only the summary without any additional commentary.`;
    
    return await this.sendMessage(prompt);
  }

  async checkGrammar(text: string): Promise<string> {
    const prompt = `Please fix any grammar, spelling, and punctuation errors in the following text while preserving the original meaning and style:

${text}

Please provide only the corrected version without any additional commentary.`;
    
    return await this.sendMessage(prompt);
  }
}

// Interface for model data with metadata
interface ModelInfo {
  id: string;
  created: number;
  owned_by?: string;
}

// Function to fetch available models from OpenAI API
async function fetchAvailableModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Failed to fetch models from OpenAI API:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    if (data.data && Array.isArray(data.data)) {
      // Filter and extract model info for chat/completion models
      const models: ModelInfo[] = data.data
        .filter((model: any) => {
          const id = model.id || '';
          
          // Filter for relevant models (chat models)
          // Include all 'gpt' models and 'o' series (o1, o3, etc)
          // This is more permissive to ensure we support what the user has access to
          return id.includes('gpt') || /^o\d/.test(id);
        })
        .map((model: any) => ({
          id: model.id,
          created: model.created || 0,
          owned_by: model.owned_by
        }))
        // Sort by created date (newest first)
        .sort((a: ModelInfo, b: ModelInfo) => b.created - a.created);
      
      console.info('Fetched', models.length, 'available models from OpenAI API');
      return models;
    }
    return [];
  } catch (error: any) {
    console.warn('Error fetching models from OpenAI API:', error.message);
    return [];
  }
}

// Register the plugin
joplin.plugins.register({
  onStart: async function() {
    console.info('AI Writing Toolkit Plugin started!');
    const pluginDataPath = sanitizeDataKey('com.cogitations.ai-writing-toolkit');
    
    try {
      // ===== LOAD MODELS FOR SETTINGS DROPDOWN =====
      // Try to load stored models for the settings dropdown
      let modelsForSettings: ModelInfo[] = [];
      
      try {
        console.debug(`[onStart] Reading models from settings cache`);
        const storedModelsStr = await joplin.settings.value('modelCache');
        if (storedModelsStr) {
          modelsForSettings = JSON.parse(storedModelsStr);
          modelsForSettings.sort((a: ModelInfo, b: ModelInfo) => b.created - a.created);
          console.info('Loaded', modelsForSettings.length, 'models for settings dropdown');
        }
      } catch (e) {
        // Models not in storage yet, will use defaults
      }
      
      // Default models if none are stored
      if (modelsForSettings.length === 0) {
        const now = Math.floor(Date.now() / 1000);
        modelsForSettings = [
          { id: 'gpt-5.1', created: now },
          { id: 'gpt-5', created: now - 86400 },
          { id: 'gpt-5-mini', created: now - 172800 },
          { id: 'gpt-5-nano', created: now - 259200 },
          { id: 'gpt-4.1', created: now - 345600 },
          { id: 'gpt-4.1-mini', created: now - 432000 },
          { id: 'gpt-4.1-nano', created: now - 518400 },
          { id: 'gpt-4o', created: now - 604800 },
          { id: 'gpt-4o-mini', created: now - 691200 },
          { id: 'o1', created: now - 1036800 },
          { id: 'o1-preview', created: now - 1123200 },
          { id: 'o3', created: now - 1209600 },
          { id: 'o3-mini', created: now - 1296000 },
          { id: 'o4-mini', created: now - 1382400 }
        ];
      }
      
      // Create options object for dropdown (with blank option for auto-select)
      const settingsModelOptions: {[key: string]: string} = {
        '': '(Auto-select latest general model)'
      };
      
      // Add all models with formatted display names
      modelsForSettings.forEach(model => {
        const displayName = model.id === 'gpt-5.1' ? 'GPT-5.1 (Latest)' : 
                           model.id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        settingsModelOptions[model.id] = displayName;
      });
      
      // Debug: Log the options object (using console.log for better visibility)
      console.log('=== AI Writing Toolkit Settings Debug ===');
      console.log('Settings dropdown options:', JSON.stringify(settingsModelOptions, null, 2));
      console.log('Number of model options:', Object.keys(settingsModelOptions).length);
      console.log('Models for settings:', modelsForSettings.map(m => m.id).join(', '));
      
      // ===== SETTINGS SETUP =====
      console.log('Setting up AI Writing Toolkit settings...');
      
      // Get system prompt file path for default value
      const path = require('path');
      let systemPromptFilePath = '';
      try {
        const dataDir = await joplin.plugins.dataDir();
        systemPromptFilePath = path.join(dataDir, 'system-prompt.txt');
      } catch (error: any) {
        console.warn('Could not get plugin data directory for system prompt file path:', error);
        // Will be set later when file is created
      }
      
      // Create a settings section so options appear in Joplin's UI
      const pluginVersion = '1.0.0';
      const loadTimestamp = new Date().toLocaleString();
      await joplin.settings.registerSection('chatgptToolkit', {
        label: 'AI Writing Toolkit',
        iconName: 'fas fa-robot',
        description: `AI-powered writing assistant for Joplin. Version: ${pluginVersion} | Loaded: ${loadTimestamp} | Source: https://github.com/ishapiro/joplin-ai-writing-toolkit`
      });

      try {
        console.log('Registering settings with options:', {
          modelOptionsCount: Object.keys(settingsModelOptions).length,
          hasOptions: !!settingsModelOptions,
          optionsKeys: Object.keys(settingsModelOptions).slice(0, 5).join(', ') + '...'
        });
        
        await joplin.settings.registerSettings({
          'modelCache': {
            value: '',
            type: SettingItemType.String,
            public: false,
            label: 'Model Cache',
          },
          'openaiApiKey': {
            value: '',
            type: SettingItemType.String,
            label: 'OpenAI API Key',
            description: 'Your OpenAI API key for ChatGPT access. Get one from https://platform.openai.com/api-keys',
            public: true,
            section: 'chatgptToolkit',
          },
          'openaiModel': {
            value: '',
            type: SettingItemType.String,
            label: 'OpenAI Model',
            description: 'Select a model from the dropdown, or choose "(Auto-select latest general model)" to automatically use the newest general model. Models are filtered to gpt-4o and newer.',
            public: true,
            section: 'chatgptToolkit',
            options: settingsModelOptions,
          },
        'maxTokens': {
          value: 1000,
          type: SettingItemType.Int,
          label: 'Max Tokens',
          description: 'Maximum number of tokens to generate in responses',
          public: true,
          section: 'chatgptToolkit',
        },
        'openSystemPromptFile': {
          value: false,
          type: SettingItemType.Bool,
          label: 'Open System Prompt File',
          description: 'To open the system prompt file: 1) Check this box, 2) Click "Apply", 3) The editor will open. After editing, uncheck the box and click "Apply" again. The file will be created with a default prompt if it doesn\'t exist. After editing, reload the plugin to use the new prompt.',
          public: true,
          section: 'chatgptToolkit',
        },
        'systemPromptFile': {
          value: systemPromptFilePath || 'Will be set when plugin loads',
          type: SettingItemType.String,
          label: 'System Prompt File Path',
          description: 'Full path to the system prompt file (shown below the button above).',
          public: true,
          section: 'chatgptToolkit',
          readOnly: true,
        },
        'openaiModelUserSet': {
          value: false,
          type: SettingItemType.Bool,
          label: 'Model User Set Flag',
          description: 'Internal flag to track if user manually set the model',
          public: false,
          section: 'chatgptToolkit',
        },
        'autoSave': {
          value: true,
          type: SettingItemType.Bool,
          label: 'Auto-save Changes',
          description: 'Automatically save note changes after AI operations',
          public: true,
          section: 'chatgptToolkit',
        },
        'reasoningEffort': {
          value: 'low',
          type: SettingItemType.String,
          label: 'Reasoning Effort',
          description: 'Controls depth of reasoning for GPT-5 and o-series models (low, medium, high)',
          public: true,
          section: 'chatgptToolkit',
        },
        'verbosity': {
          value: 'low',
          type: SettingItemType.String,
          label: 'Verbosity',
          description: 'Controls response detail level for GPT-5 and o-series models (low, medium, high)',
          public: true,
          section: 'chatgptToolkit',
        },
        'pluginVersion': {
          value: `${pluginVersion} | Loaded: ${loadTimestamp}`,
          type: SettingItemType.String,
          label: 'Plugin Version & Status',
          description: 'Shows the current plugin version and when it was last loaded. This helps verify you are running the latest code.',
          public: true,
          section: 'chatgptToolkit',
          isEnum: false,
        },
      });
      
      // Debug: Log settings registration
      console.log('Settings registered successfully');
      console.log('Model setting options count:', Object.keys(settingsModelOptions).length);
      console.log('System prompt file path:', systemPromptFilePath);
      console.log('=== End Settings Debug ===');
      
      // Update system prompt file path after it's created
      try {
        const chatGPTAPI = new ChatGPTAPI();
        await chatGPTAPI.loadSettings(); // This will create the file if it doesn't exist
        const actualPath = await chatGPTAPI.getSystemPromptFilePath();
        if (actualPath) {
          await joplin.settings.setValue('systemPromptFile', actualPath);
          systemPromptFilePath = actualPath;
        }
      } catch (error: any) {
        console.warn('Could not update system prompt file path:', error);
      }
      
      // Handle checkbox for opening system prompt file
      // User workflow: Check box → Click Apply → Editor opens → Uncheck box → Click Apply
      joplin.settings.onChange(async (event: any) => {
        if (event.keys.includes('openSystemPromptFile')) {
          const currentValue = await joplin.settings.value('openSystemPromptFile');
          // Only open file when checkbox is checked (true)
          // User will manually uncheck it after editing
          if (currentValue === true) {
            try {
              // Open the file
              await joplin.commands.execute('openSystemPromptFile');
              
              // Update the path display after opening (file may have been created)
              try {
                const chatGPTAPI = new ChatGPTAPI();
                const actualPath = await chatGPTAPI.getSystemPromptFilePath();
                if (actualPath) {
                  await joplin.settings.setValue('systemPromptFile', actualPath);
                }
              } catch (pathError: any) {
                console.warn('Could not update system prompt file path after opening:', pathError);
              }
            } catch (error: any) {
              console.error('Error opening system prompt file from settings:', error);
              await joplin.views.dialogs.showMessageBox(
                `Error opening system prompt file: ${error.message}\n\n` +
                `You can also use the Command Palette (Ctrl+Shift+P / Cmd+Shift+P) and search for "Open System Prompt File".`
              );
            }
          }
        }
      });
      
      
      } catch (error) {
        console.error('ERROR registering settings:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error; // Re-throw to see the error in Joplin
      }

      // ===== SET DEFAULT MODEL IF BLANK =====
      // Check if model is blank or not user-set, and set to latest general model
      try {
        const currentModel = await joplin.settings.value('openaiModel');
        const modelUserSet = await joplin.settings.value('openaiModelUserSet');
        // pluginDataPath is already defined above
        
        // If model is blank/empty or not user-set, fetch and set the latest general model
        if ((!currentModel || currentModel.trim() === '') || !modelUserSet) {
          // Try to get available models (from storage or fetch if needed)
          let modelsToCheck: ModelInfo[] = [];
          
          // Check if models are already fetched
          try {
            console.debug(`[Default Model Check] Reading models from settings cache`);
            const storedModelsStr = await joplin.settings.value('modelCache');
            if (storedModelsStr) {
              modelsToCheck = JSON.parse(storedModelsStr);
              modelsToCheck.sort((a: ModelInfo, b: ModelInfo) => b.created - a.created);
            }
          } catch (e) {
            // Models not in storage yet, will be fetched later
          }
          
          // If we have models, find the latest general one
          if (modelsToCheck.length > 0) {
            const isGeneralModel = (id: string): boolean => {
              const gptPattern = /^gpt-\d+(\.\d+)?[a-z]?$/;
              const oPattern = /^o\d+$/;
              if (id.includes('-') && !id.match(/^gpt-\d+(\.\d+)?[a-z]?$/)) {
                return false;
              }
              return gptPattern.test(id) || oPattern.test(id);
            };
            
            const latestGeneralModel = modelsToCheck.find(model => isGeneralModel(model.id));
            if (latestGeneralModel) {
              await joplin.settings.setValue('openaiModel', latestGeneralModel.id);
              await joplin.settings.setValue('openaiModelUserSet', false);
              console.info('Set default model in settings to:', latestGeneralModel.id);
            }
          } else {
            // Fallback to hardcoded default
            await joplin.settings.setValue('openaiModel', 'gpt-5.1');
            await joplin.settings.setValue('openaiModelUserSet', false);
          }
        }
      } catch (error: any) {
        console.warn('Error setting default model in settings:', error.message);
      }

      // Create global ChatGPT API instance
      const chatGPTAPI = new ChatGPTAPI();

      // ===== COMMANDS SETUP =====
      console.info('Setting up AI Writing Toolkit commands...');

      // 6. Open ChatGPT Panel
      await joplin.commands.register({
        name: 'openChatGPTPanel',
        label: 'Open AI Writing Toolkit Panel',
        iconName: 'fas fa-robot',
        execute: async () => {
          try {
            await joplin.views.panels.show(actualPanelId);
            console.info('AI Writing Toolkit panel opened via command');
          } catch (error: any) {
            console.error('Error opening chat panel:', error);
          }
        },
      });

      // 7. Toggle ChatGPT Toolbox
      await joplin.commands.register({
        name: 'toggleChatGPTToolbox',
        label: 'Toggle AI Writing Toolkit',
        execute: async () => {
          try {
            console.info('Toggle command executed, checking panel visibility...');
            const isVisible = await joplin.views.panels.visible(actualPanelId);
            console.info('Panel visibility check result:', isVisible, 'for panel:', actualPanelId);
            
            if (isVisible) {
              console.info('Panel is visible, hiding it...');
              await joplin.views.panels.hide(actualPanelId);
              console.info('AI Writing Toolkit hidden successfully');
            } else {
              console.info('Panel is not visible, showing it...');
              await joplin.views.panels.show(actualPanelId);
              console.info('AI Writing Toolkit shown successfully');
            }
          } catch (error: any) {
            console.error('Error toggling AI Writing Toolkit:', error);
            await joplin.views.dialogs.showMessageBox('Error toggling AI Writing Toolkit: ' + error.message);
          }
        },
      });

      // 8. Open System Prompt File
      await joplin.commands.register({
        name: 'openSystemPromptFile',
        label: 'Open System Prompt File',
        iconName: 'fas fa-file-alt',
        execute: async () => {
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
      });

      // Helper function to get current note
      async function getCurrentNote(): Promise<Note> {
        const noteIds = await joplin.workspace.selectedNoteIds();
        if (noteIds.length === 0) {
          throw new Error('No note selected. Please select a note first.');
        }
        return await joplin.data.get(['notes', noteIds[0]], { fields: ['id', 'title', 'body'] });
      }

      // Helper function to get current folder ID
      async function getCurrentFolderId(): Promise<string | null> {
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
      async function updateNoteContent(noteId: string, newContent: string, autoSave: boolean = true): Promise<void> {
        await joplin.data.put(['notes', noteId], null, { body: newContent });
        if (autoSave) {
          // Note: Joplin auto-saves changes, no manual save command needed
          console.info('Note content updated successfully');
        }
      }

      // Helper function to get selected text from editor
      async function getSelectedText(): Promise<string> {
        try {
          return await joplin.commands.execute('selectedText');
        } catch (error) {
          console.error('Error getting selected text:', error);
          return '';
        }
      }

      // Helper function to replace selected text in editor
      async function replaceSelectedText(newText: string): Promise<void> {
        try {
          await joplin.commands.execute('replaceSelection', newText);
        } catch (error) {
          console.error('Error replacing selected text:', error);
        }
      }

      // Helper function to copy text to clipboard
      async function copyToClipboard(text: string): Promise<void> {
        try {
          await joplin.clipboard.writeText(text);
        } catch (error) {
          console.error('Error copying to clipboard:', error);
        }
      }

      // Helper function to get last ChatGPT response from chat
      let lastChatGPTResponse: string = '';



      // 3. Check Grammar with ChatGPT
      await joplin.commands.register({
        name: 'checkGrammarWithChatGPT',
        label: 'Check Grammar with ChatGPT',
        execute: async () => {
          try {
            const selectedText = await getSelectedText();
            if (!selectedText || selectedText.trim() === '') {
              await joplin.views.dialogs.showMessageBox('Please select some text to check grammar.');
              return;
            }
            
            const correctedText = await chatGPTAPI.checkGrammar(selectedText);
            await replaceSelectedText(correctedText);
            await joplin.views.dialogs.showMessageBox('Grammar check completed and text updated!');
          } catch (error: any) {
            await joplin.views.dialogs.showMessageBox(`Error: ${error.message}`);
          }
        },
      });

      // 4. Copy ChatGPT Response to Clipboard
      await joplin.commands.register({
        name: 'copyChatGPTResponseToClipboard',
        label: 'Copy ChatGPT Response to Clipboard',
        execute: async () => {
          try {
            if (!lastChatGPTResponse) {
              await joplin.views.dialogs.showMessageBox('No ChatGPT response available. Send a message first.');
              return;
            }
            await copyToClipboard(lastChatGPTResponse);
            await joplin.views.dialogs.showMessageBox('ChatGPT response copied to clipboard!');
          } catch (error: any) {
            await joplin.views.dialogs.showMessageBox(`Error: ${error.message}`);
          }
        },
      });

      // 5. Use Note as ChatGPT Prompt
      await joplin.commands.register({
        name: 'useNoteAsChatGPTPrompt',
        label: 'Use Note as ChatGPT Prompt',
        execute: async () => {
          try {
            const note = await getCurrentNote();
            const response = await chatGPTAPI.sendMessage(note.body);
            lastChatGPTResponse = response;
            await joplin.views.dialogs.showMessageBox(`ChatGPT Response:\n\n${response}`);
          } catch (error: any) {
            await joplin.views.dialogs.showMessageBox(`Error: ${error.message}`);
          }
        },
      });

      // ===== FETCH AVAILABLE MODELS (ONCE) =====
      let availableModels: ModelInfo[] = [];
      const modelsFetchedKey = sanitizeDataKey('models_fetched');
      const modelsListKey = sanitizeDataKey('models_list');
      // pluginDataPath is defined at top of onStart
      
      try {
        // Check if we've already fetched models
        let modelsFetched = false;
        try {
          console.debug(`[Fetch Models] Checking if models fetched: plugins/${pluginDataPath}/data/${modelsFetchedKey}`);
          const fetched = await joplin.data.get(['plugins', pluginDataPath, 'data', modelsFetchedKey]);
          modelsFetched = fetched && fetched.value === 'true';
        } catch (e) {
          // Key doesn't exist yet, that's fine
        }
        
        if (!modelsFetched) {
          // First time - fetch models from API
          console.info('Fetching available models from OpenAI API (first time only)...');
          const apiKey = await joplin.settings.value('openaiApiKey');
          if (apiKey && apiKey.trim() !== '') {
            availableModels = await fetchAvailableModels(apiKey);
            if (availableModels.length > 0) {
              // Store the models list (already sorted by creation date, newest first)
              console.debug(`[Fetch Models] Saving models list to: plugins/${pluginDataPath}/data/${modelsListKey}`);
              await joplin.data.put(['plugins', pluginDataPath, 'data', modelsListKey], null, { value: JSON.stringify(availableModels) });
              // Mark as fetched
              await joplin.data.put(['plugins', pluginDataPath, 'data', modelsFetchedKey], null, { value: 'true' });
              console.info('Models fetched and stored successfully:', availableModels.length, 'models');
              
              // Set the latest general model (not variants) as default if no model is set
              const currentModel = await joplin.settings.value('openaiModel');
              if (!currentModel || currentModel === 'gpt-5.1') {
                // Find the newest general model (not variants - anything after the number)
                const isGeneralModel = (id: string): boolean => {
                  // General models match patterns like: gpt-4, gpt-4.1, gpt-4o, gpt-5, gpt-5.1, o1, o3
                  // Exclude anything with a hyphen after the number/version
                  const gptPattern = /^gpt-\d+(\.\d+)?[a-z]?$/;
                  const oPattern = /^o\d+$/;
                  // Explicit check: if it has a hyphen after the version pattern, it's a variant
                  if (id.includes('-') && !id.match(/^gpt-\d+(\.\d+)?[a-z]?$/)) {
                    return false;
                  }
                  return gptPattern.test(id) || oPattern.test(id);
                };
                const latestGeneralModel = availableModels.find(model => isGeneralModel(model.id));
                const latestModel = latestGeneralModel ? latestGeneralModel.id : availableModels[0].id;
                await joplin.settings.setValue('openaiModel', latestModel);
                console.info('Set latest general model as default:', latestModel);
              }
            } else {
              console.warn('No models returned from API, will use default list');
            }
          } else {
            console.info('No API key set yet, will use default model list');
          }
        } else {
          // Already fetched - load from storage
          try {
            const storedModels = await joplin.data.get(['plugins', pluginDataPath, 'data', modelsListKey]);
            if (storedModels && storedModels.value) {
              availableModels = JSON.parse(storedModels.value);
              
              // Filter to only include gpt-4o and newer models
              availableModels = availableModels.filter((model: ModelInfo) => {
                const id = model.id;
                return id.startsWith('gpt-4o') || id.startsWith('gpt-4.1') || id.startsWith('gpt-5') ||
                       id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4');
              });
              
              // Ensure they're still sorted (newest first)
              availableModels.sort((a: ModelInfo, b: ModelInfo) => b.created - a.created);
              console.info('Loaded', availableModels.length, 'models from storage (gpt-4o and newer)');
            }
          } catch (error: any) {
            console.warn('Error loading stored models:', error.message);
          }
        }
      } catch (error: any) {
        // If data storage fails, just use default models
        if (error.message !== 'Not Found') {
            console.warn('Error accessing plugin data storage:', error.message);
        }
      }

      // Default model list (fallback if API fetch fails or no API key)
      // Only include gpt-4o and newer models, sorted newest to oldest
      // Using Unix timestamps (seconds since epoch) for consistency with API
      const now = Math.floor(Date.now() / 1000);
      
      const defaultModels: ModelInfo[] = [
        { id: 'gpt-5.1', created: now },
        { id: 'gpt-5', created: now - 86400 }, // 1 day ago
        { id: 'gpt-5-mini', created: now - 172800 }, // 2 days ago
        { id: 'gpt-5-nano', created: now - 259200 }, // 3 days ago
        { id: 'gpt-4.1', created: now - 345600 }, // 4 days ago
        { id: 'gpt-4.1-mini', created: now - 432000 }, // 5 days ago
        { id: 'gpt-4.1-nano', created: now - 518400 }, // 6 days ago
        { id: 'gpt-4o', created: now - 604800 }, // 7 days ago
        { id: 'gpt-4o-mini', created: now - 691200 }, // 8 days ago
        { id: 'o1', created: now - 1036800 }, // 12 days ago
        { id: 'o1-preview', created: now - 1123200 }, // 13 days ago
        { id: 'o3', created: now - 1209600 }, // 14 days ago
        { id: 'o3-mini', created: now - 1296000 }, // 15 days ago
        { id: 'o4-mini', created: now - 1382400 } // 16 days ago
      ];
      
      // Use fetched models if available, otherwise use default
      const modelsToUse = availableModels.length > 0 ? availableModels : defaultModels;
      
      // Find the newest general model (not variants - anything after the number)
      const isGeneralModel = (id: string): boolean => {
        // General models match patterns like: gpt-4, gpt-4.1, gpt-4o, gpt-5, gpt-5.1, o1, o3
        // Exclude anything with a hyphen after the number/version (e.g., gpt-4-mini, gpt-4-codex, gpt-5.1-codex, o1-preview)
        
        // For GPT models: must end exactly after version number (optionally with single letter like 'o')
        // Pattern: gpt- followed by number, optionally .number, optionally a single letter, then end
        // Must NOT have any additional hyphens or text
        const gptPattern = /^gpt-\d+(\.\d+)?[a-z]?$/;
        
        // For o-models: o1, o3 are general (no hyphen after number)
        const oPattern = /^o\d+$/;
        
        // Explicit check: if it has a hyphen after the version pattern, it's a variant
        if (id.includes('-') && !id.match(/^gpt-\d+(\.\d+)?[a-z]?$/)) {
          return false;
        }
        
        return gptPattern.test(id) || oPattern.test(id);
      };
      
      const latestGeneralModel = modelsToUse.find(model => isGeneralModel(model.id));
      const latestModel = latestGeneralModel ? latestGeneralModel.id : modelsToUse[0].id;
      
      // Generate model options HTML
      const savedModel = await joplin.settings.value('openaiModel');
      const selectedModel = savedModel || latestModel;
      
      // Update setting if it's not set or is the old default
      if (!savedModel || savedModel === 'gpt-5.1') {
        await joplin.settings.setValue('openaiModel', latestModel);
      }
      
      const modelOptions = modelsToUse.map((model, index) => {
        const isSelected = model.id === selectedModel ? ' selected' : '';
        const isLatest = index === 0;
        const displayName = isLatest ? `${model.id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} (Latest)` : 
                           model.id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        return `<option value="${model.id}"${isSelected}>${displayName}</option>`;
      }).join('\n              ');

      // ===== CHAT PANEL SETUP =====
      console.info('Setting up ChatGPT chat panel...');

      // Create the chat panel first
      const panelId = 'chatgpt.toolbox.panel';
      const panel = await joplin.views.panels.create(panelId);
      console.info('Panel created with ID:', panel, 'panelId:', panelId);
      
      // Use the actual panel ID that Joplin created
      const actualPanelId = panel;

      // Set the panel HTML
      await joplin.views.panels.setHtml(panel, `
        <div class="chat-container">
          <div class="chat-header">
            <h3>AI Writing Tools</h3>
            <button class="close-button" id="closePanelButton" title="Close Panel">✕</button>
          </div>
          
          <div class="model-selector-container">
            <label for="modelSelector" class="model-label">Model:</label>
            <select id="modelSelector" class="model-selector">
              ${modelOptions}
            </select>
          </div>
          
          <div class="quick-actions">
            <button class="action-button" data-action="appendToNote" title="Append Reply to Note">📝 Append</button>
            <button class="action-button" data-action="replaceNote" title="Replace Note with Reply">🔄 Replace</button>
            <button class="action-button" data-action="insertAtCursor" title="Insert Reply at Cursor">📍 Insert</button>
            <button class="action-button" data-action="createNewNote" title="New Note from Reply">📄 New Note</button>
            <button class="action-button" data-action="copyNoteToPrompt" title="Copy Note to Prompt">📋 Note→Prompt</button>
            <button class="action-button" data-action="copySelectedToPrompt" title="Copy Selected to Prompt">✂️ Selected→Prompt</button>
            <button class="action-button" data-action="checkGrammar" title="Check Selected Grammar">✅ Grammar</button>
            <button class="action-button" data-action="showAbout" title="Help">ℹ️ Help</button>
          </div>
          
          <div class="chat-messages" id="chatMessages">
            <div class="message assistant">
              <div class="message-content">
                <strong>🤖 AI Writing Tools v1.0.0</strong><br><br>
                Click <strong>HELP</strong> to learn about AI Writing Tools v1.0.0 features.
              </div>
            </div>
          </div>
          
          <div class="loading" id="loading">
            ChatGPT is thinking...
          </div>
          
          <div class="chat-input-container">
            <textarea 
              class="chat-input" 
              id="chatInput" 
              placeholder="Enter your prompt here... (Enter to send, Shift+Enter for new line)"
              rows="5"
            ></textarea>
          </div>
          <div class="send-button-container">
            <button class="clear-history-button" id="clearHistoryButton">Clear History</button>
            <button class="send-button" id="sendButton">Send</button>
          </div>
        </div>

        <!-- Grammar Check Modal -->
        <div id="grammar-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; max-width: 80%; max-height: 80%; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #2c2c2c;">Grammar Check Results</h3>
            <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #28a745;">
              <strong>Corrected Text:</strong>
              <div id="corrected-text" style="margin-top: 10px; white-space: pre-wrap; color: #2c2c2c;"></div>
            </div>
            <div style="margin-top: 20px; text-align: right;">
              <button id="reject-grammar" style="margin-right: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Reject</button>
              <button id="accept-grammar" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Accept & Apply</button>
            </div>
          </div>
        </div>

        <style>
          .chat-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            width: 100%;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #fafafa;
            color: #2c2c2c;
          }

          .chat-header {
            background: #f8f8f8;
            padding: 16px 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .chat-header h3 {
            margin: 0;
            color: #2c2c2c;
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.01em;
          }

          .close-button {
            background: transparent;
            color: #666666;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s ease;
          }

          .close-button:hover {
            background: rgba(0, 0, 0, 0.1);
            color: #333333;
          }

          .close-button:active {
            background: rgba(0, 0, 0, 0.2);
          }

          .model-selector-container {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #f8f8f8;
            border-bottom: 1px solid #e0e0e0;
          }

          .model-label {
            font-size: 12px;
            font-weight: 500;
            color: #2c2c2c;
            white-space: nowrap;
          }

          .model-selector {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #4a4a4a;
            border-radius: 4px;
            background: #ffffff;
            color: #2c2c2c;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .model-selector:hover {
            border-color: #3a3a3a;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .model-selector:focus {
            outline: none;
            border-color: #4a4a4a;
            box-shadow: 0 0 0 2px rgba(74, 74, 74, 0.2);
          }

          .quick-actions {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            padding: 8px;
            background: #f5f5f5;
            border-bottom: 1px solid #e8e8e8;
          }

          .action-button {
            padding: 6px 8px;
            border: 1px solid #4a4a4a;
            border-radius: 4px;
            background: #ffffff;
            color: #2c2c2c;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .action-button:hover {
            background: #4a4a4a;
            color: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .action-button:active {
            background: #3a3a3a;
            color: #ffffff;
            transform: translateY(1px);
          }

          .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            max-height: 400px;
            min-height: 200px;
            background: #fdfdfd;
          }

          .message {
            margin-bottom: 16px;
            display: flex;
            flex-direction: column;
          }

          .message.user {
            align-items: flex-end;
          }

          .message.assistant {
            align-items: flex-start;
          }

          .message-content {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }

          .message.user .message-content {
            background: #4a4a4a;
            color: #ffffff;
          }

          .message.assistant .message-content {
            background: #ffffff;
            color: #2c2c2c;
            border: 1px solid #e8e8e8;
          }

          /* Markdown styling for assistant messages */
          .message.assistant .message-content h1,
          .message.assistant .message-content h2,
          .message.assistant .message-content h3 {
            margin: 8px 0 4px 0;
            font-weight: 600;
            color: #2c2c2c;
          }

          .message.assistant .message-content h1 {
            font-size: 18px;
            border-bottom: 1px solid #e8e8e8;
            padding-bottom: 4px;
          }

          .message.assistant .message-content h2 {
            font-size: 16px;
          }

          .message.assistant .message-content h3 {
            font-size: 14px;
          }

          .message.assistant .message-content strong {
            font-weight: 600;
            color: #1a1a1a;
          }

          .message.assistant .message-content em {
            font-style: italic;
            color: #4a4a4a;
          }

          .message.assistant .message-content code {
            background: #f5f5f5;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            color: #d63384;
          }

          .message.assistant .message-content pre {
            background: #f8f8f8;
            border: 1px solid #e8e8e8;
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
            overflow-x: auto;
          }

          .message.assistant .message-content pre code {
            background: none;
            padding: 0;
            color: #2c2c2c;
            font-size: 13px;
          }

          .message.assistant .message-content a {
            color: #4a4a4a;
            text-decoration: underline;
          }

          .message.assistant .message-content a:hover {
            color: #2c2c2c;
          }

          .message-header {
            display: flex;
            justify-content: flex-end;
            padding: 8px 12px 4px 12px;
            border-bottom: 1px solid #e0e0e0;
          }

          .copy-button {
            padding: 4px 8px;
            background: #ffffff;
            color: #666666;
            border: 1px solid #cccccc;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }

          .copy-button:hover {
            background: #f8f8f8;
            border-color: #999999;
            color: #333333;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          }

          .copy-button:active {
            background: #eeeeee;
            border-color: #888888;
            transform: translateY(1px);
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }

          .loading {
            display: none;
            padding: 16px 20px;
            text-align: center;
            color: #666666;
            font-style: italic;
            background: #f8f8f8;
            border-top: 1px solid #e8e8e8;
          }

          .loading.show {
            display: block;
          }

          .chat-input-container {
            padding: 16px 20px 12px 20px;
            background: #f5f5f5;
            border-top: 1px solid #e8e8e8;
            box-sizing: border-box;
            overflow: hidden;
          }

          .chat-input {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            padding: 14px 16px;
            border: 1px solid #4a4a4a;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            resize: vertical;
            min-height: 80px;
            max-height: 200px;
            background: #ffffff;
            color: #2c2c2c;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }

          .chat-input:focus {
            outline: none;
            border-color: #4a4a4a;
            box-shadow: 0 0 0 3px rgba(74, 74, 74, 0.1);
          }

          .send-button-container {
            padding: 0 20px 16px 20px;
            background: #f5f5f5;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }

          .clear-history-button {
            padding: 8px 16px;
            background: #ffffff;
            color: #666666;
            border: 1px solid #cccccc;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }

          .clear-history-button:hover {
            background: #f8f8f8;
            border-color: #999999;
            color: #333333;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            transform: translateY(-1px);
          }

          .clear-history-button:active {
            background: #eeeeee;
            border-color: #888888;
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }

          .send-button {
            padding: 12px 28px;
            background: #4a4a4a;
            color: #ffffff;
            border: 1px solid #4a4a4a;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .send-button:hover {
            background: #3a3a3a;
            border-color: #3a3a3a;
            box-shadow: 0 3px 6px rgba(0,0,0,0.15);
            transform: translateY(-1px);
          }

          .send-button:active {
            background: #2a2a2a;
            border-color: #2a2a2a;
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }

          .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #cccccc;
            border-color: #cccccc;
            color: #666666;
            transform: none;
            box-shadow: none;
          }

          /* Scrollbar styling */
          .chat-messages::-webkit-scrollbar {
            width: 8px;
          }

          .chat-messages::-webkit-scrollbar-track {
            background: #f5f5f5;
            border-radius: 4px;
          }

          .chat-messages::-webkit-scrollbar-thumb {
            background: #4a4a4a;
            border-radius: 4px;
          }

          .chat-messages::-webkit-scrollbar-thumb:hover {
            background: #3a3a3a;
          }
        </style>
      `);

      // Load external webview script (avoid inline scripts due to CSP)
      await joplin.views.panels.addScript(panel, 'webview.js');

      // Show the panel
      await joplin.views.panels.show(panel);
      
      // Send current model to webview to populate the selector
      const currentModel = await joplin.settings.value('openaiModel') || 'gpt-5.1';
      await joplin.views.panels.postMessage(panel, {
        type: 'setCurrentModel',
        model: currentModel
      });
      
      // Handle action function
      async function handleAction(action: string): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
          switch (action) {
            case 'appendToNote':
              if (!lastChatGPTResponse) {
                return { success: false, error: 'No ChatGPT response to append. Send a message first.' };
              }
              const note = await getCurrentNote();
              await updateNoteContent(note.id, note.body + '\n\n---\n\n**ChatGPT Response:**\n' + lastChatGPTResponse);
              return { success: true, message: 'ChatGPT response appended to note successfully!' };
              
            case 'replaceNote':
              if (!lastChatGPTResponse) {
                return { success: false, error: 'No ChatGPT response to replace with. Send a message first.' };
              }
              const noteToReplace = await getCurrentNote();
              await updateNoteContent(noteToReplace.id, lastChatGPTResponse);
              return { success: true, message: 'Note replaced with ChatGPT response successfully!' };
              
            case 'insertAtCursor':
              if (!lastChatGPTResponse) {
                return { success: false, error: 'No ChatGPT response to insert. Send a message first.' };
              }
              // Check if a note is selected
              try {
                const noteIds = await joplin.workspace.selectedNoteIds();
                if (noteIds.length === 0) {
                  return { success: false, error: 'No note selected. Please select a note first.' };
                }
                // Insert the response at the cursor position (replaceSelection works at cursor if no selection)
                await replaceSelectedText(lastChatGPTResponse);
                return { success: true, message: 'ChatGPT response inserted at cursor position successfully!' };
              } catch (error: any) {
                return { success: false, error: `Error inserting at cursor: ${error.message}` };
              }
              
            case 'createNewNote':
              if (!lastChatGPTResponse) {
                return { success: false, error: 'No ChatGPT response to create note with. Send a message first.' };
              }
              // Create a new note with the ChatGPT response
              const newNote = await joplin.data.post(['notes'], null, {
                title: 'ChatGPT Response - ' + new Date().toLocaleString(),
                body: lastChatGPTResponse,
                parent_id: await getCurrentFolderId()
              });
              
              // Make the new note active
              await joplin.commands.execute('openNote', newNote.id);
              
              return { success: true, message: 'New note created and opened successfully!' };
              
            case 'copyNoteToPrompt':
              const currentNote = await getCurrentNote();
              // Send the content directly to the webview
              try {
                console.log('About to send message to webview, panel:', panel);
                const result = await joplin.views.panels.postMessage(panel, {
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
                console.log('About to send selected text to webview, panel:', panel);
                const result = await joplin.views.panels.postMessage(panel, {
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
              await joplin.views.panels.postMessage(panel, {
                type: 'addMessage',
                sender: 'system',
                content: 'Checking grammar...'
              });
              
              // Use ChatGPT to check grammar
              const grammarResponse = await chatGPTAPI.checkGrammar(textToCheck);
              
              // Show modal with corrected text for user approval
              await joplin.views.panels.postMessage(panel, {
                type: 'showGrammarModal',
                originalText: textToCheck,
                correctedText: grammarResponse
              });
              
              return { success: true, message: 'Grammar check completed! Please review the changes.' };
              
            case 'showAbout':
              // Send comprehensive help information to the chat
              await joplin.views.panels.postMessage(panel, {
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
      
      // Handle messages from the webview
      await joplin.views.panels.onMessage(panel, async (message: WebviewMessage) => {
        try {
          if (message.type === 'sendChatMessage') {
            const response = await chatGPTAPI.sendMessage(message.message || '');
            lastChatGPTResponse = response; // Store for later use
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
            await chatGPTAPI.loadSettings();
            return { success: true, message: modelToSet ? `Model updated to ${modelToSet}` : 'Model set to auto-select latest' };
          } else if (message.type === 'clearHistory') {
            chatGPTAPI.clearConversationHistory();
            return { success: true, message: 'Conversation history cleared' };
          } else if (message.type === 'closePanel') {
            // Send a nicely formatted close message to the panel before closing
            await joplin.views.panels.postMessage(actualPanelId, {
              type: 'showCloseMessage'
            });
            return { success: true, message: 'Close message sent' };
          } else if (message.type === 'confirmClose') {
            // Actually close the panel after user confirms
            await joplin.views.panels.hide(actualPanelId);
            return { success: true, message: 'Panel closed' };
          } else if (message.type === 'acceptGrammarChanges') {
            // Replace the selected text with the corrected version
            if (message.correctedText) {
              await replaceSelectedText(message.correctedText);
              
              // Send confirmation message to the panel
              await joplin.views.panels.postMessage(panel, {
                type: 'addMessage',
                sender: 'system',
                content: 'Grammar corrections applied successfully!'
              });
              
              return { success: true, message: 'Grammar changes applied' };
            } else {
              return { success: false, error: 'No corrected text provided' };
            }
          } else if (message.type === 'executeAction') {
            return await handleAction(message.action || '');
          }
          return { success: false, error: 'Unknown message type' };
        } catch (error: any) {
          console.error('Error handling webview message:', error);
          return { success: false, error: error.message };
        }
      });
      
      console.info('ChatGPT chat panel created successfully!');

      // ===== ADDITIONAL COMMANDS SETUP =====
      // Commands were moved to before menu item creation
      console.info('ChatGPT commands initialized.');

      // ===== UI ACCESS SETUP =====
      // Try to add menu items to Tools menu
      try {
        // Main AI Writing Toolkit menu item
        await joplin.views.menuItems.create('com.cogitations.ai-writing-toolkit.menu.open', 'openChatGPTPanel', MenuItemLocation.Tools);
        
        // Open System Prompt File menu item
        await joplin.views.menuItems.create('com.cogitations.ai-writing-toolkit.menu.prompt', 'openSystemPromptFile', MenuItemLocation.Tools);
        
        console.info('AI Writing Toolkit menu items added to Tools menu');
      } catch (error: any) {
        console.warn('Could not add menu items (may not be supported in this Joplin version):', error.message);
      }
      
      console.info('AI Writing Toolkit Access Methods:');
      console.info('1. Tools menu -> AI Writing Toolkit (if available)');
      console.info('2. Command Palette: Ctrl+Shift+P (or Cmd+Shift+P) -> "Open AI Writing Toolkit Panel"');
      console.info('3. Command Palette: Ctrl+Shift+P (or Cmd+Shift+P) -> "Toggle AI Writing Toolkit"');
      
      console.info('AI Writing Toolkit Plugin initialized successfully!');
      console.info('Available commands:');
      console.info('- Copy ChatGPT Response to Clipboard');
      console.info('- Use Note as ChatGPT Prompt');
      console.info('- AI Writing Toolkit Panel (side window)');
      
    } catch (error: any) {
      console.error('Error initializing AI Writing Toolkit Plugin:', error);
    }
  },
});
