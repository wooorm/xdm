var AsyncFunction = Object.getPrototypeOf(run).constructor

/**
 * Asynchronously run code.
 *
 * @param {import('vfile').VFile} file JS document to run
 * @param {*} options
 * @return {Promise<*>}
 */
export async function run(file, options) {
  // V8 on Erbium.
  /* c8 ignore next 2 */
  return new AsyncFunction(String(file))(options)
}

/**
 * Synchronously run code.
 *
 * @param {import('vfile').VFile} file JS document to run
 * @param {*} options
 * @return {*}
 */
export function runSync(file, options) {
  return new Function(String(file))(options)
}
