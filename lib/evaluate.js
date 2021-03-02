import {compile, compileSync} from './core.js'

/* c8 ignore next 1 */
async function f() {}

/**
 * @typedef {import("vfile").VFileCompatible} VFileCompatible
 * @typedef {import('./core.js').BaseProcessorOptions} BaseProcessorOptions
 *
 * @typedef RunnerOptions
 * @property {*} Fragment Symbol to use for fragments
 * @property {*} jsx Function to generate an element with static children
 * @property {*} jsxs Function to generate an element with dynamic children
 * @property {*} [useMDXComponents] Function to get `MDXComponents` from context
 *
 * @typedef {Omit<BaseProcessorOptions, "jsx" | "_contain" | "_async"> } ProcessorOptions
 * @typedef {ProcessorOptions & RunnerOptions} ProcessorAndRunnerOptions
 *
 * @typedef {{ [name: string]: any }} ComponentMap
 * @typedef {{ [props: string]: any, components?: ComponentMap }} MDXContentProps
 * @typedef {{ [exports: string]: unknown, default: (props: MDXContentProps) => any }} ExportMap
 */

/**
 * Evaluate MDX.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorAndRunnerOptions} options
 * @return {Promise<ExportMap>}
 */
export async function evaluate(file, options) {
  var config = split({...options, _async: true})
  // What is this?
  // V8 on Node 12 can’t handle `eval` for collecting coverage, apparently…
  /* c8 ignore next 4 */
  return new f.constructor(String(await compile(file, config.compile)))(
    config.run
  )
}

/**
 * Synchronously evaluate MDX.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorAndRunnerOptions} options
 * @return {ExportMap}
 */
export function evaluateSync(file, options) {
  var config = split(options)
  return new Function(String(compileSync(file, config.compile)))(config.run)
}

/**
 * Split processor/compiler options from runner options.
 *
 * @param {ProcessorAndRunnerOptions} options
 */
function split(options) {
  var {
    Fragment,
    jsx,
    jsxs,
    recmaPlugins,
    rehypePlugins,
    remarkPlugins,
    useMDXComponents,
    _async
  } = options || {}

  if (!Fragment) throw new Error('Expected `Fragment` given to `evaluate`')
  if (!jsx) throw new Error('Expected `jsx` given to `evaluate`')
  if (!jsxs) throw new Error('Expected `jsxs` given to `evaluate`')

  return {
    compile: {
      _contain: true,
      _async,
      providerImportSource: useMDXComponents ? '#' : undefined,
      recmaPlugins,
      rehypePlugins,
      remarkPlugins
    },
    run: {Fragment, jsx, jsxs, useMDXComponents}
  }
}
