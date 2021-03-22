import u from 'unist-builder'
import stringifyPosition from 'unist-util-stringify-position'
import {positionFromEstree} from 'unist-util-position-from-estree'
import {create} from '../util/estree-util-create.js'
import {specifiersToObjectPattern} from '../util/estree-util-specifiers-to-object-pattern.js'

/**
 * @typedef RecmaDocumentOptions
 * @property {'program' | 'function-body'} [outputFormat='program'] Whether to use either `import` and `export` statements to get the runtime (and optionally provider) and export the content, or get values from `arguments` and return things
 * @property {boolean} [useDynamicImport=false] Whether to keep `import` (and `export … from`) statements or compile them to dynamic `import()` instead
 * @property {string} [baseUrl] Resolve relative `import` (and `export … from`) relative to this URL
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
    baseUrl,
    useDynamicImport,
    outputFormat = 'program',
    pragma = 'React.createElement',
    pragmaFrag = 'React.Fragment',
    pragmaImportSource = 'react',
    jsxImportSource = 'react',
    jsxRuntime = 'automatic'
  } = options

  return transform

  /**
   * @param {*} tree
   * @param {import('vfile').VFile} file
   */
  function transform(tree, file) {
    var exportedIdentifiers = []
    var replacement = []
    var pragmas = []
    var exportAllCount = 0
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

      handleEsm(
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
      // export {a, b as c} from 'd'
      // ```
      else if (child.type === 'ExportNamedDeclaration' && child.source) {
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

            // Make it just an import: `import MDXLayout from '…'`.
            handleEsm(
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
                    u('Literal', {value: child.source.value})
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
      // export * from 'a'
      // ```
      else if (
        child.type === 'ExportNamedDeclaration' ||
        child.type === 'ExportAllDeclaration'
      ) {
        handleExport(child)
      } else if (
        child.type === 'ImportNamespaceSpecifier' ||
        child.type === 'ImportDeclaration'
      ) {
        handleEsm(child)
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

    exportedIdentifiers.push(['MDXContent', 'default'])

    if (outputFormat === 'function-body') {
      replacement.push(
        u('ReturnStatement', {
          argument: u('ObjectExpression', {
            properties: [].concat(
              Array.from({length: exportAllCount}).map((d, index) =>
                u('SpreadElement', {
                  argument: u('Identifier', {name: '_exportAll' + (index + 1)})
                })
              ),
              exportedIdentifiers.map((d) => {
                return u('Property', {
                  kind: 'init',
                  shorthand: typeof d === 'string',
                  key: u('Identifier', {
                    name: typeof d === 'string' ? d : d[1]
                  }),
                  value: u('Identifier', {
                    name: typeof d === 'string' ? d : d[0]
                  })
                })
              })
            )
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

    function handleExport(node) {
      var child

      // ```js
      // export function a() {}
      // export class A {}
      // export const a = 1
      // ```
      if (node.declaration) {
        if (
          node.declaration.type === 'FunctionDeclaration' ||
          node.declaration.type === 'ClassDeclaration'
        ) {
          exportedIdentifiers.push(node.declaration.id.name)
        } else {
          for (child of node.declaration.declarations) {
            exportedIdentifiers.push(child.id.name)
          }
        }
      }

      // ```js
      // export {a, b as c}
      // export {a, b as c} from 'd'
      // ```
      if (node.specifiers) {
        for (child of node.specifiers) {
          exportedIdentifiers.push(child.exported.name)
        }
      }

      handleEsm(node)
    }

    function handleEsm(node) {
      var value
      var replace
      var id
      var declarations

      // Rewrite the source of the `import` / `export … from`.
      // See: <https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier>
      if (baseUrl && node.source) {
        value = node.source.value

        try {
          // A full valid URL.
          value = new URL(value)
        } catch {
          // Relative: `/example.js`, `./example.js`, and `../example.js`.
          if (/^\.{0,2}\//.test(value)) {
            value = new URL(value, baseUrl)
          }
          // Otherwise, it’s a bare specifiers.
          // For example `some-package`, `@some-package`, and
          // `some-package/path`.
          // These are supported in Node and browsers plan to support them
          // with import maps (<https://github.com/WICG/import-maps>).
        }

        node.source = create(node.source, u('Literal', {value}))
      }

      if (outputFormat === 'function-body') {
        if (node.source) {
          if (!useDynamicImport) {
            file.fail(
              'Cannot use `import` or `export … from` in `evaluate` (outputting a function body) by default: please set `useDynamicImport: true` (and probably specify a `baseUrl`)',
              positionFromEstree(node),
              'recma-document:invalid-esm-statement'
            )
          }

          // ```
          // import a from 'b'
          // //=> const {default: a} = await import('b')
          // export {a, b as c} from 'd'
          // //=> const {a, c: b} = await import('d')
          // export * from 'a'
          // //=> const _exportAll0 = await import('a')
          // ```
          id = node.specifiers
            ? specifiersToObjectPattern(node.specifiers)
            : u('Identifier', {name: '_exportAll' + ++exportAllCount})

          replace = u('VariableDeclaration', {
            kind: 'const',
            declarations: [
              u('VariableDeclarator', {
                id,
                init: u('AwaitExpression', {
                  argument: create(
                    node,
                    u('ImportExpression', {source: node.source})
                  )
                })
              })
            ]
          })
        } else if (node.declaration) {
          replace = node.declaration
        } else {
          declarations = node.specifiers
            .filter(
              (specifier) => specifier.local.name !== specifier.exported.name
            )
            .map((specifier) =>
              u('VariableDeclarator', {
                id: specifier.exported,
                init: specifier.local
              })
            )

          if (declarations.length > 0) {
            replace = u('VariableDeclaration', {kind: 'const', declarations})
          }
        }
        // Empty
      } else {
        replace = node
      }

      if (replace) {
        replacement.push(replace)
      }
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
