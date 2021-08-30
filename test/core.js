/**
 * @typedef {import('hast').Root} Root
 * @typedef {import('../lib/compile.js').VFileCompatible} VFileCompatible
 * @typedef {import('../lib/evaluate.js').MDXContent} MDXContent
 * @typedef {import('../lib/evaluate.js').ExportMap} ExportMap
 */

import path from 'node:path'
import {promises as fs} from 'node:fs'
import {MDXProvider} from '@mdx-js/react'
import {nanoid} from 'nanoid'
import {h} from 'preact'
import {render} from 'preact-render-to-string'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server.js'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import remarkFootnotes from 'remark-footnotes'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import test from 'tape'
import {components as themeUiComponents, ThemeProvider} from 'theme-ui'
import {base as themeUiBaseTheme} from '@theme-ui/preset-base'
import {compile, compileSync, createProcessor, nodeTypes} from '../index.js'

test('xdm', async (t) => {
  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(await compile('# hi!')))
    ),
    '<h1>hi!</h1>',
    'should compile'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('# hi!')))),
    '<h1>hi!</h1>',
    'should compile (sync)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('')))),
    '',
    'should compile an empty document'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('x', {
            remarkPlugins: [() => () => ({type: 'root', children: []})]
          })
        )
      )
    ),
    '',
    'should compile an empty document (remark)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('y', {
            rehypePlugins: [() => () => ({type: 'root', children: []})]
          })
        )
      )
    ),
    '',
    'should compile an empty document (rehype)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('y', {
            rehypePlugins: [() => () => ({type: 'doctype', name: 'html'})]
          })
        )
      )
    ),
    '',
    'should compile a document (rehype, non-representable)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('y', {
            rehypePlugins: [
              () => () => ({type: 'element', tagName: 'x', children: []})
            ]
          })
        )
      )
    ),
    '<x></x>',
    'should compile a non-element document (rehype, single element)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('!', {jsxRuntime: 'automatic'}))
      )
    ),
    '<p>!</p>',
    'should support the automatic runtime (`@jsxRuntime`)'
  )

  t.equal(
    render(
      h(await run(compileSync('?', {jsxImportSource: 'preact/compat'})), {})
    ),
    '<p>?</p>',
    'should support an import source (`@jsxImportSource`)'
  )

  t.equal(
    render(
      h(
        await run(
          compileSync('<>%</>', {
            jsxRuntime: 'classic',
            pragma: 'preact.createElement',
            pragmaFrag: 'preact.Fragment',
            pragmaImportSource: 'preact/compat'
          })
        ),
        {}
      )
    ),
    '%',
    'should support `pragma`, `pragmaFrag` for `preact/compat`'
  )

  t.equal(
    render(
      h(
        await run(compileSync('<>1</>', {jsxImportSource: 'preact'}), {
          keepImport: true
        }),
        {}
      )
    ),
    '1',
    'should support `jsxImportSource` for `preact`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          String(
            compileSync('<>+</>', {jsxImportSource: '@emotion/react'})
          ).replace(
            /\/jsx-runtime(?=["'])/g,
            '$&/dist/emotion-react-jsx-runtime.cjs.prod.js'
          ),
          {keepImport: true}
        )
      )
    ),
    '+',
    'should support `jsxImportSource` for `emotion`'
  )

  t.throws(
    () => {
      compileSync('import React from "react"\n\n.', {
        jsxRuntime: 'classic',
        pragmaImportSource: '@emotion/react',
        pragma: ''
      })
    },
    /Missing `pragma` in classic runtime with `pragmaImportSource`/,
    'should *not* support `jsxClassicImportSource` w/o `pragma`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<X />')), {
        components: {
          /** @param {Object.<string, unknown>} props */
          X(props) {
            return React.createElement('span', props, '!')
          }
        }
      })
    ),
    '<span>!</span>',
    'should support passing in `components` to `MDXContent`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<x.y />')), {
        components: {
          x: {
            /** @param {Object.<string, unknown>} props */
            y(props) {
              return React.createElement('span', props, '?')
            }
          }
        }
      })
    ),
    '<span>?</span>',
    'should support passing in `components` (for members) to `MDXContent`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<X /> and <X.Y />')), {
        components: {
          X: Object.assign(
            /** @param {Object.<string, unknown>} props */
            (props) => React.createElement('span', props, '!'),
            {
              /** @param {Object.<string, unknown>} props */
              Y(props) {
                return React.createElement('span', props, '?')
              }
            }
          )
        }
      })
    ),
    '<p><span>!</span> and <span>?</span></p>',
    'should support passing in `components` directly and as an object w/ members'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('*a*')), {
        components: {
          /** @param {Object.<string, unknown>} props */
          em(props) {
            return React.createElement('i', props)
          }
        }
      })
    ),
    '<p><i>a</i></p>',
    'should support overwriting components by passing them to `MDXContent`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('export var X = () => <em>a</em>\n\n*a*, <X>b</X>')
        ),
        {
          components: {
            /** @param {Object.<string, unknown>} props */
            em(props) {
              return React.createElement('i', props)
            }
          }
        }
      )
    ),
    '<p><i>a</i>, <em>a</em></p>',
    'should *not* support overwriting components in exports'
  )

  console.log('\nnote: the next warning is expected!\n')

  try {
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('export var X = () => <Y />\n\n<X />'))
      )
    )
    t.fail()
  } catch (/** @type {unknown} */ error) {
    const exception = /** @type {Error} */ (error)
    t.match(
      exception.message,
      /Element type is invalid/,
      'should throw on missing components in exported components'
    )
  }

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        MDXProvider,
        {
          components: {
            Y() {
              return React.createElement('span', {}, '!')
            }
          }
        },
        React.createElement(
          await run(
            compileSync('export var X = () => <Y />\n\n<X />', {
              providerImportSource: '@mdx-js/react'
            })
          )
        )
      )
    ),
    '<span>!</span>',
    'should support provided components in exported components'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        MDXProvider,
        {
          components: {
            y: {
              // @ts-expect-error `mdx-js/react` types do not support nested components.
              z() {
                return React.createElement('span', {}, '!')
              }
            }
          }
        },
        React.createElement(
          await run(
            compileSync('export var X = () => <y.z />\n\n<X />', {
              providerImportSource: '@mdx-js/react'
            })
          )
        )
      )
    ),
    '<span>!</span>',
    'should support provided component objects in exported components'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('a')), {
        components: {
          /**
           * @param {Object.<string, unknown>} props
           */
          wrapper(props) {
            const {components, ...rest} = props
            return React.createElement('div', rest)
          }
        }
      })
    ),
    '<div><p>a</p></div>',
    'should support setting the layout by passing it (as `wrapper`) to `MDXContent`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync(
            'import React from "react"\nexport default class extends React.Component { render() { return <>{this.props.children}</> } }\n\na'
          )
        )
      )
    ),
    '<p>a</p>',
    'should support setting the layout through a class component'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync(
            'export default function Layout({components, ...props}) { return <section {...props} /> }\n\na'
          )
        ),
        {
          components: {
            /**
             * @param {Object.<string, unknown>} props
             */
            wrapper(props) {
              const {components, ...rest} = props
              return React.createElement('article', rest)
            }
          }
        }
      )
    ),
    '<section><p>a</p></section>',
    'should *not* support overwriting the layout by passing one (as `wrapper`) to `MDXContent`'
  )

  t.throws(
    () => {
      compileSync(
        'export default function a() {}\n\nexport default function b() {}\n\n.'
      )
    },
    /Cannot specify multiple layouts \(previous: 1:1-1:31\)/,
    'should *not* support multiple layouts (1)'
  )

  t.throws(
    () => {
      compileSync(
        'export default function a() {}\n\nexport {Layout as default} from "./components.js"\n\n.'
      )
    },
    /Cannot specify multiple layouts \(previous: 1:1-1:31\)/,
    'should *not* support multiple layouts (2)'
  )

  try {
    renderToStaticMarkup(
      React.createElement(await run(compileSync('export default a')))
    )
    t.fail()
  } catch (/** @type {unknown} */ error) {
    const exception = /** @type {Error} */ (error)
    t.equal(
      exception.message,
      'a is not defined',
      'should support an identifier as an export default'
    )
  }

  console.log('\nnote: the next warning is expected!\n')

  try {
    renderToStaticMarkup(React.createElement(await run(compileSync('<X />'))))
    t.fail()
  } catch (/** @type {unknown} */ error) {
    const exception = /** @type {Error} */ (error)
    t.match(
      exception.message,
      /Element type is invalid/,
      'should throw if a required component is not passed'
    )
  }

  try {
    renderToStaticMarkup(React.createElement(await run(compileSync('<a.b />'))))
    t.fail()
  } catch (/** @type {unknown} */ error) {
    const exception = /** @type {Error} */ (error)
    t.equal(
      exception.message,
      "Cannot read property 'b' of undefined",
      'should throw if a required member is not passed'
    )
  }

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        MDXProvider,
        {
          components: {
            /**
             * @param {Object.<string, unknown>} props
             */
            em(props) {
              return React.createElement('i', props)
            }
          }
        },
        React.createElement(
          await run(compileSync('*z*', {providerImportSource: '@mdx-js/react'}))
        )
      )
    ),
    '<p><i>z</i></p>',
    'should support setting components through context with a `providerImportSource`'
  )

  console.log('\nnote: the next warning is expected!\n')

  try {
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('<X />', {providerImportSource: '@mdx-js/react'}))
      )
    )
    t.fail()
  } catch (/** @type {unknown} */ error) {
    const exception = /** @type {Error} */ (error)
    t.match(
      exception.message,
      /Element type is invalid/,
      'should throw if a required component is not passed or given to `MDXProvider`'
    )
  }

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(createProcessor().processSync('x')))
    ),
    '<p>x</p>',
    'should support `createProcessor`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(createProcessor({format: 'md'}).processSync('\tx'))
      )
    ),
    '<pre><code>x\n</code></pre>',
    'should support `format: md`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(createProcessor({format: 'mdx'}).processSync('\tx'))
      )
    ),
    '<p>x</p>',
    'should support `format: mdx`'
  )

  try {
    // @ts-expect-error runtime.
    createProcessor({format: 'detect'})
    t.fail()
  } catch (/** @type {unknown} */ error) {
    const exception = /** @type {Error} */ (error)
    t.equal(
      exception.message,
      "Incorrect `format: 'detect'`: `createProcessor` can support either `md` or `mdx`; it does not support detecting the format",
      'should not support `format: detect`'
    )
  }

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(await compile({value: '\tx'})))
    ),
    '<p>x</p>',
    'should detect as `mdx` by default'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(await compile({value: '\tx', path: 'y.md'}))
      )
    ),
    '<pre><code>x\n</code></pre>',
    'should detect `.md` as `md`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(await compile({value: '\tx', path: 'y.mdx'}))
      )
    ),
    '<p>x</p>',
    'should detect `.mdx` as `mdx`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(await compile({value: '\tx', path: 'y.md'}, {format: 'mdx'}))
      )
    ),
    '<p>x</p>',
    'should not “detect” `.md` w/ `format: mdx`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(await compile({value: '\tx', path: 'y.mdx'}, {format: 'md'}))
      )
    ),
    '<pre><code>x\n</code></pre>',
    'should not “detect” `.mdx` w/ `format: md`'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(await compile({value: '<q>r</q>', path: 's.md'}))
      )
    ),
    '<p>r</p>',
    'should not support HTML in markdown by default'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          await compile(
            {value: '<q>r</q>', path: 's.md'},
            {rehypePlugins: [rehypeRaw]}
          )
        )
      )
    ),
    '<p><q>r</q></p>',
    'should support HTML in markdown w/ `rehype-raw`'
  )

  t.match(
    String(
      await compile('a', {
        format: 'md',
        remarkPlugins: [
          () => (/** @type {Root} */ tree) => {
            tree.children.unshift({
              // @ts-expect-error MDXHAST.
              type: 'mdxjsEsm',
              value: '',
              data: {
                estree: {
                  type: 'Program',
                  comments: [],
                  body: [
                    {
                      type: 'VariableDeclaration',
                      kind: 'var',
                      declarations: [
                        {
                          type: 'VariableDeclarator',
                          id: {type: 'Identifier', name: 'a'},
                          init: {type: 'Literal', value: 1}
                        }
                      ]
                    }
                  ]
                }
              }
            })
          }
        ],
        rehypePlugins: [[rehypeRaw, {passThrough: nodeTypes}]]
      })
    ),
    /var a = 1/,
    'should support injected MDX nodes w/ `rehype-raw`'
  )

  t.end()
})

