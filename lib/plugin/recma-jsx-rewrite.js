/**
 * @typedef {import('estree-jsx').Expression} Expression
 * @typedef {import('estree-jsx').Function} ESFunction
 * @typedef {import('estree-jsx').ImportSpecifier} ImportSpecifier
 * @typedef {import('estree-jsx').JSXElement} JSXElement
 * @typedef {import('estree-jsx').JSXIdentifier} JSXIdentifier
 * @typedef {import('estree-jsx').JSXMemberExpression} JSXMemberExpression
 * @typedef {import('estree-jsx').JSXNamespacedName} JSXNamespacedName
 * @typedef {import('estree-jsx').ModuleDeclaration} ModuleDeclaration
 * @typedef {import('estree-jsx').Program} Program
 * @typedef {import('estree-jsx').Property} Property
 * @typedef {import('estree-jsx').Statement} Statement
 * @typedef {import('estree-jsx').VariableDeclarator} VariableDeclarator
 *
 * @typedef {import('estree-walker').SyncHandler} WalkHandler
 *
 * @typedef RecmaJsxRewriteOptions
 * @property {'program'|'function-body'} [outputFormat='program'] Whether to use an import statement or `arguments[0]` to get the provider
 * @property {string} [providerImportSource] Place to import a provider from
 *
 * @typedef StackEntry
 * @property {Array.<string>} objects
 * @property {Array.<string>} components
 * @property {Array.<string>} tags
 */

import {name as isIdentifierName} from 'estree-util-is-identifier-name'
import {walk} from 'estree-walker'
import {analyze} from 'periscopic'
import {specifiersToObjectPattern} from '../util/estree-util-specifiers-to-object-pattern.js'

/**
 * A plugin that rewrites JSX in functions to accept components as
 * `props.components` (when the function is called `MDXContent`), or from
 * a provider (if there is one).
 * It also makes sure that any undefined components are defined: either from
 * received components or as a function that throws an error.
 *
 * @type {import('unified').Plugin<[RecmaJsxRewriteOptions]|[], Program>}
 */
