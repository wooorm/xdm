import {createLoader} from './lib/integration/node.js'

const {load, getFormat, transformSource} = createLoader()

export {load, getFormat, transformSource, createLoader}