test('jsx', async (t) => {
  t.equal(
    String(compileSync('*a*', {jsx: true})),
    [
      '/*@jsxRuntime automatic @jsxImportSource react*/',
      'function MDXContent(props) {',
      '  const _components = Object.assign({',
      '    p: "p",',
      '    em: "em"',
      '  }, props.components), {wrapper: MDXLayout} = _components;',
      '  const _content = <><_components.p><_components.em>{"a"}</_components.em></_components.p></>;',
      '  return MDXLayout ? <MDXLayout {...props}>{_content}</MDXLayout> : _content;',
      '}',
      'export default MDXContent;',
      ''
    ].join('\n'),
    'should serialize JSX w/ `jsx: true`'
  )

  t.equal(
    String(compileSync('<a {...b} c d="1" e={1} />', {jsx: true})),
    [
      '/*@jsxRuntime automatic @jsxImportSource react*/',
      'function MDXContent(props) {',
      '  const _components = Object.assign({}, props.components), {wrapper: MDXLayout} = _components;',
      '  const _content = <><a {...b} c d="1" e={1} /></>;',
      '  return MDXLayout ? <MDXLayout {...props}>{_content}</MDXLayout> : _content;',
      '}',
      'export default MDXContent;',
      ''
    ].join('\n'),
    'should serialize props'
  )

  t.equal(
    String(compileSync('<><a:b /><c.d/></>', {jsx: true})),
    [
      '/*@jsxRuntime automatic @jsxImportSource react*/',
      'function MDXContent(props) {',
      '  const _components = Object.assign({}, props.components), {wrapper: MDXLayout, c} = _components;',
      '  const _content = <><><a:b /><c.d /></></>;',
      '  return MDXLayout ? <MDXLayout {...props}>{_content}</MDXLayout> : _content;',
      '}',
      'export default MDXContent;',
      ''
    ].join('\n'),
    'should serialize fragments, namespaces, members'
  )

  t.equal(
    String(compileSync('<>a {/* 1 */} b</>', {jsx: true})),
    [
      '/*@jsxRuntime automatic @jsxImportSource react*/',
      '/*1*/',
      'function MDXContent(props) {',
      '  const _components = Object.assign({}, props.components), {wrapper: MDXLayout} = _components;',
      '  const _content = <><>{"a "}{}{" b"}</></>;',
      '  return MDXLayout ? <MDXLayout {...props}>{_content}</MDXLayout> : _content;',
      '}',
      'export default MDXContent;',
      ''
    ].join('\n'),
    'should serialize fragments, expressions'
  )

  t.equal(
    String(compileSync('Hello {props.name}', {jsx: true})),
    [
      '/*@jsxRuntime automatic @jsxImportSource react*/',
      'function MDXContent(props) {',
      '  const _components = Object.assign({',
      '    p: "p"',
      '  }, props.components), {wrapper: MDXLayout} = _components;',
      '  const _content = <><_components.p>{"Hello "}{props.name}</_components.p></>;',
      '  return MDXLayout ? <MDXLayout {...props}>{_content}</MDXLayout> : _content;',
      '}',
      'export default MDXContent;',
      ''
    ].join('\n'),
    'should allow using props'
  )

  t.match(
    String(compileSync("{<w x='y \" z' />}", {jsx: true})),
    /x="y &quot; z"/,
    'should serialize double quotes in attribute values'
  )

  t.match(
    String(compileSync('{<>a &amp; b &#123; c &lt; d</>}', {jsx: true})),
    /a & b &#123; c &lt; d/,
    'should serialize `<` and `{` in JSX text'
  )

  t.end()
})

