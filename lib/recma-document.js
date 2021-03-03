import u from 'unist-builder'
import stringifyPosition from 'unist-util-stringify-position'
import {positionFromEstree} from './util/unist-util-position-from-estree.js'
import {create} from './util/estree-util-create.js'

/**
 * @typedef RecmaDocumentOptions
 * @property {boolean} [_contain] Semihidden option which here results in failing on imports and adding a top-level return statement instead of an export.
 * @property {boolean} [_async] Semihidden option which here turns import statements (and `export from`s) into import expressions (if `_baseUrl` is also set)
 * @property {string} [_baseUrl] Semihidden option which here turns import statements (and `export from`s) into import expressions
 * @property {string} [pragma='React.createElement'] Pragma for JSX (used in classic runtime)
 * @property {string} [pragmaFrag='React.Fragment'] Pragma for JSX fragments (used in classic runtime)
 * @property {string} [pragmaImportSource='react'] Where to import the identifier of `pragma` from (used in classic runtime)
 * @property {string} [jsxImportSource='react'] Place to import automatic JSX runtimes from (used in automatic runtime)
 * @property {'automatic' | 'classic'} [jsxRuntime='automatic'] JSX runtime to use
 */

/**
 * A plugin to wrap the estree in `MDXContent`.
 *
 * @param {RecmaDocumentOptions} [options]
 */
