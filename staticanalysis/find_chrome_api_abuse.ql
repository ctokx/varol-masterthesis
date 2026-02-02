/**
 * @name Find Chrome API abuse
 * @description Detects potentially dangerous Chrome extension API usage
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id js/chrome-api-abuse
 * @tags security
 */

import javascript

from PropAccess p, string api
where
  // chrome.cookies
  (p.getPropertyName() = "cookies" and api = "COOKIES: chrome.cookies") or
  
  // chrome.history
  (p.getPropertyName() = "history" and api = "HISTORY: chrome.history") or
  
  // chrome.webRequest
  (p.getPropertyName() = "webRequest" and api = "WEBREQUEST: chrome.webRequest") or
  
  // chrome.downloads
  (p.getPropertyName() = "downloads" and api = "DOWNLOADS: chrome.downloads") or
  
  // chrome.bookmarks
  (p.getPropertyName() = "bookmarks" and api = "BOOKMARKS: chrome.bookmarks") or
  
  // chrome.tabs
  (p.getPropertyName() = "tabs" and api = "TABS: chrome.tabs") or
  
  // chrome.storage
  (p.getPropertyName() = "storage" and api = "STORAGE: chrome.storage")

select p, api
