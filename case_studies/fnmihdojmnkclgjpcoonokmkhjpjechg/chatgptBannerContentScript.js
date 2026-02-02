// ChatGPT Banner Content Script - Shows AITOPIA promotion banner
(function() {
    'use strict';

    let bannerShown = false;
    let bannerElement = null;

    // Session-based persistence for close button (X) dismissal
    function initializeSessionTracking() {
        try {
            const sessionData = localStorage.getItem('aitopia-session-data');
            let data = sessionData ? JSON.parse(sessionData) : null;

            // If no data exists or it's a new session, increment session count
            if (!data || !sessionStorage.getItem('aitopia-session-initialized')) {
                const currentTime = Date.now();

                if (!data) {
                    // First time - initialize data
                    data = {
                        sessionCount: 1,
                        lastSessionTime: currentTime,
                        closeDismissalTime: null,
                        closeDismissalSessionCount: null,
                        permanentlyDismissed: false
                    };
                } else {
                    // New session - increment count
                    data.sessionCount += 1;
                    data.lastSessionTime = currentTime;
                    // Ensure permanentlyDismissed field exists for older data
                    if (data.permanentlyDismissed === undefined) {
                        data.permanentlyDismissed = false;
                    }
                }

                localStorage.setItem('aitopia-session-data', JSON.stringify(data));
                sessionStorage.setItem('aitopia-session-initialized', 'true');
            }
        } catch (error) {
            console.log('Could not initialize session tracking:', error);
        }
    }

    // Check if banner was dismissed via close button and should remain hidden
    function isBannerCloseDismissed() {
        try {
            const sessionData = localStorage.getItem('aitopia-session-data');
            if (!sessionData) return false;

            const data = JSON.parse(sessionData);

            // Check if permanently dismissed
            if (data.permanentlyDismissed === true) {
                return true; // Never show banner again
            }

            // If no close dismissal recorded, banner can show
            if (!data.closeDismissalTime || !data.closeDismissalSessionCount) {
                return false;
            }

            // Check if 2 sessions have passed since close dismissal
            const sessionsSinceClose = data.sessionCount - data.closeDismissalSessionCount;
            
            // Return true if less than or equal to 2 sessions have passed (banner should remain hidden)
            // This hides the banner for 2 full sessions AFTER the dismissal session
            return sessionsSinceClose <= 2;
        } catch (error) {
            console.log('Error checking close dismissal state:', error);
            return false;
        }
    }

    // Mark banner as dismissed via close button (X) or Maybe later - persists across sessions
    function dismissBannerPermanently() {
        try {
            const sessionData = localStorage.getItem('aitopia-session-data');
            const data = sessionData ? JSON.parse(sessionData) : {
                sessionCount: 1,
                lastSessionTime: Date.now(),
                closeDismissalTime: null,
                closeDismissalSessionCount: null,
                permanentlyDismissed: false
            };

            // Check if this is the second time clicking close/maybe later (after banner reappeared)
            if (data.closeDismissalSessionCount !== null) {
                // User clicked dismiss before, and banner has reappeared - now dismiss permanently
                data.permanentlyDismissed = true;
                console.log('Banner permanently dismissed after second dismissal');
            } else {
                // First time clicking close/maybe later - dismiss for 2 sessions
                data.closeDismissalTime = Date.now();
                data.closeDismissalSessionCount = data.sessionCount;
                console.log('Banner dismissed for 2 sessions');
            }

            localStorage.setItem('aitopia-session-data', JSON.stringify(data));
        } catch (error) {
            console.log('Could not save permanent dismissal state:', error);
        }
    }

    // Check if banner has been dismissed in this session (no longer used - kept for compatibility)
    function isBannerDismissed() {
        // Always return false since we now use permanent dismissal for both buttons
        return false;
    }

    // Mark banner as dismissed for this session (no longer used - kept for compatibility)
    function dismissBanner() {
        // This function is no longer used but kept for compatibility
        // Both close and "Maybe later" buttons now use dismissBannerPermanently()
    }

    // Create and show the AITOPIA banner
    function showAitopiaBanner() {
        console.log('showAitopiaBanner called');

        // Initialize session tracking
        initializeSessionTracking();

        // Don't show if already shown, dismissed for session, or permanently dismissed
        if (bannerShown || isBannerDismissed() || isBannerCloseDismissed()) {
            console.log('Banner not shown - already shown or dismissed:', {
                bannerShown,
                sessionDismissed: isBannerDismissed(),
                closeDismissed: isBannerCloseDismissed()
            });
            return;
        }

        // Check if banner already exists
        if (document.getElementById('aitopia-banner')) {
            console.log('Banner not shown - already exists in DOM');
            return;
        }

        console.log('Creating AITOPIA banner');
        bannerShown = true;

        // Create banner container
        const banner = document.createElement('div');
        banner.id = 'aitopia-banner';
        banner.className = 'aitopia-banner-container';
        
        // Banner content
        banner.innerHTML = `
            <div class="aitopia-banner-content">
                <div class="aitopia-ad-label">ADVERTISEMENT</div>
                <button class="aitopia-banner-close" id="aitopia-banner-close">×</button>

                <div class="aitopia-banner-main">
                    <div class="aitopia-banner-left">
                        <div class="aitopia-banner-header">
                            <div class="aitopia-banner-text">
                                <div class="aitopia-logo-header">
                                    <span class="aitopia-logo-text">AITOPIA</span>
                                    <span class="aitopia-tagline">AI Workspace</span>
                                </div>
                                <h3>The Complete AI Platform with GPT-5, Claude, Gemini & More</h3>

                                <p class="aitopia-description">Get instant access to all premium AI models and 20+ specialized tools in one seamless workspace.</p>

                                <!-- Enhanced value proposition -->
                                <div class="aitopia-value-props">
                                    <div class="aitopia-value-item">
                                        <span class="aitopia-check-icon">✓</span>
                                        <div>
                                            <strong>All Premium Models</strong>
                                            <span class="aitopia-value-desc">GPT-5, GPT-4, Claude, Gemini & 7+ more</span>
                                        </div>
                                    </div>
                                    <div class="aitopia-value-item">
                                        <span class="aitopia-check-icon">✓</span>
                                        <div>
                                            <strong>20+ AI Tools</strong>
                                            <span class="aitopia-value-desc">YouTube Summarizer, Image Editor, Grammar Check</span>
                                        </div>
                                    </div>
                                    <div class="aitopia-value-item">
                                        <span class="aitopia-check-icon">✓</span>
                                        <div>
                                            <strong>Better Value</strong>
                                            <span class="aitopia-value-desc">Save $40/year vs ChatGPT Plus</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- AI Tools Grid -->
                                <div class="aitopia-tools-section">
                                    <div class="aitopia-section-label">Featured AI Tools</div>
                                    <div class="aitopia-tools-grid">
                                        <div class="aitopia-tool-chip">
                                            <span class="aitopia-tool-icon">🎥</span>
                                            <span>YouTube Summarizer</span>
                                        </div>
                                        <div class="aitopia-tool-chip">
                                            <span class="aitopia-tool-icon">✍️</span>
                                            <span>AI Writer</span>
                                        </div>
                                        <div class="aitopia-tool-chip">
                                            <span class="aitopia-tool-icon">✓</span>
                                            <span>Grammar Check</span>
                                        </div>
                                        <div class="aitopia-tool-chip">
                                            <span class="aitopia-tool-icon">🎨</span>
                                            <span>Image Creator</span>
                                        </div>
                                        <div class="aitopia-tool-chip aitopia-tool-more" style="cursor: default; pointer-events: none;">
                                            <span>+16 more</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Models Display -->
                                <div class="aitopia-models-showcase">
                                    <div class="aitopia-section-label">Available AI Models</div>
                                    <div class="aitopia-models-row">
                                        <div class="aitopia-model-card">
                                            <span class="aitopia-model-icon" style="background: linear-gradient(135deg, #10b981, #059669);">GPT-5</span>
                                            <span class="aitopia-model-label">Latest</span>
                                        </div>
                                        <div class="aitopia-model-card">
                                            <span class="aitopia-model-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">GPT-4</span>
                                            <span class="aitopia-model-label">Advanced</span>
                                        </div>
                                        <div class="aitopia-model-card">
                                            <span class="aitopia-model-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">Claude</span>
                                            <span class="aitopia-model-label">Writing</span>
                                        </div>
                                        <div class="aitopia-model-card">
                                            <span class="aitopia-model-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">Gemini</span>
                                            <span class="aitopia-model-label">Analysis</span>
                                        </div>
                                        <div class="aitopia-model-card aitopia-model-more">
                                            <span class="aitopia-model-icon" style="background: linear-gradient(135deg, #64748b, #475569);">+7</span>
                                            <span class="aitopia-model-label">More</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="aitopia-banner-right">
                        <div class="aitopia-pricing-card">
                            <div class="aitopia-pricing-header">
                                <div class="aitopia-value-badge">BEST VALUE</div>
                                <div class="aitopia-price-block">
                                    <span class="aitopia-price-currency">$</span>
                                    <span class="aitopia-price-amount">16.66</span>
                                    <span class="aitopia-price-period">/month</span>
                                </div>
                                <div class="aitopia-price-compare">
                                    <span class="aitopia-compare-text">ChatGPT Plus costs</span>
                                    <span class="aitopia-compare-price">$20/mo</span>
                                </div>
                                <div class="aitopia-savings-badge">Save $40/year</div>
                            </div>

                            <div class="aitopia-features-list">
                                <div class="aitopia-feature">
                                    <span class="aitopia-feature-check">✓</span>
                                    <span>All premium AI models</span>
                                </div>
                                <div class="aitopia-feature">
                                    <span class="aitopia-feature-check">✓</span>
                                    <span>20+ AI tools included</span>
                                </div>
                                <div class="aitopia-feature">
                                    <span class="aitopia-feature-check">✓</span>
                                    <span>Unlimited usage</span>
                                </div>
                                <div class="aitopia-feature">
                                    <span class="aitopia-feature-check">✓</span>
                                    <span>Cancel anytime</span>
                                </div>
                            </div>

                            <div class="aitopia-cta-row">
                                <button class="aitopia-banner-dismiss" id="aitopia-banner-dismiss">
                                    Maybe later
                                </button>
                                <button class="aitopia-cta-button" id="aitopia-banner-cta">
                                    <span class="aitopia-cta-text">Get Started</span>
                                    <span class="aitopia-cta-arrow">→</span>
                                </button>
                            </div>

                            <div class="aitopia-disclaimer">
                                <span style="color: #dc2626; font-size: 11px;">⚠️</span>
                                <span style="color: #666; font-size: 11px;">Independent platform - not affiliated with OpenAI</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Comparison Modal -->
            <div class="aitopia-comparison-modal" id="aitopia-comparison-modal">
                <div class="aitopia-modal-overlay" id="aitopia-modal-overlay"></div>
                <div class="aitopia-modal-content">
                    <div class="aitopia-modal-header">
                        <h2>Compare ChatGPT & AITOPIA: Complete Feature Comparison</h2>
                        <button class="aitopia-modal-close" id="aitopia-modal-close">&times;</button>
                    </div>
                    <div class="aitopia-modal-body">
                        <!-- Hero Comparison Section -->
                        <div class="aitopia-comparison-hero">
                            <div class="aitopia-comparison-cards">
                                <div class="aitopia-comparison-card aitopia-chatgpt-card">
                                    <div class="aitopia-card-header">
                                        <div class="aitopia-card-logo">
                                            <div class="aitopia-chatgpt-logo">ChatGPT</div>
                                        </div>
                                        <div class="aitopia-card-title">ChatGPT Plus</div>
                                        <div class="aitopia-card-price">$20.00<span>/month</span></div>
                                    </div>
                                    <div class="aitopia-card-features">
                                        <div class="aitopia-feature-item">
                                            <span class="aitopia-feature-icon">🤖</span>
                                            <span>GPT-5, GPT-4, GPT-3.5</span>
                                        </div>
                                        <div class="aitopia-feature-item">
                                            <span class="aitopia-feature-icon">⚡</span>
                                            <span>Message limits apply</span>
                                        </div>
                                        <div class="aitopia-feature-item">
                                            <span class="aitopia-feature-icon">🎨</span>
                                            <span>DALL-E only</span>
                                        </div>
                                        <div class="aitopia-feature-item">
                                            <span class="aitopia-feature-icon">🔍</span>
                                            <span>Web browsing</span>
                                        </div>
                                        <div class="aitopia-feature-item">
                                            <span class="aitopia-feature-icon">📄</span>
                                            <span>File analysis</span>
                                        </div>
                                        <div class="aitopia-feature-item">
                                            <span class="aitopia-feature-icon">🏢</span>
                                            <span>OpenAI models only</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-vs-divider">
                                    <div class="aitopia-vs-text">VS</div>
                                </div>

                                <div class="aitopia-comparison-card aitopia-aitopia-card">
                                    <div class="aitopia-card-badge">RECOMMENDED</div>
                                    <div class="aitopia-card-header">
                                        <div class="aitopia-card-logo">
                                            <div class="aitopia-aitopia-logo">AITOPIA</div>
                                        </div>
                                        <div class="aitopia-card-title">AITOPIA Premium</div>
                                        <div class="aitopia-card-price">$16.66<span>/month</span></div>
                                        <div class="aitopia-card-savings">Save $40/year</div>
                                    </div>
                                    <div class="aitopia-card-features">
                                        <div class="aitopia-feature-item aitopia-feature-premium">
                                            <span class="aitopia-feature-icon">🚀</span>
                                            <span>GPT-5, GPT-4, Claude, Gemini + 7 more</span>
                                        </div>
                                        <div class="aitopia-feature-item aitopia-feature-premium">
                                            <span class="aitopia-feature-icon">♾️</span>
                                            <span>Unlimited usage</span>
                                        </div>
                                        <div class="aitopia-feature-item aitopia-feature-premium">
                                            <span class="aitopia-feature-icon">🎨</span>
                                            <span>Multiple image AI models</span>
                                        </div>
                                        <div class="aitopia-feature-item aitopia-feature-premium">
                                            <span class="aitopia-feature-icon">🔍</span>
                                            <span>Advanced Web Search Agent</span>
                                        </div>
                                        <div class="aitopia-feature-item aitopia-feature-premium">
                                            <span class="aitopia-feature-icon">📄</span>
                                            <span>ChatPDF + advanced document tools</span>
                                        </div>
                                        <div class="aitopia-feature-item aitopia-feature-premium">
                                            <span class="aitopia-feature-icon">🎯</span>
                                            <span>20+ specialized agents</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Detailed Feature Comparison -->
                        <div class="aitopia-detailed-comparison">
                            <h3 class="aitopia-section-title">Detailed Feature Comparison</h3>
                            <div class="aitopia-comparison-grid">
                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">🤖 AI Models & Capabilities</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Language Models</span>
                                            <span class="aitopia-chatgpt-value">GPT-5, GPT-4, GPT-3.5</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">GPT-5, GPT-4, Claude, Gemini, PaLM + more</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Model Switching</span>
                                            <span class="aitopia-chatgpt-value">Within OpenAI models</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">All models, any time</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">⚡ Usage & Limits</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Message Limits</span>
                                            <span class="aitopia-chatgpt-value">Limits on GPT-5</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Unlimited</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Model Access</span>
                                            <span class="aitopia-chatgpt-value">OpenAI models only</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Multi-provider access</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">🤖 AI Chat Agents</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">AI Chat Agents</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">20+ specialized agents</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">AI Agent Creator</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Create custom agents</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Group AI Chat</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Multi-agent conversations</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Chat Image (Vision)</span>
                                            <span class="aitopia-chatgpt-value">Basic vision</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Advanced image analysis</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">📚 Reading & Analysis Agents</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Reading Agents</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Specialized reading agents</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">YouTube Summarizer</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Full video analysis & summary</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">ChatPDF</span>
                                            <span class="aitopia-chatgpt-value">File upload available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Advanced PDF analysis</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Link Reader</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Web content analysis</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">🔍 Search & Translation</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Web Search Agent</span>
                                            <span class="aitopia-chatgpt-value">Web browsing available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Advanced web search</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">AI Translator</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Professional translation</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">✍️ Writing Agents</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Writing Agents</span>
                                            <span class="aitopia-chatgpt-value">General writing assistance</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Specialized writing agents</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">AI Article Writer</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Professional article creation</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Grammar Checker</span>
                                            <span class="aitopia-chatgpt-value">Available via prompts</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Advanced grammar agent</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Writing Improver</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Style & clarity enhancement</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Email Replier</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Professional email responses</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="aitopia-comparison-category">
                                    <h4 class="aitopia-category-title">🎨 Image Agents</h4>
                                    <div class="aitopia-feature-comparison">
                                        <div class="aitopia-feature-row aitopia-header-row">
                                            <span class="aitopia-feature-name"><strong>Feature</strong></span>
                                            <span class="aitopia-chatgpt-value"><strong>ChatGPT</strong></span>
                                            <span class="aitopia-aitopia-value"><strong>AITOPIA</strong></span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Text to Image</span>
                                            <span class="aitopia-chatgpt-value">DALL-E only</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Multiple AI image models</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Background Remover</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">AI background removal</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Remove Brushed Area</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Precise object removal</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Replace Background</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">AI background replacement</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Remove Text</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">Text removal from images</span>
                                        </div>
                                        <div class="aitopia-feature-row">
                                            <span class="aitopia-feature-name">Upscale</span>
                                            <span class="aitopia-chatgpt-value">Not available</span>
                                            <span class="aitopia-aitopia-value aitopia-winner">AI image upscaling</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="aitopia-modal-cta">
                            <div class="aitopia-modal-cta-text">
                                <strong>Get More for Less:</strong> Switch to AITOPIA and save $40/year while accessing GPT-5 + 10x more AI capabilities
                            </div>
                            <button class="aitopia-modal-cta-btn" id="aitopia-modal-cta">Start Now</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add banner to page
        document.body.appendChild(banner);

        // Add event listeners
        setupBannerEventListeners();

        // Show banner with animation
        setTimeout(() => {
            banner.classList.add('aitopia-banner-visible');
            // Add page offset class to body for browsers that don't support :has()
            document.body.classList.add('aitopia-banner-page-offset');
        }, 100);

        // Auto-hide after 15 seconds if not interacted with
        setTimeout(() => {
            if (banner && banner.parentNode && !banner.classList.contains('aitopia-banner-interacted')) {
                hideBanner();
            }
        }, 15000);
    }

    // Set up event listeners for banner
    function setupBannerEventListeners() {
        const banner = document.getElementById('aitopia-banner');
        const closeBtn = document.getElementById('aitopia-banner-close');
        const ctaBtn = document.getElementById('aitopia-banner-cta');
        const dismissBtn = document.getElementById('aitopia-banner-dismiss');

        if (!banner) return;

        // Mark as interacted when user hovers
        banner.addEventListener('mouseenter', function() {
            banner.classList.add('aitopia-banner-interacted');
        });

        // Close button - permanent dismissal for 2 sessions
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dismissBannerPermanently();
                hideBannerWithoutDismissal();
            });
        }

        // CTA button - start free trial
        if (ctaBtn) {
            ctaBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Show feedback that preference is being updated
                showPreferenceUpdateFeedback();

                // Send message to background script to open AITOPIA and update preference
                try {
                    chrome.runtime.sendMessage({
                        messageType: "SwitchToAitopia",
                        source: "bannerCTA",
                        updatePreference: true
                    });
                } catch (error) {
                    console.log('Could not send message to background script');
                }

                // Hide banner after a short delay to show feedback
                setTimeout(hideBanner, 1000);
            });
        }

        // Comparison button - show modal (button removed but keeping code for future use)
        const comparisonBtn = document.getElementById('aitopia-comparison-btn');
        if (comparisonBtn) {
            console.log('Comparison button found:', comparisonBtn);
            comparisonBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Comparison button clicked!');

                // Show comparison modal
                showComparisonModal();
            });
        }

        // Dismiss button - now behaves like close button (permanent dismissal)
        if (dismissBtn) {
            dismissBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                dismissBannerPermanently();
                hideBannerWithoutDismissal();
            });
        }

        // Expand/collapse additional models (elements might not exist)
        const expandBtn = document.getElementById('aitopia-expand-models');
        const additionalModels = document.getElementById('aitopia-additional-models');
        const expandText = expandBtn?.querySelector('.aitopia-expand-text');
        const collapseText = expandBtn?.querySelector('.aitopia-collapse-text');

        if (expandBtn && additionalModels && expandText && collapseText) {
            expandBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const isExpanded = additionalModels.style.display !== 'none';

                if (isExpanded) {
                    // Collapse
                    additionalModels.style.display = 'none';
                    expandText.style.display = 'inline';
                    collapseText.style.display = 'none';
                    expandBtn.title = 'Click to see all 10+ Premium AI Models';
                } else {
                    // Expand
                    additionalModels.style.display = 'flex';
                    expandText.style.display = 'none';
                    collapseText.style.display = 'inline';
                    expandBtn.title = 'Click to collapse';
                }
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('aitopia-banner')) {
                hideBanner();
            }
        });
    }

    // Show feedback that preference is being updated
    function showPreferenceUpdateFeedback() {
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
    }

    // Hide and remove banner without session dismissal (for close button)
    function hideBannerWithoutDismissal() {
        const banner = document.getElementById('aitopia-banner');
        if (banner) {
            banner.classList.remove('aitopia-banner-visible');
            // Remove page offset class
            document.body.classList.remove('aitopia-banner-page-offset');
            setTimeout(() => {
                if (banner.parentNode) {
                    banner.parentNode.removeChild(banner);
                }
            }, 300);
        }
    }

    // Hide and remove banner with session dismissal (for "Maybe later" button)
    function hideBanner() {
        hideBannerWithoutDismissal();
        dismissBanner();
    }

    // Modal functionality
    function showComparisonModal() {
        console.log('showComparisonModal called');
        const modal = document.getElementById('aitopia-comparison-modal');
        console.log('Modal element found:', modal);
        if (modal) {
            console.log('Modal current display style:', window.getComputedStyle(modal).display);
            modal.classList.add('aitopia-modal-visible');
            
            // Force full-screen styles with maximum specificity
            setTimeout(() => {
                // First, fix the modal container positioning
                modal.style.cssText = `
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 9999999 !important;
                    display: flex !important;
                    align-items: flex-start !important;
                    justify-content: center !important;
                    padding: 0 !important;
                    margin: 0 !important;
                `;
                
                const modalContent = modal.querySelector('.aitopia-modal-content');
                const modalHeader = modal.querySelector('.aitopia-modal-header');
                const modalBody = modal.querySelector('.aitopia-modal-body');
                
                if (modalContent) {
                    modalContent.style.cssText = `
                        position: relative !important;
                        width: 100vw !important; 
                        height: 100vh !important; 
                        max-width: 100vw !important; 
                        max-height: 100vh !important; 
                        min-height: 100vh !important;
                        border-radius: 0 !important; 
                        display: flex !important; 
                        flex-direction: column !important; 
                        overflow: hidden !important;
                        background: #FFFFFF !important;
                        transform: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                        top: 0 !important;
                        left: 0 !important;
                    `;
                }
                
                if (modalHeader) {
                    modalHeader.style.cssText = `
                        display: flex !important; 
                        justify-content: space-between !important; 
                        align-items: center !important; 
                        padding: 16px 20px !important; 
                        border-bottom: 1px solid #F3F4F6 !important; 
                        background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%) !important; 
                        flex-shrink: 0 !important;
                        position: relative !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        z-index: 10 !important;
                        min-height: 60px !important;
                        max-height: 60px !important;
                        margin: 0 !important;
                        gap: 0 !important;
                    `;
                    modalHeader.style.visibility = 'visible';
                    modalHeader.style.opacity = '1';
                }
                
                if (modalBody) {
                    modalBody.style.cssText = `
                        flex: 1 !important; 
                        overflow-y: auto !important; 
                        padding: 20px !important; 
                        background: #FFFFFF !important;
                        position: relative !important;
                        height: calc(100vh - 60px) !important;
                        max-height: calc(100vh - 60px) !important;
                        min-height: calc(100vh - 60px) !important;
                        width: 100% !important;
                        margin: 0 !important;
                        top: 0 !important;
                        left: 0 !important;
                    `;
                    modalBody.scrollTop = 0;
                }
                
                // Directly attach close button event listener with multiple methods
                const closeBtn = modal.querySelector('.aitopia-modal-close');
                const closeBtnById = document.getElementById('aitopia-modal-close');
                
                console.log('Close button search results:', {
                    querySelector: !!closeBtn,
                    getElementById: !!closeBtnById,
                    modalHTML: modal.innerHTML.substring(0, 500)
                });
                
                if (closeBtn) {
                    // Method 1: onclick
                    closeBtn.onclick = function(e) {
                        console.log('Method 1 - onclick triggered');
                        e.preventDefault();
                        e.stopPropagation();
                        hideComparisonModal();
                        return false;
                    };
                    
                    // Method 2: addEventListener
                    closeBtn.addEventListener('click', function(e) {
                        console.log('Method 2 - addEventListener triggered');
                        e.preventDefault();
                        e.stopPropagation();
                        hideComparisonModal();
                    }, true);
                    
                    // Method 3: Direct attribute
                    closeBtn.setAttribute('onclick', 'console.log("Method 3 triggered"); document.getElementById("aitopia-comparison-modal").classList.remove("aitopia-modal-visible"); document.body.style.overflow = "";');
                    
                    console.log('All close button methods attached, button style:', window.getComputedStyle(closeBtn));
                } else {
                    console.log('Close button not found in modal');
                }
                
                // Setup other modal event listeners
                setupModalEventListeners();
            }, 100);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
            console.log('Modal class added, should now be visible');
            console.log('Modal final display style:', window.getComputedStyle(modal).display);
        } else {
            console.log('Modal element not found!');
        }
    }

    function hideComparisonModal() {
        console.log('hideComparisonModal called');
        const modal = document.getElementById('aitopia-comparison-modal');
        if (modal) {
            console.log('Modal found, removing class and styles');
            modal.classList.remove('aitopia-modal-visible');
            
            // Clear all inline styles that might be preventing hiding
            modal.style.cssText = '';
            const modalContent = modal.querySelector('.aitopia-modal-content');
            if (modalContent) {
                modalContent.style.cssText = '';
            }
            const modalHeader = modal.querySelector('.aitopia-modal-header');
            if (modalHeader) {
                modalHeader.style.cssText = '';
            }
            const modalBody = modal.querySelector('.aitopia-modal-body');
            if (modalBody) {
                modalBody.style.cssText = '';
            }
            
            document.body.style.overflow = ''; // Restore scrolling
            console.log('Modal hidden successfully');
        } else {
            console.log('Modal not found in hideComparisonModal');
        }
    }

    function setupModalEventListeners() {
        // Close button is handled directly in showComparisonModal now
        console.log('Setting up other modal event listeners');

        // Close on overlay click
        const overlay = document.getElementById('aitopia-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                hideComparisonModal();
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideComparisonModal();
            }
        });

        // Modal CTA button
        const modalCtaBtn = document.getElementById('aitopia-modal-cta');
        if (modalCtaBtn) {
            modalCtaBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Show feedback that preference is being updated
                showPreferenceUpdateFeedback();

                // Send message to background script to open AITOPIA and update preference
                try {
                    chrome.runtime.sendMessage({
                        messageType: "SwitchToAitopia",
                        source: "modalCTA",
                        updatePreference: true
                    });
                } catch (error) {
                    console.log('Could not send message to background script');
                }

                // Hide modal and banner
                hideComparisonModal();
                setTimeout(hideBanner, 1000);
            });
        }

        // ESC key to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                hideComparisonModal();
            }
        });
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        console.log('Banner content script received message:', message);
        if (message.messageType === "ShowAitopiaBanner") {
            console.log('Received ShowAitopiaBanner message, showing banner');
            // Wait a bit for page to fully load
            setTimeout(showAitopiaBanner, 1000);
        }
    });

    // Also show banner if page is loaded and we detect it's from extension
    function checkForExtensionOrigin() {
        // Check if this window was opened by the extension (popup window)
        // Also check URL parameters or referrer to be more specific
        const isPopupWindow = window.opener === null && window.history.length === 1;
        const hasExtensionReferrer = document.referrer === '' || document.referrer.includes('chrome-extension://');

        console.log('Banner detection:', {
            isPopupWindow,
            hasExtensionReferrer,
            referrer: document.referrer,
            historyLength: window.history.length,
            opener: window.opener
        });

        if (isPopupWindow && hasExtensionReferrer) {
            console.log('Detected extension origin, showing banner after delay');
            // This looks like a popup window opened by our extension, show banner after delay
            setTimeout(showAitopiaBanner, 2000);
        }
    }

    // Initialize when page loads
    console.log('[AITOPIA Banner] Script loaded, document.readyState:', document.readyState);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkForExtensionOrigin);
    } else {
        checkForExtensionOrigin();
    }

    // Additional fallback: show banner on any ChatGPT page if it looks like extension usage
    // This helps in case the message-based approach doesn't work
    setTimeout(() => {
        console.log('[AITOPIA Banner] Fallback check:', {
            bannerShown,
            isBannerDismissed: isBannerDismissed(),
            isBannerCloseDismissed: isBannerCloseDismissed(),
            historyLength: window.history.length
        });

        // Initialize session tracking for fallback case
        initializeSessionTracking();

        // Only show if we haven't already shown the banner and it's a popup-like window
        if (!bannerShown && !isBannerDismissed() && !isBannerCloseDismissed() && window.history.length <= 2) {
            console.log('Fallback banner trigger - showing banner');
            showAitopiaBanner();
        }
    }, 3000);

    // Debug function to check session state (accessible from console)
    window.debugAitopiaBanner = function() {
        try {
            const sessionData = localStorage.getItem('aitopia-session-data');
            const sessionDismissed = sessionStorage.getItem('aitopia-banner-dismissed');
            const sessionInitialized = sessionStorage.getItem('aitopia-session-initialized');

            console.log('AITOPIA Banner Debug Info:');
            console.log('Session Data:', sessionData ? JSON.parse(sessionData) : 'None');
            console.log('Session Dismissed:', sessionDismissed);
            console.log('Session Initialized:', sessionInitialized);
            console.log('Banner Shown:', bannerShown);
            console.log('Close Dismissed:', isBannerCloseDismissed());
            console.log('Session Dismissed:', isBannerDismissed());

            if (sessionData) {
                const data = JSON.parse(sessionData);
                if (data.closeDismissalSessionCount) {
                    const sessionsSinceClose = data.sessionCount - data.closeDismissalSessionCount;
                    console.log('Sessions since close dismissal:', sessionsSinceClose);
                    console.log('Sessions remaining until banner can show:', Math.max(0, 2 - sessionsSinceClose));
                }
            }
        } catch (error) {
            console.error('Error in debug function:', error);
        }
    };

    // Debug function to reset all banner state
    window.resetAitopiaBanner = function() {
        try {
            localStorage.removeItem('aitopia-session-data');
            sessionStorage.removeItem('aitopia-banner-dismissed');
            sessionStorage.removeItem('aitopia-session-initialized');
            bannerShown = false;
            console.log('AITOPIA Banner state reset');
        } catch (error) {
            console.error('Error resetting banner state:', error);
        }
    };

    // Force show banner for testing
    window.forceShowBanner = function() {
        console.log('Force showing banner...');
        bannerShown = false;
        localStorage.removeItem('aitopia-session-data');
        sessionStorage.removeItem('aitopia-banner-dismissed');
        sessionStorage.removeItem('aitopia-session-initialized');
        showAitopiaBanner();
    };

    // Simple test banner
    window.testSimpleBanner = function() {
        console.log('Creating simple test banner...');

        // Remove existing banner if any
        const existing = document.getElementById('aitopia-banner');
        if (existing) {
            existing.remove();
        }

        // Create simple banner
        const banner = document.createElement('div');
        banner.id = 'aitopia-banner';
        banner.className = 'aitopia-banner-container aitopia-banner-visible';
        banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #f0f0f0; padding: 20px; z-index: 999999; border-bottom: 2px solid #6B46C1;';

        banner.innerHTML = '<div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">' +
            '<h3 style="margin: 0; color: #333;">AITOPIA Banner Test - If you see this, the basic banner works!</h3>' +
            '<button onclick="this.parentElement.parentElement.remove()" style="background: #6B46C1; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close Test</button>' +
            '</div>';

        document.body.appendChild(banner);
        console.log('Test banner should be visible now');
    };

})();
