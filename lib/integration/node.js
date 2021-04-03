import path from 'path'
import vfile from 'vfile'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'

/**
 * Create smart processors to handle different formats.
 *
 * @param {import('../compile').CompileOptions} [options]
 */
export function createLoader(options) {
  var {extnames, process} = createFormatAwareProcessors(options)

  return {getFormat, transformSource}

  /**
   * @param {string} url
   * @param {unknown} context
   * @param {Function} defaultGetFormat
   */
  function getFormat(url, context, defaultGetFormat) {
    return extnames.includes(path.extname(url))
      ? {format: 'module'}
      : defaultGetFormat(url, context, defaultGetFormat)
  }

  /**
   * @param {string} contents
   * @param {{url: string, [x: string]: unknown}} context
   * @param {Function} defaultTransformSource
   */
  async function transformSource(contents, context, defaultTransformSource) {
    /** @type {import('vfile').VFile} */
    var file

    if (!extnames.includes(path.extname(context.url))) {
      return defaultTransformSource(contents, context, defaultTransformSource)
    }

    file = await process(vfile({contents, path: context.url}))
    // V8 on Erbium.
    /* c8 ignore next 2 */
    return {source: String(file).replace(/\/jsx-runtime(?=["'])/g, '$&.js')}
  }
}
