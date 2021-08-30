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

import {VFile} from 'vfile'
import {createFilter} from '@rollup/pluginutils'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'

/**
 * Compile MDX w/ rollup.
 *
 * @param {ProcessorAndRollupOptions} [options]
 * @return {Plugin}
 */
export function rollup(options = {}) {
  const {include, exclude, ...rest} = options
  const {extnames, process} = createFormatAwareProcessors(rest)
  const filter = createFilter(include, exclude)

  return {
    name: 'xdm',
    // @ts-expect-error `map` is added if a `SourceMapGenerator` is passed in.
    async transform(value, path) {
      const file = new VFile({value, path})

      if (
        file.extname &&
        filter(file.path) &&
        extnames.includes(file.extname)
      ) {
        const compiled = await process(file)
        return {code: String(compiled.value), map: compiled.map}
        // V8 on Erbium.
        /* c8 ignore next 2 */
      }
    }
  }
}
