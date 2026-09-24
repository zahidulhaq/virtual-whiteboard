import { useParams } from 'react-router'

export default function Board() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-slate-800 text-white p-8">
      <h1 className="text-2xl font-bold">Board: {id}</h1>
      <p className="mt-2 text-slate-400">Canvas coming soon.</p>
    </div>
  )
}
