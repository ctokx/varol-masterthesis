(function () {
  'use strict';

  const injectTime = performance.now();

  function loadSidebar() {
    (async () => {
      const { onExecute } = await import(
        /* @vite-ignore */
        chrome.runtime.getURL("aitopia/assets/a06923325df9fc23634226f1be1668ff.js")
      );
      onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
    })().catch(console.error);
  }

  function createConsentBanner() {
    const host = document.createElement('div');
    host.id = 'ai-sidebar-privacy-consent-host';
    host.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:2147483647; font-family:sans-serif;';
    const shadow = host.attachShadow({ mode: 'open' });

    const container = document.createElement('div');
    container.style.cssText = `
      background: #fff;
      border: 1px solid #e0e0e0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-radius: 8px;
      width: 320px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: #333;
      font-size: 14px;
      line-height: 1.4;
    `;

    const title = document.createElement('strong');
    title.textContent = 'AI Sidebar Privacy Notice';
    title.style.fontSize = '15px';

    const text = document.createElement('span');
    text.innerHTML = 'To assist you on this page, the AI Sidebar extension requires access to read the page content. No data is sent to external servers without your action. <br><br> <a href="https://deepseek.ai/privacy-policy" target="_blank" style="color: #007bff; text-decoration: underline;">Privacy Policy</a>';

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';
    btnGroup.style.justifyContent = 'flex-end';

    const declineBtn = document.createElement('button');
    declineBtn.textContent = 'Decline';
    declineBtn.style.cssText = `
      background: transparent;
      border: 1px solid #ccc;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      color: #666;
    `;
    declineBtn.onmouseover = () => declineBtn.style.background = '#f5f5f5';
    declineBtn.onmouseout = () => declineBtn.style.background = 'transparent';
    declineBtn.onclick = () => {
      host.remove();
      // Optional: Save 'false' to not ask again for a while, or just close for now.
      // chrome.storage.local.set({ privacy_consent: false }); 
    };

    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept';
    acceptBtn.style.cssText = `
      background: #007bff;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      color: #fff;
      font-weight: 500;
    `;
    acceptBtn.onmouseover = () => acceptBtn.style.background = '#0056b3';
    acceptBtn.onmouseout = () => acceptBtn.style.background = '#007bff';
    acceptBtn.onclick = () => {
      chrome.storage.local.set({ privacy_consent: true }, () => {
        host.remove();
        loadSidebar();
      });
    };

    btnGroup.appendChild(declineBtn);
    btnGroup.appendChild(acceptBtn);

    container.appendChild(title);
    container.appendChild(text);
    container.appendChild(btnGroup);
    shadow.appendChild(container);

    document.documentElement.appendChild(host);
  }

  // Check consent before loading
  chrome.storage.local.get(['privacy_consent'], (result) => {
    if (result.privacy_consent === true) {
      loadSidebar();
    } else {
      // Only show banner if specifically not consented (undefined or false)
      createConsentBanner();
    }
  });

})();
