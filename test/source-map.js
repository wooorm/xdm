import {promises as fs} from 'fs'
import path from 'path'
import {compile} from '../index.js'
import {fromObject} from 'convert-source-map'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'
import {SourceMapGenerator} from 'source-map'
import test from 'tape'

// Note: Node has an experimental `--enable-source-maps` flag, but most of V8
// doesn’t seem to support it.
// So instead use a userland module.
/* eslint-disable-next-line import/no-unassigned-import */
import 'source-map-support/register.js'

test('xdm (source maps)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))
  var file = await compile(
    ['export function Component() {', '  a()', '}', '', '<Component />'].join(
      '\n'
    ),
    {SourceMapGenerator}
  )

  file.contents += fromObject(file.map).toComment() + '\n'

  await fs.writeFile(
    path.join(base, 'sourcemap.js'),
    String(file).replace(/\/jsx-runtime(?=["'])/g, '$&.js')
  )

  /** @type {import("react").FunctionComponent} */
  // @ts-ignore file is dynamically generated
  var Content = (await import('./context/sourcemap.js')).default

  try {
    renderToStaticMarkup(React.createElement(Content))
    t.fail()
  } catch (error) {
    var match = /at Component \(file:([^)]+)\)/.exec(error.stack)
    var place = path.posix.join(...base.split(path.sep), 'unknown.mdx') + ':2:3'
    t.equal(match[1].slice(-place.length), place, 'should support source maps')
  }

  await fs.unlink(path.join(base, 'sourcemap.js'))

  t.end()
})
