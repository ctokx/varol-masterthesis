// Constants
const SEARCH_BAR_ID = 'claude-chat-search-bar';
const RESULTS_CONTAINER_ID = 'claude-chat-search-results';

// Track current navigation state
let currentSearchResults = [];
let currentResultIndex = -1;
let currentSearchQuery = '';

// Add keyboard shortcuts for search navigation
function setupKeyboardShortcuts() {
  // Remove any existing event listeners first
  document.removeEventListener('keydown', handleSearchShortcuts);
  document.addEventListener('keydown', handleSearchShortcuts);
}

// Handle global keyboard shortcuts
function handleSearchShortcuts(e) {
  // Open search with '/'
  if (e.key === '/' && 
      document.activeElement.tagName !== 'INPUT' && 
      document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    openSearchPanel();
    setTimeout(() => {
      const searchInput = document.getElementById(SEARCH_BAR_ID);
      if (searchInput) searchInput.focus();
    }, 300);
  }
  
  // Close search with Escape
  if (e.key === 'Escape') {
    const searchContainer = document.getElementById('claude-chat-search-container');
    if (searchContainer && !searchContainer.classList.contains('collapsed')) {
      closeSearchPanel();
    }
  }
}

// Create and inject the search UI
function createSearchUI() {
  // Check if search UI already exists
  if (document.getElementById(SEARCH_BAR_ID)) {
    return;
  }

  console.log("Claude Chat Search: Creating search UI");
  
  // Create a completely separate toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'claude-chat-search-toggle';
  toggleButton.innerHTML = '🔍';
  toggleButton.title = 'Search in chat (Press / to open)';
  document.body.appendChild(toggleButton);
  
  // Create search container (starts hidden)
  const searchContainer = document.createElement('div');
  searchContainer.id = 'claude-chat-search-container';
  searchContainer.classList.add('collapsed');
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.id = 'claude-chat-search-close';
  closeButton.innerHTML = '✕';
  closeButton.title = 'Close search';
  
  // Create search title
  const searchTitle = document.createElement('div');
  searchTitle.className = 'search-title';
  searchTitle.textContent = 'Search';
  
  // Create settings row for toggles
  const settingsRow = document.createElement('div');
  settingsRow.className = 'search-settings';
  
  // Create toggle group for live search
  const toggleGroup = document.createElement('div');
  toggleGroup.className = 'toggle-group';
  
  // Create real-time search toggle
  const realTimeToggle = document.createElement('div');
  realTimeToggle.className = 'toggle-container';
  realTimeToggle.innerHTML = `
    <span class="toggle-label">Live Search</span>
    <label class="toggle-switch">
      <input type="checkbox" id="realtime-checkbox" checked>
      <span class="toggle-slider"></span>
    </label>
  `;
  
  // Add the toggle to the toggle group
  toggleGroup.appendChild(realTimeToggle);
  
  // Add toggle group to settings row
  settingsRow.appendChild(toggleGroup);
  
  // Create search controls row
  const searchControls = document.createElement('div');
  searchControls.className = 'search-controls';
  
  // Create search input
  const searchInput = document.createElement('input');
  searchInput.id = SEARCH_BAR_ID;
  searchInput.type = 'text';
  searchInput.placeholder = 'Search in current chat...';
  
  // Create search button
  const searchButton = document.createElement('button');
  searchButton.id = 'claude-chat-search-button';
  searchButton.textContent = 'Search';
  searchButton.title = 'Search this chat';
  
  // Create results container
  const resultsContainer = document.createElement('div');
  resultsContainer.id = RESULTS_CONTAINER_ID;
  
  // Add keyboard shortcut hint
  const keyboardHint = document.createElement('div');
  keyboardHint.className = 'keyboard-hint';
  keyboardHint.textContent = 'Press "/" to search • Esc to close • F3 to navigate';
  
  // Add event listeners
  toggleButton.addEventListener('click', openSearchPanel);
  closeButton.addEventListener('click', closeSearchPanel);
  
  searchButton.addEventListener('click', () => {
    performSearch(searchInput.value);
  });
  
  // Real-time search with debounce
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    const realtimeEnabled = document.getElementById('realtime-checkbox')?.checked;
    if (!realtimeEnabled) return;
    
    // Show a "typing" indicator
    const resultsContainer = document.getElementById(RESULTS_CONTAINER_ID);
    if (searchInput.value.trim()) {
      resultsContainer.innerHTML = '<div class="search-typing">Searching as you type...</div>';
    } else {
      resultsContainer.innerHTML = '';
    }
    
    // Clear any pending timeout
    clearTimeout(searchTimeout);
    
    // Set a new timeout (300ms debounce)
    searchTimeout = setTimeout(() => {
      if (searchInput.value.trim()) {
        performSearch(searchInput.value);
      }
    }, 300);
  });
  
  // Keep the Enter key functionality
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
  
  // Add input and button to the search controls row
  searchControls.appendChild(searchInput);
  searchControls.appendChild(searchButton);
  
  // Assemble the search container
  searchContainer.appendChild(closeButton);
  searchContainer.appendChild(searchTitle);
  searchContainer.appendChild(settingsRow);
  searchContainer.appendChild(searchControls);
  searchContainer.appendChild(resultsContainer);
  searchContainer.appendChild(keyboardHint);
  
  // Add the container to the body
  document.body.appendChild(searchContainer);
  console.log("Claude Chat Search: UI created successfully");
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Add styles to the page
  addSearchStyles();
  
  // Notify prompt assistant that search panel is ready
  notifySearchPanelReady();
}

