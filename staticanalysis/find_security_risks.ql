/**
 * @name Tiered Security Risk Detection for Chrome Extensions
 * @description Comprehensive security analysis with CRITICAL/HIGH/MEDIUM/LOW severity tiers.
 *              Designed for thesis research - catches patterns at multiple levels while
 *              providing meaningful categorization. Uses cross-file analysis.
 * @kind problem
 * @problem.severity error
 * @precision medium
 * @id js/extension-security-risks
 * @tags security
 *        malware
 *        thesis
 */

/*
 * ============================================================================
 * IMPORTANT: SEVERITY LABELS ARE INTENTIONALLY IGNORED IN VALIDATION
 * ============================================================================
 *
 * RESEARCH FINDING: We initially implemented this query with severity tiers
 * (CRITICAL/HIGH/MEDIUM/LOW) and weighted scoring, intending to guide both
 * LLM and human validators by highlighting "high-risk" patterns.
 *
 * Through experimentation, we discovered that severity labels **BIAS validators**:
 *   - LLM validators over-weight patterns labeled "CRITICAL" even in benign contexts
 *   - Human validators exhibit confirmation bias when shown severity scores
 *   - Context matters MORE than whether a pattern exists at all
 *
 * Example: The pattern "CREDENTIAL_ACCESS" could be:
 *   - BENIGN: A legitimate password manager accessing stored credentials
 *   - MALICIOUS: A calculator extension stealing passwords
 *
 * The SEVERITY is identical (both access credentials), but the CONTEXT determines
 * maliciousness. Pre-labeling patterns as "CRITICAL" caused validators to flag
 * the password manager as suspicious.
 *
 * CURRENT APPROACH:
 *   - Severity labels remain in this code as a record of our initial experimental
 *     design, preserved to document the research process
 *   - Labels are **COMPLETELY IGNORED** during validation
 *   - LLM receives ONLY: pattern type, file:line, code context (no severity)
 *
 * See validate_batch_gemini.py:format_raw_findings_for_prompt() where severity
 * labels are explicitly stripped with the comment "NO severity labels - just
 * what was found and where."
 *
 * This context-first approach eliminates validator bias and allows independent
 * reasoning about malicious intent based on actual code behavior.
 * ============================================================================
 */

import javascript

// ============================================
// HELPER PREDICATES
// ============================================

/**
 * Check if file is a known third-party library (for context labeling)
 * Only checks filename patterns - DO NOT filter by line count as malicious
 * code is often bundled into large single files
 */
predicate isThirdPartyLibrary(File f) {
  f.getBaseName().regexpMatch("(?i).*(jquery|react|angular|vue|lodash|moment|axios|firebase|dexie|prism).*\\.js")
  or
  // Only skip .min.js files that are ALSO named after known libraries
  (f.getBaseName().regexpMatch(".*\\.min\\.js") and
   f.getBaseName().regexpMatch("(?i).*(jquery|react|angular|vue|lodash|moment|bootstrap|popper).*"))
}

/**
 * Get library context label
 */
string getFileContext(File f) {
  if isThirdPartyLibrary(f) then result = "[LIB]" else result = "[EXT]"
}

// ============================================
// CRITICAL SEVERITY - Clear malicious intent
// ============================================

/**
 * CRITICAL: eval() or new Function() anywhere in extension code
 */
