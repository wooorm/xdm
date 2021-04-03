import vfile from 'vfile'
import {promises as fs} from 'fs'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'
import {extnamesToRegex} from '../util/extnames-to-regex.js'

var eol = /\r\n|\r|\n|\u2028|\u2029/g

/**
 * Compile MDX w/ esbuild.
 *
 * @param {import('../core.js').ProcessorOptions} [options]
 * @return {import('esbuild').Plugin}
 */
export function esbuild(options) {
  var {extnames, process} = createFormatAwareProcessors(options)

  return {name: 'esbuild-xdm', setup}

  /**
   * @param {import('esbuild').PluginBuild} build
   */
  function setup(build) {
    build.onLoad({filter: extnamesToRegex(extnames)}, onload)
  }

  /**
   * @param {import('esbuild').OnLoadArgs} data
   */
  async function onload(data) {
    var doc = String(await fs.readFile(data.path))
    var file = vfile({contents: doc, path: data.path})
    /** @type {import('vfile-message').VFileMessage[]} */
    var messages = []
    /** @type {import('esbuild').Message[]} */
    var errors = []
    /** @type {import('esbuild').Message[]} */
    var warnings = []
    /** @type {import('vfile').VFileContents} */
    var contents
    /** @type {import('vfile-message').VFileMessage} */
    var message
    /** @type {import('unist').Point} */
    var start
    /** @type {import('unist').Point} */
    var end
    /** @type {number} */
    var length
    /** @type {number} */
    var lineStart
    /** @type {number} */
    var lineEnd
    /** @type {RegExpExecArray} */
    var match
    /** @type {number} */
    var line
    /** @type {number} */
    var column

    try {
      file = await process(file)
      contents = file.contents
      messages = file.messages
    } catch (/** @type {Error} */ error) {
      /** @type {Error} */
      error.fatal = true
      messages.push(error)
    }

    for (message of messages) {
      start = message.location.start
      end = message.location.end
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
      ;(message.fatal ? errors : warnings).push({
        text: message.reason,
        notes: [],
        location: {
          namespace: 'file',
          suggestion: '',
          file: data.path,
          line,
          column,
          length: Math.min(length, lineEnd),
          lineText: doc.slice(lineStart, lineEnd)
        },
        detail: message
      })
    }

    // V8 on Erbium.
    /* c8 ignore next 2 */
    return {contents, errors, warnings}
  }
}
