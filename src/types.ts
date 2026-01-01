// Global declaration for Joplin API
declare const joplin: any;

export { joplin };

// Setting types enum
export enum SettingItemType {
  Int = 1,
  String = 2,
  Bool = 3
}

// Toolbar button location enum
export enum ToolbarButtonLocation {
  NoteToolbar = 'noteToolbar',
  EditorToolbar = 'editorToolbar'
}

// MenuItemLocation values match current Joplin API (strings instead of numbers)
export enum MenuItemLocation {
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
export interface ChatGPTAPISettings {
  openaiApiKey: string;
  openaiModel: string;
  maxTokens: number;
  systemPrompt: string;
  autoSave: boolean;
  reasoningEffort: string;
  verbosity: string;
}

export interface WebviewMessage {
  type: string;
  content?: string;
  sender?: string;
  action?: string;
  message?: string;
  correctedText?: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  parent_id?: string;
}

export interface ChatGPTResponse {
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

// Interface for model data with metadata
export interface ModelInfo {
  id: string;
  created: number;
  owned_by?: string;
}

