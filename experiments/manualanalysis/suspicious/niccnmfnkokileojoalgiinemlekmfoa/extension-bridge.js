let iframeElement = document.getElementById('iframe-container');
let loadingElement = document.getElementById('loading');

iframeElement.onload = function() {
    loadingElement.style.display = 'none';
    iframeElement.style.display = 'block';

    iframeElement.contentWindow.postMessage({
        type: 'EXTENSION_READY',
        source: 'sonnet_ai'
    }, '*');
    
    console.log('Iframe loaded and EXTENSION_READY message sent');
};

window.addEventListener('message', function(event) {
    if (event.origin !== 'https://ext-access.pro' && event.origin !== 'https://ext-access.pro') {
        console.warn('Message received from unauthorized origin:', event.origin);
        return;
    }
    
    const message = event.data;

    if (!message || !message.type || message.source !== 'grok_iframe') {
        console.warn('Invalid message format:', message);
        return;
    }
    
    console.log('Message received from iframe:', message.type);

    switch (message.type) {
        case 'GET_USER_DATA':
            chrome.runtime.sendMessage({action: 'getUserData'}, function(response) {
                iframeElement.contentWindow.postMessage({
                    type: 'USER_DATA_RESPONSE',
                    source: 'sonnet_ai',
                    data: response.userData,
                    requestId: message.requestId
                }, event.origin);
            });
            break;
            
        case 'SET_USER_DATA':
            chrome.runtime.sendMessage({
                action: 'setUserData', 
                userData: message.data
            }, function(response) {
                iframeElement.contentWindow.postMessage({
                    type: 'SET_USER_DATA_RESPONSE',
                    source: 'sonnet_ai',
                    success: response.success,
                    requestId: message.requestId
                }, event.origin);
            });
            break;
            
        case 'GET_ACTIVE_TAB_INFO':
            chrome.runtime.sendMessage({action: 'getActiveTabInfo'}, function(response) {
                iframeElement.contentWindow.postMessage({
                    type: 'ACTIVE_TAB_INFO_RESPONSE',
                    source: 'sonnet_ai',
                    data: response,
                    requestId: message.requestId
                }, event.origin);
            });
            break;
            
        default:
            console.warn('Unknown message type:', message.type);
    }
});

function checkServerConnection() {
    return fetch('https://ext-access.pro/sonnet_ai/api/ping/', { method: 'GET' })
        .then(response => response.ok)
        .catch(() => false);
}

iframeElement.onerror = function() {
    console.error('Error loading iframe');
    showOfflineMode();
};

async function attemptReconnect() {
    loadingElement.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div class="spinner"></div>
            <p>Reconnecting...</p>
        </div>
    `;
    
    try {
        const isConnected = await checkServerConnection();
        if (isConnected) {
            loadingElement.style.display = 'none';
            iframeElement.src = 'https://ext-access.pro/sonnet_ai/';
            iframeElement.style.display = 'block';
        } else {
            showOfflineMode();
        }
    } catch (error) {
        console.error('Connection error:', error);
        showOfflineMode();
    }
}

function showOfflineMode() {
    loadingElement.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2>No connection to the server</h2>
            <p>You are currently offline. Some features may not be available..</p>
            <button id="retry-button">Retry connection</button>
            <div id="offline-chat" style="margin-top: 20px; text-align: left;">
                <h3>Chat history</h3>
                <div id="chat-history"></div>
            </div>
        </div>
    `;

    chrome.storage.local.get(['userData'], function(result) {
        const userData = result.userData || {};
        const chatHistory = userData.chatHistory || [];
        
        const chatHistoryElement = document.getElementById('chat-history');
        if (chatHistory.length === 0) {
            chatHistoryElement.innerHTML = '<p>History is empty</p>';
        } else {
            chatHistoryElement.innerHTML = chatHistory.map(chat => `
                <div style="margin-bottom: 10px; padding: 5px; border-bottom: 1px solid #eee;">
                    <p><strong>Вы:</strong> ${chat.message}</p>
                    <p><strong>Ответ:</strong> ${chat.response}</p>
                    <small>${new Date(chat.timestamp).toLocaleString()}</small>
                </div>
            `).join('');
        }
    });
    
    document.getElementById('retry-button').addEventListener('click', attemptReconnect);
}

window.addEventListener('load', async function() {
    console.log('Extension bridge loaded');
    try {
        const isConnected = await checkServerConnection();
        if (!isConnected) {
            console.warn('Server connection failed');
            showOfflineMode();
        } else {
            console.log('Server connection successful');
        }
    } catch (error) {
        console.error('Connection check error:', error);
        showOfflineMode();
    }
}); 