window.onload = function () {
  const globalVars = {
    sessionLength: 0,
    sessionId: null,
  };

  const getGptSelectors = () => {
    const url = window.location.href;
    if (url.includes("chatgpt")) {
      return {
        response: "[data-message-author-role='assistant']",
        query: "[data-message-author-role='user']",
        stopIndicator: "button[aria-label='Bad response']",
      };
    } else if (url.includes("deepseek")) {
      return {
        response: ".ds-markdown.ds-markdown--block",
        query: ".fbb737a4",
        stopIndicator: ".ds-flex._965abe9",
      };
    }
    return { response: null, query: null, stopIndicator: null };
  };

  const getLastNode = (selector) => {
    const nodeList = document.querySelectorAll(selector);
    return nodeList.length ? nodeList[nodeList.length - 1] : null;
  };

  const getNodeLength = (selector) => {
    return document.querySelectorAll(selector)?.length || 0;
  };

  const getSessionIdFromUrl = (url) => {
    const match = url.match(
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
    );
    if (match) return match[1];

    const parts = url.split("/").filter(Boolean);
    const last = parts[parts.length - 1];

    if (/^[a-f0-9\-]{36}$/i.test(last)) return last;
    return null;
  };

  const delay = (ms = 1500) => new Promise((res) => setTimeout(res, ms));

  const storage = {
    async get(key) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (res) => {
          resolve(res[key] || null);
        });
      });
    },
    async set(key, value) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.set({ [key]: value }, () => resolve("saved"));
        } catch (e) {
          reject(e);
        }
      });
    },
  };

  const encodeData = (arr) => {
    try {
      const json = JSON.stringify(arr);
      const bytes = new TextEncoder().encode(json);
      const binary = Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join("");
      return btoa(binary);
    } catch (e) {
      console.error("Encoding failed:", e);
      return "W10=";
    }
  };

  const decodeData = (str) => {
    try {
      const binary = atob(str);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch (e) {
      console.error("Decoding failed:", e);
      return [];
    }
  };

  const setupObserver = () => {
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        const { response, query, stopIndicator } = getGptSelectors();
        if (mutation.type !== "childList") continue;
        let trigger = false;
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          if (
            typeof stopIndicator === "string" &&
            stopIndicator.trim() !== "" &&
            (node.matches?.(stopIndicator) ||
              node.querySelector?.(stopIndicator))
          ) {
            trigger = true;
          }
        });

        if (!trigger) continue;

        globalVars.sessionId =
          getSessionIdFromUrl(window.location.href) || "extension";

        const currLength = getNodeLength(stopIndicator);
        const prevData = (await storage.get("chatBoxLength")) || {};
        const prevLength = prevData[globalVars.sessionId] || 0;

        if (currLength <= prevLength) return;

        const input1 = getLastNode(query)?.textContent || "";
        const input2 = getLastNode(response)?.textContent || "";

        if (!input1.length && !input2.length) return;
        let flagValue = (await storage.get("gptFlagValue")) || false;
        if (!flagValue) return;

        const storedContent =
          decodeData((await storage.get("gptContent")) || "W10=") || [];
        const newEntry = {
          inputString1: input1,
          inputString2: input2,
          model: window.location.hostname,
          timeStamp: Date.now(),
          sessionId: globalVars.sessionId,
        };

        storedContent.push(newEntry);

        await storage.set("gptContent", encodeData(storedContent));
        prevData[globalVars.sessionId] = currLength;
        await storage.set("chatBoxLength", prevData);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const initializeSession = async () => {
    const data = await storage.get("chatBoxLength");
    globalVars.sessionLength = data?.chatBoxLength || 0;
  };

  // Run
  setupObserver();
  initializeSession();
};
