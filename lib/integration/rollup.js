/**
 * @typedef {import('@rollup/pluginutils').FilterPattern} FilterPattern
 * @typedef {import('rollup').Plugin} Plugin
 * @typedef {import('../compile.js').CompileOptions} CompileOptions
 *
 * @typedef RollupPluginOptions
 * @property {FilterPattern} [include] List of picomatch patterns to include
 * @property {FilterPattern} [exclude] List of picomatch patterns to exclude
 *
 * @typedef {CompileOptions & RollupPluginOptions} ProcessorAndRollupOptions
 */

import vfile from 'vfile'
import {createFilter} from '@rollup/pluginutils'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'

/**
 * Compile MDX w/ rollup.
 *
 * @param {ProcessorAndRollupOptions} [options]
 * @return {Plugin}
 */
export function rollup(options = {}) {
  var {include, exclude, ...rest} = options
  var {extnames, process} = createFormatAwareProcessors(rest)
  var filter = createFilter(include, exclude)

  return {
    name: 'xdm',
    // @ts-ignore `map` is added if a `SourceMapGenerator` is passed in.
    async transform(contents, path) {
      var file = vfile({contents, path})

      if (filter(file.path) && extnames.includes(file.extname)) {
        var compiled = await process(file)
        return {code: String(compiled.contents), map: compiled.map}
        // V8 on Erbium.
        /* c8 ignore next 2 */
      }
    }
  }
}
