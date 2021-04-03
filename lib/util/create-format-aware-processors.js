import {createProcessor} from '../core.js'
import {md, mdx} from './extnames.js'
import {resolveFileAndOptions} from './resolve-file-and-options.js'

/**
 * Create smart processors to handle different formats.
 *
 * @param {import('../compile').CompileOptions} [compileOptions]
 * @return {{extnames: string[], process: process, processSync: processSync}}
 */
export function createFormatAwareProcessors(compileOptions = {}) {
  var mdExtensions = compileOptions.mdExtensions || md
  var mdxExtensions = compileOptions.mdxExtensions || mdx
  /** @type {ReturnType<createProcessor>} */
  var cachedMarkdown
  /** @type {ReturnType<createProcessor>} */
  var cachedMdx

  return {
    extnames:
      compileOptions.format === 'md'
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
  // C8 does not cover `.cjs` files.
  /* c8 ignore next 4 */
  function processSync(vfileCompatible) {
    var {file, processor} = split(vfileCompatible)
    return processor.processSync(file)
  }

  /**
   * Make a full vfile from what’s given, and figure out which processor
   * should be used for it.
   * This caches processors (one for markdown and one for MDX) so that they do
   * not have to be reconstructed for each file.
   *
   * @param {import('vfile').VFileCompatible} vfileCompatible MDX or markdown document
   * @return {{file: import('vfile').VFile, processor: import('unified').Processor}}
   */
  function split(vfileCompatible) {
    var {file, options} = resolveFileAndOptions(vfileCompatible, compileOptions)
    var processor =
      options.format === 'md'
        ? cachedMarkdown || (cachedMarkdown = createProcessor(options))
        : cachedMdx || (cachedMdx = createProcessor(options))
    return {file, processor}
  }
}
