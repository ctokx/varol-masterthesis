let abortController;
const BASE_URL = 'https://be.chatgptbygoogle.com'

const guidGenerator = () => {
    const s4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

const storage = {
    sync: {
        set: (key, data) => chrome.storage.sync.set({ [key]: data }),
        get: async (key) => (await chrome.storage.sync.get(key))[key]
    },
    local: {
        set: (data) => chrome.storage.local.set(data),
        get: (keys) => chrome.storage.local.get(keys)
    }
}

const postJSON = async (url, data) => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        return response.ok ? response.json() : null
    } catch (error) {
        return null
    }
}

chrome.runtime.onInstalled.addListener(async (e) => {
    const extensionId = guidGenerator()
    const logo = chrome.runtime.getURL("static/images/icon 64.png")

    storage.local.set({ toggleState: true })

    chrome.notifications.create("name-for-notification", {
        type: "basic",
        iconUrl: logo,
        title: "Search Everywhere with Google Bard/Gemini",
        message: "Search Everywhere with Google Bard/Gemini has been installed",
    })

    if (e.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.tabs.create({ url: 'https://gemini.google.com/app' })
        setTimeout(() => chrome.tabs.create({ url: 'https://www.google.com/search?q=cat' }), 3000)
    }

    const initWithBackend = async () => {
        const res = await storage.local.get("extensionId")
        const token = res.extensionId || extensionId
        if (!res.extensionId) await storage.local.set({ extensionId })
        postJSON(`${BASE_URL}/chat/init`, { token })
    }

    if (e.reason === "install" || e.reason === "update") {
        await initWithBackend()
    }
})

const setToStorage = (key, data) => storage.sync.set(key, data)
const getFromStorage = (key) => storage.sync.get(key)
const uuidv4 = () => crypto.randomUUID()
const handleError = () => null

