import vfile from 'vfile'
import {promises as fs} from 'fs'
import {createProcessor} from '../core.js'

var eol = /\r\n|\r|\n|\u2028|\u2029/g

/**
 * Compile MDX w/ esbuild.
 *
 * @param {import('../core.js').ProcessorOptions} [options]
 * @return {import('esbuild').Plugin}
 */
export function esbuild(options) {
  var processor = createProcessor(options)

  return {name: 'esbuild-xdm', setup}

  function setup(build) {
    build.onLoad({filter: /\.mdx$/}, onload)
  }

  async function onload(data) {
    var doc = String(await fs.readFile(data.path))
    var file = vfile({contents: doc, path: data.path})
    var messages = []
    var errors = []
    var warnings = []
    var contents
    var message
    var start
    var end
    var list
    var length
    var lineStart
    var lineEnd
    var match
    var line
    var column

    try {
      file = await processor.process(file)
      contents = file.contents
      messages = file.messages
    } catch (error) {
      error.fatal = true
      messages.push(error)
    }

    for (message of messages) {
      start = message.location.start
      end = message.location.end
      list = message.fatal ? errors : warnings
      length = 0
      lineStart = 0
      line = undefined
      column = undefined

      if (start.line != null && start.column != null && start.offset != null) {
        line = start.line
        column = start.column - 1
        lineStart = start.offset - column
        length = 1

        if (end.line != null && end.column != null && end.offset != null) {
          length = end.offset - start.offset
        }
      }

      eol.lastIndex = lineStart
      match = eol.exec(doc)
      lineEnd = match ? match.index : doc.length

      list.push({
        text: message.reason,
        location: {
          file: data.path,
          line,
          column,
          length: Math.min(length, lineEnd),
          lineText: doc.slice(lineStart, lineEnd)
        },
        detail: message
      })
    }

    // For some reason, on Erbium, c8 is missing the following two lines.
    /* c8 ignore next 2 */
    return {contents, errors, warnings}
  }
}
