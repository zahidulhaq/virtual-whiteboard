import { Group, Label, Path, Tag, Text } from 'react-konva'
import type { RemoteCursor } from './useBoardSession'

/** Other users' pointers, drawn in board space but kept at a constant on-screen size. */
export function RemoteCursors({ cursors, scale }: { cursors: RemoteCursor[]; scale: number }) {
  const inverse = 1 / scale
  return cursors.map((cursor) => (
    <Group key={cursor.userId} x={cursor.x} y={cursor.y} scaleX={inverse} scaleY={inverse}>
      <Path data="M0 0 L0 16 L4.5 12 L7.5 19 L10 18 L7 11 L13 11 Z" fill={cursor.color} stroke="#ffffff" strokeWidth={1.5} />
      <Label x={14} y={16}>
        <Tag fill={cursor.color} cornerRadius={4} />
        <Text text={cursor.name} fill="#ffffff" fontSize={12} padding={4} fontFamily="system-ui, sans-serif" />
      </Label>
    </Group>
  ))
}
