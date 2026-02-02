let globlChatVars2 = {
  chatbtnAllow: function () {
    return document.getElementById("crsb-agree2");
  },
  chatbtmdecline: function () {
    return document.getElementById("crsb-decline");
  },
  impactHero: function () {
    return document.getElementById("impacthero-modal");
  },
};

let AllEvents = {
  clickpositive: function (node, event) {
    node.addEventListener(event, (e) => {
      this.handleEvent(e);
    });
  },

  handleEvent(e) {
    let popupNode = globlChatVars2.impactHero();
    if (e.target.id === "crsb-agree2") {
      popupNode.classList.add("hide");
      msgPassing.sendMassage("OpenPopupclick", null);
    } else if (e.target.id === "crsb-decline") {
      popupNode.classList.add("hide");
      msgPassing.sendMassage("ClosePopupclick", null);
    }
  },
  async intialFunc() {
    let impactHero = globlChatVars2.impactHero();
    let flag = (await chatSaverHelper.saveChatQuetions("chatFlag")) || false;
    flag && impactHero.classList.add("hide");
  },
};

let msgPassing = {
  sendMassage: function (messageType, body, callback = (res) => {}) {
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
  },

  onMessage: function (callback) {
    chrome.runtime.onMessage.addListener(callback);
  },

  hadleMessage: function (response, sender, sendResponse) {
    if (response.messageType === "OpenPopupclick") {
      sendResponse("msg recive");
    } else if (response.messageType === "ClosePopupclick") {
      sendResponse("msg recive");
    } else {
    }
  },
};

let chatSaverHelper = {
  saveChatQuetions: function (key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get([key], function (result) {
          resolve(result[key] || null);
        });
      } catch (e) {
        reject(e);
      }
    });
  },
  saveChatAnswer: function (key, answer) {
    return new Promise(async (resolve, reject) => {
      try {
        chrome.storage.local.set({ [key]: answer }, function () {
          resolve(true);
        });
      } catch (e) {
        reject(e);
      }
    });
  },
  removeAllChats: function () {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(
        ["saveChatAnswer", "deepseekContent"],
        function () {
          resolve(true);
        }
      );
    });
  },
};

msgPassing.onMessage(msgPassing.hadleMessage);
AllEvents.clickpositive(globlChatVars2.chatbtnAllow(), "click");
AllEvents.clickpositive(globlChatVars2.chatbtmdecline(), "click");
AllEvents.intialFunc();
