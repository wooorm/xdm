/**
 * @typedef {import('unified').Processor} Processor
 * @typedef {import('micromark-extension-mdxjs').Options} Options
 */

import {mdxjs} from 'micromark-extension-mdxjs'
import {mdxFromMarkdown, mdxToMarkdown} from 'mdast-util-mdx'

/**
 * Add the micromark and mdast extensions for MDX.js (JS aware MDX).
 *
 * @this {Processor}
 * @param {Options} [options]
 * @return {void}
 */
export function remarkMdx(options) {
  const data = this.data()

  add('micromarkExtensions', mdxjs(options))
  add('fromMarkdownExtensions', mdxFromMarkdown)
  add('toMarkdownExtensions', mdxToMarkdown)

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
