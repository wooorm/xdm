import syntaxMdxjs from 'micromark-extension-mdxjs'
import {fromMarkdown, toMarkdown} from 'mdast-util-mdx'

/**
 * Add the micromark and mdast extensions for MDX.js (JS aware MDX).
 *
 * @param {*} [options]
 * @return {void}
 */
export function remarkMdx(options) {
  let data = this.data()

  add('micromarkExtensions', syntaxMdxjs(options))
  add('fromMarkdownExtensions', fromMarkdown)
  add('toMarkdownExtensions', toMarkdown)

  function add(field, value) {
    // Other extensions defined before this.
    // Useful when externalizing.
    /* c8 ignore next */
    if (data[field]) data[field].push(value)
    else data[field] = [value]
  }
}
