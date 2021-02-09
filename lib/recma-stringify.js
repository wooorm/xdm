import {baseGenerator, generate} from 'astring'
import stringifyEntities from 'stringify-entities/light.js'

// A small wrapper around `astring` to add support for serializing JSX.
/**
 *
 * @param {*} [options]
 */
export function recmaStringify(options) {
  var {SourceMapGenerator} = options

  this.Compiler = compiler

  function compiler(tree, file) {
    var sourceMap

    if (SourceMapGenerator) {
      sourceMap = new SourceMapGenerator({file: file.path || 'unknown.mdx'})
    }

    var result = generate(tree, {
      generator: Object.assign({}, baseGenerator, {
        JSXAttribute,
        JSXClosingElement,
        JSXClosingFragment,
        JSXElement,
        JSXEmptyExpression,
        JSXExpressionContainer,
        JSXFragment,
        JSXIdentifier,
        JSXMemberExpression,
        JSXNamespacedName,
        JSXOpeningElement,
        JSXOpeningFragment,
        JSXSpreadAttribute,
        JSXText
      }),
      comments: true,
      sourceMap
    })

    if (sourceMap) {
      file.map = sourceMap.toJSON()
    }

    return result
  }
}

// `attr="something"`
function JSXAttribute(node, state) {
  state.write(' ')
  this[node.name.type](node.name, state)

  if (node.value !== undefined && node.value !== null) {
    state.write('=')

    // Encode double quotes in attribute values.
    if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
      state.write(
        '"' + stringifyEntities(node.value.value, {subset: ['"']}) + '"',
        node
      )
    } else {
      this[node.value.type](node.value, state)
    }
  }
}

// `</div>`
function JSXClosingElement(node, state) {
  this[node.name.type](node.name, state)
}

// `</>`
function JSXClosingFragment(node, state) {
  state.write('</>', node)
}

// `<div></div>`
function JSXElement(node, state) {
  var index = -1

  state.write('<')
  this[node.openingElement.type](node.openingElement, state)
  if (node.closingElement) {
    state.write('>')

    while (++index < node.children.length) {
      this[node.children[index].type](node.children[index], state)
    }

    state.write('</')
    this[node.closingElement.type](node.closingElement, state)
    state.write('>')
  } else {
    state.write(' />')
  }
}

// `<></>`
function JSXFragment(node, state) {
  var index = -1

  this[node.openingFragment.type](node.openingElement, state)

  while (++index < node.children.length) {
    this[node.children[index].type](node.children[index], state)
  }

  // Incorrect tree potentially added by plugins.
  /* c8 ignore next 3 */
  if (!node.closingFragment) {
    throw new Error('Cannot handle fragment w/o closing tag')
  }

  this[node.closingFragment.type](node.closingElement, state)
}

// `{}`
function JSXEmptyExpression() {}

// `{expression}`
function JSXExpressionContainer(node, state) {
  state.write('{')
  this[node.expression.type](node.expression, state)
  state.write('}')
}

// `<div>`
function JSXOpeningElement(node, state) {
  var index = -1

  this[node.name.type](node.name, state)

  while (++index < node.attributes.length) {
    this[node.attributes[index].type](node.attributes[index], state)
  }
}

// `<>`
function JSXOpeningFragment(node, state) {
  state.write('<>', node)
}

// `div`
function JSXIdentifier(node, state) {
  state.write(node.name, node)
}

// `member.expression`
function JSXMemberExpression(node, state) {
  this[node.object.type](node.object, state)
  state.write('.')
  this[node.property.type](node.property, state)
}

// `ns:attr="something"`
function JSXNamespacedName(node, state) {
  this[node.namespace.type](node.namespace, state)
  state.write(':')
  this[node.name.type](node.name, state)
}

// `{...argument}`
function JSXSpreadAttribute(node, state) {
  state.write(' {')
  /* eslint-disable-next-line new-cap */
  this.SpreadElement(node, state)
  state.write('}')
}

// `!`
// But we always compile to expressions instead (`{"1"}`).
/* c8 ignore next 6 */
function JSXText(node, state) {
  // `raw` is currently always be set, but could be missing if something injects
  // a `JSXText` into the tree.
  // Preferring `raw` over `value` means character references are kept as-is.
  state.write(node.raw || node.value, node)
}
