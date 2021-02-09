import {promises as fs} from 'fs'
import path from 'path'
import {compileSync} from '../index.js'
import test from 'tape'
import parser from '@babel/parser'
import {transformAsync as babel} from '@babel/core'
import toBabel from 'estree-to-babel'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'

test('xdm (babel)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))

  var js = (
    await babel(
      'export const Message = () => <>World!</>\n\n# Hello, <Message />',
      {filename: 'example.mdx', plugins: [babelPluginSyntaxJsx]}
    )
  ).code.replace(/\/jsx-runtime(?=["'])/g, '$&.js')

  await fs.writeFile(path.join(base, 'babel.js'), js)

  /** @type {import("react").FunctionComponent} */
  // @ts-ignore file is dynamically generated
  var Content = (await import('./context/babel.js')).default

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'babel.js'))

  function babelPluginSyntaxJsx() {
    return {
      parserOverride(contents, options) {
        if (
          options.sourceFileName &&
          path.extname(options.sourceFileName) === '.mdx'
        ) {
          return compileSync(
            {contents, path: options.sourceFileName},
            {recmaPlugins: [recmaBabel]}
          ).result
        }

        return parser.parse(contents, options)
      }
    }
  }

  function recmaBabel() {
    this.Compiler = toBabel
  }

  t.end()
})
