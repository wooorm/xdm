// @ts-ignore
import markdownExtensions from 'markdown-extensions'

export var mdx = ['.mdx']
/** @type {string[]} */
export var md = markdownExtensions.map((/** @type {string} */ d) => '.' + d)
