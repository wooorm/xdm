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
 */

/**
 *
 * @param {VFileCompatible} file
 * @param {*} [options]
 * @return {Promise<VFile>}
 */
export function compile(file, options) {
  return createProcessor(options).process(file)
}

/**
 *
 * @param {VFileCompatible} file
 * @param {*} [options]
 * @return {VFile}
 */
export function compileSync(file, options) {
  return createProcessor(options).processSync(file)
}

/**
 *
 * @param {*} [options]
 * @return {Processor}
 */
function createProcessor(options = {}) {
  var {
    _contain: contain,
    jsx,
    providerImportSource,
    recmaPlugins,
    rehypePlugins,
    remarkPlugins,
    SourceMapGenerator,
    ...otherOptions
  } = options

  return unified()
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
    .use(recmaDocument, {...otherOptions, contain})
    .use(recmaJsxRewrite, {providerImportSource, contain})
    .use(jsx ? undefined : recmaJsxBuild, {contain})
    .use(recmaStringify, {SourceMapGenerator})
    .use(recmaPlugins)
}
