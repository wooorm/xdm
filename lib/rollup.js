import path from 'path'
import {createFilter} from '@rollup/pluginutils'
import {compile} from './core.js'

/**
 * @typedef {import('./core.js').ProcessorOptions} ProcessorOptions
 * @typedef {import('@rollup/pluginutils').FilterPattern} FilterPattern
 * @typedef {import('rollup').Plugin} Plugin
 *
 * @typedef RollupPluginOptions
 * @property {FilterPattern} [include] List of picomatch patterns to include
 * @property {FilterPattern} [exclude] List of picomatch patterns to exclude
 * @property {Array.<string>} [extensions=['.mdx']] List of extensions to recognize (with `.`!)
 *
 * @typedef {ProcessorOptions & RollupPluginOptions} ProcessorAndRollupOptions
 */

/**
 * Compile MDX w/ rollup.
 *
 * @param {ProcessorAndRollupOptions} [options]
 * @return {Plugin}
 */
export function rollup(options = {}) {
  var filter = createFilter(options.include, options.exclude)
  var extensions = options.extensions || ['.mdx']

  return {
    name: 'xdm',
    // @ts-ignore `map` is added if a `SourceMapGenerator` is passed in.
    async transform(contents, filePath) {
      var file

      if (filter(filePath) && extensions.includes(path.extname(filePath))) {
        file = await compile({contents, path: filePath}, options)
        return {code: String(file.contents), map: file.map}
        // For some reason, on Erbium, c8 is missing the following two lines.
        /* c8 ignore next 2 */
      }
    }
  }
}