export function recmaDocument(options = {}) {
  var {
    _contain,
    _baseUrl,
    _async,
    pragma = 'React.createElement',
    pragmaFrag = 'React.Fragment',
    pragmaImportSource = 'react',
    jsxImportSource = 'react',
    jsxRuntime = 'automatic'
  } = options

  return transform

  function transform(tree, file) {
    var exportedIdentifiers = []
    var replacement = []
    var pragmas = []
    var layout
    var content
    var child

    if (jsxRuntime) {
      pragmas.push('@jsxRuntime ' + jsxRuntime)
    }

    if (jsxRuntime === 'automatic' && jsxImportSource) {
      pragmas.push('@jsxImportSource ' + jsxImportSource)
    }

    if (jsxRuntime === 'classic' && pragma) {
      pragmas.push('@jsx ' + pragma)
    }

    if (jsxRuntime === 'classic' && pragmaFrag) {
      pragmas.push('@jsxFrag ' + pragmaFrag)
    }

    if (pragmas.length > 0) {
      tree.comments.unshift(u('Block', pragmas.join(' ')))
    }

    if (jsxRuntime === 'classic' && pragmaImportSource) {
      if (!pragma) {
        throw new Error(
          'Missing `pragma` in classic runtime with `pragmaImportSource`'
        )
      }

      handleImport(
        u('ImportDeclaration', {
          specifiers: [
            u('ImportDefaultSpecifier', {
              local: u('Identifier', {name: pragma.split('.')[0]})
            })
          ],
          source: u('Literal', pragmaImportSource)
        })
      )
    }

    // Find the `export default`, the JSX expression, and leave the rest
    // (import/exports) as they are.
    for (child of tree.body) {
      // ```js
      // export default props => <>{props.children}</>
      // ```
      //
      // Treat it as an inline layout declaration.
      if (child.type === 'ExportDefaultDeclaration') {
        if (layout) {
          file.fail(
            'Cannot specify multiple layouts (previous: ' +
              stringifyPosition(positionFromEstree(layout)) +
              ')',
            positionFromEstree(child),
            'recma-document:duplicate-layout'
          )
        }

        layout = child
        replacement.push(
          u('VariableDeclaration', {
            kind: 'const',
            declarations: [
              u('VariableDeclarator', {
                id: u('Identifier', {name: 'MDXLayout'}),
                init: child.declaration
              })
            ]
          })
        )
      }
      // ```js
      // export function a() {}
      // export {a, b as c}
      // export {a, b as c} from "d"
      // ```
      else if (child.type === 'ExportNamedDeclaration') {
        // ```js
        // export {a, b as c} from "d"
        // ```
        if (child.source) {
          // Remove `default` or `as default`, but not `default as`, specifier.
          child.specifiers = child.specifiers.filter(function (specifier) {
            if (specifier.exported.name === 'default') {
              if (layout) {
                file.fail(
                  'Cannot specify multiple layouts (previous: ' +
                    stringifyPosition(positionFromEstree(layout)) +
                    ')',
                  positionFromEstree(child),
                  'recma-document:duplicate-layout'
                )
              }

              layout = specifier

              // Make it just an import: `import MDXLayout from "..."`.
              handleImport(
                create(
                  specifier,
                  u('ImportDeclaration', {
                    specifiers: [
                      // Default as default / something else as default.
                      specifier.local.name === 'default'
                        ? u('ImportDefaultSpecifier', {
                            local: u('Identifier', {name: 'MDXLayout'})
                          })
                        : create(
                            specifier.local,
                            u('ImportSpecifier', {
                              imported: specifier.local,
                              local: u('Identifier', {name: 'MDXLayout'})
                            })
                          )
                    ],
                    source: create(
                      child.source,
                      u('Literal', child.source.value)
                    )
                  })
                )
              )

              return false
            }

            return true
          })

          // If there are other things imported, keep it.
          if (child.specifiers.length > 0) {
            handleExport(child)
          }
        }
        // ```js
        // export function a() {}
        // export class A {}
        // export const a = 1
        // export {a, b as c}
        // ```
        else {
          handleExport(child)
        }
      }
      // ```js
      // export * from "a"
      // ```
      else if (child.type === 'ExportAllDeclaration') {
        handleExport(child)
      } else if (
        child.type === 'ImportNamespaceSpecifier' ||
        child.type === 'ImportDeclaration'
      ) {
        handleImport(child)
      } else if (
        child.type === 'ExpressionStatement' &&
        (child.expression.type === 'JSXFragment' ||
          child.expression.type === 'JSXElement')
      ) {
        content = true
        replacement.push(createMdxContent(child.expression))
        // The following catch-all branch is because plugins might’ve added
        // other things.
        // Normally, we only have import/export/jsx, but just add whatever’s
        // there.
        /* c8 ignore next 3 */
      } else {
        replacement.push(child)
      }
    }

    // If there was no JSX content at all, add an empty function.
    if (!content) {
      replacement.push(createMdxContent())
    }

    if (_contain) {
      exportedIdentifiers.push(['MDXContent', 'default'])
      replacement.push(
        u('ReturnStatement', {
          argument: u('ObjectExpression', {
            properties: exportedIdentifiers.map((d) => {
              return u('Property', {
                kind: 'init',
                shorthand: typeof d === 'string',
                key: u('Identifier', {name: typeof d === 'string' ? d : d[1]}),
                value: u('Identifier', {name: typeof d === 'string' ? d : d[0]})
              })
            })
          })
        })
      )
    } else {
      replacement.push(
        u('ExportDefaultDeclaration', {
          declaration: u('Identifier', {name: 'MDXContent'})
        })
      )
    }

    tree.body = replacement

    function handleImport(node) {
      if (_contain || _async) {
        handleImportExportFrom(node)
      } else {
        replacement.push(node)
      }
    }

    function handleExport(node) {
      var child

      if (_contain) {
        // ```js
        // export function a() {}
        // export class A {}
        // export const a = 1
        // ```
        if (node.declaration) {
          replacement.push(node.declaration)

          if (
            node.declaration.type === 'FunctionDeclaration' ||
            node.declaration.type === 'ClassDeclaration'
          ) {
            exportedIdentifiers.push(node.declaration.id.name)
          }
          // Must be a variable declaration: other things can’t be exported with
          // ESM.
          else {
            for (child of node.declaration.declarations) {
              exportedIdentifiers.push(child.id.name)
            }
          }
        } else if (node.source) {
          handleImportExportFrom(node)
        }

        // ```js
        // export {a, b as c}
        // export {a, b as c} from "d"
        // ```
        if (node.specifiers) {
          for (child of node.specifiers) {
            exportedIdentifiers.push(
              child.local.name === child.exported.name
                ? child.local.name
                : [child.local.name, child.exported.name]
            )
          }
        }
      } else {
        replacement.push(node)
      }
    }

    function handleImportExportFrom(node) {
      var value

      if (!_async) {
        file.fail(
          'Cannot use `import` or `export … from` in `evaluateSync` or `evaluate` w/o passing `baseUrl`: use `compile`, `compileSync`, or use `evaluate` and pass a `baseUrl`',
          positionFromEstree(child),
          'recma-document:contain-export'
        )
      }

      value = node.source.value

      // Relative.
      if (value.slice(0, 2) === './' || value.slice(0, 3) === '../') {
        value = new URL(value, _baseUrl)
      } else {
        // Bare specifiers such as `some-package`, `@some-package`, and
        // `some-package/path` will crash here.
        try {
          value = new URL(value)
        } catch {}
      }

      replacement.push(
        u('VariableDeclaration', {
          kind: 'const',
          declarations: [
            u('VariableDeclarator', {
              // To do: externalise this w/ the one in `jsx-build`.
              id: u('ObjectPattern', {
                properties: node.specifiers.map((specifier) => {
                  // @ts-ignore assume specifier is not a default export
                  var key =
                    specifier.imported ||
                    specifier.exported ||
                    u('Identifier', {name: 'default'})
                  return u('Property', {
                    kind: 'init',
                    shorthand: key.name === specifier.local.name,
                    key,
                    value: specifier.local
                  })
                })
              }),
              init: u('AwaitExpression', {
                argument: create(
                  node,
                  u('ImportExpression', {
                    source: create(node.source, u('Literal', {value}))
                  })
                )
              })
            })
          ]
        })
      )
    }
  }

  function createMdxContent(content) {
    return u('FunctionDeclaration', {
      id: u('Identifier', {name: 'MDXContent'}),
      params: [u('Identifier', {name: '_props'})],
      body: u('BlockStatement', {
        body: [
          u('VariableDeclaration', {
            kind: 'const',
            declarations: [
              u('VariableDeclarator', {
                id: u('Identifier', {name: '_content'}),
                init: content || u('Literal', {value: null})
              })
            ]
          }),
          u('ReturnStatement', {
            argument: u('ConditionalExpression', {
              test: u('Identifier', {name: 'MDXLayout'}),
              consequent: u('JSXElement', {
                openingElement: u('JSXOpeningElement', {
                  name: u('JSXIdentifier', {name: 'MDXLayout'}),
                  attributes: [
                    u('JSXSpreadAttribute', {
                      argument: u('Identifier', {name: '_props'})
                    })
                  ]
                }),
                closingElement: u('JSXClosingElement', {
                  name: u('JSXIdentifier', {name: 'MDXLayout'})
                }),
                children: [
                  u('JSXExpressionContainer', {
                    expression: u('Identifier', {name: '_content'})
                  })
                ]
              }),
              alternate: u('Identifier', {name: '_content'})
            })
          })
        ]
      })
    })
  }
}
