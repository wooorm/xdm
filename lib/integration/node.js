import path from 'path'
import vfile from 'vfile'
import {createProcessor} from '../core.js'

export function createLoader(options) {
  var processor = createProcessor(options)
  // eslint-disable-next-line unicorn/prefer-set-has
  var extnames = ['.mdx']

  return {getFormat, transformSource}

  function getFormat(url, context, defaultGetFormat) {
    return extnames.includes(path.extname(url))
      ? {format: 'module'}
      : defaultGetFormat(url, context, defaultGetFormat)
  }

  async function transformSource(contents, context, defaultTransformSource) {
    var file

    if (!extnames.includes(path.extname(context.url))) {
      return defaultTransformSource(contents, context, defaultTransformSource)
    }

    file = await processor.process(vfile({contents, path: context.url}))
    return {source: String(file).replace(/\/jsx-runtime(?=["'])/g, '$&.js')}
  }
}
