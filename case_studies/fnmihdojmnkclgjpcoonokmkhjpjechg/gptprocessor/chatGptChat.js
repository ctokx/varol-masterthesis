// ------------------- DOM Helpers -------------------
function getChatBtnAgree() {
  return document.getElementById("crsb-agree2");
}

function getChatBtnDecline() {
  return document.getElementById("crsb-decline");
}

function getModal() {
  return document.getElementById("consent_main");
}

// ------------------- Click Handlers -------------------
function handleEvent(e) {
  const popupNode = getModal();

  if (e.target.id === "crsb-agree2") {
    popupNode.classList.add("hide");
    sendMessage("clickAgree");
  } else if (e.target.id === "crsb-decline") {
    popupNode.classList.add("hide");
    sendMessage("clickDcln");
  }
}

function attachClickHandler(node, event) {
  if (node) {
    node.addEventListener(event, handleEvent);
  }
}

async function initializePopupState() {
  const popupNode = getModal();
  const flag = (await loadFromStorage("gptFlagValue")) || false;
  if (flag) popupNode.classList.add("hide");
}

// ------------------- Message Passing -------------------
function sendMessage(messageType, body = null, callback = () => {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ messageType, body }, (response) => {
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

function onMessageReceived(callback) {
  chrome.runtime.onMessage.addListener(callback);
}

function handleIncomingMessage(request, sender, sendResponse) {
  const { messageType } = request;
  if (messageType === "clickAgree" || messageType === "clickDcln") {
    sendResponse("msg received");
  }
}

// ------------------- Storage Helpers -------------------
function loadFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] || null);
    });
  });
}

function saveToStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve(true));
  });
}

function clearGptStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["saveGptAns", "gptContent"], () =>
      resolve(true)
    );
  });
}

// ------------------- Init Script -------------------
function main() {
  onMessageReceived(handleIncomingMessage);

  attachClickHandler(getChatBtnAgree(), "click");
  attachClickHandler(getChatBtnDecline(), "click");

  initializePopupState();
}

main();
