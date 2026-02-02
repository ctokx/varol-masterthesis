/**
 * @name Find all string URLs
 * @description Finds all string literals that appear to be URLs
 * @kind problem
 * @problem.severity recommendation
 * @precision medium
 * @id js/string-urls
 * @tags security
 */

import javascript

from StringLiteral str
where 
  // Match HTTP/HTTPS URLs
  str.getValue().regexpMatch("(?i)^https?://[^\\s]+") or
  // Match WebSocket URLs
  str.getValue().regexpMatch("(?i)^wss?://[^\\s]+") or
  // Match relative API paths
  str.getValue().regexpMatch("(?i)^/api/[^\\s]+") or
  str.getValue().regexpMatch("(?i)^/v[0-9]+/[^\\s]+")
select str, "URL string literal: " + str.getValue()
