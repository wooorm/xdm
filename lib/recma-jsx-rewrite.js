import isIdentifierName from 'estree-util-is-identifier-name'
import {walk} from 'estree-walker'
import {analyze} from 'periscopic'
import u from 'unist-builder'

// A plugin that rewrites JSX in functions to accept components as
// `props.components` (when the function is called `MDXContent`), or from
// a provider (if there is one).
// It also makes sure that any undefined components are defined: either from
// received components or as a function that throws an error.
export function recmaJsxRewrite({providerImportSource, contain} = {}) {
  return transform

  function transform(tree) {
    // Find everything that’s defined in the top-level scope.
    var topScope = analyze(tree).scope.declarations
    var stack = []
    var useMissingComponentHelper
    var importProvider

    walk(tree, {enter: onenter, leave: onleave})

    // If there are undefined components expected to be passed, add the helper.
    if (useMissingComponentHelper) {
      tree.body.unshift(createMissingComponentHelper())
    }

    // If a provider is used (and can be used), import it.
    if (importProvider) {
      tree.body.unshift(createImportProvider(providerImportSource, contain))
    }

    function onenter(node) {
      var name
      var scope

      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        stack.push({objects: [], components: [], tags: []})
      }

      if (node.type === 'JSXElement' && stack.length > 0) {
        // Note: inject into the *top-level* function that contains JSX.
        // Yes: we collect info about the stack, but we assume top-level functions
        // are components.
        scope = stack[0]
        name = node.openingElement.name

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
        // lowecase letter, it’s a component.
        // For example, `$foo`, `_bar`, `Baz` are all component names.
        // But `foo` and `b-ar` are tag names.
        else if (
          isIdentifierName.name(name.name) &&
          !/^[a-z]/.test(name.name)
        ) {
          if (
            !scope.components.includes(name.name) &&
            !topScope.has(name.name)
          ) {
            // Mark as using the helper.
            if (name.name !== 'MDXLayout') useMissingComponentHelper = true

            scope.components.push(name.name)
          }
        } else if (node.data && node.data._xdmInSource) {
          if (!scope.tags.includes(name.name)) {
            scope.tags.push(name.name)
          }

          node.openingElement.name = u('JSXMemberExpression', {
            object: u('JSXIdentifier', {name: '_components'}),
            property: name
          })

          if (node.closingElement) {
            node.closingElement.name = u('JSXMemberExpression', {
              object: u('JSXIdentifier', {name: '_components'}),
              property: u('JSXIdentifier', {name: name.name})
            })
          }
        }
      }
    }

    function onleave(node) {
      var defaults = []
      var actual = []
      var parameters = []
      var declarations = []
      var scope

      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        scope = stack.pop()

        scope.tags.forEach((name) => {
          defaults.push(
            u('Property', {
              kind: 'init',
              key: u('Identifier', {name}),
              value: u('Literal', name)
            })
          )
        })

        scope.components.forEach((name) => {
          if (name !== 'MDXLayout') {
            defaults.push(
              u('Property', {
                kind: 'init',
                key: u('Identifier', {name}),
                value: u('CallExpression', {
                  callee: u('Identifier', {name: '_missingComponent'}),
                  arguments: [u('Literal', name)]
                })
              })
            )
          }

          actual.push(
            u('Property', {
              kind: 'init',
              shorthand: name !== 'MDXLayout',
              key: u('Identifier', {
                name: name === 'MDXLayout' ? 'wrapper' : name
              }),
              value: u('Identifier', {name})
            })
          )
        })

        scope.objects.forEach((name) => {
          actual.push(
            u('Property', {
              kind: 'init',
              shorthand: true,
              key: u('Identifier', {name}),
              value: u('Identifier', {name})
            })
          )
        })

        if (defaults.length > 0 || actual.length > 0) {
          parameters.push(u('ObjectExpression', {properties: defaults}))

          if (providerImportSource) {
            importProvider = true
            parameters.push(
              u('CallExpression', {
                callee: u('Identifier', {name: '_provideComponents'}),
                arguments: []
              })
            )
          }

          // Accept `components` as a prop if this is the `MDXContent` function.
          if (
            node.type === 'FunctionDeclaration' &&
            node.id.name === 'MDXContent'
          ) {
            parameters.push(
              u('MemberExpression', {
                object: u('Identifier', {name: '_props'}),
                property: u('Identifier', {name: 'components'})
              })
            )
          }

          declarations.push(
            u('VariableDeclarator', {
              id: u('Identifier', {name: '_components'}),
              init:
                parameters.length > 1
                  ? u('CallExpression', {
                      callee: u('MemberExpression', {
                        object: u('Identifier', {name: 'Object'}),
                        property: u('Identifier', {name: 'assign'})
                      }),
                      arguments: parameters
                    })
                  : parameters[0]
            })
          )

          // Add components to scope.
          // For `['MyComponent', 'MDXLayout']` this generates:
          // ```js
          // const {MyComponent, wrapper: MDXLayout} = _components
          // ```
          // Note that MDXLayout is special as it’s taken from
          // `_components.wrapper`.
          if (actual.length > 0) {
            declarations.push(
              u('VariableDeclarator', {
                id: u('ObjectPattern', {properties: actual}),
                init: u('Identifier', {name: '_components'})
              })
            )
          }

          // Arrow functions with an implied return:
          if (node.body.type !== 'BlockStatement') {
            node.body = u('BlockStatement', {
              body: [u('ReturnStatement', {argument: node.body})]
            })
          }

          node.body.body.unshift(
            u('VariableDeclaration', {kind: 'const', declarations})
          )
        }
      }
    }
  }
}

function createMissingComponentHelper() {
  return u('FunctionDeclaration', {
    id: u('Identifier', {name: '_missingComponent'}),
    params: [u('Identifier', {name: 'name'})],
    body: u('BlockStatement', {
      body: [
        u('ReturnStatement', {
          argument: u('FunctionExpression', {
            params: [],
            body: u('BlockStatement', {
              body: [
                u('ThrowStatement', {
                  argument: u('NewExpression', {
                    callee: u('Identifier', {name: 'Error'}),
                    arguments: [
                      u('BinaryExpression', {
                        operator: '+',
                        left: u('BinaryExpression', {
                          operator: '+',
                          left: u('Literal', 'Component `'),
                          right: u('Identifier', {name: 'name'})
                        }),
                        right: u(
                          'Literal',
                          '` was not imported, exported, or given'
                        )
                      })
                    ]
                  })
                })
              ]
            })
          })
        })
      ]
    })
  })
}

function createImportProvider(providerImportSource, contain) {
  var imported = u('Identifier', {name: 'useMDXComponents'})
  var local = u('Identifier', {name: '_provideComponents'})

  if (contain) {
    return u('VariableDeclaration', {
      kind: 'const',
      declarations: [
        u('VariableDeclarator', {
          id: u('ObjectPattern', {
            properties: [
              u('Property', {
                kind: 'init',
                shorthand: false,
                key: imported,
                value: local
              })
            ]
          }),
          init: u('MemberExpression', {
            object: u('Identifier', {name: 'arguments'}),
            property: u('Literal', {value: 0}),
            computed: true
          })
        })
      ]
    })
  }

  return u('ImportDeclaration', {
    specifiers: [u('ImportSpecifier', {imported, local})],
    source: u('Literal', providerImportSource)
  })
}
