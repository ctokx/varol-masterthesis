/**
 * @name Find network endpoints
 * @description Finds all URLs used in network requests (fetch, XMLHttpRequest, WebSocket, etc.)
 * @kind problem
 * @problem.severity recommendation
 * @precision medium
 * @id js/network-endpoints
 * @tags security
 */

import javascript

/**
 * Finds fetch() call URLs
 */
class FetchCall extends CallExpr {
  FetchCall() {
    this.getCalleeName() = "fetch"
  }
  
  Expr getUrlArgument() {
    result = this.getArgument(0)
  }
}

/**
 * Finds XMLHttpRequest.open() method calls
 */
class XhrOpenCall extends MethodCallExpr {
  XhrOpenCall() {
    this.getMethodName() = "open"
  }
  
  Expr getUrlArgument() {
    result = this.getArgument(1)
  }
}

/**
 * Finds WebSocket constructor URLs
 */
class WebSocketNew extends NewExpr {
  WebSocketNew() {
    this.getCalleeName() = "WebSocket"
  }
  
  Expr getUrlArgument() {
    result = this.getArgument(0)
  }
}

from Expr urlExpr, string type
where
  (exists(FetchCall fc | urlExpr = fc.getUrlArgument()) and type = "fetch") or
  (exists(XhrOpenCall xhr | urlExpr = xhr.getUrlArgument()) and type = "XMLHttpRequest.open") or
  (exists(WebSocketNew ws | urlExpr = ws.getUrlArgument()) and type = "WebSocket")
select urlExpr, "Network endpoint (" + type + "): " + urlExpr.toString()
