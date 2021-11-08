/**
 * @typedef {import('estree-jsx').Directive} Directive
 * @typedef {import('estree-jsx').ExportDefaultDeclaration} ExportDefaultDeclaration
 * @typedef {import('estree-jsx').ExportSpecifier} ExportSpecifier
 * @typedef {import('estree-jsx').ExportNamedDeclaration} ExportNamedDeclaration
 * @typedef {import('estree-jsx').ExportAllDeclaration} ExportAllDeclaration
 * @typedef {import('estree-jsx').Expression} Expression
 * @typedef {import('estree-jsx').VariableDeclaration} VariableDeclaration
 * @typedef {import('estree-jsx').ImportDeclaration} ImportDeclaration
 * @typedef {import('estree-jsx').JSXElement} JSXElement
 * @typedef {import('estree-jsx').ModuleDeclaration} ModuleDeclaration
 * @typedef {import('estree-jsx').Node} Node
 * @typedef {import('estree-jsx').Program} Program
 * @typedef {import('estree-jsx').SimpleLiteral} SimpleLiteral
 * @typedef {import('estree-jsx').Statement} Statement
 * @typedef {import('estree-jsx').VariableDeclarator} VariableDeclarator
 * @typedef {import('estree-jsx').SpreadElement} SpreadElement
 * @typedef {import('estree-jsx').Property} Property
 *
 * @typedef RecmaDocumentOptions
 * @property {'program'|'function-body'} [outputFormat='program'] Whether to use either `import` and `export` statements to get the runtime (and optionally provider) and export the content, or get values from `arguments` and return things
 * @property {boolean} [useDynamicImport=false] Whether to keep `import` (and `export … from`) statements or compile them to dynamic `import()` instead
 * @property {string} [baseUrl] Resolve relative `import` (and `export … from`) relative to this URL
 * @property {string} [pragma='React.createElement'] Pragma for JSX (used in classic runtime)
 * @property {string} [pragmaFrag='React.Fragment'] Pragma for JSX fragments (used in classic runtime)
 * @property {string} [pragmaImportSource='react'] Where to import the identifier of `pragma` from (used in classic runtime)
 * @property {string} [jsxImportSource='react'] Place to import automatic JSX runtimes from (used in automatic runtime)
 * @property {'automatic'|'classic'} [jsxRuntime='automatic'] JSX runtime to use
 */

import {create} from '../util/estree-util-create.js'

/**
 * A plugin to wrap the estree with a render function in defineComponent.
 *
 * @type {import('unified').Plugin<[], Program>}
 */
export function recmaVueComponent() {
  return (tree, file) => {
    /** @type {boolean|undefined} */
    let content

    // Patch missing comments, which types say could occur.
    /* c8 ignore next */
    if (!tree.comments) tree.comments = []

    // Find the `export default`, the JSX expression, and leave the rest
    // (import/exports) as they are.
    const newBody = tree.body.map(child => {
      if (
        child.type === 'ExpressionStatement' &&
        // @ts-expect-error types are wrong: `JSXElement`/`JSXFragment` are
        // `Expression`s.
        (child.expression.type === 'JSXFragment' ||
          // @ts-expect-error "
          child.expression.type === 'JSXElement')
      ) {
        content = true
        return defineComponent(child.expression)
      } else {
        return child
      }
    })

    // If there was no JSX content at all, add an empty function.
    if (!content) {
      newBody.push(defineComponent())
    }

    newBody.push({
      type: 'ExportDefaultDeclaration',
      declaration: {type: 'Identifier', name: '_sfc_main'}
    })

    tree.body = newBody
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
}
