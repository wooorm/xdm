/**
 * @typedef {import('unified').Processor} Processor
 *
 * @typedef {import('acorn').Parser} AcornParser
 * @typedef {import('acorn').Options} AcornOptions
 *
 * @typedef {Object} MdxOptions
 * @property {AcornParser} [acorn]
 * @property {AcornOptions} [acornOptions]
 * @property {boolean} [addResult=true]
 */

import syntaxMdxjs from 'micromark-extension-mdxjs'
import pkg from 'mdast-util-mdx';
const {fromMarkdown, toMarkdown} = pkg;

/**
 * Add the micromark and mdast extensions for MDX.js (JS aware MDX).
 *
 * @this {Processor}
 * @param {MdxOptions} [options]
 * @return {void}
 */
export function remarkMdx(options) {
  const data = this.data()

  add('micromarkExtensions', syntaxMdxjs(options))
  add('fromMarkdownExtensions', fromMarkdown)
  add('toMarkdownExtensions', toMarkdown)

  /**
   * @param {string} field
   * @param {unknown} value
   */
  function add(field, value) {
    // Other extensions defined before this.
    // Useful when externalizing.
    /* c8 ignore next 2 */
    // @ts-ignore Assume it’s an array.
    if (data[field]) data[field].push(value)
    else data[field] = [value]
  }
}