test('markdown (CM)', async (t) => {
  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('[a](b)')))),
    '<p><a href="b">a</a></p>',
    'should support links (resource) (`[]()` -> `a`)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('[a]: b\n[a]')))
    ),
    '<p><a href="b">a</a></p>',
    'should support links (reference) (`[][]` -> `a`)'
  )

  t.throws(
    () => {
      compileSync('<http://a>')
    },
    /note: to create a link in MDX, use `\[text]\(url\)/,
    'should *not* support links (autolink) (`<http://a>` -> error)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('> a')))),
    '<blockquote>\n<p>a</p>\n</blockquote>',
    'should support block quotes (`>` -> `blockquote`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('\\*a*')))),
    '<p>*a*</p>',
    'should support characters (escape) (`\\` -> ``)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('&lt;')))),
    '<p>&lt;</p>',
    'should support character (reference) (`&lt;` -> `<`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('```\na')))),
    '<pre><code>a\n</code></pre>',
    'should support code (fenced) (` ``` ` -> `pre code`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('    a')))),
    '<p>a</p>',
    'should *not* support code (indented) (`\\ta` -> `p`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('`a`')))),
    '<p><code>a</code></p>',
    'should support code (text) (`` `a` `` -> `code`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('*a*')))),
    '<p><em>a</em></p>',
    'should support emphasis (`*` -> `em`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('a\\\nb')))),
    '<p>a<br/>\nb</p>',
    'should support hard break (escape) (`\\\\\\n` -> `<br>`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('a  \nb')))),
    '<p>a<br/>\nb</p>',
    'should support hard break (whitespace) (`\\\\\\n` -> `<br>`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('#')))),
    '<h1></h1>',
    'should support headings (atx) (`#` -> `<h1>`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('a\n=')))),
    '<h1>a</h1>',
    'should support headings (setext) (`=` -> `<h1>`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('1.')))),
    '<ol>\n<li></li>\n</ol>',
    'should support list (ordered) (`1.` -> `<ol><li>`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('*')))),
    '<ul>\n<li></li>\n</ul>',
    'should support list (unordered) (`*` -> `<ul><li>`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('**a**')))),
    '<p><strong>a</strong></p>',
    'should support strong (`**` -> `strong`)'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('***')))),
    '<hr/>',
    'should support thematic break (`***` -> `<hr>`)'
  )

  t.end()
})