// Notify prompt assistant that search panel is ready for integration
function notifySearchPanelReady() {
  // Dispatch custom event for prompt assistant to listen to
  const event = new CustomEvent('searchPanelReady', {
    detail: { containerId: 'claude-chat-search-container' }
  });
  document.dispatchEvent(event);
}

// Add search styles to the page
function addSearchStyles() {
  if (document.getElementById('claude-chat-search-styles')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'claude-chat-search-styles';
  styleElement.textContent = `
    #claude-chat-search-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #6e56cf;
      color: white;
      font-size: 18px;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    
    #claude-chat-search-toggle:hover {
      transform: scale(1.05);
    }
    
    #claude-chat-search-container {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 80vh;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: transform 0.3s, opacity 0.3s;
    }
    
    #claude-chat-search-container.collapsed {
      transform: translateX(100%);
      opacity: 0;
      pointer-events: none;
    }
    
    .search-title {
      padding: 12px 16px;
      font-size: 16px;
      font-weight: 600;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    #claude-chat-search-close {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s;
      padding: 4px;
      border-radius: 4px;
    }
    
    #claude-chat-search-close:hover {
      opacity: 1;
      background: #f5f5f5;
    }
    
    .search-settings {
      padding: 8px 16px;
      border-bottom: 1px solid #eee;
    }
    
    .toggle-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .toggle-container {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    
    .toggle-label {
      font-size: 12px;
      color: #555;
      white-space: nowrap;
    }
    
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
    }
    
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .3s;
      border-radius: 20px;
    }
    
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 2px;
      bottom: 2px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }
    
    input:checked + .toggle-slider {
      background-color: #6e56cf;
    }
    
    input:checked + .toggle-slider:before {
      transform: translateX(16px);
    }
    
    .search-controls {
      padding: 8px 16px;
      display: flex;
      gap: 8px;
      border-bottom: 1px solid #eee;
    }
    
    #claude-chat-search-bar {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    
    #claude-chat-search-bar:focus {
      outline: none;
      border-color: #6e56cf;
    }
    
    #claude-chat-search-button {
      padding: 8px 16px;
      background-color: #6e56cf;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
    }
    
    #claude-chat-search-results {
      flex: 1;
      overflow-y: auto;
      padding: 0;
      max-height: calc(80vh - 160px);
    }
    
    .results-count {
      padding: 8px 16px;
      font-size: 14px;
      color: #666;
      border-bottom: 1px solid #eee;
    }
    
    .results-list {
      padding: 0;
    }
    
    .result-item {
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .result-item:hover {
      background-color: #f9f9f9;
    }
    
    .result-item.selected {
      background-color: #f0ebff;
    }
    
    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    
    .result-role {
      font-weight: 500;
      color: #6e56cf;
    }
    
    .result-message-number {
      font-size: 12px;
      color: #888;
    }
    
    .result-context {
      font-size: 13px;
      line-height: 1.4;
      color: #333;
      word-break: break-word;
    }
    
    .highlight {
      background-color: #ffe89e;
      padding: 0 2px;
      border-radius: 2px;
    }
    
    .no-results,
    .search-error,
    .search-loading,
    .search-typing {
      padding: 24px 16px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    
    .search-error {
      color: #e53935;
    }
    
    .result-navigation {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-top: 1px solid #eee;
    }
    
    .navigation-count {
      font-size: 13px;
      color: #666;
    }
    
    .navigation-buttons {
      display: flex;
      gap: 8px;
    }
    
    .nav-button {
      padding: 6px 12px;
      background-color: #f3f3f3;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
    }
    
    .nav-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .nav-primary {
      background-color: #6e56cf;
      color: white;
      border-color: #6e56cf;
    }
    
    .keyboard-hint {
      padding: 8px 16px;
      font-size: 12px;
      color: #888;
      text-align: center;
      border-top: 1px solid #eee;
    }
    
    .search-highlight-active {
      position: relative;
      box-shadow: 0 0 0 2px #6e56cf;
      z-index: 5;
      border-radius: 4px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(110, 86, 207, 0.4);
      }
      70% {
        box-shadow: 0 0 0 6px rgba(110, 86, 207, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(110, 86, 207, 0);
      }
    }
  `;
  
  document.head.appendChild(styleElement);
}

// Open search panel
function openSearchPanel() {
  const searchContainer = document.getElementById('claude-chat-search-container');
  searchContainer.classList.remove('collapsed');
  
  // Focus the search input
  setTimeout(() => {
    document.getElementById(SEARCH_BAR_ID).focus();
  }, 300);
}

// Close search panel
function closeSearchPanel() {
  const searchContainer = document.getElementById('claude-chat-search-container');
  searchContainer.classList.add('collapsed');
}

// Rest of the search functionality remains the same...
// [All the remaining functions from performSearch to flashElement stay exactly the same]

// Perform the search in the current chat
function performSearch(query) {
  if (!query.trim()) {
    return;
  }
  
  const resultsContainer = document.getElementById(RESULTS_CONTAINER_ID);
  resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
  
  try {
    // Search in the current chat
    const results = searchCurrentChat(query);
    displayResults(results, query);
  } catch (error) {
    resultsContainer.innerHTML = `<div class="search-error">Error searching: ${error.message}</div>`;
    console.error('Search error:', error);
  }
}

// Enhanced method to identify chat message content
function findChatMessageElements() {
  const results = [];
  
  // Try to find the main content area (most likely to contain chat messages)
  const mainContentSelectors = [
    'main',
    '[role="main"]',
    '.chat-container',
    '.message-container',
    '.conversation-container',
    '.chat-content',
    'article'
  ];
  
  let mainContentArea = null;
  for (const selector of mainContentSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      mainContentArea = element;
      break;
    }
  }
  
  // If no specific container found, use document body
  if (!mainContentArea) {
    mainContentArea = document.body;
  }
  
  // Find all substantial text blocks in the main content
  const textBlocks = [];
  const walker = document.createTreeWalker(
    mainContentArea,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        // Skip script, style, and hidden elements
        if (node.tagName === 'SCRIPT' || 
            node.tagName === 'STYLE' || 
            node.tagName === 'NOSCRIPT' ||
            getComputedStyle(node).display === 'none' ||
            getComputedStyle(node).visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Accept elements with substantial text (> 30 chars)
        if (node.textContent && node.textContent.trim().length > 30) {
          return NodeFilter.FILTER_ACCEPT;
        }
        
        // Continue traversing other nodes
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  while (walker.nextNode()) {
    const node = walker.currentNode;
    
    // Skip navigation elements or likely UI elements
    if (node.tagName === 'NAV' || 
        node.tagName === 'HEADER' || 
        node.tagName === 'FOOTER' ||
        node.getAttribute('role') === 'navigation' ||
        node.getAttribute('role') === 'banner' ||
        node.getAttribute('role') === 'complementary' ||
        node.getAttribute('role') === 'menu' ||
        node.className.includes('navigation') ||
        node.className.includes('sidebar') ||
        node.className.includes('menu') ||
        node.className.includes('header') ||
        node.className.includes('footer')) {
      continue;
    }
    
    // For text-rich elements, also check their direct text content
    const childNodes = Array.from(node.childNodes);
    const textNodes = childNodes.filter(child => 
      child.nodeType === Node.TEXT_NODE && 
      child.textContent.trim().length > 20
    );
    
    // If this element has its own text content (not just children's),
    // or it has substantial direct text nodes, add it to our collection
    if (textNodes.length > 0 || 
        (node.textContent.trim().length > 30 && 
         // Skip if the element has too many children (likely a container)
         node.children.length < 5)) {
      textBlocks.push(node);
    }
  }
  
  // Further filter to likely chat messages
  const likelyMessages = textBlocks.filter(el => {
    // Must have substantial text
    if (el.textContent.trim().length < 50) return false;
    
    // Skip elements with too many children - likely containers
    if (el.children.length > 10) return false;
    
    // Skip elements that contain navigation-like text
    const text = el.textContent.toLowerCase();
    if (text.includes('new chat') && text.includes('projects')) return false;
    if (text.includes('log out') && text.includes('settings')) return false;
    
    return true;
  });
  
  return likelyMessages;
}

// Search in the current open chat
function searchCurrentChat(query) {
  const results = [];
  const seenContents = new Set();
  const lowercaseQuery = query.toLowerCase();
  
  const messageElements = findChatMessageElements();
  
  if (messageElements.length === 0) {
    return results;
  }
  
  // Process each message element
  messageElements.forEach((element, index) => {
    const text = element.textContent;
    const lowercaseText = text.toLowerCase();
    
    if (lowercaseText.includes(lowercaseQuery)) {
      // Create a fingerprint for deduplication
      const matchIndex = lowercaseText.indexOf(lowercaseQuery);
      const signatureStart = Math.max(0, matchIndex - 20);
      const signatureEnd = Math.min(text.length, matchIndex + query.length + 20);
      const contentSignature = text.substring(signatureStart, signatureEnd);
      
      // Skip if we've already seen very similar content
      if (seenContents.has(contentSignature)) {
        return;
      }
      
      // Add this signature to our seen set
      seenContents.add(contentSignature);
      
      // Generate an ID if needed
      if (!element.id) {
        element.id = `claude-search-msg-${index}`;
      }
      
      // Get surrounding context
      const contextStart = Math.max(0, matchIndex - 40);
      const contextEnd = Math.min(text.length, matchIndex + query.length + 40);
      let context = text.substring(contextStart, contextEnd);
      
      // Add ellipsis
      if (contextStart > 0) context = '...' + context;
      if (contextEnd < text.length) context += '...';
      
      // Try to determine if this is from the user or Claude
      let isHuman = false;
      
      // Check element and parent classes for user indicators
      let current = element;
      for (let i = 0; i < 5; i++) {
        if (!current) break;
        
        const classes = current.className || '';
        const role = current.getAttribute('role') || '';
        const dataRole = current.getAttribute('data-role') || '';
        
        if (classes.includes('human') || 
            classes.includes('user') || 
            role === 'user' || 
            dataRole === 'user' ||
            dataRole === 'human') {
          isHuman = true;
          break;
        }
        
        current = current.parentElement;
      }
      
      // Additional heuristic: shorter texts are more likely to be user messages
      if (!isHuman && text.length < 200) {
        isHuman = true;
      }
      
      const role = isHuman ? 'You' : 'Claude';
      
      results.push({
        role,
        context,
        fullText: text,
        messageIndex: index,
        elementId: element.id
      });
    }
  });
  
  return results;
}

// Highlight matches in the context
function highlightMatch(context, query) {
  return context.replace(
    new RegExp(escapeRegExp(query), 'gi'),
    match => `<span class="highlight">${match}</span>`
  );
}

// Helper function to escape special characters in a string for use in a regular expression
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Display search results
function displayResults(results, query) {
  const resultsContainer = document.getElementById(RESULTS_CONTAINER_ID);
  
  // Store results and query for navigation
  currentSearchResults = results;
  currentResultIndex = -1;
  currentSearchQuery = query;
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `<div class="no-results">No matches found for "${query}" in this chat</div>`;
    return;
  }
  
  // Create results HTML
  let resultsHTML = `
    <div class="results-count">
      ${results.length} match${results.length !== 1 ? 'es' : ''} found for "${query}"
    </div>
  `;
  resultsHTML += '<div class="results-list">';
  
  results.forEach((result, index) => {
    resultsHTML += `
      <div class="result-item" 
           data-element-id="${result.elementId}" 
           data-index="${index}">
        <div class="result-header">
          <span class="result-message-number">Message #${index + 1}</span>
          <span class="result-role">${result.role}</span>
        </div>
        <div class="result-context">${highlightMatch(result.context, query)}</div>
      </div>
    `;
  });
  
  resultsHTML += '</div>';
  
  // Add navigation controls if there are multiple results
  if (results.length > 0) {
    resultsHTML += `
      <div class="result-navigation">
        <div class="navigation-count">
          <span id="result-counter">Result 0 of ${results.length}</span>
        </div>
        <div class="navigation-buttons">
          <button id="nav-prev" class="nav-button" disabled>Previous</button>
          <button id="nav-next" class="nav-button nav-primary">Next</button>
        </div>
      </div>
    `;
  }
  
  resultsContainer.innerHTML = resultsHTML;
  
  // Add event listeners to result items
  document.querySelectorAll('.result-item').forEach(item => {
    const index = parseInt(item.getAttribute('data-index'));
    
    item.addEventListener('click', () => {
      const result = currentSearchResults[index];
      navigateToResult(result.elementId);
      updateResultNavigation(index);
    });
  });
  
  // Add event listeners to navigation buttons
  const prevButton = document.getElementById('nav-prev');
  const nextButton = document.getElementById('nav-next');
  
  if (prevButton && nextButton) {
    prevButton.addEventListener('click', () => {
      navigateToPreviousResult();
    });
    
    nextButton.addEventListener('click', () => {
      navigateToNextResult();
    });
    
    // Also add keyboard navigation
    document.removeEventListener('keydown', handleResultNavigation);
    document.addEventListener('keydown', handleResultNavigation);
  }
}

// Handle keyboard navigation between results
function handleResultNavigation(e) {
  // Only handle navigation if search results are shown
  if (currentSearchResults.length === 0 || !document.getElementById('result-counter')) return;
  
  // Navigate with keyboard shortcuts
  if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
    e.preventDefault();
    navigateToNextResult();
  } else if (e.shiftKey && (e.key === 'F3' || (e.ctrlKey && e.key === 'g'))) {
    e.preventDefault();
    navigateToPreviousResult();
  }
}

