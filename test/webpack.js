/**
 * @typedef {import('mdx/types').MDXContent} MdxContent
 */

import {promisify} from 'node:util'
import path from 'node:path'
import {promises as fs} from 'node:fs'
import test from 'tape'
import webpack from 'webpack'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'

test('xdm (webpack)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'webpack.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  await promisify(webpack)({
    // @ts-expect-error context does not exist on the webpack options type
    context: base,
    entry: './webpack.mdx',
    mode: 'none',
    module: {rules: [{test: /\.mdx$/, use: [path.resolve('webpack.cjs')]}]},
    output: {path: base, filename: 'webpack.cjs', libraryTarget: 'commonjs'}
  })

  // One for ESM loading CJS, one for webpack.
  const Content = /** @type {MdxContent} */ (
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/webpack.cjs')).default.default // type-coverage:ignore-line
  )

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'webpack.mdx'))
  await fs.unlink(path.join(base, 'webpack.cjs'))

  t.end()
})
