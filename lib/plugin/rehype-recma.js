import toEstree from 'hast-util-to-estree'

/**
 * A plugin to transform an HTML (hast) tree to a JS (estree).
 * `hast-util-to-estree` does all the work for us!
 */
export function rehypeRecma() {
  return toEstree
}
