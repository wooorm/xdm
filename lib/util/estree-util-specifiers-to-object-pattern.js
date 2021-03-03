import u from 'unist-builder'
import {create} from './estree-util-create.js'

export function specifiersToObjectPattern(specifiers) {
  return u('ObjectPattern', {
    properties: specifiers.map((specifier) => {
      var key =
        specifier.imported ||
        specifier.exported ||
        u('Identifier', {name: 'default'})
      return create(
        specifier,
        u('Property', {
          kind: 'init',
          shorthand: key.name === specifier.local.name,
          key,
          value: specifier.local
        })
      )
    })
  })
}
