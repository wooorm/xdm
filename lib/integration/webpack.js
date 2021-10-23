/**
 * @typedef {import('webpack').LoaderContext<unknown>} LoaderContext
 * @typedef {import('../compile.js').CompileOptions} CompileOptions
 */

import {compile} from '../compile.js'

/**
 * A Webpack (4+) loader for xdm.
 * See `webpack.cjs`, which wraps this, because Webpack loaders must currently
 * be CommonJS.
 * `file.map` is defined when a `SourceMapGenerator` is passed in options.
 *
 * @this {LoaderContext}
 * @param {string} value
 * @param {(error: Error|null|undefined, content?: string|Buffer, map?: Object) => void} callback
 */
export function loader(value, callback) {
  const options = /** @type {CompileOptions} */ (this.getOptions())
  compile({value, path: this.resourcePath}, options).then((file) => {
    // @ts-expect-error conflict between UInt8Array and Buffer is expected, and a tradeoff made in vfile typings to avoid `@types/node` being required
    callback(null, file.value, file.map)
    return file
  }, callback)
}
