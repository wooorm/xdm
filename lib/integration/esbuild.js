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

import {promises as fs} from 'fs'
import vfile from 'vfile'
import {createFormatAwareProcessors} from '../util/create-format-aware-processors.js'
import {extnamesToRegex} from '../util/extnames-to-regex.js'

const eol = /\r\n|\r|\n|\u2028|\u2029/g

/**
 * Compile MDX w/ esbuild.
 *
 * @param {ProcessorOptions} [options]
 * @return {Plugin}
 */
export function esbuild(options) {
  const name = 'esbuild-xdm'
  const {extnames, process} = createFormatAwareProcessors(options)

  return {name, setup}

  /**
   * @param {PluginBuild} build
   */
  function setup(build) {
    build.onLoad({filter: extnamesToRegex(extnames)}, onload)
  }

  /**
   * @param {Omit.<OnLoadArgs, 'pluginData'> & {pluginData?: {contents?: string}}} data
   */
  async function onload(data) {
    /** @type {string} */
    const doc =
      data.pluginData && data.pluginData.contents !== undefined
        ? data.pluginData.contents
        : String(await fs.readFile(data.path))

    let file = vfile({contents: doc, path: data.path})
    /** @type {VFileMessage[]} */
    let messages = []
    /** @type {Message[]} */
    const errors = []
    /** @type {Message[]} */
    const warnings = []
    /** @type {VFileContents} */
    let contents
    /** @type {VFileMessage} */
    let message
    /** @type {Point} */
    let start
    /** @type {Point} */
    let end
    /** @type {number} */
    let length
    /** @type {number} */
    let lineStart
    /** @type {number} */
    let lineEnd
    /** @type {RegExpExecArray} */
    let match
    /** @type {number} */
    let line
    /** @type {number} */
    let column

    try {
      file = await process(file)
      contents = file.contents
      messages = file.messages
    } catch (error) {
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
