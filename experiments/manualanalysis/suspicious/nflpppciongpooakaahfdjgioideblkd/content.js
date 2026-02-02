console.log('🔍 AI Search Fan-out Tracker - Content Script Loaded!', window.location.href);

(() => {
    const searchQueryStore = new Map();
    let observer = null;
    let lastProcessedUrl = '';
    let currentPlatform = detectPlatform();

    // Production server configuration  
    const API_BASE_URL = 'https://server-theta-nine-63.vercel.app';
    console.log(`🌐 API Base URL: ${API_BASE_URL}`);

    // Detect current platform
    function detectPlatform() {
        const hostname = window.location.hostname;
        if (hostname.includes('chatgpt.com')) {
            return 'chatgpt';
        } else if (hostname.includes('gemini.google.com')) {
            return 'gemini';
        }
        return 'unknown';
    }

    function isExtensionValid() {
        try {
            return !!chrome.runtime.id;
        } catch (e) {
            console.log("Extension context invalidated");
            if (observer) {
                observer.disconnect();
            }
            return false;
        }
    }

    // Function to extract conversation ID from URL
    function getConversationId() {
        currentPlatform = detectPlatform();
        
        if (currentPlatform === 'chatgpt') {
        const match = location.pathname.match(/\/c\/([^/]+)/);
        return match ? match[1] : null;
        } else if (currentPlatform === 'gemini') {
            // For Gemini, extract conversation ID from URL path like /app/0962070f74b6f29d
            const pathMatch = location.pathname.match(/\/app\/([^/]+)/);
            return pathMatch ? pathMatch[1] : `gemini_${Date.now()}`;
        }
        
        return null;
    }

    // ChatGPT search query extraction (existing method)
    async function extractChatGPTQueries() {
        try {
            const cid = getConversationId();
            if (!cid) {
                console.log('❌ No ChatGPT conversation ID found');
                return [];
            }

            console.log('🔍 Extracting ChatGPT search queries from conversation:', cid);

            // Get session token (same as bookmarklet)
            const sess = await fetch('/api/auth/session').then(r => r.json());
            if (!sess.accessToken) {
                console.log('❌ No access token found');
                return [];
            }

            // Fetch conversation data (same as bookmarklet)
            const res = await fetch(`/backend-api/conversation/${cid}`, {
                headers: {
                    'Authorization': 'Bearer ' + sess.accessToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!res.ok) {
                console.log('❌ Failed to fetch conversation data:', res.status, res.statusText);
                return [];
            }

            const data = await res.json();
            console.log('📊 ChatGPT conversation data loaded successfully');
            
            // Detect model type
            const modelSlug = data.default_model_slug || 'unknown';
            console.log(`🤖 Detected model: ${modelSlug}`);
            
            const queries = new Set();
            const queryDetails = [];

            // Extract queries function (same logic as bookmarklet)
            const extractQueries = (obj, messageContext = {}) => {
                if (typeof obj !== 'object' || obj === null) return;

                // Check for search_queries array (old format)
                if (Array.isArray(obj.search_queries)) {
                    console.log(`📍 Found search_queries array with ${obj.search_queries.length} items (model: ${modelSlug})`);
                    obj.search_queries.forEach(sq => {
                        if (sq && sq.q && !queries.has(sq.q)) {
                            queries.add(sq.q);
                            queryDetails.push({
                                query: sq.q,
                                type: 'search_query',
                                platform: 'chatgpt',
                                model: modelSlug, // Add model information
                                messageId: messageContext.messageId || '',
                                userPrompt: messageContext.userPrompt || '',
                                timestamp: messageContext.timestamp || new Date().toISOString(),
                                conversationId: cid,
                                metadata: {
                                    source: 'search_queries',
                                    rawData: sq,
                                    modelSlug: modelSlug
                                }
                            });
                            console.log(`📍 Found ${modelSlug} search query: "${sq.q}"`);
                        }
                    });
                }

                // Check for metadata.search_queries (old format)
                if (obj.metadata && Array.isArray(obj.metadata.search_queries)) {
                    console.log(`📍 Found metadata.search_queries array with ${obj.metadata.search_queries.length} items (model: ${modelSlug})`);
                    obj.metadata.search_queries.forEach(sq => {
                        if (sq && sq.q && !queries.has(sq.q)) {
                            queries.add(sq.q);
                            queryDetails.push({
                                query: sq.q,
                                type: 'metadata_search_query',
                                platform: 'chatgpt',
                                model: modelSlug, // Add model information
                                messageId: messageContext.messageId || '',
                                userPrompt: messageContext.userPrompt || '',
                                timestamp: messageContext.timestamp || new Date().toISOString(),
                                conversationId: cid,
                                metadata: {
                                    source: 'metadata.search_queries',
                                    rawData: sq,
                                    modelSlug: modelSlug
                                }
                            });
                            console.log(`📍 Found ${modelSlug} metadata search query: "${sq.q}"`);
                        }
                    });
                }

                // Check for metadata.search_model_queries.queries (new format - flat array of strings)
                if (obj.metadata && obj.metadata.search_model_queries && Array.isArray(obj.metadata.search_model_queries.queries)) {
                    console.log(`📍 Found metadata.search_model_queries.queries array with ${obj.metadata.search_model_queries.queries.length} items (model: ${modelSlug})`);
                    obj.metadata.search_model_queries.queries.forEach(queryString => {
                        if (queryString && typeof queryString === 'string' && !queries.has(queryString)) {
                            queries.add(queryString);
                            queryDetails.push({
                                query: queryString,
                                type: 'search_model_query',
                                platform: 'chatgpt',
                                model: modelSlug, // Add model information
                                messageId: messageContext.messageId || '',
                                userPrompt: messageContext.userPrompt || '',
                                timestamp: messageContext.timestamp || new Date().toISOString(),
                                conversationId: cid,
                                metadata: {
                                    source: 'metadata.search_model_queries.queries',
                                    rawData: queryString,
                                    modelSlug: modelSlug,
                                    format: 'new_format'
                                }
                            });
                            console.log(`📍 Found ${modelSlug} search model query (new format): "${queryString}"`);
                        }
                    });
                }

                // Capture user message context
                if (obj.author && obj.author.role === 'user' && obj.content && obj.content.parts) {
                    messageContext.userPrompt = obj.content.parts.join(' ');
                    messageContext.messageId = obj.id || '';
                    messageContext.timestamp = obj.create_time ? new Date(obj.create_time * 1000).toISOString() : new Date().toISOString();
                    console.log(`👤 Found user message: "${messageContext.userPrompt.substring(0, 50)}..."`);
                }

                // Recursively search through all properties (same as bookmarklet)
                for (const key in obj) {
                    if (key !== 'search_queries' && key !== 'metadata') {
                        extractQueries(obj[key], messageContext);
                    }
                }
                
                // Also recursively search within metadata for nested structures
                if (obj.metadata && typeof obj.metadata === 'object') {
                    for (const key in obj.metadata) {
                        if (key !== 'search_queries' && key !== 'search_model_queries') {
                            extractQueries(obj.metadata[key], messageContext);
                        }
                    }
                }
            };

            // Extract queries (same as bookmarklet)
            extractQueries(data);
            
            console.log(`✅ ${modelSlug} extraction complete: ${queryDetails.length} queries found (${queries.size} unique)`);
            
            return queryDetails;

        } catch (error) {
            console.error('❌ Error extracting ChatGPT search queries:', error);
            return [];
        }
    }

    // Global network interception setup (set up immediately)

    
    // Network interception removed - using direct API approach for Gemini

    // Extract user prompt from Gemini page
    function extractGeminiUserPrompt() {
        try {
            // Look for the input field or recent messages
            const inputSelectors = [
                'textarea[aria-label*="Message"]',
                'textarea[placeholder*="Enter a prompt"]',
                'rich-textarea textarea',
                '.ql-editor'
            ];
            
            for (const selector of inputSelectors) {
                const element = document.querySelector(selector);
                if (element && element.value) {
                    return element.value.substring(0, 200); // Truncate long prompts
                }
            }
            
            // Look for the most recent user message in the conversation
            const messageSelectors = [
                '[data-message-author-role="user"]',
                '.user-message',
                '[role="presentation"] p'
            ];
            
            for (const selector of messageSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    const lastElement = elements[elements.length - 1];
                    if (lastElement && lastElement.textContent) {
                        return lastElement.textContent.substring(0, 200);
                    }
                }
            }
            
            return '';
        } catch (error) {
            console.log('⚠️ Could not extract user prompt:', error);
            return '';
        }
    }

    // Set up network interception for Gemini
    function setupGeminiNetworkInterception() {
        console.log('🌐 Setting up Gemini network interception...');
        
        // Store original fetch and XMLHttpRequest
        const originalFetch = window.fetch;
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        // Override fetch to intercept Gemini API calls
        window.fetch = async function(...args) {
            const url = args[0];
            if (typeof url === 'string') {
                // Log all requests for debugging
                if (url.includes('gemini.google.com') || url.includes('BardChatUi')) {
                    console.log('🔍 Gemini-related fetch request:', url.substring(0, 150) + '...');
                }
                
                if (url.includes('/_/BardChatUi/data/batchexecute')) {
                    console.log('🎯 Intercepted Gemini batchexecute request (fetch):', url);
                } else if (url.includes('batchexecute')) {
                    console.log('🔍 Other batchexecute request:', url);
                } else if (url.includes('rpcids=hNvQHb')) {
                    console.log('🎯 Found hNvQHb request (fetch):', url);
                }
            }
            
            const response = await originalFetch.apply(this, args);
            
            // Check for various Gemini request patterns
            if (typeof url === 'string' && (
                url.includes('/_/BardChatUi/data/batchexecute') || 
                url.includes('rpcids=hNvQHb')
            )) {
                console.log('🎯 Processing Gemini response (fetch)');
                
                // Clone the response so we can read it without affecting the original
                const responseClone = response.clone();
                
                try {
                    const responseText = await responseClone.text();
                    console.log('📦 Gemini response intercepted via fetch, processing...');
                    
                    // Extract conversation ID from current URL
                    const conversationId = getConversationId();
                    
                    // Process the response in the background
                    setTimeout(() => {
                        processGeminiResponse(responseText, conversationId);
                    }, 100);
                } catch (error) {
                    console.log('⚠️ Error processing intercepted fetch response:', error);
                }
            }
            
            return response;
        };
        
        // Override XMLHttpRequest to intercept Gemini API calls
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._url = url;
            if (typeof url === 'string') {
                // Log all requests for debugging
                if (url.includes('gemini.google.com') || url.includes('BardChatUi')) {
                    console.log('🔍 Gemini-related XHR request:', url.substring(0, 150) + '...');
                }
                
                if (url.includes('/_/BardChatUi/data/batchexecute')) {
                    console.log('🎯 Intercepted Gemini batchexecute request (XHR):', url);
                    this._isGeminiBatch = true;
                } else if (url.includes('batchexecute')) {
                    console.log('🔍 Other batchexecute request (XHR):', url);
                    this._isGeminiBatch = true;
                } else if (url.includes('rpcids=hNvQHb')) {
                    console.log('🎯 Found hNvQHb request (XHR):', url);
                    this._isGeminiBatch = true;
                }
            }
            return originalXHROpen.apply(this, [method, url, ...args]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            if (this._isGeminiBatch) {
                console.log('🎯 Processing Gemini batchexecute request (XHR)');
                
                // Set up response handler
                const originalOnReadyStateChange = this.onreadystatechange;
                this.onreadystatechange = function() {
                    if (this.readyState === 4 && this.status === 200) {
                        console.log('📦 Gemini response intercepted via XHR, processing...');
                        
                        try {
                            const responseText = this.responseText;
                            const conversationId = getConversationId();
                            
                            // Process the response in the background
                            setTimeout(() => {
                                processGeminiResponse(responseText, conversationId);
                            }, 100);
                        } catch (error) {
                            console.log('⚠️ Error processing intercepted XHR response:', error);
                        }
                    }
                    
                    // Call original handler if it exists
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.apply(this, arguments);
                    }
                };
            }
            
            return originalXHRSend.apply(this, args);
        };
        
        // Also try to intercept using addEventListener approach
        const originalAddEventListener = XMLHttpRequest.prototype.addEventListener;
        XMLHttpRequest.prototype.addEventListener = function(type, listener, ...args) {
            if (type === 'load' && this._isGeminiBatch) {
                console.log('🎯 XHR load event for Gemini batch request');
                
                const originalListener = listener;
                const wrappedListener = function(event) {
                    console.log('📦 Gemini XHR load event triggered');
                    
                    try {
                        const responseText = this.responseText;
                        const conversationId = getConversationId();
                        
                        setTimeout(() => {
                            processGeminiResponse(responseText, conversationId);
                        }, 100);
                    } catch (error) {
                        console.log('⚠️ Error in XHR load listener:', error);
                    }
                    
                    if (originalListener) {
                        originalListener.apply(this, arguments);
                    }
                };
                
                return originalAddEventListener.call(this, type, wrappedListener, ...args);
            }
            
            return originalAddEventListener.call(this, type, listener, ...args);
        };
        
        console.log('✅ Gemini network interception set up (fetch + XHR)');
        
        // Additional monitoring using Performance API
        if (window.PerformanceObserver) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.name && (
                            entry.name.includes('/_/BardChatUi/data/batchexecute') ||
                            entry.name.includes('rpcids=hNvQHb')
                        )) {
                            console.log('🎯 Performance API detected Gemini request:', entry.name);
                            
                            // Try to get the response if possible
                            if (entry.responseEnd && entry.responseStart) {
                                console.log('📊 Request completed, duration:', entry.responseEnd - entry.responseStart, 'ms');
                            }
                        }
                    });
                });
                
                observer.observe({entryTypes: ['resource']});
                console.log('✅ Performance API monitoring enabled');
            } catch (error) {
                console.log('⚠️ Performance API monitoring failed:', error);
            }
        }
        
        // Monitor for new script tags that might load after our interception
        const scriptObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        if (node.tagName === 'SCRIPT' && node.src && node.src.includes('BardChatUi')) {
                            console.log('🔍 New Gemini script loaded:', node.src);
                        }
                    });
                }
            });
        });
        
        scriptObserver.observe(document.head || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Process intercepted Gemini response
    async function processGeminiResponse(responseText, conversationId) {
        try {
            console.log('🔍 Processing Gemini response for search queries...');
            console.log('📄 Response length:', responseText.length, 'characters');
            console.log('📄 Response preview:', responseText.substring(0, 200) + '...');
            
            // Extract queries from the response
            const queries = extractQueriesFromGeminiResponse(responseText, conversationId);
            
            if (queries.length > 0) {
                console.log(`✅ Found ${queries.length} search queries in Gemini response`);
                console.log('📊 Queries found:', queries.map(q => `"${q.query}" (${q.metadata.extractionMethod})`));
                
                // Send to server
                await sendQueriesToServer(queries, conversationId);
                
                // Store for deduplication
                queries.forEach(query => {
                    searchQueryStore.set(query.query, {
                        timestamp: Date.now(),
                        data: query
                    });
                });
            } else {
                console.log('ℹ️ No search queries found in Gemini response');
                console.log('🔍 Response sample for debugging:', responseText.substring(0, 500));
            }
        } catch (error) {
            console.error('❌ Error processing Gemini response:', error);
            console.log('📄 Response that caused error:', responseText.substring(0, 300));
        }
    }

    // Shape-based matching functions (adapted from working Gemini Inspector)
    function isUserPromptShape(arr) {
        return (
            Array.isArray(arr) &&
            arr.length === 6 &&
            Array.isArray(arr[0]) &&
            typeof arr[0][0] === 'string' &&
            typeof arr[1] === 'number' &&
            arr[2] === null &&
            typeof arr[4] === 'string'
        );
    }

    function isFanOutQueriesShape(arr) {
        if (!Array.isArray(arr) || arr.length === 0) {
            return false;
        }
        // Check if every item in the array matches the pattern ["query string", number]
        return arr.every(
            item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
        );
    }

    function findDataByShape(data, predicate) {
        let results = [];

        function search(item) {
            if (predicate(item)) {
                results.push(item);
            }

            if (Array.isArray(item)) {
                for (const subItem of item) {
                    search(subItem);
                }
            }
        }

        search(data);
        return results;
    }

    // Extract search queries from Gemini response text (improved parsing)
    function extractQueriesFromGeminiResponse(responseText, conversationId) {
        const queries = [];
        const userPrompt = extractGeminiUserPrompt();
        
        try {
            console.log('🔍 Parsing Gemini response with improved shape-based matching...');
            
            // Parse the complex response structure (same as working extension)
            const lines = responseText.split('\n').filter(line => line.trim().length > 0);
            if (lines.length < 3) {
                console.log('⚠️ Response format unexpected, trying fallback parsing...');
                return extractQueriesFromGeminiResponseFallback(responseText, conversationId);
            }

            const outerJsonString = lines[2];
            const outerData = JSON.parse(outerJsonString);
            const innerJsonString = outerData[0][2];
            const parsedData = JSON.parse(innerJsonString);
            
            console.log('✅ Successfully parsed Gemini response structure');
            
            // Use shape-based matching to find fan-out queries
            const userPromptArray = findDataByShape(parsedData, isUserPromptShape)[0];
            const fanOutQueriesList = findDataByShape(parsedData, isFanOutQueriesShape)[0];
            
            const detectedUserPrompt = userPromptArray ? userPromptArray[0][0] : userPrompt;
            
            if (Array.isArray(fanOutQueriesList) && fanOutQueriesList.length > 0) {
                console.log(`📍 Found ${fanOutQueriesList.length} fan-out queries using shape matching`);
                
                fanOutQueriesList.forEach(queryArray => {
                    const query = queryArray[0];
                    if (query && query.length > 2) {
                        console.log(`📍 Found Gemini search query: "${query}"`);
                        
                        queries.push({
                            query: query,
                            type: 'gemini_search',
                            platform: 'gemini',
                            model: 'gemini',
                            messageId: '',
                            userPrompt: detectedUserPrompt,
                            timestamp: new Date().toISOString(),
                            conversationId: conversationId,
                            metadata: {
                                source: 'network_intercept',
                                extractionMethod: 'shape_matching',
                                confidence: queryArray[1] || 1
                            }
                        });
                    }
                });
            } else {
                console.log('ℹ️ No fan-out queries found with shape matching, trying fallback...');
                return extractQueriesFromGeminiResponseFallback(responseText, conversationId);
            }
            
        } catch (error) {
            console.error('❌ Error in shape-based parsing, trying fallback:', error);
            return extractQueriesFromGeminiResponseFallback(responseText, conversationId);
        }
        
        return queries;
    }

    // Fallback parsing method (original approach)
    function extractQueriesFromGeminiResponseFallback(responseText, conversationId) {
        const queries = [];
        const userPrompt = extractGeminiUserPrompt();
        
        try {
            console.log('🔄 Using fallback parsing method...');
            
            // Look for the original search query pattern: [["query text"],1,null,0,"id",0]
            const searchQueryPattern = /\[\[\"([^"]+)\"\],1,null,0,\"[^"]+\",0\]/g;
            let match;
            
            while ((match = searchQueryPattern.exec(responseText)) !== null) {
                const query = match[1];
                if (query && query.length > 2) { // Filter out very short queries
                    console.log(`📍 Found Gemini search query (fallback): "${query}"`);
                    
                    queries.push({
                        query: query,
                        type: 'gemini_search',
                        platform: 'gemini',
                        model: 'gemini',
                        messageId: '',
                        userPrompt: userPrompt,
                        timestamp: new Date().toISOString(),
                        conversationId: conversationId,
                        metadata: {
                            source: 'network_intercept',
                            extractionMethod: 'pattern_match_fallback'
                        }
                    });
                }
            }
            
            // Also look for suggested related queries at the end
            const relatedQueriesPattern = /\[\"([^"]+)\",\d+\]/g;
            const relatedMatches = [];
            
            while ((match = relatedQueriesPattern.exec(responseText)) !== null) {
                const query = match[1];
                if (query && query.length > 5 && query.includes(' ')) { // Filter for meaningful queries
                    relatedMatches.push(query);
                }
            }
            
            // Add unique related queries (avoid duplicates)
            const existingQueries = new Set(queries.map(q => q.query.toLowerCase()));
            relatedMatches.forEach(query => {
                if (!existingQueries.has(query.toLowerCase())) {
                    console.log(`📍 Found Gemini related query (fallback): "${query}"`);
                    
                    queries.push({
                        query: query,
                        type: 'gemini_related',
                        platform: 'gemini',
                        model: 'gemini',
                        messageId: '',
                        userPrompt: userPrompt,
                        timestamp: new Date().toISOString(),
                        conversationId: conversationId,
                        metadata: {
                            source: 'network_intercept',
                            extractionMethod: 'related_queries_fallback'
                        }
                    });
                    
                    existingQueries.add(query.toLowerCase());
                }
            });
            
        } catch (error) {
            console.error('❌ Error in fallback parsing:', error);
        }
        
        return queries;
    }

    // Debug function to analyze page content
    function debugGeminiPageContent() {
        console.log('🔍 Debugging Gemini page content...');
        
        // Log current URL and conversation ID
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 Conversation ID:', getConversationId());
        
        // Log all text content on the page (truncated)
        const allText = document.body.textContent || '';
        console.log('📄 Page text length:', allText.length);
        console.log('📄 Page text sample:', allText.substring(0, 500) + '...');
        
        // Look for any elements that might contain search-related content
        const potentialElements = document.querySelectorAll('*');
        let searchRelatedCount = 0;
        
        potentialElements.forEach((el, index) => {
            if (index < 100) { // Limit to first 100 elements
                const text = el.textContent || '';
                const attrs = Array.from(el.attributes || []).map(attr => `${attr.name}="${attr.value}"`).join(' ');
                
                if (text.toLowerCase().includes('search') || 
                    text.toLowerCase().includes('query') ||
                    text.toLowerCase().includes('google') ||
                    attrs.toLowerCase().includes('search')) {
                    searchRelatedCount++;
                    console.log(`🔍 Search-related element ${searchRelatedCount}:`, {
                        tag: el.tagName,
                        text: text.substring(0, 100),
                        attributes: attrs
                    });
                }
            }
        });
        
        console.log(`📊 Found ${searchRelatedCount} potentially search-related elements`);
    }

    // DOM-based Gemini search query extraction (fallback method)
    function extractGeminiQueriesFromDOM() {
        const queries = [];
        const conversationId = getConversationId();
        const userPrompt = extractGeminiUserPrompt();
        
        try {
            console.log('🔍 Attempting DOM-based Gemini extraction...');
            
            // Debug page content first
            debugGeminiPageContent();
            
            // Look for search-related elements in the DOM
            const searchSelectors = [
                // Look for elements that might contain search query information
                '[data-search-query]',
                '[aria-label*="search"]',
                '.search-query',
                '.query-text',
                // Look for links that might be search results
                'a[href*="google.com/search"]',
                'a[href*="search?q="]',
                // Look for text that looks like search queries
                '*[title*="search"]',
                // Gemini-specific selectors
                '[data-test-id*="search"]',
                '[role="button"][aria-label*="search"]',
                // Look for any links or buttons that might contain search info
                'a[href*="q="]',
                'button[title*="search"]',
                // Look for content areas that might have search results
                '[data-message-id]',
                '.message',
                '.response',
                '.conversation-turn'
            ];
            
            searchSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        const text = element.textContent || element.getAttribute('data-search-query') || element.title;
                        if (text && text.length > 3 && text.length < 200) {
                            console.log(`📍 Found potential search query from DOM (${selector}): "${text}"`);
                            
                            queries.push({
                                query: text.trim(),
                                type: 'gemini_dom_search',
                                platform: 'gemini',
                                model: 'gemini',
                                messageId: '',
                                userPrompt: userPrompt,
                                timestamp: new Date().toISOString(),
                                conversationId: conversationId,
                                metadata: {
                                    source: 'dom_extraction',
                                    extractionMethod: 'dom_selector',
                                    selector: selector
                                }
                            });
                        }
                    });
                } catch (error) {
                    console.log(`⚠️ Error with selector ${selector}:`, error);
                }
            });
            
            // Look for text patterns that might be search queries in the page content
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text.length > 5 && text.length < 100) {
                    // Look for patterns that might be search queries
                    const searchPatterns = [
                        /^(search|query|find|look up|research):\s*(.+)$/gi,
                        /^"([^"]+)"$/g,
                        /\b(latest|recent|current|today|news|information about)\s+(.+)/gi,
                        // Look for Google search URLs that might be embedded
                        /google\.com\/search\?q=([^&"']+)/gi,
                        // Look for quoted search terms
                        /"([^"]{5,50})"/g,
                        // Look for search-like phrases
                        /\b(search for|looking for|find out about|research on)\s+([^.!?]{5,50})/gi
                    ];
                    
                    searchPatterns.forEach((pattern, index) => {
                        const matches = text.matchAll ? Array.from(text.matchAll(pattern)) : [text.match(pattern)].filter(Boolean);
                        matches.forEach(match => {
                            if (match) {
                                const queryText = match[2] || match[1];
                                if (queryText && queryText.length > 3 && queryText.length < 100) {
                                    console.log(`📍 Found potential search query from text pattern ${index}: "${queryText}"`);
                                    
                                    queries.push({
                                        query: decodeURIComponent(queryText.trim()),
                                        type: 'gemini_dom_pattern',
                                        platform: 'gemini',
                                        model: 'gemini',
                                        messageId: '',
                                        userPrompt: userPrompt,
                                        timestamp: new Date().toISOString(),
                                        conversationId: conversationId,
                                        metadata: {
                                            source: 'dom_extraction',
                                            extractionMethod: 'text_pattern',
                                            pattern: pattern.toString(),
                                            originalText: text
                                        }
                                    });
                                }
                            }
                        });
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Error in DOM-based extraction:', error);
        }
        
        console.log(`📊 DOM extraction found ${queries.length} potential queries`);
        return queries;
    }

    // Simple text analysis extraction (last resort method)
    function extractQueriesFromPageText() {
        const queries = [];
        const conversationId = getConversationId();
        const userPrompt = extractGeminiUserPrompt();
        
        try {
            console.log('🔍 Attempting simple text analysis extraction...');
            
            // Get all text content from the page
            const pageText = document.body.textContent || '';
            
            // Split into sentences and analyze each one
            const sentences = pageText.split(/[.!?]+/).filter(s => s.trim().length > 10);
            
            sentences.forEach((sentence, index) => {
                const trimmed = sentence.trim();
                
                // Look for sentences that might be search queries
                const queryIndicators = [
                    /\b(what|how|when|where|why|who)\b.*\?/gi,
                    /\b(find|search|look up|research|information about|details on)\b/gi,
                    /\b(latest|recent|current|today|news)\b.*\b(about|on|regarding)\b/gi,
                    /\b(can you|could you|please)\b.*\b(find|search|look|tell me)\b/gi
                ];
                
                queryIndicators.forEach((pattern, patternIndex) => {
                    if (pattern.test(trimmed) && trimmed.length > 10 && trimmed.length < 200) {
                        console.log(`📍 Found potential search query from text analysis: "${trimmed}"`);
                        
                        queries.push({
                            query: trimmed,
                            type: 'gemini_text_analysis',
                            platform: 'gemini',
                            model: 'gemini',
                            messageId: '',
                            userPrompt: userPrompt,
                            timestamp: new Date().toISOString(),
                            conversationId: conversationId,
                            metadata: {
                                source: 'text_analysis',
                                extractionMethod: 'sentence_pattern',
                                patternIndex: patternIndex,
                                sentenceIndex: index
                            }
                        });
                    }
                });
            });
            
        } catch (error) {
            console.error('❌ Error in text analysis extraction:', error);
        }
        
        console.log(`📊 Text analysis found ${queries.length} potential queries`);
        return queries;
    }

    // Enhanced Gemini search query extraction with multiple methods
    async function extractGeminiQueries() {
        try {
            const conversationId = getConversationId();
            if (!conversationId) {
                console.log('❌ No Gemini conversation ID found');
                return [];
            }

            console.log('🔍 Extracting Gemini search queries from conversation:', conversationId);
            
            let allQueries = [];
            
            // Method 1: Check stored queries from network interception
            console.log('📊 Method 1: Checking stored network-intercepted queries...');
            const storedQueries = [];
            searchQueryStore.forEach((value, key) => {
                if (value.data && value.data.platform === 'gemini') {
                    // Only return recent queries (within last 5 minutes)
                    if (Date.now() - value.timestamp < 5 * 60 * 1000) {
                        storedQueries.push(value.data);
                    }
                }
            });
            
            console.log(`📊 Found ${storedQueries.length} stored network queries`);
            allQueries = allQueries.concat(storedQueries);
            
            // Method 2: DOM-based extraction (fallback)
            console.log('📊 Method 2: Attempting DOM-based extraction...');
            const domQueries = extractGeminiQueriesFromDOM();
            allQueries = allQueries.concat(domQueries);
            
            // Method 3: Simple text analysis (last resort)
            console.log('📊 Method 3: Simple text analysis...');
            const simpleQueries = extractQueriesFromPageText();
            allQueries = allQueries.concat(simpleQueries);
            
            // Remove duplicates
            const uniqueQueries = [];
            const seenQueries = new Set();
            
            allQueries.forEach(query => {
                const key = query.query.toLowerCase().trim();
                if (!seenQueries.has(key)) {
                    seenQueries.add(key);
                    uniqueQueries.push(query);
                }
            });
            
            console.log(`📊 Total unique queries found: ${uniqueQueries.length}`);
            return uniqueQueries;

        } catch (error) {
            console.error('❌ Error extracting Gemini search queries:', error);
            return [];
        }
    }

    // Unified search query extraction
    async function extractSearchQueries() {
        currentPlatform = detectPlatform();
        
        if (currentPlatform === 'chatgpt') {
            return await extractChatGPTQueries();
        } else if (currentPlatform === 'gemini') {
            return await extractGeminiQueries();
        } else {
            console.log('❌ Unknown platform:', currentPlatform);
            return [];
        }
    }

    // Function to send queries to server
    async function sendQueriesToServer(queries, conversationId) {
        try {
            if (queries.length === 0) {
                console.log('ℹ️ No queries to send to server');
                return;
            }

            const token = await getAuthToken();
            if (!token) {
                console.log('❌ No auth token available');
                return;
            }

            console.log(`🚀 Sending ${queries.length} queries to server...`);

            const response = await fetch(`${API_BASE_URL}/api/search-queries?extensionId=${chrome.runtime?.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-install-token': token
                },
                body: JSON.stringify({
                    queries,
                    conversationId,
                    extensionId: chrome.runtime?.id
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Search queries sent to server:', result);
            } else {
                console.error('❌ Server response error:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error sending queries to server:', error);
        }
    }

    // Function to get authentication token
    async function getAuthToken() {
        try {
            if (chrome && chrome.storage && chrome.storage.local) {
                const { installToken } = await chrome.storage.local.get(['installToken']);
                return installToken;
            }
        } catch (error) {
            console.log('⚠️ Could not get auth token');
        }
        return null;
    }

    // Installation function
    async function installExtension() {
        try {
            console.log('🔑 Installing extension...');
            const response = await fetch(`${API_BASE_URL}/api/install`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    extensionId: chrome.runtime?.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Extension installed:', data);
                
                // Store auth token
                if (chrome && chrome.storage && chrome.storage.local) {
                    await chrome.storage.local.set({
                        installToken: data.installToken,
                        userId: data.userId
                    });
                }
            } else {
                console.error('❌ Installation failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Installation error:', error);
        }
    }

    // Attempt automatic Gemini extraction
    async function attemptGeminiExtraction() {
        try {
            console.log('🔍 Attempting automatic Gemini extraction...');
            const queries = await extractGeminiQueries();
            
            if (queries.length > 0) {
                console.log(`✅ Automatic extraction found ${queries.length} queries`);
                const conversationId = getConversationId();
                await sendQueriesToServer(queries, conversationId);
            } else {
                console.log('ℹ️ No new Gemini queries found');
            }
        } catch (error) {
            console.log('⚠️ Automatic Gemini extraction failed:', error.message);
        }
    }

    // Attempt automatic ChatGPT extraction
    async function attemptChatGPTExtraction() {
        try {
            console.log('🔍 Attempting automatic ChatGPT extraction...');
            const queries = await extractChatGPTQueries();
            
            if (queries.length > 0) {
                console.log(`✅ Automatic ChatGPT extraction found ${queries.length} queries`);
                const conversationId = getConversationId();
                await sendQueriesToServer(queries, conversationId);
            } else {
                console.log('ℹ️ No new ChatGPT queries found');
            }
        } catch (error) {
            console.log('⚠️ Automatic ChatGPT extraction failed:', error.message);
        }
    }

    // Monitor page changes and extract queries
    async function monitorAndExtract() {
        const currentUrl = window.location.href;
        currentPlatform = detectPlatform();
        
        // Check if we should process this URL
        const shouldProcess = 
            (currentPlatform === 'chatgpt' && currentUrl.includes('/c/')) ||
            (currentPlatform === 'gemini' && currentUrl.includes('gemini.google.com'));
        
        if (currentUrl !== lastProcessedUrl && shouldProcess) {
            lastProcessedUrl = currentUrl;
            console.log(`🔄 Processing ${currentPlatform} page:`, currentUrl);
            
            if (currentPlatform === 'chatgpt') {
                // Wait for page to load content, then extract with retry logic
                setTimeout(async () => {
                    console.log('⏰ Starting ChatGPT extraction after delay...');
                    await extractWithRetry();
                }, 3000);
                
                // Set up periodic re-extraction for ongoing conversations
                console.log('📄 ChatGPT page detected, setting up periodic monitoring...');
                setInterval(async () => {
                    console.log('🔄 Periodic ChatGPT extraction check...');
                    await attemptChatGPTExtraction();
                }, 30000); // Check every 30 seconds
                
            } else if (currentPlatform === 'gemini') {
                // For Gemini, set up automatic monitoring for new responses
                console.log('📄 Gemini page detected, setting up automatic monitoring...');
            setTimeout(async () => {
                    console.log('⏰ Starting automatic Gemini extraction...');
                    await attemptGeminiExtraction();
                }, 2000);
            }
        }
    }

    // Extract with retry logic for o3 and other models that might need more time
    async function extractWithRetry(maxRetries = 3, baseDelay = 2000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Extraction attempt ${attempt}/${maxRetries}`);
                const queries = await extractSearchQueries();
                
                if (queries.length > 0) {
                    console.log(`✅ Found ${queries.length} queries on attempt ${attempt}`);
                    const conversationId = getConversationId();
                    await sendQueriesToServer(queries, conversationId);
                    return; // Success, exit retry loop
                } else {
                    console.log(`ℹ️ No queries found on attempt ${attempt}`);
                    
                    // If this isn't the last attempt, wait before retrying
                    if (attempt < maxRetries) {
                        // Exponential backoff: 2s, 4s, 8s...
                        const delay = baseDelay * Math.pow(2, attempt - 1);
                        console.log(`⏳ Waiting ${delay}ms before retry (o3 models may need more time)...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            } catch (error) {
                console.error(`❌ Extraction attempt ${attempt} failed:`, error);
                if (attempt === maxRetries) {
                    console.error('❌ All extraction attempts failed');
                }
            }
        }
        
        console.log('ℹ️ No queries found after all attempts');
    }

    // Initialize the extension
    async function init() {
        currentPlatform = detectPlatform();
        console.log(`🚀 Initializing AI Search Fan-out Tracker for ${currentPlatform}...`);

        if (!isExtensionValid()) {
            console.log('❌ Extension context invalid');
            return;
        }

        const token = await getAuthToken();
        if (!token) {
            console.log('🔑 No auth token found, installing...');
            await installExtension();
        } else {
            console.log('✅ Auth token found');
        }

        // Platform-specific setup
        if (currentPlatform === 'gemini') {
            console.log('🌐 Setting up Gemini network interception...');
            setupGeminiNetworkInterception();
        }

        // Initial extraction if already on a conversation page
        const shouldProcess = 
            (currentPlatform === 'chatgpt' && location.pathname.includes('/c/')) ||
            (currentPlatform === 'gemini' && location.hostname.includes('gemini.google.com'));
            
        if (shouldProcess) {
            console.log(`📄 Already on ${currentPlatform} page, starting monitoring...`);
        monitorAndExtract();
        }

        // Set up mutation observer for page changes
        observer = new MutationObserver((mutations) => {
            monitorAndExtract();
            
            // Check for significant content changes that might indicate new messages
            const hasSignificantChanges = mutations.some(mutation => {
                return mutation.addedNodes.length > 0 && 
                       Array.from(mutation.addedNodes).some(node => {
                           return node.nodeType === Node.ELEMENT_NODE && 
                                  node.textContent && 
                                  node.textContent.length > 100;
                       });
            });
            
            if (hasSignificantChanges) {
                if (currentPlatform === 'gemini') {
                    console.log('📝 Significant content changes detected, scheduling automatic Gemini extraction...');
                    setTimeout(() => attemptGeminiExtraction(), 3000);
                } else if (currentPlatform === 'chatgpt') {
                    console.log('📝 Significant content changes detected, scheduling automatic ChatGPT extraction...');
                    setTimeout(() => attemptChatGPTExtraction(), 3000);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log(`✅ AI Search Fan-out Tracker initialized for ${currentPlatform}`);
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'EXTRACT_QUERIES') {
            console.log('📨 Manual extraction requested from popup');
            extractSearchQueries().then(async queries => {
                console.log(`📊 Manual extraction result: ${queries.length} queries`);
                
                if (queries.length > 0) {
                    // Send queries to server
                    const conversationId = getConversationId();
                    await sendQueriesToServer(queries, conversationId);
                }
                
                sendResponse({ success: true, count: queries.length, queries });
            }).catch(error => {
                console.error('❌ Manual extraction failed:', error);
                sendResponse({ success: false, error: error.message, count: 0 });
            });
            return true; // Keep message channel open for async response
        }
    });

    // Set up early network interception for Gemini (before page fully loads)
    if (currentPlatform === 'gemini') {
        console.log('🚀 Setting up early Gemini network interception...');
        setupGeminiNetworkInterception();
    }

})(); 