/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist-util-visit').Visitor<Node>} Visitor
 * @typedef {import('unified').Transformer} Transformer
 */

import {visit} from 'unist-util-visit'

/**
 * A tiny plugin that removes raw HTML.
 * This is needed if the format is `md` and `rehype-raw` was not used to parse
 * dangerous HTML into nodes.
 *
 * @returns {Transformer}
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

/** @type {Visitor} */
function onvisit(_, index, parent) {
  parent.children.splice(index, 1)
  return index
}
