/**
 * @name Find sensitive data flows to network
 * @description Detects when sensitive data (cookies, storage, form data, keystrokes) flows to network calls
 * @kind path-problem
 * @problem.severity error
 * @precision medium
 * @id js/sensitive-data-to-network
 * @tags security
 *        data-flow
 *        exfiltration
 */

import javascript
import DataFlow::PathGraph

/**
 * A source of sensitive data that could be exfiltrated
 */
class SensitiveDataSource extends DataFlow::Node {
  string sourceType;

  SensitiveDataSource() {
    // document.cookie
    (exists(PropAccess pa |
      pa.getPropertyName() = "cookie" and
      this.asExpr() = pa and
      sourceType = "COOKIE")) or

    // chrome.storage.get callback data
    (exists(MethodCallExpr m |
      m.getMethodName() = "get" and
      m.getReceiver().toString().matches("%storage%") and
      this.asExpr() = m and
      sourceType = "CHROME_STORAGE")) or

    // Form input values
    (exists(PropAccess pa |
      pa.getPropertyName() = "value" and
      this.asExpr() = pa and
      sourceType = "FORM_VALUE")) or

    // Keyboard event data
    (exists(PropAccess pa |
      (pa.getPropertyName() = "key" or
       pa.getPropertyName() = "keyCode" or
       pa.getPropertyName() = "which") and
      this.asExpr() = pa and
      sourceType = "KEYSTROKE")) or

    // Clipboard data
    (exists(MethodCallExpr m |
      m.getMethodName() = "readText" and
      this.asExpr() = m and
      sourceType = "CLIPBOARD")) or

    // Location/history data
    (exists(PropAccess pa |
      (pa.getPropertyName() = "href" or
       pa.getPropertyName() = "pathname" or
       pa.getPropertyName() = "search") and
      pa.getBase().toString().matches("%location%") and
      this.asExpr() = pa and
      sourceType = "LOCATION"))
  }

  string getSourceType() { result = sourceType }
}

/**
 * A sink where data is sent externally
 */
class NetworkSink extends DataFlow::Node {
  string sinkType;

  NetworkSink() {
    // fetch() body or URL
    (exists(CallExpr c |
      c.getCalleeName() = "fetch" and
      (this.asExpr() = c.getArgument(0) or
       this.asExpr() = c.getArgument(1)) and
      sinkType = "FETCH")) or

    // XMLHttpRequest.send()
    (exists(MethodCallExpr m |
      m.getMethodName() = "send" and
      this.asExpr() = m.getArgument(0) and
      sinkType = "XHR_SEND")) or

    // WebSocket.send()
    (exists(MethodCallExpr m |
      m.getMethodName() = "send" and
      m.getReceiver().toString().matches("%Socket%") and
      this.asExpr() = m.getArgument(0) and
      sinkType = "WEBSOCKET")) or

    // Image src (tracking pixel exfiltration)
    (exists(PropAccess pa |
      pa.getPropertyName() = "src" and
      this.asExpr() = pa and
      sinkType = "IMAGE_SRC"))
  }

  string getSinkType() { result = sinkType }
}

/**
 * Configuration for tracking sensitive data to network sinks
 */
class SensitiveDataFlowConfig extends DataFlow::Configuration {
  SensitiveDataFlowConfig() { this = "SensitiveDataFlowConfig" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof SensitiveDataSource
  }

  override predicate isSink(DataFlow::Node sink) {
    sink instanceof NetworkSink
  }
}

from SensitiveDataFlowConfig config, DataFlow::PathNode source, DataFlow::PathNode sink
where config.hasFlowPath(source, sink)
select sink.getNode(), source, sink,
  "EXFILTRATION: " + source.getNode().(SensitiveDataSource).getSourceType() +
  " data flows to " + sink.getNode().(NetworkSink).getSinkType()
