/**
 * @typedef {import('estree-jsx').Node} Node
 */

/**
 * @template {Node} N
 * @param {Node} template
 * @param {N} node
 * @returns {N}
 */
export function create(template, node) {
  const fields = ['start', 'end', 'loc', 'range', 'comments']
  let index = -1
  /** @type {string} */
  let field

  while (++index < fields.length) {
    field = fields[index]
    if (field in template) {
      node[field] = template[field]
    }
  }

  return node
}
