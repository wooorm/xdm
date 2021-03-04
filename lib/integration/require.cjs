'use strict'

var fs = require('fs')
var deasync = require('deasync')
var runtime = require('react/jsx-runtime')

var {evaluateSync} = deasync(load)()

// eslint-disable-next-line node/no-deprecated-api
require.extensions['.mdx'] = mdx

function mdx(module, path) {
  var result = evaluateSync(fs.readFileSync(path), {...runtime})
  module.exports = result.default
  module.loaded = true
}

function load(callback) {
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

  import('../evaluate.js').then((module) => {
    done(null, module)
  }, done)

  function done(error, result) {
    if (called) return
    called = true
    clearTimeout(timeout)
    callback(error, result)
  }
}
