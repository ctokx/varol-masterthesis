/**
 * @name Capability Extraction for Chrome Extensions
 * @description Extracts behavioral capabilities WITHOUT severity labels.
 *              Severity is determined by the AI based on context.
 *              Groups: INTERCEPTION, DYNAMIC_EXEC, CREDENTIAL_ACCESS, 
 *                      KEYBOARD, NETWORK, DOM, STORAGE
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id js/extension-capabilities
 * @tags security
 *       capabilities
 *       context-first
 */

import javascript

// ============================================
// HELPER PREDICATES
// ============================================

/**
 * Check if file is a known third-party library (for context labeling)
 */
predicate isThirdPartyLibrary(File f) {
  f.getBaseName().regexpMatch("(?i).*(jquery|react|angular|vue|lodash|moment|axios|firebase|dexie|prism).*\\.js")
  or
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
// INTERCEPTION - API/Protocol Override Patterns
// ============================================

class InterceptionEval extends CallExpr {
  InterceptionEval() {
    this.getCalleeName() = "eval" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionNewFunction extends NewExpr {
  InterceptionNewFunction() {
    this.getCalleeName() = "Function" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionBase64 extends CallExpr {
  InterceptionBase64() {
    this.getCalleeName() = "atob" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionXHRPrototype extends AssignExpr {
  InterceptionXHRPrototype() {
    exists(PropAccess pa |
      this.getLhs() = pa and
      pa.getBase().toString().regexpMatch("(?i).*XMLHttpRequest\\.prototype.*") and
      pa.getPropertyName().regexpMatch("open|send|setRequestHeader|getAllResponseHeaders|getResponseHeader")
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionJSONParse extends AssignExpr {
  InterceptionJSONParse() {
    exists(PropAccess pa |
      this.getLhs() = pa and
      pa.getBase().toString() = "JSON" and
      pa.getPropertyName() = "parse"
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionFetch extends AssignExpr {
  InterceptionFetch() {
    exists(PropAccess pa |
      this.getLhs() = pa and
      pa.getPropertyName() = "fetch" and
      pa.getBase().toString().regexpMatch("(?i)(window|self|globalThis)")
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionDefineProperty extends MethodCallExpr {
  InterceptionDefineProperty() {
    this.getMethodName() = "defineProperty" and
    this.getReceiver().toString() = "Object" and
    this.getArgument(0).toString().regexpMatch("(?i).*(XMLHttpRequest|JSON|Response|Request|fetch|document|window)\\.prototype.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionAuthRequired extends Expr {
  InterceptionAuthRequired() {
    this.toString().regexpMatch(".*chrome\\.webRequest\\.onAuthRequired.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionProxy extends Expr {
  InterceptionProxy() {
    this.toString().regexpMatch(".*chrome\\.proxy\\.(settings|onRequest).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionDebugger extends Expr {
  InterceptionDebugger() {
    this.toString().regexpMatch(".*chrome\\.debugger.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionImportScripts extends CallExpr {
  InterceptionImportScripts() {
    this.getCalleeName() = "importScripts" and
    this.getAnArgument().toString().regexpMatch(".*https?://.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class InterceptionProxyObject extends NewExpr {
  InterceptionProxyObject() {
    this.getCalleeName() = "Proxy" and
    this.getArgument(0).toString().regexpMatch("(?i).*(XMLHttpRequest|fetch|JSON|Response|Request|document|window).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// CREDENTIAL_ACCESS - Cookie/Password/Token Access
// ============================================

class CredentialCookieAccess extends PropAccess {
  CredentialCookieAccess() {
    this.getPropertyName() = "cookie" and
    this.getBase().toString().regexpMatch("(?i)document") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class CredentialChromeCookies extends Expr {
  CredentialChromeCookies() {
    this.toString().regexpMatch(".*chrome\\.cookies.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class CredentialHistoryAccess extends Expr {
  CredentialHistoryAccess() {
    this.toString().regexpMatch(".*chrome\\.history.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class CredentialStorageAccess extends MethodCallExpr {
  CredentialStorageAccess() {
    this.getMethodName() = "get" and
    this.getReceiver().toString().regexpMatch(".*chrome\\.storage\\.(local|sync).*") and
    this.getAnArgument().toString().regexpMatch("(?i).*(password|credential|token|secret|api.?key|auth).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class CredentialIdentityAccess extends Expr {
  CredentialIdentityAccess() {
    this.toString().regexpMatch(".*chrome\\.identity\\.(getAuthToken|launchWebAuthFlow).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class CredentialPasswordSelector extends MethodCallExpr {
  CredentialPasswordSelector() {
    this.getMethodName().regexpMatch("querySelector(All)?|getElementById") and
    this.getArgument(0).toString().regexpMatch("(?i).*(password|passwd|pwd).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class CredentialSensitiveStorage extends MethodCallExpr {
  CredentialSensitiveStorage() {
    this.getMethodName() = "getItem" and
    this.getArgument(0).toString().regexpMatch("(?i).*(token|auth|session|api.?key|password|secret|jwt).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// KEYBOARD - Input Monitoring
// ============================================

class KeyboardListener extends MethodCallExpr {
  KeyboardListener() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]key(down|up|press)['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class KeyboardInputListener extends MethodCallExpr {
  KeyboardInputListener() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]input['\"].*") and
    this.getReceiver().toString().regexpMatch("(?i)document") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class KeyboardFormSubmit extends MethodCallExpr {
  KeyboardFormSubmit() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]submit['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class KeyboardClipboard extends MethodCallExpr {
  KeyboardClipboard() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"](copy|paste|cut)['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// NETWORK - Network Communication
// ============================================

class NetworkFetch extends CallExpr {
  NetworkFetch() {
    this.getCalleeName() = "fetch" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkWebSocket extends NewExpr {
  NetworkWebSocket() {
    this.getCalleeName() = "WebSocket" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkXHR extends NewExpr {
  NetworkXHR() {
    this.getCalleeName() = "XMLHttpRequest" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkSendBeacon extends MethodCallExpr {
  NetworkSendBeacon() {
    this.getMethodName() = "sendBeacon" and
    this.getReceiver().toString().regexpMatch("(?i)navigator") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkImageBeacon extends AssignExpr {
  NetworkImageBeacon() {
    exists(PropAccess pa |
      pa.getPropertyName() = "src" and
      this.getLhs() = pa and
      this.getRhs().toString().regexpMatch(".*[?&=].*")
    ) and
    exists(NewExpr img |
      img.getFile() = this.getFile() and
      img.getCalleeName() = "Image"
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkWebRequest extends Expr {
  NetworkWebRequest() {
    this.toString().regexpMatch(".*chrome\\.webRequest.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkWebRequestBlocking extends Expr {
  NetworkWebRequestBlocking() {
    this.toString().regexpMatch(".*chrome\\.webRequest\\.onBefore(Request|SendHeaders).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class NetworkPostMessage extends MethodCallExpr {
  NetworkPostMessage() {
    this.getMethodName() = "postMessage" and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// DOM - DOM Manipulation
// ============================================

class DOMInnerHTML extends AssignExpr {
  DOMInnerHTML() {
    exists(PropAccess pa |
      pa.getPropertyName() = "innerHTML" and
      this.getLhs() = pa
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

class DOMMutationObserver extends NewExpr {
  DOMMutationObserver() {
    this.getCalleeName() = "MutationObserver" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class DOMDynamicScript extends MethodCallExpr {
  DOMDynamicScript() {
    this.getMethodName() = "createElement" and
    this.getArgument(0).toString().regexpMatch(".*['\"]script['\"].*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class DOMScriptingExecute extends Expr {
  DOMScriptingExecute() {
    this.toString().regexpMatch(".*chrome\\.scripting\\.executeScript.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class DOMBlobURL extends MethodCallExpr {
  DOMBlobURL() {
    this.getMethodName() = "createObjectURL" and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// STORAGE - Data Storage
// ============================================

class StorageChromeStorage extends Expr {
  StorageChromeStorage() {
    this.toString().regexpMatch(".*chrome\\.storage.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class StorageRuntimeMessage extends Expr {
  StorageRuntimeMessage() {
    this.toString().regexpMatch(".*\\.runtime\\.sendMessage.*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class StorageTabsAccess extends Expr {
  StorageTabsAccess() {
    this.toString().regexpMatch(".*chrome\\.tabs\\.(query|get|update).*") and
    not isThirdPartyLibrary(this.getFile())
  }
}

class StorageInterval extends CallExpr {
  StorageInterval() {
    this.getCalleeName() = "setInterval" and
    not isThirdPartyLibrary(this.getFile())
  }
}

class StorageTimerStringEval extends CallExpr {
  StorageTimerStringEval() {
    this.getCalleeName().regexpMatch("setTimeout|setInterval") and
    this.getArgument(0) instanceof StringLiteral and
    not isThirdPartyLibrary(this.getFile())
  }
}

class StorageCustomEvent extends NewExpr {
  StorageCustomEvent() {
    this.getCalleeName() = "CustomEvent" and
    this.getNumArgument() >= 2 and
    not isThirdPartyLibrary(this.getFile())
  }
}

class StorageDispatchEvent extends MethodCallExpr {
  StorageDispatchEvent() {
    this.getMethodName() = "dispatchEvent" and
    exists(NewExpr ce |
      ce.getFile() = this.getFile() and
      ce.getCalleeName() = "CustomEvent"
    ) and
    not isThirdPartyLibrary(this.getFile())
  }
}

// ============================================
// MAIN QUERY - Capability-based output (no severity)
// ============================================
from Expr finding, string capability, string pattern, string description
where
  // INTERCEPTION patterns
  (finding instanceof InterceptionEval and
   capability = "INTERCEPTION" and pattern = "EVAL" and
   description = "eval() dynamic code execution")
  or
  (finding instanceof InterceptionNewFunction and
   capability = "INTERCEPTION" and pattern = "NEW_FUNCTION" and
   description = "new Function() dynamic code creation")
  or
  (finding instanceof InterceptionBase64 and
   capability = "INTERCEPTION" and pattern = "BASE64_DECODE" and
   description = "atob() base64 decoding")
  or
  (finding instanceof InterceptionXHRPrototype and
   capability = "INTERCEPTION" and pattern = "XHR_PROTOTYPE" and
   description = "XMLHttpRequest.prototype modification")
  or
  (finding instanceof InterceptionJSONParse and
   capability = "INTERCEPTION" and pattern = "JSON_PARSE" and
   description = "JSON.parse override")
  or
  (finding instanceof InterceptionFetch and
   capability = "INTERCEPTION" and pattern = "FETCH_OVERRIDE" and
   description = "window.fetch override")
  or
  (finding instanceof InterceptionDefineProperty and
   capability = "INTERCEPTION" and pattern = "DEFINE_PROPERTY" and
   description = "Object.defineProperty on native prototype")
  or
  (finding instanceof InterceptionAuthRequired and
   capability = "INTERCEPTION" and pattern = "AUTH_REQUIRED" and
   description = "chrome.webRequest.onAuthRequired")
  or
  (finding instanceof InterceptionProxy and
   capability = "INTERCEPTION" and pattern = "PROXY_CONFIG" and
   description = "chrome.proxy API")
  or
  (finding instanceof InterceptionDebugger and
   capability = "INTERCEPTION" and pattern = "DEBUGGER" and
   description = "chrome.debugger API")
  or
  (finding instanceof InterceptionImportScripts and
   capability = "INTERCEPTION" and pattern = "IMPORT_SCRIPTS" and
   description = "importScripts with external URL")
  or
  (finding instanceof InterceptionProxyObject and
   capability = "INTERCEPTION" and pattern = "PROXY_OBJECT" and
   description = "Proxy on global object")
  or
  // CREDENTIAL_ACCESS patterns
  (finding instanceof CredentialCookieAccess and
   capability = "CREDENTIAL_ACCESS" and pattern = "DOCUMENT_COOKIE" and
   description = "document.cookie access")
  or
  (finding instanceof CredentialChromeCookies and
   capability = "CREDENTIAL_ACCESS" and pattern = "CHROME_COOKIES" and
   description = "chrome.cookies API")
  or
  (finding instanceof CredentialHistoryAccess and
   capability = "CREDENTIAL_ACCESS" and pattern = "CHROME_HISTORY" and
   description = "chrome.history API")
  or
  (finding instanceof CredentialStorageAccess and
   capability = "CREDENTIAL_ACCESS" and pattern = "CREDENTIAL_STORAGE" and
   description = "chrome.storage access for credentials")
  or
  (finding instanceof CredentialIdentityAccess and
   capability = "CREDENTIAL_ACCESS" and pattern = "CHROME_IDENTITY" and
   description = "chrome.identity OAuth access")
  or
  (finding instanceof CredentialPasswordSelector and
   capability = "CREDENTIAL_ACCESS" and pattern = "PASSWORD_SELECTOR" and
   description = "Password field selector")
  or
  (finding instanceof CredentialSensitiveStorage and
   capability = "CREDENTIAL_ACCESS" and pattern = "SENSITIVE_STORAGE" and
   description = "Storage access for sensitive key")
  or
  // KEYBOARD patterns
  (finding instanceof KeyboardListener and
   capability = "KEYBOARD" and pattern = "KEY_LISTENER" and
   description = "Keyboard event listener")
  or
  (finding instanceof KeyboardInputListener and
   capability = "KEYBOARD" and pattern = "INPUT_LISTENER" and
   description = "Document input listener")
  or
  (finding instanceof KeyboardFormSubmit and
   capability = "KEYBOARD" and pattern = "FORM_SUBMIT" and
   description = "Form submit listener")
  or
  (finding instanceof KeyboardClipboard and
   capability = "KEYBOARD" and pattern = "CLIPBOARD" and
   description = "Clipboard event listener")
  or
  // NETWORK patterns
  (finding instanceof NetworkFetch and
   capability = "NETWORK" and pattern = "FETCH" and
   description = "fetch() network request")
  or
  (finding instanceof NetworkWebSocket and
   capability = "NETWORK" and pattern = "WEBSOCKET" and
   description = "WebSocket connection")
  or
  (finding instanceof NetworkXHR and
   capability = "NETWORK" and pattern = "XHR" and
   description = "XMLHttpRequest")
  or
  (finding instanceof NetworkSendBeacon and
   capability = "NETWORK" and pattern = "SEND_BEACON" and
   description = "navigator.sendBeacon")
  or
  (finding instanceof NetworkImageBeacon and
   capability = "NETWORK" and pattern = "IMAGE_BEACON" and
   description = "Image beacon request")
  or
  (finding instanceof NetworkWebRequest and
   capability = "NETWORK" and pattern = "WEB_REQUEST" and
   description = "chrome.webRequest API")
  or
  (finding instanceof NetworkWebRequestBlocking and
   capability = "NETWORK" and pattern = "WEB_REQUEST_BLOCKING" and
   description = "chrome.webRequest.onBefore* blocking")
  or
  (finding instanceof NetworkPostMessage and
   capability = "NETWORK" and pattern = "POST_MESSAGE" and
   description = "postMessage cross-origin")
  or
  // DOM patterns
  (finding instanceof DOMInnerHTML and
   capability = "DOM" and pattern = "INNERHTML" and
   description = "innerHTML assignment")
  or
  (finding instanceof DOMMutationObserver and
   capability = "DOM" and pattern = "MUTATION_OBSERVER" and
   description = "MutationObserver")
  or
  (finding instanceof DOMDynamicScript and
   capability = "DOM" and pattern = "DYNAMIC_SCRIPT" and
   description = "Dynamic script creation")
  or
  (finding instanceof DOMScriptingExecute and
   capability = "DOM" and pattern = "SCRIPTING_EXECUTE" and
   description = "chrome.scripting.executeScript")
  or
  (finding instanceof DOMBlobURL and
   capability = "DOM" and pattern = "BLOB_URL" and
   description = "Blob URL creation")
  or
  // STORAGE patterns
  (finding instanceof StorageChromeStorage and
   capability = "STORAGE" and pattern = "CHROME_STORAGE" and
   description = "chrome.storage access")
  or
  (finding instanceof StorageRuntimeMessage and
   capability = "STORAGE" and pattern = "RUNTIME_MESSAGE" and
   description = "Extension messaging")
  or
  (finding instanceof StorageTabsAccess and
   capability = "STORAGE" and pattern = "TABS_ACCESS" and
   description = "chrome.tabs API")
  or
  (finding instanceof StorageInterval and
   capability = "STORAGE" and pattern = "SET_INTERVAL" and
   description = "setInterval polling")
  or
  (finding instanceof StorageTimerStringEval and
   capability = "STORAGE" and pattern = "TIMER_STRING_EVAL" and
   description = "setTimeout/setInterval with string")
  or
  (finding instanceof StorageCustomEvent and
   capability = "STORAGE" and pattern = "CUSTOM_EVENT" and
   description = "CustomEvent with data payload")
  or
  (finding instanceof StorageDispatchEvent and
   capability = "STORAGE" and pattern = "DISPATCH_EVENT" and
   description = "dispatchEvent with CustomEvent")

select finding,
  "[" + capability + "] " + pattern + ": " + description + " " +
  getFileContext(finding.getFile()) + " " +
  finding.getLocation().getFile().getBaseName() + ":" +
  finding.getLocation().getStartLine().toString()
