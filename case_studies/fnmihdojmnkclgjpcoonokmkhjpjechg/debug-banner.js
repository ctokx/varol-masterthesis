// Debug script to test banner functionality
// Run this in the browser console on chatgpt.com to test the banner

console.log('=== AITOPIA Banner Debug Script ===');

// Check if content script is loaded
console.log('Content script files loaded:', {
    bannerCSS: !!document.querySelector('link[href*="chatgptBanner.css"], style[id*="aitopia"]'),
    bannerJS: typeof showAitopiaBanner !== 'undefined'
});

// Check current page details
console.log('Page details:', {
    url: window.location.href,
    referrer: document.referrer,
    historyLength: window.history.length,
    opener: window.opener,
    isPopup: window.opener === null && window.history.length === 1
});

// Check if banner elements exist
console.log('Banner state:', {
    bannerExists: !!document.getElementById('aitopia-banner'),
    bannerDismissed: sessionStorage.getItem('aitopia-banner-dismissed'),
    bodyHasOffset: document.body.classList.contains('aitopia-banner-page-offset')
});

// Test banner creation manually
function testBanner() {
    console.log('Testing banner creation...');
    
    // Clear any existing state
    sessionStorage.removeItem('aitopia-banner-dismissed');
    const existingBanner = document.getElementById('aitopia-banner');
    if (existingBanner) {
        existingBanner.remove();
    }
    document.body.classList.remove('aitopia-banner-page-offset');
    
    // Create test banner
    const banner = document.createElement('div');
    banner.id = 'aitopia-banner';
    banner.className = 'aitopia-banner-container';
    
    banner.innerHTML = `
        <div class="aitopia-banner-content">
            <button class="aitopia-banner-close" onclick="this.closest('#aitopia-banner').remove(); document.body.classList.remove('aitopia-banner-page-offset');">×</button>

            <div class="aitopia-banner-main">
                <div class="aitopia-banner-left">
                    <div class="aitopia-banner-header">
                        <div class="aitopia-banner-icon">🤖</div>
                        <div class="aitopia-banner-text">
                            <h3>Keep Using ChatGPT — Now With 10+ Top AI Models</h3>
                            <p>Access GPT-4, Claude, Gemini & more — all while continuing your ChatGPT workflow.</p>
                            <div class="aitopia-comparison-hook">
                                Same ChatGPT experience you love — with Claude for writing, Gemini for analysis, and more — all for less than ChatGPT Plus.
                            </div>
                        </div>
                    </div>

                    <div class="aitopia-banner-models-inline">
                        <div class="aitopia-model-logo aitopia-openai" title="GPT-4 - OpenAI's most advanced model">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                            </svg>
                        </div>
                        <div class="aitopia-model-logo aitopia-claude" title="Claude 3.5 - Great for writing and reasoning">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7.307 2.5a9.807 9.807 0 1 0 9.386 0zm4.693 1.5c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8z"/>
                            </svg>
                        </div>
                        <div class="aitopia-model-logo aitopia-gemini" title="Gemini 2.0 - Google's top AI for logic tasks">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
                            </svg>
                        </div>
                        <div class="aitopia-model-logo aitopia-more" title="10+ Premium AI Models including Mistral, LLaMA, Command R+">
                            <span>+7</span>
                        </div>

                        <div class="aitopia-feature-icons">
                            <span class="aitopia-feature-icon" title="10+ Premium AI Models">⚡</span>
                            <span class="aitopia-feature-icon" title="Better Value than ChatGPT Plus">💰</span>
                            <span class="aitopia-feature-icon" title="Latest AI Technology">🚀</span>
                        </div>
                    </div>
                </div>

                <div class="aitopia-banner-right">
                    <div class="aitopia-banner-pricing">
                        <div class="aitopia-price-highlight">
                            <span class="aitopia-price">$16.66/mo</span>
                            <span class="aitopia-price-compare">vs $20/mo ChatGPT Plus</span>
                        </div>
                        <div class="aitopia-savings-badge">SAVE $3.34/MO</div>
                    </div>

                    <div class="aitopia-banner-cta-area">
                        <button class="aitopia-banner-cta" onclick="testCTAClick();">
                            Upgrade Your ChatGPT Experience
                        </button>
                        <div class="aitopia-cta-note">Seamless upgrade • Cancel anytime</div>
                    </div>
                </div>
            </div>

            <div class="aitopia-banner-bottom">
                <div class="aitopia-model-highlights">
                    <div class="aitopia-highlight-item">
                        <div class="aitopia-highlight-icon aitopia-openai">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
                            </svg>
                        </div>
                        <div class="aitopia-highlight-text">
                            <span class="aitopia-highlight-name">GPT-4</span>
                            <span class="aitopia-highlight-desc">Best for reasoning</span>
                        </div>
                    </div>
                    <div class="aitopia-highlight-item">
                        <div class="aitopia-highlight-icon aitopia-claude">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7.307 2.5a9.807 9.807 0 1 0 9.386 0zm4.693 1.5c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8z"/>
                            </svg>
                        </div>
                        <div class="aitopia-highlight-text">
                            <span class="aitopia-highlight-name">Claude</span>
                            <span class="aitopia-highlight-desc">Superior writing</span>
                        </div>
                    </div>
                    <div class="aitopia-highlight-item">
                        <div class="aitopia-highlight-icon aitopia-gemini">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"/>
                            </svg>
                        </div>
                        <div class="aitopia-highlight-text">
                            <span class="aitopia-highlight-name">Gemini</span>
                            <span class="aitopia-highlight-desc">Advanced analysis</span>
                        </div>
                    </div>
                </div>

                <div class="aitopia-key-benefits">
                    <div class="aitopia-benefit-item">
                        <span class="aitopia-benefit-icon">🚀</span>
                        <span class="aitopia-benefit-text">Latest AI models</span>
                    </div>
                    <div class="aitopia-benefit-item">
                        <span class="aitopia-benefit-icon">💰</span>
                        <span class="aitopia-benefit-text">Better value</span>
                    </div>
                    <div class="aitopia-benefit-item">
                        <span class="aitopia-benefit-icon">⚡</span>
                        <span class="aitopia-benefit-text">One platform</span>
                    </div>
                </div>

                <div class="aitopia-social-proof-compact">
                    <div class="aitopia-proof-item">
                        <span class="aitopia-proof-number">50K+</span>
                        <span class="aitopia-proof-label">users</span>
                    </div>
                    <div class="aitopia-proof-item">
                        <span class="aitopia-proof-number">4.8★</span>
                        <span class="aitopia-proof-label">rating</span>
                    </div>
                    <div class="aitopia-proof-item">
                        <span class="aitopia-proof-number">#1</span>
                        <span class="aitopia-proof-label">trending</span>
                    </div>
                </div>
            </div>

            <button class="aitopia-banner-dismiss" onclick="this.closest('#aitopia-banner').remove(); document.body.classList.remove('aitopia-banner-page-offset');">
                Maybe Later
            </button>
        </div>
    `;

    document.body.appendChild(banner);
    document.body.classList.add('aitopia-banner-page-offset');

    setTimeout(() => {
        banner.classList.add('aitopia-banner-visible');
    }, 100);

    console.log('Test banner created and should be visible');
}

