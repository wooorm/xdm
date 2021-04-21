import {u} from 'unist-builder'
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
  return {
    type: 'ObjectPattern',
    properties: specifiers.map((specifier) => {
      var key =
        'imported' in specifier
          ? specifier.imported
          : 'exported' in specifier
          ? specifier.exported
          : u('Identifier', {name: 'default'})
      var value = specifier.local

      if (specifier.type === 'ExportSpecifier') {
        value = key
        key = specifier.local
      }

      return create(specifier, {
        type: 'Property',
        kind: 'init',
        shorthand: key.name === value.name,
        method: false,
        computed: false,
        key,
        value
      })
    })
  }
}
