const UNINSTALL_URL = "https://ext-access.pro/claude_ai/uninstall/deepseek_r1/";
chrome.runtime.setUninstallURL(UNINSTALL_URL);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({
      url: "https://ext-access.pro/claude_ai/welcome/1-claude-3-5-sonnet/",
    });
  }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'getActiveTabInfo') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                sendResponse({
                    success: true,
                    tabId: tabs[0].id,
                    url: tabs[0].url,
                    title: tabs[0].title
                });
            } else {
                sendResponse({success: false, error: 'Active tab not found'});
            }
        });
        return true;
    } else if (request.action === 'openSidePanel') {
        chrome.sidePanel.open({tabId: sender.tab.id});
        sendResponse({success: true});
    } else if (request.action === 'closeSidePanel') {
        chrome.sidePanel.close({tabId: sender.tab.id});
        sendResponse({success: true});
    } else if (request.action === 'getUserData') {
        chrome.storage.local.get(['userData'], function(result) {
            sendResponse({
                success: true,
                userData: result.userData || {}
            });
        });
        return true;
    } else if (request.action === 'setUserData') {
        chrome.storage.local.set({userData: request.userData}, function() {
            sendResponse({success: true});
        });
        return true;
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({tabId: tab.id});
});

chrome.sidePanel
  .setPanelBehavior({openPanelOnActionClick: true})
  .catch((error) => console.error('Error setting side panel behavior:', error)); 