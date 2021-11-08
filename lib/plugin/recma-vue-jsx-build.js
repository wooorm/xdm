import {walk} from 'estree-walker'
import {name as isValidIdentifier} from 'estree-util-is-identifier-name'

/**
 * @typedef {import('estree-jsx').Node} Node
 * @typedef {import('estree-jsx').Comment} Comment
 * @typedef {import('estree-jsx').Expression} Expression
 * @typedef {import('estree-jsx').Pattern} Pattern
 * @typedef {import('estree-jsx').Property} Property
 * @typedef {import('estree-jsx').ImportSpecifier} ImportSpecifier
 * @typedef {import('estree-jsx').SpreadElement} SpreadElement
 * @typedef {import('estree-jsx').MemberExpression} MemberExpression
 * @typedef {import('estree-jsx').CallExpression} CallExpression
 * @typedef {import('estree-jsx').Literal} Literal
 * @typedef {import('estree-jsx').Identifier} Identifier
 * @typedef {import('estree-jsx').JSXElement} JSXElement
 * @typedef {import('estree-jsx').JSXFragment} JSXFragment
 * @typedef {import('estree-jsx').JSXText} JSXText
 * @typedef {import('estree-jsx').JSXExpressionContainer} JSXExpressionContainer
 * @typedef {import('estree-jsx').JSXEmptyExpression} JSXEmptyExpression
 * @typedef {import('estree-jsx').JSXSpreadChild} JSXSpreadChild
 * @typedef {import('estree-jsx').JSXAttribute} JSXAttribute
 * @typedef {import('estree-jsx').JSXSpreadAttribute} JSXSpreadAttribute
 * @typedef {import('estree-jsx').JSXMemberExpression} JSXMemberExpression
 * @typedef {import('estree-jsx').JSXNamespacedName} JSXNamespacedName
 * @typedef {import('estree-jsx').JSXIdentifier} JSXIdentifier
 *
 * @typedef {import('estree-walker').SyncHandler} SyncHandler
 */

/**
 * @typedef {import('estree-jsx').Program} Program
 */

/**
 * A plugin to build JSX into Vue createVNode function calls.
 *
 * @type {import('unified').Plugin<[], Program>}
 */
export function recmaVueJsxBuild() {
  return (tree) => buildJsx(tree)
}

/**
 * @template {Node} T
 * @param {T} tree
 * @returns {T}
 */
export function buildJsx(tree) {
  const identifiers = new Set()
  /** @type {Record<string, string>} */
  const vueApiMethods = { defineComponent: 'defineComponent' }

  /**
   * @param {string} methodName
   * @returns {MemberExpression|Literal|Identifier}
   */
  function useVueApi (methodName) {
    const name = vueApiMethods[methodName] ||= `_${methodName}`
    return { type: 'Identifier', name }
  }

  /**
   * @param {Pattern} id
   */
  function addPatternIdentifiers (id) {
    if (id.type === 'ObjectPattern')
      id.properties.forEach(p => {
        addPatternIdentifiers(p.type === 'Property' ? p.value : p.argument)
      })
    else if (id.type === 'ArrayPattern')
      id.elements.forEach(e => { if(e) addPatternIdentifiers(e) })
    else if (id.type === 'RestElement')
      addPatternIdentifiers(id.argument)
    else if ('name' in id)
      identifiers.add(id.name)
  }

  walk(tree, {
    // @ts-expect-error: types are wrong.
    // eslint-disable-next-line complexity
    enter(/** @type {Node} */ node) {
      if (node.type === 'ImportDeclaration')
        node.specifiers.forEach(s => identifiers.add(s.local.name))
      else if (node.type === 'VariableDeclaration')
        node.declarations.forEach(({ id }) => addPatternIdentifiers(id))
    },

    // @ts-expect-error: types are wrong.
    // eslint-disable-next-line complexity
    leave(/** @type {Node} */ node) {
      if (node.type === 'Program') {
        const usedMethods = Object.entries(vueApiMethods)
        node.body.unshift({
          type: 'ImportDeclaration',
          source: { type: 'Literal', value: 'vue' },
          specifiers: usedMethods.map(([importedName, localName]) => ({
            type: 'ImportSpecifier',
            imported: {type: 'Identifier', name: importedName},
            local: {type: 'Identifier', name: localName},
          })),
        })
        return
      }

      if (node.type !== 'JSXElement' && node.type !== 'JSXFragment') {
        return
      }

      /** @type {Array.<Expression>} */
      const children = []
      let index = -1

      // Figure out `children`.
      while (++index < node.children.length) {
        const child = node.children[index]

        if (child.type === 'JSXExpressionContainer') {
          // Ignore empty expressions.
          if (child.expression.type !== 'JSXEmptyExpression') {
            if (child.expression.type === 'Literal' && typeof child.expression.value === 'string')
              // @ts-ignore
              children.push(create(child.expression, {
                type: 'CallExpression',
                callee: useVueApi('createTextVNode'),
                arguments: [child.expression],
                optional: false,
              }))
            else
              children.push(child.expression)
          }
        } else if (child.type === 'JSXText') {
          const value = child.value
            // Replace tabs w/ spaces.
            .replace(/\t/g, ' ')
            // Use line feeds, drop spaces around them.
            .replace(/ *(\r?\n|\r) */g, '\n')
            // Collapse multiple line feeds.
            .replace(/\n+/g, '\n')
            // Drop final line feeds.
            .replace(/\n+$/, '')
            // Replace line feeds with spaces.
            .replace(/\n/g, ' ')

          // Ignore collapsible text.
          if (value) {
            const textLiteral = create(child, {type: 'Literal', value})
            // @ts-ignore
            children.push(create(child, {
              type: 'CallExpression',
              callee: useVueApi('createTextVNode'),
              arguments: [textLiteral],
              optional: false,
            }))
          }
        } else {
          // @ts-ignore JSX{Element,Fragment} have already been compiled, and
          // `JSXSpreadChild` is not supported in Babel either, so ignore it.
          children.push(child)
        }
      }

      /** @type {MemberExpression|Literal|Identifier|CallExpression} */
      let component
      /** @type {Array.<Property|SpreadElement>} */
      let fields = []
      /** @type {JSXAttribute['value']|null} */
      let vSlots = null

      const isFragment = node.type === 'JSXFragment'

      if (!isFragment) {
        component = toIdentifier(node.openingElement.name)

        // If the name could be an identifier, but start with a lowercase letter,
        // it’s not a component.
        if (component.type === 'Identifier' && /^[a-z]/.test(component.name)) {
          component = create(component, {type: 'Literal', value: component.name})
        }
        else if (component.type === 'Identifier' && !identifiers.has(component.name)) {
          component = {
            type: 'CallExpression',
            callee: useVueApi('resolveComponent'),
            arguments: [{type:'Literal', value: component.name}],
            optional: false,
          }
        }

        const attributes = node.openingElement.attributes
        let index = -1

        // Place props in the right order, because we might have duplicates
        // in them and what’s spread in.
        while (++index < attributes.length) {
          const attribute = attributes[index]

          if (attribute.type === 'JSXSpreadAttribute') {
            console.log('spread attribute', attribute)
            fields.push({
              type: 'SpreadElement',
              argument: attribute.argument
            })
          }
          else if (attribute.name.name === 'v-slots') {
            console.log('v-slots', vSlots = attribute.value?.expression)
          }
          else {
            fields.push(toProperty(attribute))
          }
        }
      }

      /**
       * @type {Literal}
       */
      const empty = {type: 'Literal', value: null}

      /** @type {Expression|undefined} */
      let props

      if (fields.length === 0) {
        props = undefined
      }
      else if (fields.length === 1 && fields[0].type === 'SpreadElement') {
        console.log('simplifying', fields)
        props = fields[0].argument
      }
      else {
        props = { type: 'ObjectExpression', properties: fields }
      }

      const defaultSlot = children.length === 0
        ? undefined
        :
          isFragment
            ? { type: 'ArrayExpression', elements: children }
            : { type: 'ObjectExpression', properties: [
                createProperty({ type: 'Identifier', name: 'default' }, {
                  type: 'ArrowFunctionExpression',
                  expression: true,
                  generator: false,
                  async: false,
                  params: [],
                  body: { type: 'ArrayExpression', elements: children },
                })
              ] }

      function resolveSlots () {
        if (vSlots && defaultSlot) {
          defaultSlot.properties.push({ type: 'SpreadElement', argument: vSlots })
          return defaultSlot
        }
        return vSlots || defaultSlot
      }

      const slots = resolveSlots()

      this.replace(
        create(node, isFragment && !slots ? empty : {
          type: 'CallExpression',
          callee: useVueApi('createVNode'),
          arguments: [
            isFragment ? useVueApi('Fragment') : component,
            props || empty,
            slots || empty,
          ],
          optional: false
        })
      )
    }
  })

  return tree
}

