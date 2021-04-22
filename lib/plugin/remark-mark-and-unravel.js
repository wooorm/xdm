/**
 * @typedef {import('unist').Node} Node
 * @typedef {import('unist-util-visit').Visitor<Node>} Visitor
 * @typedef {import('unified').Transformer} Transformer
 */

import {visit} from 'unist-util-visit'

/**
 * A tiny plugin that unravels `<p><h1>x</h1></p>` but also
 * `<p><Component /></p>` (so it has no knowledge of “HTML”).
 * It also marks JSX as being explicitly JSX, so when a user passes a `h1`
 * component, it is used for `# heading` but not for `<h1>heading</h1>`.
 *
 * @returns {Transformer}
 */
export function remarkMarkAndUnravel() {
  return transform
}

/**
 * @param {Node} tree
 * @return {void}
 */
function transform(tree) {
  visit(tree, onvisit)
}

/** @type {Visitor} */
function onvisit(node, index, parent) {
  var offset = -1
  var all = true
  /** @type {boolean} */
  var oneOrMore
  /** @type {Object.<string, unknown>} */
  var data
  /** @type {Array.<Node>} */
  var children

  if (parent && node.type === 'paragraph' && Array.isArray(node.children)) {
    // type-coverage:ignore-next-line
    children = node.children

    while (++offset < children.length) {
      if (
        children[offset].type === 'mdxJsxTextElement' ||
        children[offset].type === 'mdxTextExpression'
      ) {
        oneOrMore = true
      } else if (
        children[offset].type === 'text' &&
        /^[\t\r\n ]+$/.test(String(children[offset].value))
      ) {
        // Empty.
      } else {
        all = false
        break
      }
    }

    if (all && oneOrMore) {
      offset = -1

      while (++offset < children.length) {
        if (children[offset].type === 'mdxJsxTextElement') {
          children[offset].type = 'mdxJsxFlowElement'
        }

        if (children[offset].type === 'mdxTextExpression') {
          children[offset].type = 'mdxFlowExpression'
        }
      }

      parent.children.splice(index, 1, ...children)
      return index
    }
  }

  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    data = node.data || (node.data = {})
    data._xdmExplicitJsx = true
  }
}
