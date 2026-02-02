/**
 * @name Find Chrome permission usage patterns
 * @description Maps Chrome API calls to required permissions, detecting permission overreach
 * @kind problem
 * @problem.severity warning
 * @precision high
 * @id js/chrome-permission-usage
 * @tags security
 *        permissions
 */

import javascript

/**
 * Detects chrome.* API calls and maps them to required permissions
 */
from PropAccess chromeApi, string permission, string risk
where
  // High-risk: can read/modify all web traffic
  (chromeApi.getPropertyName() = "webRequest" and
   permission = "webRequest" and risk = "HIGH: Can intercept all network traffic") or

  (chromeApi.getPropertyName() = "webRequestBlocking" and
   permission = "webRequestBlocking" and risk = "CRITICAL: Can block/modify network requests") or

  // High-risk: access to user data
  (chromeApi.getPropertyName() = "cookies" and
   permission = "cookies" and risk = "HIGH: Can read/write cookies for any site") or

  (chromeApi.getPropertyName() = "history" and
   permission = "history" and risk = "HIGH: Can read entire browsing history") or

  (chromeApi.getPropertyName() = "bookmarks" and
   permission = "bookmarks" and risk = "MEDIUM: Can read/modify bookmarks") or

  // Medium-risk: browser control
  (chromeApi.getPropertyName() = "tabs" and
   permission = "tabs" and risk = "MEDIUM: Can see all tab URLs and titles") or

  (chromeApi.getPropertyName() = "activeTab" and
   permission = "activeTab" and risk = "LOW: Access to current tab only") or

  (chromeApi.getPropertyName() = "downloads" and
   permission = "downloads" and risk = "MEDIUM: Can access download history and trigger downloads") or

  // Storage
  (chromeApi.getPropertyName() = "storage" and
   permission = "storage" and risk = "LOW: Extension-local storage") or

  // Identity/auth
  (chromeApi.getPropertyName() = "identity" and
   permission = "identity" and risk = "HIGH: Can access user's Google identity") or

  // Scripting
  (chromeApi.getPropertyName() = "scripting" and
   permission = "scripting" and risk = "HIGH: Can inject scripts into pages") or

  // Management
  (chromeApi.getPropertyName() = "management" and
   permission = "management" and risk = "CRITICAL: Can manage other extensions") or

  // Privacy
  (chromeApi.getPropertyName() = "privacy" and
   permission = "privacy" and risk = "HIGH: Can modify privacy settings") or

  // Proxy
  (chromeApi.getPropertyName() = "proxy" and
   permission = "proxy" and risk = "CRITICAL: Can redirect all traffic") or

  // DebuggerAttached
  (chromeApi.getPropertyName() = "debugger" and
   permission = "debugger" and risk = "CRITICAL: Full debugger access to pages") or

  // Native messaging
  (chromeApi.getPropertyName() = "nativeMessaging" and
   permission = "nativeMessaging" and risk = "CRITICAL: Can communicate with native apps") or

  // Declarative Net Request
  (chromeApi.getPropertyName() = "declarativeNetRequest" and
   permission = "declarativeNetRequest" and risk = "HIGH: Can modify network requests")

select chromeApi, "PERMISSION_USAGE: " + permission + " - " + risk
