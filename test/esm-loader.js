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

  // OMG, it works!
  // @ts-ignore file is dynamically generated
  var Content = await import('./context/esm-loader.mdx')

  t.equal(
    renderToStaticMarkup(React.createElement(Content.default)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'esm-loader.mdx'))

  t.end()
})
