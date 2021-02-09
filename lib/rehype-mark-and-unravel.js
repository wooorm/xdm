import visit from 'unist-util-visit'

// A tiny plugin that unravels `<p><h1>x</h1></p>` but also
// `<p><Component /></p>` (so it has no knowledge of “HTML”).
// It also adds a mark on each element node.
export function rehypeMarkAndUnravel() {
  return transform
}

function transform(tree) {
  visit(tree, 'element', onvisit)
}

function onvisit(node, index, parent) {
  if (
    parent &&
    node.tagName === 'p' &&
    node.children.length === 1 &&
    (node.children[0].type === 'mdxJsxTextElement' ||
      node.children[0].type === 'mdxTextExpression')
  ) {
    parent.children[index] = node.children[0]
    return index
  }

  var data = node.data || (node.data = {})
  data._xdmInSource = true
}
