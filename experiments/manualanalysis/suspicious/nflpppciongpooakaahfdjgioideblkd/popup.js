document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = 'https://server-theta-nine-63.vercel.app';
    
    // DOM elements
    const extractBtn = document.getElementById('extractBtn');
    const viewAllBtn = document.getElementById('viewAllBtn');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const statusMessage = document.getElementById('statusMessage');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const totalQueriesEl = document.getElementById('totalQueries');
    const conversationQueriesEl = document.getElementById('conversationQueries');
    const recentQueriesEl = document.getElementById('recentQueries');
    const serverStatusEl = document.getElementById('serverStatus');
    const serverStatusTextEl = document.getElementById('serverStatusText');
    const allQueriesModal = document.getElementById('allQueriesModal');
    const modalClose = document.getElementById('modalClose');
    const allQueriesList = document.getElementById('allQueriesList');
    const searchFilter = document.getElementById('searchFilter');
    const conversationFilter = document.getElementById('conversationFilter');

    let allQueries = [];
    let filteredQueries = [];

    // Initialize popup
    async function init() {
        try {
            showLoading(true);
            await checkServerStatus();
            await loadStats();
            await loadRecentQueries();
            showStatus('Ready to extract search queries', 'success');
        } catch (error) {
            console.error('Initialization error:', error);
            showStatus('Failed to initialize extension', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Check server status
    async function checkServerStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/health`);
            if (response.ok) {
                serverStatusEl.className = 'status-dot online';
                serverStatusTextEl.textContent = 'Online';
            } else {
                throw new Error('Server unavailable');
            }
        } catch (error) {
            serverStatusEl.className = 'status-dot offline';
            serverStatusTextEl.textContent = 'Offline';
            throw error;
        }
    }

    // Get auth token
    async function getAuthToken() {
        try {
            const { installToken } = await chrome.storage.local.get(['installToken']);
            return installToken;
        } catch (error) {
            console.error('Could not get auth token:', error);
            return null;
        }
    }

    // Load statistics
    async function loadStats() {
        try {
            console.log('📊 Loading stats...');
            const token = await getAuthToken();
            if (!token) {
                console.log('❌ No auth token for stats');
                showStatus('Extension not authenticated', 'warning');
                return;
            }

            console.log('✅ Auth token found for stats, making API request...');
            const response = await fetch(`${API_BASE_URL}/api/stats?extensionId=${chrome.runtime.id}`, {
                headers: {
                    'x-install-token': token
                }
            });

            console.log('📊 Stats response status:', response.status, response.statusText);

            if (response.ok) {
                const stats = await response.json();
                console.log('📈 Stats data:', stats);
                totalQueriesEl.textContent = stats.totalQueries || 0;
                
                // Get current conversation queries count
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                let conversationId = null;
                
                if (tab && tab.url) {
                    // Extract conversation ID from ChatGPT URLs
                    if (tab.url.includes('chatgpt.com/c/')) {
                        conversationId = tab.url.match(/\/c\/([^/]+)/)?.[1];
                    }
                    // Extract conversation ID from Gemini URLs
                    else if (tab.url.includes('gemini.google.com/app/')) {
                        conversationId = tab.url.match(/\/app\/([^/?]+)/)?.[1];
                    }
                    
                    console.log('🔍 Detected conversation ID:', conversationId, 'from URL:', tab.url);
                    
                    if (conversationId) {
                        const conversationResponse = await fetch(
                            `${API_BASE_URL}/api/search-queries?extensionId=${chrome.runtime.id}&conversationId=${conversationId}`,
                            {
                                headers: {
                                    'x-install-token': token
                                }
                            }
                        );
                        
                        if (conversationResponse.ok) {
                            const conversationData = await conversationResponse.json();
                            console.log('💬 Conversation data:', conversationData);
                            conversationQueriesEl.textContent = conversationData.total || 0;
                        } else {
                            console.error('❌ Failed to load conversation data:', conversationResponse.status);
                        }
                    }
                }
            } else {
                throw new Error('Failed to load stats');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            totalQueriesEl.textContent = '?';
            conversationQueriesEl.textContent = '?';
        }
    }

    // Load recent queries
    async function loadRecentQueries() {
        try {
            console.log('🔍 Loading recent queries...');
            const token = await getAuthToken();
            if (!token) {
                console.log('❌ No auth token found');
                return;
            }

            console.log('✅ Auth token found, making API request...');
            const url = `${API_BASE_URL}/api/search-queries?extensionId=${chrome.runtime.id}&limit=5`;
            console.log('📡 API URL:', url);

            const response = await fetch(url, {
                headers: {
                    'x-install-token': token
                }
            });

            console.log('📊 Response status:', response.status, response.statusText);

            if (response.ok) {
                const data = await response.json();
                console.log('📄 Response data:', data);
                displayRecentQueries(data.queries || []);
            } else {
                const errorText = await response.text();
                console.error('❌ API Error:', response.status, errorText);
            }
        } catch (error) {
            console.error('❌ Error loading recent queries:', error);
        }
    }

    // Display recent queries
    function displayRecentQueries(queries) {
        if (queries.length === 0) {
            recentQueriesEl.innerHTML = '<div class="empty-state">No recent queries found</div>';
            return;
        }

        recentQueriesEl.innerHTML = queries.map(query => {
            const platform = query.aiService || query.platform || 'chatgpt';
            const model = query.model || query.metadata?.modelSlug || 'unknown';
            return `
                <div class="query-item">
                    <div class="query-text">${escapeHtml(query.query)}</div>
                    <div class="query-meta">
                        <span class="query-platform" data-platform="${platform}">${escapeHtml(platform).toUpperCase()}</span>
                        <span class="query-model" data-model="${model}">${escapeHtml(model).toUpperCase()}</span>
                        <span class="query-time">${formatDate(query.timestamp)}</span>
                    </div>
                    <div class="query-actions">
                        <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(query.query).replace(/'/g, "\\'")}')">Copy</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Extract queries from current page
    async function extractQueries() {
        try {
            showLoading(true);
            showStatus('Extracting search queries...', 'info');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            const isValidPlatform = tab && tab.url && 
                (tab.url.includes('chatgpt.com') || tab.url.includes('gemini.google.com'));
            
            if (!isValidPlatform) {
                showStatus('Please navigate to a ChatGPT or Gemini conversation', 'warning');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_QUERIES' });
            
            if (response && response.success) {
                showStatus(`Extracted ${response.count} search queries`, 'success');
                await loadStats();
                await loadRecentQueries();
            } else if (response && response.error) {
                showStatus(`Extraction failed: ${response.error}`, 'error');
            } else {
                showStatus('No search queries found in current conversation', 'warning');
            }
        } catch (error) {
            console.error('Error extracting queries:', error);
            showStatus('Failed to extract queries. Make sure you are on a ChatGPT or Gemini conversation page.', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Load all queries for modal
    async function loadAllQueries() {
        try {
            const token = await getAuthToken();
            if (!token) {
                showStatus('Extension not authenticated', 'warning');
                return;
            }

            allQueriesList.innerHTML = '<div class="loading">Loading queries...</div>';

            const response = await fetch(`${API_BASE_URL}/api/search-queries?extensionId=${chrome.runtime.id}&limit=100`, {
                headers: {
                    'x-install-token': token
                }
            });

            if (response.ok) {
                const data = await response.json();
                allQueries = data.queries || [];
                filteredQueries = allQueries;
                
                // Populate conversation filter
                const conversations = [...new Set(allQueries.map(q => q.conversationId))];
                conversationFilter.innerHTML = '<option value="">All Conversations</option>' +
                    conversations.map(id => `<option value="${id}">${id.substring(0, 8)}...</option>`).join('');
                
                displayAllQueries();
            } else {
                allQueriesList.innerHTML = '<div class="error">Failed to load queries</div>';
            }
        } catch (error) {
            console.error('Error loading all queries:', error);
            allQueriesList.innerHTML = '<div class="error">Error loading queries</div>';
        }
    }

    // Display all queries in modal
    function displayAllQueries() {
        if (filteredQueries.length === 0) {
            allQueriesList.innerHTML = '<div class="empty-state">No queries found</div>';
            return;
        }

        allQueriesList.innerHTML = filteredQueries.map(query => {
            const platform = query.aiService || query.platform || 'chatgpt';
            const model = query.model || query.metadata?.modelSlug || 'unknown';
            return `
                <div class="query-item modal-query-item">
                    <div class="query-text">${escapeHtml(query.query)}</div>
                    <div class="query-meta">
                        <span class="query-platform" data-platform="${platform}">${escapeHtml(platform).toUpperCase()}</span>
                        <span class="query-model" data-model="${model}">${escapeHtml(model).toUpperCase()}</span>
                        <span class="query-time">${formatDate(query.timestamp)}</span>
                        <span class="query-conversation" title="Conversation ID: ${query.conversationId}">
                            ${query.conversationId.substring(0, 8)}...
                        </span>
                        ${query.userPrompt ? `<div class="query-prompt" title="${escapeHtml(query.userPrompt)}">${escapeHtml(query.userPrompt.substring(0, 100))}${query.userPrompt.length > 100 ? '...' : ''}</div>` : ''}
                    </div>
                    <div class="query-actions">
                        <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(query.query).replace(/'/g, "\\'")}')">Copy</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Filter queries
    function filterQueries() {
        const searchTerm = searchFilter.value.toLowerCase();
        const conversationId = conversationFilter.value;

        filteredQueries = allQueries.filter(query => {
            const matchesSearch = !searchTerm || 
                query.query.toLowerCase().includes(searchTerm) ||
                (query.userPrompt && query.userPrompt.toLowerCase().includes(searchTerm));
            
            const matchesConversation = !conversationId || query.conversationId === conversationId;
            
            return matchesSearch && matchesConversation;
        });

        displayAllQueries();
    }

    // Utility functions
    function showLoading(show) {
        loadingSpinner.classList.toggle('hidden', !show);
    }

    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }, 3000);
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // CSV Download functionality
    async function downloadQueriesAsCSV() {
        try {
            showLoading(true);
            showStatus('Preparing CSV download...', 'info');

            const token = await getAuthToken();
            if (!token) {
                showStatus('Extension not authenticated', 'warning');
                return;
            }

            // Fetch all queries (no limit for export)
            const response = await fetch(`${API_BASE_URL}/api/search-queries?extensionId=${chrome.runtime.id}&limit=1000`, {
                headers: {
                    'x-install-token': token
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch queries');
            }

            const data = await response.json();
            const queries = data.queries || [];

            if (queries.length === 0) {
                showStatus('No queries to export', 'warning');
                return;
            }

            // Generate CSV content
            const csvContent = generateCSV(queries);
            
            // Create download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `ai-search-queries-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            showStatus(`Downloaded ${queries.length} queries as CSV`, 'success');

        } catch (error) {
            console.error('Error downloading CSV:', error);
            showStatus('Failed to download CSV', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Generate CSV content from queries
    function generateCSV(queries) {
        // CSV headers
        const headers = [
            'Query',
            'Platform',
            'Model',
            'Type', 
            'User Prompt',
            'Conversation ID',
            'Timestamp',
            'Date',
            'Time'
        ];

        // Convert queries to CSV rows
        const rows = queries.map(query => {
            const date = new Date(query.timestamp);
            return [
                escapeCSV(query.query || ''),
                escapeCSV(query.aiService || query.platform || 'chatgpt'),
                escapeCSV(query.model || query.metadata?.modelSlug || 'unknown'),
                escapeCSV(query.type || 'search_query'),
                escapeCSV(query.userPrompt ? query.userPrompt.substring(0, 200) : ''), // Truncate long prompts
                escapeCSV(query.conversationId || ''),
                escapeCSV(query.timestamp || ''),
                escapeCSV(date.toLocaleDateString()),
                escapeCSV(date.toLocaleTimeString())
            ];
        });

        // Combine headers and rows
        const csvContent = [headers, ...rows]
            .map(row => row.join(','))
            .join('\n');

        return csvContent;
    }

    // Escape CSV values (handle commas, quotes, newlines)
    function escapeCSV(value) {
        if (typeof value !== 'string') {
            value = String(value);
        }
        
        // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        return value;
    }

    // Global function for copy button
    window.copyToClipboard = function(text) {
        navigator.clipboard.writeText(text).then(() => {
            showStatus('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showStatus('Failed to copy', 'error');
        });
    };

    // Event listeners
    extractBtn.addEventListener('click', extractQueries);
    
    viewAllBtn.addEventListener('click', () => {
        allQueriesModal.classList.remove('hidden');
        loadAllQueries();
    });

    downloadCsvBtn.addEventListener('click', downloadQueriesAsCSV);

    modalClose.addEventListener('click', () => {
        allQueriesModal.classList.add('hidden');
    });

    searchFilter.addEventListener('input', filterQueries);
    conversationFilter.addEventListener('change', filterQueries);

    // Close modal when clicking outside
    allQueriesModal.addEventListener('click', (e) => {
        if (e.target === allQueriesModal) {
            allQueriesModal.classList.add('hidden');
        }
    });

    // Initialize
    init();
});