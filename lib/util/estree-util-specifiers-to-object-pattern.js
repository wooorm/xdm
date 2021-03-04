import u from 'unist-builder'
import {create} from './estree-util-create.js'

/**
 * @typedef {import('estree').ImportSpecifier} ImportSpecifier
 * @typedef {import('estree').ImportDefaultSpecifier} ImportDefaultSpecifier
 * @typedef {import('estree').ImportNamespaceSpecifier} ImportNamespaceSpecifier
 * @typedef {import('estree').ExportSpecifier} ExportSpecifier
 *
 * @param {Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier | ExportSpecifier>} specifiers
 * @returns {import('estree').ObjectPattern}
 */
export function specifiersToObjectPattern(specifiers) {
  return u('ObjectPattern', {
    properties: specifiers.map((specifier) => {
      var key =
        'imported' in specifier
          ? specifier.imported
          : 'exported' in specifier
          ? specifier.exported
          : u('Identifier', {name: 'default'})
      return create(
        specifier,
        u('Property', {
          kind: 'init',
          shorthand: key.name === specifier.local.name,
          method: false,
          computed: false,
          key,
          value: specifier.local
        })
      )
    })
  })
}