// Navigate to the next search result
function navigateToNextResult() {
  if (currentSearchResults.length === 0) return;
  
  const newIndex = currentResultIndex < currentSearchResults.length - 1 
    ? currentResultIndex + 1 
    : 0;
    
  const result = currentSearchResults[newIndex];
  navigateToResult(result.elementId);
  updateResultNavigation(newIndex);
}

// Navigate to the previous search result
function navigateToPreviousResult() {
  if (currentSearchResults.length === 0) return;
  
  const newIndex = currentResultIndex > 0 
    ? currentResultIndex - 1 
    : currentSearchResults.length - 1;
    
  const result = currentSearchResults[newIndex];
  navigateToResult(result.elementId);
  updateResultNavigation(newIndex);
}

// Update the result navigation UI
function updateResultNavigation(index) {
  currentResultIndex = parseInt(index);
  
  // Update counter display
  const counter = document.getElementById('result-counter');
  if (counter) {
    counter.textContent = `Result ${currentResultIndex + 1} of ${currentSearchResults.length}`;
  }
  
  // Update navigation buttons
  const prevButton = document.getElementById('nav-prev');
  const nextButton = document.getElementById('nav-next');
  
  if (prevButton) {
    prevButton.disabled = currentResultIndex <= 0;
  }
  
  if (nextButton) {
    nextButton.disabled = currentResultIndex >= currentSearchResults.length - 1;
  }
  
  // Highlight the selected result in the list
  document.querySelectorAll('.result-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  const selectedItem = document.querySelector(`.result-item[data-index="${currentResultIndex}"]`);
  if (selectedItem) {
    selectedItem.classList.add('selected');
    
    // Ensure the selected result is visible in the results container
    const resultsContainer = document.getElementById(RESULTS_CONTAINER_ID);
    if (resultsContainer) {
      if (selectedItem.offsetTop < resultsContainer.scrollTop) {
        resultsContainer.scrollTop = selectedItem.offsetTop - 10;
      } else if (selectedItem.offsetTop + selectedItem.offsetHeight > resultsContainer.scrollTop + resultsContainer.clientHeight) {
        resultsContainer.scrollTop = selectedItem.offsetTop + selectedItem.offsetHeight - resultsContainer.clientHeight + 10;
      }
    }
  }
}

// Navigate to a specific search result
function navigateToResult(elementId) {
  const element = findElementById(elementId);
  
  if (!element) {
    console.error(`Claude Chat Search: Could not find element with ID ${elementId}`);
    
    // Show error message in the results container
    const resultsContainer = document.getElementById(RESULTS_CONTAINER_ID);
    if (resultsContainer) {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'search-error';
      errorMsg.textContent = 'Could not navigate to result. The message may have been removed.';
      errorMsg.style.marginTop = '10px';
      
      // Remove the error message after 3 seconds
      setTimeout(() => {
        if (errorMsg.parentElement) {
          errorMsg.remove();
        }
      }, 3000);
      
      resultsContainer.appendChild(errorMsg);
    }
    return;
  }
  
  // Remove any existing highlights
  document.querySelectorAll('.search-highlight-active').forEach(el => {
    el.classList.remove('search-highlight-active');
  });
  
  // Ensure the element is visible and in view
  ensureElementIsVisible(element);
  
  // Highlight the element temporarily
  element.classList.add('search-highlight-active');
  
  // Scroll the element into view with a smooth animation
  scrollToElement(element);
  
  // Remove the highlight after 5 seconds
  setTimeout(() => {
    element.classList.remove('search-highlight-active');
  }, 5000);
}

// Helper function to find an element by ID, with fallbacks
function findElementById(elementId) {
  // Try direct ID lookup first
  let element = document.getElementById(elementId);
  if (element) return element;
  
  // If not found, try looking for data attributes that might contain the ID
  element = document.querySelector(`[data-element-id="${elementId}"]`);
  if (element) return element;
  
  // If the ID was one we generated (claude-search-msg-X)
  if (elementId.startsWith('claude-search-msg-')) {
    const parts = elementId.replace('claude-search-msg-', '').split('-');
    const index = parseInt(parts[0]);
    
    // Find message elements again
    const messageElements = findChatMessageElements();
    
    // If we have a valid index, try to find the element at that index
    if (!isNaN(index) && index >= 0 && index < messageElements.length) {
      return messageElements[index];
    }
  }
  
  // If all else fails, return null
  return null;
}

// Helper function to ensure the element is visible (expand collapsed sections, etc.)
function ensureElementIsVisible(element) {
  // Check if the element is in a collapsed container
  let parent = element.parentElement;
  while (parent) {
    // Common classes for collapsed containers
    if (parent.classList.contains('collapsed') || 
        getComputedStyle(parent).display === 'none' ||
        getComputedStyle(parent).visibility === 'hidden') {
      
      // Try to expand the container
      parent.classList.remove('collapsed');
      parent.style.display = '';
      parent.style.visibility = '';
      
      // If there's an expand button, try to click it
      const expandButton = parent.querySelector('.expand-button, .toggle-button, [aria-expanded="false"], button[aria-label*="expand"], button[aria-label*="show"]');
      if (expandButton) {
        expandButton.click();
      }
    }
    parent = parent.parentElement;
  }
}

// Scroll to element with enhanced behavior
function scrollToElement(element) {
  // First, ensure any parent scrollable containers are scrolled properly
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (getComputedStyle(parent).overflow === 'auto' || 
        getComputedStyle(parent).overflow === 'scroll' ||
        getComputedStyle(parent).overflowY === 'auto' || 
        getComputedStyle(parent).overflowY === 'scroll') {
      
      // Scroll the parent container to make the element visible
      parent.scrollTop = element.offsetTop - parent.offsetTop - (parent.clientHeight / 2);
    }
    parent = parent.parentElement;
  }
  
  // Then scroll the element into view with smooth behavior
  // Using a small delay to ensure any container animations are complete
  setTimeout(() => {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center'
    });
    
    // Apply a subtle animation to draw attention
    flashElement(element);
  }, 100);
}

