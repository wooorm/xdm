/**
 * @typedef {import('mdx/types').MDXContent} MDXContent
 */

import path from 'node:path'
import {promises as fs} from 'node:fs'
import test from 'tape'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'

test('xdm (ESM loader)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'esm-loader.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  /** @type {MDXContent} */
  let Content

  try {
    Content = (await import('./context/esm-loader.mdx')).default // type-coverage:ignore-line
  } catch (error) {
    const exception = /** @type {NodeJS.ErrnoException} */ (error)
    if (exception.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
      await fs.unlink(path.join(base, 'esm-loader.mdx'))
      throw new Error(
        'Please run Node with `--experimental-loader=./test/react-18-esm-loader.js` to test the ESM loader'
      )
    }

    throw error
  }

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'esm-loader.mdx'))

  t.end()
})
