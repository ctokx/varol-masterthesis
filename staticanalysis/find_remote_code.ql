/**
 * @name Smart Remote Code Execution Detection
 * @description Detects REAL remote code execution by looking for dynamic code
 *              loading from EXTERNAL sources. Filters out legitimate patterns
 *              like module bundlers, CDN loading, and extension resource loading.
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/remote-code-execution-smart
 * @tags security
 *        malware
 *        remote-code
 */

import javascript

/**
 * Check if file is a known library (should be excluded)
 */
predicate isLibraryFile(File f) {
  f.getBaseName().regexpMatch("(?i).*(\\.min\\.js|vendor|node_modules|webpack|rollup|parcel|bundle|firebase|react|angular|vue|jquery).*")
  or
  f.getNumberOfLines() > 3000
  or
  exists(Comment c |
    c.getFile() = f and
    c.getText().regexpMatch("(?i).*(MIT License|Apache License|BSD License|Google LLC|Facebook|Microsoft|webpack|rollup|parcel).*")
  )
}

/**
 * Known safe CDN/script sources
 */
bindingset[urlStr]
predicate isSafeCDN(string urlStr) {
  urlStr.regexpMatch("(?i).*(cdn\\.jsdelivr\\.net|unpkg\\.com|cdnjs\\.cloudflare\\.com|ajax\\.googleapis\\.com|code\\.jquery\\.com|stackpath\\.bootstrapcdn\\.com|maxcdn\\.bootstrapcdn\\.com|fonts\\.googleapis\\.com|use\\.fontawesome\\.com|kit\\.fontawesome\\.com|polyfill\\.io|chrome-extension://|moz-extension://|extension://).*")
}

/**
 * CRITICAL: eval() with network-fetched data
 */
class EvalWithFetchedData extends CallExpr {
  EvalWithFetchedData() {
    this.getCalleeName() = "eval" and
    // Check for fetch in same file that might feed into eval
    exists(CallExpr fetch |
      fetch.getFile() = this.getFile() and
      fetch.getCalleeName() = "fetch" and
      exists(Expr urlArg |
        urlArg = fetch.getArgument(0) and
        urlArg.toString().regexpMatch(".*https?://.*") and
        not isSafeCDN(urlArg.toString())
      )
    )
  }
}

/**
 * new Function() with external data - code generation from remote
 */
class FunctionConstructorRemote extends NewExpr {
  FunctionConstructorRemote() {
    this.getCalleeName() = "Function" and
    // Same file has fetch call
    exists(CallExpr fetch |
      fetch.getFile() = this.getFile() and
      fetch.getCalleeName() = "fetch" and
      exists(Expr urlArg |
        urlArg = fetch.getArgument(0) and
        urlArg.toString().regexpMatch(".*https?://.*") and
        not isSafeCDN(urlArg.toString())
      )
    )
  }
}

/**
 * Dynamic script injection from external URL (not CDN)
 */
class ExternalScriptInjection extends AssignExpr {
  ExternalScriptInjection() {
    exists(PropAccess srcProp |
      srcProp.getPropertyName() = "src" and
      this.getLhs() = srcProp and
      this.getRhs().toString().regexpMatch(".*https?://.*") and
      not isSafeCDN(this.getRhs().toString())
    ) and
    // Same file creates script element
    exists(MethodCallExpr create |
      create.getFile() = this.getFile() and
      create.getMethodName() = "createElement" and
      create.getArgument(0).toString().regexpMatch(".*['\"]script['\"].*")
    )
  }
}

/**
 * importScripts with external URL in workers
 */
class ExternalWorkerImport extends CallExpr {
  ExternalWorkerImport() {
    this.getCalleeName() = "importScripts" and
    exists(Expr urlArg |
      urlArg = this.getAnArgument() and
      urlArg.toString().regexpMatch(".*https?://.*") and
      not isSafeCDN(urlArg.toString())
    )
  }
}

/**
 * Blob URL execution - can hide malicious code
 */
class BlobCodeExecution extends MethodCallExpr {
  BlobCodeExecution() {
    this.getMethodName() = "createObjectURL" and
    // Same file has Blob creation
    exists(NewExpr blob |
      blob.getFile() = this.getFile() and
      blob.getCalleeName() = "Blob"
    ) and
    // Combined with Worker or script src assignment
    (
      exists(NewExpr worker |
        worker.getFile() = this.getFile() and
        worker.getCalleeName() = "Worker"
      )
      or
      exists(AssignExpr ae, PropAccess pa |
        ae.getFile() = this.getFile() and
        pa.getPropertyName() = "src" and
        ae.getLhs() = pa
      )
    )
  }
}

/**
 * Base64 decode + eval - hidden payload
 */
class Base64EvalChain extends CallExpr {
  Base64EvalChain() {
    this.getCalleeName() = "eval" and
    exists(CallExpr atob |
      atob.getCalleeName() = "atob" and
      atob.getFile() = this.getFile()
    )
  }
}

/**
 * document.write with script - legacy injection technique
 */
class DocumentWriteScript extends MethodCallExpr {
  DocumentWriteScript() {
    this.getMethodName() = "write" and
    this.getReceiver().toString() = "document" and
    this.getArgument(0).toString().regexpMatch("(?i).*<script.*src.*https?://.*")
  }
}

// ============================================
// MAIN QUERY: Find remote code execution
// ============================================
from Expr rce, string rceType
where
  not isLibraryFile(rce.getFile())
  and
  (
    (rce instanceof EvalWithFetchedData and rceType = "EVAL_WITH_FETCHED_DATA")
    or
    (rce instanceof FunctionConstructorRemote and rceType = "FUNCTION_CONSTRUCTOR_REMOTE")
    or
    (rce instanceof ExternalScriptInjection and rceType = "EXTERNAL_SCRIPT_INJECTION")
    or
    (rce instanceof ExternalWorkerImport and rceType = "EXTERNAL_WORKER_IMPORT")
    or
    (rce instanceof BlobCodeExecution and rceType = "BLOB_CODE_EXECUTION")
    or
    (rce instanceof Base64EvalChain and rceType = "BASE64_EVAL_CHAIN")
    or
    (rce instanceof DocumentWriteScript and rceType = "DOCUMENT_WRITE_SCRIPT")
  )
select rce,
  "HIGH_RISK_RCE: " + rceType + " at " +
  rce.getLocation().getFile().getBaseName() + ":" +
  rce.getLocation().getStartLine().toString()
