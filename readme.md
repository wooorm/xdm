# `@islands/xdm`

[xdm](https://github.com/wooorm/xdm) without the following plugins:

- `recma-jsx-rewrite`
- `recma-document`
- `recma-jsx-build`

Instead, it adds Vue specific plugins, that will compile JSX to `createVNode`
calls by using the following recma plugins:

## `recma-vue-component`
  Wraps JSX elements into the `render` function of a `defineComponent`, which is the default export.

## `recma-vue-jsx-build`
  Converts JSX elements into `createVNode` calls.

  It also detects which components have not been locally defined or imported,
  and uses `resolveComponent` calls, enabling support for global components (and
  automatic resolution using `unplugin-vue-components`).

## About this fork

This fork will no longer be necessary once the following packages are released
independently, in order of importance (some are light wrappers around other utilities):

- `remark-mark-and-unravel`
- `recma-stringify`
- `rehype-remove-raw`
- `rehype-recma`
- `remark-mdx`
