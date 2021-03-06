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
          : detectFormat(file, rest.mdExtensions || md),
      ...rest
    }
  }
}

/**
 * @param {import('vfile').VFile} file Virtual file
 * @param {string[]} md Markdown extnames
 * @return {'md' | 'mdx'}
 */
function detectFormat(file, md) {
  return md.includes(file.extname) ? 'md' : 'mdx'
}
