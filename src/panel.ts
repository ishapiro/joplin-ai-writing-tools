// Function to generate the webview HTML
export function getPanelHtml(modelOptions: string): string {
  return `
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
        display: flex;
        flex-direction: column;
        gap: 20px;
        background: #ffffff;
      }

      .message {
        display: flex;
        flex-direction: column;
        max-width: 85%;
        margin-bottom: 8px;
        animation: fadeIn 0.3s ease;
      }

      .message.user {
        align-self: flex-end;
      }

      .message.assistant {
        align-self: flex-start;
        max-width: 95%;
      }

      .message.system {
        align-self: center;
        max-width: 90%;
        width: 90%;
      }

      .message-content {
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 1.6;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }

      .user .message-content {
        background: #4a4a4a;
        color: white;
        border-bottom-right-radius: 4px;
      }

      .assistant .message-content {
        background: #f0f0f0;
        color: #2c2c2c;
        border-bottom-left-radius: 4px;
        border: 1px solid #e0e0e0;
      }

      .message-header {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 4px;
      }

      .copy-button {
        background: transparent;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        color: #666;
        font-size: 11px;
        padding: 2px 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
      }

      .copy-button:hover {
        background: #f5f5f5;
        border-color: #999;
        color: #333;
      }

      /* Markdown Content Styling */
      .assistant .message-content h1,
      .assistant .message-content h2,
      .assistant .message-content h3 {
        margin-top: 16px;
        margin-bottom: 8px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .assistant .message-content h1 { font-size: 1.4em; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
      .assistant .message-content h2 { font-size: 1.2em; }
      .assistant .message-content h3 { font-size: 1.1em; }

      .assistant .message-content p {
        margin-bottom: 12px;
      }
      
      .assistant .message-content p:last-child {
        margin-bottom: 0;
      }

      .assistant .message-content ul,
      .assistant .message-content ol {
        margin: 8px 0 12px 20px;
        padding: 0;
      }

      .assistant .message-content li {
        margin-bottom: 6px;
      }

      .assistant .message-content code {
        background: #e6e6e6;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
        color: #d63384;
      }

      .assistant .message-content pre {
        background: #2d2d2d;
        color: #f8f8f2;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 12px 0;
      }

      .assistant .message-content pre code {
        background: transparent;
        color: inherit;
        padding: 0;
        font-size: 0.9em;
      }
      
      .assistant .message-content blockquote {
        border-left: 3px solid #ccc;
        margin: 10px 0;
        padding-left: 10px;
        color: #555;
        font-style: italic;
      }
      
      .assistant .message-content strong {
        font-weight: 600;
        color: #000;
      }

      .loading {
        display: none;
        padding: 15px;
        text-align: center;
        color: #666;
        font-style: italic;
        font-size: 13px;
        background: rgba(255,255,255,0.8);
        border-top: 1px solid #eee;
      }

      .chat-input-container {
        padding: 16px;
        background: #ffffff;
        border-top: 1px solid #e0e0e0;
      }

      .chat-input {
        width: 100%;
        padding: 12px;
        border: 1px solid #cccccc;
        border-radius: 8px;
        resize: none;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        outline: none;
        transition: border-color 0.2s ease;
        box-sizing: border-box;
        min-height: 80px;
      }

      .chat-input:focus {
        border-color: #4a4a4a;
        box-shadow: 0 0 0 2px rgba(74, 74, 74, 0.1);
      }

      .send-button-container {
        display: flex;
        justify-content: space-between;
        padding: 0 16px 16px;
        background: #ffffff;
      }

      .send-button {
        padding: 8px 24px;
        background: #2c2c2c;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
      }

      .send-button:hover {
        background: #000000;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .send-button:active {
        transform: translateY(0);
      }
      
      .send-button:disabled {
        background: #cccccc;
        cursor: not-allowed;
        transform: none;
      }

      .clear-history-button {
        padding: 8px 16px;
        background: transparent;
        color: #666;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .clear-history-button:hover {
        background: #f5f5f5;
        color: #333;
        border-color: #999;
      }
      
      .error {
        color: #d32f2f;
        padding: 10px;
        background: #ffebee;
        border-radius: 4px;
        margin: 5px 0;
        font-size: 13px;
        border-left: 3px solid #d32f2f;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Scrollbar styling */
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      ::-webkit-scrollbar-thumb {
        background: #d0d0d0;
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #b0b0b0;
      }
    </style>
  `;
}

