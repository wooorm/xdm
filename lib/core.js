import unified from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import {recmaJsxBuild} from './recma-jsx-build.js'
import {recmaDocument} from './recma-document.js'
import {recmaJsxRewrite} from './recma-jsx-rewrite.js'
import {recmaStringify} from './recma-stringify.js'
import {rehypeMarkAndUnravel} from './rehype-mark-and-unravel.js'
import {rehypeRecma} from './rehype-recma.js'
import {remarkMdx} from './remark-mdx.js'

/**
 * @typedef {import("vfile").VFileCompatible} VFileCompatible
 * @typedef {import("vfile").VFile} VFile
 * @typedef {import("unified").Processor} Processor
 * @typedef {import("unified").PluggableList} PluggableList
 * @typedef {import("./recma-document").RecmaDocumentOptions} RecmaDocumentOptions
 * @typedef {import("./recma-stringify").RecmaStringifyOptions} RecmaStringifyOptions
 * @typedef {import("./recma-jsx-rewrite").RecmaJsxRewriteOptions} RecmaJsxRewriteOptions
 *
 * @typedef BaseProcessorOptions
 * @property {boolean} [jsx=false] Whether to keep JSX
 * @property {PluggableList} [recmaPlugins] List of recma (esast, JavaScript) plugins
 * @property {PluggableList} [remarkPlugins] List of remark (mdast, markdown) plugins
 * @property {PluggableList} [rehypePlugins] List of rehype (hast, HTML) plugins
 * @property {boolean} [_contain=false] Semihidden option
 *
 * @typedef {Omit<RecmaDocumentOptions & RecmaStringifyOptions & RecmaJsxRewriteOptions & BaseProcessorOptions, "_contain"> } ProcessorOptions
 */

/**
 * Compile MDX to JS.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorOptions} [options]
 * @return {Promise<VFile>}
 */
export function compile(file, options) {
  return createProcessor(options).process(file)
}

/**
 * Synchronously compile MDX to JS.
 *
 * @param {VFileCompatible} file MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {ProcessorOptions} [options]
 * @return {VFile}
 */
export function compileSync(file, options) {
  return createProcessor(options).processSync(file)
}

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
    ...otherOptions
  } = options

  return (
    unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkPlugins)
      .use(remarkRehype, {
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
      .use(recmaDocument, {...otherOptions, _contain})
      // @ts-ignore recma transformer uses an esast node rather than a unist node
      .use(recmaJsxRewrite, {providerImportSource, _contain})
      // @ts-ignore recma transformer uses an esast node rather than a unist node
      .use(jsx ? undefined : recmaJsxBuild, {_contain})
      // @ts-ignore recma compiler is seen as a transformer
      .use(recmaStringify, {SourceMapGenerator})
      .use(recmaPlugins)
  )
}