// Add a subtle flash animation to draw attention to the element
function flashElement(element) {
  // Create and add a temporary flash effect
  const flash = document.createElement('div');
  flash.style.position = 'absolute';
  flash.style.top = '0';
  flash.style.left = '0';
  flash.style.right = '0';
  flash.style.bottom = '0';
  flash.style.backgroundColor = 'rgba(138, 63, 252, 0.2)';
  flash.style.borderRadius = '4px';
  flash.style.pointerEvents = 'none';
  flash.style.animation = 'flash-pulse 1s ease-out';
  
  // Add keyframe animation if it doesn't exist
  if (!document.getElementById('flash-keyframes')) {
    const style = document.createElement('style');
    style.id = 'flash-keyframes';
    style.textContent = `
      @keyframes flash-pulse {
        0% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Make the element position relative if it's not already
  const originalPosition = getComputedStyle(element).position;
  if (originalPosition === 'static') {
    element.style.position = 'relative';
  }
  
  // Add the flash effect
  element.appendChild(flash);
  
  // Remove it after animation completes
  setTimeout(() => {
    if (flash.parentElement) {
      flash.remove();
    }
    // Restore original position
    if (originalPosition === 'static') {
      element.style.position = '';
    }
  }, 1000);
}

// Add click outside handler to close search when clicking elsewhere
document.addEventListener('click', (event) => {
  const searchContainer = document.getElementById('claude-chat-search-container');
  const searchToggle = document.getElementById('claude-chat-search-toggle');
  
  if (searchContainer && 
      !searchContainer.contains(event.target) && 
      searchToggle && 
      !searchToggle.contains(event.target)) {
    // Clicked outside the search container and toggle button
    closeSearchPanel();
  }
});

// Initialize the extension
function init() {
  console.log("Claude Chat Search: Initializing extension");
  
  // Add search UI when the page loads
  createSearchUI();
  
  // Delay observation to make sure page is fully loaded
  setTimeout(() => {
    // Watch for navigation changes (SPA)
    const observer = new MutationObserver(mutations => {
      // If UI is removed after navigation, add it back
      if (!document.getElementById('claude-chat-search-toggle')) {
        console.log("Claude Chat Search: Reinstating search UI after navigation");
        createSearchUI();
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }, 1000);
}

// Start the extension - with a delay to ensure DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log("Claude Chat Search: DOM content loaded");
  setTimeout(init, 1000);
});

// Also try initializing after window load for SPAs
window.addEventListener('load', () => {
  console.log("Claude Chat Search: Window loaded");
  setTimeout(init, 1500);
});