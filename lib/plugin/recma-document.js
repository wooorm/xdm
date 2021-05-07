/**
 * @typedef {import('estree-jsx').Directive} Directive
 * @typedef {import('estree-jsx').ExportDefaultDeclaration} ExportDefaultDeclaration
 * @typedef {import('estree-jsx').ExportSpecifier} ExportSpecifier
 * @typedef {import('estree-jsx').ExportNamedDeclaration} ExportNamedDeclaration
 * @typedef {import('estree-jsx').ExportAllDeclaration} ExportAllDeclaration
 * @typedef {import('estree-jsx').Expression} Expression
 * @typedef {import('estree-jsx').FunctionDeclaration} FunctionDeclaration
 * @typedef {import('estree-jsx').ImportDeclaration} ImportDeclaration
 * @typedef {import('estree-jsx').JSXElement} JSXElement
 * @typedef {import('estree-jsx').ModuleDeclaration} ModuleDeclaration
 * @typedef {import('estree-jsx').Node} Node
 * @typedef {import('estree-jsx').Program} Program
 * @typedef {import('estree-jsx').SimpleLiteral} SimpleLiteral
 * @typedef {import('estree-jsx').Statement} Statement
 * @typedef {import('estree-jsx').VariableDeclarator} VariableDeclarator
 *
 * @typedef {import('unified').Transformer} Transformer
 *
 * @typedef {import('vfile').VFile} VFile
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

import {analyze} from 'periscopic'
import {stringifyPosition} from 'unist-util-stringify-position'
import {positionFromEstree} from 'unist-util-position-from-estree'
import {create} from '../util/estree-util-create.js'
import {specifiersToObjectPattern} from '../util/estree-util-specifiers-to-object-pattern.js'
import {declarationToExpression} from '../util/estree-util-declaration-to-expression.js'
import {isDeclaration} from '../util/estree-util-is-declaration.js'

/**
 * A plugin to wrap the estree in `MDXContent`.
 *
 * @param {RecmaDocumentOptions} [options]
 * @returns {Transformer}
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

  // @ts-ignore root of an estree is a `Program`.
  return transform

  /**
   * @param {Program} tree
   * @param {VFile} file
   * @returns {void}
   */
  function transform(tree, file) {
    /** @type {Array.<string|[string, string]>} */
    var exportedIdentifiers = []
    /** @type {Array.<Directive|Statement|ModuleDeclaration>} */
    var replacement = []
    /** @type {Array.<string>} */
    var pragmas = []
    var exportAllCount = 0
    /** @type {ExportDefaultDeclaration|ExportSpecifier} */
    var layout
    /** @type {boolean} */
    var content
    /** @type {Node} */
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
      tree.comments.unshift({type: 'Block', value: pragmas.join(' ')})
    }

    if (jsxRuntime === 'classic' && pragmaImportSource) {
      if (!pragma) {
        throw new Error(
          'Missing `pragma` in classic runtime with `pragmaImportSource`'
        )
      }

      handleEsm({
        type: 'ImportDeclaration',
        specifiers: [
          {
            type: 'ImportDefaultSpecifier',
            local: {type: 'Identifier', name: pragma.split('.')[0]}
          }
        ],
        source: {type: 'Literal', value: pragmaImportSource}
      })
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
        replacement.push({
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: {type: 'Identifier', name: 'MDXLayout'},
              init: isDeclaration(child.declaration)
                ? declarationToExpression(child.declaration)
                : child.declaration
            }
          ]
        })
      }
      // ```js
      // export {a, b as c} from 'd'
      // ```
      else if (child.type === 'ExportNamedDeclaration' && child.source) {
        /** @type {SimpleLiteral} */
        // @ts-ignore `ExportNamedDeclaration.source` can only be a string literal.
        var source = child.source

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
              create(specifier, {
                type: 'ImportDeclaration',
                specifiers: [
                  // Default as default / something else as default.
                  specifier.local.name === 'default'
                    ? {
                        type: 'ImportDefaultSpecifier',
                        local: {type: 'Identifier', name: 'MDXLayout'}
                      }
                    : create(specifier.local, {
                        type: 'ImportSpecifier',
                        imported: specifier.local,
                        local: {type: 'Identifier', name: 'MDXLayout'}
                      })
                ],
                source: create(source, {type: 'Literal', value: source.value})
              })
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
      // export {a, b as c}
      // export * from 'a'
      // ```
      else if (
        child.type === 'ExportNamedDeclaration' ||
        child.type === 'ExportAllDeclaration'
      ) {
        handleExport(child)
      } else if (child.type === 'ImportDeclaration') {
        handleEsm(child)
      } else if (
        child.type === 'ExpressionStatement' &&
        // @ts-ignore types are wrong: `JSXElement`/`JSXFragment` are
        // `Expression`s.
        (child.expression.type === 'JSXFragment' ||
          // @ts-ignore "
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
      replacement.push({
        type: 'ReturnStatement',
        argument: {
          type: 'ObjectExpression',
          properties: [].concat(
            Array.from({length: exportAllCount}).map(
              /**
               * @param {undefined} _
               * @param {number} index
               */
              (_, index) => ({
                type: 'SpreadElement',
                argument: {type: 'Identifier', name: '_exportAll' + (index + 1)}
              })
            ),
            exportedIdentifiers.map((d) => ({
              type: 'Property',
              kind: 'init',
              shorthand: typeof d === 'string',
              key: {type: 'Identifier', name: typeof d === 'string' ? d : d[1]},
              value: {
                type: 'Identifier',
                name: typeof d === 'string' ? d : d[0]
              }
            }))
          )
        }
      })
    } else {
      replacement.push({
        type: 'ExportDefaultDeclaration',
        declaration: {type: 'Identifier', name: 'MDXContent'}
      })
    }

    tree.body = replacement

    /**
     * @param {ExportNamedDeclaration|ExportAllDeclaration} node
     * @returns {void}
     */
    function handleExport(node) {
      if (node.type === 'ExportNamedDeclaration') {
        // ```js
        // export function a() {}
        // export class A {}
        // export var a = 1
        // ```
        if (node.declaration) {
          exportedIdentifiers.push(
            ...analyze(node.declaration).scope.declarations.keys()
          )
        }

        // ```js
        // export {a, b as c}
        // export {a, b as c} from 'd'
        // ```
        for (child of node.specifiers) {
          exportedIdentifiers.push(child.exported.name)
        }
      }

      handleEsm(node)
    }

    /**
     * @param {ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration} node
     * @returns {void}
     */
    function handleEsm(node) {
      /** @type {string} */
      var value
      /** @type {Statement|ModuleDeclaration} */
      var replace
      /** @type {Expression} */
      var init
      /** @type {Array.<VariableDeclarator>} */
      var declarators

      // Rewrite the source of the `import` / `export … from`.
      // See: <https://html.spec.whatwg.org/multipage/webappapis.html#resolve-a-module-specifier>
      if (baseUrl && node.source) {
        value = String(node.source.value)

        try {
          // A full valid URL.
          value = String(new URL(value))
        } catch {
          // Relative: `/example.js`, `./example.js`, and `../example.js`.
          if (/^\.{0,2}\//.test(value)) {
            value = String(new URL(value, baseUrl))
          }
          // Otherwise, it’s a bare specifiers.
          // For example `some-package`, `@some-package`, and
          // `some-package/path`.
          // These are supported in Node and browsers plan to support them
          // with import maps (<https://github.com/WICG/import-maps>).
        }

        node.source = create(node.source, {type: 'Literal', value})
      }

      if (outputFormat === 'function-body') {
        if (
          // Always have a source:
          node.type === 'ImportDeclaration' ||
          node.type === 'ExportAllDeclaration' ||
          // Source optional:
          (node.type === 'ExportNamedDeclaration' && node.source)
        ) {
          if (!useDynamicImport) {
            file.fail(
              'Cannot use `import` or `export … from` in `evaluate` (outputting a function body) by default: please set `useDynamicImport: true` (and probably specify a `baseUrl`)',
              positionFromEstree(node),
              'recma-document:invalid-esm-statement'
            )
          }

          // ```
          // import 'a'
          // //=> await import('a')
          // import a from 'b'
          // //=> const {default: a} = await import('b')
          // export {a, b as c} from 'd'
          // //=> const {a, c: b} = await import('d')
          // export * from 'a'
          // //=> const _exportAll0 = await import('a')
          // ```
          init = {
            type: 'AwaitExpression',
            argument: create(node, {
              type: 'ImportExpression',
              source: node.source
            })
          }

          if (
            (node.type === 'ImportDeclaration' ||
              node.type === 'ExportNamedDeclaration') &&
            node.specifiers.length === 0
          ) {
            replace = {type: 'ExpressionStatement', expression: init}
          } else {
            replace = {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id:
                    node.type === 'ImportDeclaration' ||
                    node.type === 'ExportNamedDeclaration'
                      ? specifiersToObjectPattern(node.specifiers)
                      : {
                          type: 'Identifier',
                          name: '_exportAll' + ++exportAllCount
                        },
                  init
                }
              ]
            }
          }
        } else if (node.declaration) {
          replace = node.declaration
        } else {
          declarators = node.specifiers
            .filter(
              (specifier) => specifier.local.name !== specifier.exported.name
            )
            .map((specifier) => ({
              type: 'VariableDeclarator',
              id: specifier.exported,
              init: specifier.local
            }))

          if (declarators.length > 0) {
            replace = {
              type: 'VariableDeclaration',
              kind: 'const',
              declarations: declarators
            }
          }
        }
      } else {
        replace = node
      }

      if (replace) {
        replacement.push(replace)
      }
    }
  }

  /**
   * @param {Expression} [content]
   * @returns {FunctionDeclaration}
   */
  function createMdxContent(content) {
    /** @type {JSXElement} */
    var element = {
      type: 'JSXElement',
      openingElement: {
        type: 'JSXOpeningElement',
        name: {type: 'JSXIdentifier', name: 'MDXLayout'},
        attributes: [
          {
            type: 'JSXSpreadAttribute',
            argument: {type: 'Identifier', name: 'props'}
          }
        ],
        selfClosing: false
      },
      closingElement: {
        type: 'JSXClosingElement',
        name: {type: 'JSXIdentifier', name: 'MDXLayout'}
      },
      children: [
        {
          type: 'JSXExpressionContainer',
          expression: {type: 'Identifier', name: '_content'}
        }
      ]
    }
    /** @type {Expression} */
    // @ts-ignore types are wrong: `JSXElement` is an `Expression`.
    var consequent = element

    return {
      type: 'FunctionDeclaration',
      id: {type: 'Identifier', name: 'MDXContent'},
      params: [{type: 'Identifier', name: 'props'}],
      body: {
        type: 'BlockStatement',
        body: [
          {
            type: 'VariableDeclaration',
            kind: 'const',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: {type: 'Identifier', name: '_content'},
                init: content || {type: 'Literal', value: null}
              }
            ]
          },
          {
            type: 'ReturnStatement',
            argument: {
              type: 'ConditionalExpression',
              test: {type: 'Identifier', name: 'MDXLayout'},
              consequent,
              alternate: {type: 'Identifier', name: '_content'}
            }
          }
        ]
      }
    }
  }
}
