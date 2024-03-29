/**
 * @typedef {import('vfile').VFileCompatible} VFileCompatible
 * @typedef {import('./util/resolve-evaluate-options.js').EvaluateOptions} EvaluateOptions
 * @typedef {import('mdx/types').MDXModule} MDXModule
 */

import {compile, compileSync} from './compile.js'
import {run, runSync} from './run.js'
import {resolveEvaluateOptions} from './util/resolve-evaluate-options.js'

/**
 * Evaluate MDX.
 *
 * @param {VFileCompatible} vfileCompatible MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {EvaluateOptions} evaluateOptions
 * @return {Promise<MDXModule>}
 */
export async function evaluate(vfileCompatible, evaluateOptions) {
  const {compiletime, runtime} = resolveEvaluateOptions(evaluateOptions)
  // V8 on Erbium.
  /* c8 ignore next 2 */
  return run(await compile(vfileCompatible, compiletime), runtime)
}

/**
 * Synchronously evaluate MDX.
 *
 * @param {VFileCompatible} vfileCompatible MDX document to parse (`string`, `Buffer`, `vfile`, anything that can be given to `vfile`)
 * @param {EvaluateOptions} evaluateOptions
 * @return {MDXModule}
 */
export function evaluateSync(vfileCompatible, evaluateOptions) {
  const {compiletime, runtime} = resolveEvaluateOptions(evaluateOptions)
  return runSync(compileSync(vfileCompatible, compiletime), runtime)
}
