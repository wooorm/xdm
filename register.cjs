'use strict'

var runtime = require('react/jsx-runtime')
var register = require('./lib/integration/require.cjs')

register({...runtime})
