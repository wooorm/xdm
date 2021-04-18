'use strict'

var path = require('path')
var fs = require('fs').promises
var test = require('tape')
var React = require('react')
var {renderToStaticMarkup} = require('react-dom/server.js')

require('../register.cjs')

test('xdm (register)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))

  await fs.writeFile(
    path.join(base, 'register.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  // OMG, it works!
  var Content = /** @type {import('react').FC} */ (
    /* @ts-ignore file is dynamically generated */
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
