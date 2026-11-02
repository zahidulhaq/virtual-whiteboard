import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Layer, Stage } from 'react-konva'
import type { Shape } from '../lib/types'
import { newShapeId } from './boardState'
import { ShapeNode } from './ShapeNode'
import type { Tool } from './tools'
import { zoomAround, type View } from './view'

interface Props {
  stageRef: RefObject<Konva.Stage | null>
  shapes: Shape[]
  remoteDrafts: Shape[]
  readOnly: boolean
  tool: Tool
  color: string
  strokeWidth: number
  view: View
  onViewChange: (view: View) => void
  onCommit: (shape: Shape) => void
  onErase: (id: string) => void
  onDraft: (shape: Shape | null) => void
  onPointerMove?: (point: { x: number; y: number }) => void
  /** Extra content drawn above the shapes, in board coordinates. */
  overlay?: ReactNode
}

function isMeaningful(shape: Shape): boolean {
  if (shape.kind === 'pen' || shape.kind === 'text') return true
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = shape.points
  return Math.hypot(x2 - x1, y2 - y1) > 3
}

export function Canvas(props: Props) {
  const { stageRef, shapes, remoteDrafts, readOnly, tool, color, strokeWidth, view, onViewChange } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [draft, setDraft] = useState<Shape | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const erasing = useRef(false)

  const panning = tool === 'hand' || spaceHeld
  const drawing = !readOnly && !panning

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => (e.target as HTMLElement).closest('input, textarea, select')
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e)) {
        e.preventDefault()
        setSpaceHeld(true)
      }
    }
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const pointer = () => stageRef.current?.getRelativePointerPosition() ?? null

  function eraseAtPointer() {
    const stage = stageRef.current
    const pos = stage?.getPointerPosition()
    if (!stage || !pos) return
    const id = stage.getIntersection(pos)?.id()
    if (id) props.onErase(id)
  }

  function updateDraft(next: Shape | null) {
    setDraft(next)
    props.onDraft(next)
  }

  function handlePointerDown(e: KonvaEventObject<PointerEvent>) {
    if (!drawing || e.evt.button !== 0) return
    const pos = pointer()
    if (!pos) return

    if (tool === 'eraser') {
      erasing.current = true
      eraseAtPointer()
      return
    }
    if (tool === 'text') {
      const text = window.prompt('Text')?.trim()
      if (text) props.onCommit({ id: newShapeId(), kind: 'text', points: [pos.x, pos.y], color, strokeWidth, text: text.slice(0, 2000) })
      return
    }

    const start = tool === 'pen' ? [pos.x, pos.y] : [pos.x, pos.y, pos.x, pos.y]
    updateDraft({ id: newShapeId(), kind: tool as Shape['kind'], points: start, color, strokeWidth })
  }

  function handlePointerMove() {
    const pos = pointer()
    if (!pos) return
    props.onPointerMove?.(pos)

    if (erasing.current) {
      eraseAtPointer()
      return
    }
    if (!draft) return

    if (draft.kind === 'pen') {
      const [lastX = 0, lastY = 0] = draft.points.slice(-2)
      // Skip sub-pixel movements to keep strokes small.
      if (Math.hypot(pos.x - lastX, pos.y - lastY) * view.scale < 1.5) return
      if (draft.points.length >= 20_000) return
      updateDraft({ ...draft, points: [...draft.points, pos.x, pos.y] })
    } else {
      updateDraft({ ...draft, points: [draft.points[0]!, draft.points[1]!, pos.x, pos.y] })
    }
  }

  function handlePointerUp() {
    erasing.current = false
    if (!draft) return
    if (isMeaningful(draft)) props.onCommit(draft)
    updateDraft(null)
  }

  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    const pos = stage?.getPointerPosition()
    if (!stage || !pos) return

    // Pinch-zoom on trackpads and Ctrl/Cmd+wheel zoom; plain wheel pans.
    if (e.evt.ctrlKey || e.evt.metaKey) {
      onViewChange(zoomAround(view, pos, view.scale * Math.exp(-e.evt.deltaY * 0.01)))
    } else {
      onViewChange({ ...view, x: view.x - e.evt.deltaX, y: view.y - e.evt.deltaY })
    }
  }

  const cursor = panning ? 'grab' : readOnly ? 'default' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair'
  const grid = 24 * view.scale

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none bg-slate-50"
      style={{
        cursor,
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        draggable={panning}
        onDragMove={(e) => e.target === e.target.getStage() && onViewChange({ ...view, x: e.target.x(), y: e.target.y() })}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <Layer>
          {shapes.map((shape) => (
            <ShapeNode key={shape.id} shape={shape} />
          ))}
        </Layer>
        <Layer listening={false}>
          {remoteDrafts.map((shape) => (
            <ShapeNode key={shape.id} shape={shape} opacity={0.6} />
          ))}
          {draft && <ShapeNode shape={draft} />}
          {props.overlay}
        </Layer>
      </Stage>
    </div>
  )
}