// Test CSS loading
function testCSS() {
    console.log('Testing CSS...');
    
    // Check if CSS is loaded
    const cssLoaded = Array.from(document.styleSheets).some(sheet => {
        try {
            return Array.from(sheet.cssRules).some(rule => 
                rule.selectorText && rule.selectorText.includes('aitopia-banner')
            );
        } catch (e) {
            return false;
        }
    });
    
    console.log('CSS loaded:', cssLoaded);
    
    if (!cssLoaded) {
        console.log('CSS not found, injecting manually...');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('chatgptBanner.css');
        document.head.appendChild(link);
    }
}

// Test chrome extension API
function testExtensionAPI() {
    console.log('Testing extension API...');
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('Chrome extension API available');
        
        // Test sending message
        chrome.runtime.sendMessage({
            messageType: "ShowAitopiaBanner",
            source: "debugTest"
        }).then(() => {
            console.log('Message sent successfully');
        }).catch(error => {
            console.log('Message failed:', error);
        });
    } else {
        console.log('Chrome extension API not available');
    }
}

// Run all tests
console.log('Running debug tests...');
testCSS();
testExtensionAPI();

console.log('To manually test the banner, run: testBanner()');
console.log('Available functions: testBanner(), testCSS(), testExtensionAPI()');

// Test CTA click functionality
function testCTAClick() {
    console.log('Testing CTA click...');

    if (typeof chrome !== 'undefined' && chrome.runtime) {
        // Test the actual message sending
        chrome.runtime.sendMessage({
            messageType: "SwitchToAitopia",
            source: "bannerCTA",
            updatePreference: true
        }).then(() => {
            console.log('SwitchToAitopia message sent successfully');

            // Show feedback
            showTestFeedback();

        }).catch(error => {
            console.log('SwitchToAitopia message failed:', error);
        });
    } else {
        console.log('Chrome extension API not available - simulating CTA click');
        showTestFeedback();
    }
}

function showTestFeedback() {
    const banner = document.getElementById('aitopia-banner');
    if (!banner) return;

    const content = banner.querySelector('.aitopia-banner-content');
    if (!content) return;

    // Create feedback overlay
    const feedback = document.createElement('div');
    feedback.className = 'aitopia-banner-feedback';
    feedback.innerHTML = `
        <div class="aitopia-feedback-content">
            <div class="aitopia-feedback-icon">✅</div>
            <div class="aitopia-feedback-text">
                <strong>Preference Updated!</strong><br>
                <small>AITOPIA is now your default AI experience</small>
            </div>
        </div>
    `;

    content.appendChild(feedback);

    // Show feedback with animation
    setTimeout(() => {
        feedback.classList.add('aitopia-feedback-visible');
    }, 50);

    // Hide banner after delay
    setTimeout(() => {
        banner.remove();
        document.body.classList.remove('aitopia-banner-page-offset');
    }, 2000);
}

// Make functions available globally
window.testBanner = testBanner;
window.testCSS = testCSS;
window.testExtensionAPI = testExtensionAPI;
window.testCTAClick = testCTAClick;
