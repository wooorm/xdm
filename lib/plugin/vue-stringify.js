import {stringifyEntities} from 'stringify-entities'

const handlers = {
  comment,
  doctype,
  element,
  raw: text,
  root: all,
  text,
}

export function vueStringify(options = {}) {
  Object.assign(this, {Compiler: compiler})

  /**
   * @type {import('unified').CompilerFunction<Node, string>}
   */
  function compiler(tree, file) {
    const { sourceMap } = file
    const source = sourceMap?.file || sourceMap?._file

    const context = {
      sourceMap,
      addMapping,
      moveCurrentPosition,
      mapping: {
        original: null,
        generated: {
          line: 1,
          column: 0,
        },
        name: undefined,
        source,
      },
    }

    const result = one(context, tree, null, null)
    file.map = sourceMap?.toJSON()
    return result
  }
}

function addMapping (node) {
  const { mapping, sourceMap } = this
  const loc = node.position || node.loc
  if (loc) {
    mapping.original = loc.start
    if (node.type !== 'element') mapping.name = node.name
    sourceMap?.addMapping(mapping)
  }
}

function moveCurrentPosition (code) {
  const { length } = code
  const currentPosition = this.mapping.generated
  let { column, line } = currentPosition
  for (let i = 0; i < length; i++) {
    if (code[i] === '\n') {
      column = 0
      line++
    }
    else {
      column++
    }
  }
  currentPosition.column = column
  currentPosition.line = line
}

function one(ctx, node, index, parent) {
  if (!node || !node.type) {
    throw new Error('Expected node, not `' + node + '`')
  }

  const handler = handlers[node.type]
  if (typeof handler !== 'function') {
    throw new Error('Cannot compile unknown node `' + node.type + '`')
  }

  return handler(ctx, node, index, parent)
}

/**
 * Serialize all children of `parent`.
 *
 * @type {Handle}
 * @param {Parent} parent
 */
function all(ctx, parent) {
  /** @type {Array.<string>} */
  const results = []
  const children = (parent && parent.children) || []
  let index = -1

  while (++index < children.length) {
    results[index] = one(ctx, children[index], index, parent)
  }

  return results.join('')
}

function comment (_ctx, node, _, _parent) {
  return '<!--' + node.value + '-->'
}

function text (_ctx, node, _, parent) {
  // Check if content of `node` should be escaped.
  return parent && parent.type === 'element' && (parent.tagName === 'script' || parent.tagName === 'style')
    ? node.value
    : stringifyEntities(node.value, { subset: ['<', '&'] })
}

function serializeAttributes(props) {
  /** @type {Array.<string>} */
  const values = []
  for (let key in props) {
    let value = props[key]
    if (value === undefined || value === null) console.log('empty attr', { key, value })
    if (key === 'className') {
      key = 'class'
      value = Array.isArray(value) ? value.join(' ') : value
    }
    values.push(value === true ? key : `${key}="${stringifyEntities(String(value), { subset: ['"'] })}"`)
  }
  return values.join(' ')
}

function element(ctx, node, index, parent) {
  const attrs = serializeAttributes(node.properties)

  ctx.addMapping(node)

  let openingTag = attrs ? `<${node.tagName} ${attrs}` : `<${node.tagName}`

  if (node.children) {
    ctx.moveCurrentPosition(openingTag)
    const content = all(ctx, node)
    const closingTag = `>${content}</${node.tagName}>`
    ctx.moveCurrentPosition(closingTag)
    return `${openingTag}${closingTag}`
  }
  else {
    const fullTag = `${openingTag}/>`
    ctx.moveCurrentPosition(fullTag)
    return fullTag
  }
}

function doctype () {
  return '<!DOCTYPE html>'
}
