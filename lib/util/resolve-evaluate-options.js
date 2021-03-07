/**
 * @typedef {import('../core.js').ProcessorOptions} ProcessorOptions
 *
 * @typedef RunnerOptions
 * @property {*} Fragment Symbol to use for fragments
 * @property {*} jsx Function to generate an element with static children
 * @property {*} jsxs Function to generate an element with dynamic children
 * @property {*} [useMDXComponents] Function to get `MDXComponents` from context
 *
 * @typedef {Omit<ProcessorOptions, 'jsx' | 'jsxImportSource' | 'jsxRuntime' | 'pragma' | 'pragmaFrag' | 'pragmaImportSource' | 'providerImportSource' | '_contain'> } EvaluateProcessorOptions
 *
 * @typedef ExtraOptions
 * @property {string} baseUrl URL to resolve imports from (typically: pass `import.meta.url`)
 *
 * @typedef {EvaluateProcessorOptions & RunnerOptions & ExtraOptions} EvaluateOptions
 */

/**
 * Split compiletime options from runtime options.
 *
 * @param {EvaluateOptions} options
 * @returns {{compiletime: ProcessorOptions, runtime: RunnerOptions}}
 */
export function resolveEvaluateOptions(options) {
  var {Fragment, jsx, jsxs, useMDXComponents, ...rest} = options || {}

  if (!Fragment) throw new Error('Expected `Fragment` given to `evaluate`')
  if (!jsx) throw new Error('Expected `jsx` given to `evaluate`')
  if (!jsxs) throw new Error('Expected `jsxs` given to `evaluate`')

  return {
    compiletime: {
      ...rest,
      _contain: true,
      providerImportSource: useMDXComponents ? '#' : undefined
    },
    runtime: {Fragment, jsx, jsxs, useMDXComponents}
  }
}
