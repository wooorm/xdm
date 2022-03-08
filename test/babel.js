/**
 * @typedef {import('@babel/parser').ParserOptions} ParserOptions
 * @typedef {import('estree-jsx').Program} Program
 * @typedef {import('mdx/types').MDXContent} MDXContent
 */

import {promises as fs} from 'node:fs'
import path from 'node:path'
import test from 'tape'
import parser from '@babel/parser'
import {transformAsync as babel} from '@babel/core'
// @ts-expect-error: untyped.
import toBabel from 'estree-to-babel'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {compileSync} from '../index.js'

test('xdm (babel)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  const result = await babel(
    'export const Message = () => <>World!</>\n\n# Hello, <Message />',
    {filename: 'example.mdx', plugins: [babelPluginSyntaxMdx]}
  )

  const js = (result || {code: undefined}).code || ''
  await fs.writeFile(path.join(base, 'babel.js'), js)

  const Content = /** @type {MDXContent} */ (
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
          // @ts-expect-error: types accept one of them.
          (options.sourceFileName || options.sourceFilename) &&
          // @ts-expect-error: types accept one of them.
          path.extname(options.sourceFileName || options.sourceFilename) ===
            '.mdx'
        ) {
          return compileSync(
            {value, path: options.sourceFilename},
            {recmaPlugins: [recmaBabel]}
          ).result
        }

        return parser.parse(value, options)
      }
    }
  }

  /** @type {import('unified').Plugin<Array<void>, Program, string>} */
  function recmaBabel() {
    Object.assign(this, {Compiler: toBabel})
  }

  t.end()
})
