import visit from 'unist-util-visit'

/**
 * @typedef {import('unist').Node} Node
 */

/**
 * A tiny plugin that removes raw HTML.
 * This is needed if the format is `markdown` and `rehype-raw` was not used to
 * parse dangerous HTML into nodes.
 */
export function rehypeRemoveRaw() {
  return transform
}

/**
 * @param {Node} tree
 * @return {void}
 */
function transform(tree) {
  visit(tree, 'raw', onvisit)
}

function onvisit(node, index, parent) {
  parent.children.splice(index, 1)
  return index
}