/**
 * @param {JSXAttribute} node
 * @returns {Property}
 */
function toProperty(node) {
  /** @type {Expression} */
  let value

  if (node.value) {
    if (node.value.type === 'JSXExpressionContainer') {
      // @ts-ignore `JSXEmptyExpression` is not allowed in props.
      value = node.value.expression
    }
    // Literal or call expression.
    else {
      // @ts-ignore: JSX{Element,Fragment} are already compiled to
      // `CallExpression`.
      value = node.value
      // @ts-ignore - Remove `raw` so we don’t get character references in
      // strings.
      delete value.raw
    }
  }
  // Boolean prop.
  else {
    value = {type: 'Literal', value: true}
  }

  return create(node, createProperty(toIdentifier(node.name), value))
}

/**
 * @param {Expression} key
 * @param {Expression} value
 * @returns {Property}
 */
function createProperty (key, value) {
  return {
    type: 'Property',
    kind: 'init',
    key,
    value,
    method: false,
    shorthand: false,
    computed: false
  }
}

/**
 * @param {JSXMemberExpression|JSXNamespacedName|JSXIdentifier} node
 * @returns {MemberExpression|Identifier|Literal|CallExpression}
 */
function toIdentifier(node) {
  /** @type {MemberExpression|Identifier|Literal} */
  let replace

  if (node.type === 'JSXMemberExpression') {
    // `property` is always a `JSXIdentifier`, but it could be something that
    // isn’t an ES identifier name.
    const id = toIdentifier(node.property)
    replace = {
      type: 'MemberExpression',
      object: toIdentifier(node.object),
      property: id,
      computed: id.type === 'Literal',
      optional: false
    }
  } else if (node.type === 'JSXNamespacedName') {
    replace = {
      type: 'Literal',
      value: node.namespace.name + ':' + node.name.name
    }
  }
  // Must be `JSXIdentifier`.
  else {
    replace = isValidIdentifier(node.name)
      ? {type: 'Identifier', name: node.name}
      : {type: 'Literal', value: node.name}
  }

  return create(node, replace)
}

/**
 * @template {Node} T
 * @param {Node} from
 * @param {T} node
 * @returns {T}
 */
function create(from, node) {
  const fields = ['start', 'end', 'loc', 'range', 'comments']
  let index = -1

  while (++index < fields.length) {
    const field = fields[index]
    if (field in from) {
      // @ts-expect-error: indexable.
      node[field] = from[field]
    }
  }

  return node
}
