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
  var data

  if (
    parent &&
    node.type === 'paragraph' &&
    node.children.length === 1 &&
    (node.children[0].type === 'mdxJsxTextElement' ||
      node.children[0].type === 'mdxTextExpression')
  ) {
    parent.children[index] = node.children[0]
    return index
  }

  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    data = node.data || (node.data = {})
    data._xdmExplicitJsx = true
  }
}
