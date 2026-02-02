/**
 * @name Smart Form Hijacking Detection
 * @description Detects REAL form hijacking by looking for form interception
 *              with data exfiltration to EXTERNAL servers. Filters out legitimate
 *              patterns like form validation, analytics, and same-origin submission.
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/form-hijacking-smart
 * @tags security
 *        malware
 *        phishing
 */

import javascript

/**
 * Check if file is a known library (should be excluded)
 */
predicate isLibraryFile(File f) {
  f.getBaseName().regexpMatch("(?i).*(\\.min\\.js|vendor|node_modules|firebase|react|angular|vue|jquery|axios|lodash|semantic|tabulator|bootstrap|formik|yup|validator).*")
  or
  f.getNumberOfLines() > 3000
  or
  exists(Comment c |
    c.getFile() = f and
    c.getText().regexpMatch("(?i).*(MIT License|Apache License|BSD License|Google LLC|Facebook|Microsoft|Firebase).*")
  )
}

/**
 * Known safe domains
 */
bindingset[urlStr]
predicate isSafeDomain(string urlStr) {
  urlStr.regexpMatch("(?i).*(google\\.com|googleapis\\.com|microsoft\\.com|github\\.com|cloudflare\\.com|firebase\\.com|firebaseio\\.com|stripe\\.com|paypal\\.com|braintree\\.com|square\\.com|auth0\\.com|okta\\.com).*")
}

/**
 * External network call
 */
class ExternalNetworkCall extends CallExpr {
  ExternalNetworkCall() {
    this.getCalleeName() = "fetch" and
    exists(Expr urlArg |
      urlArg = this.getArgument(0) and
      urlArg.toString().regexpMatch(".*https?://.*") and
      not isSafeDomain(urlArg.toString())
    )
  }
}

/**
 * Form submit listener that intercepts and sends externally
 */
class FormInterception extends MethodCallExpr {
  FormInterception() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]submit['\"].*") and
    exists(Function callback |
      callback = this.getArgument(0).(Function) and
      // Must call preventDefault (intercepting the form)
      exists(MethodCallExpr prevent |
        prevent.getEnclosingFunction() = callback and
        prevent.getMethodName() = "preventDefault"
      ) and
      // Must have external network call
      exists(CallExpr net |
        net.getEnclosingFunction() = callback and
        net.getCalleeName() = "fetch"
      )
    )
  }
}

/**
 * Direct onsubmit hijacking with external exfiltration
 */
class OnSubmitHijacking extends AssignExpr {
  OnSubmitHijacking() {
    exists(PropAccess pa |
      pa.getPropertyName() = "onsubmit" and
      this.getLhs() = pa
    ) and
    exists(Function callback |
      callback = this.getRhs().(Function) and
      // Callback has fetch
      exists(CallExpr net |
        net.getEnclosingFunction() = callback and
        net.getCalleeName() = "fetch"
      )
    )
  }
}

/**
 * Password field monitoring - input event on password fields + exfil
 */
class PasswordFieldMonitor extends MethodCallExpr {
  PasswordFieldMonitor() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"](input|change|keyup)['\"].*") and
    // Receiver is password-related element
    this.getReceiver().toString().regexpMatch(".*password.*") and
    // Has network call in callback
    exists(Function callback, CallExpr net |
      callback = this.getArgument(1).(Function) and
      net.getEnclosingFunction() = callback and
      net.getCalleeName() = "fetch"
    )
  }
}

/**
 * Cloning/modifying form action to external server
 */
class FormActionHijack extends AssignExpr {
  FormActionHijack() {
    exists(PropAccess pa |
      pa.getPropertyName() = "action" and
      this.getLhs() = pa and
      this.getRhs().toString().regexpMatch(".*https?://.*") and
      not isSafeDomain(this.getRhs().toString())
    )
  }
}

/**
 * MutationObserver watching for forms
 */
class FormMutationWatcher extends NewExpr {
  FormMutationWatcher() {
    this.getCalleeName() = "MutationObserver" and
    exists(Function callback |
      callback = this.getArgument(0).(Function) and
      // Callback looks for forms/inputs
      exists(PropAccess formCheck |
        formCheck.getEnclosingFunction() = callback and
        formCheck.toString().regexpMatch(".*form.*|.*password.*")
      ) and
      // And has network call
      exists(CallExpr net |
        net.getEnclosingFunction() = callback and
        net.getCalleeName() = "fetch"
      )
    )
  }
}

// ============================================
// MAIN QUERY: Find form hijacking patterns
// ============================================
from Expr formHijack, string hijackType
where
  not isLibraryFile(formHijack.getFile())
  and
  (
    (formHijack instanceof FormInterception and hijackType = "FORM_INTERCEPTION")
    or
    (formHijack instanceof OnSubmitHijacking and hijackType = "ONSUBMIT_HIJACK")
    or
    (formHijack instanceof PasswordFieldMonitor and hijackType = "PASSWORD_MONITOR")
    or
    (formHijack instanceof FormActionHijack and hijackType = "FORM_ACTION_HIJACK")
    or
    (formHijack instanceof FormMutationWatcher and hijackType = "FORM_MUTATION_WATCHER")
  )
select formHijack,
  "HIGH_RISK_FORM_HIJACK: " + hijackType + " at " +
  formHijack.getLocation().getFile().getBaseName() + ":" +
  formHijack.getLocation().getStartLine().toString()
