import vfile from 'vfile'
import {createFilter} from '@rollup/pluginutils'
import {createProcessor} from './core.js'

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
  var {include, exclude, extensions, ...rest} = options
  var processor = createProcessor(rest)
  var filter = createFilter(include, exclude)
  var extnames = extensions || ['.mdx']

  return {
    name: 'xdm',
    // @ts-ignore `map` is added if a `SourceMapGenerator` is passed in.
    async transform(contents, path) {
      var file = vfile({contents, path})

      if (filter(file.path) && extnames.includes(file.extname)) {
        var compiled = await processor.process(file)
        return {
          code: String(compiled.contents),
          map: compiled.map
        }
        // For some reason, on Erbium, c8 is missing the following two lines.
        /* c8 ignore next 2 */
      }
    }
  }
}