test('markdown (GFM, with `remark-gfm`)', async (t) => {
  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('http://a', {remarkPlugins: [remarkGfm]}))
      )
    ),
    '<p><a href="http://a">http://a</a></p>',
    'should support links (autolink literal) (`http://a` -> `a`)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('| a |\n| - |', {remarkPlugins: [remarkGfm]}))
      )
    ),
    '<table>\n<thead>\n<tr>\n<th>a</th>\n</tr>\n</thead>\n</table>',
    'should support tables (`| a |` -> `<table>...`)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('* [x] a\n* [ ] b', {remarkPlugins: [remarkGfm]}))
      )
    ),
    '<ul class="contains-task-list">\n<li class="task-list-item"><input type="checkbox" checked="" disabled=""/> a</li>\n<li class="task-list-item"><input type="checkbox" disabled=""/> b</li>\n</ul>',
    'should support tasklists (`* [x]` -> `input`)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('~a~', {remarkPlugins: [remarkGfm]}))
      )
    ),
    '<p><del>a</del></p>',
    'should support strikethrough (`~` -> `del`)'
  )

  t.end()
})

test('markdown (frontmatter, `remark-frontmatter`)', async (t) => {
  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('---\na: b\n---\nc', {remarkPlugins: [remarkFrontmatter]})
        )
      )
    ),
    '<p>c</p>',
    'should support frontmatter (YAML)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('+++\na: b\n+++\nc', {
            remarkPlugins: [[remarkFrontmatter, 'toml']]
          })
        )
      )
    ),
    '<p>c</p>',
    'should support frontmatter (TOML)'
  )

  t.end()
})

