window.onload = function () {
  let globalVars = {
    lengthOfResponse: 0,
    currentPageresponseId: null,
    sasionId: null,
  };

  let domNode = {
    responseString: window.location.href.includes("chatgpt")
      ? "[data-message-author-role='assistant']"
      : window.location.href.includes("deepseek")
      ? ".ds-markdown.ds-markdown--block"
      : "",

    questionString: window.location.href.includes("chatgpt")
      ? "[data-message-author-role='user']"
      : window.location.href.includes("deepseek")
      ? ".fbb737a4"
      : "",
    responseStopString: window.location.href.includes("chatgpt")
      ? "button[aria-label='Bad response']"
      : window.location.href.includes("deepseek")
      ? ".ds-flex._965abe9"
      : "",

    responseNode() {
      return document.querySelectorAll(this.responseString)[-1];
    },
    stopResponseNodeLength() {
      return document.querySelectorAll(this.responseStopString)?.length || 0;
    },
    lastNodeFinder(selector) {
      let nodeList = document.querySelectorAll(selector);
      return nodeList && nodeList?.length ? nodeList[nodeList.length - 1] : null;
    },
  };

  let eventList = {
    isCopilet() {
      return window.location.href.includes("copilot.microsoft");
    },

    mutationObserver() {
      const observer = new MutationObserver(async (mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type !== "childList") continue;

          const userNodes = [];
          let badResponseButtonDetected = false;

          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (
              node &&
              domNode.responseStopString &&
              node.matches?.(domNode.responseStopString)
            ) {
              badResponseButtonDetected = true;
            } else {
              if (!node || !domNode.responseStopString) return null;
              const buttons = node.querySelectorAll?.(
                domNode.responseStopString
              );
              if (buttons?.length) {
                badResponseButtonDetected = true;
              }
            }
          }
          if (badResponseButtonDetected) {
            globalVars.sasionId =
              this.extractSessionId(window.location.href) || null;
            let currDomNodelength = domNode.stopResponseNodeLength();
            let priviouseDomNode =
              (await getSetValues.getValue("responseLength")) || {};
            let prtDomLength = priviouseDomNode[globalVars.sasionId] || 0;
            if (currDomNodelength <= prtDomLength) return;
            let inputString2 =
              domNode.lastNodeFinder(domNode.responseString)?.textContent || "";
            let inputString1 =
              domNode.lastNodeFinder(domNode.questionString)?.textContent || "";
            if (!inputString1.length && !inputString2.length) return;

            let priviousarr =
              resolveChatResponse.decd(
                (await getSetValues.getValue("deepseekContent")) || "W10="
              ) || [];

            priviousarr = [
              ...priviousarr,
              {
                inputString1,
                inputString2,
                model: window.location.hostname || "",
                timeStamp: Date.now(),
                sasionId: globalVars.sasionId || "extension",
              },
            ];
            getSetValues
              .setValue(
                "deepseekContent",
                resolveChatResponse.encd(priviousarr)
              )
              .then(() => {
                priviouseDomNode[globalVars.sasionId] = currDomNodelength;
                getSetValues.setValue("responseLength", {
                  ...priviouseDomNode,
                });
              });
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    },

    extractSessionId(url) {
      if (typeof url !== "string") return null;

      const match = url.match(
        /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
      );

      if (match) {
        return match[1];
      }

      const parts = url.split("/").filter(Boolean);
      const last = parts[parts.length - 1];

      if (
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          last
        )
      ) {
        return last;
      }

      return null;
    },

    deleyfunc() {
      return new Promise((resolve) => {
        setTimeout(resolve, 1500);
      });
    },

    intialise() {
      getSetValues.getValue("responseLength").then((res) => {
        globalVars.lengthOfResponse = res?.responseLength || 0;
      });
    },
  };

  let getSetValues = {
    getValue(key) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (r) => {
          resolve(r[key] || null);
        });
      });
    },
    setValue(key, value) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve("value save");
          });
        } catch (e) {
          reject(e);
        }
      });
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
  };
  eventList.mutationObserver();
  eventList.intialise();
};
