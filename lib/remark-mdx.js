import syntaxMdxjs from 'micromark-extension-mdxjs'
import {fromMarkdown, toMarkdown} from 'mdast-util-mdx'

var warningIssued

// Add the micromark and mdast extensions for MDX.js (JS aware MDX).
export function remarkMdx(options) {
  let data = this.data()

  // Old remark.
  /* c8 ignore next 14 */
  if (
    !warningIssued &&
    ((this.Parser &&
      this.Parser.prototype &&
      this.Parser.prototype.blockTokenizers) ||
      (this.Compiler &&
        this.Compiler.prototype &&
        this.Compiler.prototype.visitors))
  ) {
    warningIssued = true
    console.warn(
      '[remark-mdx] Warning: please upgrade to remark 13 to use this plugin'
    )
  }

  add('micromarkExtensions', syntaxMdxjs(options))
  add('fromMarkdownExtensions', fromMarkdown)
  add('toMarkdownExtensions', toMarkdown)

  function add(field, value) {
    // Other extensions.
    /* c8 ignore next */
    if (data[field]) data[field].push(value)
    else data[field] = [value]
  }
}
