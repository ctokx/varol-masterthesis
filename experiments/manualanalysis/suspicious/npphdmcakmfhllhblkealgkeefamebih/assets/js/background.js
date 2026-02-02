if( typeof chrome.sidePanel === 'undefined'){
    chrome.action.onClicked.addListener(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
    });
} else{
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
}

let sidePanelPort = null;
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "sidePanel") {
        sidePanelPort = port;
        console.log('background.js: sidePanel port connected', port);
        
        // add disconnect listener to reconnect port
        port.onDisconnect.addListener(() => {
            console.log('background.js: sidePanel port disconnected');
            sidePanelPort = null;

            // check and reconnect port
            setTimeout(() => {
                if (!sidePanelPort) {
                    console.log('background.js: Reconnecting sidePanel port');
                    chrome.runtime.connect({ name: "sidePanel" });
                }
            }, 1000);
        });
    }
});

// =============================================
// Voice Permission Popup
// =============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Open voice permission popup (minimal - just to trigger system dialog)
    if (message.action === 'openVoicePermissionPopup') {
        console.log('background.js: Opening voice permission popup');
        
        const popupUrl = chrome.runtime.getURL('assets/js/voice-permission.html');
        
        // Get current window to position popup on the right side
        chrome.windows.getCurrent((currentWindow) => {
            const popupWidth = 1;
            const popupHeight = 1;
            // Position at top-right corner of the browser window
            const left = currentWindow.left + currentWindow.width - popupWidth - 400; // 400px from right edge (approx side panel width)
            const top = currentWindow.top + 100;
            
            chrome.windows.create({
                url: popupUrl,
                type: 'popup',
                width: popupWidth,
                height: popupHeight,
                left: left,
                top: top,
                focused: true
            }, (window) => {
                console.log('background.js: Voice permission popup opened', window);
            });
        });
        
        return true;
    }
    
    // Permission granted - forward to side panel
    if (message.action === 'voicePermissionGranted') {
        console.log('background.js: Voice permission granted');
        
        if (sidePanelPort) {
            sidePanelPort.postMessage({
                action: 'voicePermissionGranted'
            });
        }
        
        sendResponse({ success: true });
        return true;
    }
    
    // Permission denied - forward to side panel
    if (message.action === 'voicePermissionDenied') {
        console.log('background.js: Voice permission denied');
        
        if (sidePanelPort) {
            sidePanelPort.postMessage({
                action: 'voicePermissionDenied'
            });
        }
        
        sendResponse({ success: true });
        return true;
    }
    
    return false;
});

// open side panel by event
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'openSidePanel')
        return false;

    console.log('background.js->openSidePanel');   

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        console.log('background.js->openSidePanel->tabId', tabId);

        if (typeof chrome.sidePanel === 'undefined') {
            chrome.runtime.sendMessage({ action: 'sidePanelUndefined' });
        }

        // then open the side panel for this tab
        chrome.sidePanel
            .open({ tabId: tabId })
            .then(() => { isPanelOpen = true })
            .catch((error) => {
                console.error("Error from sidebtn:", error);
            });

    });
});




setInstallUrl();
setUninstallUrl();

function setInstallUrl() {
    chrome.runtime.onInstalled.addListener(async (details) => {
        if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
            const userId = await getUserId(true);
            
            let url = new URL(`https://aiagent.gallery/welcome_gpt.html`);
            
            // if( `deepseek_ai` === 'deepseek_ai' ){
                // url = new URL(chrome.runtime.getURL('welcome.html'));
            // }

            chrome.tabs.create({ url: url.toString() });

        }
    });
}
async function setUninstallUrl() {
    setTimeout(async ()=>{
        const userId = await getUserId(false);
        const url = new URL(`https://aiagent.gallery/uninstall_gpt.html`);
        url.searchParams.set("user_id", userId);

        chrome.runtime.setUninstallURL(url.toString());

    }, 2000);
}

function getUserId(generateIfMissing = true) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['user_id'], (result) => {
            if (result.user_id) {
                resolve(result.user_id);
            } else if (generateIfMissing) {
                createDeviceIdFromBackground().then(resolve);
            } else {
                resolve('none'); // or null / undefined
            }
        });
    });
}