test('markdown (math, `remark-math`, `rehype-katex`)', async (t) => {
  t.match(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('$C_L$', {
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex]
          })
        )
      )
    ),
    /<math/,
    'should support math (LaTeX)'
  )

  t.end()
})

test('markdown (footnotes, `remark-footnotes`)', async (t) => {
  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('^[note]', {
            remarkPlugins: [[remarkFootnotes, {inlineNotes: true}]]
          })
        )
      )
    ),
    '<p><a href="#fn1" class="footnote-ref" id="fnref1" role="doc-noteref"><sup>1</sup></a></p>\n<section class="footnotes" role="doc-endnotes">\n<hr/>\n<ol>\n<li id="fn1" role="doc-endnote">note<a href="#fnref1" class="footnote-back" role="doc-backlink">↩</a></li>\n</ol>\n</section>',
    'should support footnotes'
  )

  t.end()
})

test('MDX (JSX)', async (t) => {
  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('a <s>b</s>')))
    ),
    '<p>a <s>b</s></p>',
    'should support JSX (text)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<div>\n  b\n</div>')))
    ),
    '<div><p>b</p></div>',
    'should support JSX (flow)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<h1>b</h1>')))
    ),
    '<h1>b</h1>',
    'should unravel JSX (text) as an only child'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<a>b</a><b>c</b>')))
    ),
    '<a>b</a>\n<b>c</b>',
    'should unravel JSX (text) as only children'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<a>b</a>\t<b>c</b>')))
    ),
    '<a>b</a>\n\t\n<b>c</b>',
    'should unravel JSX (text) and whitespace as only children'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('{1}')))),
    '1',
    'should unravel expression (text) as an only child'
  )

  t.equal(
    renderToStaticMarkup(React.createElement(await run(compileSync('{1}{2}')))),
    '1\n2',
    'should unravel expression (text) as only children'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('{1}\n{2}')))
    ),
    '1\n2',
    'should unravel expression (text) and whitespace as only children'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('a <>b</>')))
    ),
    '<p>a b</p>',
    'should support JSX (text, fragment)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<>\n  b\n</>')))
    ),
    '<p>b</p>',
    'should support JSX (flow, fragment)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('a <x:y>b</x:y>')))
    ),
    '<p>a <x:y>b</x:y></p>',
    'should support JSX (namespace)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('export const a = 1\n\na {a}')))
    ),
    '<p>a 1</p>',
    'should support expressions in MDX (text)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('{\n  1 + 1\n}')))
    ),
    '2',
    'should support expressions in MDX (flow)'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('{/*!*/}')))
    ),
    '',
    'should support empty expressions in MDX'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<x a="1" b:c="1" hidden />')))
    ),
    '<x a="1" b:c="1" hidden=""></x>',
    'should support JSX attribute names'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('<x y="1" z=\'w\' style={{color: "red"}} />'))
      )
    ),
    '<x y="1" z="w" style="color:red"></x>',
    'should support JSX attribute values'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(await run(compileSync('<x {...{a: 1}} />')))
    ),
    '<x a="1"></x>',
    'should support JSX spread attributes'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('{<i>the sum of one and one is: {1 + 1}</i>}'))
      )
    ),
    '<i>the sum of one and one is: 2</i>',
    'should support JSX in expressions'
  )

  t.end()
})

