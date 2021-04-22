/**
 * @typedef {import('react').ReactElement} ReactElement
 */

import React from 'react'

/**
 * @param {Object.<string, unknown>} props
 * @returns {ReactElement}
 */
export function Pill(props) {
  return React.createElement('span', {...props, style: {color: 'red'}})
}

/**
 * @param {Object.<string, unknown>} props
 * @returns {ReactElement}
 */
export function Layout(props) {
  return React.createElement('div', {...props, style: {color: 'red'}})
}

export default Layout
