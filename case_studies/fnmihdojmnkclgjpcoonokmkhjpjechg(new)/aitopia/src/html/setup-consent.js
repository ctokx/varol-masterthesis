document.addEventListener('DOMContentLoaded', async () => {
    const overlay = document.getElementById('setup-consent-overlay');
    const btn = document.getElementById('setup-accept-btn');

    // Check current status
    const current = await chrome.storage.local.get('privacy_consent');
    if (!current.privacy_consent) {
        // Show blocking overlay
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        document.body.style.overflow = 'hidden'; // Lock scroll
    }

    btn.onclick = async () => {
        await chrome.storage.local.set({ privacy_consent: true });
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        document.body.style.overflow = '';
    };

    const skipBtn = document.getElementById('setup-skip-btn');
    if (skipBtn) {
        skipBtn.onclick = () => {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            document.body.style.overflow = '';
        };
    }


});
