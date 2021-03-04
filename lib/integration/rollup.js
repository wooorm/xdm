import vfile from 'vfile'
import {createFilter} from '@rollup/pluginutils'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'

/**
 * @typedef RollupPluginOptions
 * @property {import('@rollup/pluginutils').FilterPattern} [include] List of picomatch patterns to include
 * @property {import('@rollup/pluginutils').FilterPattern} [exclude] List of picomatch patterns to exclude
 *
 * @typedef {import('../compile').CompileOptions & RollupPluginOptions} ProcessorAndRollupOptions
 */

/**
 * Compile MDX w/ rollup.
 *
 * @param {ProcessorAndRollupOptions} [options]
 * @return {import('rollup').Plugin}
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
