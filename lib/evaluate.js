import {compile, compileSync} from './core.js'

/* eslint-disable no-new-func */
export async function evaluate(file, options) {
  var config = split(options)
  return new Function(await compile(file, config.compile))(config.run)
}

export function evaluateSync(file, options) {
  var config = split(options)
  return new Function(compileSync(file, config.compile))(config.run)
}
/* eslint-enable no-new-func */

function split(options = {}) {
  var {
    Fragment,
    jsx,
    jsxs,
    recastPlugins,
    rehypePlugins,
    remarkPlugins,
    useMDXComponents
  } = options

  if (!Fragment) throw new Error('Expected `Fragment` given to `evaluate`')
  if (!jsx) throw new Error('Expected `jsx` given to `evaluate`')
  if (!jsxs) throw new Error('Expected `jsxs` given to `evaluate`')

  return {
    compile: {
      _contain: true,
      providerImportSource: useMDXComponents ? '#' : undefined,
      recastPlugins,
      rehypePlugins,
      remarkPlugins
    },
    run: {Fragment, jsx, jsxs, useMDXComponents}
  }
}
