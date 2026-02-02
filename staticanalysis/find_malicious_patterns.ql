/**
 * @name Find malicious patterns
 * @description Detects patterns commonly found in malicious extensions
 * @kind problem
 * @problem.severity error
 * @precision medium
 * @id js/malicious-patterns
 * @tags security
 */

import javascript

from Expr e, string pattern
where
  // Keylogger - keyboard event listeners
  (e.(CallExpr).getCalleeName() = "addEventListener" and
   e.(CallExpr).getArgument(0).(StringLiteral).getValue() = "keydown" and
   pattern = "KEYLOGGER: keydown listener") or
   
  (e.(CallExpr).getCalleeName() = "addEventListener" and
   e.(CallExpr).getArgument(0).(StringLiteral).getValue() = "keyup" and
   pattern = "KEYLOGGER: keyup listener") or
  
  // Form interception
  (e.(CallExpr).getCalleeName() = "addEventListener" and
   e.(CallExpr).getArgument(0).(StringLiteral).getValue() = "submit" and
   pattern = "FORM_INTERCEPT: submit listener") or
  
  // Clipboard access
  (e.(PropAccess).getPropertyName() = "clipboard" and
   pattern = "CLIPBOARD: clipboard access") or
  
  // document.cookie access
  (e.(PropAccess).getPropertyName() = "cookie" and
   pattern = "COOKIE_ACCESS: cookie accessed") or
  
  // innerHTML modification
  (e.(PropAccess).getPropertyName() = "innerHTML" and
   pattern = "INNER_HTML: innerHTML (XSS risk)") or
  
  // Tracking pixel
  (e.(NewExpr).getCalleeName() = "Image" and
   pattern = "TRACKING: Image object")

select e, pattern
