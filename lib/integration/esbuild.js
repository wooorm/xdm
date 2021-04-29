/**
 * @typedef {import('esbuild').Plugin} Plugin
 * @typedef {import('esbuild').PluginBuild} PluginBuild
 * @typedef {import('esbuild').OnLoadArgs} OnLoadArgs
 * @typedef {import('esbuild').Message} Message
 * @typedef {import('vfile').VFileContents} VFileContents
 * @typedef {import('vfile-message').VFileMessage} VFileMessage
 * @typedef {import('unist').Point} Point
 * @typedef {import('../core.js').ProcessorOptions} ProcessorOptions
 */

import vfile from 'vfile'
import {promises as fs} from 'fs'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'
import {extnamesToRegex} from '../util/extnames-to-regex.js'

var eol = /\r\n|\r|\n|\u2028|\u2029/g

/**
 * Compile MDX w/ esbuild.
 *
 * @param {ProcessorOptions} [options]
 * @return {Plugin}
 */
export function esbuild(options) {
  var name = 'esbuild-xdm'
  var {extnames, process} = createFormatAwareProcessors(options)

  return {name, setup}

  /**
   * @param {PluginBuild} build
   */
  function setup(build) {
    build.onLoad({filter: extnamesToRegex(extnames)}, onload)
  }

  /**
   * @param {OnLoadArgs} data
   */
  async function onload(data) {
    var doc = String(await fs.readFile(data.path))
    var file = vfile({contents: doc, path: data.path})
    /** @type {VFileMessage[]} */
    var messages = []
    /** @type {Message[]} */
    var errors = []
    /** @type {Message[]} */
    var warnings = []
    /** @type {VFileContents} */
    var contents
    /** @type {VFileMessage} */
    var message
    /** @type {Point} */
    var start
    /** @type {Point} */
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
        pluginName: name,
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
