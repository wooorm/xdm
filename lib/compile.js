import vfile from 'vfile'
import {createProcessor} from './core.js'

/**
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('./core').ProcessorOptions} ProcessorOptions
 */

/**
 * Compile MDX to JS.
 *
 * @param {VFileCompatible} vfileCompatible MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorOptions} [options]
 * @return {Promise<VFile>}
 */
export function compile(vfileCompatible, options) {
  var {settings, file} = configure(vfileCompatible, options)
  return createProcessor(settings).process(file)
}

/**
 * Synchronously compile MDX to JS.
 *
 * @param {VFileCompatible} vfileCompatible MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorOptions} [options]
 * @return {VFile}
 */
export function compileSync(vfileCompatible, options) {
  var {settings, file} = configure(vfileCompatible, options)
  return createProcessor(settings).processSync(file)
}

function configure(vfileCompatible, options) {
  return {file: vfile(vfileCompatible), settings: options || {}}
}
