/**
 * @name Smart Keylogger Detection
 * @description Detects REAL keyloggers by looking for keyboard listeners that
 *              collect keystroke data and exfiltrate it, while filtering out
 *              legitimate UI patterns (accessibility, shortcuts, form validation)
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/keylogger-smart
 * @tags security
 *        privacy
 *        malware
 */

import javascript

/**
 * Keyboard event listener that captures key data
 */
class KeyboardCapture extends MethodCallExpr {
  KeyboardCapture() {
    this.getMethodName() = "addEventListener" and
    exists(Expr arg0 |
      arg0 = this.getArgument(0) and
      arg0.toString().regexpMatch(".*['\"]key(down|up|press)['\"].*")
    )
  }

  /** Get the callback function */
  Function getCallback() {
    result = this.getArgument(1).(Function)
    or
    exists(VarAccess va |
      va = this.getArgument(1) and
      result = va.getVariable().getAnAssignedExpr().(Function)
    )
  }
}

/**
 * LEGITIMATE patterns - filter these OUT
 * 1. Single key checks (Enter, Escape, Tab, Arrow keys) - UI navigation
 * 2. Keyboard shortcuts (Ctrl+, Alt+, Cmd+)
 * 3. Input field event handlers (attached to input/textarea elements)
 */
predicate isLegitimateKeyHandler(KeyboardCapture kc) {
  exists(Function callback | callback = kc.getCallback() |
    // Check for single-key navigation patterns
    exists(EqualityTest eq |
      eq.getEnclosingFunction() = callback and
      eq.getAnOperand().toString().regexpMatch(".*['\"]((Enter|Escape|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Backspace)|(13|27|9|38|40|37|39|32|8))['\"].*")
    )
    or
    // Check for keyboard shortcut patterns (ctrlKey, altKey, metaKey checks)
    exists(PropAccess pa |
      pa.getEnclosingFunction() = callback and
      pa.getPropertyName().regexpMatch("ctrlKey|altKey|metaKey|shiftKey")
    )
  )
  or
  // Attached to specific element (not document/window) - likely form input
  exists(PropAccess receiver |
    receiver = kc.getReceiver() and
    not receiver.toString().regexpMatch(".*document.*") and
    not receiver.toString().regexpMatch(".*window.*")
  )
}

/**
 * SUSPICIOUS patterns - keystroke data collection
 */
predicate collectsKeyData(KeyboardCapture kc) {
  exists(Function callback | callback = kc.getCallback() |
    // Accesses e.key, e.keyCode, e.which, e.code - the actual keystroke
    exists(PropAccess pa |
      pa.getEnclosingFunction() = callback and
      pa.getPropertyName().regexpMatch("key|keyCode|which|code|charCode")
    )
  )
}

/**
 * Data exfiltration patterns - sending collected data out
 */
predicate hasExfiltrationInSameFile(File f) {
  exists(CallExpr fetch |
    fetch.getFile() = f and
    fetch.getCalleeName() = "fetch"
  )
  or
  exists(MethodCallExpr xhr |
    xhr.getFile() = f and
    xhr.getMethodName().regexpMatch("send|open")
  )
  or
  exists(NewExpr ws |
    ws.getFile() = f and
    ws.getCalleeName() = "WebSocket"
  )
  or
  exists(PropAccess img |
    img.getFile() = f and
    img.getPropertyName() = "src" and
    exists(AssignExpr ae | ae.getLhs() = img)
  )
}

/**
 * String concatenation or array push (building up keystroke buffer)
 */
predicate buildsKeystrokeBuffer(KeyboardCapture kc) {
  exists(Function callback | callback = kc.getCallback() |
    // += operator (string concatenation)
    exists(AssignExpr ae |
      ae.getEnclosingFunction() = callback and
      ae.toString().regexpMatch(".*\\+=.*")
    )
    or
    // Array.push
    exists(MethodCallExpr push |
      push.getEnclosingFunction() = callback and
      push.getMethodName() = "push"
    )
    or
    // .join() nearby (converting collected keys to string)
    exists(MethodCallExpr join |
      join.getEnclosingFunction() = callback and
      join.getMethodName() = "join"
    )
  )
}

/**
 * Document or window level keyboard listener - captures ALL keystrokes
 */
predicate isDocumentLevelListener(KeyboardCapture kc) {
  exists(PropAccess receiver |
    receiver = kc.getReceiver() and
    (
      receiver.toString().regexpMatch(".*document.*") or
      receiver.toString().regexpMatch(".*window.*")
    )
  )
  or
  kc.getReceiver().toString() = "document"
  or
  kc.getReceiver().toString() = "window"
}

/**
 * Check if file is a known library (minified third-party code)
 */
predicate isLibraryFile(File f) {
  f.getBaseName().regexpMatch(".*(\\.min\\.js|vendor|node_modules|lib/|libs/|jquery|react|angular|vue|bootstrap|semantic|tabulator|axios|lodash|moment|firebase).*")
  or
  // Very large minified files are likely libraries
  f.getNumberOfLines() > 5000
  or
  // Files with license headers from known libraries
  exists(Comment c |
    c.getFile() = f and
    c.getText().regexpMatch("(?i).*(MIT License|Apache License|BSD License|Copyright.*Google|Copyright.*Facebook|Copyright.*Microsoft|jQuery|React|Angular|Vue).*")
  )
}

// ============================================
// MAIN QUERY: Find suspicious keyloggers
// ============================================
from KeyboardCapture kc
where
  // Must be document/window level (captures everything)
  isDocumentLevelListener(kc) and
  // Must access actual key data (not just checking specific keys)
  collectsKeyData(kc) and
  // Must NOT be legitimate navigation/shortcut pattern
  not isLegitimateKeyHandler(kc) and
  // Must NOT be in a library file
  not isLibraryFile(kc.getFile()) and
  // Extra suspicion: builds buffer OR same file has network calls
  (
    buildsKeystrokeBuffer(kc) or
    hasExfiltrationInSameFile(kc.getFile())
  )
select kc,
  "HIGH_RISK_KEYLOGGER: Document-level keyboard capture with data collection at " +
  kc.getLocation().getFile().getBaseName() + ":" +
  kc.getLocation().getStartLine().toString()
