/**
 * @typedef {import('mdx/types').MDXContent} MDXContent
 */

'use strict'

const path = require('path')
const fs = require('fs').promises
const test = require('tape')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')

require('../register.cjs')

test('xdm (register)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'register.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  // OMG, it works!
  const Content = /** @type {MDXContent} */ (
    /* @ts-expect-error file is dynamically generated */
    require('./context/register.mdx') // type-coverage:ignore-line
  )

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'register.mdx'))

  t.end()
})
