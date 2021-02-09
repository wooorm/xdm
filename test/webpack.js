import {promisify} from 'util'
import path from 'path'
import fs from 'fs/promises'
import test from 'tape'
import webpack from 'webpack'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'

test('xdm (webpack)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'webpack.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  await promisify(webpack)({
    context: base,
    entry: './webpack.mdx',
    mode: 'none',
    module: {rules: [{test: /\.mdx$/, use: [path.resolve('webpack.cjs')]}]},
    output: {path: base, filename: 'webpack.cjs', libraryTarget: 'commonjs'}
  })

  // One for ESM loading CJS, one for webpack.
  var Content = (await import('./context/webpack.cjs')).default.default

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'webpack.mdx'))
  await fs.unlink(path.join(base, 'webpack.cjs'))

  t.end()
})
