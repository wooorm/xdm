import * as provider from '@mdx-js/react'
import React from 'react'
import * as runtime from 'react/jsx-runtime.js'
import {renderToStaticMarkup} from 'react-dom/server.js'
import test from 'tape'
import {evaluate, evaluateSync} from '../index.js'

test('xdm (evaluate)', async function (t) {
  t.throws(
    function () {
      // @ts-expect-error
      evaluateSync('a')
    },
    /Expected `Fragment` given to `evaluate`/,
    'should throw on missing `Fragment`'
  )

  t.throws(
    function () {
      // @ts-expect-error
      evaluateSync('a', {Fragment: runtime.Fragment})
    },
    /Expected `jsx` given to `evaluate`/,
    'should throw on missing `jsx`'
  )

  t.throws(
    function () {
      // @ts-expect-error
      evaluateSync('a', {Fragment: runtime.Fragment, jsx: runtime.jsx})
    },
    /Expected `jsxs` given to `evaluate`/,
    'should throw on missing `jsxs`'
  )

  t.equal(
    renderToStaticMarkup(
      // @ts-ignore runtime.js does not have a typing
      React.createElement((await evaluate('# hi!', runtime)).default)
    ),
    '<h1>hi!</h1>',
    'should evaluate'
  )

  t.equal(
    renderToStaticMarkup(
      // @ts-ignore runtime.js does not have a typing
      React.createElement(evaluateSync('# hi!', runtime).default)
    ),
    '<h1>hi!</h1>',
    'should evaluate (sync)'
  )

  // @ts-ignore runtime.js does not have a typing
  var mod = await evaluate('export const a = 1\n\n{a}', runtime)

  t.equal(
    renderToStaticMarkup(React.createElement(mod.default)),
    '1',
    'should support an `export` (1)'
  )

  t.equal(mod.a, 1, 'should support an `export` (2)')

  // @ts-ignore runtime.js does not have a typing
  mod = await evaluate('export function a() { return 1 }\n\n{a()}', runtime)

  t.equal(
    renderToStaticMarkup(React.createElement(mod.default)),
    '1',
    'should support an `export function` (1)'
  )

  if (typeof mod.a !== 'function') throw new TypeError('missing function')

  t.equal(mod.a(), 1, 'should support an `export function` (2)')

  mod = await evaluate(
    'export class A { constructor() { this.b = 1 } }\n\n{new A().b}',
    // @ts-ignore runtime.js does not have a typing
    runtime
  )

  t.equal(
    renderToStaticMarkup(React.createElement(mod.default)),
    '1',
    'should support an `export class` (1)'
  )

  // @ts-ignore TODO figure out how to narrow class type in JSDoc typescript
  t.equal(new mod.A().b, 1, 'should support an `export class` (2)')

  // @ts-ignore runtime.js does not have a typing
  mod = await evaluate('export const a = 1\nexport {a as b}\n\n{a}', runtime)

  t.equal(
    renderToStaticMarkup(React.createElement(mod.default)),
    '1',
    'should support an `export as` (1)'
  )

  t.equal(mod.a, 1, 'should support an `export as` (2)')
  t.equal(mod.b, 1, 'should support an `export as` (3)')

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        (
          await evaluate(
            'export default function Layout({components, ...props}) { return <section {...props} /> }\n\na',
            // @ts-ignore runtime.js does not have a typing
            runtime
          )
        ).default
      )
    ),
    '<section><p>a</p></section>',
    'should support an `export default`'
  )

  t.throws(
    function () {
      // @ts-ignore runtime.js does not have a typing
      evaluateSync('export {a} from "b"', runtime)
    },
    /Cannot use `export … from` in contained MDX/,
    'should throw on an export from'
  )

  t.throws(
    function () {
      // @ts-ignore runtime.js does not have a typing
      evaluateSync('export * from "a"', runtime)
    },
    /Cannot use `export \* from` in contained MDX/,
    'should throw on an export all from'
  )

  t.throws(
    function () {
      // @ts-ignore runtime.js does not have a typing
      evaluateSync('import {a} from "b"', runtime)
    },
    /Cannot use `import` in contained MDX/,
    'should throw on an import'
  )

  t.throws(
    function () {
      // @ts-ignore runtime.js does not have a typing
      evaluateSync('import a from "b"', runtime)
    },
    /Cannot use `import` in contained MDX/,
    'should throw on an import default'
  )

  t.equal(
    renderToStaticMarkup(
      // @ts-ignore runtime.js does not have a typing
      React.createElement((await evaluate('<X/>', runtime)).default, {
        components: {
          X() {
            return React.createElement('span', {}, '!')
          }
        }
      })
    ),
    '<span>!</span>',
    'should support a given components'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        provider.MDXProvider,
        {
          components: {
            X() {
              return React.createElement('span', {}, '!')
            }
          }
        },
        React.createElement(
          // @ts-ignore runtime.js does not have a typing
          (await evaluate('<X/>', {...runtime, ...provider})).default
        )
      )
    ),
    '<span>!</span>',
    'should support a provider w/ `useMDXComponents`'
  )

  t.end()
})