export function recmaJsxRewrite(options = {}) {
  const {providerImportSource, outputFormat} = options

  return (tree) => {
    // Find everything that’s defined in the top-level scope.
    const topScope = analyze(tree).scope.declarations
    /** @type {Array.<StackEntry>} */
    const stack = []
    /** @type {boolean|undefined} */
    let importProvider

    walk(tree, {
      enter(node) {
        if (
          node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression'
        ) {
          stack.push({objects: [], components: [], tags: []})
        }

        if (node.type === 'JSXElement' && stack.length > 0) {
          const element = /** @type {JSXElement} */ (node)
          // Note: inject into the *top-level* function that contains JSX.
          // Yes: we collect info about the stack, but we assume top-level functions
          // are components.
          const scope = stack[0]
          let name = element.openingElement.name

          // `<x.y>`, `<Foo.Bar>`, `<x.y.z>`.
          if (name.type === 'JSXMemberExpression') {
            // Find the left-most identifier.
            while (name.type === 'JSXMemberExpression') name = name.object

            if (
              !scope.objects.includes(name.name) &&
              !topScope.has(name.name)
            ) {
              scope.objects.push(name.name)
            }
          }
          // `<xml:thing>`.
          else if (name.type === 'JSXNamespacedName') {
            // Ignore namespaces.
          }
          // If the name is a valid ES identifier, and it doesn’t start with a
          // lowercase letter, it’s a component.
          // For example, `$foo`, `_bar`, `Baz` are all component names.
          // But `foo` and `b-ar` are tag names.
          else if (isIdentifierName(name.name) && !/^[a-z]/.test(name.name)) {
            if (
              !scope.components.includes(name.name) &&
              !topScope.has(name.name)
            ) {
              scope.components.push(name.name)
            }
          }
          // @ts-expect-error Allow fields passed through from mdast through hast to
          // esast.
          else if (element.data && element.data._xdmExplicitJsx) {
            // Do not turn explicit JSX into components from `_components`.
            // As in, a given `h1` component is used for `# heading` (next case),
            // but not for `<h1>heading</h1>`.
          } else {
            if (!scope.tags.includes(name.name)) {
              scope.tags.push(name.name)
            }

            element.openingElement.name = {
              type: 'JSXMemberExpression',
              object: {type: 'JSXIdentifier', name: '_components'},
              property: name
            }

            if (element.closingElement) {
              element.closingElement.name = {
                type: 'JSXMemberExpression',
                object: {type: 'JSXIdentifier', name: '_components'},
                property: {type: 'JSXIdentifier', name: name.name}
              }
            }
          }
        }
      },
      leave(node) {
        /** @type {Array.<Property>} */
        const defaults = []
        /** @type {Array.<string>} */
        const actual = []
        /** @type {Array.<Expression>} */
        const parameters = []
        /** @type {Array.<VariableDeclarator>} */
        const declarations = []

        if (
          node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression' ||
          node.type === 'ArrowFunctionExpression'
        ) {
          const fn = /** @type {ESFunction} */ (node)
          const scope = stack.pop()
          /** @type {string} */
          let name

          // Supported for types but our stack is good!
          /* c8 ignore next 1 */
          if (!scope) throw new Error('Expected scope on stack')

          for (name of scope.tags) {
            defaults.push({
              type: 'Property',
              kind: 'init',
              key: {type: 'Identifier', name},
              value: {type: 'Literal', value: name},
              method: false,
              shorthand: false,
              computed: false
            })
          }

          actual.push(...scope.components)

          for (name of scope.objects) {
            // In some cases, a component is used directly (`<X>`) but it’s also
            // used as an object (`<X.Y>`).
            if (!actual.includes(name)) {
              actual.push(name)
            }
          }

          if (defaults.length > 0 || actual.length > 0) {
            parameters.push({type: 'ObjectExpression', properties: defaults})

            if (providerImportSource) {
              importProvider = true
              parameters.push({
                type: 'CallExpression',
                callee: {type: 'Identifier', name: '_provideComponents'},
                arguments: [],
                optional: false
              })
            }

            // Accept `components` as a prop if this is the `MDXContent` function.
            if (
              fn.type === 'FunctionDeclaration' &&
              fn.id &&
              fn.id.name === 'MDXContent'
            ) {
              parameters.push({
                type: 'MemberExpression',
                object: {type: 'Identifier', name: 'props'},
                property: {type: 'Identifier', name: 'components'},
                computed: false,
                optional: false
              })
            }

            declarations.push({
              type: 'VariableDeclarator',
              id: {type: 'Identifier', name: '_components'},
              init:
                parameters.length > 1
                  ? {
                      type: 'CallExpression',
                      callee: {
                        type: 'MemberExpression',
                        object: {type: 'Identifier', name: 'Object'},
                        property: {type: 'Identifier', name: 'assign'},
                        computed: false,
                        optional: false
                      },
                      arguments: parameters,
                      optional: false
                    }
                  : parameters[0]
            })

            // Add components to scope.
            // For `['MyComponent', 'MDXLayout']` this generates:
            // ```js
            // const {MyComponent, wrapper: MDXLayout} = _components
            // ```
            // Note that MDXLayout is special as it’s taken from
            // `_components.wrapper`.
            if (actual.length > 0) {
              declarations.push({
                type: 'VariableDeclarator',
                id: {
                  type: 'ObjectPattern',
                  properties: actual.map((name) => ({
                    type: 'Property',
                    kind: 'init',
                    key: {
                      type: 'Identifier',
                      name: name === 'MDXLayout' ? 'wrapper' : name
                    },
                    value: {type: 'Identifier', name},
                    method: false,
                    shorthand: name !== 'MDXLayout',
                    computed: false
                  }))
                },
                init: {type: 'Identifier', name: '_components'}
              })
            }

            // Arrow functions with an implied return:
            if (fn.body.type !== 'BlockStatement') {
              fn.body = {
                type: 'BlockStatement',
                body: [{type: 'ReturnStatement', argument: fn.body}]
              }
            }

            fn.body.body.unshift({
              type: 'VariableDeclaration',
              kind: 'const',
              declarations
            })
          }
        }
      }
    })

    // If a provider is used (and can be used), import it.
    if (importProvider && providerImportSource) {
      tree.body.unshift(
        createImportProvider(providerImportSource, outputFormat)
      )
    }
  }
}

/**
 * @param {string} providerImportSource
 * @param {RecmaJsxRewriteOptions['outputFormat']} outputFormat
 * @returns {Statement|ModuleDeclaration}
 */
function createImportProvider(providerImportSource, outputFormat) {
  /** @type {Array<ImportSpecifier>} */
  const specifiers = [
    {
      type: 'ImportSpecifier',
      imported: {type: 'Identifier', name: 'useMDXComponents'},
      local: {type: 'Identifier', name: '_provideComponents'}
    }
  ]

  return outputFormat === 'function-body'
    ? {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: specifiersToObjectPattern(specifiers),
            init: {
              type: 'MemberExpression',
              object: {type: 'Identifier', name: 'arguments'},
              property: {type: 'Literal', value: 0},
              computed: true,
              optional: false
            }
          }
        ]
      }
    : {
        type: 'ImportDeclaration',
        specifiers,
        source: {type: 'Literal', value: providerImportSource}
      }
}
