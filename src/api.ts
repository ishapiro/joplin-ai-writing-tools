import { ChatGPTAPISettings, ChatGPTResponse, ModelInfo } from './types';
import { sanitizeDataKey } from './utils';

declare const joplin: any;

// Function to fetch available models from OpenAI API
export async function fetchAvailableModels(apiKey: string): Promise<ModelInfo[]> {
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

// Helper to ensure models are fetched and get formatted options for panel
export async function ensureModelsFetchedAndGetOptions(settingsApiKey: string): Promise<string> {
  let availableModels: ModelInfo[] = [];
  const pluginDataPath = sanitizeDataKey('com.cogitations.ai-writing-toolkit');
  const modelsFetchedKey = sanitizeDataKey('models_fetched');
  const modelsListKey = sanitizeDataKey('models_list');
  
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
      const apiKey = settingsApiKey;
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

  return modelOptions;
}

// ChatGPT API class with proper typing
export class ChatGPTAPI {
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
