'use strict'

var fs = require('fs')
var deasync = require('deasync')
var {runSync} = deasync(load)('../run.js')
var {createFormatAwareProcessors} = deasync(load)(
  '../util/create-format-aware-processors.js'
)
var {resolveEvaluateOptions} = deasync(load)(
  '../util/resolve-evaluate-options.js'
)

module.exports = register

function register(options) {
  var {compiletime, runtime} = resolveEvaluateOptions(options)
  var {extnames, processSync} = createFormatAwareProcessors(compiletime)
  var index = -1

  while (++index < extnames.length) {
    // eslint-disable-next-line node/no-deprecated-api
    require.extensions[extnames[index]] = xdm
  }

  function xdm(module, path) {
    var file = processSync(fs.readFileSync(path))
    var result = runSync(file, runtime)
    module.exports = result.default
    module.loaded = true
  }
}

function load(filePath, callback) {
  var called

  // Sometimes, the import hangs (see error message for reasons).
  // To fix that, a timeout can be used.
  // However, setting a timeout, results in `deasync` waiting for it, even
  // in cases where the import is already settled!
  // That’s why this number is pretty low.
  setTimeout(timeout, 64)

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
    clearTimeout(timeout)
    callback(error, result)
  }
}
