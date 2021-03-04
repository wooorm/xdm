import {compile, compileSync} from './compile.js'
import {run, runSync} from './run.js'

/**
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('./core.js').BaseProcessorOptions} BaseProcessorOptions
 *
 * @typedef RunnerOptions
 * @property {*} Fragment Symbol to use for fragments
 * @property {*} jsx Function to generate an element with static children
 * @property {*} jsxs Function to generate an element with dynamic children
 * @property {*} [useMDXComponents] Function to get `MDXComponents` from context
 *
 * @typedef {Omit<BaseProcessorOptions, 'jsx' | '_contain' | '_baseUrl'> } ProcessorOptions
 *
 * @typedef ExtraOptions
 * @property {string} baseUrl URL to resolve imports from (typically: pass `import.meta.url`)
 *
 * @typedef {ProcessorOptions & RunnerOptions & ExtraOptions} EvaluateOptions
 *
 * @typedef {{[name: string]: any}} ComponentMap
 * @typedef {{[props: string]: any, components?: ComponentMap}} MDXContentProps
 * @typedef {{[exports: string]: unknown, default: (props: MDXContentProps) => any}} ExportMap
 */

/**
 * Evaluate MDX.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {EvaluateOptions} options
 * @return {Promise<ExportMap>}
 */
export async function evaluate(file, options) {
  var config = split(options)
  // V8 on Erbium.
  /* c8 ignore next 2 */
  return run(await compile(file, config.compile), config.run)
}

/**
 * Synchronously evaluate MDX.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {EvaluateOptions} options
 * @return {ExportMap}
 */
export function evaluateSync(file, options) {
  var config = split(options)
  return runSync(compileSync(file, config.compile), config.run)
}

/**
 * Split processor/compiler options from runner options.
 *
 * @param {EvaluateOptions} options
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
