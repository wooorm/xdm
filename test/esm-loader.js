/**
 * @typedef {import('react').FC} FC
 */

import path from 'path'
import {promises as fs} from 'fs'
import test from 'tape'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'

test('xdm (ESM loader)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'esm-loader.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  /** @type {FC} */
  var Content

  try {
    /* @ts-ignore file is dynamically generated */
    Content = (await import('./context/esm-loader.mdx')).default // type-coverage:ignore-line
  } catch (error) {
    if (error.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
      await fs.unlink(path.join(base, 'esm-loader.mdx'))
      throw new Error(
        'Please run Node with `--experimental-loader=./esm-loader.js` to test the ESM loader'
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
