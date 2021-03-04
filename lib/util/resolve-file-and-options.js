import vfile from 'vfile'
import {detectFormat} from './detect-format.js'
import {markdown} from './extnames.js'

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
        format === 'markdown' || format === 'mdx'
          ? format
          : detectFormat(file, rest.markdownExtensions || markdown),
      ...rest
    }
  }
}
