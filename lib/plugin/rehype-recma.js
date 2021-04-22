/**
 * @typedef {import('unist').Node} Node
 *
 * @typedef {import('estree-jsx').Program} Program
 */

import toEstree from 'hast-util-to-estree'

/**
 * A plugin to transform an HTML (hast) tree to a JS (estree).
 * `hast-util-to-estree` does all the work for us!
 *
 * @returns {Transformer}
 */
export function rehypeRecma() {
  // @ts-ignore Returns a root of an estree `Program`.
  return transform
}

/**
 * @param {Node} tree
 * @returns {Program}
 */
function transform(tree) {
  return toEstree(tree)
}
