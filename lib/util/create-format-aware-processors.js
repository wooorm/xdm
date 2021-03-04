import {createProcessor} from '../core.js'
import {markdown, mdx} from './extnames.js'
import {resolveFileAndOptions} from './resolve-file-and-options.js'

/**
 * Create smart processors to handle different formats.
 *
 * @param {import('../compile').CompileOptions} [compileOptions]
 * @return {{extnames: string[], process: process, processSync: processSync}}
 */
export function createFormatAwareProcessors(compileOptions = {}) {
  var mdExtensions = compileOptions.markdownExtensions || markdown
  var mdxExtensions = compileOptions.mdxExtensions || mdx
  var cachedMarkdown
  var cachedMdx

  return {
    extnames:
      compileOptions.format === 'markdown'
        ? mdExtensions
        : compileOptions.format === 'mdx'
        ? mdxExtensions
        : mdExtensions.concat(mdxExtensions),
    process,
    processSync
  }

  /**
   * Smart processor.
   *
   * @param {import('vfile').VFileCompatible} vfileCompatible MDX or markdown document
   * @return {Promise<import('vfile').VFile>}
   */
  function process(vfileCompatible) {
    var {file, processor} = split(vfileCompatible)
    return processor.process(file)
  }

  /**
   * Sync smart processor.
   *
   * @param {import('vfile').VFileCompatible} vfileCompatible MDX or markdown document
   * @return {import('vfile').VFile}
   */
  function processSync(vfileCompatible) {
    var {file, processor} = split(vfileCompatible)
    return processor.processSync(file)
  }

  /**
   * Sync smart processor.
   *
   * @param {import('vfile').VFileCompatible} vfileCompatible MDX or markdown document
   * @return {{file: import('vfile').VFile, processor: import('unified').Processor}}
   */
  function split(vfileCompatible) {
    var {file, options} = resolveFileAndOptions(vfileCompatible, compileOptions)
    var processor =
      options.format === 'markdown'
        ? cachedMarkdown || (cachedMarkdown = createProcessor(options))
        : cachedMdx || (cachedMdx = createProcessor(options))
    return {file, processor}
  }
}
