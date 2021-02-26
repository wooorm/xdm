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
  // @ts-ignore file is dynamically generated
  var Content = require('./context/register.mdx')

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'register.mdx'))

  t.end()
})
