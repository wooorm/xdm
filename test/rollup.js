/**
 * @typedef {import('mdx/types').MDXContent} MdxContent
 */

import path from 'node:path'
import {promises as fs} from 'node:fs'
import test from 'tape'
import {rollup} from 'rollup'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'
import rollupXdm from '../rollup.js'

test('xdm (rollup)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'rollup.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  const bundle = await rollup({
    input: path.join(base, 'rollup.mdx'),
    external: ['react/jsx-runtime'],
    plugins: [rollupXdm()]
  })

  await fs.writeFile(
    path.join(base, 'rollup.js'),
    (
      await bundle.generate({format: 'es'})
    ).output[0].code.replace(/\/jsx-runtime(?=["'])/g, '$&.js')
  )

  const Content = /** @type {MdxContent} */ (
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/rollup.js')).default // type-coverage:ignore-line
  )

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'rollup.mdx'))
  await fs.unlink(path.join(base, 'rollup.js'))

  t.end()
})
