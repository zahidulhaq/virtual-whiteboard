import { memo } from 'react'
import { Arrow, Ellipse, Line, Rect, Text } from 'react-konva'
import type { Shape } from '../lib/types'

interface Props {
  shape: Shape
  opacity?: number
}

/** Renders a single board shape. Every node carries the shape id so the eraser can find it. */
export const ShapeNode = memo(function ShapeNode({ shape, opacity = 1 }: Props) {
  const { id, kind, points, color, strokeWidth } = shape
  const common = {
    id,
    opacity,
    stroke: color,
    strokeWidth,
    // Thin strokes are hard to hit with the eraser; widen their hit area.
    hitStrokeWidth: Math.max(strokeWidth, 16),
    perfectDrawEnabled: false,
  }

  switch (kind) {
    case 'pen': {
      // A single click produces one point; draw it as a dot.
      const pts = points.length === 2 ? [...points, ...points] : points
      return <Line {...common} points={pts} lineCap="round" lineJoin="round" tension={0.4} />
    }
    case 'line':
      return <Line {...common} points={points} lineCap="round" />
    case 'arrow':
      return (
        <Arrow
          {...common}
          points={points}
          fill={color}
          lineCap="round"
          pointerLength={strokeWidth * 3 + 6}
          pointerWidth={strokeWidth * 3 + 6}
        />
      )
    case 'rect': {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = points
      return (
        <Rect
          {...common}
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(x2 - x1)}
          height={Math.abs(y2 - y1)}
          cornerRadius={4}
        />
      )
    }
    case 'ellipse': {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = points
      return (
        <Ellipse
          {...common}
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          radiusX={Math.abs(x2 - x1) / 2}
          radiusY={Math.abs(y2 - y1) / 2}
        />
      )
    }
    case 'text': {
      const [x = 0, y = 0] = points
      return (
        <Text
          id={id}
          opacity={opacity}
          x={x}
          y={y}
          text={shape.text ?? ''}
          fill={color}
          fontSize={14 + strokeWidth * 2}
          fontFamily="system-ui, -apple-system, sans-serif"
          perfectDrawEnabled={false}
        />
      )
    }
  }
})
