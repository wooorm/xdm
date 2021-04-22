import {getOptions} from 'loader-utils'
import {compile} from '../compile.js'

/**
 * A Webpack (4+) loader for xdm.
 * See `webpack.cjs`, which wraps this, because Webpack loaders must currently
 * be CommonJS.
 * `file.map` is defined when a `SourceMapGenerator` is passed in options.
 *
 * @param {string} value
 * @param {(error: Error|null|undefined, content?: string|Buffer, map?: Object) => void} callback
 */
export function loader(value, callback) {
  compile(
    // TS through JSDoc can’t handle `this`
    // type-coverage:ignore-next-line
    {contents: value, path: this.resourcePath},
    // TS through JSDoc can’t handle `this`
    // type-coverage:ignore-next-line
    {...getOptions(this)}
  ).then((file) => {
    // @ts-ignore conflict between UInt8Array and Buffer is expected, and a tradeoff made in vfile typings to avoid `@types/node` being required
    callback(null, file.contents, file.map)
    return file
  }, callback)
}
