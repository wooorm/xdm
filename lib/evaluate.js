import {compile, compileSync} from './core.js'

/**
 * @typedef {import("vfile").VFileCompatible} VFileCompatible
 * @typedef {import('./core.js').BaseProcessorOptions} BaseProcessorOptions
 *
 * @typedef RunnerOptions
 * @property {*} [Fragment]
 * @property {*} [jsx]
 * @property {*} [jsxs]
 * @property {*} [useMDXComponents]
 *
 * @typedef {Omit<BaseProcessorOptions, "jsx" | "_contain"> } ProcessorOptions
 * @typedef {ProcessorOptions & RunnerOptions} ProcessorAndRunnerOptions
 *
 * @typedef {{ [name: string]: any }} ComponentMap
 * @typedef {{ [props: string]: any, components?: ComponentMap }} MDXContentProps
 * @typedef {{ [exports: string]: unknown, default: (props: MDXContentProps) => any }} ExportMap
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
  return new Function(String(await compile(file, config.compile)))(config.run)
}

/**
 *
 * @param {VFileCompatible} file
 * @param {ProcessorAndRunnerOptions} [options]
 * @return {ExportMap}
 */
export function evaluateSync(file, options) {
  var config = split(options)
  return new Function(String(compileSync(file, config.compile)))(config.run)
}

/**
 * Split processor/compiler options from runner options
 *
 * @param {ProcessorAndRunnerOptions} [options]
 */
function split(options = {}) {
  var {
    Fragment,
    jsx,
    jsxs,
    recmaPlugins,
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
      recmaPlugins,
      rehypePlugins,
      remarkPlugins
    },
    run: {Fragment, jsx, jsxs, useMDXComponents}
  }
}
