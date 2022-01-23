/**
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('webpack').LoaderContext<unknown>} LoaderContext
 * @typedef {import('../compile.js').CompileOptions} CompileOptions
 * @typedef {Pick<CompileOptions, 'SourceMapGenerator'>} Defaults
 * @typedef {Omit<CompileOptions, 'SourceMapGenerator'>} Options
 * @typedef {(vfileCompatible: VFileCompatible) => Promise<VFile>} Process
 */

import {SourceMapGenerator} from 'source-map'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'

/** @type {WeakMap<CompileOptions, Process>} */
const cache = new WeakMap()

/**
 * A Webpack (4+) loader for xdm.
 * See `webpack.cjs`, which wraps this, because Webpack loaders must currently
 * be CommonJS.
 *
 * @this {LoaderContext}
 * @param {string} value
 * @param {(error: Error|null|undefined, content?: string|Buffer, map?: Object) => void} callback
 */
export function loader(value, callback) {
  /** @type {Defaults} */
  const defaults = this.sourceMap ? {SourceMapGenerator} : {}
  const options = /** @type {CompileOptions} */ (this.getOptions())
  const config = {...defaults, ...options}
  let process = cache.get(config)

  if (!process) {
    process = createFormatAwareProcessors(config).process
    cache.set(config, process)
  }

  process({value, path: this.resourcePath}).then((file) => {
    callback(null, file.value, file.map)
    return file
  }, callback)
}
