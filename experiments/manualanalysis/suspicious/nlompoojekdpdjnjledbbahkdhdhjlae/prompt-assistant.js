// Prompt Assistant Module - WordPress Backend Integration
class PromptAssistant {
  constructor() {
    this.apiBaseUrl = 'https://test.mick.co.ke/wp-admin/admin-ajax.php'; // REPLACE WITH YOUR DOMAIN
    this.userToken = null;
    this.userEmail = null;
    this.userCredits = 0;
    this.currentTextArea = null;
    this.suggestionPanel = null;
    this.debounceTimeout = null;
    this.refinedText = null;
    this.correctedText = null;
    this.currentGrammarResults = null;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.authenticateUser();
    this.setupUI();
    this.setupEventListeners();
    this.observeTextAreas();
    
    document.addEventListener('searchPanelReady', () => {
      this.addToSearchPanel();
    });
    
    this.addToSearchPanel();
    
    const observer = new MutationObserver(() => {
      this.addToSearchPanel();
      this.updateAssistantButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['userEmail', 'userToken', 'grammarEnabled', 'refinementEnabled']);
      this.userEmail = result.userEmail || null;
      this.userToken = result.userToken || null;
      this.grammarEnabled = result.grammarEnabled !== false;
      this.refinementEnabled = result.refinementEnabled !== false;
    } catch (error) {
      // Settings load failed silently
    }
  }

  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      Object.assign(this, settings);
    } catch (error) {
      // Settings save failed silently
    }
  }

  async authenticateUser() {
    if (!this.userToken) {
      return;
    }
    
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=ai_credits&token=${this.userToken}`
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          this.userToken = null;
          await chrome.storage.sync.remove(['userToken']);
        } else {
          this.userCredits = data.credits;
          this.userEmail = data.email;
        }
      } else {
        this.userToken = null;
      }
    } catch (error) {
      // Authentication failed silently
    }
  }

  showRegistrationDialog() {
    const modal = document.createElement('div');
    modal.className = 'registration-modal';
    modal.innerHTML = `
      <div class="registration-modal-content">
        <h3>Get Started with AI Assistant</h3>
        <p>Enter your email to receive 10 free credits</p>
        <div class="email-input-group">
          <input type="email" id="registration-email" placeholder="your@email.com">
          <button id="register-btn">Get Free Credits</button>
        </div>
        <button class="close-modal" onclick="this.closest('.registration-modal').remove()">×</button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('register-btn').addEventListener('click', () => {
      const email = document.getElementById('registration-email').value;
      if (this.validateEmail(email)) {
        this.registerUser(email);
        modal.remove();
      } else {
        this.showError('Please enter a valid email address');
      }
    });

    document.getElementById('registration-email').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('register-btn').click();
      }
    });
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async registerUser(email) {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=ai_register&email=${encodeURIComponent(email)}`
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          this.showError('Registration failed: ' + data.error);
          return;
        }
        
        this.userToken = data.api_token;
        this.userEmail = email;
        this.userCredits = data.credits;

        await this.saveSettings({
          userEmail: email,
          userToken: data.api_token,
          grammarEnabled: true,
          refinementEnabled: true
        });

        this.showSuccess(`Welcome! You have ${data.credits} free credits to get started.`);
        window.location.reload();
      } else {
        this.showError('Registration failed: Server error');
      }
    } catch (error) {
      this.showError('Registration failed: ' + error.message);
    }
  }

  addToSearchPanel() {
    const maxAttempts = 20;
    let attempts = 0;
    
    const tryAddToSearchPanel = () => {
      attempts++;
      const searchContainer = document.getElementById('claude-chat-search-container');
      
      if (!searchContainer) {
        if (attempts < maxAttempts) {
          setTimeout(tryAddToSearchPanel, 250);
        }
        return;
      }
      
      if (searchContainer.querySelector('#ai-assistant-toggle')) {
        return;
      }

      const settingsRow = searchContainer.querySelector('.search-settings');
      if (!settingsRow) {
        if (attempts < maxAttempts) {
          setTimeout(tryAddToSearchPanel, 250);
        }
        return;
      }

      const hasToken = this.userToken && this.userToken.length > 0;
      const isEnabled = hasToken && (this.grammarEnabled || this.refinementEnabled);
      const disabledClass = hasToken ? '' : 'disabled';
      const disabledAttr = hasToken ? '' : 'disabled';
      
      const aiAssistantToggle = document.createElement('div');
      aiAssistantToggle.className = `toggle-container ${disabledClass}`;
      aiAssistantToggle.innerHTML = `
        <span class="toggle-label">AI Assistant</span>
        <label class="toggle-switch">
          <input type="checkbox" id="ai-assistant-toggle" ${isEnabled ? 'checked' : ''} ${disabledAttr}>
          <span class="toggle-slider"></span>
        </label>
      `;

      const assistantContainer = document.createElement('div');
      assistantContainer.className = 'assistant-controls';
      assistantContainer.appendChild(aiAssistantToggle);

      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'settings-gear-btn';
      settingsBtn.title = 'AI Assistant Settings';
      settingsBtn.innerHTML = `⚙️`;

      assistantContainer.appendChild(settingsBtn);
      settingsRow.appendChild(assistantContainer);

      if (hasToken) {
        const creditsDisplay = document.createElement('div');
        creditsDisplay.className = 'credits-display';
        creditsDisplay.innerHTML = `
          <div class="credits-info">
            <span class="credits-label">Credits:</span>
            <span class="credits-count">${Math.max(0, this.userCredits)}</span>
          </div>
          <button class="buy-credits-btn buy-credits-trigger">Buy More</button>
        `;
        settingsRow.appendChild(creditsDisplay);
      } else {
        const registerPrompt = document.createElement('div');
        registerPrompt.className = 'register-prompt';
        registerPrompt.textContent = 'Click here to get 10 free credits';
        registerPrompt.onclick = () => this.showRegistrationDialog();
        settingsRow.appendChild(registerPrompt);
      }

      this.setupToggleListeners(hasToken, settingsBtn);
    };

    tryAddToSearchPanel();
  }

  setupToggleListeners(hasToken, settingsBtn) {
    const aiAssistantToggle = document.getElementById('ai-assistant-toggle');
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showSettingsPanel();
      });
    }

    if (!hasToken) {
      if (aiAssistantToggle && aiAssistantToggle.disabled) {
        aiAssistantToggle.closest('.toggle-container').addEventListener('click', (e) => {
          e.preventDefault();
          this.showRegistrationDialog();
        });
      }
      return;
    }

    if (aiAssistantToggle) {
      aiAssistantToggle.addEventListener('change', async (e) => {
        const isEnabled = e.target.checked;
        this.grammarEnabled = isEnabled;
        this.refinementEnabled = isEnabled;
        
        await this.saveSettings({
          userEmail: this.userEmail,
          userToken: this.userToken,
          grammarEnabled: this.grammarEnabled,
          refinementEnabled: this.refinementEnabled
        });
        
        window.location.reload();
      });
    }
  }

  setupUI() {
    this.createSettingsPanel();
    this.createSuggestionPanel();
  }

  createSettingsPanel() {
    if (document.getElementById('prompt-assistant-settings')) return;

    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'prompt-assistant-settings';
    settingsPanel.className = 'prompt-settings-panel collapsed';
    
    settingsPanel.innerHTML = `
      <div class="settings-header">
        <h3>AI Assistant Settings</h3>
        <button id="settings-close" class="close-btn">×</button>
      </div>
      <div class="settings-content">
        ${this.userToken ? `
          <div class="user-info">
            <h4>Account Information</h4>
            <p><strong>Email:</strong> ${this.userEmail}</p>
            <p><strong>Credits:</strong> <span class="credits-count">${this.userCredits}</span></p>
            <div class="credit-breakdown">
              <small>Grammar check: 1 credit • Prompt refinement: 2 credits</small>
            </div>
          </div>
          <div class="settings-actions">
            <button onclick="promptAssistant.showPurchaseDialog()" class="primary-btn">Buy More Credits</button>
            <button onclick="promptAssistant.refreshCredits()" class="secondary-btn">Refresh Credits</button>
          </div>
        ` : `
          <div class="registration-section">
            <h4>Get Started</h4>
            <p>Register to get 10 free credits and start using AI assistance!</p>
            <div class="settings-actions">
              <button onclick="promptAssistant.showRegistrationDialog()" class="primary-btn">Register Now</button>
            </div>
          </div>
        `}
        
        <div id="settings-status" class="status-message"></div>
      </div>
    `;

    document.body.appendChild(settingsPanel);
  }

  createSuggestionPanel() {
    if (document.getElementById('prompt-suggestions')) return;

    const suggestionPanel = document.createElement('div');
    suggestionPanel.id = 'prompt-suggestions';
    suggestionPanel.className = 'suggestion-panel hidden';
    
    suggestionPanel.innerHTML = `
      <div class="suggestion-header">
        <h3>AI Assistant</h3>
        <button id="suggestion-close" class="close-btn">×</button>
      </div>
      
      <div class="feature-selection">
        <div class="feature-card">
          <h4>Grammar Check (1 credit)</h4>
          <p>Fix grammar, spelling, and style issues</p>
          <button id="check-grammar-btn" class="feature-btn primary-btn">
            Check Grammar
          </button>
        </div>
        
        <div class="feature-card">
          <h4>Refine Prompt (2 credits)</h4>
          <p>Enhance your prompt for better AI interaction</p>
          <button id="refine-prompt-btn" class="feature-btn primary-btn">
            Refine Prompt
          </button>
        </div>
        
        <div class="feature-card">
          <h4>Both Features (3 credits)</h4>
          <p>Grammar check + prompt refinement together</p>
          <button id="analyze-both-btn" class="feature-btn secondary-btn">
            Analyze Both
          </button>
        </div>
      </div>
      
      <div class="suggestion-content hidden">
        <div class="suggestion-tabs">
          <button class="tab-btn active" data-tab="grammar">Grammar</button>
          <button class="tab-btn" data-tab="refinement">Refine Prompt</button>
        </div>
        
        <div id="grammar-tab" class="tab-content active">
          <div class="suggestion-section">
            <h4>Grammar Suggestions</h4>
            <div id="grammar-results" class="results-container">
              <div class="no-suggestions">No grammar issues found!</div>
            </div>
          </div>
        </div>
        
        <div id="refinement-tab" class="tab-content">
          <div class="suggestion-section">
            <h4>Refined Version</h4>
            <div id="refinement-results" class="results-container">
              <div class="loading">Analyzing your prompt...</div>
            </div>
          </div>
        </div>
        
        <div class="suggestion-actions">
          <button id="apply-suggestions" class="primary-btn" disabled>Apply Changes</button>
          <button id="copy-refined" class="secondary-btn" disabled>Copy Result</button>
        </div>
      </div>
    `;

    document.body.appendChild(suggestionPanel);
    this.suggestionPanel = suggestionPanel;
  }

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'settings-close') {
        this.hideSettingsPanel();
      } else if (e.target.id === 'suggestion-close') {
        this.hideSuggestionPanel();
      } else if (e.target.classList.contains('tab-btn')) {
        this.switchTab(e.target.dataset.tab);
      } else if (e.target.id === 'apply-suggestions') {
        this.applySuggestions();
      } else if (e.target.id === 'copy-refined') {
        this.copyRefinedText();
      } else if (e.target.id === 'check-grammar-btn') {
        this.runGrammarOnly();
      } else if (e.target.id === 'refine-prompt-btn') {
        this.runRefinementOnly();
      } else if (e.target.id === 'analyze-both-btn') {
        this.runBothFeatures();
      } else if (e.target.classList.contains('buy-credits-trigger')) {
        this.showPurchaseDialog();
      } else if (e.target.classList.contains('gumroad-btn')) {
        const url = e.target.dataset.url;
        if (url) {
          window.open(url, '_blank');
        }
      } else if (e.target.classList.contains('refresh-credits-btn')) {
        this.refreshAndReload();
        e.target.closest('.credits-modal').remove();
      } else if (e.target.classList.contains('close-modal-btn')) {
        e.target.closest('.credits-modal').remove();
      }
    });
  }

  observeTextAreas() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.attachToTextAreas(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.attachToTextAreas(document.body);
  }

  attachToTextAreas(container) {
    const textAreas = container.querySelectorAll('textarea, [contenteditable="true"]');
    
    textAreas.forEach(textArea => {
      if (textArea.dataset.promptAssistantAttached) return;
      
      const isClaudeInput = this.isClaudeTextArea(textArea);
      if (!isClaudeInput) return;

      textArea.dataset.promptAssistantAttached = 'true';
      this.setupTextAreaAssistant(textArea);
    });
  }

  isClaudeTextArea(textArea) {
    const placeholder = (textArea.placeholder || '').toLowerCase();
    const ariaLabel = (textArea.getAttribute('aria-label') || '').toLowerCase();
    const className = textArea.className || '';
    
    const isClaudeInput = 
      placeholder.includes('message') || 
      placeholder.includes('claude') ||
      placeholder.includes('type') ||
      ariaLabel.includes('message') ||
      ariaLabel.includes('chat') ||
      ariaLabel.includes('input') ||
      className.includes('message') ||
      className.includes('chat') ||
      className.includes('input') ||
      textArea.closest('[role="textbox"]') ||
      textArea.closest('.message-input') ||
      textArea.closest('.chat-input') ||
      textArea.closest('[data-testid*="message"]') ||
      textArea.closest('[data-testid*="input"]');
    
    return isClaudeInput;
  }

  setupTextAreaAssistant(textArea) {
    this.currentTextArea = textArea;
    this.addAssistantButton(textArea);
  }

  addAssistantButton(textArea) {
    const hasToken = this.userToken && this.userToken.length > 0;
    const hasEnabledFeatures = this.grammarEnabled || this.refinementEnabled;
    
    if (!hasToken || !hasEnabledFeatures) return;
    
    let container = textArea.closest('[role="textbox"]')?.parentElement || 
                   textArea.closest('.ProseMirror')?.parentElement ||
                   textArea.parentElement;
                   
    if (!container || container.querySelector('.prompt-assistant-btn')) return;

    let targetContainer = container;
    
    const inputWrapper = textArea.closest('div[class*="border"]') || 
                        textArea.closest('div[class*="rounded"]') ||
                        textArea.closest('div[style*="position"]');
    
    if (inputWrapper) {
      targetContainer = inputWrapper;
    }

    const assistantBtn = document.createElement('button');
    assistantBtn.className = 'prompt-assistant-btn';
    assistantBtn.innerHTML = '✨';
    assistantBtn.title = 'AI Assistant - Check grammar and refine prompt';
    assistantBtn.type = 'button';

    assistantBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openFeatureSelector(textArea);
    });

    const computedStyle = window.getComputedStyle(targetContainer);
    if (computedStyle.position === 'static') {
      targetContainer.style.position = 'relative';
    }

    targetContainer.appendChild(assistantBtn);
  }

  updateAssistantButtons() {
    const assistantButtons = document.querySelectorAll('.prompt-assistant-btn');
    const hasToken = this.userToken && this.userToken.length > 0;
    const hasEnabledFeatures = this.grammarEnabled || this.refinementEnabled;
    const shouldShowButton = hasToken && hasEnabledFeatures;
    
    assistantButtons.forEach(button => {
      if (shouldShowButton) {
        button.style.display = 'flex';
      } else {
        button.remove();
      }
    });
    
    if (shouldShowButton) {
      this.attachToTextAreas(document.body);
    }
  }

  openFeatureSelector(textArea) {
    if (!this.userToken) {
      this.showRegistrationDialog();
      return;
    }

    const text = this.getTextContent(textArea);
    if (!text || !text.trim()) {
      this.showError('Please enter some text to analyze.');
      return;
    }
    
    this.currentTextArea = textArea;
    this.showSuggestionPanel();
    this.showFeatureSelection();
  }

  async runGrammarOnly() {
    if (!this.validateCredits(1)) return;
    
    const text = this.getTextContent(this.currentTextArea);
    if (!text?.trim()) {
      this.showError('Please enter some text to analyze.');
      return;
    }
    
    this.showResultsView();
    this.showLoadingForGrammar();
    
    try {
      const grammarResults = await this.checkGrammar(text);
      this.displayGrammarResults(grammarResults);
      this.switchTab('grammar');
    } catch (error) {
      this.showError('Grammar check failed: ' + error.message);
    }
  }

  async runRefinementOnly() {
    if (!this.validateCredits(2)) return;
    
    const text = this.getTextContent(this.currentTextArea);
    if (!text?.trim()) {
      this.showError('Please enter some text to analyze.');
      return;
    }
    
    this.showResultsView();
    this.showLoadingForRefinement();
    
    try {
      const refinementResults = await this.refinePrompt(text);
      this.displayRefinementResults(refinementResults);
      this.switchTab('refinement');
    } catch (error) {
      this.showError('Prompt refinement failed: ' + error.message);
    }
  }

  async runBothFeatures() {
    if (!this.validateCredits(3)) return;
    
    const text = this.getTextContent(this.currentTextArea);
    if (!text?.trim()) {
      this.showError('Please enter some text to analyze.');
      return;
    }
    
    this.showResultsView();
    this.showLoading();

    try {
      const promises = [];
      
      if (this.grammarEnabled) {
        promises.push(this.checkGrammar(text));
      } else {
        promises.push(Promise.resolve(null));
      }
      
      if (this.refinementEnabled) {
        promises.push(this.refinePrompt(text));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [grammarResults, refinementResults] = await Promise.allSettled(promises);

      this.displayResults(
        grammarResults.status === 'fulfilled' ? grammarResults.value : null,
        refinementResults.status === 'fulfilled' ? refinementResults.value : null
      );
      
    } catch (error) {
      this.showError('Analysis failed: ' + error.message);
    }
  }

  validateCredits(required) {
    if (this.userCredits < required) {
      this.showInsufficientCreditsDialog(required);
      return false;
    }
    return true;
  }

  showResultsView() {
    this.suggestionPanel.querySelector('.feature-selection').classList.add('hidden');
    this.suggestionPanel.querySelector('.suggestion-content').classList.remove('hidden');
  }

  showFeatureSelection() {
    this.suggestionPanel.querySelector('.feature-selection').classList.remove('hidden');
    this.suggestionPanel.querySelector('.suggestion-content').classList.add('hidden');
  }

  showLoadingForGrammar() {
    const grammarResults = document.getElementById('grammar-results');
    if (grammarResults) {
      grammarResults.innerHTML = '<div class="loading">Checking grammar...</div>';
    }
  }

  showLoadingForRefinement() {
    const refinementResults = document.getElementById('refinement-results');
    if (refinementResults) {
      refinementResults.innerHTML = '<div class="loading">Refining prompt...</div>';
    }
  }

  async checkGrammar(text) {
    if (this.userCredits < 1) {
      return this.createBlurredResult('grammar', text);
    }

    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=ai_grammar&token=${this.userToken}&text=${encodeURIComponent(text)}`
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          if (data.error.includes('Insufficient credits')) {
            return this.createBlurredResult('grammar', text);
          }
          throw new Error(data.error);
        }
        return data;
      } else {
        throw new Error('Grammar check failed');
      }
    } catch (error) {
      throw error;
    }
  }

  async refinePrompt(text) {
    if (this.userCredits < 2) {
      return this.createBlurredRefinementResult(text);
    }

    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=ai_refine&token=${this.userToken}&text=${encodeURIComponent(text)}`
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          if (data.error.includes('Insufficient credits')) {
            return this.createBlurredRefinementResult(text);
          }
          throw new Error(data.error);
        }
        return data;
      } else {
        throw new Error('Prompt refinement failed');
      }
    } catch (error) {
      throw error;
    }
  }

  async deductCredits(amount, action) {
    try {
      const requestBody = `action=ai_deduct_credits&token=${this.userToken}&credits=${amount}&action_desc=${encodeURIComponent(action)}`;
      
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        this.showError(`Server error: ${response.status}`);
        return false;
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        this.showError('Invalid response format from server');
        return false;
      }
      
      if (data.error) {
        this.showError('Failed to deduct credits: ' + data.error);
        return false;
      }
      
      if (data.success && data.new_credits !== undefined) {
        this.userCredits = data.new_credits;
        this.updateCreditsDisplay();
        this.showSuccess(`${action}! Credits used: ${amount}. Remaining: ${data.new_credits}`);
        return true;
      } else {
        this.showError('Unexpected response from server');
        return false;
      }
    } catch (error) {
      this.showError('Network error: ' + error.message);
      return false;
    }
  }

  async applySuggestions() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    
    if (activeTab === 'grammar' && this.correctedText) {
      if (!this.currentTextArea) {
        this.showError('No text area selected');
        return;
      }
      
      const applyButton = document.getElementById('apply-suggestions');
      if (applyButton) {
        applyButton.disabled = true;
        applyButton.textContent = 'Processing...';
      }
      
      const success = await this.deductCredits(1, 'Applied grammar corrections');
      
      if (success) {
        this.setTextContent(this.currentTextArea, this.correctedText);
        if (applyButton) {
          applyButton.textContent = 'Applied ✓';
        }
      } else {
        if (applyButton) {
          applyButton.disabled = false;
          applyButton.textContent = 'Apply Corrections';
        }
      }
      
    } else if (activeTab === 'refinement' && this.refinedText) {
      await this.applyRefinedPrompt();
    }
  }

  async applyRefinedPrompt() {
    if (!this.currentTextArea || !this.refinedText) return;
    
    const applyButton = document.getElementById('apply-suggestions');
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.textContent = 'Processing...';
    }
    
    const success = await this.deductCredits(2, 'Applied refined prompt');
    
    if (success) {
      this.setTextContent(this.currentTextArea, this.refinedText);
      if (applyButton) {
        applyButton.textContent = 'Applied ✓';
      }
    } else {
      if (applyButton) {
        applyButton.disabled = false;
        applyButton.textContent = 'Apply Refined';
      }
    }
  }

  async copyRefinedText() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    
    if (activeTab === 'refinement' && this.refinedText) {
      const copyButton = document.getElementById('copy-refined');
      if (copyButton) {
        copyButton.disabled = true;
        copyButton.textContent = 'Processing...';
      }
      
      const success = await this.deductCredits(2, 'Copied refined prompt');
      
      if (success) {
        navigator.clipboard.writeText(this.refinedText).then(() => {
          if (copyButton) {
            copyButton.textContent = 'Copied ✓';
          }
        });
      } else {
        if (copyButton) {
          copyButton.disabled = false;
          copyButton.textContent = 'Copy Refined';
        }
      }
      
    } else if (activeTab === 'grammar' && this.correctedText) {
      const copyButton = document.getElementById('copy-refined');
      if (copyButton) {
        copyButton.disabled = true;
        copyButton.textContent = 'Processing...';
      }
      
      const success = await this.deductCredits(1, 'Copied corrected text');
      
      if (success) {
        navigator.clipboard.writeText(this.correctedText).then(() => {
          if (copyButton) {
            copyButton.textContent = 'Copied ✓';
          }
        });
      } else {
        if (copyButton) {
          copyButton.disabled = false;
          copyButton.textContent = 'Copy Corrected';
        }
      }
    }
  }

  updateCreditsDisplay() {
    const creditsDisplays = document.querySelectorAll('.credits-count');
    creditsDisplays.forEach(display => {
      display.style.transition = 'all 0.3s ease';
      display.style.transform = 'scale(1.1)';
      display.style.color = '#e74c3c';
      
      display.textContent = this.userCredits;
      
      setTimeout(() => {
        display.style.transform = 'scale(1)';
        display.style.color = '';
      }, 300);
    });
  }

  createBlurredResult(type, originalText) {
    return {
      corrected_text: originalText,
      has_corrections: true,
      summary: "Purchase credits to see corrections",
      isBlurred: true,
      creditsNeeded: type === 'grammar' ? 1 : 2
    };
  }

  createBlurredRefinementResult(originalText) {
    return {
      refined_prompt: originalText,
      improvements: ["Enhanced for better AI interaction"],
      isBlurred: true,
      creditsNeeded: 2
    };
  }

  showPurchaseDialog() {
    const existingModal = document.querySelector('.credits-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'credits-modal';
    modal.innerHTML = `
      <div class="credits-modal-content">
        <h3>Buy More Credits</h3>
        <p>Choose a credit package that works for you.</p>
        <p>Current credits: ${Math.max(0, this.userCredits)}</p>
        <div class="credit-packages">
          <div class="package">
            <h4>Small Pack</h4>
            <p>50 credits for $5.00</p>
            <button class="gumroad-btn" data-url="https://michaelmick.gumroad.com/l/smallpack">Buy Now</button>
          </div>
          <div class="package">
            <h4>Medium Pack</h4>
            <p>200 credits for $15.00</p>
            <button class="gumroad-btn" data-url="https://michaelmick.gumroad.com/l/mediumpack">Buy Now</button>
          </div>
          <div class="package">
            <h4>Large Pack</h4>
            <p>500 credits for $30.00</p>
            <button class="gumroad-btn" data-url="https://michaelmick.gumroad.com/l/largepack">Buy Now</button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="refresh-credits-btn">I just bought credits - Refresh</button>
          <button class="close-modal-btn">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  showInsufficientCreditsDialog(requiredCredits = 1) {
    const existingModal = document.querySelector('.credits-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'credits-modal';
    modal.innerHTML = `
      <div class="credits-modal-content">
        <h3>Insufficient Credits</h3>
        <p>You need ${requiredCredits} credits for this operation, but you only have ${Math.max(0, this.userCredits)}.</p>
        <div class="credit-packages">
          <div class="package">
            <h4>Small Pack</h4>
            <p>50 credits for $5.00</p>
            <button class="gumroad-btn" data-url="https://michaelmick.gumroad.com/l/smallpack">Buy Now</button>
          </div>
          <div class="package">
            <h4>Medium Pack</h4>
            <p>200 credits for $15.00</p>
            <button class="gumroad-btn" data-url="https://michaelmick.gumroad.com/l/mediumpack">Buy Now</button>
          </div>
          <div class="package">
            <h4>Large Pack</h4>
            <p>500 credits for $30.00</p>
            <button class="gumroad-btn" data-url="https://michaelmick.gumroad.com/l/largepack">Buy Now</button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="refresh-credits-btn">I just bought credits - Refresh</button>
          <button class="close-modal-btn">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  async refreshAndReload() {
    const refreshBtn = document.querySelector('.refresh-credits-btn');
    if (refreshBtn) {
      refreshBtn.textContent = 'Refreshing...';
      refreshBtn.disabled = true;
    }
    
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=ai_credits&token=${this.userToken}`
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!data.error) {
          this.userCredits = data.credits;
        }
      }
    } catch (error) {
      // Error handled silently
    }
    
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  async refreshCredits() {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=ai_credits&token=${this.userToken}`
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          this.showError('Failed to refresh credits');
        } else {
          this.userCredits = data.credits;
          this.updateCreditsDisplay();
          this.showSuccess('Credits refreshed! You now have ' + data.credits + ' credits.');
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (error) {
      this.showError('Failed to refresh credits');
    }
  }

  getTextContent(element) {
    if (!element) return '';
    
    if (element.value !== undefined) {
      return element.value || '';
    } else if (element.textContent !== undefined) {
      return element.textContent || '';
    } else if (element.innerText !== undefined) {
      return element.innerText || '';
    }
    
    return '';
  }

  setTextContent(element, text) {
    if (!element) return;
    
    if (element.value !== undefined) {
      element.value = text;
    } else {
      element.textContent = text;
    }
    
    const events = ['input', 'change', 'keyup'];
    events.forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
    
    if (element.contentEditable === 'true') {
      element.dispatchEvent(new Event('compositionend', { bubbles: true }));
    }
    
    element.focus();
  }

  showSettingsPanel() {
    const existingPanel = document.getElementById('prompt-assistant-settings');
    if (existingPanel) {
      existingPanel.remove();
    }
    
    this.createSettingsPanel();
    document.getElementById('prompt-assistant-settings').classList.remove('collapsed');
  }

  hideSettingsPanel() {
    document.getElementById('prompt-assistant-settings')?.classList.add('collapsed');
  }

  showSuggestionPanel() {
    this.suggestionPanel?.classList.remove('hidden');
  }

  hideSuggestionPanel() {
    this.suggestionPanel?.classList.add('hidden');
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    const applyButton = document.getElementById('apply-suggestions');
    const copyButton = document.getElementById('copy-refined');
    
    if (applyButton) {
      if (tabName === 'grammar' && this.grammarEnabled) {
        applyButton.textContent = 'Apply Corrections';
        applyButton.disabled = !this.correctedText;
      } else if (tabName === 'refinement' && this.refinementEnabled) {
        applyButton.textContent = 'Apply Refined';
        applyButton.disabled = !this.refinedText;
      } else {
        applyButton.textContent = 'Feature Disabled';
        applyButton.disabled = true;
      }
    }
    
    if (copyButton) {
      if (tabName === 'refinement') {
        copyButton.textContent = 'Copy Refined';
        copyButton.disabled = !this.refinedText;
      } else if (tabName === 'grammar') {
        copyButton.textContent = 'Copy Corrected';
        copyButton.disabled = !this.correctedText;
      }
    }
  }

  displayResults(grammarResults, refinementResults) {
    this.currentGrammarResults = grammarResults;
    this.displayGrammarResults(grammarResults);
    this.displayRefinementResults(refinementResults);
    
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'grammar';
    this.switchTab(activeTab);
  }

  displayGrammarResults(results) {
    const container = document.getElementById('grammar-results');
    if (!container) return;
    
    if (!this.grammarEnabled) {
      container.innerHTML = '<div class="feature-disabled">Grammar checking is disabled.</div>';
      return;
    }
    
    if (!results) {
      container.innerHTML = '<div class="error">Grammar check unavailable.</div>';
      return;
    }
    
    if (!results.has_corrections) {
      container.innerHTML = '<div class="no-suggestions">No grammar issues found!</div>';
      this.correctedText = null;
      return;
    }

    if (results.isBlurred) {
      const html = `
        <div class="blurred-content">
          <div class="blurred-text">
            <h5>Corrected Text:</h5>
            <div class="corrected-paragraph">Your text has been corrected for grammar, spelling, and style improvements...</div>
          </div>
          <div class="unlock-overlay">
            <h4>🔒 Purchase Credits to See Results</h4>
            <p>You need ${results.creditsNeeded} credits to view the corrections</p>
            <button class="unlock-btn buy-credits-trigger">
              Buy Credits
            </button>
          </div>
        </div>
      `;
      container.innerHTML = html;
      this.correctedText = null;
      return;
    }

    const html = `
      <div class="corrected-content">
        <div class="corrected-text-section">
          <h5>Corrected Text:</h5>
          <div class="corrected-paragraph">${results.corrected_text}</div>
        </div>
        ${results.summary ? `
          <div class="correction-summary">
            <h5>Changes Made:</h5>
            <p>${results.summary}</p>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;
    this.correctedText = results.corrected_text;
  }

  displayRefinementResults(results) {
    const container = document.getElementById('refinement-results');
    if (!container) return;
    
    if (!this.refinementEnabled) {
      container.innerHTML = '<div class="feature-disabled">Prompt refinement is disabled.</div>';
      return;
    }
    
    if (!results) {
      container.innerHTML = '<div class="error">Prompt refinement unavailable.</div>';
      return;
    }

    if (results.isBlurred) {
      const html = `
        <div class="blurred-content">
          <div class="blurred-text">
            <h5>Refined Prompt:</h5>
            <div class="refined-prompt">Your prompt has been enhanced with better structure, clarity, and specificity for improved AI interaction...</div>
          </div>
          <div class="unlock-overlay">
            <h4>🔒 Purchase Credits to See Results</h4>
            <p>You need ${results.creditsNeeded} credits to view the refined prompt</p>
            <button class="unlock-btn buy-credits-trigger">
              Buy Credits
            </button>
          </div>
        </div>
      `;
      container.innerHTML = html;
      this.refinedText = null;
      return;
    }

    let html = `
      <div class="refined-content">
        <div class="refined-text">
          <h5>Refined Prompt:</h5>
          <div class="refined-prompt">${results.refined_prompt || results}</div>
        </div>
    `;

    if (results.improvements && Array.isArray(results.improvements) && results.improvements.length > 0) {
      html += `
        <div class="improvements-list">
          <h5>Key Improvements:</h5>
          <ul>
            ${results.improvements.map(imp => `<li>${imp}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
    this.refinedText = results.refined_prompt || results;
  }

  showLoading() {
    const grammarResults = document.getElementById('grammar-results');
    const refinementResults = document.getElementById('refinement-results');
    
    if (grammarResults) {
      grammarResults.innerHTML = '<div class="loading">Checking grammar...</div>';
    }
    if (refinementResults) {
      refinementResults.innerHTML = '<div class="loading">Refining prompt...</div>';
    }
  }

  showStatus(message, type = 'info') {
    const status = document.getElementById('settings-status');
    if (status) {
      const className = type === 'loading' ? 'loading' : type === 'error' ? 'error' : 'success';
      status.innerHTML = `<div class="${className}">${message}</div>`;
      
      if (type !== 'loading' && type !== 'error') {
        setTimeout(() => status.innerHTML = '', 3000);
      }
    }
  }

  showError(message) {
    this.showStatus(message, 'error');
  }

  showSuccess(message) {
    this.showStatus(message, 'success');
  }
}

// Initialize the Prompt Assistant
const promptAssistant = new PromptAssistant();