class CriticalEval extends CallExpr {
  CriticalEval() {
    this.getCalleeName() = "eval" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: new Function() - dynamic code creation
 */
class CriticalNewFunction extends NewExpr {
  CriticalNewFunction() {
    this.getCalleeName() = "Function" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: atob() base64 decode in extension code
 */
class CriticalBase64 extends CallExpr {
  CriticalBase64() {
    this.getCalleeName() = "atob" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: XMLHttpRequest.prototype modification - API hijacking
 * Pattern: XMLHttpRequest.prototype.open = ... or .send = ...
 */
class CriticalXHRPrototypeHijack extends AssignExpr {
  CriticalXHRPrototypeHijack() {
    exists(PropAccess pa |
      this.getLhs() = pa and
      pa.getBase().toString().regexpMatch("(?i).*XMLHttpRequest\\.prototype.*") and
      pa.getPropertyName().regexpMatch("open|send|setRequestHeader|getAllResponseHeaders|getResponseHeader")
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: JSON.parse override - data interception
 * Pattern: JSON.parse = ... or const original = JSON.parse
 */
class CriticalJSONParseHijack extends AssignExpr {
  CriticalJSONParseHijack() {
    (
      // Direct override: JSON.parse = function...
      exists(PropAccess pa |
        this.getLhs() = pa and
        pa.getBase().toString() = "JSON" and
        pa.getPropertyName() = "parse"
      )
      or
      // Saving original: const original = JSON.parse (followed by override)
      exists(PropAccess pa |
        this.getRhs() = pa and
        pa.getBase().toString() = "JSON" and
        pa.getPropertyName() = "parse" and
        // Same file has an override
        exists(AssignExpr override, PropAccess overridePa |
          override.getFile() = this.getFile() and
          override.getLhs() = overridePa and
          overridePa.getBase().toString() = "JSON" and
          overridePa.getPropertyName() = "parse"
        )
      )
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: Fetch API override - network interception
 * Pattern: window.fetch = ... or const originalFetch = window.fetch
 */
class CriticalFetchHijack extends AssignExpr {
  CriticalFetchHijack() {
    exists(PropAccess pa |
      this.getLhs() = pa and
      pa.getPropertyName() = "fetch" and
      pa.getBase().toString().regexpMatch("(?i)(window|self|globalThis)")
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: Object.defineProperty on native prototypes - stealth hijacking
 * Pattern: Object.defineProperty(XMLHttpRequest.prototype, ...)
 */
class CriticalDefinePropertyHijack extends MethodCallExpr {
  CriticalDefinePropertyHijack() {
    this.getMethodName() = "defineProperty" and
    this.getReceiver().toString() = "Object" and
    this.getArgument(0).toString().regexpMatch("(?i).*(XMLHttpRequest|JSON|Response|Request|fetch|document|window)\\.prototype.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: chrome.webRequest.onAuthRequired - credential interception
 * Documented in Dec 2024 attacks - injects credentials into HTTP auth challenges
 * Source: TheHackerNews Dec 2024 Chrome extension attacks
 */
class CriticalAuthInterception extends Expr {
  CriticalAuthInterception() {
    this.toString().regexpMatch(".*chrome\\.webRequest\\.onAuthRequired.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: chrome.proxy API - MitM proxy configuration
 * Used by malware to route traffic through attacker-controlled proxies
 * Source: Malicious extensions credential theft via proxy MitM
 */
class CriticalProxyConfig extends Expr {
  CriticalProxyConfig() {
    this.toString().regexpMatch(".*chrome\\.proxy\\.(settings|onRequest).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: chrome.debugger API - full browser control
 * Allows complete inspection and modification of any tab
 */
class CriticalDebuggerAPI extends Expr {
  CriticalDebuggerAPI() {
    this.toString().regexpMatch(".*chrome\\.debugger.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * CRITICAL: importScripts in service worker with external URL
 * Remote code loading in background context
 */
class CriticalRemoteImportScripts extends CallExpr {
  CriticalRemoteImportScripts() {
    this.getCalleeName() = "importScripts" and
    this.getAnArgument().toString().regexpMatch(".*https?://.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// HIGH SEVERITY - Suspicious combinations
// ============================================

/**
 * HIGH: Any keyboard event listener on document/window
 */
class HighKeyboardListener extends MethodCallExpr {
  HighKeyboardListener() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]key(down|up|press)['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: document.cookie access
 */
class HighCookieAccess extends PropAccess {
  HighCookieAccess() {
    this.getPropertyName() = "cookie" and
    this.getBase().toString().regexpMatch("(?i)document") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: chrome.cookies API usage
 */
class HighChromeCookies extends Expr {
  HighChromeCookies() {
    this.toString().regexpMatch(".*chrome\\.cookies.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: chrome.history access
 */
class HighHistoryAccess extends Expr {
  HighHistoryAccess() {
    this.toString().regexpMatch(".*chrome\\.history.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Dynamic script element creation
 */
class HighDynamicScript extends MethodCallExpr {
  HighDynamicScript() {
    this.getMethodName() = "createElement" and
    this.getArgument(0).toString().regexpMatch(".*['\"]script['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: WebSocket creation
 */
class HighWebSocket extends NewExpr {
  HighWebSocket() {
    this.getCalleeName() = "WebSocket" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Form submit listener
 */
class HighFormSubmit extends MethodCallExpr {
  HighFormSubmit() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]submit['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: CustomEvent creation with data payload - often used for data exfiltration
 * Pattern: new CustomEvent('eventName', {detail: sensitiveData})
 */
class HighCustomEventWithData extends NewExpr {
  HighCustomEventWithData() {
    this.getCalleeName() = "CustomEvent" and
    this.getNumArgument() >= 2 and  // Has options object with data
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: dispatchEvent - sending custom events (potential exfil channel)
 */
class HighDispatchEvent extends MethodCallExpr {
  HighDispatchEvent() {
    this.getMethodName() = "dispatchEvent" and
    // More suspicious if combined with CustomEvent in same file
    exists(NewExpr ce |
      ce.getFile() = this.getFile() and
      ce.getCalleeName() = "CustomEvent"
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Response.prototype or Request.prototype modification
 */
class HighResponseRequestHijack extends AssignExpr {
  HighResponseRequestHijack() {
    exists(PropAccess pa |
      this.getLhs() = pa and
      pa.getBase().toString().regexpMatch("(?i).*(Response|Request)\\.prototype.*")
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Proxy usage on global objects - stealth interception
 * Pattern: new Proxy(XMLHttpRequest, ...) or Proxy(fetch, ...)
 */
class HighProxyInterception extends NewExpr {
  HighProxyInterception() {
    this.getCalleeName() = "Proxy" and
    this.getArgument(0).toString().regexpMatch("(?i).*(XMLHttpRequest|fetch|JSON|Response|Request|document|window).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: chrome.scripting.executeScript - inject code into pages
 * MV3 equivalent of tabs.executeScript, can inject arbitrary code
 */
class HighScriptingExecute extends Expr {
  HighScriptingExecute() {
    this.toString().regexpMatch(".*chrome\\.scripting\\.executeScript.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Image/pixel beacon exfiltration
 * Pattern: new Image().src = url + data or img.src with query params
 * Classic exfil technique - sends data via image request
 */
class HighImageBeacon extends AssignExpr {
  HighImageBeacon() {
    exists(PropAccess pa |
      pa.getPropertyName() = "src" and
      this.getLhs() = pa and
      // Check for data in URL (query params or path)
      this.getRhs().toString().regexpMatch(".*[?&=].*")
    ) and
    // Same file creates Image
    exists(NewExpr img |
      img.getFile() = this.getFile() and
      img.getCalleeName() = "Image"
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: navigator.sendBeacon - fire-and-forget data exfiltration
 * Survives page unload, perfect for stealing data
 */
class HighSendBeacon extends MethodCallExpr {
  HighSendBeacon() {
    this.getMethodName() = "sendBeacon" and
    this.getReceiver().toString().regexpMatch("(?i)navigator") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Input event listeners on document - form field monitoring
 * Pattern: document.addEventListener('input', ...) - captures all typing
 */
class HighInputListener extends MethodCallExpr {
  HighInputListener() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]input['\"].*") and
    this.getReceiver().toString().regexpMatch("(?i)document") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: chrome.webRequest.onBeforeRequest with blocking
 * Can intercept and modify all network requests
 */
class HighWebRequestBlocking extends Expr {
  HighWebRequestBlocking() {
    this.toString().regexpMatch(".*chrome\\.webRequest\\.onBefore(Request|SendHeaders).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Accessing credentials from storage
 * Pattern: chrome.storage.*.get with credential-like keys
 */
class HighCredentialStorageAccess extends MethodCallExpr {
  HighCredentialStorageAccess() {
    this.getMethodName() = "get" and
    this.getReceiver().toString().regexpMatch(".*chrome\\.storage\\.(local|sync).*") and
    this.getAnArgument().toString().regexpMatch("(?i).*(password|credential|token|secret|api.?key|auth).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: setTimeout/setInterval with string argument (hidden eval)
 * Pattern: setTimeout("malicious code", 1000) - executes string as code
 */
class HighTimerStringEval extends CallExpr {
  HighTimerStringEval() {
    this.getCalleeName().regexpMatch("setTimeout|setInterval") and
    this.getArgument(0) instanceof StringLiteral and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * HIGH: Accessing chrome.identity - OAuth token access
 */
class HighIdentityAccess extends Expr {
  HighIdentityAccess() {
    this.toString().regexpMatch(".*chrome\\.identity\\.(getAuthToken|launchWebAuthFlow).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// MEDIUM SEVERITY - Suspicious single patterns
// ============================================

/**
 * MEDIUM: localStorage/sessionStorage getItem for sensitive keys
 */
class MediumStorageAccess extends MethodCallExpr {
  MediumStorageAccess() {
    this.getMethodName() = "getItem" and
    this.getArgument(0).toString().regexpMatch("(?i).*(token|auth|session|api.?key|password|secret|jwt).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * MEDIUM: Clipboard events
 */
class MediumClipboard extends MethodCallExpr {
  MediumClipboard() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"](copy|paste|cut)['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * MEDIUM: MutationObserver
 */
class MediumMutationObserver extends NewExpr {
  MediumMutationObserver() {
    this.getCalleeName() = "MutationObserver" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * MEDIUM: fetch() call in extension code
 */
class MediumFetch extends CallExpr {
  MediumFetch() {
    this.getCalleeName() = "fetch" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * MEDIUM: chrome.tabs access
 */
class MediumTabsAccess extends Expr {
  MediumTabsAccess() {
    this.toString().regexpMatch(".*chrome\\.tabs\\.(query|get|update).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * MEDIUM: chrome.webRequest
 */
class MediumWebRequest extends Expr {
  MediumWebRequest() {
    this.toString().regexpMatch(".*chrome\\.webRequest.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * MEDIUM: Password field selector
 */
class MediumPasswordSelector extends MethodCallExpr {
  MediumPasswordSelector() {
    this.getMethodName().regexpMatch("querySelector(All)?|getElementById") and
    this.getArgument(0).toString().regexpMatch("(?i).*(password|passwd|pwd).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// LOW SEVERITY - Noteworthy patterns
// ============================================

/**
 * LOW: innerHTML assignment
 */
class LowInnerHTML extends AssignExpr {
  LowInnerHTML() {
    exists(PropAccess pa |
      pa.getPropertyName() = "innerHTML" and
      this.getLhs() = pa
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * LOW: XMLHttpRequest
 */
class LowXHR extends NewExpr {
  LowXHR() {
    this.getCalleeName() = "XMLHttpRequest" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * LOW: postMessage
 */
class LowPostMessage extends MethodCallExpr {
  LowPostMessage() {
    this.getMethodName() = "postMessage" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * LOW: Blob URL creation
 */
class LowBlobURL extends MethodCallExpr {
  LowBlobURL() {
    this.getMethodName() = "createObjectURL" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * LOW: setInterval (potential polling)
 */
class LowInterval extends CallExpr {
  LowInterval() {
    this.getCalleeName() = "setInterval" and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * LOW: chrome.runtime.sendMessage
 */
class LowRuntimeMessage extends Expr {
  LowRuntimeMessage() {
    this.toString().regexpMatch(".*\\.runtime\\.sendMessage.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

/**
 * LOW: chrome.storage access
 */
class LowStorageAccess extends Expr {
  LowStorageAccess() {
    this.toString().regexpMatch(".*chrome\\.storage.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// MAIN QUERY - Tiered output
// ============================================
from Expr finding, string severity, string category, string description
where
  // CRITICAL findings
  (finding instanceof CriticalEval and
   severity = "CRITICAL" and category = "EVAL" and
   description = "eval() dynamic code execution")
  or
  (finding instanceof CriticalNewFunction and
   severity = "CRITICAL" and category = "NEW_FUNCTION" and
   description = "new Function() dynamic code creation")
  or
  (finding instanceof CriticalBase64 and
   severity = "CRITICAL" and category = "BASE64_DECODE" and
   description = "atob() base64 decoding")
  or
  (finding instanceof CriticalXHRPrototypeHijack and
   severity = "CRITICAL" and category = "XHR_PROTOTYPE_HIJACK" and
   description = "XMLHttpRequest.prototype modification - API interception")
  or
  (finding instanceof CriticalJSONParseHijack and
   severity = "CRITICAL" and category = "JSON_PARSE_HIJACK" and
   description = "JSON.parse override - data interception")
  or
  (finding instanceof CriticalFetchHijack and
   severity = "CRITICAL" and category = "FETCH_HIJACK" and
   description = "window.fetch override - network interception")
  or
  (finding instanceof CriticalDefinePropertyHijack and
   severity = "CRITICAL" and category = "DEFINE_PROPERTY_HIJACK" and
   description = "Object.defineProperty on native prototype")
  or
  (finding instanceof CriticalAuthInterception and
   severity = "CRITICAL" and category = "AUTH_INTERCEPTION" and
   description = "chrome.webRequest.onAuthRequired - credential interception")
  or
  (finding instanceof CriticalProxyConfig and
   severity = "CRITICAL" and category = "PROXY_CONFIG" and
   description = "chrome.proxy API - MitM proxy configuration")
  or
  (finding instanceof CriticalDebuggerAPI and
   severity = "CRITICAL" and category = "DEBUGGER_API" and
   description = "chrome.debugger API - full browser control")
  or
  (finding instanceof CriticalRemoteImportScripts and
   severity = "CRITICAL" and category = "REMOTE_IMPORT" and
   description = "importScripts with external URL - remote code loading")
  or
  // HIGH findings
  (finding instanceof HighKeyboardListener and
   severity = "HIGH" and category = "KEYBOARD_LISTENER" and
   description = "Keyboard event listener")
  or
  (finding instanceof HighCookieAccess and
   severity = "HIGH" and category = "COOKIE_ACCESS" and
   description = "document.cookie access")
  or
  (finding instanceof HighChromeCookies and
   severity = "HIGH" and category = "CHROME_COOKIES" and
   description = "chrome.cookies API")
  or
  (finding instanceof HighHistoryAccess and
   severity = "HIGH" and category = "HISTORY_ACCESS" and
   description = "chrome.history API")
  or
  (finding instanceof HighDynamicScript and
   severity = "HIGH" and category = "DYNAMIC_SCRIPT" and
   description = "Dynamic script creation")
  or
  (finding instanceof HighWebSocket and
   severity = "HIGH" and category = "WEBSOCKET" and
   description = "WebSocket connection")
  or
  (finding instanceof HighFormSubmit and
   severity = "HIGH" and category = "FORM_SUBMIT" and
   description = "Form submit listener")
  or
  (finding instanceof HighCustomEventWithData and
   severity = "HIGH" and category = "CUSTOM_EVENT_DATA" and
   description = "CustomEvent with data payload")
  or
  (finding instanceof HighDispatchEvent and
   severity = "HIGH" and category = "DISPATCH_EVENT" and
   description = "dispatchEvent with CustomEvent - potential exfil")
  or
  (finding instanceof HighResponseRequestHijack and
   severity = "HIGH" and category = "RESPONSE_REQUEST_HIJACK" and
   description = "Response/Request prototype modification")
  or
  (finding instanceof HighProxyInterception and
   severity = "HIGH" and category = "PROXY_INTERCEPTION" and
   description = "Proxy on global/native object")
  or
  (finding instanceof HighScriptingExecute and
   severity = "HIGH" and category = "SCRIPTING_EXECUTE" and
   description = "chrome.scripting.executeScript - code injection")
  or
  (finding instanceof HighImageBeacon and
   severity = "HIGH" and category = "IMAGE_BEACON" and
   description = "Image beacon exfiltration")
  or
  (finding instanceof HighSendBeacon and
   severity = "HIGH" and category = "SEND_BEACON" and
   description = "navigator.sendBeacon - fire-and-forget exfil")
  or
  (finding instanceof HighInputListener and
   severity = "HIGH" and category = "INPUT_LISTENER" and
   description = "Document input listener - form monitoring")
  or
  (finding instanceof HighWebRequestBlocking and
   severity = "HIGH" and category = "WEBREQUEST_BLOCKING" and
   description = "chrome.webRequest.onBefore* - request interception")
  or
  (finding instanceof HighCredentialStorageAccess and
   severity = "HIGH" and category = "CREDENTIAL_STORAGE" and
   description = "chrome.storage access for credentials")
  or
  (finding instanceof HighTimerStringEval and
   severity = "HIGH" and category = "TIMER_STRING_EVAL" and
   description = "setTimeout/setInterval with string - hidden eval")
  or
  (finding instanceof HighIdentityAccess and
   severity = "HIGH" and category = "IDENTITY_ACCESS" and
   description = "chrome.identity - OAuth token access")
  or
  // MEDIUM findings
  (finding instanceof MediumStorageAccess and
   severity = "MEDIUM" and category = "SENSITIVE_STORAGE" and
   description = "Storage access for sensitive key")
  or
  (finding instanceof MediumClipboard and
   severity = "MEDIUM" and category = "CLIPBOARD" and
   description = "Clipboard event listener")
  or
  (finding instanceof MediumMutationObserver and
   severity = "MEDIUM" and category = "MUTATION_OBSERVER" and
   description = "DOM mutation observer")
  or
  (finding instanceof MediumFetch and
   severity = "MEDIUM" and category = "FETCH" and
   description = "fetch() network request")
  or
  (finding instanceof MediumTabsAccess and
   severity = "MEDIUM" and category = "TABS_ACCESS" and
   description = "chrome.tabs API")
  or
  (finding instanceof MediumWebRequest and
   severity = "MEDIUM" and category = "WEB_REQUEST" and
   description = "chrome.webRequest API")
  or
  (finding instanceof MediumPasswordSelector and
   severity = "MEDIUM" and category = "PASSWORD_SELECTOR" and
   description = "Password field selector")
  or
  // LOW findings
  (finding instanceof LowInnerHTML and
   severity = "LOW" and category = "INNERHTML" and
   description = "innerHTML assignment")
  or
  (finding instanceof LowXHR and
   severity = "LOW" and category = "XHR" and
   description = "XMLHttpRequest")
  or
  (finding instanceof LowPostMessage and
   severity = "LOW" and category = "POST_MESSAGE" and
   description = "postMessage cross-origin")
  or
  (finding instanceof LowBlobURL and
   severity = "LOW" and category = "BLOB_URL" and
   description = "Blob URL creation")
  or
  (finding instanceof LowInterval and
   severity = "LOW" and category = "SET_INTERVAL" and
   description = "setInterval polling")
  or
  (finding instanceof LowRuntimeMessage and
   severity = "LOW" and category = "RUNTIME_MESSAGE" and
   description = "Extension messaging")
  or
  (finding instanceof LowStorageAccess and
   severity = "LOW" and category = "CHROME_STORAGE" and
   description = "chrome.storage access")

select finding,
  "[" + severity + "] " + category + ": " + description + " " +
  getFileContext(finding.getFile()) + " " +
  finding.getLocation().getFile().getBaseName() + ":" +
  finding.getLocation().getStartLine().toString()