test('MDX (ESM)', async (t) => {
  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('import {Pill} from "./components.js"\n\n<Pill>!</Pill>')
        )
      )
    ),
    '<span style="color:red">!</span>',
    'should support importing components w/ ESM'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('import {number} from "./data.js"\n\n{number}'))
      )
    ),
    '3.14',
    'should support importing data w/ ESM'
  )

  t.equal(
    (await runWhole(compileSync('export const number = Math.PI'))).number,
    Math.PI,
    'should support exporting w/ ESM'
  )

  t.ok(
    'a' in (await runWhole(compileSync('export var a'))),
    'should support exporting an identifier w/o a value'
  )

  t.equal(
    (
      await runWhole(
        compileSync('import {object} from "./data.js"\nexport var {a} = object')
      )
    ).a,
    1,
    'should support exporting an object pattern'
  )

  t.deepEqual(
    (
      await runWhole(
        compileSync(
          'import {object} from "./data.js"\nexport var {a, ...rest} = object'
        )
      )
    ).rest,
    {b: 2},
    'should support exporting a rest element in an object pattern'
  )

  t.deepEqual(
    (
      await runWhole(
        compileSync(
          'import {object} from "./data.js"\nexport var {c = 3} = object'
        )
      )
    ).c,
    3,
    'should support exporting an assignment pattern in an object pattern'
  )

  t.equal(
    (
      await runWhole(
        compileSync('import {array} from "./data.js"\nexport var [a] = array')
      )
    ).a,
    1,
    'should support exporting an array pattern'
  )

  t.equal(
    (
      await runWhole(
        compileSync('export const number = Math.PI\nexport {number as pi}')
      )
    ).pi,
    Math.PI,
    'should support `export as` w/ ESM'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync(
            'export default function Layout(props) { return <div {...props} /> }\n\na'
          )
        )
      )
    ),
    '<div><p>a</p></div>',
    'should support default export to define a layout'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('export {Layout as default} from "./components.js"\n\na')
        )
      )
    ),
    '<div style="color:red"><p>a</p></div>',
    'should support default export from a source'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('export {default} from "./components.js"\n\na'))
      )
    ),
    '<div style="color:red"><p>a</p></div>',
    'should support rexporting something as a default export from a source'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('export {default} from "./components.js"\n\na'))
      )
    ),
    '<div style="color:red"><p>a</p></div>',
    'should support rexporting the default export from a source'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(compileSync('export {default} from "./components.js"\n\na'))
      )
    ),
    '<div style="color:red"><p>a</p></div>',
    'should support rexporting the default export from a source'
  )

  t.equal(
    renderToStaticMarkup(
      React.createElement(
        await run(
          compileSync('export {default, Pill} from "./components.js"\n\na')
        )
      )
    ),
    '<div style="color:red"><p>a</p></div>',
    'should support rexporting the default export, and other things, from a source'
  )

  t.end()
})

