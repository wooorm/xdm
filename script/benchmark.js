import {promises as fs} from 'fs'
import {transformSync as babel} from '@babel/core'
import marky from 'marky'
import gfm from 'remark-gfm'
import {sync as mdx1} from 'mdx1'
import {sync as mdx2} from 'mdx2'
import {compileSync as xdm} from '../index.js'

main()

async function main() {
  let doc

  try {
    doc = String(await fs.readFile('giant.mdx'))
  } catch {
    console.warn(
      'Cannot read `giant.mdx`: please place a large file in the root of `xdm`'
    )
    return
  }

  run('@mdx-js/mdx 1', () => {
    babel(mdx1(doc), {
      cloneInputAst: false,
      compact: true,
      configFile: false,
      plugins: ['@babel/plugin-transform-react-jsx']
    })
  })

  run('@mdx-js/mdx 2', () => {
    babel(mdx2(doc), {
      cloneInputAst: false,
      compact: true,
      configFile: false,
      plugins: ['@babel/plugin-transform-react-jsx']
    })
  })

  run('xdm', () => xdm(doc, {remarkPlugins: [gfm]}))
}

function run(label, fn) {
  marky.mark(label)
  fn()
  const entry = marky.stop(label)
  console.log('%s: %ims', entry.name, entry.duration)
}
