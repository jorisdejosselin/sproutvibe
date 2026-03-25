import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { createEntry, updateEntry, deleteEntry, uploadEntryPhoto, getEntries } from '../api/journal'
import { format } from 'date-fns'
import { resolveMediaUrl } from '../api/client'

export default function JournalEntryPage() {
  const { id: plantId, entryId } = useParams()
  const navigate = useNavigate()
  const cameraRef = useRef()
  const libraryRef = useRef()
  const isNew = entryId === 'new'

  const [entry, setEntry] = useState(null)
  const [form, setForm] = useState({ title: '', body: '', health: null, entry_date: format(new Date(), "yyyy-MM-dd'T'HH:mm") })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // Photo state — pendingPhoto is a File not yet uploaded (new entries or replacements before save)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)

  useEffect(() => {
    if (!isNew) {
      getEntries(plantId).then((entries) => {
        const e = entries.find((x) => String(x.id) === entryId)
        if (e) {
          setEntry(e)
          setForm({ title: e.title || '', body: e.body || '', health: e.health || null, entry_date: format(new Date(e.entry_date), "yyyy-MM-dd'T'HH:mm") })
        }
        setLoading(false)
      })
    }
  }, [plantId, entryId])

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPendingPhoto(file)
    setPendingPreview(URL.createObjectURL(file))
  }

  const handleRemovePending = () => {
    setPendingPhoto(null)
    setPendingPreview(null)
    cameraRef.current.value = ''
    libraryRef.current.value = ''
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = { ...form, entry_date: new Date(form.entry_date).toISOString() }
      let saved
      if (isNew) {
        saved = await createEntry(plantId, data)
      } else {
        saved = await updateEntry(plantId, entryId, data)
        setEntry(saved)
      }
      if (pendingPhoto) {
        const withPhoto = await uploadEntryPhoto(plantId, saved.id, pendingPhoto)
        setEntry(withPhoto)
        setPendingPhoto(null)
        setPendingPreview(null)
      }
      navigate(`/plants/${plantId}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this entry?')) return
    await deleteEntry(plantId, entryId)
    navigate(`/plants/${plantId}`)
  }

  if (loading) return <p className="text-center py-20 text-gray-400">Loading…</p>

  const photoUrl = pendingPreview || resolveMediaUrl(entry?.photo_url)

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={`/plants/${plantId}`} className="text-gray-400 hover:text-gray-600">←</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{isNew ? 'New entry' : 'Edit entry'}</h1>
        </div>
        {!isNew && (
          <button onClick={handleDelete} className="text-gray-400 hover:text-red-500">🗑️</button>
        )}
      </div>

      {/* Hidden inputs — camera and library */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

      {/* Photo area */}
      {photoUrl ? (
        <div className="relative mb-4">
          <img src={photoUrl} className="w-full rounded-xl object-cover max-h-72" />
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button
              onClick={() => cameraRef.current.click()}
              className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur hover:bg-black/70 transition-colors"
            >
              📷 Camera
            </button>
            <button
              onClick={() => libraryRef.current.click()}
              className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur hover:bg-black/70 transition-colors"
            >
              🖼️ Library
            </button>
          </div>
          {pendingPreview && (
            <button
              onClick={handleRemovePending}
              className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2.5 py-1.5 rounded-full backdrop-blur hover:bg-black/70 transition-colors"
            >
              ✕ Remove
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => cameraRef.current.click()}
            className="flex-1 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-5 flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs">Take photo</span>
          </button>
          <button
            onClick={() => libraryRef.current.click()}
            className="flex-1 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-5 flex flex-col items-center gap-1 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <span className="text-2xl">🖼️</span>
            <span className="text-xs">Choose from library</span>
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
          <input
            type="datetime-local"
            value={form.entry_date}
            onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. New leaf spotted!"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={5}
            placeholder="What did you observe?"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Plant health</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'thriving', label: 'Thriving', on: 'bg-emerald-500 text-white border-emerald-500', off: 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400' },
              { value: 'good',     label: 'Good',     on: 'bg-green-500 text-white border-green-500',   off: 'border-green-300 text-green-600 dark:border-green-700 dark:text-green-400' },
              { value: 'okay',     label: 'Okay',     on: 'bg-yellow-400 text-white border-yellow-400', off: 'border-yellow-300 text-yellow-600 dark:border-yellow-600 dark:text-yellow-400' },
              { value: 'poor',     label: 'Poor',     on: 'bg-orange-400 text-white border-orange-400', off: 'border-orange-300 text-orange-600 dark:border-orange-600 dark:text-orange-400' },
              { value: 'critical', label: 'Critical', on: 'bg-red-500 text-white border-red-500',       off: 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' },
            ].map(({ value, label, on, off }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm(f => ({ ...f, health: f.health === value ? null : value }))}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${form.health === value ? on : off}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : isNew ? 'Create entry' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
