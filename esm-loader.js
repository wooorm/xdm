import {compile} from './index.js'

var extension = '.mdx'

export function getFormat(url, context, defaultGetFormat) {
  return url.endsWith(extension)
    ? {format: 'module'}
    : defaultGetFormat(url, context, defaultGetFormat)
}

export async function transformSource(source, context, defaultTransformSource) {
  return context.url.endsWith(extension)
    ? {
        source: String(
          await compile({contents: source, path: context.url})
        ).replace(/\/jsx-runtime(?=["'])/g, '$&.js')
      }
    : // For some reason, on Erbium, c8 is missing the following two lines.
      /* c8 ignore next 2 */
      defaultTransformSource(source, context, defaultTransformSource)
}
