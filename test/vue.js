/**
 * @typedef {import('vue').Component} Component
 * @typedef {import('vue').SetupContext} SetupContext
 */

import path from 'node:path'
import {promises as fs} from 'node:fs'
import test from 'tape'
import {transformAsync as babel} from '@babel/core'
import vue from 'vue'
import {renderToString} from '@vue/server-renderer'
import {compile} from '../index.js'

test('xdm (vue)', async (t) => {
  const base = path.resolve(path.join('test', 'context'))

  const jsx = String(
    await compile(
      'export const C = () => <>c</>\n\n*a*, **b**, <C />, and <D />',
      {jsx: true}
    )
  )

  const fileResult = await babel(jsx, {plugins: ['@vue/babel-plugin-jsx']})

  let js = (fileResult || {code: null}).code || ''

  // Vue used to be ESM, but it recently published a minor/patch w/o that.
  js = js.replace(
    /import {[^}]+} from "vue";/,
    'import vue from "vue"; const {isVNode: _isVNode, createVNode: _createVNode, createTextVNode: _createTextVNode, Fragment: _Fragment} = vue'
  )

  await fs.writeFile(path.join(base, 'vue.js'), js)

  const Content = /** @type {Component} */ (
    /* @ts-expect-error file is dynamically generated */
    (await import('./context/vue.js')).default // type-coverage:ignore-line
  )

  const result = await renderToString(
    vue.createSSRApp({
      // App components.
      components: {Content},
      template: '<Content :components="mdxComponents" />',
      data() {
        return {
          mdxComponents: {
            em: /**
             * @param {unknown} _
             * @param {SetupContext} context
             * */ (_, context) => vue.h('i', context.attrs, context.slots),
            D: () => '<3'
          }
        }
      }
    })
  )

  t.equal(
    // Remove SSR comments used to hydrate (I guess).
    result.replace(/<!--[[\]]-->/g, ''),
    '<p><i>a</i>, <strong>b</strong>, c, and &lt;3</p>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'vue.js'))

  t.end()
})
