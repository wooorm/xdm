import React from 'react'

export function Pill(props) {
  return React.createElement('span', {...props, style: {color: 'red'}})
}

export function Layout(props) {
  return React.createElement('div', {...props, style: {color: 'red'}})
}

export default Layout
