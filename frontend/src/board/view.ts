export interface View {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 8

export const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

/** Zooms to `scale` while keeping the screen point `anchor` fixed over the same board point. */
export function zoomAround(view: View, anchor: { x: number; y: number }, scale: number): View {
  const next = clampScale(scale)
  const world = { x: (anchor.x - view.x) / view.scale, y: (anchor.y - view.y) / view.scale }
  return { scale: next, x: anchor.x - world.x * next, y: anchor.y - world.y * next }
}
