/* eslint-disable @typescript-eslint/naming-convention */

declare module '*.mdx' {
  import {MDXProps} from 'mdx/types'

  /**
   * MDX Content.
   *
   * @see https://v2.mdxjs.com/mdx/
   */
  export default function MDXContent(props: MDXProps): JSX.Element
}

declare module '*.md' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.markdown' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.mdown' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.mkdn' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.mkd' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.mdwn' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.mkdown' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}

declare module '*.ron' {
  /**
   * Markdown content.
   *
   * @see https://spec.commonmark.org
   */
  export {default} from '*.mdx'
}