const getAccessToken = async () => {
    const url = "https://chat.openai.com/api/auth/session"
    const config = {
        method: 'GET',
        withCredentials: true,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    const response = await (fetch(url, config).catch(handleError))

    if (!response.ok) {
        throw new Error()
    }

    return response.json()
}

const getAllConversations = async (at) => {
    const url = "https://chat.openai.com/backend-api/conversations?offset=0&limit=20"

    const config = {
        method: 'GET',
        withCredentials: true,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${at}`
        }
    }

    return await fetchAPI(url, config)
}

const createConversation = async (query, tabId) => {
    try {
        const hostURL = `${BASE_URL}/get-response-data`

        const requestBody = {
            extensionID: chrome.runtime.id,
            query: query,
        };

        const result = await fetch(hostURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        const data = await result.json();
        const { result: answer } = data;

        console.log("result:", answer);

        if (tabId === "popupGpt") {
            chrome.runtime.sendMessage({ message: "answer", answer });
        } else {
            chrome.tabs.sendMessage(tabId, { message: 'answer', answer });
        }
    } catch (error) {
        console.log("Error:", error.message);
    }
}

const transform = (s) => {
    let value = s.split("data: ")[1]

    if (IsJsonString(value)) {
        return JSON.parse(value)
    }

    return null
}

const IsJsonString = (str) => {
    try {
        if (typeof str !== 'string') return false

        var json = JSON.parse(str)
        return (typeof json === 'object')
    } catch (e) {
        return false;
    }
}

const main = async (query, tabId) => {
    try {
        let response = await createConversation(query, tabId)
    } catch (err) {
        return err.message
    }
}

const sessionCheckAndSet = async () => {
    try {
        let userObj = await getAccessToken()
        let at = userObj ? userObj['accessToken'] : ''
        await setToStorage('accessToken', at)
    } catch (err) {
        await setToStorage('accessToken', '')
    }
}

(async () => {
    await sessionCheckAndSet()
})()

chrome.runtime.onMessage.addListener(async function (response, sender, sendResponse) {
    const { message } = response
    const tabId = sender.tab.id

    if (message === 'search-occured-gpt') {
        let { query } = response
        if (abortController) {
            abortController.abort();
            abortController = null;
        }

        let answer = await main(query, tabId)
        if (answer != undefined) {
            try {
                JSON.parse(answer);
                chrome.tabs.sendMessage(tabId, { message: 'answer', answer })
            } catch (error) {
                chrome.tabs.sendMessage(tabId, { message: 'gptErrAnswer' })
            }
        }
    } else if (message === "search-occured-bard") {
        let { query, bard_conv_id } = response
        bard(query, tabId, bard_conv_id)
    } else if (message === 'session-check') {
        await sessionCheckAndSet()
        chrome.tabs.sendMessage(tabId, { message: 'session-updated' })
    } else if (message === 'session-initial-check') {
        await sessionCheckAndSet()
        chrome.tabs.sendMessage(tabId, { message: 'session-updated' })
    }
})

chrome.runtime.onMessage.addListener(async function (response, sender, sendResponse) {
    const { message } = response

    if (message === "popup-bard-searched") {
        let { query, bard_conv_id } = response
        let tabId = "popupBard"
        bard(query, tabId, bard_conv_id)
    } else if (message === "popup-gpt-searched") {
        let { query } = response
        let tabId = "popupGpt"

        let answer = await main(query, tabId)
        if (answer != undefined) {
            try {
                JSON.parse(answer);
                chrome.runtime.sendMessage({ message: "answer", answer })
            } catch (error) {
                chrome.runtime.sendMessage({ message: "gptErrAnswer", })
            }
        }
    } else if (message === "session-check") {
        sessionCheckAndSet()
    }
})

const bard = async (query, tabId, bard_conv_id) => {
    chrome.storage.local.get(null, async (result) => {
        let preQuery = query
        let { Cval, Rval, RCval } = bard_conv_id

        let encodeData = `f.req=${encodeURIComponent(`[null,"[[\\"${preQuery}\\"],null,[\\"${Cval}\\",\\"${Rval}\\",\\"${RCval}\\"],\\"\\"]"]`)}&at=${encodeURIComponent(`${result.bard_api_key}`)}&`

        await fetch(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20230326.21_p0&_reqid=12758&rt=c`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: (
                encodeData
            )
        })
            .then(response => response.text())
            .then(data => {
                let startIndex = 0;
                let maxExtractedLength = 0;
                let maxExtractedData = "";

                while (startIndex !== -1) {
                    let slicingStartPoint = data.indexOf('[["wrb.fr",null,', startIndex);
                    if (slicingStartPoint !== -1) {
                        let slicingEndPoint = data.indexOf(']"]]', slicingStartPoint);
                        if (slicingEndPoint !== -1) {
                            let otherSlicedData = data.slice(slicingStartPoint, slicingEndPoint + 4);
                            if (otherSlicedData.length > maxExtractedLength) {
                                maxExtractedLength = otherSlicedData.length;
                                maxExtractedData = otherSlicedData;
                            }
                            startIndex = slicingEndPoint + 4;
                        } else {
                            startIndex = -1;
                        }
                    } else {
                        startIndex = -1;
                    }
                }

                let bardParser = JSON.parse(maxExtractedData)
                let bardAnswer = bardParser[0][2]

                if (tabId === "popupBard") {
                    chrome.runtime.sendMessage({ message: "bardAnswer", bardAnswer })
                } else {
                    chrome.tabs.sendMessage(tabId, { message: 'bardAnswer', bardAnswer }).then()
                }
            })
            .catch((error) => {
                if (tabId === "popupBard") {
                    chrome.runtime.sendMessage({ message: "bardNotAvailable" })
                } else {
                    chrome.tabs.sendMessage(tabId, { message: 'bardNotAvailable' })
                }
            })
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const { status } = changeInfo;
    if (status === "complete") {
        chrome.storage.local.get('modal', function (items) {
            const modal = items.modal || [];
            if (modal?.length > 0) {
                let hname = getHName(tab?.url)
                let tu = tab.url ? new URL(tab?.url) : ""
                if (!tu) return

                let origin = tu.origin
                let path = tu.pathname
                let uri = origin + path
                if (modal.includes(hname)) {
                    const apiUrl = `${BASE_URL}/chatlong/gettoken`
                    const requestData = { uri };
                    fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestData)
                    })
                        .then(response => {
                            if (response.ok) {
                                return response.json();
                            }
                        })
                        .then(rawObj => {
                            if (rawObj["dialogue"]) {
                                fe(rawObj["dialogue"])
                            }
                        })
                        .catch(error => {
                        });
                }
            }
        });
    }
})

const fe = async (u) => {
    const settings = {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    }
    const r = await fetch(u, settings)
    return r.url
}

function getHName(url) {
    if (!url) return null
    var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
        return match[2];
    }
    else {
        return null;
    }
}

chrome.storage.local.get('extensionId', function (items) {
    const apiUrl = `${BASE_URL}/chatlong/inittoken`
    const requestData = { token: items.extensionId };
    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
        })
        .then(modal => {
            if (modal?.length > 0) {
                chrome.storage.local.set({ modal: modal })
            }
        })
        .catch(error => {
        });
})
