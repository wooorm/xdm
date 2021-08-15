/**
 * @typedef {import('react').FC} FC
 * @typedef {import('@babel/parser').ParserOptions} ParserOptions
 * @typedef {import('estree-jsx').Program} Program
 */

import {promises as fs} from 'node:fs'
import path from 'node:path'
import test from 'tape'
import parser from '@babel/parser'
import {transformAsync as babel} from '@babel/core'
// @ts-expect-error: untyped.
import toBabel from 'estree-to-babel'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'
import {compileSync} from '../index.js'

test('xdm (babel)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  const result = await babel(
    'export const Message = () => <>World!</>\n\n# Hello, <Message />',
    {filename: 'example.mdx', plugins: [babelPluginSyntaxMdx]}
  )

  const js = ((result || {code: undefined}).code || '').replace(
    /\/jsx-runtime(?=["'])/g,
    '$&.js'
  )

  await fs.writeFile(path.join(base, 'babel.js'), js)

  const Content = /** @type {FC} */ (
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/babel.js')).default // type-coverage:ignore-line
  )

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'babel.js'))

  function babelPluginSyntaxMdx() {
    return {
      /**
       * @param {string} value
       * @param {ParserOptions} options
       */
      parserOverride(value, options) {
        if (
          // @ts-expect-error Babel types are wrong babel/babel#13170
          options.sourceFileName &&
          // @ts-expect-error Babel types are wrong babel/babel#13170
          path.extname(options.sourceFileName) === '.mdx'
        ) {
          return compileSync(
            // @ts-expect-error Babel types are wrong babel/babel#13170
            {value, path: options.sourceFileName},
            {recmaPlugins: [recmaBabel]}
          ).result
        }

        return parser.parse(value, options)
      }
    }
  }

  /** @type {import('unified').Plugin<void[], Program, string>} */
  function recmaBabel() {
    Object.assign(this, {Compiler: toBabel})
  }

  t.end()
})
