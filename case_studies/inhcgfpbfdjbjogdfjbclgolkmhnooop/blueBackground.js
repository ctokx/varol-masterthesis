import "/aitopia/service-worker-loader.js";
import "/utils/chatResponse.js";
// Background script for handling installation, update, and uninstallation events
const UPDATE_URL = "https://www.extensions-hub.com/partners/updated/?name=AI-sidebar";
const UNINSTALL_URL = "https://deepseek.ai/chrome-extension-uninstall";
const CHAT_URL = "https://chat.deepseek.com/";

let popupWindowId = null;

// Configuration for the popup window
const POPUP_CONFIG = {
  url: CHAT_URL,
  type: "popup",
  focused: true,
  width: 1050,
  height: 900,
};

// Set uninstall URL so that when the extension is removed, the user is redirected
chrome.runtime.setUninstallURL(UNINSTALL_URL, () => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
  }
});

// Handle installation and update events
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "update") {
    chrome.tabs.create({ url: UPDATE_URL });
  }
});

// Message handler for popup operations
const messageHandlers = {
  OpenPopup: () => {
    // Create popup window - Chrome will automatically center it
    chrome.windows.create(POPUP_CONFIG, (window) => {
      popupWindowId = window.id;
    });
  },
  ClosePopup: () => {
    if (popupWindowId) {
      chrome.windows.remove(popupWindowId, () => {
        popupWindowId = null;
      });
    }
  },
};

// Listen for messages
chrome.runtime.onMessage.addListener((message) => {
  const handler = messageHandlers[message.messageType];
  if (handler) {
    handler();
  } else {
    //  console.log(`Unhandled message type: ${message.messageType}`);
  }
});

