/**
 * @name Smart C2 Communication Detection
 * @description Detects REAL C2 patterns by looking for remote code execution
 *              combined with command polling. Filters out legitimate patterns
 *              like analytics, Firebase sync, and normal extension messaging.
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/c2-communication-smart
 * @tags security
 *        malware
 *        c2
 */

import javascript

/**
 * Check if file is a known library (should be excluded)
 */
predicate isLibraryFile(File f) {
  f.getBaseName().regexpMatch("(?i).*(\\.min\\.js|vendor|node_modules|firebase|react|angular|vue|jquery|axios|lodash|semantic|tabulator|bootstrap|amplitude|segment|sentry|analytics).*")
  or
  f.getNumberOfLines() > 3000
  or
  exists(Comment c |
    c.getFile() = f and
    c.getText().regexpMatch("(?i).*(MIT License|Apache License|BSD License|Google LLC|Facebook|Microsoft|Firebase).*")
  )
}

/**
 * Known safe domains for analytics, CDN, APIs
 */
bindingset[urlStr]
predicate isSafeDomain(string urlStr) {
  urlStr.regexpMatch("(?i).*(google\\.com|googleapis\\.com|gstatic\\.com|microsoft\\.com|github\\.com|cloudflare\\.com|firebase\\.com|firebaseio\\.com|sentry\\.io|amplitude\\.com|segment\\.com|mixpanel\\.com|hotjar\\.com|intercom\\.io|zendesk\\.com|crisp\\.chat|freshdesk\\.com|stripe\\.com|paypal\\.com|cdn\\.jsdelivr\\.net|unpkg\\.com|cdnjs\\.cloudflare\\.com).*")
}

/**
 * CRITICAL: eval() with fetched/received data - clear C2 indicator
 * Look for: fetch -> response.text() or response.json() -> eval/Function
 */
class EvalWithRemoteData extends CallExpr {
  EvalWithRemoteData() {
    (this.getCalleeName() = "eval" or this.getCalleeName() = "Function")
    and
    // Same file must have fetch/network call
    exists(CallExpr fetch |
      fetch.getFile() = this.getFile() and
      fetch.getCalleeName() = "fetch"
    )
  }
}

/**
 * Periodic command polling - setInterval with network + command handling
 */
class PeriodicCommandPoll extends CallExpr {
  PeriodicCommandPoll() {
    this.getCalleeName() = "setInterval" and
    exists(Function callback |
      callback = this.getArgument(0).(Function) and
      // Must have network call inside
      exists(CallExpr net |
        net.getEnclosingFunction() = callback and
        net.getCalleeName() = "fetch"
      )
    )
  }
}

/**
 * WebSocket with message handling - potential real-time C2
 */
class WebSocketWithHandler extends NewExpr {
  WebSocketWithHandler() {
    this.getCalleeName() = "WebSocket" and
    // URL should not be a known safe domain
    exists(Expr urlArg |
      urlArg = this.getArgument(0) and
      urlArg.toString().regexpMatch(".*wss?://.*") and
      not isSafeDomain(urlArg.toString())
    ) and
    // Same file has eval or Function constructor
    exists(CallExpr eval |
      eval.getFile() = this.getFile() and
      (eval.getCalleeName() = "eval" or eval.getCalleeName() = "Function")
    )
  }
}

/**
 * Dynamic script injection from REMOTE source (not extension resources)
 * Creating script element + setting src to external URL
 */
class RemoteScriptInjection extends MethodCallExpr {
  RemoteScriptInjection() {
    this.getMethodName() = "createElement" and
    this.getArgument(0).toString().regexpMatch(".*['\"]script['\"].*") and
    // Look for src assignment to external URL in same file
    exists(AssignExpr srcAssign, PropAccess srcProp |
      srcAssign.getFile() = this.getFile() and
      srcProp = srcAssign.getLhs() and
      srcProp.getPropertyName() = "src" and
      srcAssign.getRhs().toString().regexpMatch(".*https?://.*") and
      not isSafeDomain(srcAssign.getRhs().toString())
    )
  }
}

/**
 * chrome.runtime.onMessage with dynamic code execution
 * This is a common C2 pattern - receive commands via extension messaging
 */
class MessageBasedCodeExecution extends MethodCallExpr {
  MessageBasedCodeExecution() {
    this.getMethodName() = "addListener" and
    this.getReceiver().toString().regexpMatch(".*chrome.*runtime.*onMessage.*") and
    exists(Function callback |
      callback = this.getArgument(0).(Function) and
      // Callback contains eval or new Function
      exists(CallExpr dynamic |
        dynamic.getEnclosingFunction() = callback and
        (dynamic.getCalleeName() = "eval" or dynamic.getCalleeName() = "Function")
      )
    )
  }
}

/**
 * Base64 decode + eval chain - hidden payload execution
 */
class ObfuscatedPayloadExecution extends CallExpr {
  ObfuscatedPayloadExecution() {
    this.getCalleeName() = "eval" and
    exists(CallExpr atob |
      atob.getCalleeName() = "atob" and
      atob.getFile() = this.getFile()
    )
  }
}

// ============================================
// MAIN QUERY: Find C2 communication patterns
// ============================================
from Expr c2Pattern, string patternType
where
  not isLibraryFile(c2Pattern.getFile())
  and
  (
    (c2Pattern instanceof EvalWithRemoteData and patternType = "EVAL_WITH_REMOTE_DATA")
    or
    (c2Pattern instanceof PeriodicCommandPoll and patternType = "PERIODIC_COMMAND_POLL")
    or
    (c2Pattern instanceof WebSocketWithHandler and patternType = "WEBSOCKET_C2")
    or
    (c2Pattern instanceof RemoteScriptInjection and patternType = "REMOTE_SCRIPT_INJECTION")
    or
    (c2Pattern instanceof MessageBasedCodeExecution and patternType = "MESSAGE_BASED_CODE_EXEC")
    or
    (c2Pattern instanceof ObfuscatedPayloadExecution and patternType = "OBFUSCATED_PAYLOAD")
  )
select c2Pattern,
  "HIGH_RISK_C2: " + patternType + " at " +
  c2Pattern.getLocation().getFile().getBaseName() + ":" +
  c2Pattern.getLocation().getStartLine().toString()
