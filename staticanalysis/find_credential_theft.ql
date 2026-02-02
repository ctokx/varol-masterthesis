/**
 * @name Smart Credential Theft Detection
 * @description Detects REAL credential theft by looking for password/sensitive
 *              data access that is then sent to external servers. Filters out
 *              legitimate patterns like Firebase SDK, form validation, error messages.
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/credential-theft-smart
 * @tags security
 *        malware
 *        credential-theft
 */

import javascript

/**
 * Check if file is a known library (should be excluded)
 */
predicate isLibraryFile(File f) {
  f.getBaseName().regexpMatch("(?i).*(\\.min\\.js|vendor|node_modules|firebase|react|angular|vue|jquery|axios|lodash|semantic|tabulator|bootstrap).*")
  or
  f.getNumberOfLines() > 3000
  or
  exists(Comment c |
    c.getFile() = f and
    c.getText().regexpMatch("(?i).*(MIT License|Apache License|BSD License|Google LLC|Facebook|Microsoft|Firebase).*")
  )
}

/**
 * Password/credential FORM FIELD access (user entering credentials)
 * This finds actual input fields that might contain passwords
 */
class PasswordInputAccess extends Expr {
  string accessType;

  PasswordInputAccess() {
    // querySelector for password inputs
    exists(MethodCallExpr m |
      m.getMethodName().regexpMatch("querySelector(All)?") and
      m.getArgument(0).toString().regexpMatch("(?i).*((type=.?password)|(input.*password)|(#password)|(\\.password)).*") and
      this = m and
      accessType = "PASSWORD_SELECTOR"
    )
    or
    // getElementById for password field
    exists(MethodCallExpr m |
      m.getMethodName() = "getElementById" and
      m.getArgument(0).toString().regexpMatch("(?i).*(password|passwd|pwd|pin|secret).*") and
      this = m and
      accessType = "PASSWORD_ELEMENT"
    )
  }

  string getAccessType() { result = accessType }
}

/**
 * Cookie stealing - accessing document.cookie for reading
 */
class DocumentCookieRead extends PropAccess {
  DocumentCookieRead() {
    this.getPropertyName() = "cookie" and
    this.getBase().toString().regexpMatch("(?i)document") and
    // Make sure it's a read (not assignment target)
    not exists(AssignExpr ae | ae.getLhs() = this)
  }
}

/**
 * Chrome cookies API access - get or getAll
 */
class ChromeCookiesAccess extends MethodCallExpr {
  ChromeCookiesAccess() {
    this.toString().regexpMatch(".*chrome\\.cookies\\.(get|getAll).*")
  }
}

/**
 * Token/API key from localStorage with suspicious key names
 */
class StoredCredentialAccess extends MethodCallExpr {
  StoredCredentialAccess() {
    this.getMethodName() = "getItem" and
    this.getArgument(0).toString().regexpMatch("(?i).*(token|api.?key|auth|session|jwt|bearer|credential|password|secret|access_token|refresh_token).*")
  }
}

/**
 * Network exfiltration to EXTERNAL servers (not same origin)
 */
class ExternalNetworkCall extends CallExpr {
  ExternalNetworkCall() {
    // fetch() to external URL
    this.getCalleeName() = "fetch" and
    exists(Expr arg |
      arg = this.getArgument(0) and
      arg.toString().regexpMatch(".*https?://.*") and
      // Not to google/microsoft/known safe domains
      not arg.toString().regexpMatch("(?i).*(google\\.com|googleapis\\.com|microsoft\\.com|github\\.com|cloudflare\\.com|firebase\\.com|firebaseio\\.com|gstatic\\.com|sentry\\.io|amplitude\\.com|segment\\.com).*")
    )
  }
}

/**
 * Combined: credential access + network call in same file
 */
predicate hasSuspiciousCredentialFlow(File f) {
  (
    exists(PasswordInputAccess pia | pia.getFile() = f) or
    exists(DocumentCookieRead dcr | dcr.getFile() = f) or
    exists(StoredCredentialAccess sca | sca.getFile() = f) or
    exists(ChromeCookiesAccess cca | cca.getFile() = f)
  )
  and
  exists(ExternalNetworkCall enc | enc.getFile() = f)
}

// ============================================
// MAIN QUERY: Find credential access with exfiltration potential
// ============================================
from DocumentCookieRead dcr
where
  not isLibraryFile(dcr.getFile()) and
  hasSuspiciousCredentialFlow(dcr.getFile())
select dcr,
  "HIGH_RISK_CREDENTIAL_THEFT: document.cookie read with external network call at " +
  dcr.getLocation().getFile().getBaseName() + ":" +
  dcr.getLocation().getStartLine().toString()
