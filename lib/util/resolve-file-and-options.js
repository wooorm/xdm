/**
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('../core.js').ProcessorOptions} ProcessorOptions
 * @typedef {import('../compile.js').CompileOptions} CompileOptions
 */

import vfile from 'vfile'
import {md} from './extnames.js'

/**
 * Create a file and options from a given `vfileCompatible` and options that
 * might contain `format: 'detect'`.
 *
 * @param {VFileCompatible} vfileCompatible
 * @param {CompileOptions} options
 * @returns {{file: VFile, options: ProcessorOptions}}
 */
export function resolveFileAndOptions(vfileCompatible, options) {
  var file = vfile(vfileCompatible)
  var {format, ...rest} = options || {}
  return {
    file,
    options: {
      format:
        format === 'md' || format === 'mdx'
          ? format
          : (rest.mdExtensions || md).includes(file.extname)
          ? 'md'
          : 'mdx',
      ...rest
    }
  }
}
