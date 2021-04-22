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
 * @typedef {import('unified').Transformer} Transformer
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
 * @param {RecmaJsxRewriteOptions} options
 * @returns {Transformer}
 */
export function recmaJsxRewrite(options = {}) {
  var {providerImportSource, outputFormat} = options

  // @ts-ignore root of an estree is a `Program`.
  return transform

  /**
   * @param {Program} tree
   * @returns {void}
   */
  function transform(tree) {
    // Find everything that’s defined in the top-level scope.
    var topScope = analyze(tree).scope.declarations
    /** @type {Array.<StackEntry>} */
    var stack = []
    /** @type {boolean} */
    var useMissingComponentHelper
    /** @type {boolean} */
    var importProvider

    walk(tree, {enter: onenter, leave: onleave})

    // If there are undefined components expected to be passed, add the helper.
    if (useMissingComponentHelper) {
      tree.body.unshift(createMissingComponentHelper())
    }

    // If a provider is used (and can be used), import it.
    if (importProvider) {
      tree.body.unshift(
        createImportProvider(providerImportSource, outputFormat)
      )
    }

    /** @type {WalkHandler} */
    function onenter(node) {
      /** @type {JSXElement} */
      var element
      /** @type {JSXIdentifier|JSXMemberExpression|JSXNamespacedName} */
      var name
      /** @type {StackEntry} */
      var scope

      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        stack.push({objects: [], components: [], tags: []})
      }

      if (node.type === 'JSXElement' && stack.length > 0) {
        // @ts-ignore Narrow node to JSX element.
        element = node

        name = element.openingElement.name
        // Note: inject into the *top-level* function that contains JSX.
        // Yes: we collect info about the stack, but we assume top-level functions
        // are components.
        scope = stack[0]

        // `<x.y>`, `<Foo.Bar>`, `<x.y.z>`.
        if (name.type === 'JSXMemberExpression') {
          // Find the left-most identifier.
          while (name.type === 'JSXMemberExpression') name = name.object

          if (!scope.objects.includes(name.name) && !topScope.has(name.name)) {
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
            // Mark as using the helper.
            if (name.name !== 'MDXLayout') useMissingComponentHelper = true

            scope.components.push(name.name)
          }
        }
        // @ts-ignore Allow fields passed through from mdast through hast to
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
    }

    /** @type {WalkHandler} */
    function onleave(node) {
      /** @type {Array.<Property>} */
      var defaults = []
      /** @type {Array.<string>} */
      var actual = []
      /** @type {Array.<Expression>} */
      var parameters = []
      /** @type {Array.<VariableDeclarator>} */
      var declarations = []
      /** @type {StackEntry} */
      var scope
      /** @type {string} */
      var name
      /** @type {ESFunction} */
      var fn

      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        // @ts-ignore Narrow node.
        fn = node

        scope = stack.pop()

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

        for (name of scope.components) {
          if (name !== 'MDXLayout') {
            defaults.push({
              type: 'Property',
              kind: 'init',
              key: {type: 'Identifier', name},
              value: {
                type: 'CallExpression',
                callee: {type: 'Identifier', name: '_missingComponent'},
                arguments: [{type: 'Literal', value: name}],
                optional: false
              },
              method: false,
              shorthand: false,
              computed: false
            })
          }

          actual.push(name)
        }

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
            fn.id.name === 'MDXContent'
          ) {
            parameters.push({
              type: 'MemberExpression',
              object: {type: 'Identifier', name: '_props'},
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
  }
}

/**
 * @returns {Statement}
 */
function createMissingComponentHelper() {
  return {
    type: 'FunctionDeclaration',
    id: {type: 'Identifier', name: '_missingComponent'},
    params: [{type: 'Identifier', name: 'name'}],
    body: {
      type: 'BlockStatement',
      body: [
        {
          type: 'ReturnStatement',
          argument: {
            type: 'FunctionExpression',
            params: [],
            body: {
              type: 'BlockStatement',
              body: [
                {
                  type: 'ThrowStatement',
                  argument: {
                    type: 'NewExpression',
                    callee: {type: 'Identifier', name: 'Error'},
                    arguments: [
                      {
                        type: 'BinaryExpression',
                        operator: '+',
                        left: {
                          type: 'BinaryExpression',
                          operator: '+',
                          left: {type: 'Literal', value: 'Component `'},
                          right: {type: 'Identifier', name: 'name'}
                        },
                        right: {
                          type: 'Literal',
                          value: '` was not imported, exported, or given'
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      ]
    }
  }
}

/**
 * @param {string} providerImportSource
 * @param {string} outputFormat
 * @returns {Statement|ModuleDeclaration}
 */
function createImportProvider(providerImportSource, outputFormat) {
  /** @type {Array<ImportSpecifier>} */
  var specifiers = [
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
