/**
 * @typedef {import('esbuild').BuildFailure} BuildFailure
 * @typedef {import('esbuild').Message} Message
 * @typedef {import('unist').Parent} Parent
 * @typedef {import('vfile').VFile} VFile
 * @typedef {import('mdx/types').MDXContent} MDXContent
 */

import {promises as fs} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import test from 'tape'
import esbuild from 'esbuild'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import esbuildXdm from '../esbuild.js'

test('xdm (esbuild)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

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

  /** @type {MDXContent} */
  let Content =
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/esbuild.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Hello, World!</h1>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'esbuild.mdx'))
  await fs.unlink(path.join(base, 'esbuild.js'))

  // Resolve directory.
  await fs.writeFile(
    path.join(base, 'esbuild-resolve.mdx'),
    'import Content from "./folder/file.mdx"\n\n<Content/>'
  )
  await fs.mkdir(path.join(base, 'folder'))
  await fs.writeFile(
    path.join(base, 'folder', 'file.mdx'),
    'import {data} from "./file.js"\n\n{data}'
  )
  await fs.writeFile(
    path.join(base, 'folder', 'file.js'),
    'export const data = 0.1'
  )
  await esbuild.build({
    bundle: true,
    define: {'process.env.NODE_ENV': '"development"'},
    entryPoints: [path.join(base, 'esbuild-resolve.mdx')],
    outfile: path.join(base, 'esbuild-resolve.js'),
    format: 'esm',
    plugins: [esbuildXdm()]
  })
  /** @type {MDXContent} */
  Content =
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/esbuild-resolve.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '0.1',
    'should compile'
  )

  await fs.unlink(path.join(base, 'esbuild-resolve.mdx'))
  await fs.unlink(path.join(base, 'esbuild-resolve.js'))
  await fs.rmdir(path.join(base, 'folder'), {recursive: true})

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
    /* @ts-expect-error file is dynamically generated */
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
    /* @ts-expect-error file is dynamically generated */
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

  console.log('\nnote: the following error is expected!\n')
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

  console.log('\nnote: the following error is expected!\n')
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
    const exception = /** @type {BuildFailure} */ (error)
    const message = exception.errors[0]
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
                // @ts-expect-error: fine.
                file.message('5', tree.children[2].children[0]) // Text in heading
                // @ts-expect-error: fine.
                file.message('6', tree.children[2].children[1]) // Expression in heading
                // @ts-expect-error: fine.
                file.message('7', tree.children[2].position.end).fatal = true // End of heading
              }
            }
          ]
        })
      ]
    })
    t.fail('esbuild should throw')
  } catch (error) {
    /** @type {BuildFailure} */
    const result = JSON.parse(JSON.stringify(error))

    for (const message of [...result.errors, ...result.warnings]) {
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

  await fs.writeFile(path.join(base, 'esbuild-plugin-crash.mdx'), '# hi')

  try {
    await esbuild.build({
      entryPoints: [path.join(base, 'esbuild-plugin-crash.mdx')],
      outfile: path.join(base, 'esbuild-plugin-crash.js'),
      format: 'esm',
      plugins: [
        esbuildXdm({
          rehypePlugins: [
            function () {
              return () => {
                throw new Error('Something went wrong')
              }
            }
          ]
        })
      ]
    })
    t.fail('esbuild should throw')
  } catch (error) {
    /** @type {BuildFailure} */
    const result = JSON.parse(JSON.stringify(error))

    for (const message of [...result.errors, ...result.warnings]) {
      delete message.detail
      message.text = message.text.split('\n')[0]
    }

    t.deepEqual(
      result,
      {
        errors: [
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-plugin-crash.mdx',
              length: 0,
              line: 0,
              lineText: '# hi',
              namespace: 'file',
              suggestion: ''
            },
            notes: [],
            pluginName: 'esbuild-xdm',
            text: 'Error: Something went wrong'
          }
        ],
        warnings: []
      },
      'should pass errors'
    )
  }

  await fs.unlink(path.join(base, 'esbuild-plugin-crash.mdx'))

  console.log('\nnote: the preceding errors and warnings are expected!\n')

  /** @type {(contents: string) => import('esbuild').Plugin} */
  const inlinePlugin = (contents) => ({
    name: 'inline plugin',
    setup(build) {
      build.onResolve({filter: /index\.mdx/}, () => ({
        path: path.join(process.cwd(), 'index.mdx'),
        pluginData: {contents}
      }))
    }
  })

  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'index.mdx')],
    plugins: [inlinePlugin(`# Test`), esbuildXdm()],
    define: {'process.env.NODE_ENV': '"development"'},
    format: 'esm',
    bundle: true,
    outfile: path.join(base, 'esbuild-compile-from-memory.js')
  })

  Content =
    /** @ts-expect-error file is dynamically generated */
    (await import('./context/esbuild-compile-from-memory.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>Test</h1>',
    'should compile from `pluginData.content`'
  )

  await fs.unlink(path.join(base, 'esbuild-compile-from-memory.js'))

  await esbuild.build({
    entryPoints: [path.join(process.cwd(), 'index.mdx')],
    plugins: [inlinePlugin(``), esbuildXdm()],
    define: {'process.env.NODE_ENV': '"development"'},
    format: 'esm',
    bundle: true,
    outfile: path.join(base, 'esbuild-compile-from-memory-empty.js')
  })

  Content =
    /** @ts-expect-error file is dynamically generated */
    (await import('./context/esbuild-compile-from-memory-empty.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '',
    'should compile from `pluginData.content` when an empty string is passed'
  )

  await fs.unlink(path.join(base, 'esbuild-compile-from-memory-empty.js'))

  // Remote markdown.
  await fs.writeFile(
    path.join(base, 'esbuild-with-remote-md.mdx'),
    'import Content from "https://raw.githubusercontent.com/wooorm/xdm/main/test/files/md-file.md"\n\n<Content />'
  )

  await esbuild.build({
    bundle: true,
    define: {'process.env.NODE_ENV': '"development"'},
    entryPoints: [path.join(base, 'esbuild-with-remote-md.mdx')],
    outfile: path.join(base, 'esbuild-with-remote-md.js'),
    format: 'esm',
    plugins: [esbuildXdm({allowDangerousRemoteMdx: true})]
  })

  Content =
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/esbuild-with-remote-md.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<p>Some content.</p>',
    'should compile remote markdown files w/ `allowDangerousRemoteMdx`'
  )

  await fs.unlink(path.join(base, 'esbuild-with-remote-md.mdx'))
  await fs.unlink(path.join(base, 'esbuild-with-remote-md.js'))

  // Remote MDX importing more markdown.
  await fs.writeFile(
    path.join(base, 'esbuild-with-remote-mdx.mdx'),
    'import Content from "https://raw.githubusercontent.com/wooorm/xdm/main/test/files/mdx-file-importing-markdown.mdx"\n\n<Content />'
  )

  await esbuild.build({
    bundle: true,
    define: {'process.env.NODE_ENV': '"development"'},
    entryPoints: [path.join(base, 'esbuild-with-remote-mdx.mdx')],
    outfile: path.join(base, 'esbuild-with-remote-mdx.js'),
    format: 'esm',
    plugins: [esbuildXdm({allowDangerousRemoteMdx: true})]
  })

  Content =
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/esbuild-with-remote-mdx.js')).default // type-coverage:ignore-line

  t.equal(
    renderToStaticMarkup(React.createElement(Content)),
    '<h1>heading</h1>\n<p>A <span style="color:red">little pill</span>.</p>\n<p>Some content.</p>',
    'should compile remote MD, MDX, and JS files w/ `allowDangerousRemoteMdx`'
  )

  await fs.unlink(path.join(base, 'esbuild-with-remote-mdx.mdx'))
  await fs.unlink(path.join(base, 'esbuild-with-remote-mdx.js'))

  t.end()
})
