import vfile from 'vfile'
import {md} from './extnames.js'

/**
 * Create a file and options from a given `vfileCompatible` and options that
 * might container `format: 'detect'`.
 *
 * @param {import('vfile').VFileCompatible} vfileCompatible
 * @param {import('../compile.js').CompileOptions} options
 * @returns {{file: import('vfile').VFile, options: import('../core').ProcessorOptions}}
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
