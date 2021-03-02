import {compile, compileSync} from './core.js'

/* c8 ignore next 1 */
var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

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
 * @typedef {Omit<BaseProcessorOptions, "jsx" | "_async" | "_contain" | "_baseUrl"> } ProcessorOptions
 *
 * @typedef ExtraOptions
 * @property {string} baseUrl URL to resolve imports from (typically: pass `import.meta.url`)
 *
 * @typedef {ProcessorOptions & RunnerOptions & ExtraOptions} ProcessorAndRunnerOptions
 *
 * @typedef {{[name: string]: any}} ComponentMap
 * @typedef {{[props: string]: any, components?: ComponentMap}} MDXContentProps
 * @typedef {{[exports: string]: unknown, default: (props: MDXContentProps) => any}} ExportMap
 */

/**
 * Evaluate MDX.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorAndRunnerOptions} options
 * @return {Promise<ExportMap>}
 */
export async function evaluate(file, options) {
  var config = split(options)
  var _async = Boolean(config.compile._baseUrl)
  // What is this?
  // V8 on Node 12 can’t handle `eval` for collecting coverage, apparently…
  /* c8 ignore next 4 */
  return new AsyncFunction(
    String(await compile(file, {...config.compile, _async}))
  )(config.run)
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
    baseUrl
  } = options || {}

  if (!Fragment) throw new Error('Expected `Fragment` given to `evaluate`')
  if (!jsx) throw new Error('Expected `jsx` given to `evaluate`')
  if (!jsxs) throw new Error('Expected `jsxs` given to `evaluate`')

  return {
    compile: {
      _contain: true,
      _baseUrl: baseUrl,
      providerImportSource: useMDXComponents ? '#' : undefined,
      recmaPlugins,
      rehypePlugins,
      remarkPlugins
    },
    run: {Fragment, jsx, jsxs, useMDXComponents}
  }
}
