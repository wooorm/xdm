import {walk} from 'estree-walker'
import {create} from '../util/estree-util-create.js'
import {name as isValidIdentifier} from 'estree-util-is-identifier-name'

/**
 * @typedef {import('estree-jsx').Node} Node
 * @typedef {import('estree-jsx').Expression} Expression
 * @typedef {import('estree-jsx').Pattern} Pattern
 * @typedef {import('estree-jsx').Property} Property
 * @typedef {import('estree-jsx').ImportDeclaration} ImportDeclaration
 * @typedef {import('estree-jsx').SpreadElement} SpreadElement
 * @typedef {import('estree-jsx').MemberExpression} MemberExpression
 * @typedef {import('estree-jsx').ArrayExpression} ArrayExpression
 * @typedef {import('estree-jsx').ObjectExpression} ObjectExpression
 * @typedef {import('estree-jsx').CallExpression} CallExpression
 * @typedef {import('estree-jsx').Literal} Literal
 * @typedef {import('estree-jsx').Identifier} Identifier
 * @typedef {import('estree-jsx').JSXElement} JSXElement
 * @typedef {import('estree-jsx').JSXFragment} JSXFragment
 * @typedef {import('estree-jsx').JSXAttribute} JSXAttribute
 * @typedef {import('estree-jsx').JSXMemberExpression} JSXMemberExpression
 * @typedef {import('estree-jsx').JSXNamespacedName} JSXNamespacedName
 * @typedef {import('estree-jsx').JSXIdentifier} JSXIdentifier
 */

/**
 * @typedef {import('estree-jsx').Program} Program
 */

/**
 * @typedef {[Identifier|Literal|MemberExpression|CallExpression,Expression,Expression]} CreateVNode
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
   * @returns {Identifier}
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
    enter(/** @type {Node} */ node) {
      if (node.type === 'ImportDeclaration')
        node.specifiers.forEach(s => identifiers.add(s.local.name))
      else if (node.type === 'VariableDeclaration')
        node.declarations.forEach(({ id }) => addPatternIdentifiers(id))
    },

    // @ts-expect-error: types are wrong.
    // eslint-disable-next-line complexity
    leave(/** @type {Node} */ node) {
      if (node.type === 'Program')
        return node.body.unshift(importVueApiMethods(vueApiMethods))

      if (node.type !== 'JSXElement' && node.type !== 'JSXFragment')
        return

      const isFragment = node.type === 'JSXFragment'

      /** @type {Literal} */
      const empty = {type: 'Literal', value: null}

      const children = resolveChildren(node, useVueApi)

      /** @param {CreateVNode} parameters */
      const replaceWithCreateVNode = (parameters) =>
        this.replace(create(node, {
          type: 'CallExpression',
          callee: useVueApi('createVNode'),
          arguments: parameters,
          optional: false
        }))

      if (isFragment)
        return children
          ? replaceWithCreateVNode([useVueApi('Fragment'), empty, { type: 'ArrayExpression', elements: children }])
          : this.replace(create(node, empty))

      const component = resolveComponent(node, identifiers, useVueApi)
      const [props, vSlots] = resolveProps(node)
      const slots = resolveSlots(children, vSlots)
      replaceWithCreateVNode([component, props || empty, slots || empty])
    }
  })

  return tree
}

/**
 * @param  {JSXElement} node
 * @param {Set<string>} identifiers
 * @param  {(name: string) => Identifier} useVueApi
 * @return {Literal|MemberExpression|Identifier|CallExpression}
 */
function resolveComponent (node, identifiers, useVueApi) {
  const component = toIdentifier(node.openingElement.name)

  // Force lowercase tags to be to plain html tags.
  if (component.type === 'Identifier' && /^[a-z]/.test(component.name))
    return create(component, {type: 'Literal', value: component.name})

  if (component.type === 'Identifier' && !identifiers.has(component.name)) {
    return {
      type: 'CallExpression',
      callee: useVueApi('resolveComponent'),
      arguments: [{type:'Literal', value: component.name}],
      optional: false,
    }
  }

  return component
}

