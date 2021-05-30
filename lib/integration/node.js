/**
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('../compile.js').CompileOptions} CompileOptions
 */

import path from 'path'
import vfile from 'vfile'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'

/**
 * Create smart processors to handle different formats.
 *
 * @param {CompileOptions} [options]
 */
export function createLoader(options) {
  const {extnames, process} = createFormatAwareProcessors(options)

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
    if (!extnames.includes(path.extname(context.url))) {
      return defaultTransformSource(contents, context, defaultTransformSource)
    }

    const file = await process(vfile({contents, path: context.url}))
    // V8 on Erbium.
    /* c8 ignore next 2 */
    return {source: String(file).replace(/\/jsx-runtime(?=["'])/g, '$&.js')}
  }
}
