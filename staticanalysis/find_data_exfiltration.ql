/**
 * @name Smart Data Exfiltration Detection
 * @description Detects REAL data exfiltration by looking for sensitive data
 *              collection (storage, DOM, page content) combined with external
 *              network transmission. Filters out legitimate analytics and storage sync.
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/data-exfiltration-smart
 * @tags security
 *        malware
 *        exfiltration
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
 * Check if URL matches known safe domains
 */
bindingset[urlStr]
predicate isSafeDomain(string urlStr) {
  urlStr.regexpMatch("(?i).*(google\\.com|googleapis\\.com|gstatic\\.com|microsoft\\.com|github\\.com|cloudflare\\.com|firebase\\.com|firebaseio\\.com|sentry\\.io|amplitude\\.com|segment\\.com|mixpanel\\.com|chrome\\.google\\.com).*")
}

/**
 * Page content scraping - innerHTML, textContent, outerHTML access on body/document
 */
class PageContentScraping extends PropAccess {
  PageContentScraping() {
    this.getPropertyName().regexpMatch("innerHTML|textContent|outerHTML|innerText") and
    (
      this.getBase().toString().regexpMatch("(?i).*(document\\.body|document\\.documentElement).*")
      or
      // Getting large sections of the page
      exists(MethodCallExpr selector |
        selector.getMethodName().regexpMatch("querySelector(All)?|getElementById|getElementsByTagName") and
        this.getBase() = selector
      )
    )
  }
}

/**
 * External network call to suspicious endpoint
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
 * Image beacon exfiltration - setting img.src with data in URL
 */
class ImageBeaconExfil extends AssignExpr {
  ImageBeaconExfil() {
    exists(PropAccess pa |
      pa.getPropertyName() = "src" and
      this.getLhs() = pa
    ) and
    // URL contains data encoding (query params with sensitive names)
    this.getRhs().toString().regexpMatch(".*https?://.*[?&](data|payload|d|p|cookie|token|key)=.*")
  }
}

/**
 * WebSocket data exfiltration
 */
class WebSocketExfil extends MethodCallExpr {
  WebSocketExfil() {
    this.getMethodName() = "send" and
    this.getReceiver().toString().regexpMatch(".*socket.*|.*ws.*") and
    // Check if same file collects sensitive data
    (
      exists(PageContentScraping pcs | pcs.getFile() = this.getFile())
      or
      exists(PropAccess cookie |
        cookie.getFile() = this.getFile() and
        cookie.getPropertyName() = "cookie"
      )
      or
      exists(MethodCallExpr storage |
        storage.getFile() = this.getFile() and
        storage.getMethodName() = "getItem"
      )
    )
  }
}

/**
 * Combined pattern: Page scraping + external send in same file
 */
class PageScrapingExfil extends Expr {
  PageScrapingExfil() {
    this instanceof PageContentScraping and
    exists(ExternalNetworkCall net |
      net.getFile() = this.getFile()
    )
  }
}

/**
 * Storage access + external send - leaking extension data
 */
class StorageExfil extends MethodCallExpr {
  StorageExfil() {
    this.getMethodName() = "get" and
    this.getReceiver().toString().regexpMatch(".*storage\\.(local|sync).*") and
    // Same file sends externally
    exists(ExternalNetworkCall net |
      net.getFile() = this.getFile()
    )
  }
}

/**
 * Clipboard monitoring + exfil - stealing copy/paste data
 */
class ClipboardExfil extends MethodCallExpr {
  ClipboardExfil() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"](copy|paste|cut)['\"].*") and
    // Callback has network call or stores data
    exists(Function callback |
      callback = this.getArgument(1).(Function) and
      (
        exists(CallExpr net |
          net.getEnclosingFunction() = callback and
          net.getCalleeName() = "fetch"
        )
        or
        exists(MethodCallExpr push |
          push.getEnclosingFunction() = callback and
          push.getMethodName() = "push"
        )
      )
    )
  }
}

/**
 * Selection monitoring - capturing selected text
 */
class SelectionExfil extends MethodCallExpr {
  SelectionExfil() {
    this.getMethodName() = "addEventListener" and
    this.getArgument(0).toString().regexpMatch(".*['\"]selectionchange['\"].*") and
    // Same file has external network call
    exists(ExternalNetworkCall net |
      net.getFile() = this.getFile()
    )
  }
}

// ============================================
// MAIN QUERY: Find data exfiltration patterns
// ============================================
from Expr exfil, string exfilType
where
  not isLibraryFile(exfil.getFile())
  and
  (
    (exfil instanceof PageScrapingExfil and exfilType = "PAGE_SCRAPING_EXFIL")
    or
    (exfil instanceof StorageExfil and exfilType = "STORAGE_EXFIL")
    or
    (exfil instanceof ImageBeaconExfil and exfilType = "IMAGE_BEACON_EXFIL")
    or
    (exfil instanceof WebSocketExfil and exfilType = "WEBSOCKET_EXFIL")
    or
    (exfil instanceof ClipboardExfil and exfilType = "CLIPBOARD_EXFIL")
    or
    (exfil instanceof SelectionExfil and exfilType = "SELECTION_EXFIL")
  )
select exfil,
  "HIGH_RISK_EXFIL: " + exfilType + " at " +
  exfil.getLocation().getFile().getBaseName() + ":" +
  exfil.getLocation().getStartLine().toString()
