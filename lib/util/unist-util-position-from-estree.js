export function positionFromEstree(estree) {
  // For generated nodes by plugin, or future externalization.
  /* c8 ignore next 3 */
  var loc = estree.loc || {}
  var start = loc.start || {}
  var end = loc.end || {}

  return {
    start: {line: start.line, column: start.column + 1, offset: estree.start},
    end: {line: end.line, column: end.column + 1, offset: estree.end}
  }
}
