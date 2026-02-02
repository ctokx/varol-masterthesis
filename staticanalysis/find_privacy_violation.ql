/**
 * @name Smart Privacy Violation Detection
 * @description Detects REAL privacy violations by looking for sensitive data
 *              collection that is EXFILTRATED to external servers. Filters out
 *              legitimate patterns like extension state management and analytics.
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/privacy-violation-smart
 * @tags security
 *        privacy
 *        malware
 */

import javascript

/**
 * Check if file is a known library (should be excluded)
 */
predicate isLibraryFile(File f) {
  f.getBaseName().regexpMatch("(?i).*(\\.min\\.js|vendor|node_modules|firebase|react|angular|vue|jquery|axios|lodash|semantic|tabulator|bootstrap|analytics|amplitude|segment|sentry).*")
  or
  f.getNumberOfLines() > 3000
  or
  exists(Comment c |
    c.getFile() = f and
    c.getText().regexpMatch("(?i).*(MIT License|Apache License|BSD License|Google LLC|Facebook|Microsoft|Firebase).*")
  )
}

/**
 * Known safe domains (analytics, CDN, known services)
 */
bindingset[urlStr]
predicate isSafeDomain(string urlStr) {
  urlStr.regexpMatch("(?i).*(google\\.com|googleapis\\.com|gstatic\\.com|microsoft\\.com|github\\.com|cloudflare\\.com|firebase\\.com|firebaseio\\.com|sentry\\.io|amplitude\\.com|segment\\.com|mixpanel\\.com|hotjar\\.com|chrome\\.google\\.com|mozilla\\.org|edge\\.microsoft\\.com).*")
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
 * Browsing history exfiltration - chrome.history API + network call
 */
class HistoryExfiltration extends MethodCallExpr {
  HistoryExfiltration() {
    this.toString().regexpMatch(".*chrome\\.history\\.(search|getVisits).*") and
    exists(ExternalNetworkCall net | net.getFile() = this.getFile())
  }
}

/**
 * Bookmark exfiltration - chrome.bookmarks API + network call
 */
class BookmarkExfiltration extends MethodCallExpr {
  BookmarkExfiltration() {
    this.toString().regexpMatch(".*chrome\\.bookmarks\\.(getTree|getRecent|search).*") and
    exists(ExternalNetworkCall net | net.getFile() = this.getFile())
  }
}

/**
 * Tab surveillance - monitoring all tabs + exfil
 */
class TabSurveillance extends MethodCallExpr {
  TabSurveillance() {
    // chrome.tabs.onUpdated listener collecting URLs
    this.getMethodName() = "addListener" and
    this.getReceiver().toString().regexpMatch(".*chrome\\.tabs\\.onUpdated.*") and
    exists(Function callback |
      callback = this.getArgument(0).(Function) and
      // Callback sends data externally
      exists(CallExpr net |
        net.getEnclosingFunction() = callback and
        net.getCalleeName() = "fetch"
      )
    )
  }
}

/**
 * Cookie stealing - document.cookie + external send
 */
class CookieExfiltration extends PropAccess {
  CookieExfiltration() {
    this.getPropertyName() = "cookie" and
    this.getBase().toString().regexpMatch("(?i)document") and
    // Not assignment (we're reading)
    not exists(AssignExpr ae | ae.getLhs() = this) and
    // Same file has external network call
    exists(ExternalNetworkCall net | net.getFile() = this.getFile())
  }
}

/**
 * Geolocation tracking + exfiltration
 */
class GeolocationExfiltration extends MethodCallExpr {
  GeolocationExfiltration() {
    this.getMethodName().regexpMatch("getCurrentPosition|watchPosition") and
    exists(ExternalNetworkCall net | net.getFile() = this.getFile())
  }
}

/**
 * Camera/microphone access + recording
 */
class MediaCapture extends MethodCallExpr {
  MediaCapture() {
    this.getMethodName().regexpMatch("getUserMedia|getDisplayMedia") and
    // Check for MediaRecorder in same file
    exists(NewExpr recorder |
      recorder.getFile() = this.getFile() and
      recorder.getCalleeName() = "MediaRecorder"
    )
  }
}

// ============================================
// MAIN QUERY: Find privacy violations with exfiltration
// ============================================
from Expr privacyViolation, string violationType
where
  not isLibraryFile(privacyViolation.getFile())
  and
  (
    (privacyViolation instanceof HistoryExfiltration and violationType = "HISTORY_EXFIL")
    or
    (privacyViolation instanceof BookmarkExfiltration and violationType = "BOOKMARK_EXFIL")
    or
    (privacyViolation instanceof TabSurveillance and violationType = "TAB_SURVEILLANCE")
    or
    (privacyViolation instanceof CookieExfiltration and violationType = "COOKIE_EXFIL")
    or
    (privacyViolation instanceof GeolocationExfiltration and violationType = "GEOLOCATION_EXFIL")
    or
    (privacyViolation instanceof MediaCapture and violationType = "MEDIA_CAPTURE")
  )
select privacyViolation,
  "HIGH_RISK_PRIVACY: " + violationType + " at " +
  privacyViolation.getLocation().getFile().getBaseName() + ":" +
  privacyViolation.getLocation().getStartLine().toString()
