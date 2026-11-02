import { z } from 'zod'

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000)

/**
 * Every shape is described by a flat list of points:
 * - pen:            x1, y1, x2, y2, ... (freehand polyline)
 * - line / arrow:   x1, y1, x2, y2
 * - rect / ellipse: x1, y1, x2, y2 (opposite corners of the bounding box)
 * - text:           x, y
 */
export const shapeSchema = z
  .object({
    id: z.string().min(1).max(64).regex(/^[\w-]+$/),
    kind: z.enum(['pen', 'line', 'arrow', 'rect', 'ellipse', 'text']),
    points: z.array(coordinate).min(2).max(20_000),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    strokeWidth: z.number().min(1).max(64),
    text: z.string().max(2_000).optional(),
  })
  .refine((shape) => shape.points.length % 2 === 0, { message: 'points must be x/y pairs', path: ['points'] })
  .refine((shape) => shape.kind !== 'text' || (shape.text?.length ?? 0) > 0, {
    message: 'text shapes need text',
    path: ['text'],
  })

export type Shape = z.infer<typeof shapeSchema>

export const boardEventInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SHAPE_ADD'), payload: z.object({ shape: shapeSchema }) }),
  z.object({ type: z.literal('SHAPE_DELETE'), payload: z.object({ id: z.string().min(1).max(64) }) }),
  z.object({ type: z.literal('CLEAR'), payload: z.object({}).strict() }),
])

export type BoardEventInput = z.infer<typeof boardEventInputSchema>
