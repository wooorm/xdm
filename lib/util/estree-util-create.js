/**
 * @template {import('estree').Node} N
 * @param {import('estree').Node} template
 * @param {N} node
 * @returns {N}
 */
export function create(template, node) {
  var fields = ['start', 'end', 'loc', 'range', 'comments']
  var index = -1
  /** @type {string} */
  var field

  while (++index < fields.length) {
    field = fields[index]
    if (field in template) {
      node[field] = template[field]
    }
  }

  return node
}
