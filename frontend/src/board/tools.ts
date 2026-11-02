import type { ShapeKind } from '../lib/types'

export type Tool = ShapeKind | 'eraser' | 'hand'

export const TOOLS: { id: Tool; label: string; icon: string; shortcut: string }[] = [
  { id: 'hand', label: 'Pan', icon: '✋', shortcut: 'h' },
  { id: 'pen', label: 'Pen', icon: '✏️', shortcut: 'p' },
  { id: 'line', label: 'Line', icon: '╱', shortcut: 'l' },
  { id: 'arrow', label: 'Arrow', icon: '➚', shortcut: 'a' },
  { id: 'rect', label: 'Rectangle', icon: '▭', shortcut: 'r' },
  { id: 'ellipse', label: 'Ellipse', icon: '◯', shortcut: 'o' },
  { id: 'text', label: 'Text', icon: 'T', shortcut: 't' },
  { id: 'eraser', label: 'Eraser', icon: '⌫', shortcut: 'e' },
]

export const COLORS = ['#1e293b', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

export const STROKE_WIDTHS = [2, 4, 8, 16]
