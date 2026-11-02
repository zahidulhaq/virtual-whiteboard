import Konva from 'konva'

const PADDING = 32
const MAX_DIMENSION = 8192

/**
 * Exports everything drawn on the shapes layer (not just the visible viewport)
 * as a PNG on a white background, at 2x board resolution where possible.
 */
export function exportBoardPng(stage: Konva.Stage, fileName: string) {
  const [shapesLayer, ...otherLayers] = stage.getLayers()
  if (!shapesLayer) return

  const scale = stage.scaleX()
  const bounds = shapesLayer.getClientRect({ skipShadow: true })
  const hasContent = bounds.width > 0 && bounds.height > 0
  const area = hasContent
    ? {
        x: bounds.x - PADDING * scale,
        y: bounds.y - PADDING * scale,
        width: bounds.width + PADDING * 2 * scale,
        height: bounds.height + PADDING * 2 * scale,
      }
    : { x: 0, y: 0, width: stage.width(), height: stage.height() }

  const pixelRatio = Math.min(2 / scale, MAX_DIMENSION / Math.max(area.width, area.height))

  // White backdrop behind the shapes, positioned in board coordinates.
  const transform = stage.getAbsoluteTransform().copy().invert()
  const topLeft = transform.point({ x: area.x, y: area.y })
  const background = new Konva.Rect({
    x: topLeft.x,
    y: topLeft.y,
    width: area.width / scale,
    height: area.height / scale,
    fill: '#ffffff',
    listening: false,
  })
  shapesLayer.add(background)
  background.moveToBottom()
  otherLayers.forEach((layer) => layer.hide())

  try {
    const url = stage.toDataURL({ ...area, pixelRatio, mimeType: 'image/png' })
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName.replace(/[^\w\- ]+/g, '').trim() || 'whiteboard'}.png`
    link.click()
  } finally {
    background.destroy()
    otherLayers.forEach((layer) => layer.show())
  }
}
