import {createProcessor} from './core.js'
import {resolveFileAndOptions} from './util/resolve-file-and-options.js'

/**
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('./core').PluginOptions} PluginOptions
 * @typedef {import('./core').BaseProcessorOptions} BaseProcessorOptions
 * @typedef {Omit<BaseProcessorOptions, 'format'>} CoreProcessorOptions
 *
 * @typedef ExtraOptions
 * @property {'detect' | 'mdx' | 'md'} [format='detect'] Format of `file`
 *
 * @typedef {CoreProcessorOptions & PluginOptions & ExtraOptions} CompileOptions
 */

/**
 * Compile MDX to JS.
 *
 * @param {VFileCompatible} vfileCompatible MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {CompileOptions} [compileOptions]
 * @return {Promise<VFile>}
 */
export function compile(vfileCompatible, compileOptions) {
  var {file, options} = resolveFileAndOptions(vfileCompatible, compileOptions)
  return createProcessor(options).process(file)
}

/**
 * Synchronously compile MDX to JS.
 *
 * @param {VFileCompatible} vfileCompatible MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {CompileOptions} [compileOptions]
 * @return {VFile}
 */
export function compileSync(vfileCompatible, compileOptions) {
  var {file, options} = resolveFileAndOptions(vfileCompatible, compileOptions)
  return createProcessor(options).processSync(file)
}
