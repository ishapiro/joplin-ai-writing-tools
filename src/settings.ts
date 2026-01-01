import { SettingItemType, ModelInfo } from './types';
import { ChatGPTAPI } from './api';

declare const joplin: any;

export async function registerPluginSettings(): Promise<void> {
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
  
  // Debug: Log the options object
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

  } catch (error) {
    console.error('ERROR registering settings:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error; // Re-throw to see the error in Joplin
  }

  // Handle checkbox for opening system prompt file
  joplin.settings.onChange(async (event: any) => {
    if (event.keys.includes('openSystemPromptFile')) {
      const currentValue = await joplin.settings.value('openSystemPromptFile');
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

  // ===== SET DEFAULT MODEL IF BLANK =====
  try {
    const currentModel = await joplin.settings.value('openaiModel');
    const modelUserSet = await joplin.settings.value('openaiModelUserSet');
    
    if ((!currentModel || currentModel.trim() === '') || !modelUserSet) {
      // Try to get available models (from storage or fetch if needed)
      let modelsToCheck: ModelInfo[] = [];
      
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
}

