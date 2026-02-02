// AITOPIA Pricing Page Content Script
(function() {
    'use strict';

    // Check if we're on the pricing page
    function isPricingPage() {
        return window.location.href.includes('chatgpt.com') &&
               (window.location.hash === '#pricing' || window.location.pathname.includes('pricing'));
    }

    // Check if popup has been permanently dismissed
    function hasPopupBeenShown() {
        try {
            // Check for permanent dismissal
            const dismissData = localStorage.getItem('aitopia-pricing-popup-dismissed');
            if (dismissData) {
                const data = JSON.parse(dismissData);
                if (data.permanentlyDismissed) {
                    return true; // Permanently dismissed
                }
                // Check if it's been dismissed for 2 sessions
                if (data.dismissalSessionCount !== null) {
                    const currentSessionCount = getSessionCount();
                    if (currentSessionCount - data.dismissalSessionCount < 2) {
                        return true; // Still within 2 session dismissal period
                    }
                }
            }
            return false;
        } catch (error) {
            console.log('LocalStorage not available, popup will show');
            return false;
        }
    }

    // Mark popup as dismissed (permanent after second dismissal)
    function markPopupAsDismissed() {
        try {
            const dismissData = localStorage.getItem('aitopia-pricing-popup-dismissed');
            const data = dismissData ? JSON.parse(dismissData) : {
                dismissalSessionCount: null,
                permanentlyDismissed: false
            };

            if (data.dismissalSessionCount !== null) {
                // Second dismissal - make it permanent
                data.permanentlyDismissed = true;
                console.log('Pricing popup permanently dismissed');
            } else {
                // First dismissal - dismiss for 2 sessions
                data.dismissalSessionCount = getSessionCount();
                console.log('Pricing popup dismissed for 2 sessions');
            }

            localStorage.setItem('aitopia-pricing-popup-dismissed', JSON.stringify(data));
        } catch (error) {
            console.log('Could not save popup dismissal state');
        }
    }

    // Get current session count (reuse or create)
    function getSessionCount() {
        try {
            const sessionData = localStorage.getItem('aitopia-session-data');
            if (sessionData) {
                const data = JSON.parse(sessionData);
                return data.sessionCount || 1;
            }
            return 1;
        } catch (error) {
            return 1;
        }
    }

    // Create the AITOPIA deal popup
    function createAitopiaPopup() {
        // Check if popup has already been shown in this session
        if (hasPopupBeenShown()) {
            console.log('AITOPIA popup already shown in this session, skipping');
            return;
        }

        // Check if popup already exists
        if (document.getElementById('aitopia-deal-popup')) {
            return;
        }

        // Don't mark as shown immediately - only mark when dismissed

        // Create popup container
        const popup = document.createElement('div');
        popup.id = 'aitopia-deal-popup';
        popup.className = 'aitopia-popup-container';
        
        // Popup content
        popup.innerHTML = `
            <div class="aitopia-popup-content">
                <div class="aitopia-popup-header-bar">
                    <div class="aitopia-ad-notice">Advertisement</div>
                    <button class="aitopia-close-btn" id="aitopia-close-btn">×</button>
                </div>
                
                <div class="aitopia-popup-scrollable">
                    <div class="aitopia-header">
                        <h2>🚀 Get More AI Power for Less with AITOPIA!</h2>
                        <p>Why pay $20/month for limited ChatGPT when you can get ALL the best AI models for just $16.66/month?</p>
                    </div>

                <div class="aitopia-models-showcase">
                    <h3>🤖 Access Premium AI Models:</h3>
                    <div class="aitopia-models-grid">
                        <div class="aitopia-model-item gpt aitopia-model-featured">
                            <div class="aitopia-model-icon">🌟</div>
                            <span>GPT-5 <span class="aitopia-new-badge">NEW</span></span>
                        </div>
                        <div class="aitopia-model-item claude">
                            <div class="aitopia-model-icon">⚫</div>
                            <span>Claude 4 Sonnet</span>
                        </div>
                        <div class="aitopia-model-item gemini">
                            <div class="aitopia-model-icon">🔷</div>
                            <span>Gemini 2.5 Flash</span>
                        </div>
                    </div>
                    <div class="aitopia-more-models">
                        <button class="aitopia-more-btn" id="aitopia-more-models-btn">+ 10 More Models</button>
                    </div>
                </div>

                <div class="aitopia-comparison">
                    <div class="aitopia-comparison-item">
                        <div class="aitopia-label chatgpt">CHATGPT PLUS</div>
                        <div class="aitopia-price">$20/mo</div>
                        <div class="aitopia-features">
                            <div class="aitopia-feature">• Direct GPT-5 in ChatGPT</div>
                            <div class="aitopia-feature">• Message caps apply</div>
                            <div class="aitopia-feature">• OpenAI models only</div>
                        </div>
                    </div>

                    <div class="aitopia-comparison-item aitopia-highlight">
                        <div class="aitopia-label aitopia">AITOPIA</div>
                        <div class="aitopia-price">$16.66/mo</div>
                        <div class="aitopia-features">
                            <div class="aitopia-feature">• GPT-5 included, plus 12+ additional models</div>
                            <div class="aitopia-feature">• Higher headroom before any limits</div>
                            <div class="aitopia-feature">• Model choice per task (write, code, image, research)</div>
                            <div class="aitopia-feature">• Save ~$40/year vs Plus</div>
                        </div>
                    </div>
                </div>

                    <div class="aitopia-cta">
                        <button class="aitopia-dismiss-btn" id="aitopia-dismiss-btn">Maybe Later</button>
                        <button class="aitopia-cta-btn" id="aitopia-cta-btn">UPGRADE AITOPIA NOW</button>
                    </div>
                    
                    <div class="aitopia-disclaimer">
                        <p>⚠️ AITOPIA is an independent third-party AI service, not affiliated with OpenAI, ChatGPT, or Anthropic</p>
                    </div>
                </div>
            </div>
        `;

        // Add popup to page
        document.body.appendChild(popup);

        // Block page interactions
        blockPageInteractions();

        // Add comprehensive modal isolation
        setupModalIsolation(popup);

        // Add event listeners
        setupPopupEventListeners();

        // Show popup with animation
        setTimeout(() => {
            popup.classList.add('aitopia-popup-visible');
            // Ensure focus is trapped within modal
            trapFocusInModal(popup);
        }, 500); // Small delay to let page load

        // Add interactive model items after popup is visible
        setTimeout(setupInteractiveModelItems, 600);
        
        // Debug: Test more models button directly
        setTimeout(() => {
            const testBtn = document.getElementById('aitopia-more-models-btn');
            console.log('Debug: More models button exists after 1s:', !!testBtn);
            if (testBtn) {
                console.log('Debug: Button classes:', testBtn.className);
                console.log('Debug: Button text:', testBtn.textContent);
            }
        }, 1000);
    }

    // Block all page interactions when popup is open with comprehensive scroll prevention
    function blockPageInteractions() {
        // Store original body position
        window.aitopiaScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        // Store original body styles for restoration
        window.aitopiaOriginalBodyStyles = {
            overflow: document.body.style.overflow,
            position: document.body.style.position,
            top: document.body.style.top,
            width: document.body.style.width,
            height: document.body.style.height
        };
        
        // Prevent body scrolling with multiple approaches
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${window.aitopiaScrollPosition}px`;
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.classList.add('aitopia-popup-active');
        
        // Also prevent scrolling on document root
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.classList.add('aitopia-popup-active');
        
        // Add comprehensive event prevention handlers
        window.aitopiaEventBlocker = function(e) {
            const target = e.target;
            const isInsidePopup = target.closest('.aitopia-popup-container') || 
                                target.closest('.aitopia-model-modal') || 
                                target.closest('.aitopia-more-models-modal');
            if (!isInsidePopup) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        };
        
        // Block all interaction events on parent page
        const eventTypes = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 
                           'wheel', 'keydown', 'keyup', 'contextmenu', 'dblclick'];
        
        eventTypes.forEach(eventType => {
            window.addEventListener(eventType, window.aitopiaEventBlocker, { 
                passive: false, 
                capture: true 
            });
        });
    }

    // Restore page interactions when popup is closed with comprehensive cleanup
    function restorePageInteractions() {
        // Restore body scrolling and position
        if (window.aitopiaOriginalBodyStyles) {
            document.body.style.overflow = window.aitopiaOriginalBodyStyles.overflow || '';
            document.body.style.position = window.aitopiaOriginalBodyStyles.position || '';
            document.body.style.top = window.aitopiaOriginalBodyStyles.top || '';
            document.body.style.width = window.aitopiaOriginalBodyStyles.width || '';
            document.body.style.height = window.aitopiaOriginalBodyStyles.height || '';
            delete window.aitopiaOriginalBodyStyles;
        } else {
            // Fallback cleanup
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.height = '';
        }
        
        document.body.classList.remove('aitopia-popup-active');
        
        // Restore document root scrolling
        document.documentElement.style.overflow = '';
        document.documentElement.classList.remove('aitopia-popup-active');
        
        // Remove comprehensive event blockers
        if (window.aitopiaEventBlocker) {
            const eventTypes = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 
                               'wheel', 'keydown', 'keyup', 'contextmenu', 'dblclick'];
            
            eventTypes.forEach(eventType => {
                window.removeEventListener(eventType, window.aitopiaEventBlocker, { capture: true });
            });
            delete window.aitopiaEventBlocker;
        }
        
        // Restore scroll position
        if (window.aitopiaScrollPosition !== undefined) {
            window.scrollTo(0, window.aitopiaScrollPosition);
            delete window.aitopiaScrollPosition;
        }
    }

    // Comprehensive model information database
    const modelDatabase = {
        'GPT-5': {
            description: 'OpenAI\'s most advanced and powerful language model with unprecedented reasoning capabilities.',
            bestFor: ['Complex reasoning tasks', 'Advanced problem solving', 'Cutting-edge research', 'Professional consulting', 'Next-generation AI applications'],
            strengths: 'State-of-the-art reasoning, breakthrough performance, revolutionary capabilities',
            examples: ['Advanced scientific research', 'Complex strategic planning', 'Breakthrough problem solving', 'Professional AI consulting'],
            pricing: 'Premium next-generation model',
            icon: '🌟'
        },
        'GPT-4o Mini': {
            description: 'OpenAI\'s most cost-effective model that balances speed and capability for everyday tasks.',
            bestFor: ['Quick text generation', 'Simple Q&A', 'Basic coding assistance', 'Content summarization', 'Email drafting'],
            strengths: 'Fast response times, cost-effective, good for high-volume tasks',
            examples: ['Writing product descriptions', 'Answering customer support questions', 'Basic code debugging', 'Social media content'],
            pricing: 'Most affordable option',
            icon: '🔵'
        },
        'GPT-4': {
            description: 'OpenAI\'s flagship model offering superior reasoning and multimodal capabilities.',
            bestFor: ['Complex reasoning tasks', 'Advanced coding projects', 'Creative writing', 'Multi-modal analysis', 'Research assistance'],
            strengths: 'Superior reasoning, handles complex tasks, multimodal capabilities (text, images, audio)',
            examples: ['Building complex applications', 'Academic research', 'Creative storytelling', 'Image analysis and description'],
            pricing: 'Premium tier',
            icon: '🟣'
        },
        'o1 Mini': {
            description: 'Specialized reasoning model optimized for mathematical and logical problem-solving.',
            bestFor: ['Math problems', 'Logic puzzles', 'Scientific reasoning', 'Code debugging', 'Algorithm design'],
            strengths: 'Enhanced reasoning capabilities, excellent for analytical tasks',
            examples: ['Solving calculus problems', 'Debugging complex algorithms', 'Scientific hypothesis testing', 'Logic game solutions'],
            pricing: 'Specialized pricing',
            icon: '🟢'
        },
        'o3 Mini': {
            description: 'Latest reasoning model with improved performance on complex analytical tasks.',
            bestFor: ['Advanced problem solving', 'Research assistance', 'Complex analysis', 'Strategic planning', 'Technical documentation'],
            strengths: 'State-of-the-art reasoning, handles multi-step problems excellently',
            examples: ['Business strategy analysis', 'Technical architecture planning', 'Research paper analysis', 'Complex project planning'],
            pricing: 'Latest model pricing',
            icon: '🟠'
        },
        'Claude 3.5 Haiku': {
            description: 'Anthropic\'s fastest model perfect for quick tasks and real-time applications.',
            bestFor: ['Quick responses', 'Real-time chat', 'Simple tasks', 'High-speed processing', 'Live customer support'],
            strengths: 'Ultra-fast response times, efficient for simple tasks',
            examples: ['Live chat support', 'Quick translations', 'Rapid content generation', 'Real-time Q&A'],
            pricing: 'Speed-optimized pricing',
            icon: '✨'
        },
        'Claude 4 Sonnet': {
            description: 'Anthropic\'s latest balanced model offering excellent performance across a wide range of tasks.',
            bestFor: ['General purpose tasks', 'Content creation', 'Analysis', 'Balanced performance needs', 'Professional writing'],
            strengths: 'Well-rounded capabilities, reliable performance across domains',
            examples: ['Blog writing', 'Business analysis', 'Educational content', 'Professional communications'],
            pricing: 'Balanced pricing',
            icon: '⚫'
        },
        'Claude 4 Opus': {
            description: 'Anthropic\'s most capable model for the most demanding and complex tasks.',
            bestFor: ['Complex research', 'Advanced analysis', 'Creative projects', 'Professional work', 'Academic writing'],
            strengths: 'Highest capability, excellent for demanding tasks',
            examples: ['Academic research papers', 'Complex creative writing', 'Advanced data analysis', 'Professional consulting'],
            pricing: 'Premium capability pricing',
            icon: '🟤'
        },
        'Gemini 1.5 Pro': {
            description: 'Google\'s advanced model with strong multimodal capabilities and large context window.',
            bestFor: ['Long document analysis', 'Multimodal tasks', 'Research', 'Complex reasoning', 'Large file processing'],
            strengths: 'Large context window (up to 1M tokens), strong multimodal understanding',
            examples: ['Analyzing entire books', 'Processing large datasets', 'Video content analysis', 'Multi-document research'],
            pricing: 'Context-based pricing',
            icon: '⚫'
        },
        'Gemini 2.5 Flash': {
            description: 'Google\'s latest model optimized for speed and efficiency with multimodal capabilities.',
            bestFor: ['Fast multimodal tasks', 'Real-time applications', 'Quick analysis', 'Efficient processing', 'Live interactions'],
            strengths: 'Fast processing, multimodal, efficient performance',
            examples: ['Real-time image analysis', 'Quick video processing', 'Live multimodal chat', 'Rapid content creation'],
            pricing: 'Efficiency-focused pricing',
            icon: '🔷'
        },
        'Llama 3.3 70B': {
            description: 'Meta\'s open-source model offering strong performance for various tasks.',
            bestFor: ['Open-source projects', 'General tasks', 'Cost-effective solutions', 'Customizable applications', 'Local deployment'],
            strengths: 'Open-source, customizable, good general performance',
            examples: ['Custom chatbots', 'Local AI applications', 'Educational projects', 'Research experiments'],
            pricing: 'Open-source model',
            icon: '🔵'
        },
        'Llama 3.1 405B': {
            description: 'Meta\'s largest open-source model with exceptional capabilities.',
            bestFor: ['Complex reasoning', 'Advanced tasks', 'Research', 'High-performance needs', 'Enterprise applications'],
            strengths: 'Largest open-source model, exceptional performance',
            examples: ['Enterprise AI solutions', 'Advanced research projects', 'Complex reasoning tasks', 'Large-scale applications'],
            pricing: 'High-performance pricing',
            icon: '🔵'
        },
        'DeepSeek R1': {
            description: 'Specialized reasoning model optimized for analytical and problem-solving tasks.',
            bestFor: ['Deep analysis', 'Problem solving', 'Research tasks', 'Analytical reasoning', 'Technical challenges'],
            strengths: 'Strong analytical capabilities, specialized reasoning',
            examples: ['Technical problem solving', 'Research analysis', 'Complex troubleshooting', 'Analytical consulting'],
            pricing: 'Specialized model pricing',
            icon: '🔍'
        }
    };

    // Setup interactive model items with click handlers
    function setupInteractiveModelItems() {
        console.log('Setting up interactive model items');
        const modelItems = document.querySelectorAll('.aitopia-model-item');
        console.log(`Found ${modelItems.length} model items`);

        modelItems.forEach(item => {
            const spanElement = item.querySelector('span');
            let modelName = spanElement?.textContent?.trim();
            
            // Remove "NEW" badge if present
            if (modelName && modelName.includes('NEW')) {
                modelName = modelName.replace(/\s*NEW\s*/g, '').trim();
            }
            
            console.log('Processing model:', modelName, 'Available in DB:', !!modelDatabase[modelName]);
            
            if (modelName && modelDatabase[modelName]) {
                // Make item visually clickable
                item.style.cursor = 'pointer';
                item.setAttribute('data-model', modelName);

                // Add click handler to open modal
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openModelInfoModal(modelName);
                });

                // Add hover effects
                item.addEventListener('mouseenter', function() {
                    item.style.transform = 'translateY(-2px)';
                    item.style.boxShadow = '0 4px 12px rgba(0, 212, 255, 0.3)';
                });

                item.addEventListener('mouseleave', function() {
                    item.style.transform = 'translateY(0)';
                    item.style.boxShadow = 'none';
                });
            }
        });
    }

    // Open model information modal
    function openModelInfoModal(modelName) {
        const modelInfo = modelDatabase[modelName];
        if (!modelInfo) return;

        // Check if modal already exists
        let modal = document.getElementById('aitopia-model-modal');
        if (modal) {
            modal.remove();
            // Restore body scroll in case previous modal didn't clean up properly
            document.body.style.overflow = '';
        }

        // Create modal
        modal = document.createElement('div');
        modal.id = 'aitopia-model-modal';
        modal.className = 'aitopia-model-modal';

        modal.innerHTML = `
            <div class="aitopia-modal-content">
                <div class="aitopia-modal-header">
                    <div class="aitopia-modal-icon">${modelInfo.icon}</div>
                    <h3>${modelName}</h3>
                    <button class="aitopia-modal-close" id="aitopia-modal-close">×</button>
                </div>

                <div class="aitopia-modal-body">
                    <div class="aitopia-modal-section">
                        <h4>Description</h4>
                        <p>${modelInfo.description}</p>
                    </div>

                    <div class="aitopia-modal-section">
                        <h4>Best For</h4>
                        <ul class="aitopia-modal-list">
                            ${modelInfo.bestFor.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="aitopia-modal-section">
                        <h4>Key Strengths</h4>
                        <p class="aitopia-modal-strengths">${modelInfo.strengths}</p>
                    </div>

                    <div class="aitopia-modal-section">
                        <h4>Example Use Cases</h4>
                        <ul class="aitopia-modal-list aitopia-modal-examples">
                            ${modelInfo.examples.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="aitopia-modal-section aitopia-modal-pricing">
                        <h4>Pricing</h4>
                        <p>${modelInfo.pricing}</p>
                    </div>
                </div>

                <div class="aitopia-modal-disclaimer">
                    <p>Independent AI Platform - Not affiliated with OpenAI, ChatGPT, or Anthropic</p>
                </div>

                <div class="aitopia-modal-footer">
                    <button class="aitopia-modal-cta" id="aitopia-modal-try-btn-${modelName.replace(/[\s.]+/g, '-').toLowerCase()}">
                        Try ${modelName} on AITOPIA
                    </button>
                </div>
            </div>
        `;

        // Add modal to document body for proper overlay
        document.body.appendChild(modal);
        
        // Add modal isolation
        setupModalIsolation(modal);
        
        // Prevent body scroll when modal is open (but don't interfere with main popup scroll prevention)
        if (!document.body.classList.contains('aitopia-popup-active')) {
            document.body.style.overflow = 'hidden';
        }

        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('aitopia-modal-visible');
            
            // Focus modal body for keyboard navigation after animation
            const modalBody = modal.querySelector('.aitopia-modal-body');
            if (modalBody) {
                modalBody.focus();
            }
        }, 10);

        // Setup close handlers
        setupModalCloseHandlers(modal);
        
        // Setup Try button handler for model modal
        setupModelTryButton(modal, modelName);
        
        // Add event delegation for Try buttons as backup
        setupTryButtonEventDelegation(modal, modelName);
    }

    // Setup modal close handlers
    function setupModalCloseHandlers(modal) {
        console.log('Setting up modal close handlers');
        const closeBtn = modal.querySelector('.aitopia-modal-close');
        console.log('Close button found:', !!closeBtn);

        // Define the close handler function outside to avoid scope issues
        function handleModalClose(e) {
            console.log('Modal close button clicked!');
            e.preventDefault();
            e.stopPropagation();
            closeModelModal(modal);
        }

        // Close button with multiple event binding approaches
        if (closeBtn) {
            // Ensure the button is clickable by forcing CSS properties
            closeBtn.style.pointerEvents = 'auto';
            closeBtn.style.zIndex = '2147483649';
            closeBtn.style.position = 'relative';
            
            // Clear any existing handlers first
            closeBtn.onclick = null;
            
            // Clone the button to remove all event listeners
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            // Add comprehensive event listeners to the new button
            console.log('Adding event listeners to close button');
            
            // Mouse events
            newCloseBtn.addEventListener('click', handleModalClose, true);
            newCloseBtn.addEventListener('click', handleModalClose, false); // Add both capture and bubble phases
            newCloseBtn.addEventListener('mousedown', function(e) {
                console.log('Modal close button mousedown detected');
                e.stopPropagation();
            }, true);
            
            // Backup onclick handler
            newCloseBtn.onclick = function(e) {
                console.log('Modal close button onclick fired!');
                e.preventDefault();
                e.stopPropagation();
                closeModelModal(modal);
                return false;
            };
            
            // Add touch events for mobile
            newCloseBtn.addEventListener('touchstart', function(e) {
                console.log('Modal close button touchstart detected');
                e.stopPropagation();
            }, true);
            
            newCloseBtn.addEventListener('touchend', function(e) {
                console.log('Modal close button touchend fired!');
                e.preventDefault();
                e.stopPropagation();
                closeModelModal(modal);
            }, true);
            
            // Add pointer events for better compatibility
            if (window.PointerEvent) {
                newCloseBtn.addEventListener('pointerdown', function(e) {
                    console.log('Modal close button pointerdown detected');
                    e.stopPropagation();
                }, true);
            }
            
            console.log('All event listeners added to close button');
        }

        // Click outside modal content to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                console.log('Clicked outside modal content, closing');
                closeModelModal(modal);
            }
        });

        // Escape key to close
        const escapeHandler = function(e) {
            if (e.key === 'Escape') {
                console.log('Escape key pressed, closing modal');
                closeModelModal(modal);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Store the escape handler reference on the modal for cleanup
        modal._escapeHandler = escapeHandler;
    }

    // Setup Try button handler for model info modal
    function setupModelTryButton(modal, modelName) {
        const tryBtnId = `aitopia-modal-try-btn-${modelName.replace(/[\s.]+/g, '-').toLowerCase()}`;
        const tryBtn = modal.querySelector(`#${tryBtnId}`);
        
        if (tryBtn) {
            console.log('Setting up Try button for model:', modelName);
            
            // Ensure button is clickable
            tryBtn.style.pointerEvents = 'auto';
            tryBtn.style.cursor = 'pointer';
            tryBtn.style.position = 'relative';
            tryBtn.style.zIndex = '2147483649';
            
            // Define click handler
            function handleTryClick(e) {
                console.log(`Try ${modelName} button clicked!`);
                e.preventDefault();
                e.stopPropagation();
                
                // Close the model modal first
                closeModelModal(modal);
                
                // Then trigger the main CTA action
                setTimeout(() => {
                    const mainCtaBtn = document.getElementById('aitopia-cta-btn');
                    if (mainCtaBtn) {
                        mainCtaBtn.click();
                    } else {
                        // Fallback: Send message to background script
                        if (chrome && chrome.runtime) {
                            chrome.runtime.sendMessage({
                                messageType: "OpenAitopiaPricing",
                                source: "modelTryButton",
                                modelName: modelName
                            }).catch(err => {
                                console.log('Extension context may be invalid:', err);
                            });
                        }
                    }
                }, 100);
            }
            
            // Add event listeners with multiple approaches
            tryBtn.addEventListener('click', handleTryClick, true);
            tryBtn.addEventListener('click', handleTryClick, false);
            
            // Backup onclick handler
            tryBtn.onclick = function(e) {
                console.log(`Try ${modelName} onclick fired!`);
                handleTryClick(e);
                return false;
            };
            
            // Touch events for mobile
            tryBtn.addEventListener('touchend', function(e) {
                console.log(`Try ${modelName} touchend fired!`);
                e.preventDefault();
                e.stopPropagation();
                handleTryClick(e);
            }, true);
        }
    }
    
    // Setup Try button handler for more models modal
    function setupMoreModelsTryButton(modal) {
        const tryBtn = modal.querySelector('#aitopia-more-models-try-btn');
        
        if (tryBtn) {
            console.log('Setting up Try button for more models modal');
            
            // Ensure button is clickable
            tryBtn.style.pointerEvents = 'auto';
            tryBtn.style.cursor = 'pointer';
            tryBtn.style.position = 'relative';
            tryBtn.style.zIndex = '2147483650';
            
            // Define click handler
            function handleMoreModelsTryClick(e) {
                console.log('More Models Try button clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                // Close the more models modal first
                closeMoreModelsModal(modal);
                
                // Then trigger the main CTA action
                setTimeout(() => {
                    const mainCtaBtn = document.getElementById('aitopia-cta-btn');
                    if (mainCtaBtn) {
                        mainCtaBtn.click();
                    } else {
                        // Fallback: Send message to background script
                        if (chrome && chrome.runtime) {
                            chrome.runtime.sendMessage({
                                messageType: "OpenAitopiaPricing",
                                source: "moreModelsTryButton"
                            }).catch(err => {
                                console.log('Extension context may be invalid:', err);
                            });
                        }
                    }
                }, 100);
            }
            
            // Add event listeners with multiple approaches
            tryBtn.addEventListener('click', handleMoreModelsTryClick, true);
            tryBtn.addEventListener('click', handleMoreModelsTryClick, false);
            
            // Backup onclick handler
            tryBtn.onclick = function(e) {
                console.log('More Models Try button onclick fired!');
                handleMoreModelsTryClick(e);
                return false;
            };
            
            // Touch events for mobile
            tryBtn.addEventListener('touchend', function(e) {
                console.log('More Models Try button touchend fired!');
                e.preventDefault();
                e.stopPropagation();
                handleMoreModelsTryClick(e);
            }, true);
        }
    }
    
    // Setup event delegation for Try buttons as backup method
    function setupTryButtonEventDelegation(modal, modelName) {
        const tryBtnId = `aitopia-modal-try-btn-${modelName.replace(/[\s.]+/g, '-').toLowerCase()}`;
        
        // Add event delegation on the modal itself
        modal.addEventListener('click', function(e) {
            if (e.target && e.target.id === tryBtnId) {
                console.log(`Try button clicked via delegation for ${modelName}!`);
                e.preventDefault();
                e.stopPropagation();
                
                // Close the model modal first
                closeModelModal(modal);
                
                // Then trigger the main CTA action
                setTimeout(() => {
                    const mainCtaBtn = document.getElementById('aitopia-cta-btn');
                    if (mainCtaBtn) {
                        mainCtaBtn.click();
                    } else {
                        // Fallback: Send message to background script
                        if (chrome && chrome.runtime) {
                            chrome.runtime.sendMessage({
                                messageType: "OpenAitopiaPricing",
                                source: "modelTryButtonDelegation",
                                modelName: modelName
                            }).catch(err => {
                                console.log('Extension context may be invalid:', err);
                            });
                        }
                    }
                }, 100);
            }
        }, true);
    }
    
    // Setup event delegation for more models Try button as backup method  
    function setupMoreModelsTryButtonEventDelegation(modal) {
        // Add event delegation on the modal itself
        modal.addEventListener('click', function(e) {
            if (e.target && e.target.id === 'aitopia-more-models-try-btn') {
                console.log('More models Try button clicked via delegation!');
                e.preventDefault();
                e.stopPropagation();
                
                // Close the more models modal first
                closeMoreModelsModal(modal);
                
                // Then trigger the main CTA action
                setTimeout(() => {
                    const mainCtaBtn = document.getElementById('aitopia-cta-btn');
                    if (mainCtaBtn) {
                        mainCtaBtn.click();
                    } else {
                        // Fallback: Send message to background script
                        if (chrome && chrome.runtime) {
                            chrome.runtime.sendMessage({
                                messageType: "OpenAitopiaPricing",
                                source: "moreModelsTryButtonDelegation"
                            }).catch(err => {
                                console.log('Extension context may be invalid:', err);
                            });
                        }
                    }
                }, 100);
            }
        }, true);
    }

    // Close model modal with proper cleanup
    function closeModelModal(modal) {
        console.log('Closing model modal');
        if (!modal) return;
        
        modal.classList.remove('aitopia-modal-visible');
        
        // Remove all event listeners from the old modal
        const closeBtn = modal.querySelector('.aitopia-modal-close');
        if (closeBtn) {
            closeBtn.onclick = null;
            closeBtn.removeAttribute('onclick');
        }
        
        // Clean up the escape key listener if it exists
        if (modal._escapeHandler) {
            document.removeEventListener('keydown', modal._escapeHandler);
            modal._escapeHandler = null;
        }
        
        setTimeout(() => {
            if (modal && modal.parentNode) {
                console.log('Removing modal from DOM');
                modal.remove();
                // Restore body scroll when modal is removed
                document.body.style.overflow = '';
            }
        }, 300);
    }

    // Modal scrolling functions removed - modals now fit without scrolling

    // Show More Models in a dedicated modal popup
    // This function creates a separate modal showing 10 additional AI models
    // in a compact 5x2 grid layout without scrollbars, each model is clickable
    // to show detailed information using the existing model info modal system
    function showMoreModelsModal() {
        console.log('Opening More Models modal');
        
        // Check if modal already exists
        let modal = document.getElementById('aitopia-more-models-modal');
        if (modal) {
            modal.remove();
        }

        // Define the 10 additional models (excluding the 3 already shown)
        const moreModels = [
            { name: 'GPT-4o Mini', icon: '🔵', category: 'gpt' },
            { name: 'GPT-4', icon: '🟣', category: 'gpt' },
            { name: 'o1 Mini', icon: '🟢', category: 'openai' },
            { name: 'o3 Mini', icon: '🟠', category: 'openai' },
            { name: 'Claude 3.5 Haiku', icon: '✨', category: 'claude' },
            { name: 'Claude 4 Opus', icon: '🟤', category: 'claude' },
            { name: 'Gemini 1.5 Pro', icon: '⚫', category: 'gemini' },
            { name: 'Llama 3.3 70B', icon: '🔵', category: 'llama' },
            { name: 'Llama 3.1 405B', icon: '🔵', category: 'llama' },
            { name: 'DeepSeek R1', icon: '🔍', category: 'deepseek' }
        ];

        // Create modal
        modal = document.createElement('div');
        modal.id = 'aitopia-more-models-modal';
        modal.className = 'aitopia-more-models-modal';

        modal.innerHTML = `
            <div class="aitopia-more-models-content">
                <div class="aitopia-more-models-header">
                    <div class="aitopia-more-models-title">
                        <span class="aitopia-more-models-icon">🚀</span>
                        <h3>10 Additional Premium AI Models</h3>
                    </div>
                    <button class="aitopia-more-models-close" id="aitopia-more-models-close">×</button>
                </div>

                <div class="aitopia-more-models-body">
                    <p class="aitopia-more-models-subtitle">Choose the perfect AI model for any task with AITOPIA</p>
                    
                    <div class="aitopia-more-models-grid">
                        ${moreModels.map(model => `
                            <div class="aitopia-more-model-item ${model.category}" data-model="${model.name}">
                                <div class="aitopia-more-model-icon">${model.icon}</div>
                                <span class="aitopia-more-model-name">${model.name}</span>
                                <div class="aitopia-more-model-click-hint">Click for details</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="aitopia-more-models-footer-text">
                        <p>Get access to all these premium models plus GPT-5, Claude 4 Sonnet, and Gemini 2.5 Flash for just $16.66/month</p>
                    </div>
                </div>

                <div class="aitopia-more-models-disclaimer">
                    <p>Third-party AI service - Not an official OpenAI or ChatGPT product</p>
                </div>

                <div class="aitopia-more-models-footer">
                    <button class="aitopia-more-models-cta" id="aitopia-more-models-try-btn">
                        Get All Models with AITOPIA
                    </button>
                </div>
            </div>
        `;

        // Add modal to document body
        document.body.appendChild(modal);
        
        // Add modal isolation
        setupModalIsolation(modal);
        
        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('aitopia-more-models-visible');
            // Ensure focus is trapped within modal
            trapFocusInModal(modal);
        }, 10);

        // Setup close handlers for the more models modal
        setupMoreModelsCloseHandlers(modal);
        
        // Setup interactive model items in the more models modal
        setupMoreModelsInteractive(modal);
        
        // Setup Try button handler for more models modal
        setupMoreModelsTryButton(modal);
        
        // Add event delegation for more models Try button as backup
        setupMoreModelsTryButtonEventDelegation(modal);
    }

    // Make showMoreModelsModal available globally for testing and external access
    window.showMoreModelsModal = showMoreModelsModal;

    // Setup close handlers for More Models modal
    function setupMoreModelsCloseHandlers(modal) {
        console.log('Setting up More Models modal close handlers');
        const closeBtn = modal.querySelector('.aitopia-more-models-close');
        
        function handleMoreModelsClose(e) {
            console.log('More Models modal close button clicked!');
            e.preventDefault();
            e.stopPropagation();
            closeMoreModelsModal(modal);
        }

        // Close button handlers
        if (closeBtn) {
            closeBtn.style.pointerEvents = 'auto';
            closeBtn.style.zIndex = '2147483650';
            closeBtn.style.position = 'relative';
            
            closeBtn.onclick = null;
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            newCloseBtn.addEventListener('click', handleMoreModelsClose, true);
            newCloseBtn.onclick = function(e) {
                console.log('More Models close onclick fired!');
                e.preventDefault();
                e.stopPropagation();
                closeMoreModelsModal(modal);
                return false;
            };
        }

        // Click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                console.log('Clicked outside More Models modal, closing');
                closeMoreModelsModal(modal);
            }
        });

        // Escape key to close
        const escapeHandler = function(e) {
            if (e.key === 'Escape') {
                console.log('Escape key pressed, closing More Models modal');
                closeMoreModelsModal(modal);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        modal._escapeHandler = escapeHandler;
    }

    // Make close handlers available globally
    window.setupMoreModelsCloseHandlers = setupMoreModelsCloseHandlers;

    // Setup interactive model items in More Models modal
    function setupMoreModelsInteractive(modal) {
        console.log('Setting up interactive More Models items');
        const modelItems = modal.querySelectorAll('.aitopia-more-model-item');
        
        modelItems.forEach(item => {
            const modelName = item.getAttribute('data-model');
            
            if (modelName && modelDatabase[modelName]) {
                item.style.cursor = 'pointer';
                
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Close the More Models modal first
                    closeMoreModelsModal(modal);
                    // Then open the specific model info modal
                    setTimeout(() => {
                        openModelInfoModal(modelName);
                    }, 100);
                });

                // Add hover effects
                item.addEventListener('mouseenter', function() {
                    item.style.transform = 'translateY(-3px)';
                    item.style.boxShadow = '0 6px 16px rgba(0, 212, 255, 0.4)';
                });

                item.addEventListener('mouseleave', function() {
                    item.style.transform = 'translateY(0)';
                    item.style.boxShadow = 'none';
                });
            }
        });
    }

    // Make interactive setup available globally  
    window.setupMoreModelsInteractive = setupMoreModelsInteractive;

    // Close More Models modal
    function closeMoreModelsModal(modal) {
        console.log('Closing More Models modal');
        if (!modal) return;
        
        modal.classList.remove('aitopia-more-models-visible');
        
        // Clean up escape key listener
        if (modal._escapeHandler) {
            document.removeEventListener('keydown', modal._escapeHandler);
            modal._escapeHandler = null;
        }
        
        setTimeout(() => {
            if (modal && modal.parentNode) {
                console.log('Removing More Models modal from DOM');
                modal.remove();
            }
        }, 300);
    }

    // Make close modal function available globally
    window.closeMoreModelsModal = closeMoreModelsModal;

    // Setup comprehensive modal isolation to prevent click bleeding
    function setupModalIsolation(modalElement) {
        // Prevent all events from bubbling through the modal overlay
        modalElement.addEventListener('click', function(e) {
            // Allow clicks only within modal content areas
            const isModalContent = e.target.closest('.aitopia-popup-content') || 
                                 e.target.closest('.aitopia-modal-content') || 
                                 e.target.closest('.aitopia-more-models-content');
            
            if (!isModalContent) {
                // Click is on overlay - stop all propagation
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        }, true);

        // Prevent all other events from bleeding through
        const preventEvents = ['mousedown', 'mouseup', 'touchstart', 'touchend', 
                              'wheel', 'contextmenu', 'dblclick', 'keydown'];
        
        preventEvents.forEach(eventType => {
            modalElement.addEventListener(eventType, function(e) {
                const isModalContent = e.target.closest('.aitopia-popup-content') || 
                                     e.target.closest('.aitopia-modal-content') || 
                                     e.target.closest('.aitopia-more-models-content');
                
                if (!isModalContent) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);
        });
        
        // Add content area event management
        const contentArea = modalElement.querySelector('.aitopia-popup-content, .aitopia-modal-content, .aitopia-more-models-content');
        if (contentArea) {
            contentArea.addEventListener('click', function(e) {
                // Allow legitimate interactions within content
                const isInteractiveElement = e.target.closest('button, .aitopia-model-item, .aitopia-more-model-item, input, a');
                if (!isInteractiveElement) {
                    // Stop propagation for non-interactive content clicks
                    e.stopPropagation();
                }
            });
        }
    }

    // Trap focus within modal for accessibility and isolation
    function trapFocusInModal(modalElement) {
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        modalElement.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }
            
            // Ensure other keys don't escape the modal
            e.stopPropagation();
        });
        
        // Focus first element
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }

    // Show all models in the grid
    function showAllModels() {
        console.log('showAllModels function called');
        const modelsGrid = document.querySelector('.aitopia-models-grid');
        const moreButton = document.querySelector('.aitopia-more-models');
        const moreButtonById = document.getElementById('aitopia-more-models-btn');
        
        console.log('Elements found:', { 
            modelsGrid: !!modelsGrid, 
            moreButton: !!moreButton, 
            moreButtonById: !!moreButtonById
        });
        
        if (!modelsGrid) {
            console.log('Missing models grid element');
            return;
        }
        
        // Replace the grid content with all models
        modelsGrid.innerHTML = `
            <div class="aitopia-model-item gpt aitopia-model-featured">
                <div class="aitopia-model-icon">🌟</div>
                <span>GPT-5 <span class="aitopia-new-badge">NEW</span></span>
            </div>
            <div class="aitopia-model-item gpt">
                <div class="aitopia-model-icon">🔵</div>
                <span>GPT-4o Mini</span>
            </div>
            <div class="aitopia-model-item gpt">
                <div class="aitopia-model-icon">🟣</div>
                <span>GPT-4</span>
            </div>
            <div class="aitopia-model-item openai">
                <div class="aitopia-model-icon">🟢</div>
                <span>o1 Mini</span>
            </div>
            <div class="aitopia-model-item openai">
                <div class="aitopia-model-icon">🟠</div>
                <span>o3 Mini</span>
            </div>
            <div class="aitopia-model-item claude">
                <div class="aitopia-model-icon">✨</div>
                <span>Claude 3.5 Haiku</span>
            </div>
            <div class="aitopia-model-item claude">
                <div class="aitopia-model-icon">⚫</div>
                <span>Claude 4 Sonnet</span>
            </div>
            <div class="aitopia-model-item claude">
                <div class="aitopia-model-icon">🟤</div>
                <span>Claude 4 Opus</span>
            </div>
            <div class="aitopia-model-item gemini">
                <div class="aitopia-model-icon">⚫</div>
                <span>Gemini 1.5 Pro</span>
            </div>
            <div class="aitopia-model-item gemini">
                <div class="aitopia-model-icon">🔷</div>
                <span>Gemini 2.5 Flash</span>
            </div>
            <div class="aitopia-model-item llama">
                <div class="aitopia-model-icon">🔵</div>
                <span>Llama 3.3 70B</span>
            </div>
            <div class="aitopia-model-item llama">
                <div class="aitopia-model-icon">🔵</div>
                <span>Llama 3.1 405B</span>
            </div>
            <div class="aitopia-model-item deepseek">
                <div class="aitopia-model-icon">🔍</div>
                <span>DeepSeek R1</span>
            </div>
        `;
        
        console.log('Models grid updated with all models');
        
        // Update grid to show more columns for all models and add expanded class
        modelsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        modelsGrid.classList.add('expanded');
        console.log('Grid columns updated and expanded class added');
        
        // Scroll to show more models if needed
        const scrollableArea = document.querySelector('.aitopia-popup-scrollable');
        if (scrollableArea) {
            scrollableArea.scrollTo({
                top: modelsGrid.offsetTop - 20,
                behavior: 'smooth'
            });
        }
        
        // Hide the more button
        if (moreButton) {
            moreButton.style.display = 'none';
            console.log('More button hidden');
        }
        if (moreButtonById) {
            moreButtonById.style.display = 'none';
            console.log('More button (by ID) hidden');
        }
        
        // Re-setup interactive model items
        setTimeout(() => {
            console.log('Setting up interactive model items');
            setupInteractiveModelItems();
        }, 100);
    }

    // Setup event listeners for popup interactions
    function setupPopupEventListeners() {
        const popup = document.getElementById('aitopia-deal-popup');
        const closeBtn = document.getElementById('aitopia-close-btn');
        const ctaBtn = document.getElementById('aitopia-cta-btn');
        const dismissBtn = document.getElementById('aitopia-dismiss-btn');
        const moreModelsBtn = document.getElementById('aitopia-more-models-btn');

        console.log('Setting up event listeners:', {
            popup: !!popup,
            closeBtn: !!closeBtn,
            ctaBtn: !!ctaBtn,
            dismissBtn: !!dismissBtn,
            moreModelsBtn: !!moreModelsBtn
        });

        // Close popup function with proper cleanup
        function closePopup() {
            console.log('Closing popup...');
            popup.classList.remove('aitopia-popup-visible');

            // Restore page interactions immediately
            restorePageInteractions();

            setTimeout(() => {
                if (popup && popup.parentNode) {
                    popup.remove();
                }
            }, 300);
        }

        // Close button - also dismisses the popup like "Maybe later"
        if (closeBtn) {
            function handleCloseClick(e) {
                console.log('Close button clicked!');
                e.preventDefault();
                e.stopPropagation();
                markPopupAsDismissed(); // Mark as dismissed (2 sessions, then permanent)
                closePopup();
            }

            closeBtn.addEventListener('click', handleCloseClick, true);

            // Backup onclick handler
            closeBtn.onclick = function(e) {
                console.log('Close button onclick fired!');
                handleCloseClick(e);
            };
        }

        // CTA button - navigate to AITOPIA pricing page
        if (ctaBtn) {
            function handleCtaClick(e) {
                console.log('AITOPIA CTA button clicked!');
                e.preventDefault();
                e.stopPropagation();

                // Send message to background script to open AITOPIA pricing page
                if (chrome && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        messageType: "OpenAitopiaPricing",
                        source: "pricingPopup"
                    }).catch(err => {
                        console.log('Extension context may be invalid:', err);
                    });
                }

                // Close the popup
                closePopup();
            }
            
            ctaBtn.addEventListener('click', handleCtaClick, true);
            
            // Backup onclick handler
            ctaBtn.onclick = function(e) {
                console.log('CTA button onclick fired!');
                handleCtaClick(e);
            };
        }

        // Dismiss button - now dismisses permanently like the banner
        if (dismissBtn) {
            function handleDismissClick(e) {
                console.log('Dismiss button clicked!');
                e.preventDefault();
                e.stopPropagation();
                markPopupAsDismissed(); // Mark as dismissed (2 sessions, then permanent)
                closePopup();
            }

            dismissBtn.addEventListener('click', handleDismissClick, true);

            // Backup onclick handler
            dismissBtn.onclick = function(e) {
                console.log('Dismiss button onclick fired!');
                handleDismissClick(e);
            };
        }

        // More Models button - multiple approaches for reliability
        function handleMoreModelsClick(e) {
            console.log('More Models button clicked!');
            e.preventDefault();
            e.stopPropagation();
            
            try {
                showMoreModelsModal();
            } catch (error) {
                console.error('Error calling showMoreModelsModal:', error);
            }
        }

        // Ensure button is properly accessible
        if (moreModelsBtn) {
            // Force CSS properties to ensure clickability
            moreModelsBtn.style.pointerEvents = 'auto';
            moreModelsBtn.style.position = 'relative';
            moreModelsBtn.style.zIndex = '2147483647';
            moreModelsBtn.style.cursor = 'pointer';
            console.log('More Models button CSS properties forced');
        }
        
        // Event delegation on popup container
        popup.addEventListener('click', function(e) {
            if (e.target && (e.target.id === 'aitopia-more-models-btn' || e.target.closest('#aitopia-more-models-btn'))) {
                console.log('More Models button clicked via delegation!');
                handleMoreModelsClick(e);
            }
        }, true);
        
        // Direct event listener if button exists
        if (moreModelsBtn) {
            console.log('Setting up direct more models button listener');
            moreModelsBtn.addEventListener('click', handleMoreModelsClick, true);
            
            // Backup onclick handler
            moreModelsBtn.onclick = function(e) {
                console.log('More Models button onclick fired!');
                handleMoreModelsClick(e);
            };
        } else {
            console.log('More Models button not found during initial setup!');
        }
        
        // Additional delayed setup in case button appears later
        setTimeout(() => {
            const delayedMoreBtn = document.getElementById('aitopia-more-models-btn');
            if (delayedMoreBtn && !delayedMoreBtn.onclick) {
                console.log('Setting up delayed more models button listener');
                delayedMoreBtn.addEventListener('click', handleMoreModelsClick, true);
                delayedMoreBtn.onclick = handleMoreModelsClick;
            }
        }, 500);

        // Enhanced click handling for popup background with isolation
        popup.addEventListener('click', function(e) {
            // Only close if clicking directly on the popup background (not its children)
            if (e.target === popup) {
                console.log('Popup background clicked - closing');
                closePopup();
            } else {
                // Stop any unintended propagation within popup
                const isInteractiveElement = e.target.closest('button, .aitopia-model-item, input, a');
                if (!isInteractiveElement) {
                    e.stopPropagation();
                }
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('aitopia-deal-popup')) {
                closePopup();
            }
        });
    }

    // Initialize when page loads
    function init() {
        if (isPricingPage()) {
            // Wait a bit for page to fully load
            setTimeout(createAitopiaPopup, 2000);
        }
    }

    // Handle navigation changes (for single-page apps)
    function handleNavigation() {
        if (isPricingPage()) {
            setTimeout(createAitopiaPopup, 1000);
        }
    }

    // Listen for URL changes
    let currentUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (currentUrl !== window.location.href) {
            currentUrl = window.location.href;
            handleNavigation();
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also listen for hash changes
    window.addEventListener('hashchange', handleNavigation);

})();
