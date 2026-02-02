(function () {
  'use strict';

  function loadMainApp() {
    const injectTime = performance.now();
    (async () => {
      const { onExecute } = await import(
        /* @vite-ignore */
        chrome.runtime.getURL("aitopia/assets/ba8a98d7afc73bb348ec9313f2952319.js")
      );
      onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
    })().catch(console.error);
  }

  function createConsentBanner() {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });

    // Style
    const style = document.createElement('style');
    style.textContent = `
      .banner {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-radius: 8px;
        padding: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        z-index: 2147483647;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        box-sizing: border-box;
      }
      .text {
        margin: 0 0 12px 0;
      }
      .link {
        color: #0066cc;
        text-decoration: none;
      }
      .link:hover {
        text-decoration: underline;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      button {
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: background 0.2s;
      }
      .btn-decline {
        background: transparent;
        color: #666;
      }
      .btn-decline:hover {
        background: #f5f5f5;
        color: #333;
      }
      .btn-accept {
        background: #0066cc;
        color: white;
      }
      .btn-accept:hover {
        background: #0052a3;
      }
    `;

    // Content
    const banner = document.createElement('div');
    banner.className = 'banner';

    const text = document.createElement('p');
    text.className = 'text';
    text.innerHTML = 'To assist you on this page, the AI Sidebar extension requires access to read the page content. No data is sent to external servers without your action. <a href="https://chataigpt.pro/privacy/" target="_blank" class="link">Privacy Policy</a>';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnDecline = document.createElement('button');
    btnDecline.className = 'btn-decline';
    btnDecline.textContent = 'Decline';
    btnDecline.onclick = () => host.remove();

    const btnAccept = document.createElement('button');
    btnAccept.className = 'btn-accept';
    btnAccept.textContent = 'Accept';
    btnAccept.onclick = () => {
      chrome.storage.local.set({ privacy_consent: true }, () => {
        host.remove();
        loadMainApp();
      });
    };

    actions.appendChild(btnDecline);
    actions.appendChild(btnAccept);
    banner.appendChild(text);
    banner.appendChild(actions);

    shadow.appendChild(style);
    shadow.appendChild(banner);

    document.body.appendChild(host);
  }

  // Main Check
  chrome.storage.local.get(['privacy_consent'], (result) => {
    if (result.privacy_consent === true) {
      loadMainApp();
    } else {
      // Check if we are in a top-level frame or if logic dictates running everywhere.
      // Usually consent banners should appear in the top frame to avoid spamming usage in iframes,
      // but if the extension runs in iframes, we might need it there too. 
      // For now, simpler is better: just show it.
      // To be safe against double injection if the script re-runs:
      createConsentBanner();
    }
  });

})();
