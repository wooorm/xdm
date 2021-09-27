'use strict'

const fs = require('fs')

let deasync

try {
  deasync = require('deasync')
} catch {
  throw new Error(
    'Could not load optional dependency `deasync`\nPlease manually install it'
  )
}

const {runSync} = deasync(load)('../run.js')
const {createFormatAwareProcessors} = deasync(load)(
  '../util/create-format-aware-processors.js'
)
const {resolveEvaluateOptions} = deasync(load)(
  '../util/resolve-evaluate-options.js'
)

module.exports = register

function register(options) {
  const {compiletime, runtime} = resolveEvaluateOptions(options)
  const {extnames, processSync} = createFormatAwareProcessors(compiletime)
  let index = -1

  while (++index < extnames.length) {
    // eslint-disable-next-line node/no-deprecated-api
    require.extensions[extnames[index]] = xdm
  }

  function xdm(module, path) {
    const file = processSync(fs.readFileSync(path))
    const result = runSync(file, runtime)
    module.exports = result.default
    module.loaded = true
  }
}

function load(filePath, callback) {
  let called

  // Sometimes, the import hangs (see error message for reasons).
  // To fix that, a timeout can be used.
  const id = setTimeout(timeout, 1024)

  function timeout() {
    done(
      new Error(
        'Could not import:\n' +
          "this error can occur when doing `require('xdm/register.cjs')` in an async function: please move the require to the top or remove it and use `node -r xdm/register.cjs …` instead\n" +
          'this error can also occur if both `xdm/register.cjs` and `xdm/esm-loader.js` are used: please use one or the other'
      )
    )
  }

  import(filePath).then((module) => {
    done(null, module)
  }, done)

  function done(error, result) {
    if (called) return
    called = true
    clearTimeout(id)
    callback(error, result)
  }
}
