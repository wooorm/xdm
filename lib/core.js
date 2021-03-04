import unified from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import {recmaJsxBuild} from './plugin/recma-jsx-build.js'
import {recmaDocument} from './plugin/recma-document.js'
import {recmaJsxRewrite} from './plugin/recma-jsx-rewrite.js'
import {recmaStringify} from './plugin/recma-stringify.js'
import {rehypeMarkAndUnravel} from './plugin/rehype-mark-and-unravel.js'
import {rehypeRecma} from './plugin/rehype-recma.js'
import {remarkMdx} from './plugin/remark-mdx.js'

/**
 * @typedef {import('unified').Processor} Processor
 * @typedef {import('unified').PluggableList} PluggableList
 * @typedef {import('./plugin/recma-document').RecmaDocumentOptions} RecmaDocumentOptions
 * @typedef {import('./plugin/recma-stringify').RecmaStringifyOptions} RecmaStringifyOptions
 * @typedef {import('./plugin/recma-jsx-rewrite').RecmaJsxRewriteOptions} RecmaJsxRewriteOptions
 *
 * @typedef BaseProcessorOptions
 * @property {boolean} [jsx=false] Whether to keep JSX
 * @property {PluggableList} [recmaPlugins] List of recma (esast, JavaScript) plugins
 * @property {PluggableList} [remarkPlugins] List of remark (mdast, markdown) plugins
 * @property {PluggableList} [rehypePlugins] List of rehype (hast, HTML) plugins
 * @property {string} [_baseUrl] Semihidden option
 * @property {boolean} [_contain=false] Semihidden option
 *
 * @typedef {Omit<RecmaDocumentOptions & RecmaStringifyOptions & RecmaJsxRewriteOptions, '_baseUrl' | '_contain'>} PluginOptions
 * @typedef {BaseProcessorOptions & PluginOptions} ProcessorOptions
 */

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
  var {
    _contain,
    jsx,
    providerImportSource,
    recmaPlugins,
    rehypePlugins,
    remarkPlugins,
    SourceMapGenerator,
    ...rest
  } = options

  return (
    unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkPlugins)
      .use(remarkRehype, {
        allowDangerousHtml: true,
        // List of node types made by `mdast-util-mdx`, which have to be passed
        // through untouched from the mdast tree to the hast tree.
        passThrough: [
          'mdxFlowExpression',
          'mdxJsxFlowElement',
          'mdxJsxTextElement',
          'mdxTextExpression',
          'mdxjsEsm'
        ]
      })
      .use(rehypeMarkAndUnravel)
      .use(rehypePlugins)
      .use(rehypeRecma)
      .use(recmaDocument, {...rest, _contain})
      // @ts-ignore recma transformer uses an esast node rather than a unist node
      .use(recmaJsxRewrite, {providerImportSource, _contain})
      // @ts-ignore recma transformer uses an esast node rather than a unist node
      .use(jsx ? undefined : recmaJsxBuild, {_contain})
      // @ts-ignore recma compiler is seen as a transformer
      .use(recmaStringify, {SourceMapGenerator})
      .use(recmaPlugins)
  )
}
