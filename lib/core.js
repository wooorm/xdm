/**
 * @typedef {import('unified').Processor} Processor
 * @typedef {import('unified').PluggableList} PluggableList
 * @typedef {import('./plugin/recma-document.js').RecmaDocumentOptions} RecmaDocumentOptions
 * @typedef {import('./plugin/recma-stringify.js').RecmaStringifyOptions} RecmaStringifyOptions
 * @typedef {import('./plugin/recma-jsx-rewrite.js').RecmaJsxRewriteOptions} RecmaJsxRewriteOptions
 *
 * @typedef BaseProcessorOptions
 * @property {boolean} [jsx=false] Whether to keep JSX
 * @property {'mdx'|'md'} [format='mdx'] Format of the files to be processed
 * @property {'program'|'function-body'} [outputFormat='program'] Whether to compile to a whole program or a function body.
 * @property {string[]} [mdExtensions] Extensions (with `.`) for markdown
 * @property {string[]} [mdxExtensions] Extensions (with `.`) for MDX
 * @property {PluggableList} [recmaPlugins] List of recma (esast, JavaScript) plugins
 * @property {PluggableList} [remarkPlugins] List of remark (mdast, markdown) plugins
 * @property {PluggableList} [rehypePlugins] List of rehype (hast, HTML) plugins
 *
 * @typedef {Omit<RecmaDocumentOptions & RecmaStringifyOptions & RecmaJsxRewriteOptions, 'outputFormat'>} PluginOptions
 * @typedef {BaseProcessorOptions & PluginOptions} ProcessorOptions
 */

import {unified} from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import {recmaJsxBuild} from './plugin/recma-jsx-build.js'
import {recmaDocument} from './plugin/recma-document.js'
import {recmaStringify} from './plugin/recma-stringify.js'
import {rehypeRecma} from './plugin/rehype-recma.js'
import {rehypeRemoveRaw} from './plugin/rehype-remove-raw.js'
import {remarkMarkAndUnravel} from './plugin/remark-mark-and-unravel.js'
import {remarkMdx} from './plugin/remark-mdx.js'
import {nodeTypes} from './node-types.js'
import {development as defaultDevelopment} from './condition.js'

import {visit, SKIP} from 'unist-util-visit'
import {buildJsx} from 'estree-util-build-jsx'
import {generate as estreeToString} from 'astring'
import { writeFileSync } from 'fs'
import { basename, resolve } from 'path'

/**
 * Pipeline to:
 *
 * 1. Parse MDX (serialized markdown with embedded JSX, ESM, and  expressions)
 * 2. Transform through remark (mdast), rehype (hast), and recma (esast)
 * 3. Serialize as JavaScript
 *
 * @param {ProcessorOptions} [options]
 * @return {Processor}
 */
export function createProcessor(options = {}) {
  const {
    development = defaultDevelopment,
    jsx,
    format,
    outputFormat,
    providerImportSource,
    recmaPlugins,
    rehypePlugins,
    remarkPlugins,
    SourceMapGenerator,
    ...rest
  } = options

  // @ts-expect-error runtime.
  if (format === 'detect') {
    throw new Error(
      "Incorrect `format: 'detect'`: `createProcessor` can support either `md` or `mdx`; it does not support detecting the format"
    )
  }

  const pipeline = unified().use(remarkParse)

  if (format !== 'md') {
    pipeline.use(remarkMdx)
  }

  pipeline
    .use(remarkMarkAndUnravel)
    .use(remarkPlugins || [])
    .use(remarkRehype, {allowDangerousHtml: true, passThrough: nodeTypes})
    .use(rehypePlugins || [])

  if (format === 'md') {
    pipeline.use(rehypeRemoveRaw)
  }

  pipeline.use(() => async (ast, file) => {
    writeFileSync(resolve(basename(file.path).replace(/\.\w+$/, '.json')), JSON.stringify(ast, null, 2), 'utf-8')
  })

  pipeline.use(() => async (ast, file) => {
    const scriptNodes = []
    const scriptSetupNodes = []

    visit(ast, node => node.tagName === 'pre' || node.tagName === 'code' || node.type.startsWith('mdx') || node.type.includes('jsx'),  (node, index, parent) => {
      if (parent && node.type === 'mdxjsEsm' ) {
        const statementType = node.data.estree.body[0]?.type
        if (statementType === 'VariableDeclaration' || statementType === 'ExpressionStatement')
          scriptNodes.push(node)
        else
          scriptSetupNodes.push(node)
        parent.children.splice(index, 1)
        return index
      }

      if (node.tagName === 'pre'|| node.tagName === 'code') {
        node.properties['v-pre'] = true
        return SKIP
      }

      if (node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') {
        node.type = 'element'
        node.tagName = node.name
        node.properties = Object.fromEntries(node.attributes.map(attr => {
          const isDynamic = attr.value?.type === 'mdxJsxAttributeValueExpression'
          return [
            isDynamic && !attr.name.startsWith('v-') ? `:${attr.name}`: attr.name,
            isDynamic ? attr.value.value : attr.value === null ? true : attr.value,
          ]
        }))
      } else if (node.type === 'mdxTextExpression') {
        node.type = 'text'
        node.value = `{{ ${node.value} }}`
      }
    })

    const br = { type: 'text', value: '\n' }

    const wrapInScript = (children, properties) => children.length === 0 ? undefined : ({
      type: "element",
      tagName: "script",
      properties,
      children: [{
        type: "text",
        value: `\n${children.map(node => estreeToString(buildJsx(node.data.estree, { runtime: 'automatic',
      importSource: 'iles' }))).join("\n")}${properties.setup ? '' : 'export default { data() {return { ...meta, ...frontmatter } } }'}`.replace(/export const/g, 'const'),
      }],
    })

    ast.children = [
      wrapInScript(scriptNodes, { lang: 'ts' }),
      wrapInScript(scriptSetupNodes, { setup: true, lang: 'ts' }),
      { type: 'element', tagName: 'template', content: { children: ast.children } },
    ].filter(x => x).flatMap(node => [node, br, br])

    writeFileSync(resolve(basename(file.path).replace(/\.\w+$/, '-children.json')), JSON.stringify(ast, null, 2), 'utf-8')
  })

  pipeline.use(rehypeStringify)

  // pipeline
  //   .use(rehypeRecma)
  //   .use(recmaDocument, {...rest, outputFormat})

  // if (!jsx) {
  //   pipeline.use(recmaJsxBuild, {outputFormat})
  // }

  // pipeline.use(recmaStringify, {SourceMapGenerator}).use(recmaPlugins || [])

  return pipeline
}