function createDeviceIdFromBackground() {
    return new Promise(async (resolve) => {
        const deviceId = `device_back_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
        chrome.storage.sync.set({ user_id: deviceId }, () => {
            console.log("background.js->createDeviceIdFromBackground(): created and saved user_id:", deviceId);
            resolve(deviceId);
        });

        try {
            const country = await getCountry();

            const response = await fetch("https://hub.malson.eu/api/users/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: deviceId,
                    country: country,
                    version: '1.35',
                    product: 'deepseek_ai' || 'null'
                })
            });

            if (!response.ok) {
                console.warn("createDeviceIdFromBackground(): server error", await response.text());
            } else {
                console.log("createDeviceIdFromBackground(): user registered on server");
            }
        } catch (error) {
            console.error("createDeviceIdFromBackground(): network error", error);
        }



    });
}

async function getCountry() {
    try {
        const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const text = await res.text();
        const parsed = Object.fromEntries(
            text.trim().split('\n').map(line => line.split('='))
        );
        console.log(`getCountry(): country is ${parsed.loc}`, parsed);
        return parsed.loc;
    } catch (err) {
        console.error("getCountry(): error while fetching country", err);
        return "null";
    }
}




addContextMenu();

function addContextMenu(){
    console.log('background.js->addContextMenu(): init');

    chrome.permissions.contains({ permissions: ['contextMenus'] }, (granted) => {
        if (!granted) {
            console.log('background.js->addContextMenu(): permission not granted for contextMenus');
            return;
        }

        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: "deepseek_ai_send",
                title: "Send to chat",
                contexts: ["selection"]
            });
            chrome.contextMenus.create({
                id: "deepseek_ai_translate",
                title: "Translate",
                contexts: ["selection"]
            });
            console.log('background.js->addContextMenu(): contextMenus created');
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
           
            if (info.menuItemId === "deepseek_ai_send"){
                chrome.sidePanel.open({ tabId: tab.id }).then(() => {
                    console.log('background.js->addContextMenu(): sidePanel opened', sidePanelPort);
                    
                    setTimeout(()=>{
                        if (sidePanelPort) {
                            sidePanelPort.postMessage({
                                action: "sendTextToChat",
                                text: info.selectionText
                            });
                        }
                    }, 1000);
                })  
            }

            if (info.menuItemId === "deepseek_ai_translate"){
                chrome.sidePanel.open({ tabId: tab.id }).then(() => {
                    console.log('background.js->addContextMenu(): sidePanel opened', sidePanelPort);
                    
                    setTimeout(()=>{
                        if (sidePanelPort) {
                            sidePanelPort.postMessage({
                                action: "sendTextToChatAndTranslate",
                                text: info.selectionText
                            });
                        }
                    }, 1000);
                })  
            }

            

            
        });
    });
        
}



addSummarize();

function addSummarize(){
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getCurrentTabContent"){

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0].id;
                const tab = tabs[0];

                if (!tab.url) {
                    console.log('background.js->addSummarize(): tab URL is missing');
                    return sendResponse({ success: false, error: "havenot_permissions" });
                }
                
                if (!isInjectableUrl(tab.url)) {
                    console.log('background.js->addSummarize(): non-injectable URL detected');
                    return sendResponse({ success: false, error: "not_injectable" });
                }

                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        function extractTitleAndContent(doc){
                            const title = doc.title;
                            const content = doc.body.innerText;
                            return [title, content];
                        }
                        return extractTitleAndContent(document);
                    }
                }, (results) => {
                    if (!results || !results[0]) {
                        console.log('background.js->getCurrentTabContent: no results found');
                        return sendResponse({ success: false, error: "just_error" });
                    }
                    
                    const [title, content] = results[0].result;

                    console.log('background.js->getCurrentTabContent: worked, title', title);
                    return sendResponse({ success: true, title: title, content: content });
        
                });
            });

            return true;
        }
    });
}

function __addSummarize(){
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "getCurrentTabContent"){

            if (!sidePanelPort) {
                console.error('background.js->addSummarize(): sidePanelPort is not available');
                sendResponse({ success: false, error: "side_panel_port_unavailable" });
                return;
            }

            console.log('background.js->addSummarize(): init');

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0].id;
                const tab = tabs[0];

                if (!tab.url) {
                    console.log('background.js->addSummarize(): tab URL is missing');
                    if (sidePanelPort) {
                        sidePanelPort.postMessage({
                            action: "sendCurrentTabContent",
                            result: false,
                            error: "havenot_permissions"
                        });
                    }
                    return sendResponse({ success: false, error: "havenot_permissions" });
                }
                
                if (!isInjectableUrl(tab.url)) {
                    console.log('background.js->addSummarize(): non-injectable URL detected');
                    if (sidePanelPort) {
                        sidePanelPort.postMessage({
                            action: "sendCurrentTabContent",
                            result: false,
                            error: "not_injectable"
                        });
                    }
                    return sendResponse({ success: false, error: "not_injectable" });
                }

                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        function extractTitleAndContent(doc){
                            const title = doc.title;
                            const content = doc.body.innerText;
                            return [title, content];
                        }
                        return extractTitleAndContent(document);
                    }
                }, (results) => {
                    if (!results || !results[0]) {
                        console.log('background.js->getCurrentTabContent: no results found');
                        if (sidePanelPort) {
                            sidePanelPort.postMessage({
                                action: "sendCurrentTabContent",
                                result: false,
                                error: "just_error"
                            });
                        }
                        return sendResponse({ success: false, error: "just_error" });
                    }
                    
                    const [title, content] = results[0].result;

                    console.log('background.js->getCurrentTabContent: worked, title', title, sidePanelPort);
                    
                    if (sidePanelPort && results && results[0]) {
                        if (sidePanelPort) {
                            sidePanelPort.postMessage({
                                action: "sendCurrentTabContent",
                                result: true,
                                title: title,
                                content: content
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.log('background.js->getCurrentTabContent: error', chrome.runtime.lastError);
                                } else {
                                    console.log('background.js->getCurrentTabContent: success', response);
                                }
                            });
                        }
                    }
        
                });
            });

            return sendResponse({ success: true });

        }

      });
}



/**
 * Is the url suitable for working with the extension
 * - filters system pages not available for extensions
 * @param url
 * @returns {boolean}
 */
function isInjectableUrl(url) {
    if (!url) return false;

    const blockedProtocols = [
        'chrome:',
        'edge:',
        'about:',
        'devtools:',
        'chrome-extension:',
        'chrome-error:',
        'moz-extension:',
        'view-source:',
        'data:',
        'file:',
    ];

    // Chrome Web Store blocks scripts from extensions
    const blockedHosts = [
        'chrome.google.com',
    ];

    console.log(`background.js->isInjectableUrl: url`, url);

    if( url.includes('https://chromewebstore.google.com'))
        return false;


    try {
        const parsedUrl = new URL(url);
        if (blockedProtocols.some(proto => url.startsWith(proto))) return false;
        if (blockedHosts.includes(parsedUrl.hostname)) return false;
    } catch (e) {
        console.warn("Invalid URL passed to isInjectableUrl:", url);
        return false;
    }

    return true;
}


