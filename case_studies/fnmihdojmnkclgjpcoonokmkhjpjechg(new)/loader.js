(async function () {
    // Prevent running on extension pages (like setup.html) or Google Auth pages
    if (window.location.protocol === 'chrome-extension:') return;
    if (window.location.hostname === 'accounts.google.com') return;

    const STORAGE_KEY = 'privacy_consent';

    async function checkConsent() {
        try {
            const result = await chrome.storage.local.get(STORAGE_KEY);
            return result[STORAGE_KEY] === true;
        } catch (e) {
            console.warn("Privacy consent check failed", e);
            return false;
        }
    }

    function injectMainApp() {
        chrome.runtime.sendMessage({ messageType: "INJECT_MAIN_APP" });
    }

    function showConsentBanner() {
        // Create Shadow DOM host to isolate styles
        const host = document.createElement('div');
        host.id = 'aitopia-privacy-gatekeeper';
        host.style.position = 'fixed';
        host.style.zIndex = '2147483647';
        host.style.bottom = '20px';
        host.style.right = '20px';
        document.body.appendChild(host);

        const shadow = host.attachShadow({ mode: 'closed' });

        const container = document.createElement('div');
        container.style.cssText = `
            background: #ffffff;
            color: #333333;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: 320px;
            border: 1px solid #e1e1e1;
            font-size: 14px;
            line-height: 1.5;
        `;

        container.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                     <svg style="width: 24px; height: 24px; color: #111;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 830.12 868.33"><path fill="currentColor" d="M424.14,825.57c-114.47,0-207.59-93.13-207.59-207.59V261.32c0-114.46,93.12-207.59,207.59-207.59s207.59,93.13,207.59,207.59V618C631.73,732.44,538.6,825.57,424.14,825.57Zm0-713.31c-82.19,0-149.06,66.87-149.06,149.06V618C275.08,700.17,342,767,424.14,767S573.2,700.17,573.2,618V261.32C573.2,179.13,506.33,112.26,424.14,112.26Z"></path><path fill="currentColor" d="M578.23,736.49a206.33,206.33,0,0,1-103.45-27.9L165.91,530.27a207.59,207.59,0,0,1-76-283.58c57.24-99.13,184.45-133.21,283.58-76L682.37,349c99.13,57.23,133.22,184.45,76,283.58A206.21,206.21,0,0,1,632.3,729.33,208.85,208.85,0,0,1,578.23,736.49ZM270,201.45A149.18,149.18,0,0,0,140.61,276C99.52,347.13,124,438.48,195.17,479.58L504,657.9c71.18,41.1,162.53,16.63,203.62-54.56h0A149.06,149.06,0,0,0,653.1,399.72L344.23,221.39A148.22,148.22,0,0,0,270,201.45Z"></path><path fill="currentColor" d="M270,736.49A208.9,208.9,0,0,1,216,729.33,207.59,207.59,0,0,1,165.91,349L474.78,170.7c99.12-57.23,226.34-23.14,283.57,76h0c57.24,99.13,23.15,226.34-76,283.58L373.5,708.59A206.37,206.37,0,0,1,270,736.49Zm308.28-535A148.15,148.15,0,0,0,504,221.39L195.17,399.72A149.06,149.06,0,0,0,344.23,657.9L653.1,479.58c71.18-41.1,95.66-132.44,54.56-203.62L733,261.32,707.66,276A149.15,149.15,0,0,0,578.32,201.45Z"></path></svg>
                     <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">Smart Sidebar (AITOPIA)</h3>
                </div>
                <p style="margin: 0; color: #666;">
                    The <strong>Smart Sidebar</strong> extension has been updated to comply with new privacy standards.
                    <br><br>
                    To continue using the sidebar, please accept our updated <a href="https://chataigpt.pro/privacy/" target="_blank" style="color: #667eea; text-decoration: none;">Privacy Policy</a>.
                </p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="skip-btn" style="
                    background: transparent;
                    border: 1px solid #ccc;
                    color: #666;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 13px;
                ">Skip for now</button>
                <button id="accept-btn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 13px;
                ">Accept & Enable</button>
            </div>
        `;

        shadow.appendChild(container);

        const btn = shadow.getElementById('accept-btn');
        btn.addEventListener('click', async () => {
            await chrome.storage.local.set({ [STORAGE_KEY]: true });
            host.remove();
            injectMainApp();
        });

        const skipBtn = shadow.getElementById('skip-btn');
        skipBtn.addEventListener('click', () => {
            host.remove();
        });
    }

    // Main Execution
    const hasConsent = await checkConsent();
    if (hasConsent) {
        injectMainApp();
    } else {
        showConsentBanner();
    }

})();
