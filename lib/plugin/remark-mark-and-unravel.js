import visit from 'unist-util-visit'

/**
 * @typedef {import('unist').Node} Node
 */

/**
 * A tiny plugin that unravels `<p><h1>x</h1></p>` but also
 * `<p><Component /></p>` (so it has no knowledge of “HTML”).
 * It also marks JSX as being explicitly JSX, so when a user passes a `h1`
 * component, it is used for `# heading` but not for `<h1>heading</h1>`.
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

/**
 *
 * @param {import('unist').Parent} node
 * @param {number} index
 * @param {import('unist').Parent} parent
 * @returns
 */
function onvisit(node, index, parent) {
  var offset = -1
  var all = true
  /** @type {boolean} */
  var oneOrMore
  /** @type {Object.<string, unknown>} */
  var data

  if (parent && node.type === 'paragraph') {
    while (++offset < node.children.length) {
      if (
        node.children[offset].type === 'mdxJsxTextElement' ||
        node.children[offset].type === 'mdxTextExpression'
      ) {
        oneOrMore = true
      } else if (
        node.children[offset].type === 'text' &&
        /^[\t\r\n ]+$/.test(String(node.children[offset].value))
      ) {
        // Empty.
      } else {
        all = false
        break
      }
    }

    if (all && oneOrMore) {
      offset = -1

      while (++offset < node.children.length) {
        if (node.children[offset].type === 'mdxJsxTextElement') {
          node.children[offset].type = 'mdxJsxFlowElement'
        }

        if (node.children[offset].type === 'mdxTextExpression') {
          node.children[offset].type = 'mdxFlowExpression'
        }
      }

      parent.children.splice(index, 1, ...node.children)
      return index
    }
  }

  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    data = node.data || (node.data = {})
    data._xdmExplicitJsx = true
  }
}
