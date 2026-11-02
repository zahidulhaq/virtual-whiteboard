import { useEffect, useState } from 'react'
import type { BoardEvent } from '../lib/types'

interface Props {
  events: BoardEvent[]
  /** Number of events applied (0 = empty board, events.length = current state). */
  position: number
  onPositionChange: (position: number) => void
  onClose: () => void
  names: Map<string, string>
}

const SPEEDS = [1, 2, 4, 8]
const BASE_STEP_MS = 400

const describe: Record<BoardEvent['type'], string> = {
  SHAPE_ADD: 'added a shape',
  SHAPE_DELETE: 'erased a shape',
  CLEAR: 'cleared the board',
}

export function ReplayPanel({ events, position, onPositionChange, onClose, names }: Props) {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const total = events.length
  const current = position > 0 ? events[position - 1] : undefined

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      if (position >= total) setPlaying(false)
      else onPositionChange(position + 1)
    }, BASE_STEP_MS / speed)
    return () => clearInterval(timer)
  }, [playing, speed, position, total, onPositionChange])

  function togglePlay() {
    // Restart from the beginning when pressing play at the end.
    if (!playing && position >= total) onPositionChange(0)
    setPlaying((p) => !p)
  }

  return (
    <div
      role="region"
      aria-label="History replay"
      className="pointer-events-auto w-[min(40rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={total === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={total}
          value={position}
          aria-label="Replay position"
          onChange={(e) => {
            setPlaying(false)
            onPositionChange(Number(e.target.value))
          }}
          className="min-w-0 flex-1 accent-indigo-500"
        />
        <select
          value={speed}
          aria-label="Playback speed"
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-1 py-1 text-xs"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
          Exit
        </button>
      </div>
      <p className="mt-2 truncate text-xs text-slate-500">
        <span className="tabular-nums">
          {position} / {total}
        </span>
        {current ? (
          <>
            {' · '}
            <span className="font-medium text-slate-700">{names.get(current.userId) ?? 'Someone'}</span>{' '}
            {describe[current.type]} · {new Date(current.createdAt).toLocaleString()}
          </>
        ) : (
          ' · Empty board'
        )}
      </p>
    </div>
  )
}
