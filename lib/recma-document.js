import u from 'unist-builder'
import stringifyPosition from 'unist-util-stringify-position'
import {positionFromEstree} from './util/unist-util-position-from-estree.js'
import {create} from './util/estree-util-create.js'

/**
 * @typedef RecmaDocumentOptions
 * @property {*} contain
 * @property {*} [pragma]
 * @property {*} [pragmaFrag]
 * @property {*} [pragmaImportSource]
 * @property {*} [jsxImportSource]
 * @property {*} [jsxRuntime]
 */

/**
 * A plugin to wrap the estree in `MDXContent`.
 * @param {RecmaDocumentOptions} [options]
 */
export function recmaDocument(options) {
  var {
    contain,
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
    var layout
    var content

    var pragmas = []

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

      replacement.push(
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
    tree.body.forEach((child) => {
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
      // Look for default “reexports”.
      //
      // ```js
      // export {default} from "a"
      // export {default as a} from "b"
      // export {default as a, b} from "c"
      // export {a as default} from "b"
      // export {a as default, b} from "c"
      // ```
      else if (child.type === 'ExportNamedDeclaration' && child.source) {
        if (contain) {
          file.fail(
            'Cannot use `export … from` in contained MDX',
            positionFromEstree(child),
            'recma-document:contain-export'
          )
        }

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
            replacement.push(
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
                  source: create(child.source, u('Literal', child.source.value))
                })
              )
            )

            return false
          }

          return true
        })

        // If there are other things imported, keep it.
        if (child.specifiers.length > 0) {
          replacement.push(child)
        }
      } else if (child.type === 'ExportAllDeclaration' && contain) {
        file.fail(
          'Cannot use `export * from` in contained MDX',
          positionFromEstree(child),
          'recma-document:contain-export'
        )
      } else if (child.type === 'ExportNamedDeclaration' && contain) {
        if (child.declaration) {
          replacement.push(child.declaration)

          if (
            child.declaration.type === 'FunctionDeclaration' ||
            child.declaration.type === 'ClassDeclaration'
          ) {
            exportedIdentifiers.push(child.declaration.id.name)
          }
          // Must be a variable declaration: other things can’t be exported with
          // ESM.
          else {
            child.declaration.declarations.forEach((d) => {
              exportedIdentifiers.push(d.id.name)
            })
          }
        } else {
          child.specifiers.forEach((d) => {
            exportedIdentifiers.push([d.local.name, d.exported.name])
          })
        }
      } else if (
        (child.type === 'ImportNamespaceSpecifier' ||
          child.type === 'ImportDeclaration') &&
        contain
      ) {
        file.fail(
          'Cannot use `import` in contained MDX',
          positionFromEstree(child),
          'recma-document:contain-import'
        )
      } else if (
        child.type === 'ExpressionStatement' &&
        (child.expression.type === 'JSXFragment' ||
          child.expression.type === 'JSXElement')
      ) {
        content = true
        replacement.push(createMdxContent(child.expression))
      } else {
        replacement.push(child)
      }
    })

    // If there was no JSX content at all, add an empty function.
    if (!content) {
      replacement.push(createMdxContent())
    }

    if (contain) {
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