test('theme-ui', async (t) => {
  t.match(
    renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        // @ts-expect-error enums being lost.
        {theme: themeUiBaseTheme},
        React.createElement(await run(String(compileSync('# h1'))), {
          components: themeUiComponents
        })
      )
    ),
    /<style data-emotion="css 16uteme">.css-16uteme{color:var\(--theme-ui-colors-text\);font-family:inherit;line-height:1.125;font-weight:700;font-size:32px;}<\/style><h1 class="css-16uteme">h1<\/h1>/,
    'should work'
  )

  t.end()
})

/**
 *
 * @param {VFileCompatible} input
 * @param {{keepImport?: boolean}} [options]
 * @return {Promise<MDXContent>}
 */
async function run(input, options = {}) {
  return (await runWhole(input, options)).default
}

/**
 *
 * @param {VFileCompatible} input
 * @param {{keepImport?: boolean}} [options]
 * @return {Promise<ExportMap>}
 */
async function runWhole(input, options = {}) {
  const name = 'fixture-' + nanoid().toLowerCase() + '.js'
  const fp = path.join('test', 'context', name)
  let doc = String(input)

  // Extensionless imports only work in faux-ESM (webpack and such),
  // *not* in Node by default: *except* if there’s an export map defined
  // in `package.json`.
  // React doesn’t have one yet (it’s on `master` but not yet released), so add
  // the extension for ’em:
  if (!options.keepImport) {
    doc = doc.replace(/\/jsx-runtime(?=["'])/g, '$&.js')
  }

  await fs.writeFile(fp, doc)

  try {
    /** @type {ExportMap} */
    return await import('./context/' + name)
  } finally {
    // This is not a bug: the `finally` runs after the whole `try` block, but
    // before the `return`.
    await fs.unlink(fp)
  }
}
