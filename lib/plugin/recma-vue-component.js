/**
 * @typedef {import('estree-jsx').Expression} Expression
 * @typedef {import('estree-jsx').VariableDeclaration} VariableDeclaration
 * @typedef {import('estree-jsx').ModuleDeclaration} ModuleDeclaration
 * @typedef {import('estree-jsx').ExpressionStatement} ExpressionStatement
 * @typedef {import('estree-jsx').Program} Program
 */

/**
 * A plugin to wrap the estree with a render function in defineComponent.
 *
 * @type {import('unified').Plugin<[], Program>}
 */
export const recmaVueComponent = () => (tree, file) => {
  /** @type {boolean|undefined} */
  let content

  // Patch missing comments, which types say could occur.
  /* c8 ignore next */
  if (!tree.comments) tree.comments = []

  // Find the root JSX element or fragment and define a Vue component.
  const newBody = tree.body.map(child => {
    if (isJSX(child)) {
      content = true
      return defineComponent(child.expression)
    }
    return child
  })

  // If there was no JSX content at all, add an empty function.
  if (!content)
    newBody.push(defineComponent())

  newBody.push({
    type: 'ExportDefaultDeclaration',
    declaration: {type: 'Identifier', name: '_sfc_main'}
  })

  tree.body = newBody
}

/**
 * @param {Program['body'][0]} node
 * @returns {node is ExpressionStatement}
 */
function isJSX (node) {
  return node.type === 'ExpressionStatement' &&
    // @ts-expect-error `JSXElement`/`JSXFragment` are `Expression`s.
    (node.expression.type === 'JSXFragment' || node.expression.type === 'JSXElement')
}


/**
 * @param {Expression} [argument]
 * @returns {VariableDeclaration}
 */
function defineComponent(argument = {type: 'Literal', value: null}) {
  if (
    argument &&
    // @ts-expect-error: fine.
    argument.type === 'JSXFragment' &&
    // @ts-expect-error: fine.
    argument.children.length === 1 &&
    // @ts-expect-error: fine.
    argument.children[0].type === 'JSXElement'
  ) {
    // @ts-expect-error: fine.
    argument = argument.children[0]
  }

  return {
    type: 'VariableDeclaration',
    kind: 'const',
    declarations: [
      {
        type: 'VariableDeclarator',
        id: {type: 'Identifier', name: '_sfc_main'},
        init: {
          type: 'CallExpression',
          callee: {type: 'Identifier', name: 'defineComponent'},
          optional: false,
          arguments: [
            {
              type: 'ObjectExpression',
              properties: [
                {
                  type: 'Property',
                  method: false,
                  shorthand: false,
                  computed: false,
                  kind: 'init',
                  key: {type: 'Identifier', name: 'render'},
                  value: {
                    type: 'FunctionExpression',
                    params: [
                      {
                        type: 'AssignmentPattern',
                        left: {type: 'Identifier', name: 'props'},
                        right: {type: 'ObjectExpression', properties: []},
                      }
                    ],
                    body: {
                      type: 'BlockStatement',
                      body: [{ type: 'ReturnStatement', argument }],
                    }
                  },
                }
              ]
            }
          ],
        }
      }
    ],
  }
}