/**
 * @param {JSXElement} node
 */
function resolveProps (node) {
  /** @type {Array.<Property|SpreadElement>} */
  let fields = []

  /** @type {Expression | undefined} */
  let vSlots

  // Place props in the right order, because we might have duplicates
  // in them and what’s spread in.
  node.openingElement.attributes.forEach(attribute => {
    if (attribute.type === 'JSXSpreadAttribute')
      fields.push({ type: 'SpreadElement', argument: attribute.argument })
    else if (attribute.name.name === 'v-slots')
      vSlots = attribute.value && 'expression' in attribute.value && attribute.value.expression.type !== 'JSXEmptyExpression' ? attribute.value.expression : undefined
    else
      fields.push(toProperty(attribute))
  })

  /** @type {Expression|undefined} */
  let props

  if (fields.length === 1 && fields[0].type === 'SpreadElement') {
    props = fields[0].argument
  }
  else if (fields.length > 0) {
    props = { type: 'ObjectExpression', properties: fields }
  }

  return [props, vSlots]
}

/**
 * @param  {JSXElement|JSXFragment} node
 * @param  {(name: string) => Identifier} useVueApi
 * @return {Array.<Expression>|undefined}
 */
function resolveChildren ({ children: nodeChildren }, useVueApi) {
  const { length } = nodeChildren

  /** @type {Array.<Expression>} */
  let resolved = []

  for (let i = 0; i < nodeChildren.length; i++) {
    const child = nodeChildren[i]

    if (child.type === 'JSXExpressionContainer') {
      // Ignore empty expressions.
      if (child.expression.type !== 'JSXEmptyExpression') {
        if (child.expression.type === 'Literal' && typeof child.expression.value === 'string')
          // @ts-ignore
          resolved.push(create(child.expression, {
            type: 'CallExpression',
            callee: useVueApi('createTextVNode'),
            arguments: [child.expression],
            optional: false,
          }))
        else
          resolved.push(child.expression)
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
        resolved.push(create(child, {
          type: 'CallExpression',
          callee: useVueApi('createTextVNode'),
          arguments: [textLiteral],
          optional: false,
        }))
      }
    } else {
      // @ts-ignore
      resolved.push(child)
    }
  }
  return resolved.length > 0 ? resolved : undefined
}

/**
 * @param  {Record<string, string>} methodMappings
 * @return {ImportDeclaration}
 */
function importVueApiMethods (/** @type {Record<string, string>} **/ methodMappings) {
  return {
    type: 'ImportDeclaration',
    source: { type: 'Literal', value: 'vue' },
    specifiers: Object.entries(methodMappings).map(([importedName, localName]) => ({
      type: 'ImportSpecifier',
      imported: {type: 'Identifier', name: importedName},
      local: {type: 'Identifier', name: localName},
    })),
  }
}

/**
 * @param {Array.<Expression>|undefined} children
 * @param {Expression|undefined} vSlots
 * @return {Expression|undefined}
 */
function resolveSlots (children, vSlots) {
  if (!children) return vSlots
  const defaultSlot = createDefaultSlotFn(children)
  if (vSlots) defaultSlot.properties.push({ type: 'SpreadElement', argument: vSlots })
  return defaultSlot
}

/**
 * @param  {Array.<Expression>} children
 * @return {ObjectExpression}
 */
function createDefaultSlotFn (children) {
  return {
    type: 'ObjectExpression',
    properties: [
      createProperty({ type: 'Identifier', name: 'default' }, {
        type: 'ArrowFunctionExpression',
        expression: true,
        generator: false,
        async: false,
        params: [],
        body: { type: 'ArrayExpression', elements: children },
      })
    ]
  }
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
