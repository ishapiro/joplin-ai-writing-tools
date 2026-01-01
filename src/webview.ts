// AI Writing Toolkit webview script - Real ChatGPT integration
declare const webviewApi: any;

// Hack to fix "exports is not defined" error if webpack adds commonjs exports
(window as any).exports = {};

(() => {
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement;
  const sendButton = document.getElementById('sendButton') as HTMLButtonElement;
  const loading = document.getElementById('loading');

  // Simple markdown parser for basic formatting
  function parseMarkdown(text: string) {
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }

  if (!chatMessages || !chatInput || !sendButton || !loading) {
    console.error('AI Writing Toolkit webview: required elements missing');
    return;
  }

  // Bind action buttons
  document.querySelectorAll('.action-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action') || '';
      if (action) {
        executeAction(action);
      }
    });
  });

  // Model selector
  const modelSelector = document.getElementById('modelSelector') as HTMLSelectElement;
  if (modelSelector) {
    // Load current model from settings
    webviewApi.postMessage({
      type: 'getCurrentModel'
    }).then((response: any) => {
      if (response && response.model) {
        modelSelector.value = response.model;
      }
    }).catch((error: any) => {
      console.error('Error loading current model:', error);
    });

    // Handle model selection changes
    modelSelector.addEventListener('change', async (event: any) => {
      const selectedModel = event.target.value;
      try {
        const response = await webviewApi.postMessage({
          type: 'updateModel',
          model: selectedModel
        });
        if (response && response.success) {
          console.log('Model updated to:', selectedModel);
        } else {
          console.error('Failed to update model:', response?.error);
        }
      } catch (error) {
        console.error('Error updating model:', error);
      }
    });
  }

  // Auto-resize textarea
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
  });

  // Enter to send (Shift+Enter for newline, Cmd/Ctrl+Enter to send)
  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        sendMessage();
      }
      // Regular Enter to send (unless Shift is held for newline)
      else if (!e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      // Shift+Enter allows newline (default behavior)
    }
  });

  // Click to send
  sendButton.addEventListener('click', () => sendMessage());

  // Clear history button
  const clearHistoryButton = document.getElementById('clearHistoryButton');
  if (clearHistoryButton) {
    clearHistoryButton.addEventListener('click', async () => {
      try {
        // Clear the conversation history on the backend
        await webviewApi.postMessage({
          type: 'clearHistory'
        });
        
        // Clear the chat window visually
        clearChatWindow();
        
        console.log('History cleared successfully');
      } catch (error: any) {
        console.error('Error clearing history:', error);
        addError('Error clearing history: ' + error.message);
      }
    });
  }

  // Close panel button
  const closePanelButton = document.getElementById('closePanelButton');
  if (closePanelButton) {
    closePanelButton.addEventListener('click', async () => {
      try {
        // Send close message to the plugin
        await webviewApi.postMessage({
          type: 'closePanel'
        });
        
        console.log('Close panel requested');
      } catch (error) {
        console.error('Error closing panel:', error);
      }
    });
  }

  function addMessage(sender: string, content: string) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender;
    
    // Create message header with copy button for assistant messages
    if (sender === 'assistant') {
      const messageHeader = document.createElement('div');
      messageHeader.className = 'message-header';
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.innerHTML = '📋 Copy';
      copyButton.title = 'Copy response to clipboard';
      
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(content);
          copyButton.innerHTML = '✅ Copied!';
          copyButton.style.background = '#4CAF50';
          setTimeout(() => {
            copyButton.innerHTML = '📋 Copy';
            copyButton.style.background = '';
          }, 2000);
        } catch (error) {
          console.error('Failed to copy:', error);
          copyButton.innerHTML = '❌ Failed';
          copyButton.style.background = '#f44336';
          setTimeout(() => {
            copyButton.innerHTML = '📋 Copy';
            copyButton.style.background = '';
          }, 2000);
        }
      });
      
      messageHeader.appendChild(copyButton);
      messageDiv.appendChild(messageHeader);
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Render markdown for assistant messages, plain text for user messages
    if (sender === 'assistant') {
      contentDiv.innerHTML = parseMarkdown(content);
    } else {
      contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages!.appendChild(messageDiv);
    chatMessages!.scrollTop = chatMessages!.scrollHeight;
  }

  function addError(message: string) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    chatMessages!.appendChild(errorDiv);
    chatMessages!.scrollTop = chatMessages!.scrollHeight;
  }

  function showLoading(show: boolean) {
    if (loading) {
      loading.style.display = show ? 'block' : 'none';
      if (show && chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function clearChatWindow() {
    // Clear all messages from the chat window
    if (chatMessages) {
      chatMessages.innerHTML = '';
      
      // Add a welcome message to indicate the chat is cleared
      addMessage('system', 'Chat history cleared. Start a new conversation!');
    }
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage('user', message);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    showLoading(true);
    sendButton.disabled = true;

    try {
      // Send message to ChatGPT via plugin using webviewApi
      const response = await webviewApi.postMessage({
        type: 'sendChatMessage',
        message: message
      });

      if (response && response.success) {
        addMessage('assistant', response.content);
      } else {
        addError('Error: ' + (response?.error || 'Failed to get response from ChatGPT'));
      }
    } catch (error: any) {
      addError('Error: ' + (error && error.message ? error.message : String(error)));
    } finally {
      showLoading(false);
      sendButton.disabled = false;
      chatInput.focus();
    }
  }

  async function executeAction(action: string) {
    try {
      const response = await webviewApi.postMessage({
        type: 'executeAction',
        action: action
      });

      if (response && response.success) {
        if (response.message) {
          addMessage('system', response.message);
        }
      } else {
        addError('Error: ' + (response?.error || 'Action failed'));
      }
    } catch (error: any) {
      addError('Error: ' + (error && error.message ? error.message : String(error)));
    }
  }


  // Handle messages from the plugin
  webviewApi.onMessage((message: any) => {
    console.info('Webview received message:', message);
    
    // Handle the case where message is wrapped in a 'message' property
    const actualMessage = message.message || message;
    
    if (actualMessage && actualMessage.type) {
      switch (actualMessage.type) {
        case 'setPrompt':
          console.info('Setting prompt to:', actualMessage.content);
          chatInput.value = actualMessage.content;
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
          chatInput.focus();
          break;
        case 'appendToPrompt':
          console.info('Appending to prompt:', actualMessage.content);
          // Append content to existing prompt with a line break
          const currentContent = chatInput.value.trim();
          const newContent = currentContent ? 
            currentContent + '\n\n' + actualMessage.content : 
            actualMessage.content;
          console.info('New prompt content:', newContent);
          chatInput.value = newContent;
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
          chatInput.focus();
          break;
        case 'addMessage':
          addMessage(actualMessage.sender, actualMessage.content);
          break;
        case 'setCurrentModel':
          // Set the model selector to the current model
          if (modelSelector && actualMessage.model) {
            modelSelector.value = actualMessage.model;
          }
          break;
        case 'showCloseMessage':
          showCloseMessage();
          break;
        case 'showGrammarModal':
          showGrammarModal(actualMessage.originalText, actualMessage.correctedText);
          break;
        default:
          console.info('Unknown message type:', actualMessage.type);
      }
    } else {
      console.info('Message received but no type:', actualMessage);
    }
  });

  // Function to show a nicely formatted close message
  function showCloseMessage() {
    if (!chatMessages) return;

    // Clear the chat messages and show a formatted close message
    chatMessages.innerHTML = '';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.style.cssText = `
      text-align: center;
      padding: 15px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 8px;
      margin: 10px;
      border: 1px solid #28a745;
    `;
    
    messageDiv.innerHTML = `
      <p style="color: #495057; font-size: 14px; margin-bottom: 15px;">To reopen this panel:</p>
      <div style="color: #495057; font-size: 13px; line-height: 1.4; margin-bottom: 15px;">
        <strong>1.</strong> Press Ctrl+Shift+P (or Cmd+Shift+P on Mac)<br>
        <strong>2.</strong> Type "Open AI Writing Toolkit Panel"<br>
        <strong>3.</strong> Press Enter
      </div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="confirmCloseButton" style="padding: 8px 16px; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; background: #28a745; color: white;">Close Panel</button>
        <button id="cancelCloseButton" style="padding: 8px 16px; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; background: #6c757d; color: white;">Keep Open</button>
      </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add event listeners for the buttons
    document.getElementById('confirmCloseButton')!.addEventListener('click', async () => {
      try {
        await webviewApi.postMessage({
          type: 'confirmClose'
        });
      } catch (error) {
        console.error('Error confirming close:', error);
      }
    });
    
    document.getElementById('cancelCloseButton')!.addEventListener('click', () => {
      // Just clear the close message and return to normal chat
      chatMessages.innerHTML = '';
      addMessage('system', 'Panel kept open. Continue your conversation!');
    });
    
    // Add hover effects
    const confirmBtn = document.getElementById('confirmCloseButton');
    const cancelBtn = document.getElementById('cancelCloseButton');
    
    if (confirmBtn) {
      confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.background = '#218838';
        confirmBtn.style.transform = 'translateY(-1px)';
      });
      confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.background = '#28a745';
        confirmBtn.style.transform = 'translateY(0)';
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = '#5a6268';
        cancelBtn.style.transform = 'translateY(-1px)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = '#6c757d';
        cancelBtn.style.transform = 'translateY(0)';
      });
    }
  }

  // Grammar modal functions
  function showGrammarModal(originalText: string, correctedText: string) {
    const modal = document.getElementById('grammar-modal');
    const correctedTextElement = document.getElementById('corrected-text');
    
    if (modal && correctedTextElement) {
      // Store the texts for later use (we still need original for replacement)
      modal.dataset.originalText = originalText;
      modal.dataset.correctedText = correctedText;
      
      // Display only the corrected text (user can see original in Joplin)
      correctedTextElement.textContent = correctedText;
      modal.style.display = 'block';
    }
  }

  function hideGrammarModal() {
    const modal = document.getElementById('grammar-modal');
    if (modal) modal.style.display = 'none';
  }

  // Grammar modal event listeners
  const acceptBtn = document.getElementById('accept-grammar');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', function() {
      const modal = document.getElementById('grammar-modal');
      if (modal) {
        const correctedText = modal.dataset.correctedText;
        
        // Send the corrected text back to the plugin
        webviewApi.postMessage({
          type: 'acceptGrammarChanges',
          correctedText: correctedText
        });
        
        hideGrammarModal();
      }
    });
  }

  const rejectBtn = document.getElementById('reject-grammar');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', function() {
      hideGrammarModal();
    });
  }

  // Make functions available globally for message handling
  (window as any).showGrammarModal = showGrammarModal;
  (window as any).hideGrammarModal = hideGrammarModal;

})();

