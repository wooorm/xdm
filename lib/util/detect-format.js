/**
 * @param {import('vfile').VFile} file Virtual file
 * @param {string[]} markdown Markdown extnames
 * @return {'markdown' | 'mdx'}
 */
export function detectFormat(file, markdown) {
  return markdown.includes(file.extname) ? 'markdown' : 'mdx'
}
