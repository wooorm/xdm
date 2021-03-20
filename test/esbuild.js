import path from 'path'
import esbuildXdm from '../esbuild.js'
import {promises as fs} from 'fs'
import test from 'tape'
import esbuild from 'esbuild'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'

test('xdm (esbuild)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))
  var message
  var Content
  var result

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

  /** @type {import('react').FunctionComponent} */
  // @ts-ignore file is dynamically generated
  Content = (await import('./context/esbuild.js')).default

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

  /** @type {import('react').FunctionComponent} */
  // @ts-ignore file is dynamically generated
  Content = (await import('./context/esbuild-md.js')).default

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

  /** @type {import('react').FunctionComponent} */
  // @ts-ignore file is dynamically generated
  Content = (await import('./context/esbuild-md-as-mdx.js')).default

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
          namespace: 'file'
        },
        notes: [],
        text:
          '[esbuild-xdm] Unexpected character `/` (U+002F) before local name, expected a character that can start a name, such as a letter, `$`, or `_` (note: to create a link in MDX, use `[text](url)`)'
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
               * @param {import('unist').Parent} tree
               * @param {import('vfile').VFile} file
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
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 7'
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
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 1'
          },
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 0,
              line: 0,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 2'
          },
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 40,
              line: 1,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 3'
          },
          {
            location: {
              column: 0,
              file: 'test/context/esbuild-warnings.mdx',
              length: 40,
              line: 1,
              lineText: 'export const Message = () => <>World!</>',
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 4'
          },
          {
            location: {
              column: 2,
              file: 'test/context/esbuild-warnings.mdx',
              length: 7,
              line: 3,
              lineText: '# Hello, <Message />',
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 5'
          },
          {
            location: {
              column: 9,
              file: 'test/context/esbuild-warnings.mdx',
              length: 11,
              line: 3,
              lineText: '# Hello, <Message />',
              namespace: 'file'
            },
            notes: [],
            text: '[esbuild-xdm] 6'
          }
        ]
      },
      'should pass warnings'
    )
  }

  await fs.unlink(path.join(base, 'esbuild-warnings.mdx'))

  console.log('\nnote: the preceding errors and warnings are expected!\n')

  t.end()
})
