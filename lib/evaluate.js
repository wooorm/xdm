import {compile, compileSync} from './core.js'

/* eslint-disable no-new-func */

/**
 * @typedef {import("vfile").VFileCompatible} VFileCompatible
 * @typedef {import("unified").Pluggable} Pluggable
 * @typedef {import('./core.js').ProcessorOptions} ProcessorOptions
 *
 * @typedef RunnerOptions
 * @property {*} [Fragment]
 * @property {*} [jsxs]
 * @property {*} [recastPlugins]
 * @property {*} [useMDXComponents]
 *
 * @typedef {ProcessorOptions & RunnerOptions} ProcessorAndRunnerOptions
 * @typedef {{ [name: string]: any }} ComponentMap
 * @typedef {{ [props: string]: any, components?: ComponentMap }} XDMProps
 * @typedef {{ [exports: string]: unknown, default: (props: XDMProps) => any }} ExportMap
 */

/**
 *
 * @param {VFileCompatible} file
 * @param {ProcessorAndRunnerOptions} [options]
 * @return {Promise<ExportMap>}
 */
export async function evaluate(file, options) {
  var config = split(options)
  // What is this?
  // V8 on Node 12 can’t handle `eval` for collecting coverage, apparently…
  /* c8 ignore next 2 */
  return new Function((await compile(file, config.compile)).toString())(
    config.run
  )
}

/**
 *
 * @param {VFileCompatible} file
 * @param {ProcessorAndRunnerOptions} [options]
 * @return {ExportMap}
 */
export function evaluateSync(file, options) {
  var config = split(options)
  return new Function(compileSync(file, config.compile).toString())(config.run)
}
/* eslint-enable no-new-func */

/**
 * split processor/compiler options from runner options
 *
 * @param {ProcessorAndRunnerOptions} [options]
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
