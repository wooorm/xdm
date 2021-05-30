/**
 * @typedef {import('react').FC} FC
 * @typedef {import('esbuild').BuildFailure} BuildFailure
 * @typedef {import('esbuild').Message} Message
 * @typedef {import('unist').Parent} Parent
 * @typedef {import('vfile').VFile} VFile
 */

import path from 'path'
import {promises as fs} from 'fs'
import test from 'tape'
import esbuild from 'esbuild'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'
import esbuildXdm from '../esbuild.js'

test('xdm (esbuild)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))
  /** @type {FC} */
  let Content
  /** @type {BuildFailure} */
  let result
  /** @type {Message} */
  let message

  // MDX.
  await fs.writeFile(
    path.join(base, 'esbuild.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  await esbuild.build({
    bundle: true,
    define: {'process.env.NODE_ENV': '"development"'},
    entryPoints: [path.join(base, 'esbuild.mdx')],
    outfile: path.join(base, 'esbuild.js'),
    format: 'esm',
    plugins: [esbuildXdm()]
  })

  Content =
    /* @ts-ignore file is dynamically generated */
    (await import('./context/esbuild.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'esbuild.mdx'))
  await fs.unlink(path.join(base, 'esbuild.js'))

  // Markdown.
  await fs.writeFile(path.join(base, 'esbuild.md'), '\ta')

  await esbuild.build({
    bundle: true,
    define: {'process.env.NODE_ENV': '"development"'},
    entryPoints: [path.join(base, 'esbuild.md')],
    outfile: path.join(base, 'esbuild-md.js'),
    format: 'esm',
    plugins: [esbuildXdm()]
  })

  Content =
    /* @ts-ignore file is dynamically generated */
    (await import('./context/esbuild-md.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<pre><code>a\n</code></pre>',
    'should compile `.md`'
  )

  await fs.unlink(path.join(base, 'esbuild.md'))
  await fs.unlink(path.join(base, 'esbuild-md.js'))

  // `.md` as MDX extension.
  await fs.writeFile(path.join(base, 'esbuild.md'), '\ta')

  await esbuild.build({
    bundle: true,
    define: {'process.env.NODE_ENV': '"development"'},
    entryPoints: [path.join(base, 'esbuild.md')],
    outfile: path.join(base, 'esbuild-md-as-mdx.js'),
    format: 'esm',
    plugins: [esbuildXdm({mdExtensions: [], mdxExtensions: ['.md']})]
  })

  Content =
    /* @ts-ignore file is dynamically generated */
    (await import('./context/esbuild-md-as-mdx.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<p>a</p>',
    'should compile `.md` as MDX w/ configuration'
  )

  await fs.unlink(path.join(base, 'esbuild.md'))
  await fs.unlink(path.join(base, 'esbuild-md-as-mdx.js'))

  // File not in `extnames`:
  await fs.writeFile(path.join(base, 'esbuild.md'), 'a')
  await fs.writeFile(path.join(base, 'esbuild.mdx'), 'a')

  try {
    await esbuild.build({
      entryPoints: [path.join(base, 'esbuild.md')],
      outfile: path.join(base, 'esbuild-md-as-mdx.js'),
      plugins: [esbuildXdm({format: 'mdx'})]
    })
    t.fail()
  } catch (error) {
    t.match(
      String(error),
      /No loader is configured for "\.md" files/,
      'should not handle `.md` files w/ `format: mdx`'
    )
  }

  try {
    await esbuild.build({
      entryPoints: [path.join(base, 'esbuild.mdx')],
      outfile: path.join(base, 'esbuild-md-as-mdx.js'),
      plugins: [esbuildXdm({format: 'md'})]
    })
    t.fail()
  } catch (error) {
    t.match(
      String(error),
      /No loader is configured for "\.mdx" files/,
      'should not handle `.mdx` files w/ `format: md`'
    )
  }

  await fs.unlink(path.join(base, 'esbuild.md'))
  await fs.unlink(path.join(base, 'esbuild.mdx'))

  console.log('\nnote: the following errors and warnings are expected!\n')

  await fs.writeFile(
    path.join(base, 'esbuild-broken.mdx'),
    'asd <https://example.com>?'
  )

  try {
    await esbuild.build({
      entryPoints: [path.join(base, 'esbuild-broken.mdx')],
      outfile: path.join(base, 'esbuild.js'),
      plugins: [esbuildXdm()]
    })
    t.fail('esbuild should throw')
  } catch (error) {
    message = error.errors[0]
    delete message.detail
    t.deepEqual(
      message,
      {
        location: {
          column: 11,
          file: 'test/context/esbuild-broken.mdx',
          length: 1,
          line: 1,
          lineText: 'asd <https://example.com>?',
          namespace: 'file',
          suggestion: ''
        },
        notes: [],
        pluginName: 'esbuild-xdm',
        text: 'Unexpected character `/` (U+002F) before local name, expected a character that can start a name, such as a letter, `$`, or `_` (note: to create a link in MDX, use `[text](url)`)'
      },
      'should pass errors'
    )
  }

  await fs.unlink(path.join(base, 'esbuild-broken.mdx'))

  await fs.writeFile(
    path.join(base, 'esbuild-warnings.mdx'),
    'export const Message = () => <>World!</>\n\n# Hello, <Message />'
  )

  try {
    await esbuild.build({
      entryPoints: [path.join(base, 'esbuild-warnings.mdx')],
      outfile: path.join(base, 'esbuild-warnings.js'),
      format: 'esm',
      plugins: [
        esbuildXdm({
          rehypePlugins: [
            function () {
              return transform
              /**
               *
               * @param {Parent} tree
               * @param {VFile} file
               */
              function transform(tree, file) {
                file.message('1')
                file.message('2', tree.children[1]) // EOL between both, no position.
                file.message('3', tree)
                file.message('4', tree.children[0]) // Export
                file.message('5', tree.children[2].children[0]) // Text in heading
                file.message('6', tree.children[2].children[1]) // Expression in heading
                file.message('7', tree.children[2].position.end).fatal = true // End of heading
              }
            }
          ]
        })
      ]
    })
    t.fail('esbuild should throw')
  } catch (error) {
    result = JSON.parse(JSON.stringify(error))

    for (message of [...result.errors, ...result.warnings]) {
      delete message.detail
    }

    t.deepEqual(
      result,
      {
        errors: [
          {
            location: {
              column: 20,
              file: 'test/context/esbuild-warnings.mdx',
              length: 1,
              line: 3,
              lineText: '# Hello, <Message />',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '7'
          }
        ],
        warnings: [
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 0,
              line: 0,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '1'
          },
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 0,
              line: 0,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '2'
          },
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 40,
              line: 1,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '3'
          },
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 40,
              line: 1,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '4'
          },
          {
            location: {
              column: 2,
              file: 'test/context/esbuild-warnings.mdx',
              length: 7,
              line: 3,
              lineText: '# Hello, <Message />',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '5'
          },
          {
            location: {
              column: 9,
              file: 'test/context/esbuild-warnings.mdx',
              length: 11,
              line: 3,
              lineText: '# Hello, <Message />',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: '6'
          }
        ]
      },
      'should pass warnings'
    )
  }

  await fs.unlink(path.join(base, 'esbuild-warnings.mdx'))

  console.log('\nnote: the preceding errors and warnings are expected!\n')

  /** @type import('esbuild').Plugin */
  const inlinePlugin = {
    name: 'inline plugin',
    setup: (build) => {
      build.onResolve({filter: /index\.mdx/}, () => {
        return {
          path: path.join(process.cwd(), 'index.mdx'),
          pluginData: {
            contents: `# Test`
          }
        }
      })
    }
  }

  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'index.mdx')],
    plugins: [inlinePlugin, esbuildXdm()],
    define: {'process.env.NODE_ENV': '"development"'},
    format: 'esm',
    bundle: true,
    outfile: path.join(base, 'esbuild-compile-from-memory.js')
  })

  Content =
    /** @ts-ignore file is dynamically generated */
    (await import('./context/esbuild-compile-from-memory.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Test</h1>',
    'should compile from `pluginData.content`'
  )

  await fs.unlink(path.join(base, 'esbuild-compile-from-memory.js'))

  t.end()
})
