import unified from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import {recmaJsxBuild} from './plugin/recma-jsx-build.js'
import {recmaDocument} from './plugin/recma-document.js'
import {recmaJsxRewrite} from './plugin/recma-jsx-rewrite.js'
import {recmaStringify} from './plugin/recma-stringify.js'
import {rehypeRecma} from './plugin/rehype-recma.js'
import {rehypeRemoveRaw} from './plugin/rehype-remove-raw.js'
import {remarkMarkAndUnravel} from './plugin/remark-mark-and-unravel.js'
import {remarkMdx} from './plugin/remark-mdx.js'
import {nodeTypes} from './node-types.js'

/**
 * @typedef {import('unified').Processor} Processor
 * @typedef {import('unified').PluggableList} PluggableList
 * @typedef {import('./plugin/recma-document').RecmaDocumentOptions} RecmaDocumentOptions
 * @typedef {import('./plugin/recma-stringify').RecmaStringifyOptions} RecmaStringifyOptions
 * @typedef {import('./plugin/recma-jsx-rewrite').RecmaJsxRewriteOptions} RecmaJsxRewriteOptions
 *
 * @typedef BaseProcessorOptions
 * @property {boolean} [jsx=false] Whether to keep JSX
 * @property {'mdx' | 'md'} [format='mdx'] Format of the files to be processed
 * @property {'program' | 'function-body'} [outputFormat='program'] Whether to compile to a whole program or a function body.
 * @property {string[]} [mdExtensions] Extensions (with `.`) for markdown
 * @property {string[]} [mdxExtensions] Extensions (with `.`) for MDX
 * @property {PluggableList} [recmaPlugins] List of recma (esast, JavaScript) plugins
 * @property {PluggableList} [remarkPlugins] List of remark (mdast, markdown) plugins
 * @property {PluggableList} [rehypePlugins] List of rehype (hast, HTML) plugins
 *
 * @typedef {Omit<RecmaDocumentOptions & RecmaStringifyOptions & RecmaJsxRewriteOptions, 'outputFormat'>} PluginOptions
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

  // @ts-ignore Sure the types prohibit it but what if someone does it anyway?
  if (format === 'detect') {
    throw new Error(
      "Incorrect `format: 'detect'`: `createProcessor` can support either `md` or `mdx`; it does not support detecting the format"
    )
  }

  return (
    unified()
      .use(remarkParse)
      .use(format === 'md' ? undefined : remarkMdx)
      .use(remarkMarkAndUnravel)
      .use(remarkPlugins)
      .use(remarkRehype, {allowDangerousHtml: true, passThrough: nodeTypes})
      .use(rehypePlugins)
      .use(format === 'md' ? rehypeRemoveRaw : undefined)
      .use(rehypeRecma)
      .use(recmaDocument, {...rest, outputFormat})
      // @ts-ignore recma transformer uses an esast node rather than a unist node
      .use(recmaJsxRewrite, {providerImportSource, outputFormat})
      // @ts-ignore recma transformer uses an esast node rather than a unist node
      .use(jsx ? undefined : recmaJsxBuild, {outputFormat})
      // @ts-ignore recma compiler is seen as a transformer
      .use(recmaStringify, {SourceMapGenerator})
      .use(recmaPlugins)
  )
}
