export type Components = import('mdx/types').MDXComponents

/**
 * Props passed to the `MdxContent` component.
 * Could be anything.
 * The `components` prop is special: it defines what to use for components
 * inside the content.
 */
export type MdxContentProps = import('mdx/types').MDXProps

/**
 * A function component which renders the MDX content using a JSX implementation.
 *
 * @param props
 *   Props passed to the `MdxContent` component.
 *   Could be anything.
 *   The `components` prop is special: it defines what to use for components
 *   inside the content.
 * @returns
 *   A JSX element.
 *   The meaning of this may depend on the project configuration.
 *   As in, it could be a React, Preact, or Vue element.
 */
export type MdxContent = import('mdx/types').MDXContent
export type MdxModule = import('mdx/types').MDXModule
