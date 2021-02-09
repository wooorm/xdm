import {compile, compileSync} from './core.js'

/* eslint-disable no-new-func */

/**
 * @typedef {import("vfile").VFileCompatible} VFileCompatible 
 * @typedef {import("vfile").VFile} VFile 
 */

/**
 * 
 * @param {VFileCompatible} file 
 * @param {*} options 
 */
export async function evaluate(file, options) {
  var config = split(options)
  // What is this?
  // V8 on Node 12 can’t handle `eval` for collecting coverage, apparently…
  /* c8 ignore next 2 */
  return new Function((await compile(file, config.compile)).toString())(config.run)
}

/**
 * 
 * @param {VFileCompatible} file 
 * @param {*} options 
 */
export function evaluateSync(file, options) {
  var config = split(options)
  return new Function((compileSync(file, config.compile)).toString())(config.run)
}
/* eslint-enable no-new-func */

/**
 * 
 * @param {*} options 
 */
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
