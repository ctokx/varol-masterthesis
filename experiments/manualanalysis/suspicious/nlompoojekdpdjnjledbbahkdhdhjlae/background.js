// Background script for Claude Chat Search extension

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "searchAllChats") {
    searchAcrossAllChats(request.query, request.currentChatId)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Function to search across all chats
async function searchAcrossAllChats(query, currentChatId) {
  // Store the current tab so we can return to it
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const results = [];
  
  try {
    // Navigate to the chats list page
    const chatsListTab = await chrome.tabs.create({ 
      url: 'https://claude.ai/chats',
      active: false
    });
    
    // Wait for the page to load with a more reliable approach
    await waitForPageLoad(chatsListTab.id);
    
    // Execute script to get all chat URLs and titles
    const chatsData = await chrome.scripting.executeScript({
      target: { tabId: chatsListTab.id },
      func: getChatUrlsAndTitles
    });
    
    // Get unique list of chat data
    const chats = chatsData[0].result;
    
    // Skip the current chat if provided
    const filteredChats = chats.filter(chat => chat.id !== currentChatId);
    
    // Visit each chat and search for the query
    for (const chat of filteredChats) {
      // Update the tab to navigate to this chat
      await chrome.tabs.update(chatsListTab.id, { url: chat.url });
      
      // Wait for the page to load
      await waitForPageLoad(chatsListTab.id);
      
      // Search within this chat
      const chatResults = await chrome.scripting.executeScript({
        target: { tabId: chatsListTab.id },
        func: searchInPage,
        args: [query, chat]
      });
      
      // Add results to our collection
      if (chatResults[0].result && chatResults[0].result.length > 0) {
        results.push(...chatResults[0].result);
      }
    }
    
    // Close the temporary tab
    await chrome.tabs.remove(chatsListTab.id);
    
    // Return to the original tab
    await chrome.tabs.update(currentTab.id, { active: true });
    
    return results;
  } catch (error) {
    console.error('Error searching all chats:', error);
    
    // Make sure to clean up if there's an error
    try {
      const [tempTab] = await chrome.tabs.query({ url: 'https://claude.ai/chats*', currentWindow: true });
      if (tempTab && tempTab.id !== currentTab.id) {
        await chrome.tabs.remove(tempTab.id);
      }
      
      // Make sure we return to the original tab
      await chrome.tabs.update(currentTab.id, { active: true });
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
    
    throw error;
  }
}

// Function to wait for a page to load properly
function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    // First, wait for basic load
    setTimeout(() => {
      // Then check if the page has messages or chat links
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Check for chat links or messages
          const hasContent = 
            document.querySelectorAll('a[href^="/chat/"]').length > 0 ||
            document.querySelectorAll('.message-container, .human-message, .assistant-message').length > 0;
          return hasContent;
        }
      }).then(result => {
        if (result[0].result) {
          resolve(); // Page is loaded with content
        } else {
          // Wait a bit longer and resolve anyway
          setTimeout(resolve, 1000);
        }
      }).catch(() => {
        // If scripting fails, just resolve after timeout
        setTimeout(resolve, 1000);
      });
    }, 1500);
  });
}

// Function to get all chat URLs and titles from the chats list page
function getChatUrlsAndTitles() {
  const chatLinks = Array.from(document.querySelectorAll('a[href^="/chat/"]'));
  
  return chatLinks.map(link => {
    const url = 'https://claude.ai' + link.getAttribute('href');
    const id = link.getAttribute('href').split('/').pop();
    
    // Try to get the title from different possible elements
    let title = 'Untitled Chat';
    
    // Try different selectors that might contain the chat title
    const titleElement = 
      link.querySelector('.chat-title') || 
      link.querySelector('h3') || 
      link.querySelector('span');
    
    if (titleElement) {
      title = titleElement.textContent.trim();
    }
    
    return { url, id, title };
  });
}

// Function to search within a single chat page
function searchInPage(query, chat) {
  const results = [];
  const lowercaseQuery = query.toLowerCase();
  
  // Get all message containers
  const selectors = [
    '.message-container',
    '.human-message, .assistant-message',
    '[data-message-author-role]',
    '.chat-message, .message, .message-wrapper'
  ];
  
  // Try each selector until we find messages
  let messageContainers = [];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      messageContainers = Array.from(elements);
      break;
    }
  }
  
  messageContainers.forEach((container, index) => {
    const text = container.textContent;
    const lowercaseText = text.toLowerCase();
    
    // Determine if human or assistant message
    let isHuman = false;
    if (container.classList.contains('human-message')) {
      isHuman = true;
    } else if (container.hasAttribute('data-message-author-role')) {
      isHuman = container.getAttribute('data-message-author-role') === 'human';
    } else if (container.textContent.length < 100) {
      // Heuristic: shorter messages are more likely to be from humans
      isHuman = true;
    } else {
      // Look for indicators in parent elements
      const parent = container.parentElement;
      if (parent && (
        parent.classList.contains('human') || 
        parent.classList.contains('user') || 
        parent.getAttribute('data-author') === 'human'
      )) {
        isHuman = true;
      }
    }
    
    const role = isHuman ? 'You' : 'Claude';
    
    if (lowercaseText.includes(lowercaseQuery)) {
      // Extract context around the match
      const matchIndex = lowercaseText.indexOf(lowercaseQuery);
      const contextStart = Math.max(0, matchIndex - 40);
      const contextEnd = Math.min(text.length, matchIndex + query.length + 40);
      let context = text.substring(contextStart, contextEnd);
      
      // Add ellipsis if we cut off text
      if (contextStart > 0) context = '...' + context;
      if (contextEnd < text.length) context += '...';
      
      results.push({
        chatId: chat.id,
        chatTitle: chat.title,
        role,
        context,
        messageIndex: index,
        messageNumber: index + 1
      });
    }
  });
  
  return results;
}