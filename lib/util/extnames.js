import markdownExtensions from 'markdown-extensions'

export var mdx = ['.mdx']
/** @type {string[]} */
export var markdown = markdownExtensions.map((d) => '.' + d)
