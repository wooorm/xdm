import build from 'estree-util-build-jsx'
import u from 'unist-builder'

/**
 * @typedef {import("estree").Program} Program
 *
 * @typedef RecmaJsxBuildOptions
 * @property {boolean} [_contain] Semihidden option which here results in getting the automatic runtime from `arguments[0]` instead of importing it
 */

/**
 * A plugin to build JSX into function calls.
 * `estree-util-build-jsx` does all the work for us!
 *
 * @param {RecmaJsxBuildOptions} [options]
 */
export function recmaJsxBuild(options = {}) {
  var {_contain} = options

  return transform

  /**
   * @param {Program} tree
   */
  function transform(tree) {
    build(tree)

    // In contain mode, replace the import that was just generated, and get
    // `jsx`, `jsxs`, and `Fragment` from `arguments[0]` instead.
    if (
      _contain &&
      tree.body[0] &&
      tree.body[0].type === 'ImportDeclaration' &&
      typeof tree.body[0].source.value === 'string' &&
      /\/jsx-runtime$/.test(tree.body[0].source.value)
    ) {
      // @ts-ignore assume this is not missing properties
      tree.body[0] = u('VariableDeclaration', {
        kind: 'const',
        declarations: [
          u('VariableDeclarator', {
            id: u('ObjectPattern', {
              properties: tree.body[0].specifiers.map((specifier) =>
                u('Property', {
                  kind: 'init',
                  shorthand: false,
                  // @ts-ignore assume specifier is not a default export
                  key: specifier.imported,
                  value: specifier.local
                })
              )
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
  }
}
