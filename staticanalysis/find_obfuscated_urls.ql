/**
 * @name Find obfuscated URLs and suspicious patterns
 * @description Detects obfuscation patterns commonly used to hide URLs and API endpoints
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id js/obfuscated-urls
 * @tags security
 */

import javascript

from Expr e, string category
where
  // BASE64 decoding
  (e.(CallExpr).getCalleeName() = "atob" and category = "BASE64: atob() decodes hidden data") or
  
  // EVAL / dynamic code execution
  (e.(CallExpr).getCalleeName() = "eval" and category = "EVAL: eval() executes dynamic code - HIGH RISK") or
  (e.(NewExpr).getCalleeName() = "Function" and category = "EVAL: new Function() - HIGH RISK") or
  
  // URL decoding functions
  (e.(CallExpr).getCalleeName() = "decodeURIComponent" and category = "DECODE: decodeURIComponent()") or
  (e.(CallExpr).getCalleeName() = "decodeURI" and category = "DECODE: decodeURI()") or
  (e.(CallExpr).getCalleeName() = "unescape" and category = "DECODE: unescape()") or
  
  // String building
  (e.(MethodCallExpr).getMethodName() = "fromCharCode" and category = "CHARCODE: String.fromCharCode() builds hidden strings") or
  
  // Workers (external script loading)
  (e.(NewExpr).getCalleeName() = "Worker" and category = "WORKER: Worker loads external script") or
  (e.(NewExpr).getCalleeName() = "SharedWorker" and category = "WORKER: SharedWorker loads external script") or
  
  // Blob URLs (hidden code execution)
  (e.(MethodCallExpr).getMethodName() = "createObjectURL" and category = "BLOB: Blob URL may execute hidden code") or
  
  // JSON parsing (may contain hidden URLs)
  (e.(MethodCallExpr).getMethodName() = "parse" and 
   e.(MethodCallExpr).getReceiver().(VarAccess).getName() = "JSON" and 
   category = "PARSE: JSON.parse() may contain hidden URLs") or
  
  // Array reverse pattern (hidden reversed strings)
  (e.(MethodCallExpr).getMethodName() = "reverse" and category = "REVERSE: String reverse may hide URL")

select e, category
