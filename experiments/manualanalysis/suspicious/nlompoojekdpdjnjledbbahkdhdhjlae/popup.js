// Popup script for Claude Search & Assistant extension

document.addEventListener('DOMContentLoaded', async () => {
  await checkStatus();
  
  // Check if we're on a Claude page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url.includes('claude.ai')) {
    document.getElementById('status').innerHTML = 'Navigate to claude.ai to use this extension';
    document.getElementById('status').className = 'status setup';
  }
});

async function checkStatus() {
  try {
    // Check if OpenAI key is configured
    const result = await chrome.storage.sync.get(['openaiKey']);
    const statusEl = document.getElementById('status');
    
    if (result.openaiKey && result.openaiKey.startsWith('sk-')) {
      statusEl.textContent = 'Ready! AI features are enabled';
      statusEl.className = 'status ready';
    } else {
      statusEl.textContent = 'Configure your OpenAI API key in settings to enable AI features';
      statusEl.className = 'status setup';
    }
  } catch (error) {
    console.error('Error checking status:', error);
    document.getElementById('status').textContent = 'Error loading status';
  }
}