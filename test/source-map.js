/**
 * @typedef {import('mdx/types').MDXContent} MdxContent
 */

import {promises as fs} from 'node:fs'
import path from 'node:path'
import {Buffer} from 'node:buffer'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'
import {SourceMapGenerator} from 'source-map'
import test from 'tape'
import {compile} from '../index.js'

// Note: Node has an experimental `--enable-source-maps` flag, but most of V8
// doesn’t seem to support it.
// So instead use a userland module.
import 'source-map-support/register.js'

test('xdm (source maps)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))
  const file = await compile(
    ['export function Component() {', '  a()', '}', '', '<Component />'].join(
      '\n'
    ),
    {SourceMapGenerator}
  )

  file.value +=
    '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' +
    Buffer.from(JSON.stringify(file.map)).toString('base64') +
    '\n'

  await fs.writeFile(
    path.join(base, 'sourcemap.js'),
    String(file).replace(/\/jsx-runtime(?=["'])/g, '$&.js')
  )

  const Content = /** @type {MdxContent} */ (
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/sourcemap.js')).default // type-coverage:ignore-line
  )

  try {
    renderToStaticMarkup(React.createElement(Content))
    t.fail()
  } catch (error) {
    const exception = /** @type {Error} */ (error)
    const match = /at Component \(file:([^)]+)\)/.exec(String(exception.stack))
    const place =
      path.posix.join(...base.split(path.sep), 'unknown.mdx') + ':2:3'

    t.equal(
      match && match[1].slice(-place.length),
      place,
      'should support source maps'
    )
  }

  await fs.unlink(path.join(base, 'sourcemap.js'))

  t.end()
})
