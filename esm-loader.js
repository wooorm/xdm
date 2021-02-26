// Ideas:
//
// This ESM loader does not accept options.
// This importantly means `jsxImportSource`, `providerImportSource`, or
// `{remark,rehype,recma}Plugins` can’t be changed.
//
// I see two potential solutions:
//
// 1.  Options could be passed in as strings to the loader like so:
//
//     ```sh
//     node --experimental-loader=xdm/esm-loader.js?jsxImportSource=preact example.js
//     ```
//
//     Which is then parsed here through `process.execArgv`, which for the above
//     yields:
//
//     ```sh
//     ['--experimental-loader=xdm/esm-loader.js?jsxImportSource=preact']
//     ```
//
//     This is less neat for plugins.
// 2.  This module could also export a `createEsmLoader(options)`,
//     which builds the needed `getFormat` / `transformSource`, and could then
//     be used like so, in my `my-loader.js`:
//
//     ```js
//     import {createEsmLoader} from 'mdx/esm-loader.js'
//     export const {getFormat, transformSource} from createEsmLoader(options)
//     ```
//
//     Uses as:
//
//     ```sh
//     node --experimental-loader=./my-loader.js example.js
//     ```

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
