# AI Search Fan-out Tracker - Chrome Extension

This Chrome extension captures and stores the search queries that ChatGPT and Gemini generate when using their search features. It helps you understand how these AI models interpret your prompts and what search strategies they use.

## Installation

1. Download or clone this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select this `extension` folder
5. The extension will appear in your Chrome toolbar

## Features

### AI Service Support
- **ChatGPT**: Supports chatgpt.com conversations with search enabled
- **Gemini**: Supports gemini.google.com conversations with search capabilities
- Automatic detection of which AI service you're using
- Service-specific icons and indicators in the interface

### Automatic Detection
- Automatically detects when you're on a ChatGPT or Gemini conversation page
- Extracts search queries in real-time as they're generated
- Stores queries with context (user prompt, timestamp, conversation ID, AI service)

### Manual Extraction
- Click the extension icon and use "Extract Current Page" to manually capture queries
- Useful for analyzing completed conversations on both platforms

### Query Management
- View recent queries in the popup with AI service indicators
- See statistics (total queries, queries in current conversation)
- Access all queries with search and filtering options (including by AI service)
- Copy queries to clipboard for further analysis
- Export all data to CSV with AI service information

### Privacy & Security
- Each installation gets a unique user ID
- No personal information is collected
- Data is stored securely on the server
- Each user's data is completely isolated

## How It Works

The extension uses different extraction methods for each AI service:

### ChatGPT
1. **Detection**: Monitors ChatGPT conversation pages for changes
2. **Extraction**: Accesses ChatGPT's internal API to fetch conversation data
3. **Parsing**: Recursively searches the conversation data for search query objects
4. **Storage**: Sends extracted queries to a secure server for storage

### Gemini
1. **Detection**: Monitors Gemini conversation pages for activity
2. **Network Interception**: Intercepts network requests to capture search queries
3. **Pattern Matching**: Uses advanced pattern matching to extract "Google Search" queries
4. **Real-time Capture**: Captures queries as they're generated during conversations

## Usage

### ChatGPT
1. **Navigate to ChatGPT**: Go to https://chatgpt.com and start a conversation with search enabled
2. **Ask Questions**: Use prompts that require web search (current events, recent information, etc.)
3. **View Queries**: Click the extension icon to see extracted search queries

### Gemini
1. **Navigate to Gemini**: Go to https://gemini.google.com and start a conversation
2. **Ask Questions**: Use prompts that trigger web searches (current events, real-time data, etc.)
3. **View Queries**: The extension automatically captures search queries from network responses

### Analysis
- Use the "View All Queries" button to see your complete search history
- Filter by AI service to compare search strategies
- Export data to CSV for detailed analysis

## Understanding Search Queries

The captured queries reveal how different AI models approach search:

### ChatGPT Search Patterns
- Tends to break down complex queries into specific, targeted searches
- Often uses academic and formal language in queries
- Focuses on comprehensive information gathering

### Gemini Search Patterns
- May use more conversational search terms
- Often generates multiple related queries quickly
- Leverages Google's search expertise

## Example Queries

For a prompt like "What are the latest developments in AI safety research?":

**ChatGPT might generate**:
- "AI safety research 2024 latest developments"
- "artificial intelligence alignment recent papers"
- "machine learning safety governance updates"

**Gemini might generate**:
- "latest AI safety research news"
- "artificial intelligence safety developments 2024"
- "AI alignment recent breakthroughs"

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: activeTab, storage, host permissions for ChatGPT, Gemini, and server
- **Content Script**: Runs on both chatgpt.com and gemini.google.com pages
- **Background**: No persistent background script (efficient resource usage)
- **Server**: Secure Node.js/Express server deployed on Vercel with support for both AI services

## Supported URLs
- https://chatgpt.com/*
- https://gemini.google.com/*

## Troubleshooting

### Extension Not Working
- Ensure you're on a supported AI conversation page
- Check that the extension is enabled in chrome://extensions/
- Look for console errors in DevTools

### No Queries Found
- **ChatGPT**: Make sure you're using ChatGPT with search enabled in a conversation (URL contains `/c/`)
- **Gemini**: Ensure you're asking questions that trigger web searches
- Try asking questions about recent events or current information
- Use the manual "Extract Current Page" button

### Server Connection Issues
- Check your internet connection
- The extension popup shows server status (green = online, red = offline)
- Server automatically handles authentication

## Privacy Policy

- **No Personal Data**: The extension doesn't collect personal information
- **Unique User ID**: Generated locally on first install
- **Query Context**: Only the search queries and basic context are stored
- **AI Service Tracking**: Records which AI service generated each query for analysis
- **No Conversation Content**: Full conversation content is not stored
- **Secure Transfer**: All data transmitted over HTTPS
- **Data Isolation**: Each user's data is completely separate

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Ensure you're using the latest version of Chrome
3. Verify the extension has necessary permissions for both AI services
4. Try refreshing the AI conversation page

## Version History

- **v1.1.0**: Added Gemini support with network interception, AI service indicators, filtering, and enhanced CSV export
- **v1.0.0**: Initial release with ChatGPT query extraction and storage