import { COLORS, STROKE_WIDTHS, TOOLS, type Tool } from './tools'

interface Props {
  tool: Tool
  color: string
  strokeWidth: number
  readOnly: boolean
  canUndo: boolean
  onTool: (tool: Tool) => void
  onColor: (color: string) => void
  onStrokeWidth: (width: number) => void
  onUndo: () => void
  onClear: () => void
}

const button = 'flex h-9 w-9 items-center justify-center rounded-lg text-sm transition'

export function Toolbar(props: Props) {
  const tools = props.readOnly ? TOOLS.filter((t) => t.id === 'hand') : TOOLS

  return (
    <div className="pointer-events-auto flex max-h-[calc(100vh-6rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
      <div className="flex flex-col gap-1" role="toolbar" aria-label="Drawing tools">
        {tools.map((t) => (
          <button
            key={t.id}
            title={`${t.label} (${t.shortcut.toUpperCase()})`}
            aria-label={t.label}
            aria-pressed={props.tool === t.id}
            onClick={() => props.onTool(t.id)}
            className={`${button} ${props.tool === t.id ? 'bg-indigo-500 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {!props.readOnly && (
        <>
          <hr className="border-slate-200" />
          <div className="grid grid-cols-2 gap-1" aria-label="Colours">
            {COLORS.map((c) => (
              <button
                key={c}
                title={c}
                aria-label={`Colour ${c}`}
                aria-pressed={props.color === c}
                onClick={() => props.onColor(c)}
                className={`h-4 w-4 justify-self-center rounded-full ring-offset-2 ${props.color === c ? 'ring-2 ring-indigo-500' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <hr className="border-slate-200" />
          <div className="flex flex-col gap-1" aria-label="Stroke width">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                title={`Stroke ${w}px`}
                aria-label={`Stroke ${w}px`}
                aria-pressed={props.strokeWidth === w}
                onClick={() => props.onStrokeWidth(w)}
                className={`${button} ${props.strokeWidth === w ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
              >
                <span className="rounded-full bg-slate-700" style={{ width: Math.min(w + 2, 18), height: Math.min(w + 2, 18) }} />
              </button>
            ))}
          </div>
          <hr className="border-slate-200" />
          <button
            title="Undo your last shape (Ctrl+Z)"
            aria-label="Undo"
            disabled={!props.canUndo}
            onClick={props.onUndo}
            className={`${button} text-slate-700 hover:bg-slate-100 disabled:opacity-30`}
          >
            ↶
          </button>
          <button
            title="Clear board"
            aria-label="Clear board"
            onClick={props.onClear}
            className={`${button} text-red-600 hover:bg-red-50`}
          >
            🗑
          </button>
        </>
      )}
    </div>
  )
}
