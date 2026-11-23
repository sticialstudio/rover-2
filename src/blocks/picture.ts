// Pictures of blocks for the lessons: the blocks are drawn by Blockly itself in a hidden workspace,
// and the drawing is copied out as a plain SVG, so a picture looks exactly like the editor's blocks.

import { Blockly, theme } from './blocks'

let ws: Blockly.WorkspaceSvg | null = null
let classes = ''
const cache = new Map<string, string>()

function workspace() {
  if (ws) return ws
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  // measured but never seen (display: none would stop Blockly measuring the text)
  host.style.cssText = 'position:fixed;left:-4000px;top:0;width:1200px;height:800px;visibility:hidden;pointer-events:none'
  document.body.appendChild(host)
  const main = Blockly.getMainWorkspace()
  ws = Blockly.inject(host, { theme: theme(false), renderer: 'zelos', media: `${import.meta.env.BASE_URL}blockly-media/`, readOnly: true })
  // the editor stays the workspace that keyboard shortcuts act on
  if (main) Blockly.common.setMainWorkspace(main)
  // the renderer's and theme's CSS is scoped to these classes (but not Blockly's own layout classes,
  // which would make the picture a full-size, absolutely placed workspace)
  classes = [ws.getInjectionDiv().className, ws.getParentSvg().getAttribute('class') ?? '']
    .join(' ')
    .split(/\s+/)
    .filter((c) => c && c !== 'injectionDiv' && c !== 'blocklySvg')
    .join(' ')
  return ws
}

/** An SVG drawing of one stack of blocks (Blockly's JSON for its top block), scaled to `scale`. */
export function blockPicture(json: object, scale = 0.8): string {
  const key = JSON.stringify(json) + scale
  const hit = cache.get(key)
  if (hit) return hit
  const w = workspace()
  w.clear()
  Blockly.serialization.blocks.append(json as Blockly.serialization.blocks.State, w)
  const box = w.getBlocksBoundingBox()
  const pad = 3
  const x = box.left - pad
  const y = box.top - pad
  const width = box.right - box.left + pad * 2
  const height = box.bottom - box.top + pad * 2
  const canvas = w.getCanvas().cloneNode(true) as SVGGElement
  canvas.removeAttribute('transform')
  const svg =
    `<div class="block-picture-art ${classes}">` +
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="${x} ${y} ${width} ${height}" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}">` +
    `${canvas.outerHTML}</svg></div>`
  w.clear()
  cache.set(key, svg)
  return svg
}
